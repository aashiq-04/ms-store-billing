// internal/db/bills.go
package db

import (
	"database/sql"
	"fmt"
	"log"

	"ms-store-billing/internal/models"
)

// ============================================
// BILL CRUD OPERATIONS
// ============================================

// CreateBill creates a new bill with all its items
// This is a transaction - all items must be saved or none
func CreateBill(req *models.BillCreateRequest) (*models.Bill, error) {
	// Validate request
	if err := req.Validate(); err != nil {
		return nil, err
	}

	// Calculate totals
	subtotal, total := req.CalculateTotals()

	// Serialize write operations to prevent SQLite transaction conflicts
	// SQLite doesn't handle concurrent transactions well, even with WAL mode
	writeMutex.Lock()
	defer writeMutex.Unlock()

	// Start transaction with retry logic
	// If connection is in a bad state, try to clean it first
	var tx *sql.Tx
	var err error

	// Try to start transaction
	tx, err = DB.Begin()
	if err != nil {
		// If Begin fails, try to rollback any stale transaction and retry
		DB.Exec("ROLLBACK") // Ignore error - might not have a transaction
		tx, err = DB.Begin()
		if err != nil {
			return nil, fmt.Errorf("failed to begin transaction (after cleanup): %w", err)
		}
	}

	// Track if we've committed to avoid double rollback
	committed := false
	defer func() {
		if !committed {
			tx.Rollback()
		}
	}()

	// Insert bill header
	billQuery := `
        INSERT INTO bills (bill_number, item_count, subtotal, total)
        VALUES (?, ?, ?, ?)
    `

	// Use temporary bill number, will update after we get ID
	result, err := tx.Exec(billQuery, "TEMP", len(req.Items), subtotal, total)
	if err != nil {
		return nil, fmt.Errorf("failed to create bill: %w", err)
	}

	billID, err := result.LastInsertId()
	if err != nil {
		return nil, fmt.Errorf("failed to get bill ID: %w", err)
	}

	// Generate proper bill number
	billNumber := models.GenerateBillNumber(billID)

	// Update bill with proper bill number
	updateQuery := `UPDATE bills SET bill_number = ? WHERE id = ?`
	_, err = tx.Exec(updateQuery, billNumber, billID)
	if err != nil {
		return nil, fmt.Errorf("failed to update bill number: %w", err)
	}

	// Insert bill items
	itemQuery := `
        INSERT INTO bill_items (bill_id, item_name, quantity, unit, unit_price, line_total)
        VALUES (?, ?, ?, ?, ?, ?)
    `

	// Collect unique product names to update later (outside transaction)
	productNames := make(map[string]bool)

	for _, item := range req.Items {
		lineTotal := item.Quantity * item.UnitPrice

		_, err := tx.Exec(itemQuery, billID, item.ItemName, item.Quantity, item.Unit, item.UnitPrice, lineTotal)
		if err != nil {
			return nil, fmt.Errorf("failed to create bill item: %w", err)
		}

		// Track product name for last_used_at update (after transaction)
		productNames[item.ItemName] = true
	}

	// Commit transaction
	if err := tx.Commit(); err != nil {
		return nil, fmt.Errorf("failed to commit transaction: %w", err)
	}
	committed = true

	// Update product last_used_at AFTER transaction completes
	// This is non-critical, so we don't fail if it errors
	for productName := range productNames {
		_ = UpdateProductLastUsed(productName)
	}

	// Retrieve and return the created bill
	return GetBillByID(billID)
}

// GetBillByID retrieves a bill with all its items
func GetBillByID(id int64) (*models.Bill, error) {
	// Get bill header
	billQuery := `
        SELECT id, bill_number, item_count, subtotal, total, created_at
        FROM bills
        WHERE id = ?
    `

	var bill models.Bill
	var createdAt string

	err := DB.QueryRow(billQuery, id).Scan(
		&bill.ID,
		&bill.BillNumber,
		&bill.ItemCount,
		&bill.Subtotal,
		&bill.Total,
		&createdAt,
	)

	if err == sql.ErrNoRows {
		return nil, models.ErrBillNotFound
	}
	if err != nil {
		return nil, fmt.Errorf("failed to get bill: %w", err)
	}

	bill.CreatedAt = parseTime(createdAt)

	// Get bill items
	itemsQuery := `
        SELECT id, bill_id, item_name, quantity, unit, unit_price, line_total
        FROM bill_items
        WHERE bill_id = ?
        ORDER BY id ASC
    `

	rows, err := DB.Query(itemsQuery, id)
	if err != nil {
		return nil, fmt.Errorf("failed to query bill items: %w", err)
	}
	defer rows.Close()

	items := []models.BillItem{}
	for rows.Next() {
		var item models.BillItem
		err := rows.Scan(
			&item.ID,
			&item.BillID,
			&item.ItemName,
			&item.Quantity,
			&item.Unit,
			&item.UnitPrice,
			&item.LineTotal,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan bill item: %w", err)
		}
		items = append(items, item)
	}

	bill.Items = items

	return &bill, nil
}

// GetBillByNumber retrieves a bill by its bill number (e.g., "MS-0042")
func GetBillByNumber(billNumber string) (*models.Bill, error) {
	query := `SELECT id FROM bills WHERE bill_number = ?`

	var id int64
	err := DB.QueryRow(query, billNumber).Scan(&id)

	if err == sql.ErrNoRows {
		return nil, models.ErrBillNotFound
	}
	if err != nil {
		return nil, fmt.Errorf("failed to get bill by number: %w", err)
	}

	return GetBillByID(id)
}

// GetRecentBills retrieves the most recent bills
func GetRecentBills(limit int) ([]models.Bill, error) {
	query := `
        SELECT id, bill_number, item_count, subtotal, total, created_at
        FROM bills
        ORDER BY created_at DESC
        LIMIT ?
    `

	rows, err := DB.Query(query, limit)
	if err != nil {
		return nil, fmt.Errorf("failed to query recent bills: %w", err)
	}
	defer rows.Close()

	bills := []models.Bill{}
	for rows.Next() {
		var bill models.Bill
		var createdAt string

		err := rows.Scan(
			&bill.ID,
			&bill.BillNumber,
			&bill.ItemCount,
			&bill.Subtotal,
			&bill.Total,
			&createdAt,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan bill: %w", err)
		}

		bill.CreatedAt = parseTime(createdAt)

		// Note: Not loading items for list view (performance)
		// Call GetBillByID() if you need full bill with items

		bills = append(bills, bill)
	}

	return bills, nil
}

// GetBillCount returns total number of bills
func GetBillCount() (int, error) {
	var count int
	query := `SELECT COUNT(*) FROM bills`

	err := DB.QueryRow(query).Scan(&count)
	if err != nil {
		return 0, fmt.Errorf("failed to count bills: %w", err)
	}

	return count, nil
}

// GetTodaysBillCount returns number of bills created today
func GetTodaysBillCount() (int, error) {
	var count int
	query := `
        SELECT COUNT(*) FROM bills
        WHERE DATE(created_at) = DATE('now', 'localtime')
    `

	err := DB.QueryRow(query).Scan(&count)
	if err != nil {
		return 0, fmt.Errorf("failed to count today's bills: %w", err)
	}

	return count, nil
}

// GetTodaysTotalSales returns sum of all bills created today
func GetTodaysTotalSales() (float64, error) {
	var total sql.NullFloat64
	query := `
        SELECT SUM(total) FROM bills
        WHERE DATE(created_at) = DATE('now', 'localtime')
    `

	err := DB.QueryRow(query).Scan(&total)
	if err != nil {
		return 0, fmt.Errorf("failed to get today's sales: %w", err)
	}

	if !total.Valid {
		return 0, nil // No sales today
	}

	return total.Float64, nil
}

// DeleteBill removes a bill and all its items (cascade)
func DeleteBill(id int64) error {
	// Check if bill exists
	_, err := GetBillByID(id)
	if err != nil {
		return err
	}

	query := `DELETE FROM bills WHERE id = ?`

	_, err = DB.Exec(query, id)
	if err != nil {
		return fmt.Errorf("failed to delete bill: %w", err)
	}

	log.Printf("Bill #%d deleted", id)
	return nil
}

// CleanupOldBills deletes bills older than specified days
func CleanupOldBills(daysToKeep int) (int, error) {
	query := `
        DELETE FROM bills
        WHERE created_at < datetime('now', '-' || ? || ' days')
    `

	result, err := DB.Exec(query, daysToKeep)
	if err != nil {
		return 0, fmt.Errorf("failed to cleanup old bills: %w", err)
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return 0, fmt.Errorf("failed to get affected rows: %w", err)
	}

	if rowsAffected > 0 {
		log.Printf("✓ Cleaned up %d bills older than %d days", rowsAffected, daysToKeep)
	}

	return int(rowsAffected), nil
}
func GetBillsByDateRange(days int) ([]models.Bill, error) {
	query := `
		SELECT id, bill_number, item_count, subtotal, total, created_at
		FROM bills
		WHERE created_at >= datetime('now', '-' || ? || ' days')
		ORDER BY created_at DESC
	`

	rows, err := DB.Query(query, days)
	if err != nil {
		return nil, fmt.Errorf("failed to query bills: %w", err)
	}
	defer rows.Close()

	bills := []models.Bill{}
	for rows.Next() {
		var bill models.Bill
		var createdAt string

		if err := rows.Scan(
			&bill.ID,
			&bill.BillNumber,
			&bill.ItemCount,
			&bill.Subtotal,
			&bill.Total,
			&createdAt,
		); err != nil {
			return nil, err
		}

		bill.CreatedAt = parseTime(createdAt)
		bills = append(bills, bill)
	}

	return bills, nil
}

// GetBillsByDateRange retrieves bills within a date range
// func GetBillsByDateRange(startDate, endDate string) ([]models.Bill, error) {
// 	// query := `
//     //     SELECT id, bill_number, item_count, subtotal, total, created_at
//     //     FROM bills
//     //     WHERE created_at >= ? AND created_at <= ?
//     //     ORDER BY created_at DESC
//     // `
// 	query := `
// 		SELECT id, bill_number, item_count, subtotal, total, created_at
// 		FROM bills
// 		WHERE datetime(created_at, 'localtime') >= datetime(?)
// 		AND datetime(created_at, 'localtime') <= datetime(?)
// 		ORDER BY created_at DESC
// 	`


// 	rows, err := DB.Query(query, startDate, endDate)
// 	if err != nil {
// 		return nil, fmt.Errorf("failed to query bills by date range: %w", err)
// 	}
// 	defer rows.Close()

// 	bills := []models.Bill{}
// 	for rows.Next() {
// 		var bill models.Bill
// 		var createdAt string

// 		err := rows.Scan(
// 			&bill.ID,
// 			&bill.BillNumber,
// 			&bill.ItemCount,
// 			&bill.Subtotal,
// 			&bill.Total,
// 			&createdAt,
// 		)
// 		if err != nil {
// 			return nil, fmt.Errorf("failed to scan bill: %w", err)
// 		}

// 		bill.CreatedAt = parseTime(createdAt)
// 		bills = append(bills, bill)
// 	}

// 	return bills, nil
// }
func GetBillStats(days int) (map[string]interface{}, error) {
	query := `
		SELECT 
			COUNT(*) as total_bills,
			COALESCE(SUM(total), 0) as total_sales,
			COALESCE(AVG(total), 0) as avg_bill_amount,
			COALESCE(SUM(item_count), 0) as total_items
		FROM bills
		WHERE created_at >= datetime('now', '-' || ? || ' days')
	`

	var stats struct {
		TotalBills    int
		TotalSales    float64
		AvgBillAmount float64
		TotalItems    int
	}

	err := DB.QueryRow(query, days).Scan(
		&stats.TotalBills,
		&stats.TotalSales,
		&stats.AvgBillAmount,
		&stats.TotalItems,
	)
	if err != nil {
		return nil, err
	}

	return map[string]interface{}{
		"total_bills":     stats.TotalBills,
		"total_sales":     stats.TotalSales,
		"avg_bill_amount": stats.AvgBillAmount,
		"total_items":     stats.TotalItems,
	}, nil
}

// // GetBillStats returns statistics for a date range
// func GetBillStats(startDate, endDate string) (map[string]interface{}, error) {
// 	query := `
//         SELECT 
//             COUNT(*) as total_bills,
//             COALESCE(SUM(total), 0) as total_sales,
//             COALESCE(AVG(total), 0) as avg_bill_amount,
//             COALESCE(SUM(item_count), 0) as total_items
//         FROM bills
//         WHERE created_at >= ? AND created_at <= ?
//     `

// 	var stats struct {
// 		TotalBills    int
// 		TotalSales    float64
// 		AvgBillAmount float64
// 		TotalItems    int
// 	}

// 	err := DB.QueryRow(query, startDate, endDate).Scan(
// 		&stats.TotalBills,
// 		&stats.TotalSales,
// 		&stats.AvgBillAmount,
// 		&stats.TotalItems,
// 	)
// 	if err != nil {
// 		return nil, fmt.Errorf("failed to get bill stats: %w", err)
// 	}

// 	result := map[string]interface{}{
// 		"total_bills":     stats.TotalBills,
// 		"total_sales":     stats.TotalSales,
// 		"avg_bill_amount": stats.AvgBillAmount,
// 		"total_items":     stats.TotalItems,
// 	}

// 	return result, nil
// }

// SearchBills searches bills by bill number or date
func SearchBills(searchTerm string, limit int) ([]models.Bill, error) {
	query := `
        SELECT id, bill_number, item_count, subtotal, total, created_at
        FROM bills
        WHERE bill_number LIKE ? || '%'
           OR DATE(created_at) = DATE(?)
        ORDER BY created_at DESC
        LIMIT ?
    `

	rows, err := DB.Query(query, searchTerm, searchTerm, limit)
	if err != nil {
		return nil, fmt.Errorf("failed to search bills: %w", err)
	}
	defer rows.Close()

	bills := []models.Bill{}
	for rows.Next() {
		var bill models.Bill
		var createdAt string

		err := rows.Scan(
			&bill.ID,
			&bill.BillNumber,
			&bill.ItemCount,
			&bill.Subtotal,
			&bill.Total,
			&createdAt,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan bill: %w", err)
		}

		bill.CreatedAt = parseTime(createdAt)
		bills = append(bills, bill)
	}

	return bills, nil
}

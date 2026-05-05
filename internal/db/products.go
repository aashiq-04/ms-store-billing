// internal/db/products.go
package db

import (
    "database/sql"
    "fmt"
    "strings"
    "time"

    "ms-store-billing/internal/models"
)

// ============================================
// PRODUCT CRUD OPERATIONS
// ============================================

// GetAllProducts retrieves all products from database
func GetAllProducts() ([]models.Product, error) {
    query := `
        SELECT id, name, tamil_name, price, unit, category, last_used_at, created_at, updated_at
        FROM products
        ORDER BY name ASC
    `

    rows, err := DB.Query(query)
    if err != nil {
        return nil, fmt.Errorf("failed to query products: %w", err)
    }
    defer rows.Close()

    return scanProducts(rows)
}

// SearchProducts searches products by name (for autocomplete)
// Returns max 20 results, sorted by:
// 1. Recently used first (last_used_at DESC)
// 2. Then alphabetically (name ASC)
func SearchProducts(searchTerm string) ([]models.Product, error) {
    query := `
        SELECT id, name, tamil_name, price, unit, category, last_used_at, created_at, updated_at
        FROM products
        WHERE name LIKE ? || '%'
        ORDER BY 
            CASE WHEN last_used_at IS NULL THEN 1 ELSE 0 END,
            last_used_at DESC,
            name ASC
        LIMIT 20
    `

    rows, err := DB.Query(query, searchTerm)
    if err != nil {
        return nil, fmt.Errorf("failed to search products: %w", err)
    }
    defer rows.Close()

    return scanProducts(rows)
}

// GetProductByID retrieves a single product by ID
func GetProductByID(id int64) (*models.Product, error) {
    query := `
        SELECT id, name, tamil_name, price, unit, category, last_used_at, created_at, updated_at
        FROM products
        WHERE id = ?
    `

    var product models.Product
    var lastUsedAt sql.NullString
    var tamilName sql.NullString
    var createdAt, updatedAt string

    err := DB.QueryRow(query, id).Scan(
        &product.ID,
        &product.Name,
        &tamilName,
        &product.Price,
        &product.Unit,
        &product.Category,
        &lastUsedAt,
        &createdAt,
        &updatedAt,
    )

    if err == sql.ErrNoRows {
        return nil, models.ErrProductNotFound
    }
    if err != nil {
        return nil, fmt.Errorf("failed to get product: %w", err)
    }

    // Parse time strings
    product.CreatedAt = parseTime(createdAt)
    product.UpdatedAt = parseTime(updatedAt)
    
    if lastUsedAt.Valid {
        t := parseTime(lastUsedAt.String)
        product.LastUsedAt = &t
    }
    if tamilName.Valid {
        product.TamilName = tamilName.String
    }

    return &product, nil
}

// GetProductByName retrieves a product by exact name match (case-insensitive)
func GetProductByName(name string) (*models.Product, error) {
    query := `
        SELECT id, name, tamil_name, price, unit, category, last_used_at, created_at, updated_at
        FROM products
        WHERE LOWER(name) = LOWER(?)
    `

    var product models.Product
    var lastUsedAt sql.NullString
    var tamilName sql.NullString
    var createdAt, updatedAt string

    err := DB.QueryRow(query, name).Scan(
        &product.ID,
        &product.Name,
        &tamilName,
        &product.Price,
        &product.Unit,
        &product.Category,
        &lastUsedAt,
        &createdAt,
        &updatedAt,
    )

    if err == sql.ErrNoRows {
        return nil, models.ErrProductNotFound
    }
    if err != nil {
        return nil, fmt.Errorf("failed to get product by name: %w", err)
    }

    // Parse time strings
    product.CreatedAt = parseTime(createdAt)
    product.UpdatedAt = parseTime(updatedAt)
    
    if lastUsedAt.Valid {
        t := parseTime(lastUsedAt.String)
        product.LastUsedAt = &t
    }

    if tamilName.Valid {
        product.TamilName = tamilName.String
    }

    return &product, nil
}

// CreateProduct inserts a new product into database
func CreateProduct(req *models.ProductCreateRequest) (*models.Product, error) {
    // Validate input
    if err := req.Validate(); err != nil {
        return nil, err
    }

    // Check if product name already exists
    existing, _ := GetProductByName(req.Name)
    if existing != nil {
        return nil, models.ErrProductNameExists
    }

    query := `
        INSERT INTO products (name, tamil_name, price, unit, category)
        VALUES (?, ?, ?, ?, ?)
    `

    result, err := DB.Exec(query, req.Name, req.TamilName, req.Price, req.Unit, req.Category)
    if err != nil {
        // Check for unique constraint violation
        if strings.Contains(err.Error(), "UNIQUE constraint failed") {
            return nil, models.ErrProductNameExists
        }
        return nil, fmt.Errorf("failed to create product: %w", err)
    }

    id, err := result.LastInsertId()
    if err != nil {
        return nil, fmt.Errorf("failed to get insert ID: %w", err)
    }

    // Retrieve the created product
    return GetProductByID(id)
}

// UpdateProduct modifies an existing product
// Only updates fields that are non-nil in the request
func UpdateProduct(id int64, req *models.ProductUpdateRequest) (*models.Product, error) {
    // Check if product exists
    existing, err := GetProductByID(id)
    if err != nil {
        return nil, err
    }

    // Build dynamic UPDATE query based on provided fields
    updates := []string{}
    args := []interface{}{}

    if req.Name != nil {
        // Check if new name conflicts with another product
        if *req.Name != existing.Name {
            other, _ := GetProductByName(*req.Name)
            if other != nil && other.ID != id {
                return nil, models.ErrProductNameExists
            }
        }
        updates = append(updates, "name = ?")
        args = append(args, *req.Name)
    }

    if req.TamilName != nil {
        updates = append(updates, "tamil_name = ?")
        args = append(args, *req.TamilName)
    }

    if req.Price != nil {
        if *req.Price <= 0 {
            return nil, models.ErrProductPriceInvalid
        }
        updates = append(updates, "price = ?")
        args = append(args, *req.Price)
    }

    if req.Unit != nil {
        if *req.Unit == "" {
            return nil, models.ErrProductUnitRequired
        }
        updates = append(updates, "unit = ?")
        args = append(args, *req.Unit)
    }

    if req.Category != nil {
        updates = append(updates, "category = ?")
        args = append(args, *req.Category)
    }

    // If no fields to update, return existing product
    if len(updates) == 0 {
        return existing, nil
    }

    // Add updated_at
    updates = append(updates, "updated_at = datetime('now', 'localtime')")

    // Add ID to args (for WHERE clause)
    args = append(args, id)

    query := fmt.Sprintf("UPDATE products SET %s WHERE id = ?", strings.Join(updates, ", "))

    _, err = DB.Exec(query, args...)
    if err != nil {
        return nil, fmt.Errorf("failed to update product: %w", err)
    }

    // Return updated product
    return GetProductByID(id)
}

// DeleteProduct removes a product from database
func DeleteProduct(id int64) error {
    // Check if product exists
    _, err := GetProductByID(id)
    if err != nil {
        return err
    }

    query := `DELETE FROM products WHERE id = ?`

    _, err = DB.Exec(query, id)
    if err != nil {
        return fmt.Errorf("failed to delete product: %w", err)
    }

    return nil
}

// UpdateProductLastUsed updates the last_used_at timestamp
// Called when a product is added to a bill
func UpdateProductLastUsed(productName string) error {
    query := `
        UPDATE products 
        SET last_used_at = datetime('now', 'localtime')
        WHERE LOWER(name) = LOWER(?)
    `

    _, err := DB.Exec(query, productName)
    if err != nil {
        // Don't fail billing if this update fails
        // Just log the error
        return fmt.Errorf("failed to update last_used_at: %w", err)
    }

    return nil
}

// ============================================
// HELPER FUNCTIONS
// ============================================

// scanProducts is a helper to scan multiple product rows
func scanProducts(rows *sql.Rows) ([]models.Product, error) {
    products := []models.Product{}

    for rows.Next() {
        var product models.Product
        var lastUsedAt sql.NullString
        var tamilName sql.NullString
        var createdAt, updatedAt string

        err := rows.Scan(
            &product.ID,
            &product.Name,
            &tamilName,
            &product.Price,
            &product.Unit,
            &product.Category,
            &lastUsedAt,
            &createdAt,
            &updatedAt,
        )
        if err != nil {
            return nil, fmt.Errorf("failed to scan product: %w", err)
        }

        if tamilName.Valid {
            product.TamilName = tamilName.String
        }

        // Parse time strings
        product.CreatedAt = parseTime(createdAt)
        product.UpdatedAt = parseTime(updatedAt)
        
        if lastUsedAt.Valid {
            t := parseTime(lastUsedAt.String)
            product.LastUsedAt = &t
        }

        products = append(products, product)
    }

    if err := rows.Err(); err != nil {
        return nil, fmt.Errorf("error iterating products: %w", err)
    }

    return products, nil
}

// parseTime converts SQLite datetime string to time.Time
// SQLite format: "2006-01-02 15:04:05"
func parseTime(timeStr string) time.Time {
	if timeStr == "" {
		return time.Time{}
	}

	localLoc := time.Now().Location()

	// Parse local-without-timezone values as local time.
	localFormats := []string{
		"2006-01-02 15:04:05",
		"2006-01-02T15:04:05",
	}
	for _, format := range localFormats {
		t, err := time.ParseInLocation(format, timeStr, localLoc)
		if err == nil {
			return t
		}
	}

	// Parse timezone-aware values and convert to local time for display.
	zonedFormats := []string{
		"2006-01-02T15:04:05Z",
		time.RFC3339,
	}
	for _, format := range zonedFormats {
		t, err := time.Parse(format, timeStr)
		if err == nil {
			return t.In(localLoc)
		}
	}

	// If all parsing fails, return zero time
	return time.Time{}
}

// GetProductCount returns total number of products
func GetProductCount() (int, error) {
    var count int
    query := `SELECT COUNT(*) FROM products`

    err := DB.QueryRow(query).Scan(&count)
    if err != nil {
        return 0, fmt.Errorf("failed to count products: %w", err)
    }

    return count, nil
}

// GetProductsByCategory returns products filtered by category
func GetProductsByCategory(category string) ([]models.Product, error) {
    query := `
        SELECT id, name, tamil_name, price, unit, category, last_used_at, created_at, updated_at
        FROM products
        WHERE category = ?
        ORDER BY name ASC
    `

    rows, err := DB.Query(query, category)
    if err != nil {
        return nil, fmt.Errorf("failed to query products by category: %w", err)
    }
    defer rows.Close()

    return scanProducts(rows)
}
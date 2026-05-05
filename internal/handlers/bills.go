// internal/handlers/bills.go
package handlers

import (
    "fmt"
    "net/http"
    "strconv"
    "strings"
    "time"

    "ms-store-billing/internal/db"
    "ms-store-billing/internal/models"
)

// BillsHandler handles all bill-related endpoints
// Routes:
//   GET  /api/bills           - Get recent bills
//   GET  /api/bills/:id       - Get bill by ID
//   POST /api/bills           - Create new bill
func BillsHandler(w http.ResponseWriter, r *http.Request) {
    enableCORS(w)

    // Handle OPTIONS for CORS preflight
    if r.Method == http.MethodOptions {
        w.WriteHeader(http.StatusOK)
        return
    }

    // Parse path to extract ID if present
    path := strings.TrimPrefix(r.URL.Path, "/api/bills")
    path = strings.Trim(path, "/")

    switch r.Method {
    case http.MethodGet:
        if path == "" {
            // GET /api/bills - Get recent bills
            handleGetRecentBills(w, r)
        } else {
            // GET /api/bills/:id - Get single bill
            handleGetBill(w, r, path)
        }

    case http.MethodPost:
        // POST /api/bills - Create new bill
        handleCreateBill(w, r)

    default:
        respondError(w, http.StatusMethodNotAllowed, "method not allowed")
    }
}

// handleGetRecentBills retrieves recent bills
// Query params:
//   ?limit=10 - Number of bills to retrieve (default: 20)
func handleGetRecentBills(w http.ResponseWriter, r *http.Request) {
    limitStr := r.URL.Query().Get("limit")
    limit := 20 // Default

    if limitStr != "" {
        if l, err := strconv.Atoi(limitStr); err == nil && l > 0 {
            limit = l
        }
    }

    bills, err := db.GetRecentBills(limit)
    if err != nil {
        handleError(w, err)
        return
    }

    respondSuccess(w, bills)
}

// handleGetBill retrieves a single bill by ID or bill number
// Accepts both numeric ID (123) and bill number (MS-0123)
func handleGetBill(w http.ResponseWriter, r *http.Request, idOrNumber string) {
    var bill *models.Bill
    var err error

    // Try to parse as numeric ID first
    if id, parseErr := strconv.ParseInt(idOrNumber, 10, 64); parseErr == nil {
        bill, err = db.GetBillByID(id)
    } else {
        // Otherwise treat as bill number
        bill, err = db.GetBillByNumber(idOrNumber)
    }

    if err != nil {
        handleError(w, err)
        return
    }

    respondSuccess(w, bill)
}

// BillHistoryHandler handles bill history requests
// GET /api/bills/history?days=7
func BillHistoryHandler(w http.ResponseWriter, r *http.Request) {
    enableCORS(w)

    if r.Method == http.MethodOptions {
        w.WriteHeader(http.StatusOK)
        return
    }

    if r.Method != http.MethodGet {
        respondError(w, http.StatusMethodNotAllowed, "method not allowed")
        return
    }

    // Get days parameter (default: 7)
    daysStr := r.URL.Query().Get("days")
    days := 7
    if daysStr != "" {
        if d, err := strconv.Atoi(daysStr); err == nil && d > 0 && d <= 180 {
            days = d
        }
    }

    // Calculate date range
    endDate := time.Now().Format("2006-01-02 23:59:59")
    startDate := time.Now().AddDate(0, 0, -days).Format("2006-01-02 00:00:00")

    // Get bills
    bills, err := db.GetBillsByDateRange(days)
    if err != nil {
        handleError(w, err)
        return
    }

    // Get stats
    stats, err := db.GetBillStats(days)
    if err != nil {
        handleError(w, err)
        return
    }

    respondSuccess(w, map[string]interface{}{
        "bills": bills,
        "stats": stats,
        "period": map[string]interface{}{
            "days":       days,
            "start_date": startDate,
            "end_date":   endDate,
        },
    })
}

// BillSearchHandler searches bills
// GET /api/bills/search?q=MS-202605-0042
func BillSearchHandler(w http.ResponseWriter, r *http.Request) {
    enableCORS(w)

    if r.Method == http.MethodOptions {
        w.WriteHeader(http.StatusOK)
        return
    }

    if r.Method != http.MethodGet {
        respondError(w, http.StatusMethodNotAllowed, "method not allowed")
        return
    }

    searchTerm := strings.TrimSpace(r.URL.Query().Get("q"))
    if searchTerm == "" {
        respondError(w, http.StatusBadRequest, "search query required")
        return
    }

    // If user searches using digits only (e.g. "42" / "0042"),
    // treat it as the sequence part of monthly bill number and search by suffix.
    normalizedQuery := searchTerm
    isDigitsOnly := true
    for _, c := range searchTerm {
        if c < '0' || c > '9' {
            isDigitsOnly = false
            break
        }
    }
    if isDigitsOnly {
        if id, err := strconv.ParseInt(searchTerm, 10, 64); err == nil {
            normalizedQuery = fmt.Sprintf("-%04d", id)
        }
    }

    bills, err := db.SearchBills(normalizedQuery, 50)
    if err != nil {
        handleError(w, err)
        return
    }

    respondSuccess(w, bills)
}
func handleCreateBill(w http.ResponseWriter, r *http.Request) {
    var req models.BillCreateRequest

    if err := parseJSONBody(r, &req); err != nil {
        respondError(w, http.StatusBadRequest, "invalid JSON: "+err.Error())
        return
    }

    bill, err := db.CreateBill(&req)
    if err != nil {
        handleError(w, err)
        return
    }

    respondCreated(w, bill)
}

// StatsHandler returns billing statistics
// GET /api/stats
func StatsHandler(w http.ResponseWriter, r *http.Request) {
    enableCORS(w)

    if r.Method == http.MethodOptions {
        w.WriteHeader(http.StatusOK)
        return
    }

    if r.Method != http.MethodGet {
        respondError(w, http.StatusMethodNotAllowed, "method not allowed")
        return
    }

    totalBills, _ := db.GetBillCount()
    todayBills, _ := db.GetTodaysBillCount()
    todaySales, _ := db.GetTodaysTotalSales()
    productCount, _ := db.GetProductCount()

    stats := map[string]interface{}{
        "total_bills":   totalBills,
        "today_bills":   todayBills,
        "today_sales":   todaySales,
        "product_count": productCount,
    }

    respondSuccess(w, stats)
}
// internal/models/bill.go
package models

import (
    "fmt"
    "math"
    "time"
)

// Bill represents a customer transaction
type Bill struct {
    ID         int64      `json:"id"`
    BillNumber string     `json:"bill_number"` // "MS-202605-0001"
    ItemCount  int        `json:"item_count"`  // Number of line items
    Subtotal   float64    `json:"subtotal"`    // Exact sum (with decimals)
    Total      float64    `json:"total"`       // CEIL(subtotal) - what customer pays
    Items      []BillItem `json:"items"`       // Line items
    CreatedAt  time.Time  `json:"created_at"`
}

// BillItem represents a single line item in a bill
type BillItem struct {
    ID        int64   `json:"id"`
    BillID    int64   `json:"bill_id"`
    ItemName  string  `json:"item_name"`  // Product name at time of billing
	TamilName string  `json:"tamil_name"` // Tamil product name at time of billing
    Quantity  float64 `json:"quantity"`   // 1, 0.25, 2.5, etc.
    Unit      string  `json:"unit"`       // "packet", "kg", "piece"
    UnitPrice float64 `json:"unit_price"` // Price per unit
    LineTotal float64 `json:"line_total"` // quantity × unit_price (exact, NO rounding)
}

// BillCreateRequest is used when creating a new bill
type BillCreateRequest struct {
    Items []BillItemInput `json:"items"`
}

// BillItemInput represents item data when creating a bill
type BillItemInput struct {
    ItemName  string  `json:"item_name"`
	TamilName string  `json:"tamil_name"`
    Quantity  float64 `json:"quantity"`
    Unit      string  `json:"unit"`
    UnitPrice float64 `json:"unit_price"`
}

// Validate checks if BillCreateRequest is valid
func (b *BillCreateRequest) Validate() error {
    if len(b.Items) == 0 {
        return ErrBillNoItems
    }

    for i, item := range b.Items {
        if item.ItemName == "" {
            return fmt.Errorf("item %d: %w", i+1, ErrBillItemNameRequired)
        }
        if item.Quantity <= 0 {
            return fmt.Errorf("item %d: %w", i+1, ErrBillItemQuantityInvalid)
        }
        if item.Unit == "" {
            return fmt.Errorf("item %d: %w", i+1, ErrBillItemUnitRequired)
        }
        if item.UnitPrice <= 0 {
            return fmt.Errorf("item %d: %w", i+1, ErrBillItemPriceInvalid)
        }
    }

    return nil
}

// CalculateTotals computes subtotal and total for the bill
func (b *BillCreateRequest) CalculateTotals() (subtotal float64, total float64) {
    subtotal = 0.0

    for _, item := range b.Items {
        lineTotal := item.Quantity * item.UnitPrice
        subtotal += lineTotal
    }

    // Round total UP (CEIL) - customer always pays rounded amount
    total = math.Ceil(subtotal)

    return subtotal, total
}

// GenerateMonthlyBillNumber creates a monthly bill number (MS-YYYYMM-0001).
// monthKey must be in YYYYMM format.
func GenerateMonthlyBillNumber(monthKey string, sequence int64) string {
    return fmt.Sprintf("MS-%s-%04d", monthKey, sequence)
}

// Custom errors for bill validation
var (
    ErrBillNoItems              = NewValidationError("bill must have at least one item")
    ErrBillItemNameRequired     = NewValidationError("item name is required")
    ErrBillItemQuantityInvalid  = NewValidationError("item quantity must be greater than 0")
    ErrBillItemUnitRequired     = NewValidationError("item unit is required")
    ErrBillItemPriceInvalid     = NewValidationError("item price must be greater than 0")
    ErrBillNotFound             = NewNotFoundError("bill not found")
)
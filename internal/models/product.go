// internal/models/product.go
package models

import (
	"time"
)

// Product represents a sellable item in the store
// Each variant (50g, 100g, etc.) is a separate product
type Product struct {
	ID         int64      `json:"id"`
	Name       string     `json:"name"`   
	TamilName  string     `json:"tamil_name"` // Tamil name of the product
	Price      float64    `json:"price"`        // Selling price
	Unit       string     `json:"unit"`         // "packet", "kg", "piece", etc.
	Category   string     `json:"category"`     // "Dry Fruits", "Grains", etc.
	LastUsedAt *time.Time `json:"last_used_at"` // Nullable - for autocomplete sorting
	CreatedAt  time.Time  `json:"created_at"`
	UpdatedAt  time.Time  `json:"updated_at"`
}

// ProductCreateRequest is used when adding a new product
type ProductCreateRequest struct {
	Name     string  `json:"name"`
	TamilName string  `json:"tamil_name"`
	Price    float64 `json:"price"`
	Unit     string  `json:"unit"`
	Category string  `json:"category"` // Optional
}

// ProductUpdateRequest is used when modifying a product
type ProductUpdateRequest struct {
	Name     *string  `json:"name"`  // Pointer = optional field
	TamilName *string  `json:"tamil_name"` // Pointer = optional field
	Price    *float64 `json:"price"` // Can update just price without changing name
	Unit     *string  `json:"unit"`
	Category *string  `json:"category"`
}

// Validate checks if ProductCreateRequest has required fields
func (p *ProductCreateRequest) Validate() error {
	if p.Name == "" {
		return ErrProductNameRequired
	}
	if p.Price <= 0 {
		return ErrProductPriceInvalid
	}
	if p.Unit == "" {
		return ErrProductUnitRequired
	}
	return nil
}

// Custom errors for product validation
var (
	ErrProductNameRequired = NewValidationError("product name is required")
	ErrProductPriceInvalid = NewValidationError("product price must be greater than 0")
	ErrProductUnitRequired = NewValidationError("product unit is required")
	ErrProductNotFound     = NewNotFoundError("product not found")
	ErrProductNameExists   = NewValidationError("product with this name already exists")
)

// ValidationError represents a validation error
type ValidationError struct {
	Message string
}

func (e *ValidationError) Error() string {
	return e.Message
}

func NewValidationError(msg string) *ValidationError {
	return &ValidationError{Message: msg}
}

// NotFoundError represents a resource not found error
type NotFoundError struct {
	Message string
}

func (e *NotFoundError) Error() string {
	return e.Message
}

func NewNotFoundError(msg string) *NotFoundError {
	return &NotFoundError{Message: msg}
}

// internal/handlers/products.go
package handlers

import (
    "net/http"
    "strconv"
    "strings"

    "ms-store-billing/internal/db"
    "ms-store-billing/internal/models"
)

// ProductsHandler handles all product-related endpoints
// Routes:
//   GET    /api/products          - Get all products or search
//   GET    /api/products/:id      - Get product by ID
//   POST   /api/products          - Create new product
//   PUT    /api/products/:id      - Update product
//   DELETE /api/products/:id      - Delete product
func ProductsHandler(w http.ResponseWriter, r *http.Request) {
    enableCORS(w)

    // Handle OPTIONS for CORS preflight
    if r.Method == http.MethodOptions {
        w.WriteHeader(http.StatusOK)
        return
    }

    // Parse path to extract ID if present
    // URL format: /api/products or /api/products/123
    path := strings.TrimPrefix(r.URL.Path, "/api/products")
    path = strings.Trim(path, "/")

    switch r.Method {
    case http.MethodGet:
        if path == "" {
            // GET /api/products - List or search products
            handleGetProducts(w, r)
        } else {
            // GET /api/products/:id - Get single product
            handleGetProduct(w, r, path)
        }

    case http.MethodPost:
        // POST /api/products - Create new product
        handleCreateProduct(w, r)

    case http.MethodPut:
        if path == "" {
            respondError(w, http.StatusBadRequest, "product ID required for update")
            return
        }
        // PUT /api/products/:id - Update product
        handleUpdateProduct(w, r, path)

    case http.MethodDelete:
        if path == "" {
            respondError(w, http.StatusBadRequest, "product ID required for delete")
            return
        }
        // DELETE /api/products/:id - Delete product
        handleDeleteProduct(w, r, path)

    default:
        respondError(w, http.StatusMethodNotAllowed, "method not allowed")
    }
}

// handleGetProducts retrieves all products or searches
// Query params:
//   ?search=tom - Search products by name prefix
//   ?category=Groceries - Filter by category
func handleGetProducts(w http.ResponseWriter, r *http.Request) {
    searchTerm := r.URL.Query().Get("search")
    category := r.URL.Query().Get("category")

    var products []models.Product
    var err error

    if searchTerm != "" {
        // Search products
        products, err = db.SearchProducts(searchTerm)
    } else if category != "" {
        // Filter by category
        products, err = db.GetProductsByCategory(category)
    } else {
        // Get all products
        products, err = db.GetAllProducts()
    }

    if err != nil {
        handleError(w, err)
        return
    }

    respondSuccess(w, products)
}

// handleGetProduct retrieves a single product by ID
func handleGetProduct(w http.ResponseWriter, r *http.Request, idStr string) {
    id, err := strconv.ParseInt(idStr, 10, 64)
    if err != nil {
        respondError(w, http.StatusBadRequest, "invalid product ID")
        return
    }

    product, err := db.GetProductByID(id)
    if err != nil {
        handleError(w, err)
        return
    }

    respondSuccess(w, product)
}

// handleCreateProduct creates a new product
// Request body: {"name": "...", "price": 0.0, "unit": "...", "category": "..."}
func handleCreateProduct(w http.ResponseWriter, r *http.Request) {
    var req models.ProductCreateRequest

    if err := parseJSONBody(r, &req); err != nil {
        respondError(w, http.StatusBadRequest, "invalid JSON: "+err.Error())
        return
    }

    product, err := db.CreateProduct(&req)
    if err != nil {
        handleError(w, err)
        return
    }

    respondCreated(w, product)
}

// handleUpdateProduct updates an existing product
// Request body: {"name": "...", "price": 0.0, "unit": "...", "category": "..."}
// All fields are optional - only provided fields will be updated
func handleUpdateProduct(w http.ResponseWriter, r *http.Request, idStr string) {
    id, err := strconv.ParseInt(idStr, 10, 64)
    if err != nil {
        respondError(w, http.StatusBadRequest, "invalid product ID")
        return
    }

    var req models.ProductUpdateRequest

    if err := parseJSONBody(r, &req); err != nil {
        respondError(w, http.StatusBadRequest, "invalid JSON: "+err.Error())
        return
    }

    product, err := db.UpdateProduct(id, &req)
    if err != nil {
        handleError(w, err)
        return
    }

    respondSuccess(w, product)
}

// handleDeleteProduct deletes a product
func handleDeleteProduct(w http.ResponseWriter, r *http.Request, idStr string) {
    id, err := strconv.ParseInt(idStr, 10, 64)
    if err != nil {
        respondError(w, http.StatusBadRequest, "invalid product ID")
        return
    }

    if err := db.DeleteProduct(id); err != nil {
        handleError(w, err)
        return
    }

    respondSuccess(w, map[string]interface{}{
        "deleted": true,
        "id":      id,
    })
}
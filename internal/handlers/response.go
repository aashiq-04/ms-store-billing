// internal/handlers/response.go
package handlers

import (
    "encoding/json"
    "net/http"

    "ms-store-billing/internal/models"
)

// Standard API response structure
type APIResponse struct {
    Success bool        `json:"success"`
    Data    interface{} `json:"data,omitempty"`
    Error   string      `json:"error,omitempty"`
    Message string      `json:"message,omitempty"`
}

// respondJSON sends a JSON response
func respondJSON(w http.ResponseWriter, status int, data interface{}) {
    w.Header().Set("Content-Type", "application/json")
    w.WriteHeader(status)
    json.NewEncoder(w).Encode(data)
}

// respondSuccess sends a success response
func respondSuccess(w http.ResponseWriter, data interface{}) {
    respondJSON(w, http.StatusOK, APIResponse{
        Success: true,
        Data:    data,
    })
}

// respondCreated sends a 201 Created response
func respondCreated(w http.ResponseWriter, data interface{}) {
    respondJSON(w, http.StatusCreated, APIResponse{
        Success: true,
        Data:    data,
    })
}

// respondError sends an error response
func respondError(w http.ResponseWriter, status int, message string) {
    respondJSON(w, status, APIResponse{
        Success: false,
        Error:   message,
    })
}

// respondValidationError sends a 400 Bad Request for validation errors
func respondValidationError(w http.ResponseWriter, err error) {
    respondError(w, http.StatusBadRequest, err.Error())
}

// respondNotFound sends a 404 Not Found response
func respondNotFound(w http.ResponseWriter, message string) {
    respondError(w, http.StatusNotFound, message)
}

// respondInternalError sends a 500 Internal Server Error
func respondInternalError(w http.ResponseWriter, err error) {
    respondError(w, http.StatusInternalServerError, err.Error())
}

// handleError decides how to respond based on error type
func handleError(w http.ResponseWriter, err error) {
    switch err.(type) {
    case *models.ValidationError:
        respondValidationError(w, err)
    case *models.NotFoundError:
        respondNotFound(w, err.Error())
    default:
        respondInternalError(w, err)
    }
}

// parseJSONBody parses JSON request body into target struct
func parseJSONBody(r *http.Request, target interface{}) error {
    decoder := json.NewDecoder(r.Body)
    decoder.DisallowUnknownFields() // Strict parsing
    return decoder.Decode(target)
}

// enableCORS adds CORS headers (for local development)
func enableCORS(w http.ResponseWriter) {
    w.Header().Set("Access-Control-Allow-Origin", "*")
    w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
    w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
}
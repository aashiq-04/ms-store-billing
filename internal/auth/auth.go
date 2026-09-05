// internal/auth/auth.go
package auth

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"log"
	"net/http"
	"os"
	"sync"
	"time"
)

// Multi-session authentication for multiple devices
// Sessions are stored in memory (valid until server restart)

// Session represents an active user session
type Session struct {
	Token   string
	Expiry  time.Time
	Created time.Time
}

var (
	appPIN      string
	sessions    = make(map[string]*Session) // token -> Session
	authMutex   sync.RWMutex
)

// Session duration (7 days)
const sessionDuration = 7 * 24 * time.Hour

// Init loads or generates the PIN
func Init() {
	appPIN = os.Getenv("MS_BILLING_PIN")
	if appPIN == "" {
		appPIN = "1234" // Default PIN for simplicity
	}
}

// GetPIN returns the configured PIN (for display at startup)
func GetPIN() string {
	return appPIN
}

// cleanupExpiredSessions removes expired sessions from memory
func cleanupExpiredSessions() {
	now := time.Now()
	for token, session := range sessions {
		if now.After(session.Expiry) {
			delete(sessions, token)
		}
	}
}

// LoginRequest represents a login request
type LoginRequest struct {
	PIN string `json:"pin"`
}

// LoginResponse represents a successful login response
type LoginResponse struct {
	Success bool   `json:"success"`
	Message string `json:"message,omitempty"`
}

// HandleLogin handles login requests
func HandleLogin(w http.ResponseWriter, r *http.Request) {
	// Handle CORS preflight
	if r.Method == http.MethodOptions {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "POST, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
		w.WriteHeader(http.StatusOK)
		return
	}

	if r.Method != http.MethodPost {
		respondJSON(w, http.StatusMethodNotAllowed, LoginResponse{Success: false, Message: "Method not allowed"})
		return
	}

	var req LoginRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondJSON(w, http.StatusBadRequest, LoginResponse{Success: false, Message: "Invalid request"})
		return
	}

	authMutex.Lock()
	defer authMutex.Unlock()

	if req.PIN == appPIN {
		// Cleanup expired sessions periodically
		cleanupExpiredSessions()

		// Generate new session token
		tokenBytes := make([]byte, 32)
		rand.Read(tokenBytes)
		token := hex.EncodeToString(tokenBytes)

		// Store session
		sessions[token] = &Session{
			Token:   token,
			Expiry:  time.Now().Add(sessionDuration),
			Created: time.Now(),
		}

		// Set cookie
		http.SetCookie(w, &http.Cookie{
			Name:     "ms_billing_session",
			Value:    token,
			Path:     "/",
			HttpOnly: true,
			MaxAge:   int(sessionDuration.Seconds()),
			SameSite: http.SameSiteLaxMode,
		})

		respondJSON(w, http.StatusOK, LoginResponse{Success: true, Message: "Login successful"})
		return
	}

	respondJSON(w, http.StatusUnauthorized, LoginResponse{Success: false, Message: "Invalid PIN"})
}

// HandleLogout handles logout requests
func HandleLogout(w http.ResponseWriter, r *http.Request) {
	// Get current session token from cookie
	if cookie, err := r.Cookie("ms_billing_session"); err == nil {
		authMutex.Lock()
		delete(sessions, cookie.Value)
		authMutex.Unlock()
	}

	http.SetCookie(w, &http.Cookie{
		Name:     "ms_billing_session",
		Value:    "",
		Path:     "/",
		HttpOnly: true,
		MaxAge:   -1,
	})

	respondJSON(w, http.StatusOK, LoginResponse{Success: true, Message: "Logged out"})
}

// HandleCheckSession checks if user is authenticated
func HandleCheckSession(w http.ResponseWriter, r *http.Request) {
	cookie, err := r.Cookie("ms_billing_session")
	if err != nil {
		respondJSON(w, http.StatusOK, map[string]bool{"authenticated": false})
		return
	}

	authMutex.RLock()
	session, exists := sessions[cookie.Value]
	authMutex.RUnlock()

	if exists && time.Now().Before(session.Expiry) {
		respondJSON(w, http.StatusOK, map[string]bool{"authenticated": true})
		return
	}

	respondJSON(w, http.StatusOK, map[string]bool{"authenticated": false})
}

// Middleware checks if request is authenticated
func Middleware(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		// Allow CORS preflight
		if r.Method == http.MethodOptions {
			w.Header().Set("Access-Control-Allow-Origin", "*")
			w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
			w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
			w.WriteHeader(http.StatusOK)
			return
		}

		cookie, err := r.Cookie("ms_billing_session")
		if err != nil {
			log.Printf("[AUTH] No cookie found: %v", err)
			respondJSON(w, http.StatusUnauthorized, map[string]interface{}{
				"success": false,
				"error":   "Authentication required",
			})
			return
		}

		authMutex.RLock()
		session, exists := sessions[cookie.Value]
		activeCount := len(sessions)
		authMutex.RUnlock()

		log.Printf("[AUTH] Request from %s - Cookie token: %s, Exists: %v, Active sessions: %d", r.RemoteAddr, cookie.Value[:8]+"...", exists, activeCount)

		if !exists || time.Now().After(session.Expiry) {
			respondJSON(w, http.StatusUnauthorized, map[string]interface{}{
				"success": false,
				"error":   "Session expired. Please login again.",
			})
			return
		}

		next(w, r)
	}
}

func respondJSON(w http.ResponseWriter, status int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(data)
}

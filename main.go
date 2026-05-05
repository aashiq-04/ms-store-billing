package main

import (
	"context"
	"embed"
	"fmt"
	"io"
	"io/fs"
	"log"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
	"syscall"
	"time"

    "ms-store-billing/internal/db"
    "ms-store-billing/internal/handlers"
)

const ServerPort = "8080"
var appServer *http.Server

//go:embed build/*
var frontendFS embed.FS

func main() {
    log.Println("========================================")
    log.Println("  MS Store Billing System")
    log.Println("  Version 1.0.0")
    log.Println("========================================")

    // Get executable directory
    exePath, err := os.Executable()
    if err != nil {
        log.Fatal("Failed to get executable path:", err)
    }
    exeDir := filepath.Dir(exePath)

    // Store database in a stable per-user location so shortcuts/copies of
    // the EXE always use the same data file.
    dataRoot, err := os.UserConfigDir()
    if err != nil {
        log.Fatal("Failed to get user config dir:", err)
    }
    dataDir := filepath.Join(dataRoot, "MSStoreBilling")
    dbPath := filepath.Join(dataDir, "msstore.db")
    log.Printf("Database: %s", dbPath)

    // Initialize database
    if err := db.Initialize(dbPath, exeDir); err != nil {
        log.Fatal("Database initialization failed:", err)
    }
    defer db.Close()


     // Cleanup old bills (keep last 180 days)
     deleted, err := db.CleanupOldBills(180)
     if err != nil {
         log.Printf("⚠ Warning: Bill cleanup failed: %v", err)
     } else if deleted > 0 {
         log.Printf("✓ Cleaned up %d old bills (older than 180 days)", deleted)
     }

    // Setup HTTP routes
    setupRoutes()

    // Server URL
    serverURL := fmt.Sprintf("http://localhost:%s", ServerPort)
	serverAddr := fmt.Sprintf(":%s", ServerPort)

    log.Println("========================================")
    log.Printf("✓ Server starting on %s", serverURL)
    log.Println("========================================")
    log.Println("\n🎉 MS Store Billing is ready!")
    log.Println("\nOpening browser automatically...")
    log.Println("If browser doesn't open, visit:", serverURL)
    log.Println("\nPress Ctrl+C to stop the server")
    log.Println("========================================")

	// Start HTTP server in background so we can wait for it to be reachable
	// before trying to open the browser (prevents "connection refused" pages).
	appServer = &http.Server{Addr: serverAddr}
	serverErr := make(chan error, 1)
	go func() {
		serverErr <- appServer.ListenAndServe()
	}()

	client := &http.Client{Timeout: 500 * time.Millisecond}
	for i := 0; i < 40; i++ {
		if _, err := client.Get(serverURL + "/api/health"); err == nil {
			break
		}
		time.Sleep(250 * time.Millisecond)
	}

	openBrowser(serverURL)

	// Keep the main goroutine alive and report server failures.
	if err := <-serverErr; err != nil {
		log.Fatal("Server failed to start:", err)
	}
}

// setupRoutes configures all HTTP routes
func setupRoutes() {
    // API routes
    http.HandleFunc("/api/products", handlers.ProductsHandler)
    http.HandleFunc("/api/products/", handlers.ProductsHandler)
    http.HandleFunc("/api/bills", handlers.BillsHandler)
    http.HandleFunc("/api/bills/", handlers.BillsHandler)
    http.HandleFunc("/api/bills/history", handlers.BillHistoryHandler)  
    http.HandleFunc("/api/bills/search", handlers.BillSearchHandler)
    http.HandleFunc("/api/stats", handlers.StatsHandler)
    http.HandleFunc("/api/health", healthHandler)
    http.HandleFunc("/api/print", handlers.PrintHandler)
    http.HandleFunc("/api/printers", handlers.PrintersHandler)
    http.HandleFunc("/api/preview/", handlers.PreviewHandler)
    http.HandleFunc("/api/shutdown", shutdownHandler)
    http.HandleFunc("/api/debug/db-path", dbPathHandler)

    // Serve embedded React frontend
    buildFS, err := fs.Sub(frontendFS, "build")
    if err != nil {
        log.Printf("Warning: Frontend not embedded, serving from disk if available: %v", err)
        // Try to serve from disk as fallback
        http.Handle("/", http.FileServer(http.Dir("./build")))
        return
    }

    // Serve static assets
    http.Handle("/assets/", http.FileServer(http.FS(buildFS)))

    // Serve index.html for all other routes (SPA routing)
    http.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
        path := filepath.Clean(strings.TrimPrefix(r.URL.Path, "/"))
        
        // Try to serve the requested file
        if path != "" {
            file, err := buildFS.Open(path)
            if err == nil {
                defer file.Close()
                
                // Get file info
                stat, err := file.Stat()
                if err == nil && !stat.IsDir() {
                    // Set content type based on extension
                    if strings.HasSuffix(path, ".js") {
                        w.Header().Set("Content-Type", "application/javascript")
                    } else if strings.HasSuffix(path, ".css") {
                        w.Header().Set("Content-Type", "text/css")
                    }
                    
                    // Copy file content to response
                    _, err = io.Copy(w, file)
                    if err != nil {
                        log.Printf("Error copying file content: %v", err)
                    }
                    return
                }
            }
        }

        // Serve index.html for all other routes (SPA routing)
        indexFile, err := buildFS.Open("index.html")
        if err != nil {
            http.Error(w, "Frontend not found. Please build the frontend first using: cd frontend && npm run build", http.StatusNotFound)
            return
        }
        defer indexFile.Close()

        w.Header().Set("Content-Type", "text/html; charset=utf-8")
        _, err = io.Copy(w, indexFile)
        if err != nil {
            log.Printf("Error copying index.html content: %v", err)
        }
    })
}

func dbPathHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		w.WriteHeader(http.StatusMethodNotAllowed)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write([]byte(fmt.Sprintf(`{"db_path":%q}`, db.CurrentDBPath())))
}

func shutdownHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		w.WriteHeader(http.StatusMethodNotAllowed)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write([]byte(`{"status":"shutting_down"}`))

	// Gracefully stop the server shortly after responding to caller.
	go func() {
		time.Sleep(200 * time.Millisecond)
		if appServer != nil {
			_ = appServer.Shutdown(context.Background())
		}
	}()
}

// healthHandler returns API health status
func healthHandler(w http.ResponseWriter, r *http.Request) {
    w.Header().Set("Content-Type", "application/json")
    w.WriteHeader(http.StatusOK)
    w.Write([]byte(`{"status":"ok","service":"ms-store-billing","version":"1.0.0"}`))
}

// openBrowser opens the default browser with the given URL
func openBrowser(url string) {
    var err error

    switch runtime.GOOS {
    case "linux":
        err = exec.Command("xdg-open", url).Start()
    case "windows":
        // Try common Windows browser-open mechanisms.
        // (GUI subsystem builds hide console output, so we also write failures to a file.)
        try := func(cmd *exec.Cmd) error {
            cmd.SysProcAttr = &syscall.SysProcAttr{HideWindow: true}
            return cmd.Start()
        }

        err = try(exec.Command("rundll32", "url.dll,FileProtocolHandler", url))
        if err != nil {
            // Fallback: explorer tends to open URLs reliably for HTTP/HTTPS.
            err = try(exec.Command("explorer.exe", url))
        }
        if err != nil {
            // Last fallback: cmd start (also hidden).
            err = try(exec.Command("cmd", "/c", "start", "", url))
        }
    case "darwin":
        err = exec.Command("open", url).Start()
    default:
        log.Println("Cannot open browser on this OS automatically")
        return
    }

    if err != nil {
        // Best-effort file logging for GUI builds.
        if exePath, exeErr := os.Executable(); exeErr == nil {
            logPath := filepath.Join(filepath.Dir(exePath), "browser-open.log")
            if f, openErr := os.OpenFile(logPath, os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0644); openErr == nil {
                _, _ = fmt.Fprintf(f, "%s Failed to open browser: %v\n", time.Now().Format(time.RFC3339), err)
                _ = f.Close()
            }
        }
        log.Println("Failed to open browser:", err)
    }
}



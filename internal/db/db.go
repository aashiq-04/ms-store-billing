package db

import (
	"database/sql"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	_ "modernc.org/sqlite" // SqLite Driver
)

var DB *sql.DB

// writeMutex serializes all write operations to prevent SQLite transaction conflicts
// SQLite doesn't handle concurrent transactions well, even with WAL mode
var writeMutex sync.Mutex

// Initialize opej SQLite database and runs migrations
func Initialize(dbPath string) error {
	var err error
	// Ensure directory exists
	dir := filepath.Dir(dbPath)
	if err := os.MkdirAll(dir, 0755); err != nil {
		return fmt.Errorf("failed to create directory: %w", err)
	}

	// Open database connection
	DB, err = sql.Open("sqlite", dbPath)
	if err != nil {
		return fmt.Errorf("failed to open database: %w", err)
	}

	// Test connection
	if err := DB.Ping(); err != nil {
		return fmt.Errorf("failed to ping database: %w", err)
	}

	// Set connection pool settings for SQLite
	// SQLite works best with a single connection to avoid transaction conflicts
	DB.SetMaxOpenConns(1)
	DB.SetMaxIdleConns(1)
	DB.SetConnMaxLifetime(0)

	// Set SQLite-specific pragmas for better transaction handling
	if _, err := DB.Exec("PRAGMA foreign_keys = ON"); err != nil {
		return fmt.Errorf("failed to enable foreign keys: %w", err)
	}
	if _, err := DB.Exec("PRAGMA journal_mode = WAL"); err != nil {
		return fmt.Errorf("failed to enable WAL mode: %w", err)
	}
	// If the DB is temporarily locked (e.g., fast relaunch), wait briefly instead of failing.
	if _, err := DB.Exec("PRAGMA busy_timeout = 5000"); err != nil {
		return fmt.Errorf("failed to set busy_timeout: %w", err)
	}

	log.Println("✓ Database connection established")

	// Run migrations
	// Resolve migration paths relative to the executable/database directory
	// so Desktop shortcuts (different working directory) don't break startup.
	if err := runMigrations(dir); err != nil {
		return fmt.Errorf("failed to run migrations: %w", err)
	}
	return nil
}

// runMigrations executes SQL migration files
func runMigrations(baseDir string) error {
	migration := []string{
		"migrations/001_init_schema.sql",
		"migrations/002_seed_data.sql",
		"migrations/003_add_tamil.sql",
	}

	for _, migrationFile := range migration {
		migrationPath := filepath.Join(baseDir, migrationFile)

		//Check if file exists
		if _, err := os.Stat(migrationPath); os.IsNotExist(err) {
			log.Printf("⚠ Migration file not found: %s (skipping)", migrationFile)
			continue
		}

		// Read SQL file
		sqlBytes, err := os.ReadFile(migrationPath)
		if err != nil {
			return fmt.Errorf("failed to read migration file %s: %w", migrationFile, err)
		}

		// Execute SQL with a small retry on transient SQLite locking.
		var execErr error
		const maxBusyRetries = 5
		for attempt := 1; attempt <= maxBusyRetries; attempt++ {
			_, execErr = DB.Exec(string(sqlBytes))
			if execErr == nil {
				break
			}

			// If it's the tamil migration and column already exists, that's OK.
			if migrationFile == "migrations/003_add_tamil.sql" &&
				strings.Contains(execErr.Error(), "duplicate column") {
				log.Printf("⚠ Migration %s: column already exists (skipping)", migrationFile)
				execErr = nil
				break
			}

			if attempt < maxBusyRetries && isSQLiteBusy(execErr) {
				backoff := time.Duration(attempt*500) * time.Millisecond
				log.Printf("⚠ SQLite is locked, retrying %s in %s (attempt %d/%d)", migrationFile, backoff, attempt, maxBusyRetries)
				time.Sleep(backoff)
				continue
			}

			// Non-retryable error (or retries exhausted).
			break
		}

		if execErr != nil {
			return fmt.Errorf("failed to execute %s: %w", migrationFile, execErr)
		}

		log.Printf("✓ Migration applied: %s", migrationFile)
	}
	return nil
}

func isSQLiteBusy(err error) bool {
	if err == nil {
		return false
	}
	msg := strings.ToLower(err.Error())
	return strings.Contains(msg, "sqlite_busy") ||
		strings.Contains(msg, "database is locked") ||
		strings.Contains(msg, "database locked") ||
		strings.Contains(msg, "busy")
}

// Close closes the database connection
func Close() error {
	if DB != nil {
		return DB.Close()
	}
	return nil
}

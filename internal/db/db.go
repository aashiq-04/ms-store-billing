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
var currentDBPath string

// writeMutex serializes all write operations to prevent SQLite transaction conflicts
// SQLite doesn't handle concurrent transactions well, even with WAL mode
var writeMutex sync.Mutex

// Initialize opens SQLite database and runs migrations.
func Initialize(dbPath string, migrationsBaseDir string) error {
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
	currentDBPath = dbPath

	// Run migrations from the executable directory.
	// This keeps migration lookup stable even if DB is stored elsewhere.
	if err := runMigrations(migrationsBaseDir); err != nil {
		return fmt.Errorf("failed to run migrations: %w", err)
	}
	return nil
}

// CurrentDBPath returns active SQLite file path.
func CurrentDBPath() string {
	return currentDBPath
}

// runMigrations executes SQL migration files
func runMigrations(baseDir string) error {
	// Track applied migrations so each file runs only once.
	_, err := DB.Exec(`
		CREATE TABLE IF NOT EXISTS schema_migrations (
			name TEXT PRIMARY KEY,
			applied_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
		)
	`)
	if err != nil {
		return fmt.Errorf("failed to initialize schema_migrations: %w", err)
	}

	migration := []string{
		"migrations/001_init_schema.sql",
		"migrations/003_add_tamil.sql",
		"migrations/004_add_bill_cleanup.sql",
		"migrations/005_add_bill_items_tamil_name.sql",
	}

	for _, migrationFile := range migration {
		var alreadyApplied int
		if err := DB.QueryRow("SELECT COUNT(1) FROM schema_migrations WHERE name = ?", migrationFile).Scan(&alreadyApplied); err != nil {
			return fmt.Errorf("failed to check migration state for %s: %w", migrationFile, err)
		}
		if alreadyApplied > 0 {
			log.Printf("✓ Migration already applied: %s", migrationFile)
			continue
		}

		// If schema already contains these columns, mark migration as applied
		// without executing it again.
		if migrationFile == "migrations/003_add_tamil.sql" {
			exists, checkErr := columnExists("products", "tamil_name")
			if checkErr != nil {
				return fmt.Errorf("failed to check tamil_name column: %w", checkErr)
			}
			if exists {
				if _, markErr := DB.Exec("INSERT OR IGNORE INTO schema_migrations(name) VALUES (?)", migrationFile); markErr != nil {
					return fmt.Errorf("failed to mark migration %s as applied: %w", migrationFile, markErr)
				}
				log.Printf("✓ Migration already reflected in schema: %s", migrationFile)
				continue
			}
		}
		if migrationFile == "migrations/005_add_bill_items_tamil_name.sql" {
			exists, checkErr := columnExists("bill_items", "tamil_name")
			if checkErr != nil {
				return fmt.Errorf("failed to check bill_items.tamil_name column: %w", checkErr)
			}
			if exists {
				if _, markErr := DB.Exec("INSERT OR IGNORE INTO schema_migrations(name) VALUES (?)", migrationFile); markErr != nil {
					return fmt.Errorf("failed to mark migration %s as applied: %w", migrationFile, markErr)
				}
				log.Printf("✓ Migration already reflected in schema: %s", migrationFile)
				continue
			}
		}

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
			if migrationFile == "migrations/005_add_bill_items_tamil_name.sql" &&
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

		// Mark as applied with retry for transient SQLite locks.
		var markErr error
		const maxMarkRetries = 5
		for attempt := 1; attempt <= maxMarkRetries; attempt++ {
			_, markErr = DB.Exec("INSERT OR IGNORE INTO schema_migrations(name) VALUES (?)", migrationFile)
			if markErr == nil {
				break
			}
			if attempt < maxMarkRetries && isSQLiteBusy(markErr) {
				backoff := time.Duration(attempt*500) * time.Millisecond
				log.Printf("⚠ SQLite is locked while marking migration, retrying %s in %s (attempt %d/%d)", migrationFile, backoff, attempt, maxMarkRetries)
				time.Sleep(backoff)
				continue
			}
			break
		}

		if markErr != nil {
			return fmt.Errorf("failed to mark migration %s as applied: %w", migrationFile, markErr)
		}

		log.Printf("✓ Migration applied: %s", migrationFile)
	}
	return nil
}

func columnExists(tableName, columnName string) (bool, error) {
	rows, err := DB.Query(fmt.Sprintf("PRAGMA table_info(%s)", tableName))
	if err != nil {
		return false, err
	}
	defer rows.Close()

	// PRAGMA table_info columns: cid, name, type, notnull, dflt_value, pk
	for rows.Next() {
		var cid int
		var name string
		var colType string
		var notNull int
		var defaultValue sql.NullString
		var pk int
		if err := rows.Scan(&cid, &name, &colType, &notNull, &defaultValue, &pk); err != nil {
			return false, err
		}
		if strings.EqualFold(name, columnName) {
			return true, nil
		}
	}
	return false, rows.Err()
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

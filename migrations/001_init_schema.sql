-- migrations/001_init_schema.sql
-- MS Store Billing System - Initial Schema
-- Created: 2026-01-10

-- Enable foreign keys (important for SQLite)
PRAGMA foreign_keys = ON;

-- Enable WAL mode for better concurrency
PRAGMA journal_mode = WAL;

-- ============================================
-- PRODUCTS TABLE
-- ============================================
-- Stores all sellable items (pre-packed + loose)
-- Each variant (50g, 100g, etc.) is a separate product

CREATE TABLE IF NOT EXISTS products (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    name            TEXT NOT NULL UNIQUE,           -- "Badam 50g", "Rice (loose)", "Tata Salt 1kg"
    price           REAL NOT NULL CHECK(price > 0), -- Selling price for this item
    unit            TEXT NOT NULL,                  -- "packet", "kg", "piece", "dozen", "liter", "gram"
    category        TEXT,                           -- "Dry Fruits", "Grains", "Spices", "Groceries"
    last_used_at    TEXT,                           -- ISO timestamp, updated when product is billed
    created_at      TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
    updated_at      TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);

-- ============================================
-- BILLS TABLE
-- ============================================
-- One record per customer transaction

CREATE TABLE IF NOT EXISTS bills (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    bill_number     TEXT UNIQUE NOT NULL,           -- "MS-0001", "MS-0002"
    item_count      INTEGER NOT NULL DEFAULT 0,     -- Number of line items in this bill
    subtotal        REAL NOT NULL DEFAULT 0,        -- Exact sum before rounding
    total           REAL NOT NULL DEFAULT 0,        -- CEIL(subtotal) - what customer pays
    created_at      TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);

-- ============================================
-- BILL ITEMS TABLE
-- ============================================
-- Line items for each bill (multiple items per bill)

CREATE TABLE IF NOT EXISTS bill_items (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    bill_id         INTEGER NOT NULL,
    item_name       TEXT NOT NULL,                  -- Product name at time of billing
    quantity        REAL NOT NULL CHECK(quantity > 0),
    unit            TEXT NOT NULL,                  -- "packet", "kg", "piece", etc.
    unit_price      REAL NOT NULL CHECK(unit_price > 0),
    line_total      REAL NOT NULL,                  -- quantity × unit_price (exact, NO rounding)
    
    FOREIGN KEY (bill_id) REFERENCES bills(id) ON DELETE CASCADE
);

-- ============================================
-- INDEXES FOR PERFORMANCE
-- ============================================

-- Fast autocomplete (sorted by recent usage, then alphabetically)
CREATE INDEX IF NOT EXISTS idx_products_autocomplete 
ON products(last_used_at DESC, name ASC);

-- Fast product name search
CREATE INDEX IF NOT EXISTS idx_products_name 
ON products(name COLLATE NOCASE);

-- Fast bill lookup by date (for future reports)
CREATE INDEX IF NOT EXISTS idx_bills_created 
ON bills(created_at DESC);

-- Fast retrieval of items for a bill
CREATE INDEX IF NOT EXISTS idx_bill_items_bill_id 
ON bill_items(bill_id);

-- ============================================
-- TRIGGERS
-- ============================================

-- Auto-update 'updated_at' timestamp when product is modified
CREATE TRIGGER IF NOT EXISTS products_updated_at
AFTER UPDATE ON products
FOR EACH ROW
BEGIN
    UPDATE products SET updated_at = datetime('now', 'localtime')
    WHERE id = NEW.id;
END;
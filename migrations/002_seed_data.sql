-- migrations/002_seed_data.sql
-- Sample products for MS Store
-- Using INSERT OR IGNORE to prevent duplicate errors

-- ============================================
-- DRY FRUITS & NUTS (Pre-packed variants)
-- ============================================

INSERT OR IGNORE INTO products (name, price, unit, category) VALUES
('Badam 50g', 50.00, 'packet', 'Dry Fruits'),
('Badam 100g', 100.00, 'packet', 'Dry Fruits'),
('Badam 200g', 190.00, 'packet', 'Dry Fruits'),
('Badam 500g', 450.00, 'packet', 'Dry Fruits'),
('Cashew 50g', 65.00, 'packet', 'Dry Fruits'),
('Cashew 100g', 125.00, 'packet', 'Dry Fruits'),
('Cashew 250g', 300.00, 'packet', 'Dry Fruits'),
('Raisins 100g', 45.00, 'packet', 'Dry Fruits'),
('Raisins 250g', 110.00, 'packet', 'Dry Fruits');

-- ============================================
-- GRAINS & PULSES (Loose - sold by weight)
-- ============================================

INSERT OR IGNORE INTO products (name, price, unit, category) VALUES
('Rice (loose)', 80.00, 'kg', 'Grains'),
('Toor Dal', 140.00, 'kg', 'Pulses'),
('Moong Dal', 120.00, 'kg', 'Pulses'),
('Chana Dal', 100.00, 'kg', 'Pulses'),
('Wheat Flour', 45.00, 'kg', 'Grains');

-- ============================================
-- SPICES (Loose - sold by weight)
-- ============================================

INSERT OR IGNORE INTO products (name, price, unit, category) VALUES
('Chili Powder', 450.00, 'kg', 'Spices'),
('Turmeric Powder', 380.00, 'kg', 'Spices'),
('Coriander Powder', 320.00, 'kg', 'Spices'),
('Cumin Seeds', 550.00, 'kg', 'Spices'),
('Mustard Seeds', 180.00, 'kg', 'Spices');

-- ============================================
-- PACKAGED GROCERIES
-- ============================================

INSERT OR IGNORE INTO products (name, price, unit, category) VALUES
('Tata Salt 1kg', 22.00, 'piece', 'Groceries'),
('Tata Salt 500g', 12.00, 'piece', 'Groceries'),
('Aashirvaad Atta 5kg', 240.00, 'piece', 'Groceries'),
('Aashirvaad Atta 10kg', 460.00, 'piece', 'Groceries'),
('Fortune Oil 1L', 185.00, 'piece', 'Groceries'),
('Fortune Oil 5L', 890.00, 'piece', 'Groceries'),
('Britannia Bread', 45.00, 'piece', 'Bakery'),
('Amul Butter 100g', 58.00, 'piece', 'Dairy');

-- ============================================
-- EGGS & FRESH
-- ============================================

INSERT OR IGNORE INTO products (name, price, unit, category) VALUES
('Eggs (Country)', 7.25, 'piece', 'Fresh'),
('Eggs (Farm)', 6.50, 'piece', 'Fresh');

-- ============================================
-- BEVERAGES
-- ============================================

INSERT OR IGNORE INTO products (name, price, unit, category) VALUES
('Tata Tea 250g', 145.00, 'piece', 'Beverages'),
('Tata Tea 500g', 280.00, 'piece', 'Beverages'),
('Bru Coffee 50g', 95.00, 'piece', 'Beverages'),
('Bru Coffee 200g', 360.00, 'piece', 'Beverages');

-- ============================================
-- COMMON ITEMS (High frequency - for testing autocomplete)
-- ============================================

-- Update last_used_at for frequently bought items (simulate recent usage)
UPDATE products SET last_used_at = datetime('now', 'localtime', '-1 hour')
WHERE name IN ('Tata Salt 1kg', 'Rice (loose)', 'Eggs (Country)', 'Britannia Bread');

UPDATE products SET last_used_at = datetime('now', 'localtime', '-3 hours')
WHERE name IN ('Aashirvaad Atta 5kg', 'Fortune Oil 1L', 'Tata Tea 250g');

UPDATE products SET last_used_at = datetime('now', 'localtime', '-1 day')
WHERE name IN ('Badam 100g', 'Toor Dal', 'Chili Powder');
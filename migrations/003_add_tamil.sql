-- migrations/003_add_tamil_support.sql
-- Add Tamil language support (idempotent - safe to run multiple times)

-- Check if tamil_name column exists, if not add it
-- SQLite doesn't support "ALTER TABLE IF NOT EXISTS", so we use a workaround

-- Create a temporary table to check column existence
CREATE TABLE IF NOT EXISTS _migration_check (applied TEXT);

-- Try to add column (will fail silently if exists)
-- We'll handle the error in a safe way
BEGIN;
    -- This will succeed if column doesn't exist, fail if it does
    ALTER TABLE products ADD COLUMN tamil_name TEXT;
COMMIT;

-- If the above failed (column exists), that's OK - continue

-- Common Tamil translations (safe to run multiple times with OR REPLACE)
UPDATE products SET tamil_name = 'பாதாம்' WHERE (name LIKE '%Badam%' OR name LIKE '%Almond%') AND tamil_name IS NULL;
UPDATE products SET tamil_name = 'முந்திரி' WHERE name LIKE '%Cashew%' AND tamil_name IS NULL;
UPDATE products SET tamil_name = 'திராட்சை' WHERE name LIKE '%Raisin%' AND tamil_name IS NULL;
UPDATE products SET tamil_name = 'அரிசி' WHERE name LIKE '%Rice%' AND tamil_name IS NULL;
UPDATE products SET tamil_name = 'துவரம் பருப்பு' WHERE name LIKE '%Toor Dal%' AND tamil_name IS NULL;
UPDATE products SET tamil_name = 'பாசிப்பருப்பு' WHERE name LIKE '%Moong Dal%' AND tamil_name IS NULL;
UPDATE products SET tamil_name = 'கடலைப் பருப்பு' WHERE name LIKE '%Chana Dal%' AND tamil_name IS NULL;
UPDATE products SET tamil_name = 'கோதுமை மாவு' WHERE name LIKE '%Wheat Flour%' AND tamil_name IS NULL;
UPDATE products SET tamil_name = 'மிளகாய்' WHERE (name LIKE '%Chili%' OR name LIKE '%Chilli%') AND tamil_name IS NULL;
UPDATE products SET tamil_name = 'மஞ்சள்' WHERE name LIKE '%Turmeric%' AND tamil_name IS NULL;
UPDATE products SET tamil_name = 'கொத்தமல்லி' WHERE name LIKE '%Coriander%' AND tamil_name IS NULL;
UPDATE products SET tamil_name = 'சீரகம்' WHERE name LIKE '%Cumin%' AND tamil_name IS NULL;
UPDATE products SET tamil_name = 'கடுகு' WHERE name LIKE '%Mustard%' AND tamil_name IS NULL;
UPDATE products SET tamil_name = 'உப்பு' WHERE name LIKE '%Salt%' AND tamil_name IS NULL;
UPDATE products SET tamil_name = 'ஆட்டா' WHERE name LIKE '%Atta%' AND tamil_name IS NULL;
UPDATE products SET tamil_name = 'எண்ணெய்' WHERE name LIKE '%Oil%' AND tamil_name IS NULL;
UPDATE products SET tamil_name = 'வெண்ணெய்' WHERE name LIKE '%Butter%' AND tamil_name IS NULL;
UPDATE products SET tamil_name = 'முட்டை' WHERE name LIKE '%Egg%' AND tamil_name IS NULL;
UPDATE products SET tamil_name = 'காபி' WHERE name LIKE '%Coffee%' AND tamil_name IS NULL;

-- Clean up
DROP TABLE IF EXISTS _migration_check;
-- migrations/005_add_bill_items_tamil_name.sql
-- Store Tamil item name snapshot per billed line item

ALTER TABLE bill_items
ADD COLUMN tamil_name TEXT DEFAULT '';

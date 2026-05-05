-- migrations/004_add_bill_cleanup.sql
-- Add automatic bill cleanup for bills older than 30 days

-- This migration doesn't change schema, just documents the cleanup policy
-- Cleanup will be handled in application code

-- For reference: Bills older than 30 days will be automatically deleted
-- This keeps the database small and fast
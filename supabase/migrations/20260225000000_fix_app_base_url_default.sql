-- Migration: Fix app_base_url default and ensure production URL
-- Date: 2026-02-25
-- Description: The organization_settings.app_base_url column was originally added with
--   DEFAULT 'http://localhost:5173' in an early migration. This fixes the column default
--   to the production URL and updates any rows still pointing to localhost.

-- Fix the column default
ALTER TABLE organization_settings
  ALTER COLUMN app_base_url SET DEFAULT 'https://requisition-workflow.vercel.app';

-- Fix any existing rows with localhost URLs
UPDATE organization_settings
SET app_base_url = 'https://requisition-workflow.vercel.app'
WHERE app_base_url LIKE '%localhost%';

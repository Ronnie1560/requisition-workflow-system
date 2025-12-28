-- Migration: Pre-deployment fixes for production
-- Date: 2024-12-27
-- Fixes: 
--   1. Add index on expense_account_id for better query performance
--   2. Fix requisition number generation race condition with advisory lock
--   3. Add app_base_url column to organization_settings for email links
--   4. Add INSERT policy for organization_settings (for initial setup)

-- =====================================================
-- 1. Add index on expense_account_id
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_requisitions_expense_account 
ON requisitions(expense_account_id);

-- =====================================================
-- 2. Fix requisition number generation with advisory lock
-- This prevents race conditions when multiple requisitions 
-- are created simultaneously
-- =====================================================
CREATE OR REPLACE FUNCTION generate_requisition_number()
RETURNS TEXT AS $$
DECLARE
  next_num INTEGER;
  year_prefix TEXT;
  lock_id BIGINT := 1001; -- Unique lock ID for requisition numbers
BEGIN
  -- Acquire advisory lock to prevent race conditions
  PERFORM pg_advisory_xact_lock(lock_id);
  
  year_prefix := TO_CHAR(NOW(), 'YY');

  SELECT COALESCE(MAX(
    CAST(
      SUBSTRING(requisition_number FROM '[0-9]+$') AS INTEGER
    )
  ), 0) + 1
  INTO next_num
  FROM requisitions
  WHERE requisition_number LIKE 'REQ-' || year_prefix || '%';

  RETURN 'REQ-' || year_prefix || '-' || LPAD(next_num::TEXT, 5, '0');
END;
$$ LANGUAGE plpgsql;

-- Also fix PO number generation
CREATE OR REPLACE FUNCTION generate_po_number()
RETURNS TEXT AS $$
DECLARE
  next_num INTEGER;
  year_prefix TEXT;
  lock_id BIGINT := 1002; -- Unique lock ID for PO numbers
BEGIN
  -- Acquire advisory lock to prevent race conditions
  PERFORM pg_advisory_xact_lock(lock_id);
  
  year_prefix := TO_CHAR(NOW(), 'YY');

  SELECT COALESCE(MAX(
    CAST(
      SUBSTRING(po_number FROM '[0-9]+$') AS INTEGER
    )
  ), 0) + 1
  INTO next_num
  FROM purchase_orders
  WHERE po_number LIKE 'PO-' || year_prefix || '%';

  RETURN 'PO-' || year_prefix || '-' || LPAD(next_num::TEXT, 5, '0');
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 3. Add app_base_url to organization_settings
-- =====================================================
ALTER TABLE organization_settings
ADD COLUMN IF NOT EXISTS app_base_url TEXT DEFAULT 'http://localhost:5173';

COMMENT ON COLUMN organization_settings.app_base_url IS 'Base URL for the application, used in email notification links';

-- =====================================================
-- 4. Add INSERT policy for organization_settings
-- (Needed for initial setup if no settings exist)
-- =====================================================
DO $$
BEGIN
  -- Drop existing INSERT policy if it exists
  DROP POLICY IF EXISTS "Admins can insert organization settings" ON organization_settings;
  
  -- Create INSERT policy
  CREATE POLICY "Admins can insert organization settings"
    ON organization_settings FOR INSERT
    TO authenticated
    WITH CHECK (
      EXISTS (
        SELECT 1 FROM users
        WHERE users.id = auth.uid()
        AND users.role = 'super_admin'
      )
    );
EXCEPTION
  WHEN OTHERS THEN
    -- Policy might already exist with different definition
    NULL;
END $$;

-- =====================================================
-- 5. Update email notification functions to use stored base URL
-- =====================================================
CREATE OR REPLACE FUNCTION get_app_base_url()
RETURNS TEXT AS $$
DECLARE
  base_url TEXT;
BEGIN
  SELECT COALESCE(app_base_url, 'http://localhost:5173')
  INTO base_url
  FROM organization_settings
  LIMIT 1;
  
  RETURN COALESCE(base_url, 'http://localhost:5173');
END;
$$ LANGUAGE plpgsql STABLE;

-- =====================================================
-- 6. Create helper to set app.base_url from stored setting
-- This is called at the start of email queue processing
-- =====================================================
CREATE OR REPLACE FUNCTION set_app_base_url_config()
RETURNS VOID AS $$
DECLARE
  base_url TEXT;
BEGIN
  base_url := get_app_base_url();
  PERFORM set_config('app.base_url', base_url, true);
END;
$$ LANGUAGE plpgsql;

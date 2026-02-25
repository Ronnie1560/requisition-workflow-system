-- =====================================================
-- Migration: Add NULL Check to org_id Trigger
-- Date: 2026-01-20
-- Purpose: Enhance set_org_id_on_insert trigger to prevent NULL org_id values
-- =====================================================

-- Improved trigger function with NULL check and exception
CREATE OR REPLACE FUNCTION set_org_id_on_insert()
RETURNS TRIGGER AS $$
BEGIN
  -- If org_id is not set, try to get it from current org context
  IF NEW.org_id IS NULL THEN
    NEW.org_id := get_current_org_id();
  END IF;

  -- CRITICAL SECURITY CHECK: Prevent insertions without org_id
  -- This ensures multi-tenancy data isolation
  IF NEW.org_id IS NULL THEN
    RAISE EXCEPTION 'org_id cannot be NULL. Multi-tenancy violation detected in table %.', TG_TABLE_NAME
      USING HINT = 'Ensure user is authenticated and belongs to an organization',
            ERRCODE = '23502'; -- not_null_violation
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION set_org_id_on_insert() IS
'Trigger function that auto-sets org_id on insert and prevents NULL values for multi-tenancy enforcement';

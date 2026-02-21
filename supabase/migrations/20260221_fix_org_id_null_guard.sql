-- Migration: Fix org_id null guard regression & remove dangerous fallback
-- Date: 2026-02-21
--
-- This migration fixes two related issues:
--
-- 1. get_current_org_id() had a fallback that silently picked the user's
--    oldest organization when no org_id was in the JWT. If the frontend
--    failed to send org context, data could be assigned to the wrong tenant.
--    The fallback is removed — the function now returns NULL if no org_id
--    is available, letting the trigger catch it.
--
-- 2. set_org_id_on_insert() was hardened with a RAISE EXCEPTION null guard
--    in 20260120_org_id_null_check.sql, but that fix was accidentally
--    reverted the next day in 20260121_rls_auth_performance_fix.sql which
--    recreated the function with SET search_path = '' but without the guard.
--    This migration restores the null guard while keeping search_path fix.
-- =====================================================

BEGIN;

-- =====================================================
-- STEP 1: Remove dangerous fallback from get_current_org_id()
-- =====================================================
-- If the JWT has no org_id, return NULL instead of guessing.
-- Callers (the trigger, application code) must handle NULL explicitly.

CREATE OR REPLACE FUNCTION get_current_org_id()
RETURNS UUID AS $$
DECLARE
  v_org_id UUID;
BEGIN
  -- Get org_id from JWT claims — the only trusted source
  v_org_id := (current_setting('request.jwt.claims', true)::json->>'org_id')::UUID;

  RETURN v_org_id;  -- NULL if not present in JWT
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE
SET search_path = '';

COMMENT ON FUNCTION get_current_org_id() IS
  'Returns the current org_id from JWT claims. Returns NULL if not set. '
  'Does NOT fall back to guessing from organization_members to prevent '
  'cross-tenant data assignment.';

-- =====================================================
-- STEP 2: Restore null guard on set_org_id_on_insert()
-- =====================================================
-- Combines the search_path fix from 20260121 with the null guard
-- from 20260120 that was accidentally reverted.

CREATE OR REPLACE FUNCTION set_org_id_on_insert()
RETURNS TRIGGER AS $$
BEGIN
  -- Auto-fill from JWT if not provided in the INSERT payload
  IF NEW.org_id IS NULL THEN
    NEW.org_id := public.get_current_org_id();
  END IF;

  -- CRITICAL: Fail loudly rather than creating orphaned/misassigned rows
  IF NEW.org_id IS NULL THEN
    RAISE EXCEPTION 'org_id cannot be NULL. Multi-tenancy violation detected in table %.',
      TG_TABLE_NAME
      USING HINT = 'Ensure the user is authenticated, belongs to an organization, and the active org_id is set in the JWT claims.',
            ERRCODE = '23502';  -- not_null_violation
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql
SET search_path = '';

COMMENT ON FUNCTION set_org_id_on_insert() IS
  'Trigger function that ensures every inserted row has a valid org_id. '
  'Attempts to fill from JWT claims if not provided. Raises an exception '
  'if org_id is still NULL to prevent cross-tenant data corruption.';

-- =====================================================
-- STEP 3: Verify triggers are in place on all data tables
-- =====================================================
-- Re-apply the trigger to all tables that should have it.
-- CREATE TRIGGER IF NOT EXISTS is not supported in all PG versions,
-- so we use DROP + CREATE.

DO $$
DECLARE
  tbl TEXT;
  trigger_tables TEXT[] := ARRAY[
    'users', 'projects', 'user_project_assignments', 'expense_accounts',
    'requisitions', 'requisition_items', 'purchase_orders', 'po_items',
    'receipt_transactions', 'receipt_items', 'notifications',
    'approval_workflows', 'fiscal_year_settings', 'organization_settings',
    'items', 'categories', 'requisition_templates', 'uom_types'
  ];
BEGIN
  FOREACH tbl IN ARRAY trigger_tables
  LOOP
    -- Only apply to tables that actually exist and have an org_id column
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = tbl
        AND column_name = 'org_id'
    ) THEN
      EXECUTE format('DROP TRIGGER IF EXISTS set_org_id_trigger ON public.%I', tbl);
      EXECUTE format(
        'CREATE TRIGGER set_org_id_trigger
         BEFORE INSERT ON public.%I
         FOR EACH ROW
         EXECUTE FUNCTION set_org_id_on_insert()',
        tbl
      );
      RAISE NOTICE 'Trigger set_org_id_trigger applied to %', tbl;
    ELSE
      RAISE NOTICE 'Skipping % (table or org_id column not found)', tbl;
    END IF;
  END LOOP;
END $$;

-- =====================================================
-- Verification
-- =====================================================
DO $$
DECLARE
  fn_source TEXT;
BEGIN
  -- Verify get_current_org_id no longer has the fallback query
  SELECT prosrc INTO fn_source
  FROM pg_proc
  WHERE proname = 'get_current_org_id'
    AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');

  IF fn_source ILIKE '%organization_members%' THEN
    RAISE WARNING 'get_current_org_id() still contains organization_members fallback!';
  ELSE
    RAISE NOTICE 'VERIFIED: get_current_org_id() no longer has dangerous fallback.';
  END IF;

  -- Verify set_org_id_on_insert has the RAISE EXCEPTION guard
  SELECT prosrc INTO fn_source
  FROM pg_proc
  WHERE proname = 'set_org_id_on_insert'
    AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');

  IF fn_source ILIKE '%RAISE EXCEPTION%' THEN
    RAISE NOTICE 'VERIFIED: set_org_id_on_insert() has null guard.';
  ELSE
    RAISE WARNING 'set_org_id_on_insert() is missing the RAISE EXCEPTION null guard!';
  END IF;
END $$;

COMMIT;

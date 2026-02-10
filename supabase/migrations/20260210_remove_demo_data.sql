-- =====================================================
-- Wipe ALL Business Data for Production Launch
-- Date: 2026-02-10
-- Purpose: Remove ALL existing data (demo AND real) so
--          that new client organizations start completely
--          fresh. UOM types (reference data) are KEPT.
--          Schema, functions, and RLS policies are UNTOUCHED.
-- =====================================================

BEGIN;

-- TRUNCATE all business tables in one statement.
-- CASCADE automatically handles foreign-key dependencies.
TRUNCATE
  receipt_transactions,
  purchase_orders,
  requisition_items,
  requisitions,
  requisition_templates,
  expense_accounts,
  user_project_assignments,
  items,
  projects,
  profiles,
  organizations
CASCADE;

COMMIT;

-- =====================================================
-- KEPT INTENTIONALLY:
--   - uom_types (PCS, KG, L, M, etc.) — universal reference data
--   - Database schema, functions, triggers, RLS policies
--   - auth.users (managed separately in Supabase Dashboard)
-- =====================================================

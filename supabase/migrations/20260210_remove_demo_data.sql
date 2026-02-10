-- =====================================================
-- Remove Demo/Seed Data for Production
-- Date: 2026-02-10
-- Purpose: Delete hardcoded demo projects, items, expense
--          accounts, and their relationships so that new
--          client organizations start with a clean slate.
--          UOM types (reference data) are intentionally KEPT.
-- =====================================================

BEGIN;

-- Demo project IDs
-- '33333333-3333-3333-3333-333333333301' = Main Office Operations
-- '33333333-3333-3333-3333-333333333302' = Software Development Project
-- '33333333-3333-3333-3333-333333333303' = Marketing Campaign 2024

-- 1. Remove receipt_transactions linked to POs linked to requisitions on demo projects
DELETE FROM receipt_transactions
WHERE po_id IN (
  SELECT id FROM purchase_orders
  WHERE requisition_id IN (
    SELECT id FROM requisitions
    WHERE project_id IN (
      '33333333-3333-3333-3333-333333333301',
      '33333333-3333-3333-3333-333333333302',
      '33333333-3333-3333-3333-333333333303'
    )
  )
);

-- 2. Remove purchase_orders linked to requisitions on demo projects
DELETE FROM purchase_orders
WHERE requisition_id IN (
  SELECT id FROM requisitions
  WHERE project_id IN (
    '33333333-3333-3333-3333-333333333301',
    '33333333-3333-3333-3333-333333333302',
    '33333333-3333-3333-3333-333333333303'
  )
);

-- 3. Remove requisitions on demo projects
--    (requisition_items, comments, attachments cascade automatically)
DELETE FROM requisitions
WHERE project_id IN (
  '33333333-3333-3333-3333-333333333301',
  '33333333-3333-3333-3333-333333333302',
  '33333333-3333-3333-3333-333333333303'
);

-- 4. Remove requisition templates on demo projects
DELETE FROM requisition_templates
WHERE project_id IN (
  '33333333-3333-3333-3333-333333333301',
  '33333333-3333-3333-3333-333333333302',
  '33333333-3333-3333-3333-333333333303'
);

-- 5. Remove expense accounts linked to demo projects
DELETE FROM expense_accounts
WHERE project_id IN (
  '33333333-3333-3333-3333-333333333301',
  '33333333-3333-3333-3333-333333333302',
  '33333333-3333-3333-3333-333333333303'
);

-- 6. Remove demo projects
--    (user_project_assignments cascade automatically)
DELETE FROM projects
WHERE id IN (
  '33333333-3333-3333-3333-333333333301',
  '33333333-3333-3333-3333-333333333302',
  '33333333-3333-3333-3333-333333333303'
);

-- 7. Remove demo catalog items
DELETE FROM items
WHERE id IN (
  '44444444-4444-4444-4444-444444444401',
  '44444444-4444-4444-4444-444444444402',
  '44444444-4444-4444-4444-444444444403',
  '44444444-4444-4444-4444-444444444404',
  '44444444-4444-4444-4444-444444444405',
  '44444444-4444-4444-4444-444444444406',
  '44444444-4444-4444-4444-444444444407',
  '44444444-4444-4444-4444-444444444408',
  '44444444-4444-4444-4444-444444444409',
  '44444444-4444-4444-4444-444444444410'
);

-- 8. Remove remaining demo expense accounts by hardcoded ID
--    First delete ALL children referencing demo parents (not just the hardcoded sub-categories)
DELETE FROM expense_accounts
WHERE parent_id IN (
  '11111111-1111-1111-1111-111111111101',
  '11111111-1111-1111-1111-111111111102',
  '11111111-1111-1111-1111-111111111103',
  '11111111-1111-1111-1111-111111111104',
  '11111111-1111-1111-1111-111111111105',
  '11111111-1111-1111-1111-111111111106',
  '11111111-1111-1111-1111-111111111107',
  '11111111-1111-1111-1111-111111111108'
);

--    Then delete the demo parent accounts
DELETE FROM expense_accounts
WHERE id IN (
  '11111111-1111-1111-1111-111111111101',
  '11111111-1111-1111-1111-111111111102',
  '11111111-1111-1111-1111-111111111103',
  '11111111-1111-1111-1111-111111111104',
  '11111111-1111-1111-1111-111111111105',
  '11111111-1111-1111-1111-111111111106',
  '11111111-1111-1111-1111-111111111107',
  '11111111-1111-1111-1111-111111111108'
);

COMMIT;

-- =====================================================
-- KEPT INTENTIONALLY:
--   - UOM types (PCS, KG, L, M, etc.) — universal reference data
--   - Database schema, functions, RLS policies — untouched
--   - All real organization data — untouched
-- =====================================================

-- =====================================================
-- Fix All Remaining Duplicate Indexes
-- Date: 2024-12-31
-- Issue: 8 tables have duplicate indexes (UNIQUE constraint + manual index)
-- =====================================================

-- When a UNIQUE constraint is created, PostgreSQL automatically creates
-- a UNIQUE INDEX to enforce it. Manual indexes on the same column are redundant.

-- Strategy: Keep the UNIQUE constraint indexes (_key), drop manual indexes (idx_*)

-- 1. categories table
DROP INDEX IF EXISTS idx_categories_code;
-- Keep: categories_code_key (UNIQUE constraint)

-- 2. expense_accounts table
DROP INDEX IF EXISTS idx_expense_accounts_code;
-- Keep: expense_accounts_code_key (UNIQUE constraint)

-- 3. items table
DROP INDEX IF EXISTS idx_items_code;
-- Keep: items_code_key (UNIQUE constraint)

-- 4. projects table
DROP INDEX IF EXISTS idx_projects_code;
-- Keep: projects_code_key (UNIQUE constraint)

-- 5. purchase_orders table
DROP INDEX IF EXISTS idx_po_number;
-- Keep: purchase_orders_po_number_key (UNIQUE constraint)

-- 6. receipt_transactions table
DROP INDEX IF EXISTS idx_receipt_number;
-- Keep: receipt_transactions_receipt_number_key (UNIQUE constraint)

-- 7. requisitions table
DROP INDEX IF EXISTS idx_requisitions_number;
-- Keep: requisitions_requisition_number_key (UNIQUE constraint)

-- 8. users table
DROP INDEX IF EXISTS idx_users_email;
-- Keep: users_email_key (UNIQUE constraint)

-- =====================================================
-- Verify: Check for remaining duplicates
-- =====================================================

WITH index_details AS (
  SELECT
    schemaname,
    tablename,
    indexname,
    indexdef,
    regexp_replace(indexdef, '^CREATE (UNIQUE )?INDEX \w+ ON \w+\.\w+ USING \w+ ', '') as index_columns
  FROM pg_indexes
  WHERE schemaname = 'public'
),
duplicates AS (
  SELECT
    tablename,
    index_columns,
    array_agg(indexname ORDER BY indexname) as duplicate_indexes,
    COUNT(*) as duplicate_count
  FROM index_details
  GROUP BY tablename, index_columns
  HAVING COUNT(*) > 1
)
SELECT
  tablename,
  duplicate_count,
  duplicate_indexes,
  index_columns
FROM duplicates
ORDER BY tablename;

-- Expected result: No rows (all duplicates fixed!)

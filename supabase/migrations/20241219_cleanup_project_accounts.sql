-- =====================================================
-- Cleanup Migration: Remove Project Accounts System
-- Date: 2024-12-19
-- Description: Clean up deprecated project_accounts table and related code
--              after migration to flexible project budgeting
-- =====================================================

-- Step 1: Drop old budget validation function (using project_accounts)
DROP FUNCTION IF EXISTS check_budget_available(UUID, NUMERIC, UUID);
DROP FUNCTION IF EXISTS check_budget_available(UUID, NUMERIC);

-- Step 2: Remove project_account_id column from requisitions
-- (This column was made nullable in the flexible budgeting migration)
ALTER TABLE requisitions
DROP COLUMN IF EXISTS project_account_id;

-- Step 3: Drop the project_accounts table and its dependencies
-- First, drop any views that might depend on it
DROP VIEW IF EXISTS project_account_summary;
DROP VIEW IF EXISTS budget_utilization_view;

-- Drop RLS policies for project_accounts
DROP POLICY IF EXISTS "Users can view project accounts" ON project_accounts;
DROP POLICY IF EXISTS "Admins can manage project accounts" ON project_accounts;
DROP POLICY IF EXISTS "Users can view their project accounts" ON project_accounts;
DROP POLICY IF EXISTS "Super admins can manage all project accounts" ON project_accounts;

-- Drop the project_accounts table
DROP TABLE IF EXISTS project_accounts CASCADE;

-- Step 4: Clean up any triggers related to project_accounts
DROP TRIGGER IF EXISTS trigger_update_project_account_timestamp ON project_accounts;
DROP FUNCTION IF EXISTS update_project_account_updated_at();

-- Step 5: Remove old account_items table (if it exists and is no longer used)
-- This table was used to link items to project accounts
DROP TABLE IF EXISTS account_items CASCADE;

-- Step 6: Add comment documenting the cleanup
COMMENT ON TABLE requisitions IS
'Purchase requisitions table. Uses direct expense_account_id for categorization. Budget validation is done at project level (projects.budget).';

COMMENT ON COLUMN requisitions.expense_account_id IS
'Expense account for categorization and reporting. Budget tracking is at project level.';

COMMENT ON TABLE projects IS
'Projects table with project-level budgets. Budget is tracked in budget column, spent amount in spent_amount column.';

-- Success message
DO $$
BEGIN
    RAISE NOTICE 'Project accounts cleanup completed successfully';
    RAISE NOTICE 'Removed: project_accounts table, project_account_id column, related functions and policies';
    RAISE NOTICE 'System now uses flexible project-level budgeting';
END $$;

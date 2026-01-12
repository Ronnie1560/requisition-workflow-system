-- =====================================================
-- Clean Test Data for Production Deployment
-- Date: 2024-12-19
-- Description: Removes all test data (requisitions, projects, items, etc.)
--              while preserving user accounts and system configuration
-- =====================================================

-- IMPORTANT: This script will delete ALL data except users
-- Make sure you have a backup before running this!

BEGIN;

-- Step 1: Delete requisition-related data (start with dependent tables)
DELETE FROM requisition_items;
DELETE FROM requisition_approvals;
DELETE FROM requisitions;
DELETE FROM requisition_templates;

-- Step 2: Delete project-related data
DELETE FROM user_project_assignments;
DELETE FROM projects;

-- Step 3: Delete items
DELETE FROM items;

-- Step 4: Delete expense accounts
DELETE FROM expense_accounts;

-- Step 5: Reset sequences (optional - ensures IDs start from 1 again)
-- Uncomment these if you want to reset the auto-increment counters
-- ALTER SEQUENCE requisitions_id_seq RESTART WITH 1;
-- ALTER SEQUENCE projects_id_seq RESTART WITH 1;
-- ALTER SEQUENCE items_id_seq RESTART WITH 1;
-- ALTER SEQUENCE expense_accounts_id_seq RESTART WITH 1;

-- Success message
DO $$
BEGIN
    RAISE NOTICE '==============================================';
    RAISE NOTICE 'Test data cleanup completed successfully';
    RAISE NOTICE 'Removed: All requisitions, projects, items, and expense accounts';
    RAISE NOTICE 'Preserved: User accounts and authentication data';
    RAISE NOTICE '==============================================';
END $$;

COMMIT;

-- Verification queries (run these after the cleanup to verify)
-- SELECT COUNT(*) as users_count FROM users;
-- SELECT COUNT(*) as requisitions_count FROM requisitions;
-- SELECT COUNT(*) as projects_count FROM projects;
-- SELECT COUNT(*) as items_count FROM items;
-- SELECT COUNT(*) as expense_accounts_count FROM expense_accounts;

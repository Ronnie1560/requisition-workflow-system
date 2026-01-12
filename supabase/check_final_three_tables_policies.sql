-- Check policies for the final 3 tables with issues

-- 1. UOM_TYPES
SELECT 'uom_types' as table_name, policyname, cmd as action, roles,
       qual as using_clause, with_check as with_check_clause
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'uom_types'
ORDER BY cmd, policyname;

-- Separator
SELECT '---' as separator;

-- 2. USER_PROJECT_ASSIGNMENTS
SELECT 'user_project_assignments' as table_name, policyname, cmd as action, roles,
       qual as using_clause, with_check as with_check_clause
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'user_project_assignments'
ORDER BY cmd, policyname;

-- Separator
SELECT '---' as separator;

-- 3. USERS
SELECT 'users' as table_name, policyname, cmd as action, roles,
       qual as using_clause, with_check as with_check_clause
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'users'
ORDER BY cmd, policyname;

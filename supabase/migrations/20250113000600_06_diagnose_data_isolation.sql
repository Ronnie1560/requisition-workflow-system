-- =====================================================
-- DIAGNOSTIC: Check data isolation issues
-- This script identifies why data is visible across organizations
-- =====================================================

-- 1. Check all organizations
SELECT
  'Organizations' as table_name,
  id,
  name,
  slug
FROM organizations
ORDER BY created_at;

-- 2. Check which org_id is on existing data
SELECT
  'Projects with org_id' as check_name,
  COUNT(*) FILTER (WHERE org_id IS NOT NULL) as with_org_id,
  COUNT(*) FILTER (WHERE org_id IS NULL) as null_org_id,
  COUNT(*) as total
FROM projects;

SELECT
  'Requisitions with org_id' as check_name,
  COUNT(*) FILTER (WHERE org_id IS NOT NULL) as with_org_id,
  COUNT(*) FILTER (WHERE org_id IS NULL) as null_org_id,
  COUNT(*) as total
FROM requisitions;

SELECT
  'Users with org_id' as check_name,
  COUNT(*) FILTER (WHERE org_id IS NOT NULL) as with_org_id,
  COUNT(*) FILTER (WHERE org_id IS NULL) as null_org_id,
  COUNT(*) as total
FROM users;

-- 3. Check RLS policies on main tables
SELECT
  'RLS Policies Check' as section,
  tablename,
  policyname,
  cmd as operation,
  qual as condition,
  CASE
    WHEN qual LIKE '%user_belongs_to_org%' THEN '✅ Has org filter'
    WHEN qual LIKE '%org_id%' THEN '✅ Has org check'
    WHEN qual = 'true' THEN '❌ PERMISSIVE (no org filter)'
    ELSE '⚠️ Check manually'
  END as security_status
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('projects', 'requisitions', 'users', 'expense_accounts')
  AND cmd IN ('SELECT', 'INSERT', 'UPDATE', 'DELETE')
ORDER BY tablename, cmd;

-- 4. Show sample data to see which org it belongs to
SELECT
  'Sample Projects' as table_name,
  p.id,
  p.name,
  p.org_id,
  o.name as organization_name
FROM projects p
LEFT JOIN organizations o ON p.org_id = o.id
LIMIT 5;

SELECT
  'Sample Requisitions' as table_name,
  r.id,
  r.title,
  r.org_id,
  o.name as organization_name
FROM requisitions r
LEFT JOIN organizations o ON r.org_id = o.id
LIMIT 5;

-- 5. Check if RLS is enabled on tables
SELECT
  'RLS Status' as section,
  schemaname,
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('projects', 'requisitions', 'users', 'expense_accounts', 'items')
ORDER BY tablename;

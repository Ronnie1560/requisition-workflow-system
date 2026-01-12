-- =====================================================
-- SUPABASE SECURITY AUDIT
-- Run this in Supabase SQL Editor to check for issues
-- =====================================================

-- =====================================================
-- 1. CHECK TABLES WITHOUT RLS ENABLED
-- =====================================================
SELECT '1. TABLES WITHOUT RLS' as audit_section;

SELECT 
  schemaname,
  tablename,
  '❌ RLS NOT ENABLED' as status
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename NOT IN (
    SELECT tablename FROM pg_policies WHERE schemaname = 'public'
  )
  AND tablename NOT LIKE 'pg_%'
  AND tablename NOT LIKE '__%'
ORDER BY tablename;

-- =====================================================
-- 2. CHECK TABLES WITH RLS ENABLED BUT NO POLICIES
-- =====================================================
SELECT '2. RLS ENABLED BUT NO POLICIES' as audit_section;

SELECT 
  c.relname as tablename,
  CASE WHEN c.relrowsecurity THEN 'RLS Enabled' ELSE 'RLS Disabled' END as rls_status,
  COUNT(p.policyname) as policy_count,
  CASE 
    WHEN c.relrowsecurity AND COUNT(p.policyname) = 0 THEN '❌ DANGER: RLS on but no policies (blocks all access)'
    WHEN NOT c.relrowsecurity THEN '⚠️ WARNING: RLS disabled'
    ELSE '✅ OK'
  END as status
FROM pg_class c
LEFT JOIN pg_policies p ON c.relname = p.tablename AND p.schemaname = 'public'
WHERE c.relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
  AND c.relkind = 'r'
  AND c.relname NOT LIKE 'pg_%'
  AND c.relname NOT LIKE '__%'
GROUP BY c.relname, c.relrowsecurity
HAVING NOT c.relrowsecurity OR COUNT(p.policyname) = 0
ORDER BY c.relname;

-- =====================================================
-- 3. CHECK FOR OVERLY PERMISSIVE POLICIES
-- =====================================================
SELECT '3. OVERLY PERMISSIVE POLICIES' as audit_section;

SELECT 
  tablename,
  policyname,
  cmd as action,
  roles,
  CASE
    WHEN qual = 'true' OR qual IS NULL THEN '❌ DANGER: Allows ALL rows'
    WHEN qual LIKE '%true%' AND qual NOT LIKE '%auth%' THEN '⚠️ WARNING: May be too permissive'
    ELSE '✅ Has restrictions'
  END as using_status,
  CASE
    WHEN with_check = 'true' OR (with_check IS NULL AND cmd IN ('INSERT', 'UPDATE')) THEN '⚠️ No WITH CHECK'
    ELSE '✅ Has WITH CHECK'
  END as with_check_status,
  LEFT(qual, 100) as using_clause_preview
FROM pg_policies
WHERE schemaname = 'public'
  AND (qual = 'true' OR qual IS NULL OR with_check = 'true')
ORDER BY tablename, policyname;

-- =====================================================
-- 4. CHECK FOR SECURITY DEFINER FUNCTIONS
-- =====================================================
SELECT '4. SECURITY DEFINER FUNCTIONS' as audit_section;

SELECT 
  n.nspname as schema,
  p.proname as function_name,
  CASE p.prosecdef 
    WHEN true THEN '⚠️ SECURITY DEFINER'
    ELSE '✅ SECURITY INVOKER'
  END as security_type,
  pg_get_functiondef(p.oid) as definition_preview
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND p.prosecdef = true
ORDER BY p.proname;

-- =====================================================
-- 5. CHECK FOR EXPOSED SECRETS IN FUNCTIONS
-- =====================================================
SELECT '5. POTENTIAL SECRETS IN FUNCTIONS' as audit_section;

SELECT 
  proname as function_name,
  CASE
    WHEN prosrc ILIKE '%password%' THEN '⚠️ Contains "password"'
    WHEN prosrc ILIKE '%secret%' THEN '⚠️ Contains "secret"'
    WHEN prosrc ILIKE '%api_key%' THEN '⚠️ Contains "api_key"'
    WHEN prosrc ILIKE '%token%' AND prosrc NOT ILIKE '%auth.jwt%' THEN '⚠️ Contains "token"'
    ELSE '✅ No obvious secrets'
  END as status
FROM pg_proc
WHERE pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
  AND (
    prosrc ILIKE '%password%'
    OR prosrc ILIKE '%secret%'
    OR prosrc ILIKE '%api_key%'
    OR (prosrc ILIKE '%token%' AND prosrc NOT ILIKE '%auth.jwt%')
  );

-- =====================================================
-- 6. CHECK PUBLIC SCHEMA GRANTS
-- =====================================================
SELECT '6. PUBLIC SCHEMA GRANTS' as audit_section;

SELECT 
  grantee,
  table_schema,
  table_name,
  privilege_type,
  CASE
    WHEN grantee = 'anon' AND privilege_type IN ('INSERT', 'UPDATE', 'DELETE') 
      THEN '❌ DANGER: anon can modify'
    WHEN grantee = 'anon' AND privilege_type = 'SELECT'
      THEN '⚠️ anon can SELECT (check RLS)'
    ELSE '✅ authenticated role'
  END as status
FROM information_schema.table_privileges
WHERE table_schema = 'public'
  AND grantee IN ('anon', 'authenticated')
ORDER BY table_name, grantee, privilege_type;

-- =====================================================
-- 7. CHECK FOR MISSING AUTH CHECKS IN POLICIES
-- =====================================================
SELECT '7. POLICIES WITHOUT AUTH CHECKS' as audit_section;

SELECT 
  tablename,
  policyname,
  cmd as action,
  CASE
    WHEN qual NOT LIKE '%auth.uid()%' 
      AND qual NOT LIKE '%user_belongs_to_org%'
      AND qual NOT LIKE '%user_is_org%'
      AND qual != 'true'
      THEN '⚠️ No auth function in USING'
    ELSE '✅ Has auth check'
  END as auth_status,
  LEFT(qual, 150) as using_clause
FROM pg_policies
WHERE schemaname = 'public'
  AND cmd IN ('SELECT', 'UPDATE', 'DELETE')
  AND qual NOT LIKE '%auth.uid()%'
  AND qual NOT LIKE '%user_belongs_to_org%'
  AND qual NOT LIKE '%user_is_org%'
  AND qual != 'true'
ORDER BY tablename;

-- =====================================================
-- 8. CHECK STORAGE BUCKETS SECURITY
-- =====================================================
SELECT '8. STORAGE BUCKET POLICIES' as audit_section;

SELECT 
  id as bucket_name,
  public as is_public,
  CASE
    WHEN public = true THEN '⚠️ PUBLIC BUCKET - anyone can read'
    ELSE '✅ Private bucket'
  END as status,
  created_at
FROM storage.buckets
ORDER BY id;

-- =====================================================
-- 9. CHECK FOR CASCADE DELETE RISKS
-- =====================================================
SELECT '9. CASCADE DELETE FOREIGN KEYS' as audit_section;

SELECT
  tc.table_name,
  kcu.column_name,
  ccu.table_name AS foreign_table,
  rc.delete_rule,
  CASE
    WHEN rc.delete_rule = 'CASCADE' AND ccu.table_name IN ('users', 'organizations')
      THEN '⚠️ CASCADE from critical table'
    WHEN rc.delete_rule = 'CASCADE'
      THEN 'ℹ️ CASCADE delete'
    ELSE '✅ Safe delete rule'
  END as status
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu 
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage ccu 
  ON ccu.constraint_name = tc.constraint_name
JOIN information_schema.referential_constraints rc
  ON rc.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_schema = 'public'
  AND rc.delete_rule = 'CASCADE'
ORDER BY ccu.table_name, tc.table_name;

-- =====================================================
-- 10. SUMMARY
-- =====================================================
SELECT '10. SECURITY SUMMARY' as audit_section;

SELECT 
  'Tables without RLS' as check_type,
  COUNT(*) as count,
  CASE WHEN COUNT(*) > 0 THEN '❌ ACTION NEEDED' ELSE '✅ PASS' END as status
FROM pg_tables t
WHERE t.schemaname = 'public'
  AND NOT EXISTS (
    SELECT 1 FROM pg_class c 
    WHERE c.relname = t.tablename 
      AND c.relrowsecurity = true
  )
  AND t.tablename NOT LIKE 'pg_%'
  AND t.tablename NOT LIKE '__%'

UNION ALL

SELECT 
  'Overly permissive policies' as check_type,
  COUNT(*) as count,
  CASE WHEN COUNT(*) > 0 THEN '⚠️ REVIEW NEEDED' ELSE '✅ PASS' END as status
FROM pg_policies
WHERE schemaname = 'public'
  AND (qual = 'true' OR qual IS NULL)

UNION ALL

SELECT 
  'SECURITY DEFINER functions' as check_type,
  COUNT(*) as count,
  CASE WHEN COUNT(*) > 5 THEN '⚠️ REVIEW NEEDED' ELSE '✅ ACCEPTABLE' END as status
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public' AND p.prosecdef = true

UNION ALL

SELECT 
  'Public storage buckets' as check_type,
  COUNT(*) as count,
  CASE WHEN COUNT(*) > 0 THEN '⚠️ REVIEW NEEDED' ELSE '✅ PASS' END as status
FROM storage.buckets
WHERE public = true;

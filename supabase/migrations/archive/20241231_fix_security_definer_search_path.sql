-- =====================================================
-- Fix SECURITY DEFINER Functions - Add Explicit search_path
-- Date: 2024-12-31
-- Issue: 36 security issues - SECURITY DEFINER functions need explicit search_path
-- =====================================================

-- IMPORTANT: Setting search_path prevents search_path hijacking attacks

-- This script dynamically fixes ALL SECURITY DEFINER functions at once
DO $$
DECLARE
  func_record RECORD;
  func_signature TEXT;
  sql_statement TEXT;
BEGIN
  -- Loop through all SECURITY DEFINER functions without search_path set
  FOR func_record IN
    SELECT
      n.nspname as schema_name,
      p.proname as function_name,
      pg_get_function_identity_arguments(p.oid) as  arg_types
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prosecdef = true  -- SECURITY DEFINER functions
      AND (p.proconfig IS NULL OR NOT EXISTS (
        SELECT 1
        FROM unnest(p.proconfig) AS config
        WHERE config LIKE 'search_path=%'
      ))
  LOOP
    -- Build function signature
    func_signature := func_record.schema_name || '.' || func_record.function_name || '(' || func_record.arg_types || ')';

    -- Build ALTER statement
    sql_statement := 'ALTER FUNCTION ' || func_signature || ' SET search_path = ''public''';

    -- Execute the ALTER statement
    BEGIN
      EXECUTE sql_statement;
      RAISE NOTICE 'Fixed: %', func_signature;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Failed to fix %: %', func_signature, SQLERRM;
    END;
  END LOOP;

  RAISE NOTICE 'Security fix completed!';
END $$;

-- =====================================================
-- VERIFY FIX
-- =====================================================

-- Check remaining SECURITY DEFINER functions without search_path
SELECT
  n.nspname || '.' || p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')' as function_signature,
  CASE
    WHEN p.proconfig IS NULL THEN '❌ No search_path'
    WHEN EXISTS (SELECT 1 FROM unnest(p.proconfig) AS config WHERE config LIKE 'search_path=%')
      THEN '✅ search_path set'
    ELSE '❌ No search_path'
  END as status
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.prosecdef = true
ORDER BY status, p.proname;

-- =====================================================
-- Fix ALL Functions - Add search_path (Comprehensive Fix)
-- Date: 2024-12-31
-- Issue: 22 remaining functions without search_path
-- =====================================================

-- This migration fixes ALL functions (not just SECURITY DEFINER)
-- that don't have an explicit search_path set

DO $$
DECLARE
  func_record RECORD;
  func_signature TEXT;
  sql_statement TEXT;
  fixed_count INT := 0;
BEGIN
  -- Loop through ALL functions without search_path set
  -- (not just SECURITY DEFINER ones)
  FOR func_record IN
    SELECT
      n.nspname as schema_name,
      p.proname as function_name,
      pg_get_function_identity_arguments(p.oid) as arg_types
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      -- Exclude built-in aggregate functions and window functions
      AND p.prokind IN ('f', 'p')  -- f = function, p = procedure
      -- Only functions without search_path
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
      fixed_count := fixed_count + 1;
      RAISE NOTICE 'Fixed [%]: %', fixed_count, func_signature;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Failed to fix %: %', func_signature, SQLERRM;
    END;
  END LOOP;

  RAISE NOTICE '========================================';
  RAISE NOTICE 'Comprehensive fix completed!';
  RAISE NOTICE 'Total functions fixed: %', fixed_count;
  RAISE NOTICE '========================================';
END $$;

-- =====================================================
-- VERIFY FIX - Check ALL functions
-- =====================================================

SELECT
  n.nspname || '.' || p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')' as function_signature,
  CASE
    WHEN p.prosecdef THEN 'SECURITY DEFINER'
    ELSE 'SECURITY INVOKER'
  END as security_type,
  CASE
    WHEN p.proconfig IS NULL THEN '❌ No search_path'
    WHEN EXISTS (SELECT 1 FROM unnest(p.proconfig) AS config WHERE config LIKE 'search_path=%')
      THEN '✅ search_path set'
    ELSE '❌ No search_path'
  END as status
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.prokind IN ('f', 'p')
ORDER BY status, security_type, p.proname;

-- =====================================================
-- Fix Remaining Function search_path Issue
-- Date: 2024-12-31
-- Issue: check_budget_available function missing search_path
-- =====================================================

-- Fix check_budget_available function
-- This function checks if sufficient budget is available for a requisition
ALTER FUNCTION check_budget_available(UUID, NUMERIC, UUID) SET search_path = 'public';

-- Verify the fix
SELECT
  p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')' as function_signature,
  CASE
    WHEN p.proconfig IS NOT NULL AND EXISTS (
      SELECT 1 FROM unnest(p.proconfig) AS config WHERE config LIKE 'search_path=%'
    ) THEN '✅ search_path set'
    ELSE '❌ No search_path'
  END as status
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname = 'check_budget_available';

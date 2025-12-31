-- =====================================================
-- Find Functions That Call auth.uid()
-- These functions also need optimization
-- =====================================================

SELECT
  n.nspname as schema_name,
  p.proname as function_name,
  pg_get_function_arguments(p.oid) as arguments,
  pg_get_functiondef(p.oid) as function_definition
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.prokind = 'f'  -- Only regular functions, not aggregates
  AND pg_get_functiondef(p.oid) LIKE '%auth.uid()%'
  AND pg_get_functiondef(p.oid) NOT LIKE '%(SELECT auth.uid())%'
ORDER BY p.proname;

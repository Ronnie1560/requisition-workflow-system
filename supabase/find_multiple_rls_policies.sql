-- =====================================================
-- Find All Tables with Multiple Permissive RLS Policies
-- This query identifies tables with multiple policies for the same action
-- =====================================================

WITH policy_summary AS (
  SELECT
    schemaname,
    tablename,
    cmd as action,  -- SELECT, INSERT, UPDATE, DELETE
    COUNT(*) as policy_count,
    array_agg(policyname ORDER BY policyname) as policy_names,
    array_agg(CASE WHEN permissive = 'PERMISSIVE' THEN 'PERMISSIVE' ELSE 'RESTRICTIVE' END) as policy_types
  FROM pg_policies
  WHERE schemaname = 'public'
  GROUP BY schemaname, tablename, cmd
  HAVING COUNT(*) > 1
)
SELECT
  tablename,
  action,
  policy_count,
  policy_names,
  policy_types
FROM policy_summary
ORDER BY tablename, action;

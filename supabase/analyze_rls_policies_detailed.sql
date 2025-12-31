-- =====================================================
-- Detailed RLS Policy Analysis
-- Shows actual policy definitions for optimization
-- =====================================================

-- Part 1: Show tables with multiple policies per action
SELECT
  tablename,
  cmd as action,
  COUNT(*) as policy_count,
  string_agg(policyname, ', ' ORDER BY policyname) as policy_names
FROM pg_policies
WHERE schemaname = 'public'
GROUP BY tablename, cmd
HAVING COUNT(*) > 1
ORDER BY tablename, cmd;

-- Part 2: Show detailed policy definitions for manual review
SELECT
  tablename,
  policyname,
  cmd as action,
  roles,
  qual as using_clause,
  with_check as with_check_clause,
  permissive
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN (
    -- Only show policies for tables with multiple policies
    SELECT tablename
    FROM pg_policies
    WHERE schemaname = 'public'
    GROUP BY tablename, cmd
    HAVING COUNT(*) > 1
  )
ORDER BY tablename, cmd, policyname;

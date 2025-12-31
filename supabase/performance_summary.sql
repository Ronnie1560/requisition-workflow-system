-- =====================================================
-- Comprehensive Performance Summary
-- Shows all potential performance issues in one view
-- =====================================================

-- 1. Count RLS policies per table/action
SELECT
  'Multiple RLS Policies' as issue_type,
  COUNT(*) as issue_count,
  string_agg(DISTINCT tablename, ', ') as affected_tables
FROM (
  SELECT tablename
  FROM pg_policies
  WHERE schemaname = 'public'
  GROUP BY tablename, cmd
  HAVING COUNT(*) > 1
) sub

UNION ALL

-- 2. Count tables without RLS enabled
SELECT
  'Tables Without RLS' as issue_type,
  COUNT(*) as issue_count,
  string_agg(tablename, ', ') as affected_tables
FROM pg_tables
WHERE schemaname = 'public'
  AND rowsecurity = false
  AND tablename NOT LIKE 'pg_%'

UNION ALL

-- 3. Count unused indexes
SELECT
  'Unused Indexes' as issue_type,
  COUNT(*) as issue_count,
  string_agg(indexrelname, ', ') as affected_tables
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
  AND idx_scan = 0
  AND indexrelname NOT LIKE '%_pkey'
  AND indexrelname NOT LIKE '%_key'

UNION ALL

-- 4. Count tables with many rows but no indexes (excluding primary keys)
SELECT
  'Large Tables - Few Indexes' as issue_type,
  COUNT(*) as issue_count,
  string_agg(tablename, ', ') as affected_tables
FROM (
  SELECT
    t.tablename,
    pg_relation_size(quote_ident(t.schemaname)||'.'||quote_ident(t.tablename)) as table_size,
    COUNT(i.indexname) as index_count
  FROM pg_tables t
  LEFT JOIN pg_indexes i ON i.schemaname = t.schemaname AND i.tablename = t.tablename
  WHERE t.schemaname = 'public'
  GROUP BY t.schemaname, t.tablename
  HAVING pg_relation_size(quote_ident(t.schemaname)||'.'||quote_ident(t.tablename)) > 1000000
    AND COUNT(i.indexname) < 3
) sub

ORDER BY issue_count DESC;

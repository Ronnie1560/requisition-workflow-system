-- =====================================================
-- Find Unused Indexes
-- Indexes that are never used waste space and slow writes
-- =====================================================

SELECT
  schemaname,
  tablename,
  indexname,
  idx_scan as index_scans,
  pg_size_pretty(pg_relation_size(indexrelid)) as index_size,
  CASE
    WHEN idx_scan = 0 THEN '❌ Never used'
    WHEN idx_scan < 10 THEN '⚠️  Rarely used'
    ELSE '✅ Actively used'
  END as usage_status
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
  AND idx_scan < 10  -- Adjust threshold as needed
  AND indexrelname NOT LIKE '%_pkey'  -- Exclude primary keys
  AND indexrelname NOT LIKE '%_key'   -- Exclude unique constraints
ORDER BY idx_scan, pg_relation_size(indexrelid) DESC;

-- Indexes with idx_scan = 0 are candidates for removal (if not needed for constraints)

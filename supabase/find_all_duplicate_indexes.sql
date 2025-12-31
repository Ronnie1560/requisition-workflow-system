-- =====================================================
-- Find ALL Duplicate Indexes Across Database
-- This query identifies all duplicate indexes
-- =====================================================

WITH index_details AS (
  SELECT
    schemaname,
    tablename,
    indexname,
    indexdef,
    -- Extract just the column definition part for comparison
    regexp_replace(indexdef, '^CREATE (UNIQUE )?INDEX \w+ ON \w+\.\w+ USING \w+ ', '') as index_columns
  FROM pg_indexes
  WHERE schemaname = 'public'
),
duplicates AS (
  SELECT
    tablename,
    index_columns,
    array_agg(indexname ORDER BY indexname) as duplicate_indexes,
    COUNT(*) as duplicate_count
  FROM index_details
  GROUP BY tablename, index_columns
  HAVING COUNT(*) > 1
)
SELECT
  tablename,
  duplicate_count,
  duplicate_indexes,
  index_columns
FROM duplicates
ORDER BY tablename, duplicate_count DESC;

-- =====================================================
-- Find Foreign Keys Without Indexes
-- Missing indexes on FKs can cause performance issues
-- =====================================================

WITH foreign_keys AS (
  SELECT
    tc.table_schema,
    tc.table_name,
    kcu.column_name,
    tc.constraint_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name
  FROM information_schema.table_constraints AS tc
  JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
  JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
    AND ccu.table_schema = tc.table_schema
  WHERE tc.constraint_type = 'FOREIGN KEY'
    AND tc.table_schema = 'public'
),
indexed_columns AS (
  SELECT
    schemaname,
    tablename,
    indexname,
    array_agg(attname ORDER BY attnum) AS indexed_columns
  FROM (
    SELECT
      n.nspname AS schemaname,
      c.relname AS tablename,
      i.relname AS indexname,
      a.attname,
      a.attnum
    FROM pg_index idx
    JOIN pg_class i ON i.oid = idx.indexrelid
    JOIN pg_class c ON c.oid = idx.indrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum = ANY(idx.indkey)
    WHERE n.nspname = 'public'
  ) sub
  GROUP BY schemaname, tablename, indexname
)
SELECT
  fk.table_name,
  fk.column_name,
  fk.constraint_name,
  fk.foreign_table_name,
  CASE
    WHEN EXISTS (
      SELECT 1
      FROM indexed_columns ic
      WHERE ic.schemaname = fk.table_schema
        AND ic.tablename = fk.table_name
        AND fk.column_name = ANY(ic.indexed_columns)
    ) THEN '✅ Indexed'
    ELSE '❌ Missing Index'
  END AS index_status
FROM foreign_keys fk
WHERE NOT EXISTS (
  SELECT 1
  FROM indexed_columns ic
  WHERE ic.schemaname = fk.table_schema
    AND ic.tablename = fk.table_name
    AND fk.column_name = ANY(ic.indexed_columns)
)
ORDER BY fk.table_name, fk.column_name;

-- If this returns rows, those foreign keys need indexes for optimal performance

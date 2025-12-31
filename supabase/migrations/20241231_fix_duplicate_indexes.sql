-- =====================================================
-- Fix Duplicate Indexes - Performance Optimization
-- Date: 2024-12-31
-- Issue: Duplicate indexes waste space and slow down writes
-- =====================================================

-- Drop duplicate index on user_project_assignments
-- Keep idx_user_project_assignments_project (more descriptive name)
-- Drop idx_user_assignments_project (duplicate)
DROP INDEX IF EXISTS idx_user_assignments_project;

-- Drop duplicate index on notifications
-- Keep idx_notifications_user_id (more descriptive name)
-- Drop idx_notifications_user (less descriptive)
DROP INDEX IF EXISTS idx_notifications_user;

-- Verify: Check for remaining indexes
SELECT
  tablename,
  COUNT(*) as index_count,
  string_agg(indexname, ', ' ORDER BY indexname) as indexes
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename IN ('user_project_assignments', 'notifications')
GROUP BY tablename
ORDER BY tablename;

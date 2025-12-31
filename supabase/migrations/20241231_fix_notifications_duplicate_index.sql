-- =====================================================
-- Fix Duplicate Indexes on Notifications Table
-- Date: 2024-12-31
-- Issue: notifications table has multiple duplicate indexes
-- =====================================================

-- Drop duplicate index #1: idx_notifications_user (user_id)
-- Keep idx_notifications_user_id (more descriptive name)
DROP INDEX IF EXISTS idx_notifications_user;

-- Drop duplicate index #2: idx_notifications_created (created_at DESC)
-- Keep idx_notifications_created_at (more descriptive name)
DROP INDEX IF EXISTS idx_notifications_created;

-- Verify the fix
SELECT
  schemaname,
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename = 'notifications'
ORDER BY indexname;

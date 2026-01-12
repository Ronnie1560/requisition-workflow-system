-- =====================================================
-- Optimize Duplicate RLS Policies
-- Date: 2024-12-31
-- Issue: Multiple tables have duplicate/redundant RLS policies
-- =====================================================

-- Strategy: Keep the more descriptive/permissive policy, drop duplicates

-- =====================================================
-- 1. NOTIFICATIONS TABLE (4 duplicate pairs)
-- =====================================================

-- DELETE: Keep "Users can delete their own notifications" (more descriptive)
DROP POLICY IF EXISTS "Users can delete own notifications" ON notifications;
-- Keep: "Users can delete their own notifications"

-- INSERT: Keep "System can insert notifications" (more standard terminology)
DROP POLICY IF EXISTS "System can create notifications" ON notifications;
-- Keep: "System can insert notifications"

-- SELECT: Keep "Users can view their own notifications" (more descriptive)
DROP POLICY IF EXISTS "Users can view own notifications" ON notifications;
-- Keep: "Users can view their own notifications"

-- UPDATE: Keep "Users can update own notifications" (has WITH CHECK clause)
DROP POLICY IF EXISTS "Users can update their own notifications" ON notifications;
-- Keep: "Users can update own notifications" (it has both USING and WITH CHECK)

-- =====================================================
-- 2. USERS TABLE (1 duplicate)
-- =====================================================

-- SELECT: Keep "Users can view own profile" (role: public, more permissive)
DROP POLICY IF EXISTS "Users can read own profile" ON users;
-- Keep: "Users can view own profile" (public role is more permissive than authenticated)

-- =====================================================
-- 3. USER_PROJECT_ASSIGNMENTS TABLE (1 redundant)
-- =====================================================

-- SELECT: Drop redundant policy (already covered by ALL policy)
DROP POLICY IF EXISTS "Super admins can view all assignments" ON user_project_assignments;
-- Keep: "Super admins can manage assignments" (ALL action includes SELECT)

-- =====================================================
-- Verify the optimization
-- =====================================================

WITH policy_summary AS (
  SELECT
    tablename,
    cmd as action,
    COUNT(*) as policy_count,
    array_agg(policyname ORDER BY policyname) as policy_names
  FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename IN ('notifications', 'users', 'user_project_assignments')
  GROUP BY tablename, cmd
)
SELECT
  tablename,
  action,
  policy_count,
  policy_names
FROM policy_summary
ORDER BY tablename, action;

-- Expected result: No duplicate policies for notifications, users, or user_project_assignments

-- =====================================================
-- Consolidate Final Three Tables RLS Policies
-- Date: 2025-01-01
-- Issue: Multiple permissive policies (last 16 warnings)
-- Solution: Consolidate uom_types, user_project_assignments, users
-- =====================================================

-- =====================================================
-- 1. UOM_TYPES
-- =====================================================

-- Problem: ALL policy overlaps with SELECT
-- 1. "Super admins can manage UOM types" (ALL)
-- 2. "Authenticated users can view UOM types" (SELECT)

DROP POLICY IF EXISTS "Super admins can manage UOM types" ON uom_types;
DROP POLICY IF EXISTS "Authenticated users can view UOM types" ON uom_types;

-- Consolidated SELECT policy
CREATE POLICY "Users can view UOM types" ON uom_types
  FOR SELECT
  USING (
    -- Super admins can view all
    is_super_admin()
    -- OR authenticated users can view active UOM types
    OR is_active = true
  );

-- Separate INSERT, UPDATE, DELETE for super admins only
CREATE POLICY "Super admins can create UOM types" ON uom_types
  FOR INSERT
  WITH CHECK (is_super_admin());

CREATE POLICY "Super admins can update UOM types" ON uom_types
  FOR UPDATE
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

CREATE POLICY "Super admins can delete UOM types" ON uom_types
  FOR DELETE
  USING (is_super_admin());

-- =====================================================
-- 2. USER_PROJECT_ASSIGNMENTS
-- =====================================================

-- Problem: ALL policy overlaps with SELECT
-- 1. "Super admins can manage assignments" (ALL)
-- 2. "Users can view own assignments" (SELECT)

DROP POLICY IF EXISTS "Super admins can manage assignments" ON user_project_assignments;
DROP POLICY IF EXISTS "Users can view own assignments" ON user_project_assignments;

-- Consolidated SELECT policy
CREATE POLICY "Users can view project assignments" ON user_project_assignments
  FOR SELECT
  USING (
    -- Super admins can view all
    is_super_admin()
    -- OR users can view their own assignments
    OR user_id = (SELECT auth.uid())
  );

-- Separate INSERT, UPDATE, DELETE for super admins only
CREATE POLICY "Super admins can create project assignments" ON user_project_assignments
  FOR INSERT
  WITH CHECK (is_super_admin());

CREATE POLICY "Super admins can update project assignments" ON user_project_assignments
  FOR UPDATE
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

CREATE POLICY "Super admins can delete project assignments" ON user_project_assignments
  FOR DELETE
  USING (is_super_admin());

-- =====================================================
-- 3. USERS
-- =====================================================

-- Problem: ALL policy overlaps with SELECT and UPDATE
-- 1. "Super admins can manage users" (ALL)
-- 2. "Users can view other active users" (SELECT)
-- 3. "Users can view own profile" (SELECT)
-- 4. "Users can update own profile" (UPDATE)

DROP POLICY IF EXISTS "Super admins can manage users" ON users;
DROP POLICY IF EXISTS "Users can view other active users" ON users;
DROP POLICY IF EXISTS "Users can view own profile" ON users;
DROP POLICY IF EXISTS "Users can update own profile" ON users;

-- Consolidated SELECT policy
CREATE POLICY "Users can view users" ON users
  FOR SELECT
  USING (
    -- Super admins can view all
    is_super_admin()
    -- OR users can view other active users
    OR is_active = true
    -- OR users can view their own profile (even if inactive)
    OR (SELECT auth.uid()) = id
  );

-- Consolidated UPDATE policy
CREATE POLICY "Users can update users" ON users
  FOR UPDATE
  USING (
    -- Super admins can update any
    is_super_admin()
    -- OR users can update their own profile
    OR (SELECT auth.uid()) = id
  )
  WITH CHECK (
    -- Super admins can set any values
    is_super_admin()
    -- OR users can update their own profile
    OR (SELECT auth.uid()) = id
  );

-- Separate INSERT, DELETE for super admins only
CREATE POLICY "Super admins can create users" ON users
  FOR INSERT
  WITH CHECK (is_super_admin());

CREATE POLICY "Super admins can delete users" ON users
  FOR DELETE
  USING (is_super_admin());

-- =====================================================
-- Verify optimization
-- =====================================================

WITH policy_summary AS (
  SELECT
    tablename,
    cmd as action,
    COUNT(*) as policy_count,
    array_agg(policyname ORDER BY policyname) as policy_names
  FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename IN ('uom_types', 'user_project_assignments', 'users')
  GROUP BY tablename, cmd
)
SELECT
  tablename,
  action,
  policy_count,
  policy_names
FROM policy_summary
WHERE policy_count > 1  -- Show only if there are still multiple policies per action
ORDER BY tablename, action;

-- Expected: No rows (only 1 policy per action for each table)

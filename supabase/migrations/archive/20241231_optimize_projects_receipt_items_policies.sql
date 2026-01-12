-- =====================================================
-- Optimize Projects and Receipt Items RLS Policies
-- Date: 2024-12-31
-- Issue: Multiple permissive policies for SELECT action
-- =====================================================

-- Tables affected:
-- 1. projects (2 policies - ALL + SELECT)
-- 2. receipt_items (2 policies - ALL + SELECT)

-- =====================================================
-- 1. PROJECTS
-- =====================================================

-- Problem: Two policies both apply to SELECT
-- 1. "Super admins can manage projects" (ALL action)
-- 2. "Users can view assigned projects" (SELECT action)

DROP POLICY IF EXISTS "Super admins can manage projects" ON projects;
DROP POLICY IF EXISTS "Users can view assigned projects" ON projects;

-- Combined SELECT policy (merges both conditions)
CREATE POLICY "Users can view projects" ON projects
  FOR SELECT
  USING (
    -- Super admins can see all (from old ALL policy)
    is_super_admin()
    -- OR users assigned to the project (from old SELECT policy)
    OR is_assigned_to_project(id)
  );

-- Separate INSERT, UPDATE, DELETE policies for super admins only
CREATE POLICY "Super admins can create projects" ON projects
  FOR INSERT
  WITH CHECK (is_super_admin());

CREATE POLICY "Super admins can update projects" ON projects
  FOR UPDATE
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

CREATE POLICY "Super admins can delete projects" ON projects
  FOR DELETE
  USING (is_super_admin());

-- =====================================================
-- 2. RECEIPT_ITEMS
-- =====================================================

-- Problem: Two policies both apply to SELECT
-- 1. "Store managers can manage receipt items" (ALL action)
-- 2. "Users can view receipt items" (SELECT action)

DROP POLICY IF EXISTS "Store managers can manage receipt items" ON receipt_items;
DROP POLICY IF EXISTS "Users can view receipt items" ON receipt_items;

-- Combined SELECT policy (merges both conditions)
CREATE POLICY "Users can view receipt items" ON receipt_items
  FOR SELECT
  USING (
    -- Authorized users (from old ALL policy)
    is_super_admin()
    OR get_user_role() = 'store_manager'::user_role
    -- OR users who own/are assigned to the requisition (from old SELECT policy)
    OR EXISTS (
      SELECT 1 FROM receipt_transactions rt
      JOIN purchase_orders po ON po.id = rt.po_id
      JOIN requisitions r ON r.id = po.requisition_id
      WHERE rt.id = receipt_items.receipt_id
        AND (
          r.submitted_by = (SELECT auth.uid())
          OR is_assigned_to_project(r.project_id)
          OR is_super_admin()
        )
    )
  );

-- Separate INSERT, UPDATE, DELETE for authorized users
CREATE POLICY "Authorized users can create receipt items" ON receipt_items
  FOR INSERT
  WITH CHECK (
    is_super_admin()
    OR get_user_role() = 'store_manager'::user_role
  );

CREATE POLICY "Authorized users can update receipt items" ON receipt_items
  FOR UPDATE
  USING (
    is_super_admin()
    OR get_user_role() = 'store_manager'::user_role
  )
  WITH CHECK (
    is_super_admin()
    OR get_user_role() = 'store_manager'::user_role
  );

CREATE POLICY "Authorized users can delete receipt items" ON receipt_items
  FOR DELETE
  USING (
    is_super_admin()
    OR get_user_role() = 'store_manager'::user_role
  );

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
    AND tablename IN ('projects', 'receipt_items')
  GROUP BY tablename, cmd
)
SELECT
  tablename,
  action,
  policy_count,
  policy_names
FROM policy_summary
WHERE policy_count > 1  -- Show only tables that still have multiple policies per action
ORDER BY tablename, action;

-- Expected: No rows (each table should have only 1 policy per action)

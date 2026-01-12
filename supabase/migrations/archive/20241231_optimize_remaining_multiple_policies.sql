-- =====================================================
-- Optimize Remaining Multiple Permissive Policies
-- Date: 2024-12-31
-- Issue: 5 tables with multiple SELECT policies for same role
-- =====================================================

-- Tables affected:
-- 1. approval_workflows (authenticated)
-- 2. categories (authenticated)
-- 3. expense_accounts (authenticated)
-- 4. items (authenticated)
-- 5. po_items (anon)

-- =====================================================
-- 1. APPROVAL_WORKFLOWS
-- =====================================================

DROP POLICY IF EXISTS "Anyone can view approval workflows" ON approval_workflows;
DROP POLICY IF EXISTS "Only admins can manage approval workflows" ON approval_workflows;

-- Combined SELECT policy
CREATE POLICY "Users can view approval workflows" ON approval_workflows
  FOR SELECT
  USING (true);  -- Anyone can view (from "Anyone can view approval workflows")

-- Separate INSERT, UPDATE, DELETE policies for admins only
CREATE POLICY "Only admins can create approval workflows" ON approval_workflows
  FOR INSERT
  WITH CHECK (is_super_admin());

CREATE POLICY "Only admins can update approval workflows" ON approval_workflows
  FOR UPDATE
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

CREATE POLICY "Only admins can delete approval workflows" ON approval_workflows
  FOR DELETE
  USING (is_super_admin());

-- =====================================================
-- 2. CATEGORIES
-- =====================================================

DROP POLICY IF EXISTS "All authenticated users can view active categories" ON categories;
DROP POLICY IF EXISTS "Super admin can view all categories" ON categories;

-- Combined SELECT policy (active categories OR super admin sees all)
CREATE POLICY "Users can view categories" ON categories
  FOR SELECT
  USING (
    is_active = true  -- All users can see active categories
    OR is_super_admin()  -- Super admins can see all
  );

-- Keep existing admin-only INSERT, UPDATE, DELETE policies
-- (No changes needed - already separate)

-- =====================================================
-- 3. EXPENSE_ACCOUNTS
-- =====================================================

DROP POLICY IF EXISTS "Authenticated users can view expense accounts" ON expense_accounts;
DROP POLICY IF EXISTS "Super admins can manage expense accounts" ON expense_accounts;

-- Combined SELECT policy
CREATE POLICY "Users can view expense accounts" ON expense_accounts
  FOR SELECT
  USING (true);  -- All authenticated users can view

-- Separate INSERT, UPDATE, DELETE for super admins
CREATE POLICY "Super admins can create expense accounts" ON expense_accounts
  FOR INSERT
  WITH CHECK (is_super_admin());

CREATE POLICY "Super admins can update expense accounts" ON expense_accounts
  FOR UPDATE
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

CREATE POLICY "Super admins can delete expense accounts" ON expense_accounts
  FOR DELETE
  USING (is_super_admin());

-- =====================================================
-- 4. ITEMS
-- =====================================================

DROP POLICY IF EXISTS "Admins and store managers can manage items" ON items;
DROP POLICY IF EXISTS "Authenticated users can view items" ON items;

-- Combined SELECT policy
CREATE POLICY "Users can view items" ON items
  FOR SELECT
  USING (true);  -- All authenticated users can view

-- Separate INSERT, UPDATE, DELETE for admins and store managers
CREATE POLICY "Admins and store managers can create items" ON items
  FOR INSERT
  WITH CHECK (
    is_super_admin()
    OR get_user_role() = 'store_manager'::user_role
  );

CREATE POLICY "Admins and store managers can update items" ON items
  FOR UPDATE
  USING (
    is_super_admin()
    OR get_user_role() = 'store_manager'::user_role
  )
  WITH CHECK (
    is_super_admin()
    OR get_user_role() = 'store_manager'::user_role
  );

CREATE POLICY "Admins and store managers can delete items" ON items
  FOR DELETE
  USING (
    is_super_admin()
    OR get_user_role() = 'store_manager'::user_role
  );

-- =====================================================
-- 5. PO_ITEMS
-- =====================================================

DROP POLICY IF EXISTS "Authorized users can manage PO items" ON po_items;
DROP POLICY IF EXISTS "Users can view PO items" ON po_items;

-- Combined SELECT policy (merges both conditions)
CREATE POLICY "Users can view PO items" ON po_items
  FOR SELECT
  USING (
    -- Authorized users (from old ALL policy)
    is_super_admin()
    OR get_user_role() = ANY (ARRAY['approver'::user_role, 'store_manager'::user_role])
    -- OR users who own/are assigned to the requisition (from old SELECT policy)
    OR EXISTS (
      SELECT 1 FROM purchase_orders po
      JOIN requisitions r ON r.id = po.requisition_id
      WHERE po.id = po_items.po_id
        AND (
          r.submitted_by = (SELECT auth.uid())
          OR is_assigned_to_project(r.project_id)
        )
    )
  );

-- Separate INSERT, UPDATE, DELETE for authorized users
CREATE POLICY "Authorized users can create PO items" ON po_items
  FOR INSERT
  WITH CHECK (
    is_super_admin()
    OR get_user_role() = ANY (ARRAY['approver'::user_role, 'store_manager'::user_role])
  );

CREATE POLICY "Authorized users can update PO items" ON po_items
  FOR UPDATE
  USING (
    is_super_admin()
    OR get_user_role() = ANY (ARRAY['approver'::user_role, 'store_manager'::user_role])
  )
  WITH CHECK (
    is_super_admin()
    OR get_user_role() = ANY (ARRAY['approver'::user_role, 'store_manager'::user_role])
  );

CREATE POLICY "Authorized users can delete PO items" ON po_items
  FOR DELETE
  USING (
    is_super_admin()
    OR get_user_role() = ANY (ARRAY['approver'::user_role, 'store_manager'::user_role])
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
    AND tablename IN ('approval_workflows', 'categories', 'expense_accounts', 'items', 'po_items')
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

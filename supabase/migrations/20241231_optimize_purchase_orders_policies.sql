-- =====================================================
-- Optimize Purchase Orders RLS Policies
-- Date: 2024-12-31
-- Issue: Multiple permissive policies for SELECT action
-- =====================================================

-- Problem: Two policies both apply to SELECT
-- 1. "Authorized users can manage purchase orders" (ALL action)
-- 2. "Users can view purchase orders" (SELECT action)

-- Solution: Split ALL policy into separate actions and combine SELECT logic

-- =====================================================
-- Drop existing policies
-- =====================================================

DROP POLICY IF EXISTS "Authorized users can manage purchase orders" ON purchase_orders;
DROP POLICY IF EXISTS "Users can view purchase orders" ON purchase_orders;

-- =====================================================
-- Create optimized policies
-- =====================================================

-- Combined SELECT policy (merges both conditions)
CREATE POLICY "Users can view purchase orders" ON purchase_orders
  FOR SELECT
  USING (
    -- Authorized users (from old ALL policy)
    is_super_admin()
    OR get_user_role() = ANY (ARRAY['approver'::user_role, 'store_manager'::user_role])
    -- OR users who own/are assigned to the requisition (from old SELECT policy)
    OR EXISTS (
      SELECT 1 FROM requisitions r
      WHERE r.id = purchase_orders.requisition_id
        AND (
          r.submitted_by = (SELECT auth.uid())
          OR is_assigned_to_project(r.project_id)
        )
    )
  );

-- INSERT policy for authorized users only
CREATE POLICY "Authorized users can create purchase orders" ON purchase_orders
  FOR INSERT
  WITH CHECK (
    is_super_admin()
    OR get_user_role() = ANY (ARRAY['approver'::user_role, 'store_manager'::user_role])
  );

-- UPDATE policy for authorized users only
CREATE POLICY "Authorized users can update purchase orders" ON purchase_orders
  FOR UPDATE
  USING (
    is_super_admin()
    OR get_user_role() = ANY (ARRAY['approver'::user_role, 'store_manager'::user_role])
  )
  WITH CHECK (
    is_super_admin()
    OR get_user_role() = ANY (ARRAY['approver'::user_role, 'store_manager'::user_role])
  );

-- DELETE policy for authorized users only
CREATE POLICY "Authorized users can delete purchase orders" ON purchase_orders
  FOR DELETE
  USING (
    is_super_admin()
    OR get_user_role() = ANY (ARRAY['approver'::user_role, 'store_manager'::user_role])
  );

-- =====================================================
-- Verify optimization
-- =====================================================

SELECT
  policyname,
  cmd as action,
  roles
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'purchase_orders'
ORDER BY cmd, policyname;

-- Expected: 4 policies (SELECT, INSERT, UPDATE, DELETE) - no more ALL policy

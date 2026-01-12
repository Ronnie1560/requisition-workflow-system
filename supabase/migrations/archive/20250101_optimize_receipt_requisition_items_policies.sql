-- =====================================================
-- Optimize Receipt Transactions and Requisition Items RLS Policies
-- Date: 2025-01-01
-- Issue: Multiple permissive policies for same actions
-- =====================================================

-- Tables affected:
-- 1. receipt_transactions (ALL + SELECT policies)
-- 2. requisition_items (ALL policy overlapping with 4 action-specific policies)

-- =====================================================
-- 1. RECEIPT_TRANSACTIONS
-- =====================================================

-- Problem: Two policies both apply to SELECT
-- 1. "Store managers can manage receipts" (ALL action)
-- 2. "Users can view receipts" (SELECT action)

DROP POLICY IF EXISTS "Store managers can manage receipts" ON receipt_transactions;
DROP POLICY IF EXISTS "Users can view receipts" ON receipt_transactions;

-- Combined SELECT policy (merges both conditions)
CREATE POLICY "Users can view receipt transactions" ON receipt_transactions
  FOR SELECT
  USING (
    -- Authorized users (from old ALL policy)
    is_super_admin()
    OR get_user_role() = 'store_manager'::user_role
    -- OR users who own/are assigned to the requisition (from old SELECT policy)
    OR EXISTS (
      SELECT 1 FROM purchase_orders po
      JOIN requisitions r ON r.id = po.requisition_id
      WHERE po.id = receipt_transactions.po_id
        AND (
          r.submitted_by = (SELECT auth.uid())
          OR is_assigned_to_project(r.project_id)
          OR is_super_admin()
        )
    )
  );

-- Separate INSERT, UPDATE, DELETE for authorized users
CREATE POLICY "Authorized users can create receipt transactions" ON receipt_transactions
  FOR INSERT
  WITH CHECK (
    is_super_admin()
    OR get_user_role() = 'store_manager'::user_role
  );

CREATE POLICY "Authorized users can update receipt transactions" ON receipt_transactions
  FOR UPDATE
  USING (
    is_super_admin()
    OR get_user_role() = 'store_manager'::user_role
  )
  WITH CHECK (
    is_super_admin()
    OR get_user_role() = 'store_manager'::user_role
  );

CREATE POLICY "Authorized users can delete receipt transactions" ON receipt_transactions
  FOR DELETE
  USING (
    is_super_admin()
    OR get_user_role() = 'store_manager'::user_role
  );

-- =====================================================
-- 2. REQUISITION_ITEMS
-- =====================================================

-- Problem: ALL policy overlaps with all action-specific policies
-- 1. "admins_all_access_items" (ALL action) - super admins
-- 2. "users_delete_own_requisition_items" (DELETE) - own drafts
-- 3. "users_insert_own_requisition_items" (INSERT) - own requisitions
-- 4. "users_update_own_requisition_items" (UPDATE) - own drafts
-- 5. "users_view_requisition_items" (SELECT) - own or privileged roles

-- Drop the ALL policy and recreate as action-specific admin policies
DROP POLICY IF EXISTS "admins_all_access_items" ON requisition_items;

-- Admin SELECT policy
CREATE POLICY "admins_view_requisition_items" ON requisition_items
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = (SELECT auth.uid())
        AND users.role = 'super_admin'::user_role
    )
  );

-- Admin INSERT policy
CREATE POLICY "admins_insert_requisition_items" ON requisition_items
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = (SELECT auth.uid())
        AND users.role = 'super_admin'::user_role
    )
  );

-- Admin UPDATE policy
CREATE POLICY "admins_update_requisition_items" ON requisition_items
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = (SELECT auth.uid())
        AND users.role = 'super_admin'::user_role
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = (SELECT auth.uid())
        AND users.role = 'super_admin'::user_role
    )
  );

-- Admin DELETE policy
CREATE POLICY "admins_delete_requisition_items" ON requisition_items
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = (SELECT auth.uid())
        AND users.role = 'super_admin'::user_role
    )
  );

-- Keep existing user policies unchanged:
-- - users_delete_own_requisition_items (DELETE)
-- - users_insert_own_requisition_items (INSERT)
-- - users_update_own_requisition_items (UPDATE)
-- - users_view_requisition_items (SELECT)

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
    AND tablename IN ('receipt_transactions', 'requisition_items')
  GROUP BY tablename, cmd
)
SELECT
  tablename,
  action,
  policy_count,
  policy_names
FROM policy_summary
ORDER BY tablename, action;

-- Expected for receipt_transactions: 4 rows (1 policy per action)
-- Expected for requisition_items: 8 rows (2 policies per action - admin + user)

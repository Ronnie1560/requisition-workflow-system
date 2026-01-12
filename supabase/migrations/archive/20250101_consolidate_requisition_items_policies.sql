-- =====================================================
-- Consolidate Requisition Items RLS Policies
-- Date: 2025-01-01
-- Issue: Multiple policies per action (admin + user)
-- Solution: Merge into single policy per action
-- =====================================================

-- Currently: 2 policies per action (admin + user)
-- Target: 1 policy per action (combined logic)

-- =====================================================
-- DROP existing policies
-- =====================================================

-- Admin policies
DROP POLICY IF EXISTS "admins_delete_requisition_items" ON requisition_items;
DROP POLICY IF EXISTS "admins_insert_requisition_items" ON requisition_items;
DROP POLICY IF EXISTS "admins_update_requisition_items" ON requisition_items;
DROP POLICY IF EXISTS "admins_view_requisition_items" ON requisition_items;

-- User policies
DROP POLICY IF EXISTS "users_delete_own_requisition_items" ON requisition_items;
DROP POLICY IF EXISTS "users_insert_own_requisition_items" ON requisition_items;
DROP POLICY IF EXISTS "users_update_own_requisition_items" ON requisition_items;
DROP POLICY IF EXISTS "users_view_requisition_items" ON requisition_items;

-- =====================================================
-- CREATE consolidated policies
-- =====================================================

-- Consolidated SELECT policy
-- Combines: admins can view all + users can view own/privileged roles can view
CREATE POLICY "Users can view requisition items" ON requisition_items
  FOR SELECT
  USING (
    -- Super admins can view all
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = (SELECT auth.uid())
        AND users.role = 'super_admin'::user_role
    )
    -- OR users can view items for their own requisitions
    -- OR privileged roles can view
    OR EXISTS (
      SELECT 1 FROM requisitions
      WHERE requisitions.id = requisition_items.requisition_id
        AND (
          requisitions.submitted_by = (SELECT auth.uid())
          OR EXISTS (
            SELECT 1 FROM users
            WHERE users.id = (SELECT auth.uid())
              AND users.role = ANY (ARRAY[
                'reviewer'::user_role,
                'approver'::user_role,
                'store_manager'::user_role,
                'super_admin'::user_role
              ])
          )
        )
    )
  );

-- Consolidated INSERT policy
-- Combines: admins can insert + users can insert for own requisitions
CREATE POLICY "Users can insert requisition items" ON requisition_items
  FOR INSERT
  WITH CHECK (
    -- Super admins can insert
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = (SELECT auth.uid())
        AND users.role = 'super_admin'::user_role
    )
    -- OR users can insert for their own requisitions
    OR EXISTS (
      SELECT 1 FROM requisitions
      WHERE requisitions.id = requisition_items.requisition_id
        AND requisitions.submitted_by = (SELECT auth.uid())
    )
  );

-- Consolidated UPDATE policy
-- Combines: admins can update + users can update own draft requisitions
CREATE POLICY "Users can update requisition items" ON requisition_items
  FOR UPDATE
  USING (
    -- Super admins can update
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = (SELECT auth.uid())
        AND users.role = 'super_admin'::user_role
    )
    -- OR users can update items for their own draft requisitions
    OR EXISTS (
      SELECT 1 FROM requisitions
      WHERE requisitions.id = requisition_items.requisition_id
        AND requisitions.submitted_by = (SELECT auth.uid())
        AND requisitions.status = 'draft'::requisition_status
    )
  );

-- Consolidated DELETE policy
-- Combines: admins can delete + users can delete from own draft requisitions
CREATE POLICY "Users can delete requisition items" ON requisition_items
  FOR DELETE
  USING (
    -- Super admins can delete
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = (SELECT auth.uid())
        AND users.role = 'super_admin'::user_role
    )
    -- OR users can delete items from their own draft requisitions
    OR EXISTS (
      SELECT 1 FROM requisitions
      WHERE requisitions.id = requisition_items.requisition_id
        AND requisitions.submitted_by = (SELECT auth.uid())
        AND requisitions.status = 'draft'::requisition_status
    )
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
    AND tablename = 'requisition_items'
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

-- Expected: No rows (only 1 policy per action)

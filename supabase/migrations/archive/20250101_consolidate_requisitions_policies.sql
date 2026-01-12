-- =====================================================
-- Consolidate Requisitions RLS Policies
-- Date: 2025-01-01
-- Issue: Multiple policies per action (9 total policies)
-- Solution: Merge into single policy per action (4 total)
-- =====================================================

-- Current policies:
-- ALL: admins_all_access_requisitions (super admins)
-- DELETE: users_delete_own_drafts (own drafts)
-- INSERT: authenticated_users_insert_own_requisitions (own requisitions)
-- SELECT: reviewers_view_all_requisitions (privileged roles), users_view_own_requisitions (own)
-- UPDATE: admins_bypass_workflow (super admins), approvers_update_requisitions (approve/reject)
--         reviewers_update_requisitions (review), users_update_own_drafts (own drafts)

-- =====================================================
-- DROP existing policies
-- =====================================================

DROP POLICY IF EXISTS "admins_all_access_requisitions" ON requisitions;
DROP POLICY IF EXISTS "admins_bypass_workflow" ON requisitions;
DROP POLICY IF EXISTS "approvers_update_requisitions" ON requisitions;
DROP POLICY IF EXISTS "authenticated_users_insert_own_requisitions" ON requisitions;
DROP POLICY IF EXISTS "reviewers_update_requisitions" ON requisitions;
DROP POLICY IF EXISTS "reviewers_view_all_requisitions" ON requisitions;
DROP POLICY IF EXISTS "users_delete_own_drafts" ON requisitions;
DROP POLICY IF EXISTS "users_update_own_drafts" ON requisitions;
DROP POLICY IF EXISTS "users_view_own_requisitions" ON requisitions;

-- =====================================================
-- CREATE consolidated policies
-- =====================================================

-- Consolidated SELECT policy
-- Combines: super admins + privileged roles view all + users view own
CREATE POLICY "Users can view requisitions" ON requisitions
  FOR SELECT
  USING (
    -- Privileged roles can view all (includes super_admin, reviewer, approver, store_manager)
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = (SELECT auth.uid())
        AND users.role = ANY (ARRAY[
          'reviewer'::user_role,
          'approver'::user_role,
          'store_manager'::user_role,
          'super_admin'::user_role
        ])
    )
    -- OR users can view their own requisitions
    OR (SELECT auth.uid()) = submitted_by
  );

-- Consolidated INSERT policy
-- Combines: super admins can insert + users can insert own
CREATE POLICY "Users can insert requisitions" ON requisitions
  FOR INSERT
  WITH CHECK (
    -- Super admins can insert any
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = (SELECT auth.uid())
        AND users.role = 'super_admin'::user_role
    )
    -- OR users can insert their own
    OR (SELECT auth.uid()) = submitted_by
  );

-- Consolidated UPDATE policy
-- Combines: super admins (unrestricted) + approvers (approve/reject) +
--           reviewers (review) + users (update own drafts)
CREATE POLICY "Users can update requisitions" ON requisitions
  FOR UPDATE
  USING (
    -- Super admins can update any (no status restrictions)
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = (SELECT auth.uid())
        AND users.role = 'super_admin'::user_role
    )
    -- OR approvers can update requisitions in 'reviewed' status
    OR (
      EXISTS (
        SELECT 1 FROM users
        WHERE users.id = (SELECT auth.uid())
          AND users.role = 'approver'::user_role
      )
      AND status = 'reviewed'::requisition_status
    )
    -- OR reviewers can update requisitions in pending/under_review status
    OR (
      EXISTS (
        SELECT 1 FROM users
        WHERE users.id = (SELECT auth.uid())
          AND users.role = 'reviewer'::user_role
      )
      AND status = ANY (ARRAY['pending'::requisition_status, 'under_review'::requisition_status])
    )
    -- OR users can update their own draft requisitions
    OR (
      (SELECT auth.uid()) = submitted_by
      AND status = 'draft'::requisition_status
    )
  )
  WITH CHECK (
    -- Super admins can set any status (no restrictions)
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = (SELECT auth.uid())
        AND users.role = 'super_admin'::user_role
    )
    -- OR approvers can change status to approved/rejected
    OR (
      EXISTS (
        SELECT 1 FROM users
        WHERE users.id = (SELECT auth.uid())
          AND users.role = 'approver'::user_role
      )
      AND status = ANY (ARRAY['approved'::requisition_status, 'rejected'::requisition_status])
    )
    -- OR reviewers can change status to under_review/reviewed
    OR (
      EXISTS (
        SELECT 1 FROM users
        WHERE users.id = (SELECT auth.uid())
          AND users.role = 'reviewer'::user_role
      )
      AND status = ANY (ARRAY['under_review'::requisition_status, 'reviewed'::requisition_status])
    )
    -- OR users can change status to draft/pending
    OR (
      (SELECT auth.uid()) = submitted_by
      AND status = ANY (ARRAY['draft'::requisition_status, 'pending'::requisition_status])
    )
  );

-- Consolidated DELETE policy
-- Combines: super admins can delete any + users can delete own drafts
CREATE POLICY "Users can delete requisitions" ON requisitions
  FOR DELETE
  USING (
    -- Super admins can delete any
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = (SELECT auth.uid())
        AND users.role = 'super_admin'::user_role
    )
    -- OR users can delete their own draft requisitions
    OR (
      (SELECT auth.uid()) = submitted_by
      AND status = 'draft'::requisition_status
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
    AND tablename = 'requisitions'
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

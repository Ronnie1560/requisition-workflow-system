-- =====================================================
-- ADD PROPER REVIEW WORKFLOW
-- Implements: pending → under_review → reviewed → approved
-- =====================================================

-- Step 0: Add 'reviewed' to the status enum
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'reviewed'
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'requisition_status')
  ) THEN
    ALTER TYPE requisition_status ADD VALUE 'reviewed';
  END IF;
END $$;

-- Step 1: Add reviewed_by and reviewed_at columns
ALTER TABLE requisitions
ADD COLUMN IF NOT EXISTS reviewed_by UUID REFERENCES users(id),
ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;

-- Step 2: Add comments
COMMENT ON COLUMN requisitions.reviewed_by IS 'Reviewer who reviewed this requisition';
COMMENT ON COLUMN requisitions.reviewed_at IS 'Timestamp when requisition was reviewed';

-- Step 3: Update RLS policies to enforce workflow

-- Drop existing update policies
DROP POLICY IF EXISTS "users_update_own_drafts" ON requisitions;
DROP POLICY IF EXISTS "approvers_update_requisitions" ON requisitions;

-- NEW: Users can update their own draft requisitions AND submit them
CREATE POLICY "users_update_own_drafts"
ON requisitions
FOR UPDATE
TO authenticated
USING (
  auth.uid() = submitted_by
  AND status = 'draft'
)
WITH CHECK (
  auth.uid() = submitted_by
  AND status IN ('draft', 'pending')  -- Can save draft or submit
);

-- NEW: Reviewers can mark as under_review and reviewed
CREATE POLICY "reviewers_update_requisitions"
ON requisitions
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM users
    WHERE id = auth.uid()
    AND role IN ('reviewer', 'super_admin')
  )
  AND status IN ('pending', 'under_review')  -- Can only review pending or under_review
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM users
    WHERE id = auth.uid()
    AND role IN ('reviewer', 'super_admin')
  )
  AND status IN ('under_review', 'reviewed')  -- Can only set to under_review or reviewed
);

-- NEW: Approvers can approve/reject ONLY reviewed requisitions
CREATE POLICY "approvers_update_requisitions"
ON requisitions
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM users
    WHERE id = auth.uid()
    AND role IN ('approver', 'super_admin')
  )
  AND status = 'reviewed'  -- Can only approve/reject reviewed requisitions
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM users
    WHERE id = auth.uid()
    AND role IN ('approver', 'super_admin')
  )
  AND status IN ('approved', 'rejected')  -- Can only set to approved or rejected
);

-- NEW: Super admins can bypass workflow (update any status to any status)
CREATE POLICY "admins_bypass_workflow"
ON requisitions
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM users
    WHERE id = auth.uid()
    AND role = 'super_admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM users
    WHERE id = auth.uid()
    AND role = 'super_admin'
  )
);

-- Step 4: Update getRequisitionsForReview to show all statuses for reviewers
-- (This will be done in the API layer, not SQL)

-- Step 5: Verify policies
SELECT
  schemaname,
  tablename,
  policyname,
  cmd,
  roles
FROM pg_policies
WHERE tablename = 'requisitions'
  AND cmd = 'UPDATE'
ORDER BY policyname;

-- Success message
SELECT 'Review workflow successfully implemented!' as status;
SELECT 'Workflow: pending → under_review → reviewed → approved/rejected' as workflow;
SELECT 'Reviewers can: pending → under_review → reviewed' as reviewer_actions;
SELECT 'Approvers can: reviewed → approved/rejected' as approver_actions;
SELECT 'Super Admin: Can bypass to any status' as admin_actions;

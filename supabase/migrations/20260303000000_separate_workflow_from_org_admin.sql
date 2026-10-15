-- Migration: Separate approval authority from org administration
-- Date: 2026-03-03
--
-- Problem:
--   invite-user mapped workflow roles reviewer/approver to
--   organization_members.role = 'admin'. Every RLS policy that checks
--   jwt_org_role() IN ('owner','admin') therefore let reviewers and
--   approvers manage members, approval workflows, projects, expense
--   accounts, categories, UOM, org settings, fiscal year and billing
--   history. The approval workflow itself only worked because of that:
--   the requisitions SELECT/UPDATE policies admitted org admins but not
--   reviewers/approvers.
--
-- Fix:
--   1. requisitions SELECT/UPDATE policies admit workflow roles
--      reviewer/approver/super_admin directly (same org-wide access they
--      had as org admins, nothing more).
--   2. Existing members with role = 'admin' AND workflow_role IN
--      ('reviewer','approver') are demoted to 'member'. Owners,
--      super_admins and anyone else made admin are untouched. Previous
--      roles are kept in organization_members_role_backup_20260303 so a
--      deliberate admin can be restored:
--        UPDATE organization_members om SET role = b.previous_role
--        FROM organization_members_role_backup_20260303 b
--        WHERE om.id = b.member_id AND b.member_id = '<id>';
--   3. update_member_workflow_role() keeps the org role in sync for
--      non-owners (admin iff super_admin), and invite-user (edge
--      function, same commit) now maps only super_admin to org 'admin'.
--
-- Takes effect for a user on their next token refresh (org_role is a
-- JWT claim).
-- =====================================================

BEGIN;

-- =====================================================
-- STEP 1: Workflow roles get requisition access directly
-- =====================================================

DROP POLICY IF EXISTS "Users can view own requisitions" ON requisitions;
CREATE POLICY "Users can view own requisitions"
  ON requisitions FOR SELECT TO authenticated
  USING (
    (org_id IS NULL OR org_id = (SELECT public.jwt_org_id()))
    AND (
      submitted_by = (SELECT auth.uid())
      OR (SELECT public.jwt_org_role()) IN ('owner', 'admin')
      OR (SELECT public.jwt_workflow_role()) IN ('reviewer', 'approver', 'super_admin')
    )
  );

DROP POLICY IF EXISTS "Users can update own requisitions" ON requisitions;
CREATE POLICY "Users can update own requisitions"
  ON requisitions FOR UPDATE TO authenticated
  USING (
    (org_id IS NULL OR org_id = (SELECT public.jwt_org_id()))
    AND (
      submitted_by = (SELECT auth.uid())
      OR (SELECT public.jwt_org_role()) IN ('owner', 'admin')
      OR (SELECT public.jwt_workflow_role()) IN ('reviewer', 'approver', 'super_admin')
    )
  );

-- =====================================================
-- STEP 2: Demote reviewer/approver org admins (with backup)
-- =====================================================

CREATE TABLE IF NOT EXISTS public.organization_members_role_backup_20260303 (
  member_id UUID PRIMARY KEY,
  organization_id UUID NOT NULL,
  user_id UUID NOT NULL,
  workflow_role public.user_role NOT NULL,
  previous_role public.org_member_role NOT NULL,
  demoted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Backup is for operators only; keep it out of the API
ALTER TABLE public.organization_members_role_backup_20260303 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.organization_members_role_backup_20260303 FROM anon, authenticated;

INSERT INTO public.organization_members_role_backup_20260303
  (member_id, organization_id, user_id, workflow_role, previous_role)
SELECT om.id, om.organization_id, om.user_id, om.workflow_role, om.role
FROM public.organization_members om
WHERE om.role = 'admin'
  AND om.workflow_role IN ('reviewer', 'approver')
ON CONFLICT (member_id) DO NOTHING;

UPDATE public.organization_members om
SET role = 'member',
    updated_at = NOW()
WHERE om.role = 'admin'
  AND om.workflow_role IN ('reviewer', 'approver');

-- =====================================================
-- STEP 3: Keep org role in sync when workflow role changes
-- =====================================================
-- Non-owners: org 'admin' iff workflow_role = 'super_admin'. Otherwise
-- demoting a super_admin to reviewer would leave them an org admin, and
-- promoting to super_admin would leave them unable to administer.

CREATE OR REPLACE FUNCTION public.update_member_workflow_role(
  p_org_id UUID,
  p_user_id UUID,
  p_workflow_role user_role
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Verify caller is org admin or super_admin
  IF NOT (user_is_org_admin(p_org_id) OR is_super_admin(p_org_id)) THEN
    RAISE EXCEPTION 'Permission denied: must be org admin or super admin';
  END IF;

  -- Update the workflow role, and the org role for non-owners
  UPDATE organization_members
  SET workflow_role = p_workflow_role,
      role = CASE
        WHEN role = 'owner' THEN role
        WHEN p_workflow_role = 'super_admin' THEN 'admin'::org_member_role
        ELSE 'member'::org_member_role
      END,
      updated_at = NOW()
  WHERE organization_id = p_org_id
    AND user_id = p_user_id
    AND is_active = true;

  -- users.role (global) is intentionally not updated: in multi-org a user
  -- can have different roles per organization (matches production).
END;
$$;

-- =====================================================
-- STEP 4: Verification
-- =====================================================
DO $$
DECLARE
  v_demoted INTEGER;
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE role = 'admin' AND workflow_role IN ('reviewer', 'approver')
  ) THEN
    RAISE EXCEPTION 'reviewer/approver org admins remain';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'requisitions'
      AND policyname = 'Users can update own requisitions'
      AND qual LIKE '%reviewer%'
  ) THEN
    RAISE EXCEPTION 'requisitions UPDATE policy missing workflow roles';
  END IF;

  SELECT COUNT(*) INTO v_demoted FROM public.organization_members_role_backup_20260303;
  RAISE NOTICE 'workflow roles separated from org admin; % member(s) in backup', v_demoted;
END $$;

COMMIT;

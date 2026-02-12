-- =====================================================
-- Migration: Multi-Tenancy Workflow Role Migration
-- Date: 2026-02-15
-- Purpose: Move workflow roles from global users.role to
--          per-org organization_members.workflow_role
--
-- BEFORE: users.role (global) = submitter|reviewer|approver|store_manager|super_admin
--         organization_members.role (org) = owner|admin|member
--         → User has ONE workflow role across ALL organizations
--
-- AFTER:  organization_members.workflow_role (per-org) = submitter|reviewer|approver|store_manager|super_admin
--         organization_members.role (org) = owner|admin|member (unchanged)
--         → User can have DIFFERENT workflow roles in DIFFERENT organizations
-- =====================================================

-- =====================================================
-- STEP 1: Add workflow_role column to organization_members
-- =====================================================
ALTER TABLE organization_members
  ADD COLUMN IF NOT EXISTS workflow_role user_role NOT NULL DEFAULT 'submitter';

COMMENT ON COLUMN organization_members.workflow_role IS
  'Per-organization workflow role (submitter/reviewer/approver/store_manager/super_admin). Replaces the global users.role.';

-- Create index for common lookups
CREATE INDEX IF NOT EXISTS idx_org_members_workflow_role
  ON organization_members(organization_id, user_id, workflow_role);

-- =====================================================
-- STEP 2: Migrate existing data from users.role
-- =====================================================
UPDATE organization_members om
SET workflow_role = u.role
FROM users u
WHERE om.user_id = u.id
  AND om.workflow_role = 'submitter'; -- Only update if still at default

-- Verify migration
DO $$
DECLARE
  migrated_count INTEGER;
  unmigrated_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO migrated_count
  FROM organization_members om
  JOIN users u ON om.user_id = u.id
  WHERE om.workflow_role = u.role;

  SELECT COUNT(*) INTO unmigrated_count
  FROM organization_members om
  JOIN users u ON om.user_id = u.id
  WHERE om.workflow_role != u.role;

  RAISE NOTICE 'Workflow role migration: % members migrated, % had differing roles (kept org version)', migrated_count, unmigrated_count;
END $$;

-- =====================================================
-- STEP 3: Update user_organizations view to include workflow_role
-- =====================================================
DROP VIEW IF EXISTS user_organizations CASCADE;

CREATE VIEW user_organizations
WITH (security_invoker = true)
AS
SELECT
  o.id,
  o.name,
  o.slug,
  o.logo_url,
  o.plan,
  o.status,
  o.trial_ends_at,
  o.subscription_ends_at,
  o.max_users,
  o.max_projects,
  o.max_requisitions_per_month,
  o.stripe_customer_id,
  o.stripe_subscription_id,
  om.role as member_role,
  om.workflow_role,
  om.created_at as joined_at
FROM organizations o
JOIN organization_members om ON o.id = om.organization_id
WHERE om.user_id = auth.uid()
  AND om.is_active = true
  AND o.status IN ('active', 'trial');

COMMENT ON VIEW user_organizations IS
'Shows organizations for the current user with billing info and workflow role. Uses security_invoker - respects RLS.';

GRANT SELECT ON user_organizations TO authenticated;

-- =====================================================
-- STEP 4: Update helper functions to read from organization_members
-- =====================================================

-- Drop old functions (different signatures)
DROP FUNCTION IF EXISTS get_user_role();
DROP FUNCTION IF EXISTS is_super_admin();

-- New get_user_role: reads from organization_members.workflow_role
-- Falls back to users.role if no org membership found
CREATE OR REPLACE FUNCTION get_user_role(check_org_id UUID DEFAULT NULL)
RETURNS user_role
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_role user_role;
  v_org_id UUID;
BEGIN
  -- Use provided org_id, or fall back to user's default org
  v_org_id := COALESCE(check_org_id, (SELECT org_id FROM users WHERE id = (SELECT auth.uid())));

  -- Try org-scoped workflow_role first
  IF v_org_id IS NOT NULL THEN
    SELECT workflow_role INTO v_role
    FROM organization_members
    WHERE user_id = (SELECT auth.uid())
      AND organization_id = v_org_id
      AND is_active = true;

    IF v_role IS NOT NULL THEN
      RETURN v_role;
    END IF;
  END IF;

  -- Fallback to users.role (backwards compatibility during migration)
  SELECT role INTO v_role FROM users WHERE id = (SELECT auth.uid());
  RETURN COALESCE(v_role, 'submitter');
END;
$$;

-- New is_super_admin: delegates to get_user_role
CREATE OR REPLACE FUNCTION is_super_admin(check_org_id UUID DEFAULT NULL)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN get_user_role(check_org_id) = 'super_admin';
END;
$$;

-- =====================================================
-- STEP 5: Update RLS policies to pass org_id where available
-- These tables have org_id directly on the row
-- =====================================================

-- 5a. Requisitions: view policy
DROP POLICY IF EXISTS "Users can view own requisitions" ON requisitions;
CREATE POLICY "Users can view own requisitions"
  ON requisitions FOR SELECT
  TO authenticated
  USING (
    ((org_id IS NULL) OR user_belongs_to_org(org_id))
    AND (
      submitted_by = (SELECT auth.uid())
      OR user_is_org_admin(org_id)
      OR is_super_admin(org_id)
    )
  );

-- 5b. Requisitions: delete policy
DROP POLICY IF EXISTS "Users can delete requisitions" ON requisitions;
CREATE POLICY "Users can delete requisitions"
  ON requisitions FOR DELETE
  TO authenticated
  USING (
    is_super_admin(org_id)
    OR (
      (SELECT auth.uid()) = submitted_by
      AND status = 'draft'
    )
  );

-- 5c. Requisition items: view policy
DROP POLICY IF EXISTS "Users can view requisition items" ON requisition_items;
CREATE POLICY "Users can view requisition items"
  ON requisition_items FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM requisitions r
      WHERE r.id = requisition_items.requisition_id
      AND (
        r.submitted_by = (SELECT auth.uid())
        OR is_assigned_to_project(r.project_id)
        OR is_super_admin(r.org_id)
      )
    )
  );

-- 5d. Items: update policy
DROP POLICY IF EXISTS "Users can update items" ON items;
CREATE POLICY "Users can update items"
  ON items FOR UPDATE
  TO authenticated
  USING (
    user_belongs_to_org(org_id)
    AND (
      created_by = (SELECT auth.uid())
      OR user_is_org_admin(org_id)
      OR is_super_admin(org_id)
      OR get_user_role(org_id) = 'store_manager'
    )
  );

-- 5e. User project assignments: view policy
DROP POLICY IF EXISTS "Users can view project assignments" ON user_project_assignments;
CREATE POLICY "Users can view project assignments"
  ON user_project_assignments FOR SELECT
  TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    OR user_is_org_admin(org_id)
    OR is_super_admin(org_id)
  );

-- 5f. Comments: view policy (uses JOIN to requisitions for org_id)
DROP POLICY IF EXISTS "Users can view comments" ON comments;
CREATE POLICY "Users can view comments"
  ON comments FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM requisitions r
      WHERE r.id = comments.requisition_id
      AND (
        r.submitted_by = (SELECT auth.uid())
        OR is_assigned_to_project(r.project_id)
        OR is_super_admin(r.org_id)
      )
    )
  );

-- 5g. Attachments: view policy (uses JOIN to requisitions for org_id)
DROP POLICY IF EXISTS "Users can view attachments" ON attachments;
CREATE POLICY "Users can view attachments"
  ON attachments FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM requisitions r
      WHERE r.id = attachments.requisition_id
      AND (
        r.submitted_by = (SELECT auth.uid())
        OR is_assigned_to_project(r.project_id)
        OR is_super_admin(r.org_id)
      )
    )
  );

-- 5h. Purchase orders: view policy (uses JOIN to requisitions for org_id)
DROP POLICY IF EXISTS "Users can view purchase orders" ON purchase_orders;
CREATE POLICY "Users can view purchase orders"
  ON purchase_orders FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM requisitions r
      WHERE r.id = purchase_orders.requisition_id
      AND (
        r.submitted_by = (SELECT auth.uid())
        OR is_assigned_to_project(r.project_id)
        OR is_super_admin(r.org_id)
      )
    )
  );

-- 5i. PO items: view policy (uses JOIN to requisitions for org_id)
DROP POLICY IF EXISTS "Users can view PO items" ON po_items;
CREATE POLICY "Users can view PO items"
  ON po_items FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM purchase_orders po
      JOIN requisitions r ON r.id = po.requisition_id
      WHERE po.id = po_items.po_id
      AND (
        r.submitted_by = (SELECT auth.uid())
        OR is_assigned_to_project(r.project_id)
        OR is_super_admin(r.org_id)
      )
    )
  );

-- 5j. Receipt items: view policy (uses JOIN to requisitions for org_id)
DROP POLICY IF EXISTS "Users can view receipt items" ON receipt_items;
CREATE POLICY "Users can view receipt items"
  ON receipt_items FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM receipt_transactions rt
      JOIN purchase_orders po ON po.id = rt.po_id
      JOIN requisitions r ON r.id = po.requisition_id
      WHERE rt.id = receipt_items.receipt_id
      AND (
        r.submitted_by = (SELECT auth.uid())
        OR is_assigned_to_project(r.project_id)
        OR is_super_admin(r.org_id)
      )
    )
  );

-- 5k. Email notifications: view policy (currently uses users.role directly)
DROP POLICY IF EXISTS "Admins can view all email notifications" ON email_notifications;
CREATE POLICY "Admins can view all email notifications"
  ON email_notifications FOR SELECT
  TO authenticated
  USING (
    is_super_admin()  -- Uses default org fallback since email_notifications may not have org_id
  );

-- 5l. Fiscal year settings: update policy (currently uses users.role directly)
DROP POLICY IF EXISTS "Only admins can update fiscal year settings" ON fiscal_year_settings;
CREATE POLICY "Only admins can update fiscal year settings"
  ON fiscal_year_settings FOR UPDATE
  TO authenticated
  USING (
    is_super_admin()  -- Uses default org fallback
  );

-- =====================================================
-- STEP 6: Create helper function for updating workflow roles
-- =====================================================
CREATE OR REPLACE FUNCTION update_member_workflow_role(
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

  -- Update the workflow role
  UPDATE organization_members
  SET workflow_role = p_workflow_role,
      updated_at = NOW()
  WHERE organization_id = p_org_id
    AND user_id = p_user_id
    AND is_active = true;

  -- Also keep users.role in sync (backwards compatibility)
  UPDATE users
  SET role = p_workflow_role
  WHERE id = p_user_id;
END;
$$;

-- =====================================================
-- STEP 7: Verification
-- =====================================================
DO $$
DECLARE
  col_exists BOOLEAN;
  func_exists BOOLEAN;
  view_has_col BOOLEAN;
BEGIN
  -- Check column exists
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'organization_members'
      AND column_name = 'workflow_role'
  ) INTO col_exists;

  -- Check function exists with correct signature
  SELECT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public'
      AND p.proname = 'get_user_role'
  ) INTO func_exists;

  -- Check view has workflow_role
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_organizations'
      AND column_name = 'workflow_role'
  ) INTO view_has_col;

  IF col_exists AND func_exists AND view_has_col THEN
    RAISE NOTICE 'SUCCESS: Workflow role migration completed successfully';
  ELSE
    RAISE WARNING 'ISSUE: col=%, func=%, view=%', col_exists, func_exists, view_has_col;
  END IF;
END $$;

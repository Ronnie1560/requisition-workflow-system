-- Migration: JWT Claims Optimization for Multi-Tenant RLS
-- Date: 2026-02-21
--
-- This migration implements JWT-based org context for RLS policies,
-- eliminating per-row function calls to organization_members.
--
-- Changes:
--   1. Creates custom_access_token_hook() that injects org_id, org_role,
--      and workflow_role into JWT claims at token mint time.
--   2. Grants necessary permissions for the auth schema to call the hook.
--   3. Rewrites ALL RLS policies to use JWT claims instead of helper functions.
--   4. Keeps helper functions intact for non-RLS usage (triggers, app code).
--
-- IMPORTANT: After applying this migration, you must enable the custom
-- access token hook in Supabase Dashboard > Auth > Hooks.
-- =====================================================

BEGIN;

-- =====================================================
-- STEP 1: Custom Access Token Hook
-- =====================================================
-- This function is called by Supabase Auth every time a JWT is minted
-- (login, token refresh). It injects the user's active org context
-- into the token so RLS policies can evaluate without DB queries.

CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  claims jsonb;
  v_user_id uuid;
  v_org_id uuid;
  v_org_role text;
  v_workflow_role text;
  v_is_platform_admin boolean := false;
BEGIN
  -- Extract current claims and user_id
  claims := event->'claims';
  v_user_id := (event->>'user_id')::uuid;

  -- Check if user is a platform admin
  SELECT EXISTS (
    SELECT 1 FROM public.platform_admins pa
    WHERE pa.user_id = v_user_id AND pa.is_active = true
  ) INTO v_is_platform_admin;

  -- Get active org from user_metadata (set by frontend on org switch)
  -- This is the source of truth for which org the user is working in
  v_org_id := (event->'claims'->'user_metadata'->>'active_org_id')::uuid;

  -- If no active org in metadata, fall back to the user's first org
  IF v_org_id IS NULL THEN
    SELECT om.organization_id INTO v_org_id
    FROM public.organization_members om
    WHERE om.user_id = v_user_id AND om.is_active = true
    ORDER BY om.created_at ASC
    LIMIT 1;
  END IF;

  -- Get org role and workflow role for the active org
  IF v_org_id IS NOT NULL THEN
    SELECT om.role, om.workflow_role
    INTO v_org_role, v_workflow_role
    FROM public.organization_members om
    WHERE om.user_id = v_user_id
      AND om.organization_id = v_org_id
      AND om.is_active = true;

    -- If no membership found for this org, clear it
    IF v_org_role IS NULL THEN
      v_org_id := NULL;
    END IF;
  END IF;

  -- Inject claims into app_metadata (persisted across refreshes)
  claims := jsonb_set(
    claims,
    '{app_metadata}',
    COALESCE(claims->'app_metadata', '{}'::jsonb) ||
    jsonb_build_object(
      'org_id', v_org_id,
      'org_role', COALESCE(v_org_role, 'member'),
      'workflow_role', COALESCE(v_workflow_role, 'submitter'),
      'is_platform_admin', v_is_platform_admin
    )
  );

  -- Also set org_id at top level of claims for easy access
  claims := jsonb_set(claims, '{org_id}', to_jsonb(v_org_id));

  -- Return modified event
  event := jsonb_set(event, '{claims}', claims);
  RETURN event;
END;
$$;

-- Grant necessary permissions for the auth admin to call this hook
GRANT USAGE ON SCHEMA public TO supabase_auth_admin;
GRANT EXECUTE ON FUNCTION public.custom_access_token_hook TO supabase_auth_admin;

-- The hook needs to read these tables
GRANT SELECT ON TABLE public.organization_members TO supabase_auth_admin;
GRANT SELECT ON TABLE public.platform_admins TO supabase_auth_admin;

-- Revoke from anon/public for security
REVOKE EXECUTE ON FUNCTION public.custom_access_token_hook FROM authenticated, anon, public;

COMMENT ON FUNCTION public.custom_access_token_hook IS
  'Supabase Auth hook that injects org_id, org_role, workflow_role, '
  'and is_platform_admin into JWT claims at token mint time. '
  'Enable in Dashboard > Auth > Hooks > Custom Access Token.';

-- =====================================================
-- STEP 2: Helper expressions (stored as immutable functions for DRY)
-- =====================================================
-- These extract JWT claims once per query via subquery pattern.
-- They replace the old functions that queried organization_members per-row.

CREATE OR REPLACE FUNCTION public.jwt_org_id()
RETURNS uuid
LANGUAGE sql STABLE
SET search_path = ''
AS $$
  SELECT ((current_setting('request.jwt.claims', true)::jsonb)->'app_metadata'->>'org_id')::uuid;
$$;

CREATE OR REPLACE FUNCTION public.jwt_org_role()
RETURNS text
LANGUAGE sql STABLE
SET search_path = ''
AS $$
  SELECT (current_setting('request.jwt.claims', true)::jsonb)->'app_metadata'->>'org_role';
$$;

CREATE OR REPLACE FUNCTION public.jwt_workflow_role()
RETURNS text
LANGUAGE sql STABLE
SET search_path = ''
AS $$
  SELECT (current_setting('request.jwt.claims', true)::jsonb)->'app_metadata'->>'workflow_role';
$$;

CREATE OR REPLACE FUNCTION public.jwt_is_platform_admin()
RETURNS boolean
LANGUAGE sql STABLE
SET search_path = ''
AS $$
  SELECT COALESCE(
    ((current_setting('request.jwt.claims', true)::jsonb)->'app_metadata'->>'is_platform_admin')::boolean,
    false
  );
$$;

COMMENT ON FUNCTION public.jwt_org_id() IS 'Returns active org_id from JWT claims (set by custom_access_token_hook)';
COMMENT ON FUNCTION public.jwt_org_role() IS 'Returns org role (owner/admin/member) from JWT claims';
COMMENT ON FUNCTION public.jwt_workflow_role() IS 'Returns workflow role (submitter/reviewer/approver/store_manager/super_admin) from JWT claims';
COMMENT ON FUNCTION public.jwt_is_platform_admin() IS 'Returns whether user is a platform admin from JWT claims';

-- =====================================================
-- STEP 3: Rewrite ALL RLS policies to use JWT claims
-- =====================================================
-- Strategy:
--   user_belongs_to_org(org_id)  →  org_id = (SELECT jwt_org_id())
--   user_is_org_admin(org_id)    →  org_id = (SELECT jwt_org_id()) AND (SELECT jwt_org_role()) IN ('owner','admin')
--   is_super_admin(org_id)       →  org_id = (SELECT jwt_org_id()) AND (SELECT jwt_workflow_role()) = 'super_admin'
--   get_user_role(org_id)        →  (SELECT jwt_workflow_role())
--   is_platform_admin()          →  (SELECT jwt_is_platform_admin())
--   is_assigned_to_project(pid)  →  EXISTS(SELECT 1 FROM user_project_assignments WHERE ...) [unchanged, already indexed]

-- ----- approval_workflows -----
DROP POLICY IF EXISTS "Admins can create approval workflows" ON approval_workflows;
DROP POLICY IF EXISTS "Admins can delete approval workflows" ON approval_workflows;

CREATE POLICY "Admins can create approval workflows"
  ON approval_workflows FOR INSERT TO authenticated
  WITH CHECK (
    org_id = (SELECT public.jwt_org_id())
    AND (SELECT public.jwt_org_role()) IN ('owner', 'admin')
  );

CREATE POLICY "Admins can delete approval workflows"
  ON approval_workflows FOR DELETE TO authenticated
  USING (
    org_id = (SELECT public.jwt_org_id())
    AND (SELECT public.jwt_org_role()) IN ('owner', 'admin')
  );

-- ----- attachments (no org_id — uses parent requisition) -----
DROP POLICY IF EXISTS "Users can view attachments" ON attachments;
DROP POLICY IF EXISTS "Users can update own attachments" ON attachments;
DROP POLICY IF EXISTS "Users can delete own attachments" ON attachments;

CREATE POLICY "Users can view attachments"
  ON attachments FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM requisitions r
      WHERE r.id = attachments.requisition_id
      AND r.org_id = (SELECT public.jwt_org_id())
      AND (
        r.submitted_by = (SELECT auth.uid())
        OR EXISTS (
          SELECT 1 FROM user_project_assignments upa
          WHERE upa.project_id = r.project_id
            AND upa.user_id = (SELECT auth.uid())
            AND upa.is_active = true
        )
        OR (SELECT public.jwt_workflow_role()) = 'super_admin'
      )
    )
  );

CREATE POLICY "Users can update own attachments"
  ON attachments FOR UPDATE TO authenticated
  USING (
    uploaded_by = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1 FROM requisitions r
      WHERE r.id = attachments.requisition_id
      AND r.org_id = (SELECT public.jwt_org_id())
    )
  )
  WITH CHECK (uploaded_by = (SELECT auth.uid()));

CREATE POLICY "Users can delete own attachments"
  ON attachments FOR DELETE TO authenticated
  USING (uploaded_by = (SELECT auth.uid()));

-- ----- billing_history -----
DROP POLICY IF EXISTS "billing_history_select" ON billing_history;
DROP POLICY IF EXISTS "Platform admins can view all billing history" ON billing_history;

CREATE POLICY "Org admins can view billing history"
  ON billing_history FOR SELECT TO authenticated
  USING (
    (organization_id = (SELECT public.jwt_org_id()) AND (SELECT public.jwt_org_role()) IN ('owner', 'admin'))
    OR (SELECT public.jwt_is_platform_admin())
  );

-- ----- categories -----
DROP POLICY IF EXISTS "Admins can create categories" ON categories;
DROP POLICY IF EXISTS "Admins can update categories" ON categories;
DROP POLICY IF EXISTS "Admins can delete categories" ON categories;

CREATE POLICY "Admins can create categories"
  ON categories FOR INSERT TO authenticated
  WITH CHECK (
    org_id = (SELECT public.jwt_org_id())
    AND (SELECT public.jwt_org_role()) IN ('owner', 'admin')
  );

CREATE POLICY "Admins can update categories"
  ON categories FOR UPDATE TO authenticated
  USING (
    org_id = (SELECT public.jwt_org_id())
    AND (SELECT public.jwt_org_role()) IN ('owner', 'admin')
  );

CREATE POLICY "Admins can delete categories"
  ON categories FOR DELETE TO authenticated
  USING (
    org_id = (SELECT public.jwt_org_id())
    AND (SELECT public.jwt_org_role()) IN ('owner', 'admin')
  );

-- ----- comments (no org_id — uses parent requisition) -----
DROP POLICY IF EXISTS "Users can view comments" ON comments;
DROP POLICY IF EXISTS "Users can add comments" ON comments;
DROP POLICY IF EXISTS "Users can update own comments" ON comments;
DROP POLICY IF EXISTS "Users can delete own comments" ON comments;

CREATE POLICY "Users can view comments"
  ON comments FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM requisitions r
      WHERE r.id = comments.requisition_id
      AND r.org_id = (SELECT public.jwt_org_id())
      AND (
        r.submitted_by = (SELECT auth.uid())
        OR EXISTS (
          SELECT 1 FROM user_project_assignments upa
          WHERE upa.project_id = r.project_id
            AND upa.user_id = (SELECT auth.uid())
            AND upa.is_active = true
        )
        OR (SELECT public.jwt_workflow_role()) = 'super_admin'
      )
    )
  );

CREATE POLICY "Users can add comments"
  ON comments FOR INSERT TO authenticated
  WITH CHECK (
    user_id = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1 FROM requisitions r
      WHERE r.id = comments.requisition_id
      AND r.org_id = (SELECT public.jwt_org_id())
      AND (
        r.submitted_by = (SELECT auth.uid())
        OR EXISTS (
          SELECT 1 FROM user_project_assignments upa
          WHERE upa.project_id = r.project_id
            AND upa.user_id = (SELECT auth.uid())
            AND upa.is_active = true
        )
        OR (SELECT public.jwt_workflow_role()) = 'super_admin'
      )
    )
  );

CREATE POLICY "Users can update own comments"
  ON comments FOR UPDATE TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY "Users can delete own comments"
  ON comments FOR DELETE TO authenticated
  USING (user_id = (SELECT auth.uid()));

-- ----- email_notifications -----
DROP POLICY IF EXISTS "Admins can view all email notifications" ON email_notifications;

CREATE POLICY "Admins can view all email notifications"
  ON email_notifications FOR SELECT TO authenticated
  USING (
    (SELECT public.jwt_workflow_role()) = 'super_admin'
    OR (SELECT public.jwt_is_platform_admin())
  );

-- ----- expense_accounts -----
DROP POLICY IF EXISTS "Admins can create expense accounts" ON expense_accounts;
DROP POLICY IF EXISTS "Admins can update expense accounts" ON expense_accounts;
DROP POLICY IF EXISTS "Admins can delete expense accounts" ON expense_accounts;

CREATE POLICY "Admins can create expense accounts"
  ON expense_accounts FOR INSERT TO authenticated
  WITH CHECK (
    org_id = (SELECT public.jwt_org_id())
    AND (SELECT public.jwt_org_role()) IN ('owner', 'admin')
  );

CREATE POLICY "Admins can update expense accounts"
  ON expense_accounts FOR UPDATE TO authenticated
  USING (
    org_id = (SELECT public.jwt_org_id())
    AND (SELECT public.jwt_org_role()) IN ('owner', 'admin')
  );

CREATE POLICY "Admins can delete expense accounts"
  ON expense_accounts FOR DELETE TO authenticated
  USING (
    org_id = (SELECT public.jwt_org_id())
    AND (SELECT public.jwt_org_role()) IN ('owner', 'admin')
  );

-- ----- fiscal_year_settings -----
DROP POLICY IF EXISTS "Only admins can update fiscal year settings" ON fiscal_year_settings;

CREATE POLICY "Only admins can update fiscal year settings"
  ON fiscal_year_settings FOR UPDATE TO authenticated
  USING (
    org_id = (SELECT public.jwt_org_id())
    AND (
      (SELECT public.jwt_workflow_role()) = 'super_admin'
      OR (SELECT public.jwt_org_role()) IN ('owner', 'admin')
    )
  );

-- ----- items -----
DROP POLICY IF EXISTS "Users can update items" ON items;

CREATE POLICY "Users can update items"
  ON items FOR UPDATE TO authenticated
  USING (
    org_id = (SELECT public.jwt_org_id())
    AND (
      created_by = (SELECT auth.uid())
      OR (SELECT public.jwt_org_role()) IN ('owner', 'admin')
      OR (SELECT public.jwt_workflow_role()) IN ('super_admin', 'store_manager')
    )
  );

-- ----- notifications -----
DROP POLICY IF EXISTS "Users can view their org notifications" ON notifications;
DROP POLICY IF EXISTS "Users can update their own notifications" ON notifications;
DROP POLICY IF EXISTS "Users can delete their own notifications" ON notifications;

CREATE POLICY "Users can view their org notifications"
  ON notifications FOR SELECT TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    AND (org_id IS NULL OR org_id = (SELECT public.jwt_org_id()))
  );

CREATE POLICY "Users can update their own notifications"
  ON notifications FOR UPDATE TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    AND org_id = (SELECT public.jwt_org_id())
  );

CREATE POLICY "Users can delete their own notifications"
  ON notifications FOR DELETE TO authenticated
  USING (
    org_id = (SELECT public.jwt_org_id())
    AND (
      user_id = (SELECT auth.uid())
      OR (SELECT public.jwt_org_role()) IN ('owner', 'admin')
    )
  );

-- ----- organization_members -----
DROP POLICY IF EXISTS "Admins can update org members" ON organization_members;
DROP POLICY IF EXISTS "Platform admins can view all org members" ON organization_members;

CREATE POLICY "Admins can update org members"
  ON organization_members FOR UPDATE TO authenticated
  USING (
    organization_id = (SELECT public.jwt_org_id())
    AND (SELECT public.jwt_org_role()) IN ('owner', 'admin')
    AND (role <> 'owner' OR user_id = (SELECT auth.uid()))
  );

CREATE POLICY "Platform admins can view all org members"
  ON organization_members FOR SELECT TO authenticated
  USING ((SELECT public.jwt_is_platform_admin()));

-- ----- organizations -----
DROP POLICY IF EXISTS "Platform admins can view all organizations" ON organizations;
DROP POLICY IF EXISTS "Platform admins can update any organization" ON organizations;

CREATE POLICY "Platform admins can view all organizations"
  ON organizations FOR SELECT TO authenticated
  USING ((SELECT public.jwt_is_platform_admin()));

CREATE POLICY "Platform admins can update any organization"
  ON organizations FOR UPDATE TO authenticated
  USING ((SELECT public.jwt_is_platform_admin()));

-- ----- platform_admin_sessions -----
DROP POLICY IF EXISTS "platform_admins_manage_sessions" ON platform_admin_sessions;

CREATE POLICY "platform_admins_manage_sessions"
  ON platform_admin_sessions FOR ALL
  USING ((SELECT public.jwt_is_platform_admin()));

-- ----- platform_admins -----
DROP POLICY IF EXISTS "Platform admins can view all admins" ON platform_admins;

CREATE POLICY "Platform admins can view all admins"
  ON platform_admins FOR SELECT TO authenticated
  USING ((SELECT public.jwt_is_platform_admin()));

-- ----- platform_announcements -----
DROP POLICY IF EXISTS "Platform admins can manage announcements" ON platform_announcements;
-- Keep "All users can view published announcements" as-is (no org check needed)

CREATE POLICY "Platform admins can manage announcements"
  ON platform_announcements FOR ALL TO authenticated
  USING ((SELECT public.jwt_is_platform_admin()));

-- ----- platform_audit_log -----
DROP POLICY IF EXISTS "Platform admins can view audit log" ON platform_audit_log;
DROP POLICY IF EXISTS "Platform admins can insert audit log" ON platform_audit_log;

CREATE POLICY "Platform admins can view audit log"
  ON platform_audit_log FOR SELECT TO authenticated
  USING ((SELECT public.jwt_is_platform_admin()));

CREATE POLICY "Platform admins can insert audit log"
  ON platform_audit_log FOR INSERT TO authenticated
  WITH CHECK ((SELECT public.jwt_is_platform_admin()));

-- ----- platform_feedback -----
-- Keep "Users can create feedback" and "Users can view all feedback" as-is (simple auth.uid() checks)
DROP POLICY IF EXISTS "Platform admins can update feedback" ON platform_feedback;

CREATE POLICY "Platform admins can update feedback"
  ON platform_feedback FOR UPDATE TO authenticated
  USING ((SELECT public.jwt_is_platform_admin()));

-- ----- platform_login_attempts -----
DROP POLICY IF EXISTS "platform_admins_read_login_attempts" ON platform_login_attempts;
-- Keep "anyone_can_insert_login_attempts" as-is

CREATE POLICY "platform_admins_read_login_attempts"
  ON platform_login_attempts FOR SELECT
  USING ((SELECT public.jwt_is_platform_admin()));

-- ----- po_items -----
DROP POLICY IF EXISTS "Users can view PO items" ON po_items;

CREATE POLICY "Users can view PO items"
  ON po_items FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM purchase_orders po
      JOIN requisitions r ON r.id = po.requisition_id
      WHERE po.id = po_items.po_id
      AND r.org_id = (SELECT public.jwt_org_id())
      AND (
        r.submitted_by = (SELECT auth.uid())
        OR EXISTS (
          SELECT 1 FROM user_project_assignments upa
          WHERE upa.project_id = r.project_id
            AND upa.user_id = (SELECT auth.uid())
            AND upa.is_active = true
        )
        OR (SELECT public.jwt_workflow_role()) = 'super_admin'
      )
    )
  );

-- ----- projects -----
DROP POLICY IF EXISTS "Admins can create projects" ON projects;
DROP POLICY IF EXISTS "Admins can update projects" ON projects;
DROP POLICY IF EXISTS "Admins can delete projects" ON projects;

CREATE POLICY "Admins can create projects"
  ON projects FOR INSERT TO authenticated
  WITH CHECK (
    org_id = (SELECT public.jwt_org_id())
    AND (SELECT public.jwt_org_role()) IN ('owner', 'admin')
  );

CREATE POLICY "Admins can update projects"
  ON projects FOR UPDATE TO authenticated
  USING (
    org_id = (SELECT public.jwt_org_id())
    AND (SELECT public.jwt_org_role()) IN ('owner', 'admin')
  );

CREATE POLICY "Admins can delete projects"
  ON projects FOR DELETE TO authenticated
  USING (
    org_id = (SELECT public.jwt_org_id())
    AND (SELECT public.jwt_org_role()) IN ('owner', 'admin')
  );

-- ----- purchase_orders -----
DROP POLICY IF EXISTS "Users can view purchase orders" ON purchase_orders;

CREATE POLICY "Users can view purchase orders"
  ON purchase_orders FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM requisitions r
      WHERE r.id = purchase_orders.requisition_id
      AND r.org_id = (SELECT public.jwt_org_id())
      AND (
        r.submitted_by = (SELECT auth.uid())
        OR EXISTS (
          SELECT 1 FROM user_project_assignments upa
          WHERE upa.project_id = r.project_id
            AND upa.user_id = (SELECT auth.uid())
            AND upa.is_active = true
        )
        OR (SELECT public.jwt_workflow_role()) = 'super_admin'
      )
    )
  );

-- ----- receipt_items -----
DROP POLICY IF EXISTS "Users can view receipt items" ON receipt_items;

CREATE POLICY "Users can view receipt items"
  ON receipt_items FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM receipt_transactions rt
      JOIN purchase_orders po ON po.id = rt.po_id
      JOIN requisitions r ON r.id = po.requisition_id
      WHERE rt.id = receipt_items.receipt_id
      AND r.org_id = (SELECT public.jwt_org_id())
      AND (
        r.submitted_by = (SELECT auth.uid())
        OR EXISTS (
          SELECT 1 FROM user_project_assignments upa
          WHERE upa.project_id = r.project_id
            AND upa.user_id = (SELECT auth.uid())
            AND upa.is_active = true
        )
        OR (SELECT public.jwt_workflow_role()) = 'super_admin'
      )
    )
  );

-- ----- requisition_items -----
DROP POLICY IF EXISTS "Users can view requisition items" ON requisition_items;
DROP POLICY IF EXISTS "Users can update requisition items" ON requisition_items;
DROP POLICY IF EXISTS "Users can delete requisition items" ON requisition_items;

CREATE POLICY "Users can view requisition items"
  ON requisition_items FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM requisitions r
      WHERE r.id = requisition_items.requisition_id
      AND r.org_id = (SELECT public.jwt_org_id())
      AND (
        r.submitted_by = (SELECT auth.uid())
        OR EXISTS (
          SELECT 1 FROM user_project_assignments upa
          WHERE upa.project_id = r.project_id
            AND upa.user_id = (SELECT auth.uid())
            AND upa.is_active = true
        )
        OR (SELECT public.jwt_workflow_role()) = 'super_admin'
      )
    )
  );

CREATE POLICY "Users can update requisition items"
  ON requisition_items FOR UPDATE TO authenticated
  USING (
    org_id = (SELECT public.jwt_org_id())
    AND (
      EXISTS (
        SELECT 1 FROM requisitions r
        WHERE r.id = requisition_items.requisition_id
        AND r.submitted_by = (SELECT auth.uid())
      )
      OR (SELECT public.jwt_org_role()) IN ('owner', 'admin')
    )
  );

CREATE POLICY "Users can delete requisition items"
  ON requisition_items FOR DELETE TO authenticated
  USING (
    org_id = (SELECT public.jwt_org_id())
    AND (
      EXISTS (
        SELECT 1 FROM requisitions r
        WHERE r.id = requisition_items.requisition_id
        AND r.submitted_by = (SELECT auth.uid())
      )
      OR (SELECT public.jwt_org_role()) IN ('owner', 'admin')
    )
  );

-- ----- requisition_template_items (no org_id — uses parent template) -----
-- These only check ownership via parent template — no org function calls to replace.
-- Keeping as-is (pure auth.uid() checks).

-- ----- requisition_templates -----
DROP POLICY IF EXISTS "Users can view own templates" ON requisition_templates;

CREATE POLICY "Users can view own templates"
  ON requisition_templates FOR SELECT TO authenticated
  USING (
    created_by = (SELECT auth.uid())
    OR (org_id IS NOT NULL AND org_id = (SELECT public.jwt_org_id()))
  );
-- UPDATE and DELETE policies only check created_by = auth.uid(), no change needed.

-- ----- requisitions -----
DROP POLICY IF EXISTS "Users can view own requisitions" ON requisitions;
DROP POLICY IF EXISTS "Users can update own requisitions" ON requisitions;
DROP POLICY IF EXISTS "Users can delete requisitions" ON requisitions;

CREATE POLICY "Users can view own requisitions"
  ON requisitions FOR SELECT TO authenticated
  USING (
    (org_id IS NULL OR org_id = (SELECT public.jwt_org_id()))
    AND (
      submitted_by = (SELECT auth.uid())
      OR (SELECT public.jwt_org_role()) IN ('owner', 'admin')
      OR (SELECT public.jwt_workflow_role()) = 'super_admin'
    )
  );

CREATE POLICY "Users can update own requisitions"
  ON requisitions FOR UPDATE TO authenticated
  USING (
    (org_id IS NULL OR org_id = (SELECT public.jwt_org_id()))
    AND (
      submitted_by = (SELECT auth.uid())
      OR (SELECT public.jwt_org_role()) IN ('owner', 'admin')
    )
  );

CREATE POLICY "Users can delete requisitions"
  ON requisitions FOR DELETE TO authenticated
  USING (
    (SELECT public.jwt_workflow_role()) = 'super_admin'
    OR (
      (SELECT auth.uid()) = submitted_by
      AND status = 'draft'
    )
  );

-- ----- uom_types -----
DROP POLICY IF EXISTS "Users can view uom types" ON uom_types;
DROP POLICY IF EXISTS "Admins can create uom types" ON uom_types;
DROP POLICY IF EXISTS "Admins can update uom types" ON uom_types;
DROP POLICY IF EXISTS "Admins can delete uom types" ON uom_types;

CREATE POLICY "Users can view uom types"
  ON uom_types FOR SELECT TO authenticated
  USING (
    org_id = (SELECT public.jwt_org_id())
  );

CREATE POLICY "Admins can create uom types"
  ON uom_types FOR INSERT TO authenticated
  WITH CHECK (
    org_id = (SELECT public.jwt_org_id())
    AND (SELECT public.jwt_org_role()) IN ('owner', 'admin')
  );

CREATE POLICY "Admins can update uom types"
  ON uom_types FOR UPDATE TO authenticated
  USING (
    org_id = (SELECT public.jwt_org_id())
    AND (SELECT public.jwt_org_role()) IN ('owner', 'admin')
  );

CREATE POLICY "Admins can delete uom types"
  ON uom_types FOR DELETE TO authenticated
  USING (
    org_id = (SELECT public.jwt_org_id())
    AND (SELECT public.jwt_org_role()) IN ('owner', 'admin')
  );

-- ----- user_project_assignments -----
DROP POLICY IF EXISTS "Users can view project assignments" ON user_project_assignments;

CREATE POLICY "Users can view project assignments"
  ON user_project_assignments FOR SELECT TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    OR (
      org_id = (SELECT public.jwt_org_id())
      AND (SELECT public.jwt_org_role()) IN ('owner', 'admin')
    )
    OR (SELECT public.jwt_workflow_role()) = 'super_admin'
  );

-- ----- users -----
DROP POLICY IF EXISTS "Platform admins can view all users" ON users;

CREATE POLICY "Platform admins can view all users"
  ON users FOR SELECT TO authenticated
  USING ((SELECT public.jwt_is_platform_admin()));

-- =====================================================
-- STEP 4: Also update get_current_org_id to read from new JWT path
-- =====================================================
-- The hook writes to app_metadata.org_id. Update the trigger's
-- JWT reader to check both paths (backward compat during rollout).

CREATE OR REPLACE FUNCTION get_current_org_id()
RETURNS UUID AS $$
DECLARE
  v_org_id UUID;
BEGIN
  -- Try app_metadata path (new hook)
  v_org_id := ((current_setting('request.jwt.claims', true)::jsonb)->'app_metadata'->>'org_id')::UUID;

  IF v_org_id IS NOT NULL THEN
    RETURN v_org_id;
  END IF;

  -- Try top-level claims path (legacy / backward compat)
  v_org_id := (current_setting('request.jwt.claims', true)::json->>'org_id')::UUID;

  RETURN v_org_id;  -- NULL if not present
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE
SET search_path = '';

-- =====================================================
-- STEP 5: Remaining policies (from earlier migrations)
-- =====================================================

-- ----- approval_workflows -----
DROP POLICY IF EXISTS "Users can view org workflows" ON approval_workflows;
DROP POLICY IF EXISTS "Admins can update approval workflows" ON approval_workflows;

CREATE POLICY "Users can view org workflows"
  ON approval_workflows FOR SELECT TO authenticated
  USING (org_id = (SELECT public.jwt_org_id()));

CREATE POLICY "Admins can update approval workflows"
  ON approval_workflows FOR UPDATE TO authenticated
  USING (
    org_id = (SELECT public.jwt_org_id())
    AND (SELECT public.jwt_org_role()) IN ('owner', 'admin')
  );

-- ----- categories -----
DROP POLICY IF EXISTS "Users can view categories" ON categories;

CREATE POLICY "Users can view categories"
  ON categories FOR SELECT TO authenticated
  USING (org_id = (SELECT public.jwt_org_id()));

-- ----- expense_accounts -----
DROP POLICY IF EXISTS "Users can view org expense accounts" ON expense_accounts;

CREATE POLICY "Users can view org expense accounts"
  ON expense_accounts FOR SELECT TO authenticated
  USING (org_id = (SELECT public.jwt_org_id()));

-- ----- fiscal_year_settings -----
DROP POLICY IF EXISTS "Users can view fiscal year settings" ON fiscal_year_settings;

CREATE POLICY "Users can view fiscal year settings"
  ON fiscal_year_settings FOR SELECT TO authenticated
  USING (
    org_id IS NULL
    OR org_id = (SELECT public.jwt_org_id())
  );

-- ----- items -----
DROP POLICY IF EXISTS "Users can view items" ON items;
DROP POLICY IF EXISTS "Members can create items in their org" ON items;
DROP POLICY IF EXISTS "Admins can delete items" ON items;

CREATE POLICY "Users can view items"
  ON items FOR SELECT TO authenticated
  USING (org_id = (SELECT public.jwt_org_id()));

CREATE POLICY "Members can create items in their org"
  ON items FOR INSERT TO authenticated
  WITH CHECK (org_id = (SELECT public.jwt_org_id()));

CREATE POLICY "Admins can delete items"
  ON items FOR DELETE TO authenticated
  USING (
    org_id = (SELECT public.jwt_org_id())
    AND (SELECT public.jwt_org_role()) IN ('owner', 'admin')
  );

-- ----- notifications -----
DROP POLICY IF EXISTS "System can create notifications" ON notifications;

CREATE POLICY "System can create notifications"
  ON notifications FOR INSERT TO authenticated
  WITH CHECK (
    org_id IS NULL
    OR org_id = (SELECT public.jwt_org_id())
  );

-- ----- organization_members -----
DROP POLICY IF EXISTS "Users can view org members" ON organization_members;
DROP POLICY IF EXISTS "Admins can add org members" ON organization_members;
DROP POLICY IF EXISTS "Admins can remove org members" ON organization_members;

CREATE POLICY "Users can view org members"
  ON organization_members FOR SELECT TO authenticated
  USING (
    organization_id = (SELECT public.jwt_org_id())
    OR (SELECT public.jwt_is_platform_admin())
  );

CREATE POLICY "Admins can add org members"
  ON organization_members FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = (SELECT public.jwt_org_id())
    AND (SELECT public.jwt_org_role()) IN ('owner', 'admin')
  );

CREATE POLICY "Admins can remove org members"
  ON organization_members FOR DELETE TO authenticated
  USING (
    organization_id = (SELECT public.jwt_org_id())
    AND (SELECT public.jwt_org_role()) IN ('owner', 'admin')
  );

-- ----- organization_settings -----
DROP POLICY IF EXISTS "Users can view their org settings" ON organization_settings;
DROP POLICY IF EXISTS "Admins can create org settings" ON organization_settings;
DROP POLICY IF EXISTS "Admins can update org settings" ON organization_settings;
DROP POLICY IF EXISTS "Admins can delete org settings" ON organization_settings;

CREATE POLICY "Users can view their org settings"
  ON organization_settings FOR SELECT TO authenticated
  USING (
    org_id IS NULL
    OR org_id = (SELECT public.jwt_org_id())
  );

CREATE POLICY "Admins can create org settings"
  ON organization_settings FOR INSERT TO authenticated
  WITH CHECK (
    org_id = (SELECT public.jwt_org_id())
    AND (SELECT public.jwt_org_role()) IN ('owner', 'admin')
  );

CREATE POLICY "Admins can update org settings"
  ON organization_settings FOR UPDATE TO authenticated
  USING (
    org_id = (SELECT public.jwt_org_id())
    AND (SELECT public.jwt_org_role()) IN ('owner', 'admin')
  );

CREATE POLICY "Admins can delete org settings"
  ON organization_settings FOR DELETE TO authenticated
  USING (
    org_id = (SELECT public.jwt_org_id())
    AND (SELECT public.jwt_org_role()) IN ('owner', 'admin')
  );

-- ----- organizations -----
DROP POLICY IF EXISTS "Users can view their organizations" ON organizations;

CREATE POLICY "Users can view their organizations"
  ON organizations FOR SELECT TO authenticated
  USING (
    id = (SELECT public.jwt_org_id())
    OR (SELECT public.jwt_is_platform_admin())
  );

-- ----- projects -----
DROP POLICY IF EXISTS "Users can view org projects" ON projects;

CREATE POLICY "Users can view org projects"
  ON projects FOR SELECT TO authenticated
  USING (
    org_id IS NULL
    OR org_id = (SELECT public.jwt_org_id())
  );

-- ----- requisition_items -----
DROP POLICY IF EXISTS "Users can insert requisition items" ON requisition_items;

CREATE POLICY "Users can insert requisition items"
  ON requisition_items FOR INSERT TO authenticated
  WITH CHECK (
    org_id = (SELECT public.jwt_org_id())
  );

-- ----- requisition_templates -----
DROP POLICY IF EXISTS "Users can create own templates" ON requisition_templates;

CREATE POLICY "Users can create own templates"
  ON requisition_templates FOR INSERT TO authenticated
  WITH CHECK (
    created_by = (SELECT auth.uid())
    AND org_id = (SELECT public.jwt_org_id())
  );

-- ----- requisitions -----
DROP POLICY IF EXISTS "Users can create requisitions" ON requisitions;

CREATE POLICY "Users can create requisitions"
  ON requisitions FOR INSERT TO authenticated
  WITH CHECK (
    submitted_by = (SELECT auth.uid())
    AND org_id = (SELECT public.jwt_org_id())
  );

-- ----- user_project_assignments -----
DROP POLICY IF EXISTS "Super admins can create project assignments" ON user_project_assignments;
DROP POLICY IF EXISTS "Super admins can delete project assignments" ON user_project_assignments;
DROP POLICY IF EXISTS "Super admins can update project assignments" ON user_project_assignments;

CREATE POLICY "Admins can create project assignments"
  ON user_project_assignments FOR INSERT TO authenticated
  WITH CHECK (
    org_id = (SELECT public.jwt_org_id())
    AND (SELECT public.jwt_org_role()) IN ('owner', 'admin')
  );

CREATE POLICY "Admins can delete project assignments"
  ON user_project_assignments FOR DELETE TO authenticated
  USING (
    org_id = (SELECT public.jwt_org_id())
    AND (SELECT public.jwt_org_role()) IN ('owner', 'admin')
  );

CREATE POLICY "Admins can update project assignments"
  ON user_project_assignments FOR UPDATE TO authenticated
  USING (
    org_id = (SELECT public.jwt_org_id())
    AND (SELECT public.jwt_org_role()) IN ('owner', 'admin')
  );

-- =====================================================
-- STEP 6: Verification
-- =====================================================
DO $$
DECLARE
  policy_count integer;
  old_fn_count integer;
BEGIN
  -- Count policies that still reference old helper functions
  SELECT COUNT(*) INTO old_fn_count
  FROM pg_policies
  WHERE schemaname = 'public'
    AND (
      qual ILIKE '%user_belongs_to_org%'
      OR qual ILIKE '%user_is_org_admin%'
      OR with_check ILIKE '%user_belongs_to_org%'
      OR with_check ILIKE '%user_is_org_admin%'
    );

  IF old_fn_count > 0 THEN
    RAISE WARNING 'Found % policies still using old helper functions. These should be migrated.', old_fn_count;
  ELSE
    RAISE NOTICE 'All policies migrated to JWT claims successfully.';
  END IF;

  -- Count total policies using new jwt_ functions
  SELECT COUNT(*) INTO policy_count
  FROM pg_policies
  WHERE schemaname = 'public'
    AND (
      qual ILIKE '%jwt_org_id%'
      OR qual ILIKE '%jwt_org_role%'
      OR qual ILIKE '%jwt_workflow_role%'
      OR qual ILIKE '%jwt_is_platform_admin%'
      OR with_check ILIKE '%jwt_org_id%'
      OR with_check ILIKE '%jwt_org_role%'
    );

  RAISE NOTICE 'Total policies using JWT claims: %', policy_count;

  -- Verify hook function exists
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'custom_access_token_hook' AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')) THEN
    RAISE NOTICE 'VERIFIED: custom_access_token_hook function exists.';
  ELSE
    RAISE WARNING 'custom_access_token_hook function NOT FOUND!';
  END IF;
END $$;

COMMIT;

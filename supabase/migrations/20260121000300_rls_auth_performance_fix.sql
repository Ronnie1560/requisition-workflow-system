-- =====================================================
-- RLS Auth Performance & Security Fix
-- 
-- Fixes TWO issues:
-- 1. SECURITY: Functions with mutable search_path (add SET search_path = '')
-- 2. PERFORMANCE: auth.<function>() calls re-evaluated for each row
--    (wrap in subquery for single evaluation)
-- =====================================================

-- =====================================================
-- STEP 1: Fix Helper Functions from 20241213_rls_policies.sql
-- Add search_path fix + auth.uid() optimization + STABLE marker
-- =====================================================

-- Function to get current user's role (FIXED)
CREATE OR REPLACE FUNCTION get_user_role()
RETURNS user_role AS $$
  SELECT role FROM public.users WHERE id = (SELECT auth.uid());
$$ LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = '';

-- Function to check if user is super admin (FIXED)
CREATE OR REPLACE FUNCTION is_super_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = (SELECT auth.uid()) AND role = 'super_admin'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = '';

-- Function to check if user has role in a project (FIXED)
CREATE OR REPLACE FUNCTION has_project_role(project_uuid UUID, required_role user_role)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_project_assignments
    WHERE user_id = (SELECT auth.uid())
      AND project_id = project_uuid
      AND role = required_role
      AND is_active = true
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = '';

-- Function to check if user is assigned to a project (FIXED)
CREATE OR REPLACE FUNCTION is_assigned_to_project(project_uuid UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_project_assignments
    WHERE user_id = (SELECT auth.uid())
      AND project_id = project_uuid
      AND is_active = true
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = '';

-- Function to check if user owns a requisition (FIXED)
CREATE OR REPLACE FUNCTION owns_requisition(req_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.requisitions
    WHERE id = req_id AND submitted_by = (SELECT auth.uid())
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = '';

-- Function to check if user can review requisition (FIXED)
CREATE OR REPLACE FUNCTION can_review_requisition(req_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.requisitions r
    INNER JOIN public.user_project_assignments upa
      ON upa.project_id = r.project_id
    WHERE r.id = req_id
      AND upa.user_id = (SELECT auth.uid())
      AND upa.role IN ('reviewer', 'approver', 'super_admin')
      AND upa.is_active = true
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = '';

-- Function to check if user can approve requisition (FIXED)
CREATE OR REPLACE FUNCTION can_approve_requisition(req_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.requisitions r
    INNER JOIN public.user_project_assignments upa
      ON upa.project_id = r.project_id
    WHERE r.id = req_id
      AND upa.user_id = (SELECT auth.uid())
      AND upa.role IN ('approver', 'super_admin')
      AND upa.is_active = true
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = '';

-- =====================================================
-- STEP 2: Fix Multi-Tenancy Helper Functions
-- =====================================================

-- Function to check if user belongs to an organization (FIXED)
CREATE OR REPLACE FUNCTION user_belongs_to_org(check_org_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE organization_id = check_org_id
      AND user_id = (SELECT auth.uid())
      AND is_active = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE
SET search_path = '';

-- Function to check if user is org admin/owner (FIXED)
CREATE OR REPLACE FUNCTION user_is_org_admin(check_org_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE organization_id = check_org_id
      AND user_id = (SELECT auth.uid())
      AND role IN ('owner', 'admin')
      AND is_active = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE
SET search_path = '';

-- Function to check if user is org owner (FIXED)
CREATE OR REPLACE FUNCTION user_is_org_owner(check_org_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE organization_id = check_org_id
      AND user_id = (SELECT auth.uid())
      AND role = 'owner'
      AND is_active = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE
SET search_path = '';

-- =====================================================
-- STEP 3: Fix RLS Policies with auth.uid() performance issues
-- =====================================================

-- Fix: Admins can update members (but not owners)
DROP POLICY IF EXISTS "Admins can update org members" ON organization_members;
CREATE POLICY "Admins can update org members"
  ON organization_members FOR UPDATE TO authenticated
  USING (
    user_is_org_admin(organization_id)
    AND (role != 'owner' OR user_id = (SELECT auth.uid()))
  );

-- Fix: Users can update own requisitions
DROP POLICY IF EXISTS "Users can update own requisitions" ON requisitions;
DROP POLICY IF EXISTS "Users can update own draft requisitions" ON requisitions;
DROP POLICY IF EXISTS "Users can update requisitions" ON requisitions;

CREATE POLICY "Users can update own requisitions"
  ON requisitions FOR UPDATE TO authenticated
  USING (
    (org_id IS NULL OR user_belongs_to_org(org_id))
    AND (submitted_by = (SELECT auth.uid()) OR user_is_org_admin(org_id))
  );

-- Fix: approval_workflows has multiple permissive DELETE policies - consolidate into one
-- Drop ALL the duplicate policies
DROP POLICY IF EXISTS "Admins can manage org workflows" ON approval_workflows;
DROP POLICY IF EXISTS "Admins can delete approval workflows" ON approval_workflows;
DROP POLICY IF EXISTS "Only admins can delete approval workflows" ON approval_workflows;

-- Create single consolidated DELETE policy
CREATE POLICY "Admins can delete approval workflows"
  ON approval_workflows FOR DELETE TO authenticated
  USING (user_is_org_admin(org_id) OR is_super_admin());

-- Fix: approval_workflows has multiple permissive INSERT policies - consolidate into one
DROP POLICY IF EXISTS "Admins can create approval workflows" ON approval_workflows;
DROP POLICY IF EXISTS "Only admins can create approval workflows" ON approval_workflows;

-- Create single consolidated INSERT policy
CREATE POLICY "Admins can create approval workflows"
  ON approval_workflows FOR INSERT TO authenticated
  WITH CHECK (user_is_org_admin(org_id) OR is_super_admin());

-- Fix: approval_workflows has multiple permissive UPDATE policies - consolidate into one
DROP POLICY IF EXISTS "Admins can update approval workflows" ON approval_workflows;
DROP POLICY IF EXISTS "Only admins can update approval workflows" ON approval_workflows;

-- Create single consolidated UPDATE policy
CREATE POLICY "Admins can update approval workflows"
  ON approval_workflows FOR UPDATE TO authenticated
  USING (user_is_org_admin(org_id) OR is_super_admin());

-- Fix: items has multiple permissive DELETE policies - consolidate into one
DROP POLICY IF EXISTS "Admins can delete items" ON items;
DROP POLICY IF EXISTS "Admins and store managers can delete items" ON items;

-- Create single consolidated DELETE policy (org admins, super admins, or store managers)
CREATE POLICY "Admins can delete items"
  ON items FOR DELETE TO authenticated
  USING (user_is_org_admin(org_id) OR is_super_admin() OR get_user_role() = 'store_manager'::public.user_role);

-- Fix: notifications policy re-evaluates auth.uid() for each row
-- Also consolidate duplicate SELECT policies for anon role
DROP POLICY IF EXISTS "Users can view their org notifications" ON notifications;
DROP POLICY IF EXISTS "Users can view own notifications" ON notifications;
DROP POLICY IF EXISTS "Users can view their own notifications" ON notifications;

CREATE POLICY "Users can view their org notifications"
  ON notifications FOR SELECT TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    AND (org_id IS NULL OR user_belongs_to_org(org_id))
  );

-- Fix: notifications has multiple permissive DELETE policies - consolidate into one
DROP POLICY IF EXISTS "Users can delete own notifications" ON notifications;
DROP POLICY IF EXISTS "Users can delete their own notifications" ON notifications;

-- Create single consolidated DELETE policy
CREATE POLICY "Users can delete their own notifications"
  ON notifications FOR DELETE TO authenticated
  USING (
    user_belongs_to_org(org_id)
    AND (user_id = (SELECT auth.uid()) OR user_is_org_admin(org_id))
  );

-- Fix: notifications has multiple permissive UPDATE policies - consolidate into one
DROP POLICY IF EXISTS "Users can update own notifications" ON notifications;
DROP POLICY IF EXISTS "Users can update their own notifications" ON notifications;

-- Create single consolidated UPDATE policy (for marking as read)
CREATE POLICY "Users can update their own notifications"
  ON notifications FOR UPDATE TO authenticated
  USING (
    user_belongs_to_org(org_id)
    AND user_id = (SELECT auth.uid())
  );

-- Fix: organization_settings has multiple permissive INSERT policies - consolidate
-- Also fix SELECT conflict between "Admins can manage org settings" (FOR ALL) and "Users can view their org settings"
DROP POLICY IF EXISTS "Admins can insert organization settings" ON organization_settings;
DROP POLICY IF EXISTS "Admins can manage org settings" ON organization_settings;
DROP POLICY IF EXISTS "Users can view their org settings" ON organization_settings;
DROP POLICY IF EXISTS "Only admins can update organization settings" ON organization_settings;
DROP POLICY IF EXISTS "Admins can create org settings" ON organization_settings;
DROP POLICY IF EXISTS "Admins can update org settings" ON organization_settings;
DROP POLICY IF EXISTS "Admins can delete org settings" ON organization_settings;

-- Create single SELECT policy (all org members can view)
CREATE POLICY "Users can view their org settings"
  ON organization_settings FOR SELECT TO authenticated
  USING (org_id IS NULL OR user_belongs_to_org(org_id));

-- Create single INSERT policy (admins only)
CREATE POLICY "Admins can create org settings"
  ON organization_settings FOR INSERT TO authenticated
  WITH CHECK (org_id IS NULL OR user_is_org_admin(org_id));

-- Create single UPDATE policy (admins only)
CREATE POLICY "Admins can update org settings"
  ON organization_settings FOR UPDATE TO authenticated
  USING (org_id IS NULL OR user_is_org_admin(org_id));

-- Create single DELETE policy (admins only)
CREATE POLICY "Admins can delete org settings"
  ON organization_settings FOR DELETE TO authenticated
  USING (org_id IS NULL OR user_is_org_admin(org_id));

-- Fix: projects has multiple permissive DELETE policies - consolidate
-- "Admins can manage org projects" (FOR ALL) conflicts with specific DELETE policies
DROP POLICY IF EXISTS "Admins can delete projects" ON projects;
DROP POLICY IF EXISTS "Admins can manage org projects" ON projects;
DROP POLICY IF EXISTS "Super admins can delete projects" ON projects;
DROP POLICY IF EXISTS "Super admins can create projects" ON projects;
DROP POLICY IF EXISTS "Super admins can update projects" ON projects;
DROP POLICY IF EXISTS "Users can view org projects" ON projects;
DROP POLICY IF EXISTS "Users can view projects" ON projects;
DROP POLICY IF EXISTS "Users can view their org projects" ON projects;
DROP POLICY IF EXISTS "Admins can create projects" ON projects;
DROP POLICY IF EXISTS "Admins can update projects" ON projects;

-- Create single SELECT policy (all org members can view)
CREATE POLICY "Users can view org projects"
  ON projects FOR SELECT TO authenticated
  USING (org_id IS NULL OR user_belongs_to_org(org_id));

-- Create single INSERT policy (admins only)
CREATE POLICY "Admins can create projects"
  ON projects FOR INSERT TO authenticated
  WITH CHECK (org_id IS NULL OR user_is_org_admin(org_id) OR is_super_admin());

-- Create single UPDATE policy (admins only)
CREATE POLICY "Admins can update projects"
  ON projects FOR UPDATE TO authenticated
  USING (org_id IS NULL OR user_is_org_admin(org_id) OR is_super_admin());

-- Create single DELETE policy (admins only)
CREATE POLICY "Admins can delete projects"
  ON projects FOR DELETE TO authenticated
  USING (org_id IS NULL OR user_is_org_admin(org_id) OR is_super_admin());

-- Fix: categories has multiple permissive DELETE policies - consolidate into one
DROP POLICY IF EXISTS "Admins can delete categories" ON categories;
DROP POLICY IF EXISTS "Super admin can delete categories" ON categories;

-- Create single consolidated DELETE policy
CREATE POLICY "Admins can delete categories"
  ON categories FOR DELETE TO authenticated
  USING (user_is_org_admin(org_id) OR is_super_admin());

-- Fix: categories has multiple permissive INSERT policies - consolidate into one
DROP POLICY IF EXISTS "Admins can create categories" ON categories;
DROP POLICY IF EXISTS "Super admin can create categories" ON categories;

-- Create single consolidated INSERT policy
CREATE POLICY "Admins can create categories"
  ON categories FOR INSERT TO authenticated
  WITH CHECK (user_is_org_admin(org_id) OR is_super_admin());

-- Fix: categories has multiple permissive UPDATE policies - consolidate into one
DROP POLICY IF EXISTS "Admins can update categories" ON categories;
DROP POLICY IF EXISTS "Super admin can update categories" ON categories;

-- Create single consolidated UPDATE policy
CREATE POLICY "Admins can update categories"
  ON categories FOR UPDATE TO authenticated
  USING (user_is_org_admin(org_id) OR is_super_admin());

-- Fix: expense_accounts has multiple permissive DELETE policies - consolidate into one
DROP POLICY IF EXISTS "Admins can delete expense accounts" ON expense_accounts;
DROP POLICY IF EXISTS "Super admins can delete expense accounts" ON expense_accounts;

-- Create single consolidated DELETE policy
CREATE POLICY "Admins can delete expense accounts"
  ON expense_accounts FOR DELETE TO authenticated
  USING (user_is_org_admin(org_id) OR is_super_admin());

-- Fix: expense_accounts has multiple permissive INSERT policies - consolidate into one
DROP POLICY IF EXISTS "Admins can create expense accounts" ON expense_accounts;
DROP POLICY IF EXISTS "Super admins can create expense accounts" ON expense_accounts;

-- Create single consolidated INSERT policy
CREATE POLICY "Admins can create expense accounts"
  ON expense_accounts FOR INSERT TO authenticated
  WITH CHECK (user_is_org_admin(org_id) OR is_super_admin());

-- Fix: expense_accounts has multiple permissive UPDATE policies - consolidate into one
DROP POLICY IF EXISTS "Admins can update expense accounts" ON expense_accounts;
DROP POLICY IF EXISTS "Super admins can update expense accounts" ON expense_accounts;

-- Create single consolidated UPDATE policy
CREATE POLICY "Admins can update expense accounts"
  ON expense_accounts FOR UPDATE TO authenticated
  USING (user_is_org_admin(org_id) OR is_super_admin());

-- Fix: items has multiple permissive INSERT policies - consolidate into one
DROP POLICY IF EXISTS "Admins and store managers can create items" ON items;
DROP POLICY IF EXISTS "Members can create items in their org" ON items;

-- Create single consolidated INSERT policy (org members, super admins, or store managers)
CREATE POLICY "Members can create items in their org"
  ON items FOR INSERT TO authenticated
  WITH CHECK (
    user_belongs_to_org(org_id)
    OR is_super_admin()
    OR get_user_role() = 'store_manager'::public.user_role
  );

-- Fix: items has multiple permissive UPDATE policies - consolidate into one
DROP POLICY IF EXISTS "Admins and store managers can update items" ON items;
DROP POLICY IF EXISTS "Users can update items they created or admins" ON items;
DROP POLICY IF EXISTS "Users can update items" ON items;

-- Create single consolidated UPDATE policy (creator, org admins, super admins, or store managers)
CREATE POLICY "Users can update items"
  ON items FOR UPDATE TO authenticated
  USING (
    user_belongs_to_org(org_id)
    AND (
      created_by = (SELECT auth.uid())
      OR user_is_org_admin(org_id)
      OR is_super_admin()
      OR get_user_role() = 'store_manager'::public.user_role
    )
  );

-- Fix: purchase_orders has multiple permissive DELETE policies - consolidate into one
DROP POLICY IF EXISTS "Admins can delete purchase orders" ON purchase_orders;
DROP POLICY IF EXISTS "Authorized users can delete purchase orders" ON purchase_orders;

-- Create single consolidated DELETE policy
CREATE POLICY "Admins can delete purchase orders"
  ON purchase_orders FOR DELETE TO authenticated
  USING (user_is_org_admin(org_id) OR is_super_admin());

-- Fix: purchase_orders has multiple permissive INSERT policies - consolidate into one
DROP POLICY IF EXISTS "Admins can create purchase orders" ON purchase_orders;
DROP POLICY IF EXISTS "Authorized users can create purchase orders" ON purchase_orders;

-- Create single consolidated INSERT policy
CREATE POLICY "Admins can create purchase orders"
  ON purchase_orders FOR INSERT TO authenticated
  WITH CHECK (user_is_org_admin(org_id) OR is_super_admin());

-- Fix: purchase_orders has multiple permissive UPDATE policies - consolidate into one
DROP POLICY IF EXISTS "Admins can update purchase orders" ON purchase_orders;
DROP POLICY IF EXISTS "Authorized users can update purchase orders" ON purchase_orders;

-- Create single consolidated UPDATE policy
CREATE POLICY "Admins can update purchase orders"
  ON purchase_orders FOR UPDATE TO authenticated
  USING (user_is_org_admin(org_id) OR is_super_admin());

-- Fix: receipt_items has multiple permissive DELETE policies - consolidate into one
DROP POLICY IF EXISTS "Admins can delete receipt items" ON receipt_items;
DROP POLICY IF EXISTS "Authorized users can delete receipt items" ON receipt_items;

-- Create single consolidated DELETE policy
CREATE POLICY "Admins can delete receipt items"
  ON receipt_items FOR DELETE TO authenticated
  USING (user_is_org_admin(org_id) OR is_super_admin());

-- Fix: receipt_items has multiple permissive INSERT policies - consolidate into one
DROP POLICY IF EXISTS "Admins can create receipt items" ON receipt_items;
DROP POLICY IF EXISTS "Authorized users can create receipt items" ON receipt_items;

-- Create single consolidated INSERT policy
CREATE POLICY "Admins can create receipt items"
  ON receipt_items FOR INSERT TO authenticated
  WITH CHECK (user_is_org_admin(org_id) OR is_super_admin());

-- Fix: receipt_items has multiple permissive UPDATE policies - consolidate into one
DROP POLICY IF EXISTS "Admins can update receipt items" ON receipt_items;
DROP POLICY IF EXISTS "Authorized users can update receipt items" ON receipt_items;

-- Create single consolidated UPDATE policy
CREATE POLICY "Admins can update receipt items"
  ON receipt_items FOR UPDATE TO authenticated
  USING (user_is_org_admin(org_id) OR is_super_admin());

-- Fix: receipt_transactions has multiple permissive DELETE policies - consolidate into one
DROP POLICY IF EXISTS "Admins can delete receipt transactions" ON receipt_transactions;
DROP POLICY IF EXISTS "Authorized users can delete receipt transactions" ON receipt_transactions;

-- Create single consolidated DELETE policy
CREATE POLICY "Admins can delete receipt transactions"
  ON receipt_transactions FOR DELETE TO authenticated
  USING (user_is_org_admin(org_id) OR is_super_admin());

-- Fix: receipt_transactions has multiple permissive INSERT policies - consolidate into one
DROP POLICY IF EXISTS "Admins can create receipt transactions" ON receipt_transactions;
DROP POLICY IF EXISTS "Authorized users can create receipt transactions" ON receipt_transactions;

-- Create single consolidated INSERT policy
CREATE POLICY "Admins can create receipt transactions"
  ON receipt_transactions FOR INSERT TO authenticated
  WITH CHECK (user_is_org_admin(org_id) OR is_super_admin());

-- Fix: receipt_transactions has multiple permissive SELECT policies - consolidate into one
DROP POLICY IF EXISTS "Users can view receipt transactions" ON receipt_transactions;
DROP POLICY IF EXISTS "Users can view receipts" ON receipt_transactions;

-- Create single consolidated SELECT policy
CREATE POLICY "Users can view receipt transactions"
  ON receipt_transactions FOR SELECT TO authenticated
  USING (user_belongs_to_org(org_id) OR is_super_admin());

-- Fix: receipt_transactions has multiple permissive UPDATE policies - consolidate into one
DROP POLICY IF EXISTS "Admins can update receipt transactions" ON receipt_transactions;
DROP POLICY IF EXISTS "Authorized users can update receipt transactions" ON receipt_transactions;

-- Create single consolidated UPDATE policy
CREATE POLICY "Admins can update receipt transactions"
  ON receipt_transactions FOR UPDATE TO authenticated
  USING (user_is_org_admin(org_id) OR is_super_admin());

-- Fix: requisition_items has multiple permissive INSERT policies - consolidate into one
DROP POLICY IF EXISTS "Users can insert requisition items" ON requisition_items;
DROP POLICY IF EXISTS "Users can manage own requisition items" ON requisition_items;
DROP POLICY IF EXISTS "Users can insert requisition items in their org" ON requisition_items;

-- Create single consolidated INSERT policy
CREATE POLICY "Users can insert requisition items"
  ON requisition_items FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.requisitions r
      WHERE r.id = requisition_id
        AND r.submitted_by = (SELECT auth.uid())
        AND (r.org_id IS NULL OR user_belongs_to_org(r.org_id))
    )
  );

-- Fix: requisition_templates has multiple permissive DELETE policies - consolidate into one
DROP POLICY IF EXISTS "Users can delete own templates" ON requisition_templates;
DROP POLICY IF EXISTS "Users can delete their own templates" ON requisition_templates;

-- Create single consolidated DELETE policy
CREATE POLICY "Users can delete own templates"
  ON requisition_templates FOR DELETE TO authenticated
  USING (created_by = (SELECT auth.uid()));

-- Fix: requisition_templates has multiple permissive INSERT policies - consolidate into one
DROP POLICY IF EXISTS "Users can create own templates" ON requisition_templates;
DROP POLICY IF EXISTS "Users can create templates in their org" ON requisition_templates;

-- Create single consolidated INSERT policy
CREATE POLICY "Users can create own templates"
  ON requisition_templates FOR INSERT TO authenticated
  WITH CHECK (
    created_by = (SELECT auth.uid())
    AND (org_id IS NULL OR user_belongs_to_org(org_id))
  );

-- Fix: requisition_templates has multiple permissive SELECT policies - consolidate into one
DROP POLICY IF EXISTS "Users can view own templates" ON requisition_templates;
DROP POLICY IF EXISTS "Users can view requisition templates" ON requisition_templates;

-- Create single consolidated SELECT policy (user's own or org templates)
CREATE POLICY "Users can view own templates"
  ON requisition_templates FOR SELECT TO authenticated
  USING (
    created_by = (SELECT auth.uid())
    OR (org_id IS NOT NULL AND user_belongs_to_org(org_id))
  );

-- Fix: requisition_templates has multiple permissive UPDATE policies - consolidate into one
DROP POLICY IF EXISTS "Users can update own templates" ON requisition_templates;
DROP POLICY IF EXISTS "Users can update their own templates" ON requisition_templates;

-- Create single consolidated UPDATE policy
CREATE POLICY "Users can update own templates"
  ON requisition_templates FOR UPDATE TO authenticated
  USING (created_by = (SELECT auth.uid()));

-- Fix: requisitions has multiple permissive SELECT policies - consolidate into one
DROP POLICY IF EXISTS "Users can view own requisitions" ON requisitions;
DROP POLICY IF EXISTS "Users can view requisitions" ON requisitions;
DROP POLICY IF EXISTS "Users can view org requisitions" ON requisitions;

-- Create single consolidated SELECT policy
CREATE POLICY "Users can view own requisitions"
  ON requisitions FOR SELECT TO authenticated
  USING (
    (org_id IS NULL OR user_belongs_to_org(org_id))
    AND (
      submitted_by = (SELECT auth.uid())
      OR user_is_org_admin(org_id)
      OR is_super_admin()
    )
  );

-- Fix: requisitions has multiple permissive INSERT policies - consolidate into one
DROP POLICY IF EXISTS "Users can create requisitions" ON requisitions;
DROP POLICY IF EXISTS "Users can create requisitions in org" ON requisitions;

-- Create single consolidated INSERT policy
CREATE POLICY "Users can create requisitions"
  ON requisitions FOR INSERT TO authenticated
  WITH CHECK (
    submitted_by = (SELECT auth.uid())
    AND (org_id IS NULL OR user_belongs_to_org(org_id))
  );

-- Fix: security_audit_logs has multiple permissive SELECT policies - consolidate into one
DROP POLICY IF EXISTS "Org owners can view their org audit logs" ON security_audit_logs;
DROP POLICY IF EXISTS "Super admins can view all security audit logs" ON security_audit_logs;
DROP POLICY IF EXISTS "Admins can view security audit logs" ON security_audit_logs;

-- Create single consolidated SELECT policy
CREATE POLICY "Admins can view security audit logs"
  ON security_audit_logs FOR SELECT TO authenticated
  USING (
    is_super_admin()
    OR user_is_org_owner(current_org_id)
  );

-- Fix: uom_types has multiple permissive DELETE policies - consolidate into one
DROP POLICY IF EXISTS "Admins can delete uom types" ON uom_types;
DROP POLICY IF EXISTS "Super admins can delete UOM types" ON uom_types;

-- Create single consolidated DELETE policy
CREATE POLICY "Admins can delete uom types"
  ON uom_types FOR DELETE TO authenticated
  USING (user_is_org_admin(org_id) OR is_super_admin());

-- Fix: uom_types has multiple permissive INSERT policies - consolidate into one
DROP POLICY IF EXISTS "Admins can create uom types" ON uom_types;
DROP POLICY IF EXISTS "Super admins can create UOM types" ON uom_types;

-- Create single consolidated INSERT policy
CREATE POLICY "Admins can create uom types"
  ON uom_types FOR INSERT TO authenticated
  WITH CHECK (user_is_org_admin(org_id) OR is_super_admin());

-- Fix: uom_types has multiple permissive SELECT policies - consolidate into one
DROP POLICY IF EXISTS "Users can view UOM types" ON uom_types;
DROP POLICY IF EXISTS "Users can view uom_types" ON uom_types;
DROP POLICY IF EXISTS "Users can view uom types" ON uom_types;

-- Create single consolidated SELECT policy
CREATE POLICY "Users can view uom types"
  ON uom_types FOR SELECT TO authenticated
  USING (user_belongs_to_org(org_id) OR is_super_admin());

-- Fix: uom_types has multiple permissive UPDATE policies - consolidate into one
DROP POLICY IF EXISTS "Admins can update uom types" ON uom_types;
DROP POLICY IF EXISTS "Super admins can update UOM types" ON uom_types;

-- Create single consolidated UPDATE policy
CREATE POLICY "Admins can update uom types"
  ON uom_types FOR UPDATE TO authenticated
  USING (user_is_org_admin(org_id) OR is_super_admin());

-- Fix: user_project_assignments has multiple permissive SELECT policies - consolidate into one
DROP POLICY IF EXISTS "Users can view own assignments" ON user_project_assignments;
DROP POLICY IF EXISTS "Users can view project assignments" ON user_project_assignments;
DROP POLICY IF EXISTS "Users can view user project assignments" ON user_project_assignments;

-- Create single consolidated SELECT policy
CREATE POLICY "Users can view project assignments"
  ON user_project_assignments FOR SELECT TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    OR user_is_org_admin(org_id)
    OR is_super_admin()
  );

-- Fix: user_project_assignments has multiple permissive DELETE policies - consolidate into one
DROP POLICY IF EXISTS "Admins can remove users from projects" ON user_project_assignments;
DROP POLICY IF EXISTS "Super admins can delete project assignments" ON user_project_assignments;
DROP POLICY IF EXISTS "Admins can delete project assignments" ON user_project_assignments;

-- Create single consolidated DELETE policy
CREATE POLICY "Admins can delete project assignments"
  ON user_project_assignments FOR DELETE TO authenticated
  USING (user_is_org_admin(org_id) OR is_super_admin());

-- Fix: user_project_assignments has multiple permissive INSERT policies - consolidate into one
DROP POLICY IF EXISTS "Admins can assign users to projects" ON user_project_assignments;
DROP POLICY IF EXISTS "Super admins can create project assignments" ON user_project_assignments;
DROP POLICY IF EXISTS "Admins can create project assignments" ON user_project_assignments;

-- Create single consolidated INSERT policy
CREATE POLICY "Admins can create project assignments"
  ON user_project_assignments FOR INSERT TO authenticated
  WITH CHECK (user_is_org_admin(org_id) OR is_super_admin());

-- Fix: user_project_assignments has multiple permissive UPDATE policies - consolidate into one
DROP POLICY IF EXISTS "Admins can update project assignments" ON user_project_assignments;
DROP POLICY IF EXISTS "Super admins can update project assignments" ON user_project_assignments;

-- Create single consolidated UPDATE policy
CREATE POLICY "Admins can update project assignments"
  ON user_project_assignments FOR UPDATE TO authenticated
  USING (user_is_org_admin(org_id) OR is_super_admin());

-- Fix: users has multiple permissive SELECT policies - consolidate into one
DROP POLICY IF EXISTS "Users can view own profile" ON users;
DROP POLICY IF EXISTS "Users can view users" ON users;
DROP POLICY IF EXISTS "Users can view users in same org" ON users;
DROP POLICY IF EXISTS "Users can view users in their org" ON users;

-- Create single consolidated SELECT policy
CREATE POLICY "Users can view users"
  ON users FOR SELECT TO authenticated
  USING (
    id = (SELECT auth.uid())
    OR user_belongs_to_org(org_id)
    OR is_super_admin()
  );

-- Fix: users has multiple permissive UPDATE policies - consolidate into one
DROP POLICY IF EXISTS "Users can update own profile" ON users;
DROP POLICY IF EXISTS "Users can update users" ON users;
DROP POLICY IF EXISTS "Users can update their own profile or admins can update any" ON users;

-- Create single consolidated UPDATE policy
CREATE POLICY "Users can update users"
  ON users FOR UPDATE TO authenticated
  USING (
    id = (SELECT auth.uid())
    OR user_is_org_admin(org_id)
    OR is_super_admin()
  );

-- Fix: users has multiple permissive DELETE policies - consolidate into one
DROP POLICY IF EXISTS "Admins can delete users" ON users;
DROP POLICY IF EXISTS "Admins can manage users in their org" ON users;
DROP POLICY IF EXISTS "Super admins can delete users" ON users;

-- Create single consolidated DELETE policy
CREATE POLICY "Admins can delete users"
  ON users FOR DELETE TO authenticated
  USING (user_is_org_admin(org_id) OR is_super_admin());

-- Fix: users has multiple permissive INSERT policies - consolidate into one
DROP POLICY IF EXISTS "Admins can create users in their org" ON users;
DROP POLICY IF EXISTS "Super admins can create users" ON users;
DROP POLICY IF EXISTS "Admins can create users" ON users;

-- Create single consolidated INSERT policy
CREATE POLICY "Admins can create users"
  ON users FOR INSERT TO authenticated
  WITH CHECK (user_is_org_admin(org_id) OR is_super_admin());

-- =====================================================
-- STEP 4: Fix get_user_org_id function
-- =====================================================

CREATE OR REPLACE FUNCTION get_user_org_id()
RETURNS UUID AS $$
DECLARE
  org_id UUID;
BEGIN
  SELECT om.organization_id INTO org_id
  FROM public.organization_members om
  WHERE om.user_id = (SELECT auth.uid())
    AND om.is_active = true
  ORDER BY om.created_at ASC
  LIMIT 1;

  RETURN org_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE
SET search_path = '';

-- =====================================================
-- STEP 5: Fix Helper Functions from 20241213_helper_functions.sql
-- These functions also need search_path set
-- =====================================================

-- create_audit_log function (FIXED)
CREATE OR REPLACE FUNCTION create_audit_log(
  p_table_name VARCHAR(100),
  p_record_id UUID,
  p_action VARCHAR(50),
  p_old_values JSONB DEFAULT NULL,
  p_new_values JSONB DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  log_id UUID;
BEGIN
  INSERT INTO public.audit_logs (
    table_name,
    record_id,
    action,
    old_values,
    new_values,
    changed_by
  )
  VALUES (
    p_table_name,
    p_record_id,
    p_action,
    p_old_values,
    p_new_values,
    (SELECT auth.uid())
  )
  RETURNING id INTO log_id;

  RETURN log_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = '';

-- audit_requisition_changes trigger function (FIXED)
CREATE OR REPLACE FUNCTION audit_requisition_changes()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.create_audit_log(
      'requisitions',
      NEW.id,
      'INSERT',
      NULL,
      to_jsonb(NEW)
    );
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    PERFORM public.create_audit_log(
      'requisitions',
      NEW.id,
      'UPDATE',
      to_jsonb(OLD),
      to_jsonb(NEW)
    );
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM public.create_audit_log(
      'requisitions',
      OLD.id,
      'DELETE',
      to_jsonb(OLD),
      NULL
    );
    RETURN OLD;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = '';

-- create_notification function (FIXED)
CREATE OR REPLACE FUNCTION create_notification(
  p_user_id UUID,
  p_title VARCHAR(255),
  p_message TEXT,
  p_type VARCHAR(50) DEFAULT 'info',
  p_related_requisition_id UUID DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  notif_id UUID;
BEGIN
  INSERT INTO public.notifications (
    user_id,
    title,
    message,
    type,
    related_requisition_id
  )
  VALUES (
    p_user_id,
    p_title,
    p_message,
    p_type::public.notification_type,
    p_related_requisition_id
  )
  RETURNING id INTO notif_id;

  RETURN notif_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = '';

-- notify_requisition_status_change trigger function (FIXED)
CREATE OR REPLACE FUNCTION notify_requisition_status_change()
RETURNS TRIGGER AS $$
DECLARE
  v_title VARCHAR(255);
  v_message TEXT;
  v_type TEXT;
  v_submitter_name TEXT;
  v_project_code TEXT;
BEGIN
  -- Only proceed if status changed
  IF OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;

  -- Get requisition details
  SELECT u.full_name, p.code
  INTO v_submitter_name, v_project_code
  FROM public.users u
  JOIN public.projects p ON p.id = NEW.project_id
  WHERE u.id = NEW.submitted_by;

  -- Build notification based on new status
  CASE NEW.status
    WHEN 'pending_review' THEN
      v_title := 'Requisition Submitted for Review';
      v_message := format('%s submitted requisition %s for project %s',
        v_submitter_name, NEW.requisition_number, v_project_code);
      v_type := 'requisition_submitted';

    WHEN 'pending_approval' THEN
      v_title := 'Requisition Ready for Approval';
      v_message := format('Requisition %s has been reviewed and is pending approval',
        NEW.requisition_number);
      v_type := 'requisition_approved';

    WHEN 'approved' THEN
      v_title := 'Requisition Approved';
      v_message := format('Your requisition %s has been approved',
        NEW.requisition_number);
      v_type := 'requisition_approved';

    WHEN 'rejected' THEN
      v_title := 'Requisition Rejected';
      v_message := format('Your requisition %s has been rejected',
        NEW.requisition_number);
      v_type := 'requisition_rejected';

    ELSE
      RETURN NEW;
  END CASE;

  -- Notify the submitter for approved/rejected
  IF NEW.status IN ('approved', 'rejected') THEN
    PERFORM public.create_notification(
      NEW.submitted_by,
      v_title,
      v_message,
      v_type::text,
      NEW.id
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = '';

-- notify_new_comment trigger function (FIXED)
CREATE OR REPLACE FUNCTION notify_new_comment()
RETURNS TRIGGER AS $$
DECLARE
  v_requisition_submitter UUID;
  v_requisition_number VARCHAR(50);
  v_commenter_name TEXT;
BEGIN
  -- Get requisition info
  SELECT r.submitted_by, r.requisition_number
  INTO v_requisition_submitter, v_requisition_number
  FROM public.requisitions r
  WHERE r.id = NEW.requisition_id;

  -- Get commenter name
  SELECT full_name INTO v_commenter_name
  FROM public.users
  WHERE id = NEW.user_id;

  -- Notify the requisition submitter (if not the commenter)
  IF v_requisition_submitter != NEW.user_id THEN
    PERFORM public.create_notification(
      v_requisition_submitter,
      'New Comment on Your Requisition',
      format('%s commented on requisition %s', v_commenter_name, v_requisition_number),
      'comment_added',
      NEW.requisition_id
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = '';

-- get_requisition_stats function (FIXED)
DROP FUNCTION IF EXISTS get_requisition_stats(UUID);
CREATE OR REPLACE FUNCTION get_requisition_stats(p_user_id UUID)
RETURNS TABLE (
  total_submitted BIGINT,
  pending_review BIGINT,
  pending_approval BIGINT,
  approved BIGINT,
  rejected BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*)::BIGINT AS total_submitted,
    COUNT(*) FILTER (WHERE status = 'pending_review')::BIGINT AS pending_review,
    COUNT(*) FILTER (WHERE status = 'pending_approval')::BIGINT AS pending_approval,
    COUNT(*) FILTER (WHERE status = 'approved')::BIGINT AS approved,
    COUNT(*) FILTER (WHERE status = 'rejected')::BIGINT AS rejected
  FROM public.requisitions
  WHERE submitted_by = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = '';

-- get_project_budget_summary function (FIXED)
DROP FUNCTION IF EXISTS get_project_budget_summary(UUID);
CREATE OR REPLACE FUNCTION get_project_budget_summary(p_project_id UUID)
RETURNS TABLE (
  account_id UUID,
  account_name VARCHAR(255),
  allocated_budget DECIMAL(15,2),
  spent_amount DECIMAL(15,2),
  remaining_budget DECIMAL(15,2),
  utilization_percentage DECIMAL(5,2)
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    ea.id AS account_id,
    ea.name AS account_name,
    pa.allocated_budget,
    COALESCE(pa.spent_amount, 0) AS spent_amount,
    pa.allocated_budget - COALESCE(pa.spent_amount, 0) AS remaining_budget,
    CASE
      WHEN pa.allocated_budget > 0 THEN
        ROUND((COALESCE(pa.spent_amount, 0) / pa.allocated_budget * 100)::DECIMAL, 2)
      ELSE 0
    END AS utilization_percentage
  FROM public.project_accounts pa
  JOIN public.expense_accounts ea ON ea.id = pa.expense_account_id
  WHERE pa.project_id = p_project_id
  ORDER BY ea.code;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = '';

-- =====================================================
-- STEP 6: Fix Multi-Tenancy Functions
-- =====================================================

-- get_current_org_id function (FIXED)
CREATE OR REPLACE FUNCTION get_current_org_id()
RETURNS UUID AS $$
DECLARE
  org_id UUID;
BEGIN
  -- Try to get org_id from JWT claims first
  org_id := (current_setting('request.jwt.claims', true)::json->>'org_id')::UUID;

  IF org_id IS NOT NULL THEN
    RETURN org_id;
  END IF;

  -- Fallback: get user's primary organization
  SELECT om.organization_id INTO org_id
  FROM public.organization_members om
  WHERE om.user_id = (SELECT auth.uid())
    AND om.is_active = true
  ORDER BY om.created_at ASC
  LIMIT 1;

  RETURN org_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE
SET search_path = '';

-- set_org_id_on_insert trigger function (FIXED)
CREATE OR REPLACE FUNCTION set_org_id_on_insert()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.org_id IS NULL THEN
    NEW.org_id := public.get_current_org_id();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql
SET search_path = '';

-- create_organization function (FIXED)
CREATE OR REPLACE FUNCTION create_organization(
  p_name VARCHAR(255),
  p_slug VARCHAR(100),
  p_email VARCHAR(255) DEFAULT NULL,
  p_plan subscription_plan DEFAULT 'free'
)
RETURNS UUID AS $$
DECLARE
  v_org_id UUID;
  v_user_id UUID;
BEGIN
  v_user_id := (SELECT auth.uid());

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'User must be authenticated';
  END IF;

  -- Create organization
  INSERT INTO public.organizations (name, slug, email, plan, created_by)
  VALUES (p_name, p_slug, p_email, p_plan, v_user_id)
  RETURNING id INTO v_org_id;

  -- Add creator as owner
  INSERT INTO public.organization_members (organization_id, user_id, role, accepted_at)
  VALUES (v_org_id, v_user_id, 'owner', NOW());

  -- Create default organization settings
  INSERT INTO public.organization_settings (org_id, organization_name)
  VALUES (v_org_id, p_name);

  -- Create default fiscal year settings (if table exists)
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'fiscal_year_settings') THEN
    INSERT INTO public.fiscal_year_settings (org_id, start_month, start_day)
    VALUES (v_org_id, 1, 1);
  END IF;

  RETURN v_org_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = '';

-- invite_user_to_org function (FIXED)
CREATE OR REPLACE FUNCTION invite_user_to_org(
  p_org_id UUID,
  p_email VARCHAR(255),
  p_role org_member_role DEFAULT 'member'
)
RETURNS UUID AS $$
DECLARE
  v_user_id UUID;
  v_member_id UUID;
BEGIN
  -- Check if inviter is admin
  IF NOT public.user_is_org_admin(p_org_id) THEN
    RAISE EXCEPTION 'Only admins can invite users';
  END IF;

  -- Find user by email
  SELECT id INTO v_user_id FROM auth.users WHERE email = p_email;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'User not found. Send invitation email instead.';
  END IF;

  -- Check if already a member
  IF EXISTS (SELECT 1 FROM public.organization_members WHERE organization_id = p_org_id AND user_id = v_user_id) THEN
    RAISE EXCEPTION 'User is already a member of this organization';
  END IF;

  -- Add user to organization
  INSERT INTO public.organization_members (organization_id, user_id, role)
  VALUES (p_org_id, v_user_id, p_role)
  RETURNING id INTO v_member_id;

  RETURN v_member_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = '';

-- =====================================================
-- STEP 7: Fix log_security_event function (from 20260120_audit_logging_security.sql)
-- =====================================================

CREATE OR REPLACE FUNCTION log_security_event(
  p_event_type VARCHAR(50),
  p_severity VARCHAR(20),
  p_message TEXT,
  p_current_org_id UUID DEFAULT NULL,
  p_target_org_id UUID DEFAULT NULL,
  p_resource_type VARCHAR(50) DEFAULT NULL,
  p_resource_id UUID DEFAULT NULL,
  p_action_attempted VARCHAR(50) DEFAULT NULL,
  p_was_blocked BOOLEAN DEFAULT true,
  p_details JSONB DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_log_id UUID;
  v_user_id UUID;
  v_user_email VARCHAR(255);
BEGIN
  -- Get current user info
  v_user_id := (SELECT auth.uid());

  IF v_user_id IS NOT NULL THEN
    SELECT email INTO v_user_email
    FROM auth.users
    WHERE id = v_user_id;
  END IF;

  -- Insert audit log
  INSERT INTO public.security_audit_logs (
    event_type,
    severity,
    user_id,
    user_email,
    current_org_id,
    target_org_id,
    resource_type,
    resource_id,
    action_attempted,
    message,
    details,
    was_blocked
  ) VALUES (
    p_event_type,
    p_severity,
    v_user_id,
    v_user_email,
    p_current_org_id,
    p_target_org_id,
    p_resource_type,
    p_resource_id,
    p_action_attempted,
    p_message,
    p_details,
    p_was_blocked
  )
  RETURNING id INTO v_log_id;

  -- If critical, you could trigger alerts here (email, Slack, etc.)
  IF p_severity = 'critical' THEN
    -- Log to PostgreSQL log for immediate visibility
    RAISE WARNING 'SECURITY ALERT: % - %', p_event_type, p_message;
  END IF;

  RETURN v_log_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = '';

-- =====================================================
-- STEP 8: Fix Duplicate Indexes
-- =====================================================

-- Fix: fiscal_year_settings has duplicate indexes - drop one
DROP INDEX IF EXISTS idx_fiscal_year_org;
-- Keep idx_fiscal_year_settings_org as it has a more descriptive name

-- Fix: fiscal_year_settings has another set of duplicate unique indexes - drop one
DROP INDEX IF EXISTS unique_fiscal_settings_per_org;
-- Keep unique_fiscal_year_per_org as the constraint name

-- Fix: organization_members has duplicate indexes on user_id - drop one
DROP INDEX IF EXISTS idx_org_members_user;
-- Keep idx_organization_members_user_id as it has a more descriptive name

-- Fix: organizations has duplicate indexes on slug - drop one
DROP INDEX IF EXISTS idx_organizations_slug;
-- Keep organizations_slug_key as it's the unique constraint index

-- Fix: po_items has duplicate indexes on requisition_item_id - drop one
DROP INDEX IF EXISTS idx_po_items_req_item;
-- Keep idx_po_items_requisition_item_id as it has a more descriptive name

-- =====================================================
-- Verification Query (run manually to verify fix)
-- =====================================================
-- SELECT 
--   schemaname, 
--   tablename, 
--   policyname, 
--   qual,
--   CASE 
--     WHEN qual LIKE '%auth.uid()%' AND qual NOT LIKE '%(select auth.uid())%' 
--     THEN 'NEEDS FIX'
--     ELSE 'OK'
--   END as status
-- FROM pg_policies 
-- WHERE schemaname = 'public';

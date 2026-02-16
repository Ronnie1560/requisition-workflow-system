-- =====================================================
-- Fix: Restore missing RLS policies dropped by workflow role migration
-- =====================================================
-- Root cause: The workflow role migration (20260215) dropped is_super_admin()
-- and recreated it with a new signature is_super_admin(check_org_id UUID DEFAULT NULL).
-- PostgreSQL invalidated/dropped all existing policies whose internal expression 
-- trees referenced the old function OID. Only some policies were recreated in that
-- migration — these 6 tables had gaps.
-- =====================================================

-- =====================================================
-- 1. EXPENSE_ACCOUNTS — Missing INSERT, UPDATE, DELETE
-- =====================================================
DROP POLICY IF EXISTS "Admins can create expense accounts" ON expense_accounts;
DROP POLICY IF EXISTS "Admins can update expense accounts" ON expense_accounts;
DROP POLICY IF EXISTS "Admins can delete expense accounts" ON expense_accounts;
DROP POLICY IF EXISTS "Super admins can manage expense accounts" ON expense_accounts;

CREATE POLICY "Admins can create expense accounts"
  ON expense_accounts FOR INSERT TO authenticated
  WITH CHECK (user_is_org_admin(org_id) OR is_super_admin(org_id));

CREATE POLICY "Admins can update expense accounts"
  ON expense_accounts FOR UPDATE TO authenticated
  USING (user_is_org_admin(org_id) OR is_super_admin(org_id));

CREATE POLICY "Admins can delete expense accounts"
  ON expense_accounts FOR DELETE TO authenticated
  USING (user_is_org_admin(org_id) OR is_super_admin(org_id));

-- =====================================================
-- 2. PROJECTS — Missing INSERT, UPDATE, DELETE
-- =====================================================
DROP POLICY IF EXISTS "Admins can create projects" ON projects;
DROP POLICY IF EXISTS "Admins can update projects" ON projects;
DROP POLICY IF EXISTS "Admins can delete projects" ON projects;
DROP POLICY IF EXISTS "Super admins can manage projects" ON projects;

CREATE POLICY "Admins can create projects"
  ON projects FOR INSERT TO authenticated
  WITH CHECK (org_id IS NULL OR user_is_org_admin(org_id) OR is_super_admin(org_id));

CREATE POLICY "Admins can update projects"
  ON projects FOR UPDATE TO authenticated
  USING (org_id IS NULL OR user_is_org_admin(org_id) OR is_super_admin(org_id));

CREATE POLICY "Admins can delete projects"
  ON projects FOR DELETE TO authenticated
  USING (org_id IS NULL OR user_is_org_admin(org_id) OR is_super_admin(org_id));

-- =====================================================
-- 3. CATEGORIES — Missing INSERT, UPDATE, DELETE
-- =====================================================
DROP POLICY IF EXISTS "Admins can create categories" ON categories;
DROP POLICY IF EXISTS "Admins can update categories" ON categories;
DROP POLICY IF EXISTS "Admins can delete categories" ON categories;
DROP POLICY IF EXISTS "Super admins can manage categories" ON categories;

CREATE POLICY "Admins can create categories"
  ON categories FOR INSERT TO authenticated
  WITH CHECK (user_is_org_admin(org_id) OR is_super_admin(org_id));

CREATE POLICY "Admins can update categories"
  ON categories FOR UPDATE TO authenticated
  USING (user_is_org_admin(org_id) OR is_super_admin(org_id));

CREATE POLICY "Admins can delete categories"
  ON categories FOR DELETE TO authenticated
  USING (user_is_org_admin(org_id) OR is_super_admin(org_id));

-- =====================================================
-- 4. COMMENTS — Missing INSERT
-- (no org_id column — uses JOIN to requisitions)
-- =====================================================
DROP POLICY IF EXISTS "Users can add comments" ON comments;
DROP POLICY IF EXISTS "Users can create comments" ON comments;

CREATE POLICY "Users can add comments"
  ON comments FOR INSERT TO authenticated
  WITH CHECK (
    user_id = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1 FROM requisitions r
      WHERE r.id = comments.requisition_id
      AND (
        r.submitted_by = (SELECT auth.uid())
        OR is_assigned_to_project(r.project_id)
        OR is_super_admin(r.org_id)
      )
    )
  );

-- =====================================================
-- 5. APPROVAL_WORKFLOWS — Missing INSERT, DELETE
-- =====================================================
DROP POLICY IF EXISTS "Admins can create approval workflows" ON approval_workflows;
DROP POLICY IF EXISTS "Admins can delete approval workflows" ON approval_workflows;

CREATE POLICY "Admins can create approval workflows"
  ON approval_workflows FOR INSERT TO authenticated
  WITH CHECK (user_is_org_admin(org_id) OR is_super_admin(org_id));

CREATE POLICY "Admins can delete approval workflows"
  ON approval_workflows FOR DELETE TO authenticated
  USING (user_is_org_admin(org_id) OR is_super_admin(org_id));

-- =====================================================
-- 6. ATTACHMENTS — Missing UPDATE
-- (no org_id column — uses JOIN to requisitions)
-- =====================================================
DROP POLICY IF EXISTS "Users can update own attachments" ON attachments;
DROP POLICY IF EXISTS "Users can update attachments" ON attachments;

CREATE POLICY "Users can update own attachments"
  ON attachments FOR UPDATE TO authenticated
  USING (
    uploaded_by = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1 FROM requisitions r
      WHERE r.id = attachments.requisition_id
      AND (
        r.submitted_by = (SELECT auth.uid())
        OR is_assigned_to_project(r.project_id)
        OR is_super_admin(r.org_id)
      )
    )
  )
  WITH CHECK (
    uploaded_by = (SELECT auth.uid())
  );

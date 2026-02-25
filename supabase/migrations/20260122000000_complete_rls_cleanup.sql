-- =====================================================
-- Migration: Complete RLS Policy Cleanup
-- Date: 2026-01-22
-- Issue: Multiple migrations created duplicate policies
--        and some still use auth.uid() directly.
--        This script cleans everything up.
-- =====================================================

-- =====================================================
-- USERS TABLE - Remove duplicates, keep helper function versions
-- =====================================================
DROP POLICY IF EXISTS "Users can view users in their organization" ON users;
DROP POLICY IF EXISTS "Users can update their own profile" ON users;
-- Keep: "Users can view users" and "Users can update users" (use helper functions)

-- =====================================================
-- ORGANIZATIONS TABLE - Remove duplicates
-- =====================================================
DROP POLICY IF EXISTS "Users can view organizations they belong to" ON organizations;
-- Keep: "Users can view their organizations" (uses helper function)

-- =====================================================
-- ORGANIZATION_MEMBERS TABLE - Remove duplicates
-- =====================================================
DROP POLICY IF EXISTS "Members can view their own memberships" ON organization_members;
DROP POLICY IF EXISTS "Admins can manage organization members" ON organization_members;
-- Keep: "Users can view org members", "Admins can add/update/remove org members"

-- Fix the remaining one that uses auth.uid()
DROP POLICY IF EXISTS "Admins can update org members" ON organization_members;
CREATE POLICY "Admins can update org members"
  ON organization_members FOR UPDATE
  TO authenticated
  USING (
    user_is_org_admin(organization_id) 
    AND (role <> 'owner' OR user_id = (SELECT auth.uid()))
  );

-- =====================================================
-- ORGANIZATION_SETTINGS TABLE - Remove duplicates
-- =====================================================
DROP POLICY IF EXISTS "Users can view settings for their organizations" ON organization_settings;
DROP POLICY IF EXISTS "Admins can update organization settings" ON organization_settings;
-- Keep: "Users can view their org settings", "Admins can create/update/delete org settings"

-- =====================================================
-- PROJECTS TABLE - Remove duplicates
-- =====================================================
DROP POLICY IF EXISTS "Users can view projects in their organization" ON projects;
DROP POLICY IF EXISTS "Admins can manage projects" ON projects;
-- Keep: "Users can view org projects", "Admins can create/update/delete projects"

-- =====================================================
-- EXPENSE_ACCOUNTS TABLE - Remove duplicates
-- =====================================================
DROP POLICY IF EXISTS "Users can view expense accounts in their organization" ON expense_accounts;
DROP POLICY IF EXISTS "Admins can manage expense accounts" ON expense_accounts;
-- Keep: "Users can view org expense accounts", "Admins can create/update/delete expense accounts"

-- =====================================================
-- REQUISITIONS TABLE - Remove duplicates, fix remaining
-- =====================================================
DROP POLICY IF EXISTS "Users can view requisitions in their organization" ON requisitions;
DROP POLICY IF EXISTS "Users can update their own requisitions" ON requisitions;
-- Keep: "Users can view own requisitions", "Users can update own requisitions", "Users can delete requisitions", "Users can create requisitions"

-- Fix: Users can view own requisitions
DROP POLICY IF EXISTS "Users can view own requisitions" ON requisitions;
CREATE POLICY "Users can view own requisitions"
  ON requisitions FOR SELECT
  TO authenticated
  USING (
    ((org_id IS NULL) OR user_belongs_to_org(org_id))
    AND (
      submitted_by = (SELECT auth.uid())
      OR user_is_org_admin(org_id)
      OR is_super_admin()
    )
  );

-- Fix: Users can update own requisitions
DROP POLICY IF EXISTS "Users can update own requisitions" ON requisitions;
CREATE POLICY "Users can update own requisitions"
  ON requisitions FOR UPDATE
  TO authenticated
  USING (
    ((org_id IS NULL) OR user_belongs_to_org(org_id))
    AND (
      submitted_by = (SELECT auth.uid())
      OR user_is_org_admin(org_id)
    )
  );

-- Fix: Users can delete requisitions
DROP POLICY IF EXISTS "Users can delete requisitions" ON requisitions;
CREATE POLICY "Users can delete requisitions"
  ON requisitions FOR DELETE
  TO authenticated
  USING (
    is_super_admin()
    OR (
      (SELECT auth.uid()) = submitted_by
      AND status = 'draft'
    )
  );

-- =====================================================
-- REQUISITION_ITEMS TABLE - Remove duplicates, fix remaining
-- =====================================================
DROP POLICY IF EXISTS "Users can view requisition items in their organization" ON requisition_items;
DROP POLICY IF EXISTS "Users can manage requisition items" ON requisition_items;

-- Fix: Users can view requisition items
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
        OR is_super_admin()
      )
    )
  );

-- Fix: Users can update requisition items
DROP POLICY IF EXISTS "Users can update requisition items" ON requisition_items;
CREATE POLICY "Users can update requisition items"
  ON requisition_items FOR UPDATE
  TO authenticated
  USING (
    user_belongs_to_org(org_id)
    AND (
      EXISTS (
        SELECT 1 FROM requisitions r
        WHERE r.id = requisition_items.requisition_id
        AND r.submitted_by = (SELECT auth.uid())
      )
      OR user_is_org_admin(org_id)
    )
  );

-- Fix: Users can delete requisition items
DROP POLICY IF EXISTS "Users can delete requisition items" ON requisition_items;
CREATE POLICY "Users can delete requisition items"
  ON requisition_items FOR DELETE
  TO authenticated
  USING (
    user_belongs_to_org(org_id)
    AND (
      EXISTS (
        SELECT 1 FROM requisitions r
        WHERE r.id = requisition_items.requisition_id
        AND r.submitted_by = (SELECT auth.uid())
      )
      OR user_is_org_admin(org_id)
    )
  );

-- =====================================================
-- REQUISITION_TEMPLATES TABLE - Fix auth.uid() calls
-- =====================================================
DROP POLICY IF EXISTS "Users can view own templates" ON requisition_templates;
CREATE POLICY "Users can view own templates"
  ON requisition_templates FOR SELECT
  TO authenticated
  USING (
    created_by = (SELECT auth.uid())
    OR ((org_id IS NOT NULL) AND user_belongs_to_org(org_id))
  );

DROP POLICY IF EXISTS "Users can update own templates" ON requisition_templates;
CREATE POLICY "Users can update own templates"
  ON requisition_templates FOR UPDATE
  TO authenticated
  USING (created_by = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Users can delete own templates" ON requisition_templates;
CREATE POLICY "Users can delete own templates"
  ON requisition_templates FOR DELETE
  TO authenticated
  USING (created_by = (SELECT auth.uid()));

-- =====================================================
-- REQUISITION_TEMPLATE_ITEMS TABLE - Fix auth.uid() calls
-- =====================================================
DROP POLICY IF EXISTS "Users can view own template items" ON requisition_template_items;
CREATE POLICY "Users can view own template items"
  ON requisition_template_items FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM requisition_templates
      WHERE requisition_templates.id = requisition_template_items.template_id
      AND requisition_templates.created_by = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can update own template items" ON requisition_template_items;
CREATE POLICY "Users can update own template items"
  ON requisition_template_items FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM requisition_templates
      WHERE requisition_templates.id = requisition_template_items.template_id
      AND requisition_templates.created_by = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can delete own template items" ON requisition_template_items;
CREATE POLICY "Users can delete own template items"
  ON requisition_template_items FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM requisition_templates
      WHERE requisition_templates.id = requisition_template_items.template_id
      AND requisition_templates.created_by = (SELECT auth.uid())
    )
  );

-- =====================================================
-- COMMENTS TABLE - Fix auth.uid() calls
-- =====================================================
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
        OR is_super_admin()
      )
    )
  );

DROP POLICY IF EXISTS "Users can update own comments" ON comments;
CREATE POLICY "Users can update own comments"
  ON comments FOR UPDATE
  TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Users can delete own comments" ON comments;
CREATE POLICY "Users can delete own comments"
  ON comments FOR DELETE
  TO authenticated
  USING (user_id = (SELECT auth.uid()));

-- =====================================================
-- ATTACHMENTS TABLE - Fix auth.uid() calls
-- =====================================================
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
        OR is_super_admin()
      )
    )
  );

DROP POLICY IF EXISTS "Users can delete own attachments" ON attachments;
CREATE POLICY "Users can delete own attachments"
  ON attachments FOR DELETE
  TO authenticated
  USING (uploaded_by = (SELECT auth.uid()));

-- =====================================================
-- NOTIFICATIONS TABLE - Fix auth.uid() calls
-- =====================================================
DROP POLICY IF EXISTS "Users can view their org notifications" ON notifications;
CREATE POLICY "Users can view their org notifications"
  ON notifications FOR SELECT
  TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    AND ((org_id IS NULL) OR user_belongs_to_org(org_id))
  );

DROP POLICY IF EXISTS "Users can update their own notifications" ON notifications;
CREATE POLICY "Users can update their own notifications"
  ON notifications FOR UPDATE
  TO authenticated
  USING (
    user_belongs_to_org(org_id)
    AND user_id = (SELECT auth.uid())
  );

DROP POLICY IF EXISTS "Users can delete their own notifications" ON notifications;
CREATE POLICY "Users can delete their own notifications"
  ON notifications FOR DELETE
  TO authenticated
  USING (
    user_belongs_to_org(org_id)
    AND (
      user_id = (SELECT auth.uid())
      OR user_is_org_admin(org_id)
    )
  );

-- =====================================================
-- EMAIL_NOTIFICATIONS TABLE - Fix auth.uid() calls
-- =====================================================
DROP POLICY IF EXISTS "Admins can view all email notifications" ON email_notifications;
CREATE POLICY "Admins can view all email notifications"
  ON email_notifications FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = (SELECT auth.uid())
      AND users.role = 'super_admin'
    )
  );

-- =====================================================
-- FISCAL_YEAR_SETTINGS TABLE - Fix auth.uid() calls
-- =====================================================
DROP POLICY IF EXISTS "Only admins can update fiscal year settings" ON fiscal_year_settings;
CREATE POLICY "Only admins can update fiscal year settings"
  ON fiscal_year_settings FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = (SELECT auth.uid())
      AND users.role = 'super_admin'
    )
  );

-- =====================================================
-- ITEMS TABLE - Fix auth.uid() calls
-- =====================================================
DROP POLICY IF EXISTS "Users can update items" ON items;
CREATE POLICY "Users can update items"
  ON items FOR UPDATE
  TO authenticated
  USING (
    user_belongs_to_org(org_id)
    AND (
      created_by = (SELECT auth.uid())
      OR user_is_org_admin(org_id)
      OR is_super_admin()
      OR get_user_role() = 'store_manager'
    )
  );

-- =====================================================
-- PURCHASE_ORDERS TABLE - Fix auth.uid() calls
-- =====================================================
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
        OR is_super_admin()
      )
    )
  );

-- =====================================================
-- PO_ITEMS TABLE - Fix auth.uid() calls
-- =====================================================
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
        OR is_super_admin()
      )
    )
  );

-- =====================================================
-- RECEIPT_ITEMS TABLE - Fix auth.uid() calls
-- =====================================================
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
        OR is_super_admin()
      )
    )
  );

-- =====================================================
-- USER_PROJECT_ASSIGNMENTS TABLE - Fix auth.uid() calls
-- =====================================================
DROP POLICY IF EXISTS "Users can view project assignments" ON user_project_assignments;
CREATE POLICY "Users can view project assignments"
  ON user_project_assignments FOR SELECT
  TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    OR user_is_org_admin(org_id)
    OR is_super_admin()
  );

-- =====================================================
-- VERIFICATION
-- =====================================================
DO $$
DECLARE
  unfixed_count INTEGER;
BEGIN
  -- Count remaining unfixed policies
  SELECT COUNT(*) INTO unfixed_count
  FROM pg_policies
  WHERE schemaname = 'public'
    AND qual::text LIKE '%auth.uid()%'
    AND qual::text NOT LIKE '%(SELECT auth.uid()%';
  
  IF unfixed_count > 0 THEN
    RAISE WARNING 'There are still % policies with unfixed auth.uid() calls', unfixed_count;
  ELSE
    RAISE NOTICE 'SUCCESS: All policies now use (SELECT auth.uid()) pattern';
  END IF;
END $$;

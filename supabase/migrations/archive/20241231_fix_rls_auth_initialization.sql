-- =====================================================
-- Fix RLS Auth Initialization Issues
-- Date: 2024-12-31
-- Issue: 47 RLS policies re-evaluate auth.uid() for each row
-- Solution: Wrap auth.uid() in (SELECT auth.uid()) for one-time evaluation
-- =====================================================

-- Performance impact: Significant improvement for queries on large tables
-- Auth functions will be evaluated ONCE instead of for EACH ROW

-- =====================================================
-- APPROVAL_WORKFLOWS (1 policy)
-- =====================================================

DROP POLICY IF EXISTS "Only admins can manage approval workflows" ON approval_workflows;
CREATE POLICY "Only admins can manage approval workflows" ON approval_workflows
  FOR ALL
  USING (EXISTS (
    SELECT 1 FROM users
    WHERE users.id = (SELECT auth.uid())
      AND users.role = 'super_admin'::user_role
  ));

-- =====================================================
-- ATTACHMENTS (3 policies)
-- =====================================================

DROP POLICY IF EXISTS "Users can delete own attachments" ON attachments;
CREATE POLICY "Users can delete own attachments" ON attachments
  FOR DELETE
  USING (uploaded_by = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Users can upload attachments" ON attachments;
CREATE POLICY "Users can upload attachments" ON attachments
  FOR INSERT
  WITH CHECK (
    uploaded_by = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1 FROM requisitions r
      WHERE r.id = attachments.requisition_id
        AND r.submitted_by = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can view attachments" ON attachments;
CREATE POLICY "Users can view attachments" ON attachments
  FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM requisitions r
    WHERE r.id = attachments.requisition_id
      AND (
        r.submitted_by = (SELECT auth.uid())
        OR is_assigned_to_project(r.project_id)
        OR is_super_admin()
      )
  ));

-- =====================================================
-- CATEGORIES (4 policies)
-- =====================================================

DROP POLICY IF EXISTS "Super admin can create categories" ON categories;
CREATE POLICY "Super admin can create categories" ON categories
  FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM users
    WHERE users.id = (SELECT auth.uid())
      AND users.role = 'super_admin'::user_role
  ));

DROP POLICY IF EXISTS "Super admin can delete categories" ON categories;
CREATE POLICY "Super admin can delete categories" ON categories
  FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM users
    WHERE users.id = (SELECT auth.uid())
      AND users.role = 'super_admin'::user_role
  ));

DROP POLICY IF EXISTS "Super admin can update categories" ON categories;
CREATE POLICY "Super admin can update categories" ON categories
  FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM users
    WHERE users.id = (SELECT auth.uid())
      AND users.role = 'super_admin'::user_role
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM users
    WHERE users.id = (SELECT auth.uid())
      AND users.role = 'super_admin'::user_role
  ));

DROP POLICY IF EXISTS "Super admin can view all categories" ON categories;
CREATE POLICY "Super admin can view all categories" ON categories
  FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM users
    WHERE users.id = (SELECT auth.uid())
      AND users.role = 'super_admin'::user_role
  ));

-- =====================================================
-- COMMENTS (4 policies)
-- =====================================================

DROP POLICY IF EXISTS "Users can add comments" ON comments;
CREATE POLICY "Users can add comments" ON comments
  FOR INSERT
  WITH CHECK (
    user_id = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1 FROM requisitions r
      WHERE r.id = comments.requisition_id
        AND (
          r.submitted_by = (SELECT auth.uid())
          OR is_assigned_to_project(r.project_id)
          OR is_super_admin()
        )
    )
  );

DROP POLICY IF EXISTS "Users can delete own comments" ON comments;
CREATE POLICY "Users can delete own comments" ON comments
  FOR DELETE
  USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Users can update own comments" ON comments;
CREATE POLICY "Users can update own comments" ON comments
  FOR UPDATE
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Users can view comments" ON comments;
CREATE POLICY "Users can view comments" ON comments
  FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM requisitions r
    WHERE r.id = comments.requisition_id
      AND (
        r.submitted_by = (SELECT auth.uid())
        OR is_assigned_to_project(r.project_id)
        OR is_super_admin()
      )
  ));

-- =====================================================
-- EMAIL_NOTIFICATIONS (1 policy)
-- =====================================================

DROP POLICY IF EXISTS "Admins can view all email notifications" ON email_notifications;
CREATE POLICY "Admins can view all email notifications" ON email_notifications
  FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM users
    WHERE users.id = (SELECT auth.uid())
      AND users.role = 'super_admin'::user_role
  ));

-- =====================================================
-- FISCAL_YEAR_SETTINGS (1 policy)
-- =====================================================

DROP POLICY IF EXISTS "Only admins can update fiscal year settings" ON fiscal_year_settings;
CREATE POLICY "Only admins can update fiscal year settings" ON fiscal_year_settings
  FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM users
    WHERE users.id = (SELECT auth.uid())
      AND users.role = 'super_admin'::user_role
  ));

-- =====================================================
-- NOTIFICATIONS (3 policies)
-- =====================================================

DROP POLICY IF EXISTS "Users can delete their own notifications" ON notifications;
CREATE POLICY "Users can delete their own notifications" ON notifications
  FOR DELETE
  USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update own notifications" ON notifications;
CREATE POLICY "Users can update own notifications" ON notifications
  FOR UPDATE
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Users can view their own notifications" ON notifications;
CREATE POLICY "Users can view their own notifications" ON notifications
  FOR SELECT
  USING ((SELECT auth.uid()) = user_id);

-- =====================================================
-- ORGANIZATION_SETTINGS (2 policies)
-- =====================================================

DROP POLICY IF EXISTS "Admins can insert organization settings" ON organization_settings;
CREATE POLICY "Admins can insert organization settings" ON organization_settings
  FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM users
    WHERE users.id = (SELECT auth.uid())
      AND users.role = 'super_admin'::user_role
  ));

DROP POLICY IF EXISTS "Only admins can update organization settings" ON organization_settings;
CREATE POLICY "Only admins can update organization settings" ON organization_settings
  FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM users
    WHERE users.id = (SELECT auth.uid())
      AND users.role = 'super_admin'::user_role
  ));

-- =====================================================
-- PO_ITEMS (1 policy)
-- =====================================================

DROP POLICY IF EXISTS "Users can view PO items" ON po_items;
CREATE POLICY "Users can view PO items" ON po_items
  FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM purchase_orders po
    JOIN requisitions r ON r.id = po.requisition_id
    WHERE po.id = po_items.po_id
      AND (
        r.submitted_by = (SELECT auth.uid())
        OR is_assigned_to_project(r.project_id)
        OR is_super_admin()
      )
  ));

-- =====================================================
-- PURCHASE_ORDERS (1 policy)
-- =====================================================

DROP POLICY IF EXISTS "Users can view purchase orders" ON purchase_orders;
CREATE POLICY "Users can view purchase orders" ON purchase_orders
  FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM requisitions r
    WHERE r.id = purchase_orders.requisition_id
      AND (
        r.submitted_by = (SELECT auth.uid())
        OR is_assigned_to_project(r.project_id)
        OR is_super_admin()
      )
  ));

-- =====================================================
-- RECEIPT_ITEMS (1 policy)
-- =====================================================

DROP POLICY IF EXISTS "Users can view receipt items" ON receipt_items;
CREATE POLICY "Users can view receipt items" ON receipt_items
  FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM receipt_transactions rt
    JOIN purchase_orders po ON po.id = rt.po_id
    JOIN requisitions r ON r.id = po.requisition_id
    WHERE rt.id = receipt_items.receipt_id
      AND (
        r.submitted_by = (SELECT auth.uid())
        OR is_assigned_to_project(r.project_id)
        OR is_super_admin()
      )
  ));

-- =====================================================
-- RECEIPT_TRANSACTIONS (1 policy)
-- =====================================================

DROP POLICY IF EXISTS "Users can view receipts" ON receipt_transactions;
CREATE POLICY "Users can view receipts" ON receipt_transactions
  FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM purchase_orders po
    JOIN requisitions r ON r.id = po.requisition_id
    WHERE po.id = receipt_transactions.po_id
      AND (
        r.submitted_by = (SELECT auth.uid())
        OR is_assigned_to_project(r.project_id)
        OR is_super_admin()
      )
  ));

-- =====================================================
-- REQUISITION_ITEMS (5 policies)
-- =====================================================

DROP POLICY IF EXISTS "admins_all_access_items" ON requisition_items;
CREATE POLICY "admins_all_access_items" ON requisition_items
  FOR ALL
  USING (EXISTS (
    SELECT 1 FROM users
    WHERE users.id = (SELECT auth.uid())
      AND users.role = 'super_admin'::user_role
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM users
    WHERE users.id = (SELECT auth.uid())
      AND users.role = 'super_admin'::user_role
  ));

DROP POLICY IF EXISTS "users_delete_own_requisition_items" ON requisition_items;
CREATE POLICY "users_delete_own_requisition_items" ON requisition_items
  FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM requisitions
    WHERE requisitions.id = requisition_items.requisition_id
      AND requisitions.submitted_by = (SELECT auth.uid())
      AND requisitions.status = 'draft'::requisition_status
  ));

DROP POLICY IF EXISTS "users_insert_own_requisition_items" ON requisition_items;
CREATE POLICY "users_insert_own_requisition_items" ON requisition_items
  FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM requisitions
    WHERE requisitions.id = requisition_items.requisition_id
      AND requisitions.submitted_by = (SELECT auth.uid())
  ));

DROP POLICY IF EXISTS "users_update_own_requisition_items" ON requisition_items;
CREATE POLICY "users_update_own_requisition_items" ON requisition_items
  FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM requisitions
    WHERE requisitions.id = requisition_items.requisition_id
      AND requisitions.submitted_by = (SELECT auth.uid())
      AND requisitions.status = 'draft'::requisition_status
  ));

DROP POLICY IF EXISTS "users_view_requisition_items" ON requisition_items;
CREATE POLICY "users_view_requisition_items" ON requisition_items
  FOR SELECT
  USING (EXISTS (
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
  ));

-- =====================================================
-- REQUISITION_TEMPLATE_ITEMS (4 policies)
-- =====================================================

DROP POLICY IF EXISTS "Users can create own template items" ON requisition_template_items;
CREATE POLICY "Users can create own template items" ON requisition_template_items
  FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM requisition_templates
    WHERE requisition_templates.id = requisition_template_items.template_id
      AND requisition_templates.created_by = (SELECT auth.uid())
  ));

DROP POLICY IF EXISTS "Users can delete own template items" ON requisition_template_items;
CREATE POLICY "Users can delete own template items" ON requisition_template_items
  FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM requisition_templates
    WHERE requisition_templates.id = requisition_template_items.template_id
      AND requisition_templates.created_by = (SELECT auth.uid())
  ));

DROP POLICY IF EXISTS "Users can update own template items" ON requisition_template_items;
CREATE POLICY "Users can update own template items" ON requisition_template_items
  FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM requisition_templates
    WHERE requisition_templates.id = requisition_template_items.template_id
      AND requisition_templates.created_by = (SELECT auth.uid())
  ));

DROP POLICY IF EXISTS "Users can view own template items" ON requisition_template_items;
CREATE POLICY "Users can view own template items" ON requisition_template_items
  FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM requisition_templates
    WHERE requisition_templates.id = requisition_template_items.template_id
      AND requisition_templates.created_by = (SELECT auth.uid())
  ));

-- =====================================================
-- REQUISITION_TEMPLATES (4 policies)
-- =====================================================

DROP POLICY IF EXISTS "Users can create own templates" ON requisition_templates;
CREATE POLICY "Users can create own templates" ON requisition_templates
  FOR INSERT
  WITH CHECK ((SELECT auth.uid()) = created_by);

DROP POLICY IF EXISTS "Users can delete own templates" ON requisition_templates;
CREATE POLICY "Users can delete own templates" ON requisition_templates
  FOR DELETE
  USING ((SELECT auth.uid()) = created_by);

DROP POLICY IF EXISTS "Users can update own templates" ON requisition_templates;
CREATE POLICY "Users can update own templates" ON requisition_templates
  FOR UPDATE
  USING ((SELECT auth.uid()) = created_by);

DROP POLICY IF EXISTS "Users can view own templates" ON requisition_templates;
CREATE POLICY "Users can view own templates" ON requisition_templates
  FOR SELECT
  USING ((SELECT auth.uid()) = created_by);

-- =====================================================
-- REQUISITIONS (9 policies)
-- =====================================================

DROP POLICY IF EXISTS "admins_all_access_requisitions" ON requisitions;
CREATE POLICY "admins_all_access_requisitions" ON requisitions
  FOR ALL
  USING (EXISTS (
    SELECT 1 FROM users
    WHERE users.id = (SELECT auth.uid())
      AND users.role = 'super_admin'::user_role
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM users
    WHERE users.id = (SELECT auth.uid())
      AND users.role = 'super_admin'::user_role
  ));

DROP POLICY IF EXISTS "admins_bypass_workflow" ON requisitions;
CREATE POLICY "admins_bypass_workflow" ON requisitions
  FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM users
    WHERE users.id = (SELECT auth.uid())
      AND users.role = 'super_admin'::user_role
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM users
    WHERE users.id = (SELECT auth.uid())
      AND users.role = 'super_admin'::user_role
  ));

DROP POLICY IF EXISTS "approvers_update_requisitions" ON requisitions;
CREATE POLICY "approvers_update_requisitions" ON requisitions
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = (SELECT auth.uid())
        AND users.role = ANY (ARRAY['approver'::user_role, 'super_admin'::user_role])
    )
    AND status = 'reviewed'::requisition_status
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = (SELECT auth.uid())
        AND users.role = ANY (ARRAY['approver'::user_role, 'super_admin'::user_role])
    )
    AND status = ANY (ARRAY['approved'::requisition_status, 'rejected'::requisition_status])
  );

DROP POLICY IF EXISTS "authenticated_users_insert_own_requisitions" ON requisitions;
CREATE POLICY "authenticated_users_insert_own_requisitions" ON requisitions
  FOR INSERT
  WITH CHECK ((SELECT auth.uid()) = submitted_by);

DROP POLICY IF EXISTS "reviewers_update_requisitions" ON requisitions;
CREATE POLICY "reviewers_update_requisitions" ON requisitions
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = (SELECT auth.uid())
        AND users.role = ANY (ARRAY['reviewer'::user_role, 'super_admin'::user_role])
    )
    AND status = ANY (ARRAY['pending'::requisition_status, 'under_review'::requisition_status])
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = (SELECT auth.uid())
        AND users.role = ANY (ARRAY['reviewer'::user_role, 'super_admin'::user_role])
    )
    AND status = ANY (ARRAY['under_review'::requisition_status, 'reviewed'::requisition_status])
  );

DROP POLICY IF EXISTS "reviewers_view_all_requisitions" ON requisitions;
CREATE POLICY "reviewers_view_all_requisitions" ON requisitions
  FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM users
    WHERE users.id = (SELECT auth.uid())
      AND users.role = ANY (ARRAY[
        'reviewer'::user_role,
        'approver'::user_role,
        'store_manager'::user_role,
        'super_admin'::user_role
      ])
  ));

DROP POLICY IF EXISTS "users_delete_own_drafts" ON requisitions;
CREATE POLICY "users_delete_own_drafts" ON requisitions
  FOR DELETE
  USING (
    (SELECT auth.uid()) = submitted_by
    AND status = 'draft'::requisition_status
  );

DROP POLICY IF EXISTS "users_update_own_drafts" ON requisitions;
CREATE POLICY "users_update_own_drafts" ON requisitions
  FOR UPDATE
  USING (
    (SELECT auth.uid()) = submitted_by
    AND status = 'draft'::requisition_status
  )
  WITH CHECK (
    (SELECT auth.uid()) = submitted_by
    AND status = ANY (ARRAY['draft'::requisition_status, 'pending'::requisition_status])
  );

DROP POLICY IF EXISTS "users_view_own_requisitions" ON requisitions;
CREATE POLICY "users_view_own_requisitions" ON requisitions
  FOR SELECT
  USING ((SELECT auth.uid()) = submitted_by);

-- =====================================================
-- USER_PROJECT_ASSIGNMENTS (1 policy)
-- =====================================================

DROP POLICY IF EXISTS "Users can view own assignments" ON user_project_assignments;
CREATE POLICY "Users can view own assignments" ON user_project_assignments
  FOR SELECT
  USING (user_id = (SELECT auth.uid()));

-- =====================================================
-- USERS (2 policies)
-- =====================================================

DROP POLICY IF EXISTS "Users can update own profile" ON users;
CREATE POLICY "Users can update own profile" ON users
  FOR UPDATE
  USING ((SELECT auth.uid()) = id)
  WITH CHECK ((SELECT auth.uid()) = id);

DROP POLICY IF EXISTS "Users can view own profile" ON users;
CREATE POLICY "Users can view own profile" ON users
  FOR SELECT
  USING ((SELECT auth.uid()) = id);

-- =====================================================
-- Verify all policies are optimized
-- =====================================================

SELECT
  schemaname,
  tablename,
  policyname,
  cmd as action,
  CASE
    WHEN qual LIKE '%auth.uid()%' AND qual NOT LIKE '%(SELECT auth.uid()%' THEN '❌ USING needs fix'
    ELSE '✅ USING optimized'
  END as using_status,
  CASE
    WHEN with_check LIKE '%auth.uid()%' AND with_check NOT LIKE '%(SELECT auth.uid()%' THEN '❌ WITH CHECK needs fix'
    ELSE '✅ WITH CHECK optimized'
  END as with_check_status
FROM pg_policies
WHERE schemaname = 'public'
  AND (
    (qual LIKE '%auth.uid()%' AND qual NOT LIKE '%(SELECT auth.uid()%')
    OR
    (with_check LIKE '%auth.uid()%' AND with_check NOT LIKE '%(SELECT auth.uid()%')
  )
ORDER BY tablename, policyname;

-- Expected result: No rows (all policies optimized)

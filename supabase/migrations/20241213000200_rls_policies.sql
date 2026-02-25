-- =====================================================
-- PCM Requisition System - Row Level Security Policies
-- Sprint 1: Database Security
-- =====================================================

-- =====================================================
-- HELPER FUNCTIONS FOR RLS
-- =====================================================

-- Function to get current user's role
CREATE OR REPLACE FUNCTION get_user_role()
RETURNS user_role AS $$
  SELECT role FROM users WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER;

-- Function to check if user is super admin
CREATE OR REPLACE FUNCTION is_super_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM users
    WHERE id = auth.uid() AND role = 'super_admin'
  );
$$ LANGUAGE sql SECURITY DEFINER;

-- Function to check if user has role in a project
CREATE OR REPLACE FUNCTION has_project_role(project_uuid UUID, required_role user_role)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_project_assignments
    WHERE user_id = auth.uid()
      AND project_id = project_uuid
      AND role = required_role
      AND is_active = true
  );
$$ LANGUAGE sql SECURITY DEFINER;

-- Function to check if user is assigned to a project (any role)
CREATE OR REPLACE FUNCTION is_assigned_to_project(project_uuid UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_project_assignments
    WHERE user_id = auth.uid()
      AND project_id = project_uuid
      AND is_active = true
  );
$$ LANGUAGE sql SECURITY DEFINER;

-- Function to check if user owns a requisition
CREATE OR REPLACE FUNCTION owns_requisition(req_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM requisitions
    WHERE id = req_id AND submitted_by = auth.uid()
  );
$$ LANGUAGE sql SECURITY DEFINER;

-- Function to check if user can review requisition
CREATE OR REPLACE FUNCTION can_review_requisition(req_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM requisitions r
    INNER JOIN user_project_assignments upa
      ON upa.project_id = r.project_id
    WHERE r.id = req_id
      AND upa.user_id = auth.uid()
      AND upa.role IN ('reviewer', 'approver', 'super_admin')
      AND upa.is_active = true
  );
$$ LANGUAGE sql SECURITY DEFINER;

-- Function to check if user can approve requisition
CREATE OR REPLACE FUNCTION can_approve_requisition(req_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM requisitions r
    INNER JOIN user_project_assignments upa
      ON upa.project_id = r.project_id
    WHERE r.id = req_id
      AND upa.user_id = auth.uid()
      AND upa.role IN ('approver', 'super_admin')
      AND upa.is_active = true
  );
$$ LANGUAGE sql SECURITY DEFINER;

-- =====================================================
-- ENABLE RLS ON ALL TABLES
-- =====================================================

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE expense_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE uom_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE items ENABLE ROW LEVEL SECURITY;
ALTER TABLE account_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_project_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE requisitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE requisition_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE po_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE receipt_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE receipt_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- USERS TABLE POLICIES
-- =====================================================

-- Users can view their own profile
CREATE POLICY "Users can view own profile"
  ON users FOR SELECT
  USING (auth.uid() = id);

-- Users can view other active users (for mentions, assignments)
CREATE POLICY "Users can view other active users"
  ON users FOR SELECT
  USING (is_active = true);

-- Users can update their own profile
CREATE POLICY "Users can update own profile"
  ON users FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Super admins can manage all users
CREATE POLICY "Super admins can manage users"
  ON users FOR ALL
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

-- =====================================================
-- PROJECTS TABLE POLICIES
-- =====================================================

-- Users can view projects they're assigned to
CREATE POLICY "Users can view assigned projects"
  ON projects FOR SELECT
  USING (
    is_assigned_to_project(id) OR is_super_admin()
  );

-- Super admins can manage projects
CREATE POLICY "Super admins can manage projects"
  ON projects FOR ALL
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

-- =====================================================
-- EXPENSE ACCOUNTS TABLE POLICIES
-- =====================================================

-- All authenticated users can view expense accounts
CREATE POLICY "Authenticated users can view expense accounts"
  ON expense_accounts FOR SELECT
  TO authenticated
  USING (is_active = true);

-- Super admins can manage expense accounts
CREATE POLICY "Super admins can manage expense accounts"
  ON expense_accounts FOR ALL
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

-- =====================================================
-- PROJECT ACCOUNTS TABLE POLICIES
-- =====================================================

-- Users can view project accounts for their projects
CREATE POLICY "Users can view project accounts"
  ON project_accounts FOR SELECT
  USING (
    is_assigned_to_project(project_id) OR is_super_admin()
  );

-- Super admins and approvers can manage project accounts
CREATE POLICY "Admins can manage project accounts"
  ON project_accounts FOR ALL
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

-- =====================================================
-- UOM TYPES TABLE POLICIES
-- =====================================================

-- All authenticated users can view UOM types
CREATE POLICY "Authenticated users can view UOM types"
  ON uom_types FOR SELECT
  TO authenticated
  USING (is_active = true);

-- Super admins can manage UOM types
CREATE POLICY "Super admins can manage UOM types"
  ON uom_types FOR ALL
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

-- =====================================================
-- ITEMS TABLE POLICIES
-- =====================================================

-- All authenticated users can view active items
CREATE POLICY "Authenticated users can view items"
  ON items FOR SELECT
  TO authenticated
  USING (is_active = true);

-- Super admins and store managers can manage items
CREATE POLICY "Admins and store managers can manage items"
  ON items FOR ALL
  USING (
    is_super_admin() OR
    get_user_role() = 'store_manager'
  )
  WITH CHECK (
    is_super_admin() OR
    get_user_role() = 'store_manager'
  );

-- =====================================================
-- ACCOUNT ITEMS TABLE POLICIES
-- =====================================================

-- Users can view account items for their projects
CREATE POLICY "Users can view account items"
  ON account_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM project_accounts pa
      WHERE pa.id = account_items.project_account_id
        AND (is_assigned_to_project(pa.project_id) OR is_super_admin())
    )
  );

-- Admins and approvers can manage account items
CREATE POLICY "Admins can manage account items"
  ON account_items FOR ALL
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

-- =====================================================
-- USER PROJECT ASSIGNMENTS TABLE POLICIES
-- =====================================================

-- Users can view their own assignments
CREATE POLICY "Users can view own assignments"
  ON user_project_assignments FOR SELECT
  USING (user_id = auth.uid());

-- Super admins can view all assignments
CREATE POLICY "Super admins can view all assignments"
  ON user_project_assignments FOR SELECT
  USING (is_super_admin());

-- Super admins can manage assignments
CREATE POLICY "Super admins can manage assignments"
  ON user_project_assignments FOR ALL
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

-- =====================================================
-- REQUISITIONS TABLE POLICIES
-- =====================================================

-- Users can view requisitions they submitted
CREATE POLICY "Users can view own requisitions"
  ON requisitions FOR SELECT
  USING (submitted_by = auth.uid());

-- Users can view requisitions for projects they're assigned to
CREATE POLICY "Users can view project requisitions"
  ON requisitions FOR SELECT
  USING (is_assigned_to_project(project_id));

-- Super admins can view all requisitions
CREATE POLICY "Super admins can view all requisitions"
  ON requisitions FOR SELECT
  USING (is_super_admin());

-- Users can create requisitions for projects they're assigned to
CREATE POLICY "Users can create requisitions"
  ON requisitions FOR INSERT
  WITH CHECK (
    is_assigned_to_project(project_id) AND
    submitted_by = auth.uid()
  );

-- Users can update their own draft requisitions
CREATE POLICY "Users can update own draft requisitions"
  ON requisitions FOR UPDATE
  USING (
    submitted_by = auth.uid() AND status = 'draft'
  )
  WITH CHECK (
    submitted_by = auth.uid() AND status = 'draft'
  );

-- Reviewers can update requisitions under review
CREATE POLICY "Reviewers can update requisitions"
  ON requisitions FOR UPDATE
  USING (can_review_requisition(id))
  WITH CHECK (can_review_requisition(id));

-- Approvers can approve/reject requisitions
CREATE POLICY "Approvers can manage requisitions"
  ON requisitions FOR UPDATE
  USING (can_approve_requisition(id))
  WITH CHECK (can_approve_requisition(id));

-- Super admins can manage all requisitions
CREATE POLICY "Super admins can manage all requisitions"
  ON requisitions FOR ALL
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

-- =====================================================
-- REQUISITION ITEMS TABLE POLICIES
-- =====================================================

-- Users can view items for requisitions they can see
CREATE POLICY "Users can view requisition items"
  ON requisition_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM requisitions r
      WHERE r.id = requisition_items.requisition_id
        AND (
          r.submitted_by = auth.uid() OR
          is_assigned_to_project(r.project_id) OR
          is_super_admin()
        )
    )
  );

-- Users can manage items for their own draft requisitions
CREATE POLICY "Users can manage own requisition items"
  ON requisition_items FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM requisitions r
      WHERE r.id = requisition_items.requisition_id
        AND r.submitted_by = auth.uid()
        AND r.status = 'draft'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM requisitions r
      WHERE r.id = requisition_items.requisition_id
        AND r.submitted_by = auth.uid()
        AND r.status = 'draft'
    )
  );

-- Super admins can manage all requisition items
CREATE POLICY "Super admins can manage requisition items"
  ON requisition_items FOR ALL
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

-- =====================================================
-- COMMENTS TABLE POLICIES
-- =====================================================

-- Users can view comments on requisitions they can see
CREATE POLICY "Users can view comments"
  ON comments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM requisitions r
      WHERE r.id = comments.requisition_id
        AND (
          r.submitted_by = auth.uid() OR
          is_assigned_to_project(r.project_id) OR
          is_super_admin()
        )
    )
  );

-- Users can add comments to requisitions they can see
CREATE POLICY "Users can add comments"
  ON comments FOR INSERT
  WITH CHECK (
    user_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM requisitions r
      WHERE r.id = comments.requisition_id
        AND (
          r.submitted_by = auth.uid() OR
          is_assigned_to_project(r.project_id) OR
          is_super_admin()
        )
    )
  );

-- Users can update their own comments
CREATE POLICY "Users can update own comments"
  ON comments FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Users can delete their own comments
CREATE POLICY "Users can delete own comments"
  ON comments FOR DELETE
  USING (user_id = auth.uid());

-- =====================================================
-- ATTACHMENTS TABLE POLICIES
-- =====================================================

-- Users can view attachments for requisitions they can see
CREATE POLICY "Users can view attachments"
  ON attachments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM requisitions r
      WHERE r.id = attachments.requisition_id
        AND (
          r.submitted_by = auth.uid() OR
          is_assigned_to_project(r.project_id) OR
          is_super_admin()
        )
    )
  );

-- Users can upload attachments to their requisitions
CREATE POLICY "Users can upload attachments"
  ON attachments FOR INSERT
  WITH CHECK (
    uploaded_by = auth.uid() AND
    EXISTS (
      SELECT 1 FROM requisitions r
      WHERE r.id = attachments.requisition_id
        AND r.submitted_by = auth.uid()
    )
  );

-- Users can delete their own attachments
CREATE POLICY "Users can delete own attachments"
  ON attachments FOR DELETE
  USING (uploaded_by = auth.uid());

-- =====================================================
-- PURCHASE ORDERS TABLE POLICIES
-- =====================================================

-- Users can view POs for requisitions they can see
CREATE POLICY "Users can view purchase orders"
  ON purchase_orders FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM requisitions r
      WHERE r.id = purchase_orders.requisition_id
        AND (
          r.submitted_by = auth.uid() OR
          is_assigned_to_project(r.project_id) OR
          is_super_admin()
        )
    )
  );

-- Approvers and store managers can manage POs
CREATE POLICY "Authorized users can manage purchase orders"
  ON purchase_orders FOR ALL
  USING (
    is_super_admin() OR
    get_user_role() IN ('approver', 'store_manager')
  )
  WITH CHECK (
    is_super_admin() OR
    get_user_role() IN ('approver', 'store_manager')
  );

-- =====================================================
-- PO ITEMS TABLE POLICIES
-- =====================================================

-- Users can view PO items for POs they can see
CREATE POLICY "Users can view PO items"
  ON po_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM purchase_orders po
      INNER JOIN requisitions r ON r.id = po.requisition_id
      WHERE po.id = po_items.po_id
        AND (
          r.submitted_by = auth.uid() OR
          is_assigned_to_project(r.project_id) OR
          is_super_admin()
        )
    )
  );

-- Authorized users can manage PO items
CREATE POLICY "Authorized users can manage PO items"
  ON po_items FOR ALL
  USING (
    is_super_admin() OR
    get_user_role() IN ('approver', 'store_manager')
  )
  WITH CHECK (
    is_super_admin() OR
    get_user_role() IN ('approver', 'store_manager')
  );

-- =====================================================
-- RECEIPT TRANSACTIONS TABLE POLICIES
-- =====================================================

-- Users can view receipts for POs they can see
CREATE POLICY "Users can view receipts"
  ON receipt_transactions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM purchase_orders po
      INNER JOIN requisitions r ON r.id = po.requisition_id
      WHERE po.id = receipt_transactions.po_id
        AND (
          r.submitted_by = auth.uid() OR
          is_assigned_to_project(r.project_id) OR
          is_super_admin()
        )
    )
  );

-- Store managers can manage receipts
CREATE POLICY "Store managers can manage receipts"
  ON receipt_transactions FOR ALL
  USING (
    is_super_admin() OR
    get_user_role() = 'store_manager'
  )
  WITH CHECK (
    is_super_admin() OR
    get_user_role() = 'store_manager'
  );

-- =====================================================
-- RECEIPT ITEMS TABLE POLICIES
-- =====================================================

-- Users can view receipt items for receipts they can see
CREATE POLICY "Users can view receipt items"
  ON receipt_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM receipt_transactions rt
      INNER JOIN purchase_orders po ON po.id = rt.po_id
      INNER JOIN requisitions r ON r.id = po.requisition_id
      WHERE rt.id = receipt_items.receipt_id
        AND (
          r.submitted_by = auth.uid() OR
          is_assigned_to_project(r.project_id) OR
          is_super_admin()
        )
    )
  );

-- Store managers can manage receipt items
CREATE POLICY "Store managers can manage receipt items"
  ON receipt_items FOR ALL
  USING (
    is_super_admin() OR
    get_user_role() = 'store_manager'
  )
  WITH CHECK (
    is_super_admin() OR
    get_user_role() = 'store_manager'
  );

-- =====================================================
-- AUDIT LOGS TABLE POLICIES
-- =====================================================

-- Only super admins can view audit logs
CREATE POLICY "Super admins can view audit logs"
  ON audit_logs FOR SELECT
  USING (is_super_admin());

-- System can insert audit logs (via service role)
CREATE POLICY "System can insert audit logs"
  ON audit_logs FOR INSERT
  WITH CHECK (true);

-- =====================================================
-- NOTIFICATIONS TABLE POLICIES
-- =====================================================

-- Users can view their own notifications
CREATE POLICY "Users can view own notifications"
  ON notifications FOR SELECT
  USING (user_id = auth.uid());

-- Users can update their own notifications (mark as read)
CREATE POLICY "Users can update own notifications"
  ON notifications FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- System can create notifications (via service role)
CREATE POLICY "System can create notifications"
  ON notifications FOR INSERT
  WITH CHECK (true);

-- Users can delete their own notifications
CREATE POLICY "Users can delete own notifications"
  ON notifications FOR DELETE
  USING (user_id = auth.uid());

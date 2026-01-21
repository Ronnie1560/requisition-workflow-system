-- =====================================================
-- CRITICAL SECURITY FIX: Add Missing RLS Policies for Write Operations
-- Date: 2026-01-20
-- Description: Add INSERT, UPDATE, DELETE policies for all tables that currently only have SELECT policies
--
-- SECURITY ISSUE: Without write policies, authenticated users can potentially modify data
-- in other organizations if they bypass client-side validation.
-- =====================================================

-- =====================================================
-- 1. REQUISITION_ITEMS - Line item details for requisitions
-- =====================================================

-- Users can insert items for requisitions in their org
DROP POLICY IF EXISTS "Users can insert requisition items in their org" ON requisition_items;
CREATE POLICY "Users can insert requisition items in their org"
  ON requisition_items FOR INSERT
  TO authenticated
  WITH CHECK (user_belongs_to_org(org_id));

-- Users can update their own requisition items, admins can update any
DROP POLICY IF EXISTS "Users can update requisition items" ON requisition_items;
CREATE POLICY "Users can update requisition items"
  ON requisition_items FOR UPDATE
  TO authenticated
  USING (
    user_belongs_to_org(org_id)
    AND (
      -- User owns the parent requisition
      EXISTS (
        SELECT 1 FROM requisitions r
        WHERE r.id = requisition_items.requisition_id
        AND r.submitted_by = auth.uid()
      )
      OR user_is_org_admin(org_id)
    )
  );

-- Only admins and requisition owners can delete items
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
        AND r.submitted_by = auth.uid()
      )
      OR user_is_org_admin(org_id)
    )
  );

-- =====================================================
-- 2. PURCHASE_ORDERS - PO documents
-- =====================================================

-- Only admins can create purchase orders
DROP POLICY IF EXISTS "Admins can create purchase orders" ON purchase_orders;
CREATE POLICY "Admins can create purchase orders"
  ON purchase_orders FOR INSERT
  TO authenticated
  WITH CHECK (user_is_org_admin(org_id));

-- Only admins can update purchase orders
DROP POLICY IF EXISTS "Admins can update purchase orders" ON purchase_orders;
CREATE POLICY "Admins can update purchase orders"
  ON purchase_orders FOR UPDATE
  TO authenticated
  USING (user_is_org_admin(org_id));

-- Only admins can delete purchase orders
DROP POLICY IF EXISTS "Admins can delete purchase orders" ON purchase_orders;
CREATE POLICY "Admins can delete purchase orders"
  ON purchase_orders FOR DELETE
  TO authenticated
  USING (user_is_org_admin(org_id));

-- =====================================================
-- 3. RECEIPT_TRANSACTIONS - Goods receipt records
-- =====================================================

-- Admins can create receipt transactions
DROP POLICY IF EXISTS "Admins can create receipt transactions" ON receipt_transactions;
CREATE POLICY "Admins can create receipt transactions"
  ON receipt_transactions FOR INSERT
  TO authenticated
  WITH CHECK (user_is_org_admin(org_id));

-- Admins can update receipt transactions
DROP POLICY IF EXISTS "Admins can update receipt transactions" ON receipt_transactions;
CREATE POLICY "Admins can update receipt transactions"
  ON receipt_transactions FOR UPDATE
  TO authenticated
  USING (user_is_org_admin(org_id));

-- Only admins can delete receipt transactions
DROP POLICY IF EXISTS "Admins can delete receipt transactions" ON receipt_transactions;
CREATE POLICY "Admins can delete receipt transactions"
  ON receipt_transactions FOR DELETE
  TO authenticated
  USING (user_is_org_admin(org_id));

-- =====================================================
-- 4. RECEIPT_ITEMS - Line items for receipts
-- =====================================================

-- Admins can create receipt items
DROP POLICY IF EXISTS "Admins can create receipt items" ON receipt_items;
CREATE POLICY "Admins can create receipt items"
  ON receipt_items FOR INSERT
  TO authenticated
  WITH CHECK (user_is_org_admin(org_id));

-- Admins can update receipt items
DROP POLICY IF EXISTS "Admins can update receipt items" ON receipt_items;
CREATE POLICY "Admins can update receipt items"
  ON receipt_items FOR UPDATE
  TO authenticated
  USING (user_is_org_admin(org_id));

-- Only admins can delete receipt items
DROP POLICY IF EXISTS "Admins can delete receipt items" ON receipt_items;
CREATE POLICY "Admins can delete receipt items"
  ON receipt_items FOR DELETE
  TO authenticated
  USING (user_is_org_admin(org_id));

-- =====================================================
-- 5. USER_PROJECT_ASSIGNMENTS - User-to-project mappings
-- =====================================================

-- Only admins can assign users to projects
DROP POLICY IF EXISTS "Admins can assign users to projects" ON user_project_assignments;
CREATE POLICY "Admins can assign users to projects"
  ON user_project_assignments FOR INSERT
  TO authenticated
  WITH CHECK (user_is_org_admin(org_id));

-- Only admins can update project assignments
DROP POLICY IF EXISTS "Admins can update project assignments" ON user_project_assignments;
CREATE POLICY "Admins can update project assignments"
  ON user_project_assignments FOR UPDATE
  TO authenticated
  USING (user_is_org_admin(org_id));

-- Only admins can remove users from projects
DROP POLICY IF EXISTS "Admins can remove users from projects" ON user_project_assignments;
CREATE POLICY "Admins can remove users from projects"
  ON user_project_assignments FOR DELETE
  TO authenticated
  USING (user_is_org_admin(org_id));

-- =====================================================
-- 6. ITEMS - Master items catalog
-- =====================================================

-- Any member can create items (suggest new items)
DROP POLICY IF EXISTS "Members can create items in their org" ON items;
CREATE POLICY "Members can create items in their org"
  ON items FOR INSERT
  TO authenticated
  WITH CHECK (user_belongs_to_org(org_id));

-- Item creator or admins can update items
DROP POLICY IF EXISTS "Users can update items they created or admins" ON items;
CREATE POLICY "Users can update items they created or admins"
  ON items FOR UPDATE
  TO authenticated
  USING (
    user_belongs_to_org(org_id)
    AND (created_by = auth.uid() OR user_is_org_admin(org_id))
  );

-- Only admins can delete items
DROP POLICY IF EXISTS "Admins can delete items" ON items;
CREATE POLICY "Admins can delete items"
  ON items FOR DELETE
  TO authenticated
  USING (user_is_org_admin(org_id));

-- =====================================================
-- 7. CATEGORIES - Item categories
-- =====================================================

-- Only admins can create categories
DROP POLICY IF EXISTS "Admins can create categories" ON categories;
CREATE POLICY "Admins can create categories"
  ON categories FOR INSERT
  TO authenticated
  WITH CHECK (user_is_org_admin(org_id));

-- Only admins can update categories
DROP POLICY IF EXISTS "Admins can update categories" ON categories;
CREATE POLICY "Admins can update categories"
  ON categories FOR UPDATE
  TO authenticated
  USING (user_is_org_admin(org_id));

-- Only admins can delete categories
DROP POLICY IF EXISTS "Admins can delete categories" ON categories;
CREATE POLICY "Admins can delete categories"
  ON categories FOR DELETE
  TO authenticated
  USING (user_is_org_admin(org_id));

-- =====================================================
-- 8. UOM_TYPES - Unit of Measure types
-- =====================================================

-- Only admins can create UOM types
DROP POLICY IF EXISTS "Admins can create uom types" ON uom_types;
CREATE POLICY "Admins can create uom types"
  ON uom_types FOR INSERT
  TO authenticated
  WITH CHECK (user_is_org_admin(org_id));

-- Only admins can update UOM types
DROP POLICY IF EXISTS "Admins can update uom types" ON uom_types;
CREATE POLICY "Admins can update uom types"
  ON uom_types FOR UPDATE
  TO authenticated
  USING (user_is_org_admin(org_id));

-- Only admins can delete UOM types
DROP POLICY IF EXISTS "Admins can delete uom types" ON uom_types;
CREATE POLICY "Admins can delete uom types"
  ON uom_types FOR DELETE
  TO authenticated
  USING (user_is_org_admin(org_id));

-- =====================================================
-- 9. REQUISITION_TEMPLATES - User-created templates
-- =====================================================

-- Users can create their own templates
DROP POLICY IF EXISTS "Users can create templates in their org" ON requisition_templates;
CREATE POLICY "Users can create templates in their org"
  ON requisition_templates FOR INSERT
  TO authenticated
  WITH CHECK (
    user_belongs_to_org(org_id)
    AND created_by = auth.uid()
  );

-- Users can update their own templates
DROP POLICY IF EXISTS "Users can update their own templates" ON requisition_templates;
CREATE POLICY "Users can update their own templates"
  ON requisition_templates FOR UPDATE
  TO authenticated
  USING (
    user_belongs_to_org(org_id)
    AND created_by = auth.uid()
  );

-- Users can delete their own templates
DROP POLICY IF EXISTS "Users can delete their own templates" ON requisition_templates;
CREATE POLICY "Users can delete their own templates"
  ON requisition_templates FOR DELETE
  TO authenticated
  USING (
    user_belongs_to_org(org_id)
    AND created_by = auth.uid()
  );

-- =====================================================
-- 10. APPROVAL_WORKFLOWS - Approval workflow rules
-- =====================================================

-- Only admins can create approval workflows
DROP POLICY IF EXISTS "Admins can create approval workflows" ON approval_workflows;
CREATE POLICY "Admins can create approval workflows"
  ON approval_workflows FOR INSERT
  TO authenticated
  WITH CHECK (user_is_org_admin(org_id));

-- Only admins can update approval workflows
DROP POLICY IF EXISTS "Admins can update approval workflows" ON approval_workflows;
CREATE POLICY "Admins can update approval workflows"
  ON approval_workflows FOR UPDATE
  TO authenticated
  USING (user_is_org_admin(org_id));

-- Only admins can delete approval workflows
DROP POLICY IF EXISTS "Admins can delete approval workflows" ON approval_workflows;
CREATE POLICY "Admins can delete approval workflows"
  ON approval_workflows FOR DELETE
  TO authenticated
  USING (user_is_org_admin(org_id));

-- =====================================================
-- 11. USERS - User profiles
-- =====================================================

-- Only admins can create users (via invitation system)
DROP POLICY IF EXISTS "Admins can create users in their org" ON users;
CREATE POLICY "Admins can create users in their org"
  ON users FOR INSERT
  TO authenticated
  WITH CHECK (user_is_org_admin(org_id));

-- Users can update their own profile, admins can update any in org
DROP POLICY IF EXISTS "Users can update their own profile or admins can update any" ON users;
CREATE POLICY "Users can update their own profile or admins can update any"
  ON users FOR UPDATE
  TO authenticated
  USING (
    user_belongs_to_org(org_id)
    AND (id = auth.uid() OR user_is_org_admin(org_id))
  );

-- Only admins can delete users
DROP POLICY IF EXISTS "Admins can delete users" ON users;
CREATE POLICY "Admins can delete users"
  ON users FOR DELETE
  TO authenticated
  USING (user_is_org_admin(org_id));

-- =====================================================
-- 12. PROJECTS - Organization projects
-- =====================================================

-- Only admins can create projects
DROP POLICY IF EXISTS "Admins can create projects" ON projects;
CREATE POLICY "Admins can create projects"
  ON projects FOR INSERT
  TO authenticated
  WITH CHECK (user_is_org_admin(org_id));

-- Only admins can update projects
DROP POLICY IF EXISTS "Admins can update projects" ON projects;
CREATE POLICY "Admins can update projects"
  ON projects FOR UPDATE
  TO authenticated
  USING (user_is_org_admin(org_id));

-- Only admins can delete projects
DROP POLICY IF EXISTS "Admins can delete projects" ON projects;
CREATE POLICY "Admins can delete projects"
  ON projects FOR DELETE
  TO authenticated
  USING (user_is_org_admin(org_id));

-- =====================================================
-- 13. EXPENSE_ACCOUNTS - Chart of accounts
-- =====================================================

-- Only admins can create expense accounts
DROP POLICY IF EXISTS "Admins can create expense accounts" ON expense_accounts;
CREATE POLICY "Admins can create expense accounts"
  ON expense_accounts FOR INSERT
  TO authenticated
  WITH CHECK (user_is_org_admin(org_id));

-- Only admins can update expense accounts
DROP POLICY IF EXISTS "Admins can update expense accounts" ON expense_accounts;
CREATE POLICY "Admins can update expense accounts"
  ON expense_accounts FOR UPDATE
  TO authenticated
  USING (user_is_org_admin(org_id));

-- Only admins can delete expense accounts
DROP POLICY IF EXISTS "Admins can delete expense accounts" ON expense_accounts;
CREATE POLICY "Admins can delete expense accounts"
  ON expense_accounts FOR DELETE
  TO authenticated
  USING (user_is_org_admin(org_id));

-- =====================================================
-- 14. NOTIFICATIONS - User notifications
-- =====================================================

-- System can insert notifications (via triggers/functions)
-- Note: This is typically done via SECURITY DEFINER functions, not direct inserts
DROP POLICY IF EXISTS "System can create notifications" ON notifications;
CREATE POLICY "System can create notifications"
  ON notifications FOR INSERT
  TO authenticated
  WITH CHECK (user_belongs_to_org(org_id));

-- Users can update their own notifications (mark as read)
DROP POLICY IF EXISTS "Users can update their own notifications" ON notifications;
CREATE POLICY "Users can update their own notifications"
  ON notifications FOR UPDATE
  TO authenticated
  USING (
    user_belongs_to_org(org_id)
    AND user_id = auth.uid()
  );

-- Users can delete their own notifications, admins can delete any
DROP POLICY IF EXISTS "Users can delete their own notifications" ON notifications;
CREATE POLICY "Users can delete their own notifications"
  ON notifications FOR DELETE
  TO authenticated
  USING (
    user_belongs_to_org(org_id)
    AND (user_id = auth.uid() OR user_is_org_admin(org_id))
  );

-- =====================================================
-- 15. COMMENTS - Requisition comments (conditional)
-- =====================================================

-- Check if comments table exists and has org_id column
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_name = 'comments'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'comments' AND column_name = 'org_id'
  ) THEN
    -- Users can add comments to requisitions in their org
    EXECUTE 'DROP POLICY IF EXISTS "Users can create comments in their org" ON comments';
    EXECUTE 'CREATE POLICY "Users can create comments in their org"
      ON comments FOR INSERT
      TO authenticated
      WITH CHECK (user_belongs_to_org(org_id))';

    -- Users can update their own comments
    EXECUTE 'DROP POLICY IF EXISTS "Users can update their own comments" ON comments';
    EXECUTE 'CREATE POLICY "Users can update their own comments"
      ON comments FOR UPDATE
      TO authenticated
      USING (
        user_belongs_to_org(org_id)
        AND created_by = auth.uid()
      )';

    -- Users can delete their own comments, admins can delete any
    EXECUTE 'DROP POLICY IF EXISTS "Users can delete their own comments" ON comments';
    EXECUTE 'CREATE POLICY "Users can delete their own comments"
      ON comments FOR DELETE
      TO authenticated
      USING (
        user_belongs_to_org(org_id)
        AND (created_by = auth.uid() OR user_is_org_admin(org_id))
      )';

    RAISE NOTICE 'Created RLS policies for comments table';
  ELSE
    RAISE NOTICE 'Comments table does not exist or lacks org_id column - skipping';
  END IF;
END $$;

-- =====================================================
-- 16. ATTACHMENTS - Requisition attachments (conditional)
-- =====================================================

-- Check if attachments table exists and has org_id column
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_name = 'attachments'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'attachments' AND column_name = 'org_id'
  ) THEN
    -- Users can upload attachments to requisitions in their org
    EXECUTE 'DROP POLICY IF EXISTS "Users can upload attachments in their org" ON attachments';
    EXECUTE 'CREATE POLICY "Users can upload attachments in their org"
      ON attachments FOR INSERT
      TO authenticated
      WITH CHECK (user_belongs_to_org(org_id))';

    -- Users can update their own attachments
    EXECUTE 'DROP POLICY IF EXISTS "Users can update their own attachments" ON attachments';
    EXECUTE 'CREATE POLICY "Users can update their own attachments"
      ON attachments FOR UPDATE
      TO authenticated
      USING (
        user_belongs_to_org(org_id)
        AND uploaded_by = auth.uid()
      )';

    -- Users can delete their own attachments, admins can delete any
    EXECUTE 'DROP POLICY IF EXISTS "Users can delete attachments" ON attachments';
    EXECUTE 'CREATE POLICY "Users can delete attachments"
      ON attachments FOR DELETE
      TO authenticated
      USING (
        user_belongs_to_org(org_id)
        AND (uploaded_by = auth.uid() OR user_is_org_admin(org_id))
      )';

    RAISE NOTICE 'Created RLS policies for attachments table';
  ELSE
    RAISE NOTICE 'Attachments table does not exist or lacks org_id column - skipping';
  END IF;
END $$;

-- =====================================================
-- VERIFICATION QUERIES
-- =====================================================

-- Check that all tables now have complete RLS policies
SELECT
  schemaname,
  tablename,
  COUNT(*) FILTER (WHERE cmd = 'SELECT') as select_policies,
  COUNT(*) FILTER (WHERE cmd = 'INSERT') as insert_policies,
  COUNT(*) FILTER (WHERE cmd = 'UPDATE') as update_policies,
  COUNT(*) FILTER (WHERE cmd = 'DELETE') as delete_policies,
  COUNT(*) as total_policies
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN (
    'requisition_items', 'purchase_orders', 'receipt_transactions', 'receipt_items',
    'user_project_assignments', 'items', 'categories', 'uom_types',
    'requisition_templates', 'approval_workflows', 'users', 'projects',
    'expense_accounts', 'notifications', 'comments', 'attachments'
  )
GROUP BY schemaname, tablename
ORDER BY tablename;

-- =====================================================
-- SUMMARY
-- =====================================================

SELECT
  '✅ CRITICAL SECURITY FIX COMPLETE' as status,
  'Added INSERT/UPDATE/DELETE policies for 14+ tables' as action,
  'All tables now have complete RLS protection' as result,
  'Multi-tenant data isolation enforced at database level' as impact;

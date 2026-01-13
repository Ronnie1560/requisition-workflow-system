-- =====================================================
-- SECURITY FIX: Overly Permissive SELECT Policies
-- Adds org-based filtering to SELECT policies that were "true"
-- This prevents cross-organization data leakage
-- =====================================================

-- =====================================================
-- STEP 0: Create helper function for super_admin check
-- =====================================================

CREATE OR REPLACE FUNCTION is_super_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM users
    WHERE id = auth.uid()
      AND role = 'super_admin'
      AND is_active = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION is_super_admin() IS 'Checks if current user has super_admin role';

-- =====================================================
-- 1. FIX: approval_workflows - SELECT was true
-- =====================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'approval_workflows') THEN
    EXECUTE 'DROP POLICY IF EXISTS "Users can view approval workflows" ON approval_workflows';
    EXECUTE 'DROP POLICY IF EXISTS "Users can view org workflows" ON approval_workflows';
    EXECUTE 'CREATE POLICY "Users can view org workflows"
      ON approval_workflows FOR SELECT TO authenticated
      USING (org_id IS NULL OR user_belongs_to_org(org_id))';
  END IF;
END $$;

-- =====================================================
-- 2. FIX: expense_accounts - SELECT was true
-- =====================================================

DROP POLICY IF EXISTS "Users can view expense accounts" ON expense_accounts;
DROP POLICY IF EXISTS "Users can view org expense accounts" ON expense_accounts;
CREATE POLICY "Users can view org expense accounts"
  ON expense_accounts FOR SELECT TO authenticated
  USING (org_id IS NULL OR user_belongs_to_org(org_id));

-- =====================================================
-- 3. FIX: fiscal_year_settings - SELECT was true
-- =====================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'fiscal_year_settings') THEN
    EXECUTE 'DROP POLICY IF EXISTS "Anyone can view fiscal year settings" ON fiscal_year_settings';
    EXECUTE 'DROP POLICY IF EXISTS "Users can view fiscal year settings" ON fiscal_year_settings';
    EXECUTE 'CREATE POLICY "Users can view fiscal year settings"
      ON fiscal_year_settings FOR SELECT TO authenticated
      USING (org_id IS NULL OR user_belongs_to_org(org_id))';
  END IF;
END $$;

-- =====================================================
-- 4. FIX: items - SELECT was true
-- =====================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'items') THEN
    EXECUTE 'DROP POLICY IF EXISTS "Users can view items" ON items';
    EXECUTE 'CREATE POLICY "Users can view items"
      ON items FOR SELECT TO authenticated
      USING (org_id IS NULL OR user_belongs_to_org(org_id))';
  END IF;
END $$;

-- =====================================================
-- 5. FIX: email_notifications - UPDATE was true
-- This is a system table - restrict to super_admin only
-- =====================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'email_notifications') THEN
    EXECUTE 'DROP POLICY IF EXISTS "System can update email notifications" ON email_notifications';
    EXECUTE 'DROP POLICY IF EXISTS "Super admins can update email notifications" ON email_notifications';
    EXECUTE 'CREATE POLICY "Super admins can update email notifications"
      ON email_notifications FOR UPDATE TO authenticated
      USING (is_super_admin())';
  END IF;
END $$;

-- =====================================================
-- 6. FIX: categories - Add org filter if missing
-- =====================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'categories') THEN
    EXECUTE 'DROP POLICY IF EXISTS "Users can view categories" ON categories';
    EXECUTE 'CREATE POLICY "Users can view categories"
      ON categories FOR SELECT TO authenticated
      USING (org_id IS NULL OR user_belongs_to_org(org_id))';
  END IF;
END $$;

-- =====================================================
-- 7. FIX: uom_types - Add org filter if missing
-- =====================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'uom_types') THEN
    EXECUTE 'DROP POLICY IF EXISTS "Users can view uom_types" ON uom_types';
    EXECUTE 'CREATE POLICY "Users can view uom_types"
      ON uom_types FOR SELECT TO authenticated
      USING (org_id IS NULL OR user_belongs_to_org(org_id))';
  END IF;
END $$;

-- =====================================================
-- 8. FIX: requisition_templates - Add org filter
-- =====================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'requisition_templates') THEN
    EXECUTE 'DROP POLICY IF EXISTS "Users can view requisition templates" ON requisition_templates';
    EXECUTE 'CREATE POLICY "Users can view requisition templates"
      ON requisition_templates FOR SELECT TO authenticated
      USING (org_id IS NULL OR user_belongs_to_org(org_id))';
  END IF;
END $$;

-- =====================================================
-- 9. CLEANUP: Remove overly permissive INSERT policies
-- =====================================================

-- Remove old permissive requisitions INSERT if exists
DROP POLICY IF EXISTS "Users can insert requisitions" ON requisitions;
-- The correct policy "Users can create requisitions in org" already exists

-- =====================================================
-- 10. ADD: Missing org-based policies for other tables
-- =====================================================

-- user_project_assignments - ensure org filter
DROP POLICY IF EXISTS "Users can view user project assignments" ON user_project_assignments;
CREATE POLICY "Users can view user project assignments"
  ON user_project_assignments FOR SELECT TO authenticated
  USING (org_id IS NULL OR user_belongs_to_org(org_id));

-- purchase_orders - ensure org filter
DROP POLICY IF EXISTS "Users can view purchase orders" ON purchase_orders;
CREATE POLICY "Users can view purchase orders"
  ON purchase_orders FOR SELECT TO authenticated
  USING (org_id IS NULL OR user_belongs_to_org(org_id));

-- receipt_transactions - ensure org filter
DROP POLICY IF EXISTS "Users can view receipt transactions" ON receipt_transactions;
CREATE POLICY "Users can view receipt transactions"
  ON receipt_transactions FOR SELECT TO authenticated
  USING (org_id IS NULL OR user_belongs_to_org(org_id));

-- receipt_items - ensure org filter
DROP POLICY IF EXISTS "Users can view receipt items" ON receipt_items;
CREATE POLICY "Users can view receipt items"
  ON receipt_items FOR SELECT TO authenticated
  USING (org_id IS NULL OR user_belongs_to_org(org_id));

-- requisition_items - ensure org filter
DROP POLICY IF EXISTS "Users can view requisition items" ON requisition_items;
CREATE POLICY "Users can view requisition items"
  ON requisition_items FOR SELECT TO authenticated
  USING (org_id IS NULL OR user_belongs_to_org(org_id));

-- =====================================================
-- 11. VERIFICATION QUERY
-- Run this to verify all policies are correctly set
-- =====================================================

DO $$
DECLARE
  vulnerable_count INTEGER;
BEGIN
  -- Count policies that are still overly permissive
  SELECT COUNT(*) INTO vulnerable_count
  FROM pg_policies
  WHERE schemaname = 'public'
    AND cmd IN ('SELECT', 'INSERT', 'UPDATE', 'DELETE')
    AND qual = 'true'
    AND tablename NOT IN ('audit_logs', 'notifications'); -- System tables are OK with service_role restriction

  IF vulnerable_count > 0 THEN
    RAISE WARNING 'Found % potentially vulnerable policies with qual = true', vulnerable_count;
  ELSE
    RAISE NOTICE 'All policies have proper restrictions ✅';
  END IF;
END $$;

-- =====================================================
-- 12. SUMMARY REPORT
-- =====================================================

SELECT
  tablename,
  policyname,
  cmd as action,
  roles,
  CASE
    WHEN qual LIKE '%user_belongs_to_org%' THEN '✅ SECURE: Has org filter'
    WHEN qual LIKE '%is_super_admin%' THEN '✅ SECURE: Super admin only'
    WHEN qual LIKE '%auth.uid()%' THEN '✅ SECURE: User-specific'
    WHEN qual = 'true' AND roles::text LIKE '%service_role%' THEN '✅ SECURE: Service role only'
    WHEN qual = 'true' THEN '⚠️ WARNING: May be too permissive'
    ELSE '✅ Has restrictions'
  END as security_status,
  LEFT(qual, 80) as policy_condition
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN (
    'users', 'projects', 'user_project_assignments', 'expense_accounts',
    'requisitions', 'requisition_items', 'purchase_orders',
    'receipt_transactions', 'receipt_items', 'notifications',
    'approval_workflows', 'fiscal_year_settings', 'organization_settings',
    'items', 'categories', 'uom_types', 'requisition_templates',
    'audit_logs', 'email_notifications'
  )
ORDER BY
  CASE
    WHEN qual = 'true' AND roles::text NOT LIKE '%service_role%' THEN 1
    ELSE 2
  END,
  tablename,
  cmd;

-- =====================================================
-- COMMENTS
-- =====================================================

COMMENT ON FUNCTION is_super_admin() IS 'Security helper: Checks if current user has super_admin role';

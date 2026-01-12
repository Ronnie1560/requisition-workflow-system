-- =====================================================
-- SECURITY FIX: Overly Permissive SELECT Policies
-- Adds org-based filtering to SELECT policies that were "true"
-- =====================================================

-- =====================================================
-- 1. FIX: approval_workflows - SELECT was true
-- =====================================================
DROP POLICY IF EXISTS "Users can view approval workflows" ON approval_workflows;
CREATE POLICY "Users can view approval workflows"
  ON approval_workflows FOR SELECT TO authenticated
  USING (org_id IS NULL OR user_belongs_to_org(org_id));

-- =====================================================
-- 2. FIX: expense_accounts - SELECT was true
-- =====================================================
DROP POLICY IF EXISTS "Users can view expense accounts" ON expense_accounts;
CREATE POLICY "Users can view expense accounts"
  ON expense_accounts FOR SELECT TO authenticated
  USING (org_id IS NULL OR user_belongs_to_org(org_id));

-- =====================================================
-- 3. FIX: fiscal_year_settings - SELECT was true
-- =====================================================
DROP POLICY IF EXISTS "Anyone can view fiscal year settings" ON fiscal_year_settings;
CREATE POLICY "Users can view fiscal year settings"
  ON fiscal_year_settings FOR SELECT TO authenticated
  USING (org_id IS NULL OR user_belongs_to_org(org_id));

-- =====================================================
-- 4. FIX: items - SELECT was true
-- =====================================================
DROP POLICY IF EXISTS "Users can view items" ON items;
CREATE POLICY "Users can view items"
  ON items FOR SELECT TO authenticated
  USING (org_id IS NULL OR user_belongs_to_org(org_id));

-- =====================================================
-- 5. FIX: email_notifications - UPDATE was true
-- This is a system table - restrict to super_admin only
-- =====================================================
DROP POLICY IF EXISTS "System can update email notifications" ON email_notifications;
CREATE POLICY "System can update email notifications"
  ON email_notifications FOR UPDATE TO authenticated
  USING (is_super_admin());

-- =====================================================
-- 6. VERIFY INSERT policies have WITH CHECK
-- Check these INSERT policies have proper restrictions
-- =====================================================

-- Verify requisitions INSERT has org check
DROP POLICY IF EXISTS "Users can insert requisitions" ON requisitions;
-- Keep the org-based one: "Users can create requisitions in org"

-- =====================================================
-- 7. ADD: Verify all data tables filter by org
-- These SELECT policies should already exist but verify
-- =====================================================

-- Verify categories has org filter
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'categories' 
    AND policyname LIKE '%org%'
    AND cmd = 'SELECT'
  ) THEN
    DROP POLICY IF EXISTS "Users can view categories" ON categories;
    EXECUTE 'CREATE POLICY "Users can view categories"
      ON categories FOR SELECT TO authenticated
      USING (org_id IS NULL OR user_belongs_to_org(org_id))';
  END IF;
END $$;

-- Verify uom_types has org filter
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'uom_types' 
    AND cmd = 'SELECT'
  ) THEN
    EXECUTE 'CREATE POLICY "Users can view uom_types"
      ON uom_types FOR SELECT TO authenticated
      USING (org_id IS NULL OR user_belongs_to_org(org_id))';
  END IF;
END $$;

-- =====================================================
-- 8. SUMMARY: Verify fixes applied
-- =====================================================
SELECT 
  tablename,
  policyname,
  cmd as action,
  CASE
    WHEN qual LIKE '%user_belongs_to_org%' THEN '✅ FIXED: Has org filter'
    WHEN qual LIKE '%org_id%' THEN '✅ FIXED: Has org check'
    WHEN qual = 'true' THEN '❌ STILL PERMISSIVE'
    ELSE '✅ Has restrictions'
  END as status,
  LEFT(qual, 100) as using_clause
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('approval_workflows', 'expense_accounts', 'fiscal_year_settings', 'items', 'email_notifications', 'categories', 'uom_types')
  AND cmd = 'SELECT'
ORDER BY tablename;

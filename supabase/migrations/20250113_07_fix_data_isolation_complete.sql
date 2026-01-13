-- =====================================================
-- FIX: Complete Data Isolation Between Organizations
-- Problem: Existing data has org_id = NULL, making it visible to all orgs
-- Solution: Backfill org_id and remove NULL allowance from RLS policies
-- =====================================================

-- =====================================================
-- STEP 1: Backfill org_id for all existing data
-- Assign all NULL org_id records to Default Organization
-- =====================================================

DO $$
DECLARE
  v_default_org_id UUID;
BEGIN
  -- Get Default Organization ID
  SELECT id INTO v_default_org_id FROM organizations WHERE slug = 'default';

  IF v_default_org_id IS NULL THEN
    RAISE EXCEPTION 'Default organization not found';
  END IF;

  -- Backfill projects
  UPDATE projects
  SET org_id = v_default_org_id
  WHERE org_id IS NULL;
  RAISE NOTICE 'Updated % projects', (SELECT COUNT(*) FROM projects WHERE org_id = v_default_org_id);

  -- Backfill requisitions
  UPDATE requisitions
  SET org_id = v_default_org_id
  WHERE org_id IS NULL;
  RAISE NOTICE 'Updated % requisitions', (SELECT COUNT(*) FROM requisitions WHERE org_id = v_default_org_id);

  -- Backfill users
  UPDATE users
  SET org_id = v_default_org_id
  WHERE org_id IS NULL;
  RAISE NOTICE 'Updated % users', (SELECT COUNT(*) FROM users WHERE org_id = v_default_org_id);

  -- Backfill expense_accounts
  UPDATE expense_accounts
  SET org_id = v_default_org_id
  WHERE org_id IS NULL;
  RAISE NOTICE 'Updated % expense_accounts', (SELECT COUNT(*) FROM expense_accounts WHERE org_id = v_default_org_id);

  -- Backfill purchase_orders
  UPDATE purchase_orders
  SET org_id = v_default_org_id
  WHERE org_id IS NULL;
  RAISE NOTICE 'Updated % purchase_orders', (SELECT COUNT(*) FROM purchase_orders WHERE org_id = v_default_org_id);

  -- Backfill receipt_transactions
  UPDATE receipt_transactions
  SET org_id = v_default_org_id
  WHERE org_id IS NULL;
  RAISE NOTICE 'Updated % receipt_transactions', (SELECT COUNT(*) FROM receipt_transactions WHERE org_id = v_default_org_id);

  -- Backfill receipt_items
  UPDATE receipt_items
  SET org_id = v_default_org_id
  WHERE org_id IS NULL;
  RAISE NOTICE 'Updated % receipt_items', (SELECT COUNT(*) FROM receipt_items WHERE org_id = v_default_org_id);

  -- Backfill requisition_items
  UPDATE requisition_items
  SET org_id = v_default_org_id
  WHERE org_id IS NULL;
  RAISE NOTICE 'Updated % requisition_items', (SELECT COUNT(*) FROM requisition_items WHERE org_id = v_default_org_id);

  -- Backfill user_project_assignments
  UPDATE user_project_assignments
  SET org_id = v_default_org_id
  WHERE org_id IS NULL;
  RAISE NOTICE 'Updated % user_project_assignments', (SELECT COUNT(*) FROM user_project_assignments WHERE org_id = v_default_org_id);

  -- Backfill items (if exists)
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'items') THEN
    EXECUTE 'UPDATE items SET org_id = $1 WHERE org_id IS NULL' USING v_default_org_id;
    RAISE NOTICE 'Updated items table';
  END IF;

  -- Backfill categories (if exists)
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'categories') THEN
    EXECUTE 'UPDATE categories SET org_id = $1 WHERE org_id IS NULL' USING v_default_org_id;
    RAISE NOTICE 'Updated categories table';
  END IF;

  -- Backfill uom_types (if exists)
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'uom_types') THEN
    EXECUTE 'UPDATE uom_types SET org_id = $1 WHERE org_id IS NULL' USING v_default_org_id;
    RAISE NOTICE 'Updated uom_types table';
  END IF;

  -- Backfill requisition_templates (if exists)
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'requisition_templates') THEN
    EXECUTE 'UPDATE requisition_templates SET org_id = $1 WHERE org_id IS NULL' USING v_default_org_id;
    RAISE NOTICE 'Updated requisition_templates table';
  END IF;

  -- Backfill organization_settings
  UPDATE organization_settings
  SET org_id = v_default_org_id
  WHERE org_id IS NULL;
  RAISE NOTICE 'Updated % organization_settings', (SELECT COUNT(*) FROM organization_settings WHERE org_id = v_default_org_id);

  -- Backfill fiscal_year_settings (if exists)
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'fiscal_year_settings') THEN
    EXECUTE 'UPDATE fiscal_year_settings SET org_id = $1 WHERE org_id IS NULL' USING v_default_org_id;
    RAISE NOTICE 'Updated fiscal_year_settings table';
  END IF;

  -- Backfill approval_workflows (if exists)
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'approval_workflows') THEN
    EXECUTE 'UPDATE approval_workflows SET org_id = $1 WHERE org_id IS NULL' USING v_default_org_id;
    RAISE NOTICE 'Updated approval_workflows table';
  END IF;

END $$;

-- =====================================================
-- STEP 2: Update RLS policies to REMOVE "OR org_id IS NULL"
-- Now that all data has org_id, we don't need to allow NULL
-- =====================================================

-- Projects
DROP POLICY IF EXISTS "Users can view their org projects" ON projects;
CREATE POLICY "Users can view their org projects"
  ON projects FOR SELECT TO authenticated
  USING (user_belongs_to_org(org_id));

-- Requisitions
DROP POLICY IF EXISTS "Users can view org requisitions" ON requisitions;
CREATE POLICY "Users can view org requisitions"
  ON requisitions FOR SELECT TO authenticated
  USING (user_belongs_to_org(org_id));

-- Users
DROP POLICY IF EXISTS "Users can view users in their org" ON users;
CREATE POLICY "Users can view users in their org"
  ON users FOR SELECT TO authenticated
  USING (user_belongs_to_org(org_id));

-- Expense Accounts
DROP POLICY IF EXISTS "Users can view org expense accounts" ON expense_accounts;
CREATE POLICY "Users can view org expense accounts"
  ON expense_accounts FOR SELECT TO authenticated
  USING (user_belongs_to_org(org_id));

-- Purchase Orders
DROP POLICY IF EXISTS "Users can view purchase orders" ON purchase_orders;
CREATE POLICY "Users can view purchase orders"
  ON purchase_orders FOR SELECT TO authenticated
  USING (user_belongs_to_org(org_id));

-- Receipt Transactions
DROP POLICY IF EXISTS "Users can view receipt transactions" ON receipt_transactions;
CREATE POLICY "Users can view receipt transactions"
  ON receipt_transactions FOR SELECT TO authenticated
  USING (user_belongs_to_org(org_id));

-- Receipt Items
DROP POLICY IF EXISTS "Users can view receipt items" ON receipt_items;
CREATE POLICY "Users can view receipt items"
  ON receipt_items FOR SELECT TO authenticated
  USING (user_belongs_to_org(org_id));

-- Requisition Items
DROP POLICY IF EXISTS "Users can view requisition items" ON requisition_items;
CREATE POLICY "Users can view requisition items"
  ON requisition_items FOR SELECT TO authenticated
  USING (user_belongs_to_org(org_id));

-- User Project Assignments
DROP POLICY IF EXISTS "Users can view user project assignments" ON user_project_assignments;
CREATE POLICY "Users can view user project assignments"
  ON user_project_assignments FOR SELECT TO authenticated
  USING (user_belongs_to_org(org_id));

-- Optional tables (only update if they exist)
DO $$
BEGIN
  -- Items
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'items') THEN
    EXECUTE 'DROP POLICY IF EXISTS "Users can view items" ON items';
    EXECUTE 'CREATE POLICY "Users can view items" ON items FOR SELECT TO authenticated USING (user_belongs_to_org(org_id))';
  END IF;

  -- Categories
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'categories') THEN
    EXECUTE 'DROP POLICY IF EXISTS "Users can view categories" ON categories';
    EXECUTE 'CREATE POLICY "Users can view categories" ON categories FOR SELECT TO authenticated USING (user_belongs_to_org(org_id))';
  END IF;

  -- UOM Types
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'uom_types') THEN
    EXECUTE 'DROP POLICY IF EXISTS "Users can view uom_types" ON uom_types';
    EXECUTE 'CREATE POLICY "Users can view uom_types" ON uom_types FOR SELECT TO authenticated USING (user_belongs_to_org(org_id))';
  END IF;

  -- Requisition Templates
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'requisition_templates') THEN
    EXECUTE 'DROP POLICY IF EXISTS "Users can view requisition templates" ON requisition_templates';
    EXECUTE 'CREATE POLICY "Users can view requisition templates" ON requisition_templates FOR SELECT TO authenticated USING (user_belongs_to_org(org_id))';
  END IF;

  -- Approval Workflows
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'approval_workflows') THEN
    EXECUTE 'DROP POLICY IF EXISTS "Users can view org workflows" ON approval_workflows';
    EXECUTE 'CREATE POLICY "Users can view org workflows" ON approval_workflows FOR SELECT TO authenticated USING (user_belongs_to_org(org_id))';
  END IF;

  -- Fiscal Year Settings
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'fiscal_year_settings') THEN
    EXECUTE 'DROP POLICY IF EXISTS "Users can view fiscal year settings" ON fiscal_year_settings';
    EXECUTE 'CREATE POLICY "Users can view fiscal year settings" ON fiscal_year_settings FOR SELECT TO authenticated USING (user_belongs_to_org(org_id))';
  END IF;
END $$;

-- =====================================================
-- STEP 3: Verification
-- =====================================================

-- Check that no records have NULL org_id anymore
SELECT
  'Verification: NULL org_id count' as check_name,
  (SELECT COUNT(*) FROM projects WHERE org_id IS NULL) as projects_null,
  (SELECT COUNT(*) FROM requisitions WHERE org_id IS NULL) as requisitions_null,
  (SELECT COUNT(*) FROM users WHERE org_id IS NULL) as users_null,
  (SELECT COUNT(*) FROM expense_accounts WHERE org_id IS NULL) as expense_accounts_null;

-- Show data distribution by organization
SELECT
  'Data Distribution' as section,
  o.name as organization,
  (SELECT COUNT(*) FROM projects WHERE org_id = o.id) as projects,
  (SELECT COUNT(*) FROM requisitions WHERE org_id = o.id) as requisitions,
  (SELECT COUNT(*) FROM users WHERE org_id = o.id) as users
FROM organizations o
ORDER BY o.created_at;

-- =====================================================
-- SUMMARY
-- =====================================================
SELECT '✅ Data isolation fix complete!' as status,
       'All existing data assigned to Default Organization' as step_1,
       'RLS policies updated to enforce strict org filtering' as step_2,
       'No data should leak between organizations now' as result;

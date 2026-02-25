-- =====================================================
-- DIAGNOSIS AND FIX: Multi-Tenant Data Isolation Issues
-- Run this script to:
-- 1. Diagnose why requisitions aren't showing
-- 2. Fix any data issues
-- =====================================================

-- =====================================================
-- STEP 1: DIAGNOSIS - Check current state
-- =====================================================

-- 1a. Check if organizations exist
SELECT 'Organizations' as check_type, COUNT(*) as count FROM organizations;

-- 1b. List all organizations
SELECT id, name, slug, status, created_at 
FROM organizations 
ORDER BY created_at;

-- 1c. Check requisitions with NULL org_id (these won't show up)
SELECT 'Requisitions with NULL org_id' as issue, COUNT(*) as count 
FROM requisitions 
WHERE org_id IS NULL;

-- 1d. Check requisitions grouped by org_id
SELECT 
  COALESCE(o.name, 'NULL (No Org)') as organization,
  o.slug,
  COUNT(r.id) as requisition_count
FROM requisitions r
LEFT JOIN organizations o ON r.org_id = o.id
GROUP BY o.name, o.slug
ORDER BY requisition_count DESC;

-- 1e. Check organization members
SELECT 
  o.name as organization,
  o.slug,
  u.email,
  om.role,
  om.is_active
FROM organization_members om
JOIN organizations o ON om.organization_id = o.id
JOIN auth.users u ON om.user_id = u.id
ORDER BY o.name, om.role;

-- 1f. Check all tables for NULL org_id
SELECT 'projects with NULL org_id' as table_issue, COUNT(*) FROM projects WHERE org_id IS NULL
UNION ALL
SELECT 'requisitions with NULL org_id', COUNT(*) FROM requisitions WHERE org_id IS NULL
UNION ALL
SELECT 'users with NULL org_id', COUNT(*) FROM users WHERE org_id IS NULL
UNION ALL
SELECT 'expense_accounts with NULL org_id', COUNT(*) FROM expense_accounts WHERE org_id IS NULL
UNION ALL
SELECT 'purchase_orders with NULL org_id', COUNT(*) FROM purchase_orders WHERE org_id IS NULL
UNION ALL
SELECT 'receipt_transactions with NULL org_id', COUNT(*) FROM receipt_transactions WHERE org_id IS NULL
UNION ALL
SELECT 'requisition_items with NULL org_id', COUNT(*) FROM requisition_items WHERE org_id IS NULL
UNION ALL
SELECT 'user_project_assignments with NULL org_id', COUNT(*) FROM user_project_assignments WHERE org_id IS NULL;

-- =====================================================
-- STEP 2: FIX - Backfill org_id if needed
-- =====================================================

DO $$
DECLARE
  v_default_org_id UUID;
  v_org_count INTEGER;
  v_needs_fix BOOLEAN := FALSE;
BEGIN
  -- Check if there are any NULL org_ids
  SELECT COUNT(*) > 0 INTO v_needs_fix
  FROM requisitions
  WHERE org_id IS NULL;
  
  IF NOT v_needs_fix THEN
    RAISE NOTICE 'No fix needed - all requisitions have org_id assigned';
    RETURN;
  END IF;
  
  RAISE NOTICE 'Found requisitions with NULL org_id - fixing...';
  
  -- Try to find the default organization
  SELECT id INTO v_default_org_id FROM organizations WHERE slug = 'default';
  
  -- If no default org, use the first organization
  IF v_default_org_id IS NULL THEN
    SELECT id INTO v_default_org_id FROM organizations ORDER BY created_at ASC LIMIT 1;
  END IF;
  
  IF v_default_org_id IS NULL THEN
    RAISE EXCEPTION 'No organizations found. Please create an organization first.';
  END IF;
  
  RAISE NOTICE 'Using organization ID: %', v_default_org_id;
  
  -- Backfill all tables
  UPDATE projects SET org_id = v_default_org_id WHERE org_id IS NULL;
  RAISE NOTICE 'Fixed projects with NULL org_id';
  
  UPDATE requisitions SET org_id = v_default_org_id WHERE org_id IS NULL;
  RAISE NOTICE 'Fixed requisitions with NULL org_id';
  
  UPDATE users SET org_id = v_default_org_id WHERE org_id IS NULL;
  RAISE NOTICE 'Fixed users with NULL org_id';
  
  UPDATE expense_accounts SET org_id = v_default_org_id WHERE org_id IS NULL;
  RAISE NOTICE 'Fixed expense_accounts with NULL org_id';
  
  UPDATE purchase_orders SET org_id = v_default_org_id WHERE org_id IS NULL;
  RAISE NOTICE 'Fixed purchase_orders with NULL org_id';
  
  UPDATE receipt_transactions SET org_id = v_default_org_id WHERE org_id IS NULL;
  RAISE NOTICE 'Fixed receipt_transactions with NULL org_id';
  
  UPDATE receipt_items SET org_id = v_default_org_id WHERE org_id IS NULL;
  RAISE NOTICE 'Fixed receipt_items with NULL org_id';
  
  UPDATE requisition_items SET org_id = v_default_org_id WHERE org_id IS NULL;
  RAISE NOTICE 'Fixed requisition_items with NULL org_id';
  
  UPDATE user_project_assignments SET org_id = v_default_org_id WHERE org_id IS NULL;
  RAISE NOTICE 'Fixed user_project_assignments with NULL org_id';
  
  -- Optional tables
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'items') THEN
    EXECUTE 'UPDATE items SET org_id = $1 WHERE org_id IS NULL' USING v_default_org_id;
    RAISE NOTICE 'Fixed items with NULL org_id';
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'categories') THEN
    EXECUTE 'UPDATE categories SET org_id = $1 WHERE org_id IS NULL' USING v_default_org_id;
    RAISE NOTICE 'Fixed categories with NULL org_id';
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'uom_types') THEN
    EXECUTE 'UPDATE uom_types SET org_id = $1 WHERE org_id IS NULL' USING v_default_org_id;
    RAISE NOTICE 'Fixed uom_types with NULL org_id';
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'notifications') THEN
    EXECUTE 'UPDATE notifications SET org_id = $1 WHERE org_id IS NULL' USING v_default_org_id;
    RAISE NOTICE 'Fixed notifications with NULL org_id';
  END IF;
  
  RAISE NOTICE 'All NULL org_id values have been fixed!';
END $$;

-- =====================================================
-- STEP 3: VERIFY - Check after fix
-- =====================================================

-- 3a. Verify no more NULL org_ids
SELECT 'AFTER FIX - Tables with NULL org_id:' as status;

SELECT 'projects' as table_name, COUNT(*) as null_count FROM projects WHERE org_id IS NULL
UNION ALL
SELECT 'requisitions', COUNT(*) FROM requisitions WHERE org_id IS NULL
UNION ALL
SELECT 'users', COUNT(*) FROM users WHERE org_id IS NULL
UNION ALL
SELECT 'expense_accounts', COUNT(*) FROM expense_accounts WHERE org_id IS NULL;

-- 3b. Final count by organization
SELECT 
  o.name as organization,
  o.slug,
  COUNT(r.id) as requisition_count
FROM requisitions r
JOIN organizations o ON r.org_id = o.id
GROUP BY o.name, o.slug
ORDER BY requisition_count DESC;

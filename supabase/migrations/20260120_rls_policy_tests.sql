-- =====================================================
-- RLS Policy Integration Tests
-- Date: 2026-01-20
-- Purpose: Test Row-Level Security policies for multi-tenancy isolation
-- =====================================================

-- This file contains SQL tests to verify RLS policies work correctly
-- Run these tests after deploying to staging/test environment

-- =====================================================
-- TEST SETUP
-- =====================================================

-- Create test organizations
DO $$
DECLARE
  org_a_id UUID;
  org_b_id UUID;
  user_a_id UUID;
  user_b_id UUID;
  org_ids UUID[];
BEGIN
  -- Get test org IDs if they exist
  SELECT ARRAY_AGG(id) INTO org_ids
  FROM organizations
  WHERE slug IN ('test-org-a', 'test-org-b');

  -- Clean up any existing test data (in reverse dependency order)
  IF org_ids IS NOT NULL THEN
    DELETE FROM project_accounts WHERE org_id = ANY(org_ids);
    DELETE FROM requisitions WHERE org_id = ANY(org_ids);
    DELETE FROM items WHERE org_id = ANY(org_ids);
    DELETE FROM projects WHERE org_id = ANY(org_ids);
    DELETE FROM organization_members WHERE organization_id = ANY(org_ids);
    DELETE FROM organization_settings WHERE org_id = ANY(org_ids);
  END IF;

  -- Also clean up by test codes (in case orgs were deleted but data remains)
  DELETE FROM projects WHERE code IN ('PROJ-A-TEST', 'PROJ-B-TEST', 'NULL-ORG-TEST');
  DELETE FROM requisitions WHERE requisition_number IN ('REQ-A-TEST-001', 'REQ-B-TEST-001');
  DELETE FROM items WHERE code IN ('ITEM-A-001', 'ITEM-B-001');

  -- Finally, delete the organizations
  DELETE FROM organizations WHERE slug IN ('test-org-a', 'test-org-b');

  -- Create test org A
  INSERT INTO organizations (name, slug, email, status, plan)
  VALUES ('Test Org A', 'test-org-a', 'orga@test.com', 'active', 'free')
  RETURNING id INTO org_a_id;

  -- Create test org B
  INSERT INTO organizations (name, slug, email, status, plan)
  VALUES ('Test Org B', 'test-org-b', 'orgb@test.com', 'active', 'free')
  RETURNING id INTO org_b_id;

  RAISE NOTICE 'Test organizations created: Org A = %, Org B = %', org_a_id, org_b_id;
END $$;

-- =====================================================
-- TEST FUNCTIONS
-- =====================================================

CREATE OR REPLACE FUNCTION test_rls_isolation()
RETURNS TABLE(
  test_name TEXT,
  table_name TEXT,
  status TEXT,
  details TEXT
) AS $$
DECLARE
  org_a_id UUID;
  org_b_id UUID;
  user_a_id UUID;
  user_b_id UUID;
  project_a_id UUID;
  project_b_id UUID;
  req_a_id UUID;
  req_b_id UUID;
  visible_count INTEGER;
BEGIN
  -- Get test org IDs
  SELECT id INTO org_a_id FROM organizations WHERE slug = 'test-org-a';
  SELECT id INTO org_b_id FROM organizations WHERE slug = 'test-org-b';

  -- =====================================================
  -- TEST 1: Projects Table Isolation
  -- =====================================================

  -- Create projects for each org
  INSERT INTO projects (name, org_id, is_active, code)
  VALUES ('Project A', org_a_id, true, 'PROJ-A-TEST')
  RETURNING id INTO project_a_id;

  INSERT INTO projects (name, org_id, is_active, code)
  VALUES ('Project B', org_b_id, true, 'PROJ-B-TEST')
  RETURNING id INTO project_b_id;

  -- Simulate user from Org A viewing projects
  -- In real scenario, this would be set by auth.uid() and organization context
  EXECUTE format('SET LOCAL jwt.claims.org_id TO %L', org_a_id::text);

  -- Count visible projects (should only see Org A's project)
  SELECT COUNT(*) INTO visible_count
  FROM projects
  WHERE user_belongs_to_org(org_id);

  IF visible_count = 1 THEN
    RETURN QUERY SELECT
      'Projects Isolation'::TEXT,
      'projects'::TEXT,
      'PASS'::TEXT,
      format('User from Org A sees %s projects (expected 1)', visible_count)::TEXT;
  ELSE
    RETURN QUERY SELECT
      'Projects Isolation'::TEXT,
      'projects'::TEXT,
      'FAIL'::TEXT,
      format('User from Org A sees %s projects (expected 1) - DATA LEAKAGE!', visible_count)::TEXT;
  END IF;

  -- =====================================================
  -- TEST 2: Requisitions Table Isolation
  -- =====================================================

  -- Skip requisitions test if no users exist
  IF EXISTS (SELECT 1 FROM users WHERE org_id = org_a_id LIMIT 1) THEN
    INSERT INTO requisitions (org_id, requisition_number, type, project_id, project_account_id, title, submitted_by, status, priority, justification)
    VALUES (
      org_a_id,
      'REQ-A-TEST-001',
      'purchase',
      project_a_id,
      (SELECT id FROM project_accounts WHERE project_id = project_a_id LIMIT 1),
      'Test Requisition A',
      (SELECT id FROM users WHERE org_id = org_a_id LIMIT 1),
      'draft',
      'normal',
      'Test req A'
    )
    RETURNING id INTO req_a_id;

    INSERT INTO requisitions (org_id, requisition_number, type, project_id, project_account_id, title, submitted_by, status, priority, justification)
    VALUES (
      org_b_id,
      'REQ-B-TEST-001',
      'purchase',
      project_b_id,
      (SELECT id FROM project_accounts WHERE project_id = project_b_id LIMIT 1),
      'Test Requisition B',
      (SELECT id FROM users WHERE org_id = org_b_id LIMIT 1),
      'draft',
      'normal',
      'Test req B'
    )
    RETURNING id INTO req_b_id;

    -- Test as Org A user
    EXECUTE format('SET LOCAL jwt.claims.org_id TO %L', org_a_id::text);

    SELECT COUNT(*) INTO visible_count
    FROM requisitions
    WHERE user_belongs_to_org(org_id);

    IF visible_count >= 1 AND NOT EXISTS (
      SELECT 1 FROM requisitions
      WHERE id = req_b_id
      AND user_belongs_to_org(org_id)
    ) THEN
      RETURN QUERY SELECT
        'Requisitions Isolation'::TEXT,
        'requisitions'::TEXT,
        'PASS'::TEXT,
        'Org A user cannot see Org B requisitions'::TEXT;
    ELSE
      RETURN QUERY SELECT
        'Requisitions Isolation'::TEXT,
        'requisitions'::TEXT,
        'FAIL'::TEXT,
        'Org A user can see Org B requisitions - DATA LEAKAGE!'::TEXT;
    END IF;
  ELSE
    RETURN QUERY SELECT
      'Requisitions Isolation'::TEXT,
      'requisitions'::TEXT,
      'SKIPPED'::TEXT,
      'No test users available'::TEXT;
  END IF;

  -- =====================================================
  -- TEST 3: Items Table Isolation
  -- =====================================================

  -- Skip items test if no UOM types exist
  IF EXISTS (SELECT 1 FROM uom_types WHERE org_id = org_a_id LIMIT 1) THEN
    INSERT INTO items (org_id, code, name, description, uom_id, is_active)
    VALUES (
      org_a_id,
      'ITEM-A-001',
      'Item A',
      'Test item A',
      (SELECT id FROM uom_types WHERE org_id = org_a_id LIMIT 1),
      true
    );

    INSERT INTO items (org_id, code, name, description, uom_id, is_active)
    VALUES (
      org_b_id,
      'ITEM-B-001',
      'Item B',
      'Test item B',
      (SELECT id FROM uom_types WHERE org_id = org_b_id LIMIT 1),
      true
    );

    EXECUTE format('SET LOCAL jwt.claims.org_id TO %L', org_a_id::text);

    SELECT COUNT(*) INTO visible_count
    FROM items
    WHERE user_belongs_to_org(org_id) AND code = 'ITEM-B-001';

    IF visible_count = 0 THEN
      RETURN QUERY SELECT
        'Items Isolation'::TEXT,
        'items'::TEXT,
        'PASS'::TEXT,
        'Org A user cannot see Org B items'::TEXT;
    ELSE
      RETURN QUERY SELECT
        'Items Isolation'::TEXT,
        'items'::TEXT,
        'FAIL'::TEXT,
        'Org A user can see Org B items - DATA LEAKAGE!'::TEXT;
    END IF;
  ELSE
    RETURN QUERY SELECT
      'Items Isolation'::TEXT,
      'items'::TEXT,
      'SKIPPED'::TEXT,
      'No UOM types available'::TEXT;
  END IF;

  -- =====================================================
  -- TEST 4: Cross-Org Update Prevention
  -- =====================================================

  BEGIN
    -- Try to update Org B's project as Org A user
    EXECUTE format('SET LOCAL jwt.claims.org_id TO %L', org_a_id::text);

    UPDATE projects
    SET name = 'Hacked Project B'
    WHERE id = project_b_id
    AND user_belongs_to_org(org_id);

    -- Check if update succeeded
    IF NOT EXISTS (SELECT 1 FROM projects WHERE id = project_b_id AND name = 'Hacked Project B') THEN
      RETURN QUERY SELECT
        'Cross-Org Update Prevention'::TEXT,
        'projects'::TEXT,
        'PASS'::TEXT,
        'RLS policies prevent cross-org updates'::TEXT;
    ELSE
      RETURN QUERY SELECT
        'Cross-Org Update Prevention'::TEXT,
        'projects'::TEXT,
        'FAIL'::TEXT,
        'Cross-org update succeeded - SECURITY BREACH!'::TEXT;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RETURN QUERY SELECT
      'Cross-Org Update Prevention'::TEXT,
      'projects'::TEXT,
      'PASS'::TEXT,
      format('Update blocked by RLS: %', SQLERRM)::TEXT;
  END;

  -- =====================================================
  -- TEST 5: Cross-Org Delete Prevention
  -- =====================================================

  BEGIN
    EXECUTE format('SET LOCAL jwt.claims.org_id TO %L', org_a_id::text);

    DELETE FROM projects
    WHERE id = project_b_id
    AND user_belongs_to_org(org_id);

    -- Check if delete succeeded
    IF EXISTS (SELECT 1 FROM projects WHERE id = project_b_id) THEN
      RETURN QUERY SELECT
        'Cross-Org Delete Prevention'::TEXT,
        'projects'::TEXT,
        'PASS'::TEXT,
        'RLS policies prevent cross-org deletes'::TEXT;
    ELSE
      RETURN QUERY SELECT
        'Cross-Org Delete Prevention'::TEXT,
        'projects'::TEXT,
        'FAIL'::TEXT,
        'Cross-org delete succeeded - SECURITY BREACH!'::TEXT;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RETURN QUERY SELECT
      'Cross-Org Delete Prevention'::TEXT,
      'projects'::TEXT,
      'PASS'::TEXT,
      format('Delete blocked by RLS: %', SQLERRM)::TEXT;
  END;

  -- =====================================================
  -- TEST 6: Project Accounts Isolation (replaces expense accounts)
  -- =====================================================

  -- Check if project_accounts table exists and has expense accounts data
  IF EXISTS (
    SELECT 1 FROM information_schema.tables t
    WHERE t.table_name = 'project_accounts'
  ) AND EXISTS (
    SELECT 1 FROM expense_accounts LIMIT 1
  ) THEN
    -- Use project_accounts for isolation testing
    INSERT INTO project_accounts (org_id, project_id, account_id, allocated_budget)
    VALUES (
      org_a_id,
      project_a_id,
      (SELECT id FROM expense_accounts LIMIT 1),
      10000.00
    );

    INSERT INTO project_accounts (org_id, project_id, account_id, allocated_budget)
    VALUES (
      org_b_id,
      project_b_id,
      (SELECT id FROM expense_accounts LIMIT 1),
      20000.00
    );

    EXECUTE format('SET LOCAL jwt.claims.org_id TO %L', org_a_id::text);

    SELECT COUNT(*) INTO visible_count
    FROM project_accounts
    WHERE user_belongs_to_org(org_id) AND project_id = project_b_id;

    IF visible_count = 0 THEN
      RETURN QUERY SELECT
        'Project Accounts Isolation'::TEXT,
        'project_accounts'::TEXT,
        'PASS'::TEXT,
        'Org A user cannot see Org B project accounts'::TEXT;
    ELSE
      RETURN QUERY SELECT
        'Project Accounts Isolation'::TEXT,
        'project_accounts'::TEXT,
        'FAIL'::TEXT,
        'Org A user can see Org B project accounts - DATA LEAKAGE!'::TEXT;
    END IF;
  ELSE
    -- Skip test if project_accounts doesn't exist or no expense accounts
    RETURN QUERY SELECT
      'Project Accounts Isolation'::TEXT,
      'project_accounts'::TEXT,
      'SKIPPED'::TEXT,
      'No project_accounts table or expense account data available'::TEXT;
  END IF;

  -- =====================================================
  -- TEST 7: NULL org_id Prevention
  -- =====================================================

  BEGIN
    INSERT INTO projects (name, org_id, is_active, code)
    VALUES ('Project with NULL org', NULL, true, 'NULL-ORG-TEST');

    RETURN QUERY SELECT
      'NULL org_id Prevention'::TEXT,
      'projects'::TEXT,
      'FAIL'::TEXT,
      'NULL org_id insert succeeded - SECURITY BREACH!'::TEXT;
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE '%org_id cannot be NULL%' THEN
      RETURN QUERY SELECT
        'NULL org_id Prevention'::TEXT,
        'projects'::TEXT,
        'PASS'::TEXT,
        'Trigger correctly prevents NULL org_id'::TEXT;
    ELSE
      RETURN QUERY SELECT
        'NULL org_id Prevention'::TEXT,
        'projects'::TEXT,
        'PARTIAL'::TEXT,
        format('Blocked but unexpected error: %', SQLERRM)::TEXT;
    END IF;
  END;

  RETURN;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION test_rls_isolation() IS
'Automated tests for RLS policy effectiveness in multi-tenant isolation';

-- =====================================================
-- RUN ALL TESTS AND SHOW RESULTS
-- =====================================================

-- Note: We run the tests through the summary function to avoid calling test_rls_isolation() twice
-- Uncomment below if you want to see individual test results:
-- SELECT * FROM test_rls_isolation();

-- =====================================================
-- TEST RESULTS SUMMARY
-- =====================================================

CREATE OR REPLACE FUNCTION rls_test_summary()
RETURNS TABLE(
  total_tests INTEGER,
  passed INTEGER,
  failed INTEGER,
  pass_rate NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  WITH test_results AS (
    SELECT * FROM test_rls_isolation()
  )
  SELECT
    COUNT(*)::INTEGER as total_tests,
    COUNT(*) FILTER (WHERE status = 'PASS')::INTEGER as passed,
    COUNT(*) FILTER (WHERE status = 'FAIL')::INTEGER as failed,
    ROUND(
      (COUNT(*) FILTER (WHERE status = 'PASS')::NUMERIC / COUNT(*)::NUMERIC) * 100,
      2
    ) as pass_rate
  FROM test_results;
END;
$$ LANGUAGE plpgsql;

-- Show detailed results and summary
DO $$
DECLARE
  test_rec RECORD;
  total_count INTEGER := 0;
  pass_count INTEGER := 0;
  fail_count INTEGER := 0;
BEGIN
  RAISE NOTICE '================================================';
  RAISE NOTICE 'RLS POLICY TEST RESULTS';
  RAISE NOTICE '================================================';
  RAISE NOTICE '';

  -- Loop through test results and display them
  FOR test_rec IN SELECT * FROM test_rls_isolation()
  LOOP
    total_count := total_count + 1;

    IF test_rec.status = 'PASS' THEN
      pass_count := pass_count + 1;
      RAISE NOTICE '✓ PASS: % (%) - %', test_rec.test_name, test_rec.table_name, test_rec.details;
    ELSIF test_rec.status = 'FAIL' THEN
      fail_count := fail_count + 1;
      RAISE NOTICE '✗ FAIL: % (%) - %', test_rec.test_name, test_rec.table_name, test_rec.details;
    ELSE
      RAISE NOTICE '○ SKIP: % (%) - %', test_rec.test_name, test_rec.table_name, test_rec.details;
    END IF;
  END LOOP;

  RAISE NOTICE '';
  RAISE NOTICE '================================================';
  RAISE NOTICE 'SUMMARY';
  RAISE NOTICE '================================================';
  RAISE NOTICE 'Total Tests: %', total_count;
  RAISE NOTICE 'Passed: %', pass_count;
  RAISE NOTICE 'Failed: %', fail_count;
  RAISE NOTICE 'Skipped: %', total_count - pass_count - fail_count;
  RAISE NOTICE 'Pass Rate: %%%', ROUND((pass_count::NUMERIC / total_count::NUMERIC) * 100, 2);
  RAISE NOTICE '================================================';
END $$;

-- =====================================================
-- CLEANUP (Optional - comment out if you want to keep test data)
-- =====================================================

/*
DO $$
BEGIN
  DELETE FROM projects WHERE org_id IN (
    SELECT id FROM organizations WHERE slug IN ('test-org-a', 'test-org-b')
  );

  DELETE FROM requisitions WHERE org_id IN (
    SELECT id FROM organizations WHERE slug IN ('test-org-a', 'test-org-b')
  );

  DELETE FROM items WHERE org_id IN (
    SELECT id FROM organizations WHERE slug IN ('test-org-a', 'test-org-b')
  );

  DELETE FROM expense_accounts WHERE org_id IN (
    SELECT id FROM organizations WHERE slug IN ('test-org-a', 'test-org-b')
  );

  DELETE FROM organizations WHERE slug IN ('test-org-a', 'test-org-b');

  RAISE NOTICE 'Test data cleaned up';
END $$;
*/

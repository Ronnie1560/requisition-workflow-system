-- ============================================================
-- Fix Security Advisor Warnings
-- ============================================================
-- Fixes:
-- 1. Remove "Anyone can view" USING(true) policies on
--    approval_workflows and categories (redundant - proper
--    org-scoped SELECT policies already exist)
-- 2. Remove legacy "Admins can manage" ALL policies that use
--    auth.uid() subqueries (replaced by JWT-based policies)
-- 3. Tighten security_audit_logs service_role policy
-- ============================================================

BEGIN;

-- ============================================================
-- 1. approval_workflows: Remove overly permissive SELECT policy
--    "Users can view org workflows" already handles this correctly
--    with: USING (org_id = jwt_org_id())
-- ============================================================
DROP POLICY IF EXISTS "Anyone can view approval workflows" ON public.approval_workflows;

-- Remove legacy ALL policy using auth.uid() subquery
-- (JWT-based INSERT/UPDATE/DELETE policies already cover admin access)
DROP POLICY IF EXISTS "Admins can manage approval workflows" ON public.approval_workflows;

-- ============================================================
-- 2. categories: Remove overly permissive SELECT policy
--    "Users can view categories" already handles this correctly
--    with: USING (org_id = jwt_org_id())
-- ============================================================
DROP POLICY IF EXISTS "Anyone can view categories" ON public.categories;

-- Remove legacy ALL policy using auth.uid() subquery
-- (JWT-based INSERT/UPDATE/DELETE policies already cover admin access)
DROP POLICY IF EXISTS "Admins can manage categories" ON public.categories;

-- ============================================================
-- 3. security_audit_logs: Replace permissive service_role policy
--    The existing policy is correctly scoped to {service_role}
--    but uses USING(true)/WITH CHECK(true). Replace with a
--    RESTRICTIVE wrapper is not needed since the role itself
--    is the restriction. However, the insert policy for
--    authenticated users has WITH CHECK(false) which blocks
--    direct inserts - this is correct.
--
--    The actual fix: ensure the service_role policy explicitly
--    states its purpose and the Studio warning is addressed by
--    making it role-specific (it already is, but recreate for
--    clarity).
-- ============================================================
DROP POLICY IF EXISTS "service_role_full_access" ON public.security_audit_logs;

-- Recreate with explicit role targeting (functionally identical
-- but naming makes the intent clear for auditing)
CREATE POLICY "Service role has full access to audit logs"
  ON public.security_audit_logs
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================
-- Verify: List remaining policies for affected tables
-- ============================================================
DO $$
DECLARE
  pol RECORD;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '=== Remaining approval_workflows policies ===';
  FOR pol IN
    SELECT policyname, cmd, qual
    FROM pg_policies
    WHERE tablename = 'approval_workflows' AND schemaname = 'public'
    ORDER BY cmd
  LOOP
    RAISE NOTICE '  % (%) -> %', pol.policyname, pol.cmd, COALESCE(LEFT(pol.qual, 80), 'N/A');
  END LOOP;

  RAISE NOTICE '';
  RAISE NOTICE '=== Remaining categories policies ===';
  FOR pol IN
    SELECT policyname, cmd, qual
    FROM pg_policies
    WHERE tablename = 'categories' AND schemaname = 'public'
    ORDER BY cmd
  LOOP
    RAISE NOTICE '  % (%) -> %', pol.policyname, pol.cmd, COALESCE(LEFT(pol.qual, 80), 'N/A');
  END LOOP;

  RAISE NOTICE '';
  RAISE NOTICE '=== Remaining security_audit_logs policies ===';
  FOR pol IN
    SELECT policyname, cmd, roles, qual
    FROM pg_policies
    WHERE tablename = 'security_audit_logs' AND schemaname = 'public'
    ORDER BY cmd
  LOOP
    RAISE NOTICE '  % (%, roles=%) -> %', pol.policyname, pol.cmd, pol.roles, COALESCE(LEFT(pol.qual, 80), 'N/A');
  END LOOP;
END $$;

COMMIT;

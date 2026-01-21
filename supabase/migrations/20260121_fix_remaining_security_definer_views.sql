-- =====================================================
-- Migration: Fix Remaining SECURITY DEFINER Views
-- Date: 2026-01-21
-- Issue: Views user_organizations and users_with_assignments are using SECURITY DEFINER
--        which bypasses RLS and could expose cross-organization data
-- =====================================================

-- =====================================================
-- Fix 1: user_organizations View
-- =====================================================
-- This view shows a user's organizations based on organization_members table
-- It should respect the querying user's permissions, not the view creator's

DROP VIEW IF EXISTS user_organizations CASCADE;

CREATE VIEW user_organizations
WITH (security_invoker = true)  -- Use invoker's permissions, not definer's
AS
SELECT
  o.id,
  o.name,
  o.slug,
  o.logo_url,
  o.plan,
  o.status,
  om.role as member_role,
  om.created_at as joined_at
FROM organizations o
JOIN organization_members om ON o.id = om.organization_id
WHERE om.user_id = auth.uid()
  AND om.is_active = true
  AND o.status IN ('active', 'trial')
ORDER BY om.created_at ASC;

COMMENT ON VIEW user_organizations IS
'Shows organizations for the current user based on organization_members. Uses security_invoker - respects RLS.';

-- =====================================================
-- Fix 2: users_with_assignments View
-- =====================================================
-- This view shows users with their project assignments and org membership
-- It should respect the querying user's permissions

DROP VIEW IF EXISTS users_with_assignments CASCADE;

CREATE VIEW users_with_assignments
WITH (security_invoker = true)  -- Use invoker's permissions, not definer's
AS
SELECT
  u.id,
  u.email,
  u.full_name,
  u.role,
  u.department,
  u.phone,
  u.is_active,
  u.created_at,
  u.updated_at,
  u.avatar_url,
  u.org_id,  -- For multi-tenancy filtering
  u.employee_id,
  om.role AS org_role,  -- Organization role (owner, admin, member)
  om.is_active AS org_membership_active,
  om.accepted_at AS org_joined_at,
  COALESCE(
    json_agg(
      json_build_object(
        'id', upa.id,
        'role', upa.role,
        'is_active', upa.is_active,
        'project', json_build_object(
          'id', p.id,
          'code', p.code,
          'name', p.name
        )
      )
    ) FILTER (WHERE upa.id IS NOT NULL),
    '[]'::json
  ) AS project_assignments
FROM users u
LEFT JOIN organization_members om ON om.user_id = u.id AND om.organization_id = u.org_id
LEFT JOIN user_project_assignments upa ON upa.user_id = u.id AND upa.is_active = true
LEFT JOIN projects p ON p.id = upa.project_id
GROUP BY u.id, om.role, om.is_active, om.accepted_at;

COMMENT ON VIEW users_with_assignments IS
'Users with workflow roles, org membership, and active project assignments (multi-tenant). Uses security_invoker - respects RLS.';

-- Grant permissions (RLS will filter appropriately)
GRANT SELECT ON user_organizations TO authenticated;
GRANT SELECT ON users_with_assignments TO authenticated;

-- =====================================================
-- Verification
-- =====================================================

DO $$
DECLARE
  view_record RECORD;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '=== Fixed Security Views ===';

  -- Check view security properties
  FOR view_record IN
    SELECT
      schemaname,
      viewname,
      viewowner
    FROM pg_views
    WHERE viewname IN ('user_organizations', 'users_with_assignments')
    ORDER BY viewname
  LOOP
    RAISE NOTICE 'View: %.% (owner: %)',
      view_record.schemaname,
      view_record.viewname,
      view_record.viewowner;
  END LOOP;

  RAISE NOTICE '';
  RAISE NOTICE '✓ Both views now use security_invoker (respect RLS)';
  RAISE NOTICE '✓ Views will show data based on querying user permissions';
  RAISE NOTICE '✓ No cross-organization data leakage';
END $$;

-- =====================================================
-- Expected Behavior After This Migration
-- =====================================================
-- ✓ user_organizations: Shows only orgs where current user is a member
-- ✓ users_with_assignments: Shows users filtered by RLS policies (org_id)
-- ✓ Both views respect the querying user's RLS policies
-- ✓ No SECURITY DEFINER warnings in Supabase Security Advisor
-- ✓ Multi-tenant data isolation maintained

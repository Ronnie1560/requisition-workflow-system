-- Migration: Fix users_with_assignments view for multi-org support
-- Date: 2025-02-26
-- Description: Restructure the view to use organization_members as the primary
-- relationship instead of users.org_id. This ensures a user who belongs to
-- multiple organizations appears in each org's user list, not just their primary/home org.
-- Also exposes org_role, workflow_role, and org_membership_active from organization_members.

DROP VIEW IF EXISTS users_with_assignments CASCADE;

CREATE VIEW users_with_assignments
WITH (security_invoker = true)
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
  om.organization_id AS org_id,
  u.employee_id,
  om.role AS org_role,
  om.workflow_role,
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
INNER JOIN organization_members om ON om.user_id = u.id AND om.is_active = true
LEFT JOIN user_project_assignments upa ON upa.user_id = u.id AND upa.org_id = om.organization_id AND upa.is_active = true
LEFT JOIN projects p ON p.id = upa.project_id
GROUP BY u.id, om.organization_id, om.role, om.workflow_role, om.is_active, om.accepted_at;

GRANT SELECT ON users_with_assignments TO authenticated;
GRANT SELECT ON users_with_assignments TO service_role;

COMMENT ON VIEW users_with_assignments IS
  'Users with workflow roles, org membership, and active project assignments. '
  'Multi-org aware: produces one row per user per active organization membership.';

-- Migration: Fix users_with_assignments view for multi-tenancy
-- Date: 2026-01-18
-- Description: Add org_id column to users_with_assignments view to support multi-tenant filtering

-- Drop the old view
DROP VIEW IF EXISTS users_with_assignments;

-- Recreate with org_id column AND organization membership info
CREATE OR REPLACE VIEW users_with_assignments AS
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
  u.org_id,  -- Added for multi-tenancy filtering
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

-- Grant permissions
GRANT SELECT ON users_with_assignments TO authenticated;

-- Add comment
COMMENT ON VIEW users_with_assignments IS 'Users with workflow roles, org membership, and active project assignments (multi-tenant)';

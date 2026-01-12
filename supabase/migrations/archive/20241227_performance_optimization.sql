-- =====================================================
-- Performance Optimization Migration
-- Date: 2024-12-27
-- Fixes API performance issues with users and notifications
-- =====================================================

-- =====================================================
-- 1. Add composite indexes for user_project_assignments
-- The getAllUsers query joins users → user_project_assignments → projects
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_user_project_assignments_user_active 
ON user_project_assignments(user_id, is_active);

CREATE INDEX IF NOT EXISTS idx_user_project_assignments_project 
ON user_project_assignments(project_id);

-- =====================================================
-- 2. Add composite index for notifications (user + created_at)
-- Optimizes: SELECT * FROM notifications WHERE user_id = X ORDER BY created_at DESC
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_notifications_user_created 
ON notifications(user_id, created_at DESC);

-- =====================================================
-- 3. Add composite index for users (id + is_active)
-- Common filter pattern
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_users_id_active 
ON users(id, is_active);

-- =====================================================
-- 4. Analyze tables to update statistics
-- This helps the query planner make better decisions
-- =====================================================
ANALYZE users;
ANALYZE user_project_assignments;
ANALYZE notifications;
ANALYZE projects;

-- =====================================================
-- 5. Create a view for user list with assignments (pre-joined)
-- This can be faster than joining at query time
-- =====================================================
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
LEFT JOIN user_project_assignments upa ON upa.user_id = u.id AND upa.is_active = true
LEFT JOIN projects p ON p.id = upa.project_id
GROUP BY u.id;

-- Grant access to the view
GRANT SELECT ON users_with_assignments TO authenticated;

-- =====================================================
-- 6. Add index for email_notifications processing
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_email_notifications_pending 
ON email_notifications(status, retry_count, created_at) 
WHERE status = 'pending';

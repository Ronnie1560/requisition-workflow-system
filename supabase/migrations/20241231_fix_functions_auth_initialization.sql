-- =====================================================
-- Fix Functions with Auth Initialization Issues
-- Date: 2024-12-31
-- Issue: 8 helper functions call auth.uid() without SELECT wrapper
-- Solution: Recreate functions with (SELECT auth.uid())
-- =====================================================

-- These functions are called by RLS policies, so they also need optimization

-- =====================================================
-- 1. can_approve_requisition
-- =====================================================

CREATE OR REPLACE FUNCTION can_approve_requisition(req_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM requisitions r
    INNER JOIN user_project_assignments upa
      ON upa.project_id = r.project_id
    WHERE r.id = req_id
      AND upa.user_id = (SELECT auth.uid())
      AND upa.role IN ('approver', 'super_admin')
      AND upa.is_active = true
  );
$$;

-- =====================================================
-- 2. can_review_requisition
-- =====================================================

CREATE OR REPLACE FUNCTION can_review_requisition(req_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM requisitions r
    INNER JOIN user_project_assignments upa
      ON upa.project_id = r.project_id
    WHERE r.id = req_id
      AND upa.user_id = (SELECT auth.uid())
      AND upa.role IN ('reviewer', 'approver', 'super_admin')
      AND upa.is_active = true
  );
$$;

-- =====================================================
-- 3. create_audit_log
-- =====================================================

CREATE OR REPLACE FUNCTION create_audit_log(
  p_table_name VARCHAR,
  p_record_id UUID,
  p_action VARCHAR,
  p_old_values JSONB DEFAULT NULL,
  p_new_values JSONB DEFAULT NULL
)
RETURNS UUID
LANGUAGE PLPGSQL
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  log_id UUID;
BEGIN
  INSERT INTO audit_logs (
    table_name,
    record_id,
    action,
    old_values,
    new_values,
    changed_by
  )
  VALUES (
    p_table_name,
    p_record_id,
    p_action,
    p_old_values,
    p_new_values,
    (SELECT auth.uid())
  )
  RETURNING id INTO log_id;

  RETURN log_id;
END;
$$;

-- =====================================================
-- 4. get_user_role
-- =====================================================

CREATE OR REPLACE FUNCTION get_user_role()
RETURNS user_role
LANGUAGE SQL
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT role FROM users WHERE id = (SELECT auth.uid());
$$;

-- =====================================================
-- 5. has_project_role
-- =====================================================

CREATE OR REPLACE FUNCTION has_project_role(project_uuid UUID, required_role user_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_project_assignments
    WHERE user_id = (SELECT auth.uid())
      AND project_id = project_uuid
      AND role = required_role
      AND is_active = true
  );
$$;

-- =====================================================
-- 6. is_assigned_to_project
-- =====================================================

CREATE OR REPLACE FUNCTION is_assigned_to_project(project_uuid UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_project_assignments
    WHERE user_id = (SELECT auth.uid())
      AND project_id = project_uuid
      AND is_active = true
  );
$$;

-- =====================================================
-- 7. is_super_admin
-- =====================================================

CREATE OR REPLACE FUNCTION is_super_admin()
RETURNS BOOLEAN
LANGUAGE SQL
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COALESCE(
    (SELECT role = 'super_admin' FROM users WHERE id = (SELECT auth.uid())),
    false
  );
$$;

-- =====================================================
-- 8. owns_requisition
-- =====================================================

CREATE OR REPLACE FUNCTION owns_requisition(req_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM requisitions
    WHERE id = req_id AND submitted_by = (SELECT auth.uid())
  );
$$;

-- =====================================================
-- Verify all functions are optimized
-- =====================================================

SELECT
  n.nspname as schema_name,
  p.proname as function_name,
  CASE
    WHEN pg_get_functiondef(p.oid) LIKE '%auth.uid()%'
         AND pg_get_functiondef(p.oid) NOT LIKE '%(SELECT auth.uid())%'
    THEN '❌ Needs fix'
    ELSE '✅ Optimized'
  END as status
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.prokind = 'f'
  AND pg_get_functiondef(p.oid) LIKE '%auth.uid()%'
ORDER BY p.proname;

-- Expected result: All functions show '✅ Optimized'

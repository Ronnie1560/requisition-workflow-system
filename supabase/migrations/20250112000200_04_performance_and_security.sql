-- =====================================================
-- PCM Requisition System - Performance & Security
-- Consolidated Migration: January 12, 2026
-- =====================================================
-- This migration adds:
-- 1. Performance indexes
-- 2. Function search_path security fixes
-- 3. RLS policy optimizations
-- 4. Helper views
-- =====================================================

BEGIN;

-- ============================================
-- PART 1: PERFORMANCE INDEXES
-- ============================================

-- User project assignments indexes
CREATE INDEX IF NOT EXISTS idx_user_project_assignments_user_active 
ON user_project_assignments(user_id, is_active);

CREATE INDEX IF NOT EXISTS idx_user_project_assignments_project 
ON user_project_assignments(project_id);

-- Notifications composite index
CREATE INDEX IF NOT EXISTS idx_notifications_user_created 
ON notifications(user_id, created_at DESC);

-- Users composite index
CREATE INDEX IF NOT EXISTS idx_users_id_active 
ON users(id, is_active);

-- Requisitions indexes
CREATE INDEX IF NOT EXISTS idx_requisitions_submitted_by ON requisitions(submitted_by);
CREATE INDEX IF NOT EXISTS idx_requisitions_status ON requisitions(status);
CREATE INDEX IF NOT EXISTS idx_requisitions_project_id ON requisitions(project_id);
CREATE INDEX IF NOT EXISTS idx_requisitions_created_at ON requisitions(created_at DESC);

-- Requisition items indexes
CREATE INDEX IF NOT EXISTS idx_requisition_items_requisition_id ON requisition_items(requisition_id);

-- Comments indexes
CREATE INDEX IF NOT EXISTS idx_comments_requisition_id ON comments(requisition_id);
CREATE INDEX IF NOT EXISTS idx_comments_user_id ON comments(user_id);

-- Email notifications pending index
CREATE INDEX IF NOT EXISTS idx_email_notifications_pending 
ON email_notifications(status, retry_count, created_at) 
WHERE status = 'pending';

-- ============================================
-- PART 2: HELPER VIEWS
-- ============================================

-- Users with project assignments view
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

GRANT SELECT ON users_with_assignments TO authenticated;

-- Requisitions with details view
CREATE OR REPLACE VIEW requisitions_with_details AS
SELECT 
  r.*,
  u.full_name AS submitter_name,
  u.email AS submitter_email,
  p.name AS project_name,
  p.code AS project_code,
  ea.name AS expense_account_name,
  ea.code AS expense_account_code
FROM requisitions r
LEFT JOIN users u ON r.submitted_by = u.id
LEFT JOIN projects p ON r.project_id = p.id
LEFT JOIN expense_accounts ea ON r.expense_account_id = ea.id;

GRANT SELECT ON requisitions_with_details TO authenticated;

-- ============================================
-- PART 3: SECURITY DEFINER FUNCTION FIXES
-- ============================================

-- Fix all functions without search_path
DO $$
DECLARE
  func_record RECORD;
  func_signature TEXT;
  sql_statement TEXT;
  fixed_count INT := 0;
BEGIN
  FOR func_record IN
    SELECT
      n.nspname as schema_name,
      p.proname as function_name,
      pg_get_function_identity_arguments(p.oid) as arg_types
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prokind IN ('f', 'p')
      AND (p.proconfig IS NULL OR NOT EXISTS (
        SELECT 1
        FROM unnest(p.proconfig) AS config
        WHERE config LIKE 'search_path=%'
      ))
  LOOP
    func_signature := func_record.schema_name || '.' || func_record.function_name || '(' || func_record.arg_types || ')';
    sql_statement := 'ALTER FUNCTION ' || func_signature || ' SET search_path = ''public''';

    BEGIN
      EXECUTE sql_statement;
      fixed_count := fixed_count + 1;
    EXCEPTION WHEN OTHERS THEN
      -- Skip functions that can't be modified
      NULL;
    END;
  END LOOP;

  RAISE NOTICE 'Fixed % functions with search_path', fixed_count;
END $$;

-- ============================================
-- PART 4: CONSOLIDATED RLS POLICIES
-- ============================================

-- Optimize requisitions RLS policies
DROP POLICY IF EXISTS "Users can view own requisitions" ON requisitions;
DROP POLICY IF EXISTS "Reviewers can view pending requisitions" ON requisitions;
DROP POLICY IF EXISTS "Admins can view all requisitions" ON requisitions;

-- Single optimized SELECT policy for requisitions
CREATE POLICY "requisitions_select_policy" ON requisitions
  FOR SELECT TO authenticated
  USING (
    -- Users can see their own requisitions
    submitted_by = auth.uid()
    OR
    -- Reviewers and admins can see all non-draft requisitions
    (
      status != 'draft'
      AND EXISTS (
        SELECT 1 FROM users 
        WHERE id = auth.uid() 
        AND role IN ('reviewer', 'super_admin')
      )
    )
  );

-- Optimize requisition_items RLS policies
DROP POLICY IF EXISTS "Users can view own requisition items" ON requisition_items;
DROP POLICY IF EXISTS "Reviewers can view requisition items" ON requisition_items;
DROP POLICY IF EXISTS "Admins can view all requisition items" ON requisition_items;

-- Single optimized SELECT policy for requisition_items
CREATE POLICY "requisition_items_select_policy" ON requisition_items
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM requisitions r
      WHERE r.id = requisition_items.requisition_id
      AND (
        r.submitted_by = auth.uid()
        OR (
          r.status != 'draft'
          AND EXISTS (
            SELECT 1 FROM users 
            WHERE id = auth.uid() 
            AND role IN ('reviewer', 'super_admin')
          )
        )
      )
    )
  );

-- ============================================
-- PART 5: BUDGET VALIDATION FUNCTIONS
-- ============================================

/**
 * Get remaining budget for a project
 */
CREATE OR REPLACE FUNCTION get_project_remaining_budget(p_project_id UUID)
RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = 'public'
AS $$
DECLARE
  total_budget NUMERIC;
  spent_amount NUMERIC;
BEGIN
  -- Get project budget
  SELECT COALESCE(budget, 0) INTO total_budget
  FROM projects
  WHERE id = p_project_id;

  -- Get total spent from approved requisitions
  SELECT COALESCE(SUM(total_amount), 0) INTO spent_amount
  FROM requisitions
  WHERE project_id = p_project_id
    AND status = 'approved';

  RETURN total_budget - spent_amount;
END;
$$;

/**
 * Check if a requisition amount is within budget
 */
CREATE OR REPLACE FUNCTION check_requisition_budget(
  p_project_id UUID,
  p_amount NUMERIC,
  p_requisition_id UUID DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = 'public'
AS $$
DECLARE
  remaining_budget NUMERIC;
  current_requisition_amount NUMERIC := 0;
BEGIN
  -- Get remaining budget
  remaining_budget := get_project_remaining_budget(p_project_id);

  -- If updating existing requisition, add back its current amount
  IF p_requisition_id IS NOT NULL THEN
    SELECT COALESCE(total_amount, 0) INTO current_requisition_amount
    FROM requisitions
    WHERE id = p_requisition_id
      AND status = 'approved';
    
    remaining_budget := remaining_budget + current_requisition_amount;
  END IF;

  RETURN p_amount <= remaining_budget;
END;
$$;

/**
 * Generate next item code for a category
 */
CREATE OR REPLACE FUNCTION generate_item_code(p_category_id UUID DEFAULT NULL)
RETURNS VARCHAR
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  prefix VARCHAR(10);
  next_num INTEGER;
  padding INTEGER;
  new_code VARCHAR(50);
  category_code VARCHAR(50);
BEGIN
  -- Get organization settings
  SELECT 
    COALESCE(item_code_prefix, 'ITEM'),
    COALESCE(item_code_next_number, 1),
    COALESCE(item_code_padding, 3)
  INTO prefix, next_num, padding
  FROM organization_settings
  LIMIT 1;

  -- If category provided, use category code as prefix
  IF p_category_id IS NOT NULL THEN
    SELECT code INTO category_code
    FROM categories
    WHERE id = p_category_id;

    IF category_code IS NOT NULL THEN
      prefix := category_code;
    END IF;
  END IF;

  -- Generate code with padding
  new_code := prefix || '-' || LPAD(next_num::TEXT, padding, '0');

  -- Increment counter
  UPDATE organization_settings
  SET item_code_next_number = next_num + 1,
      updated_at = NOW();

  RETURN new_code;
END;
$$;

-- ============================================
-- PART 6: ANALYZE TABLES
-- ============================================

ANALYZE users;
ANALYZE user_project_assignments;
ANALYZE notifications;
ANALYZE projects;
ANALYZE requisitions;
ANALYZE requisition_items;
ANALYZE comments;
ANALYZE email_notifications;

-- ============================================
-- PART 7: TABLE COMMENTS
-- ============================================

COMMENT ON VIEW users_with_assignments IS 'Users with their active project assignments pre-joined for performance';
COMMENT ON VIEW requisitions_with_details IS 'Requisitions with related user, project, and expense account details';
COMMENT ON FUNCTION get_project_remaining_budget IS 'Calculate remaining budget for a project';
COMMENT ON FUNCTION check_requisition_budget IS 'Check if a requisition amount is within project budget';
COMMENT ON FUNCTION generate_item_code IS 'Generate the next sequential item code';

COMMIT;

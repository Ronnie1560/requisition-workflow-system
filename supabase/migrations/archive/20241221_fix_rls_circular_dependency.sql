-- =====================================================
-- FIX: RLS Circular Dependency in Helper Functions
-- Date: 2024-12-21
-- Issue: is_super_admin() and get_user_role() query the users table,
-- causing infinite recursion when RLS policies on users table call these functions
-- =====================================================

-- =====================================================
-- RECREATE HELPER FUNCTIONS WITH RLS BYPASS
-- Using CREATE OR REPLACE to avoid dropping dependent policies
-- Adding SECURITY DEFINER + SET search_path to bypass RLS
-- =====================================================

-- Function to check if user is super admin
-- This version bypasses RLS by running as the function owner (postgres)
CREATE OR REPLACE FUNCTION is_super_admin()
RETURNS BOOLEAN 
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT COALESCE(
    (SELECT role = 'super_admin' FROM users WHERE id = auth.uid()),
    false
  );
$$;

-- Function to get current user's role
-- This version bypasses RLS by running as the function owner (postgres)
CREATE OR REPLACE FUNCTION get_user_role()
RETURNS user_role 
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT role FROM users WHERE id = auth.uid();
$$;

-- =====================================================
-- GRANT EXECUTE PERMISSIONS
-- =====================================================

GRANT EXECUTE ON FUNCTION is_super_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION is_super_admin() TO anon;
GRANT EXECUTE ON FUNCTION get_user_role() TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_role() TO anon;
-- =====================================================
-- Fix: Users table UPDATE RLS policy for Super Admin
-- Date: 2026-02-24
-- Problem: The "Users can update users" policy calls is_super_admin()
--          WITHOUT passing the target row's org_id. After the workflow
--          role migration (20260215), is_super_admin() resolves via
--          get_user_role(NULL) which falls back to the caller's
--          users.org_id — which may not match the target org context.
--          This causes Super Admins to get "Failed to update user profile".
--
-- Fix: Pass the row's org_id to is_super_admin(org_id), matching the
--      pattern used in all other RLS policies updated in 20260215.
-- =====================================================

-- Drop the old consolidated policy
DROP POLICY IF EXISTS "Users can update users" ON users;

-- Recreate with org_id passed to is_super_admin
CREATE POLICY "Users can update users"
  ON users FOR UPDATE TO authenticated
  USING (
    id = (SELECT auth.uid())
    OR user_is_org_admin(org_id)
    OR is_super_admin(org_id)
  );

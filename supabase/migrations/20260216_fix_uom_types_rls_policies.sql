-- =====================================================
-- Fix: Restore missing RLS policies on uom_types table
-- =====================================================
-- Root cause: The workflow role migration (20260215) dropped and recreated
-- helper functions (is_super_admin, user_belongs_to_org, user_is_org_admin)
-- with new signatures. The old uom_types policies that depended on the
-- old function signatures were invalidated/dropped but never recreated.
-- This left uom_types with RLS enabled but zero policies, blocking all access.
-- =====================================================

-- Drop any stale policies (safety)
DROP POLICY IF EXISTS "Users can view uom types" ON uom_types;
DROP POLICY IF EXISTS "Users can view UOM types" ON uom_types;
DROP POLICY IF EXISTS "Users can view uom_types" ON uom_types;
DROP POLICY IF EXISTS "Admins can create uom types" ON uom_types;
DROP POLICY IF EXISTS "Super admins can create UOM types" ON uom_types;
DROP POLICY IF EXISTS "Admins can update uom types" ON uom_types;
DROP POLICY IF EXISTS "Super admins can update UOM types" ON uom_types;
DROP POLICY IF EXISTS "Admins can delete uom types" ON uom_types;
DROP POLICY IF EXISTS "Super admins can delete UOM types" ON uom_types;
DROP POLICY IF EXISTS "Authenticated users can view UOM types" ON uom_types;
DROP POLICY IF EXISTS "Super admins can manage UOM types" ON uom_types;

-- SELECT: All org members can view UOM types for their organization
CREATE POLICY "Users can view uom types"
  ON uom_types FOR SELECT
  TO authenticated
  USING (user_belongs_to_org(org_id) OR is_super_admin(org_id));

-- INSERT: Only org admins and super admins can create UOM types
CREATE POLICY "Admins can create uom types"
  ON uom_types FOR INSERT
  TO authenticated
  WITH CHECK (user_is_org_admin(org_id) OR is_super_admin(org_id));

-- UPDATE: Only org admins and super admins can update UOM types
CREATE POLICY "Admins can update uom types"
  ON uom_types FOR UPDATE
  TO authenticated
  USING (user_is_org_admin(org_id) OR is_super_admin(org_id));

-- DELETE: Only org admins and super admins can delete UOM types
CREATE POLICY "Admins can delete uom types"
  ON uom_types FOR DELETE
  TO authenticated
  USING (user_is_org_admin(org_id) OR is_super_admin(org_id));

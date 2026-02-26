-- Fix: Organizations SELECT policy was too restrictive for multi-org users
-- The old policy only allowed viewing the org matching jwt_org_id() (the active org),
-- which meant users belonging to multiple orgs could only see ONE org in the selector.
-- This fix allows viewing ALL orgs where the user has an active membership.

DROP POLICY IF EXISTS "Users can view their organizations" ON organizations;

CREATE POLICY "Users can view their organizations"
  ON organizations FOR SELECT TO authenticated
  USING (
    id IN (
      SELECT om.organization_id 
      FROM organization_members om 
      WHERE om.user_id = auth.uid() AND om.is_active = true
    )
    OR (SELECT public.jwt_is_platform_admin())
  );

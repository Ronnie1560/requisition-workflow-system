-- Migration: Scope users SELECT to the caller's active organization
-- Date: 2026-03-05 (written 2026-10-15 against production)
--
-- Problem (cross-tenant data exposure):
--   Production policy "Users can view users" on public.users was
--     USING (is_super_admin() OR is_active = true OR auth.uid() = id)
--   so any authenticated user could read every active user in every
--   tenant (name, email, phone, department, employee_id, role).
--
-- Fix:
--   A user can see their own row, and users who have a membership
--   (active or deactivated) in the caller's active organization
--   (jwt_org_id()). Deactivated members stay visible so historical
--   requisitions/comments still show who submitted/reviewed them.
--   "Platform admins can view all users" is unchanged.
--
-- Callers that read other users (requisition/comment/item embeds,
-- member lists, users_with_assignments, dashboard counts) are all
-- same-org; edge functions use service_role and are unaffected.
-- The membership probe uses organization_members_organization_id_user_id_key.
-- =====================================================

BEGIN;

DROP POLICY IF EXISTS "Users can view users" ON public.users;

CREATE POLICY "Users can view users"
  ON public.users FOR SELECT TO authenticated
  USING (
    id = (SELECT auth.uid())
    OR EXISTS (
      SELECT 1
      FROM public.organization_members om
      WHERE om.user_id = users.id
        AND om.organization_id = (SELECT public.jwt_org_id())
    )
  );

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'users'
      AND policyname = 'Users can view users'
      AND qual LIKE '%is_active%'
  ) THEN
    RAISE EXCEPTION 'users SELECT policy still allows is_active rows';
  END IF;
  RAISE NOTICE 'users SELECT scoped to active organization';
END $$;

COMMIT;

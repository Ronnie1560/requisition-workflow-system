-- Migration: Lock privileged columns on users + remove users.role fallback
-- Date: 2026-03-01
--
-- Problem (privilege escalation / cross-tenant join):
--   The "Users can update users" policy allows id = auth.uid() with no
--   column restriction, so any authenticated user could run
--     UPDATE users SET role = 'super_admin', org_id = '<any org>' WHERE id = me
--   Three things then trusted those self-written values:
--     1. invite-user / resend-invitation edge functions (users.role, users.org_id)
--     2. get_user_role() fell back to users.role when the caller had no
--        membership in the org being checked, so is_super_admin(X) returned
--        true for every org X the user did NOT belong to.
--     3. update_member_workflow_role() gates on is_super_admin(p_org_id).
--
-- Fix:
--   1. BEFORE UPDATE trigger rejects end-user changes to id, role, org_id
--      and email, and blocks users from changing their own is_active.
--      service_role (edge functions) and SECURITY DEFINER functions
--      (current_user = function owner, e.g. update_member_workflow_role)
--      are not affected.
--   2. get_user_role() resolves only from active organization_members rows.
--      Non-members get 'submitter' (never NULL: callers such as
--      update_member_workflow_role use IF NOT (... OR is_super_admin(...)),
--      which would pass on NULL).
--
-- A trigger is used instead of column-level GRANTs so that profile columns
-- added outside these migrations keep working.
-- =====================================================

BEGIN;

-- =====================================================
-- STEP 1: Guard trigger on users
-- =====================================================
-- Must stay SECURITY INVOKER: current_user has to reflect the caller.

CREATE OR REPLACE FUNCTION public.guard_users_privileged_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO 'public'
AS $$
BEGIN
  -- Only constrain direct API writes (PostgREST runs as authenticated/anon).
  IF current_user NOT IN ('authenticated', 'anon') THEN
    RETURN NEW;
  END IF;

  IF NEW.id IS DISTINCT FROM OLD.id
     OR NEW.role IS DISTINCT FROM OLD.role
     OR NEW.org_id IS DISTINCT FROM OLD.org_id
     OR NEW.email IS DISTINCT FROM OLD.email THEN
    RAISE EXCEPTION 'users.id, role, org_id and email cannot be changed directly'
      USING ERRCODE = '42501',
            HINT = 'Use update_member_workflow_role() to change workflow roles.';
  END IF;

  IF NEW.is_active IS DISTINCT FROM OLD.is_active
     AND OLD.id = (SELECT auth.uid()) THEN
    RAISE EXCEPTION 'You cannot change your own active status'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.guard_users_privileged_columns() IS
  'Blocks end-user changes to users.id/role/org_id/email and self is_active changes. '
  'service_role and SECURITY DEFINER functions bypass it.';

DROP TRIGGER IF EXISTS guard_users_privileged_columns ON public.users;
CREATE TRIGGER guard_users_privileged_columns
  BEFORE UPDATE ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_users_privileged_columns();

-- =====================================================
-- STEP 2: get_user_role without users.role fallback
-- =====================================================
-- Same signature, so existing policies and grants are preserved.

CREATE OR REPLACE FUNCTION public.get_user_role(check_org_id UUID DEFAULT NULL)
RETURNS public.user_role
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_role public.user_role;
  v_org_id UUID;
BEGIN
  -- Use provided org_id, or fall back to user's default org
  -- (users.org_id is no longer user-writable, see guard trigger above)
  v_org_id := COALESCE(
    check_org_id,
    (SELECT u.org_id FROM public.users u WHERE u.id = (SELECT auth.uid()))
  );

  IF v_org_id IS NOT NULL THEN
    SELECT om.workflow_role INTO v_role
    FROM public.organization_members om
    WHERE om.user_id = (SELECT auth.uid())
      AND om.organization_id = v_org_id
      AND om.is_active = true;
  END IF;

  -- No active membership => lowest privilege. Never consult users.role.
  RETURN COALESCE(v_role, 'submitter');
END;
$$;

CREATE OR REPLACE FUNCTION public.is_super_admin(check_org_id UUID DEFAULT NULL)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN COALESCE(public.get_user_role(check_org_id) = 'super_admin', false);
END;
$$;

-- =====================================================
-- STEP 3: Verification
-- =====================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'guard_users_privileged_columns'
      AND tgrelid = 'public.users'::regclass
  ) THEN
    RAISE EXCEPTION 'guard_users_privileged_columns trigger missing';
  END IF;

  IF position('SELECT role INTO' IN pg_get_functiondef('public.get_user_role(uuid)'::regprocedure)) > 0 THEN
    RAISE EXCEPTION 'get_user_role still contains users.role fallback';
  END IF;

  RAISE NOTICE 'users privileged columns locked; get_user_role fallback removed';
END $$;

COMMIT;

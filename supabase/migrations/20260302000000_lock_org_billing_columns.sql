-- Migration: Stop tenants from choosing their own plan / limits
-- Date: 2026-03-02
--
-- Problem (billing bypass / cross-tenant suspension):
--   1. create-organization-signup used the client-sent plan (fixed in the
--      edge function); create_organization() RPC likewise inserts p_plan
--      as given, so any authenticated user can create an 'enterprise' org.
--   2. update_organization_plan() is SECURITY DEFINER with NO auth check
--      and 20260221000300 granted EXECUTE on it to authenticated, so any
--      user could set plan, status and limits on ANY organization
--      (including suspending another tenant).
--   3. "Owners can update organization" lets owners UPDATE organizations
--      directly with no column restriction: plan, status, max_*,
--      trial_ends_at and Stripe ids were all writable.
--
-- Fix:
--   1. create_organization() ignores p_plan and always creates 'free'
--      (signature kept so existing callers keep working).
--   2. update_organization_plan(): EXECUTE revoked from authenticated/anon/
--      public, granted to service_role, plus an in-function guard so a
--      future blanket re-grant cannot reopen it.
--   3. BEFORE UPDATE trigger on organizations rejects end-user changes to
--      billing/limit columns. service_role (stripe-webhook), SECURITY
--      DEFINER functions (platform_update_org_plan/status) and platform
--      admins are not affected.
--
-- Paid plans are only ever set by stripe-webhook after a verified payment,
-- or by a platform admin.
-- =====================================================

BEGIN;

-- =====================================================
-- STEP 1: create_organization always starts on free
-- =====================================================

CREATE OR REPLACE FUNCTION public.create_organization(
  p_name VARCHAR(255),
  p_slug VARCHAR(100),
  p_email VARCHAR(255) DEFAULT NULL,
  p_plan subscription_plan DEFAULT 'free'  -- ignored; kept for compatibility
)
RETURNS UUID AS $$
-- Body matches production as of 2026-10-15 (owner gets workflow_role
-- super_admin; fiscal_year_settings uses fiscal_year_start_* columns),
-- except that plan is no longer taken from p_plan.
DECLARE
  v_org_id UUID;
  v_user_id UUID;
  v_current_year INTEGER;
BEGIN
  v_user_id := auth.uid();

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'User must be authenticated';
  END IF;

  -- Create organization (plan is never caller-controlled)
  INSERT INTO organizations (name, slug, email, plan, created_by)
  VALUES (p_name, p_slug, p_email, 'free', v_user_id)
  RETURNING id INTO v_org_id;

  -- Add creator as owner
  INSERT INTO organization_members (organization_id, user_id, role, workflow_role, accepted_at)
  VALUES (v_org_id, v_user_id, 'owner', 'super_admin', NOW());

  -- Create default organization settings
  INSERT INTO organization_settings (org_id, organization_name)
  VALUES (v_org_id, p_name);

  -- Create default fiscal year settings (if table exists)
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'fiscal_year_settings') THEN
    v_current_year := EXTRACT(YEAR FROM NOW());
    INSERT INTO fiscal_year_settings (org_id, fiscal_year_start_month, fiscal_year_start_day, current_fiscal_year)
    VALUES (v_org_id, 1, 1, v_current_year);
  END IF;

  RETURN v_org_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public';

-- =====================================================
-- STEP 2: update_organization_plan is service_role only
-- =====================================================

CREATE OR REPLACE FUNCTION public.update_organization_plan(
  p_org_id UUID,
  p_plan subscription_plan,
  p_status organization_status,
  p_max_users INTEGER,
  p_max_projects INTEGER,
  p_max_requisitions INTEGER,
  p_stripe_subscription_id VARCHAR DEFAULT NULL,
  p_subscription_ends_at TIMESTAMPTZ DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Defense in depth: reject API callers that are not service_role or a
  -- platform admin, even if EXECUTE is ever re-granted.
  IF COALESCE(NULLIF(current_setting('request.jwt.claims', true), '')::jsonb->>'role', '')
       IN ('authenticated', 'anon')
     AND NOT public.jwt_is_platform_admin() THEN
    RAISE EXCEPTION 'Permission denied: billing is managed by the payment provider'
      USING ERRCODE = '42501';
  END IF;

  UPDATE public.organizations
  SET
    plan = p_plan,
    status = p_status,
    max_users = p_max_users,
    max_projects = p_max_projects,
    max_requisitions_per_month = p_max_requisitions,
    stripe_subscription_id = COALESCE(p_stripe_subscription_id, stripe_subscription_id),
    subscription_ends_at = COALESCE(p_subscription_ends_at, subscription_ends_at),
    updated_at = NOW()
  WHERE id = p_org_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.update_organization_plan(
  uuid, subscription_plan, organization_status, integer, integer, integer, character varying, timestamp with time zone
) FROM authenticated, anon, public;
GRANT EXECUTE ON FUNCTION public.update_organization_plan(
  uuid, subscription_plan, organization_status, integer, integer, integer, character varying, timestamp with time zone
) TO service_role;

-- =====================================================
-- STEP 3: Guard trigger on organizations billing columns
-- =====================================================
-- Must stay SECURITY INVOKER: current_user has to reflect the caller.
-- Columns are compared via jsonb so a column missing in some environment
-- does not break org updates.

CREATE OR REPLACE FUNCTION public.guard_organizations_billing_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO 'public'
AS $$
DECLARE
  v_old JSONB := to_jsonb(OLD);
  v_new JSONB := to_jsonb(NEW);
  v_col TEXT;
BEGIN
  -- Only constrain direct API writes (PostgREST runs as authenticated/anon).
  IF current_user NOT IN ('authenticated', 'anon') THEN
    RETURN NEW;
  END IF;

  IF public.jwt_is_platform_admin() THEN
    RETURN NEW;
  END IF;

  FOREACH v_col IN ARRAY ARRAY[
    'id', 'plan', 'status', 'trial_ends_at', 'subscription_ends_at',
    'max_users', 'max_projects', 'max_requisitions_per_month',
    'stripe_customer_id', 'stripe_subscription_id', 'created_by', 'created_at'
  ]
  LOOP
    IF v_new->v_col IS DISTINCT FROM v_old->v_col THEN
      RAISE EXCEPTION 'organizations.% is managed by billing and cannot be changed directly', v_col
        USING ERRCODE = '42501';
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.guard_organizations_billing_columns() IS
  'Blocks end-user changes to organizations plan/status/limits/trial/Stripe columns. '
  'service_role, SECURITY DEFINER functions and platform admins bypass it.';

DROP TRIGGER IF EXISTS guard_organizations_billing_columns ON public.organizations;
CREATE TRIGGER guard_organizations_billing_columns
  BEFORE UPDATE ON public.organizations
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_organizations_billing_columns();

-- =====================================================
-- STEP 4: Verification
-- =====================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'guard_organizations_billing_columns'
      AND tgrelid = 'public.organizations'::regclass
  ) THEN
    RAISE EXCEPTION 'guard_organizations_billing_columns trigger missing';
  END IF;

  IF has_function_privilege('authenticated',
       'public.update_organization_plan(uuid, subscription_plan, organization_status, integer, integer, integer, character varying, timestamp with time zone)',
       'EXECUTE') THEN
    RAISE EXCEPTION 'authenticated can still execute update_organization_plan';
  END IF;

  RAISE NOTICE 'organization billing columns locked; update_organization_plan restricted';
END $$;

COMMIT;

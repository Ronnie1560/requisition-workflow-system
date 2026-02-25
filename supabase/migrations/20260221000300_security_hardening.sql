-- Migration: Security hardening for SECURITY DEFINER functions
-- Date: 2026-02-21
--
-- Fixes Supabase Security Advisor warnings:
--   1. Adds SET search_path = '' to 21 SECURITY DEFINER functions that were missing it
--   2. Revokes EXECUTE from anon and public on ALL SECURITY DEFINER functions
--   3. Re-grants EXECUTE to authenticated where needed
--
-- search_path hardening prevents schema hijacking attacks where a malicious user
-- creates objects in the public schema that shadow system functions.

BEGIN;

-- =====================================================
-- STEP 1: Add SET search_path = '' to functions missing it
-- (wrapped in DO block to skip functions that don't exist)
-- =====================================================

DO $$
DECLARE
  fn_sig TEXT;
  fn_sigs TEXT[] := ARRAY[
    'public.check_admin_ip_allowed(uuid, inet)',
    'public.check_login_rate_limit(text, inet)',
    'public.cleanup_admin_security_data()',
    'public.create_admin_session(inet, text)',
    'public.create_organization(character varying, character varying, character varying, subscription_plan)',
    'public.get_admin_active_sessions()',
    'public.get_admin_security_settings()',
    'public.get_all_organizations_with_stats()',
    'public.get_organization_usage(uuid)',
    'public.get_platform_stats()',
    'public.invalidate_admin_session(uuid)',
    'public.is_platform_admin()',
    'public.log_security_event(text, text, uuid, uuid, uuid, text, uuid, text, text, jsonb)',
    'public.platform_update_org_plan(uuid, text, integer, integer, integer)',
    'public.platform_update_org_status(uuid, text, text)',
    'public.record_login_attempt(text, boolean, inet, text, text)',
    'public.record_platform_admin_login()',
    'public.revoke_other_admin_sessions(uuid)',
    'public.touch_admin_session(uuid)',
    'public.update_admin_security_settings(boolean, inet[], integer)',
    'public.update_organization_plan(uuid, subscription_plan, organization_status, integer, integer, integer, character varying, timestamp with time zone)'
  ];
BEGIN
  FOREACH fn_sig IN ARRAY fn_sigs
  LOOP
    BEGIN
      EXECUTE format('ALTER FUNCTION %s SET search_path = ''''', fn_sig);
    EXCEPTION WHEN undefined_function THEN
      RAISE NOTICE 'Function % does not exist, skipping', fn_sig;
    END;
  END LOOP;
END $$;

-- =====================================================
-- STEP 2: Revoke EXECUTE from anon + public on ALL
-- SECURITY DEFINER functions, re-grant to authenticated
-- =====================================================

DO $$
DECLARE
  fn record;
BEGIN
  FOR fn IN
    SELECT p.proname, pg_get_function_identity_arguments(p.oid) as args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace AND n.nspname = 'public'
    WHERE p.prosecdef = true
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION public.%I(%s) FROM anon, public', fn.proname, fn.args);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%I(%s) TO authenticated', fn.proname, fn.args);
  END LOOP;
END $$;

-- Ensure supabase_auth_admin can still call the hook
GRANT EXECUTE ON FUNCTION public.custom_access_token_hook(jsonb) TO supabase_auth_admin;

COMMIT;

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
-- =====================================================

ALTER FUNCTION public.check_admin_ip_allowed(uuid, inet) SET search_path = '';
ALTER FUNCTION public.check_login_rate_limit(text, inet) SET search_path = '';
ALTER FUNCTION public.cleanup_admin_security_data() SET search_path = '';
ALTER FUNCTION public.create_admin_session(inet, text) SET search_path = '';
ALTER FUNCTION public.create_organization(character varying, character varying, character varying, subscription_plan) SET search_path = '';
ALTER FUNCTION public.get_admin_active_sessions() SET search_path = '';
ALTER FUNCTION public.get_admin_security_settings() SET search_path = '';
ALTER FUNCTION public.get_all_organizations_with_stats() SET search_path = '';
ALTER FUNCTION public.get_organization_usage(uuid) SET search_path = '';
ALTER FUNCTION public.get_platform_stats() SET search_path = '';
ALTER FUNCTION public.invalidate_admin_session(uuid) SET search_path = '';
ALTER FUNCTION public.is_platform_admin() SET search_path = '';
ALTER FUNCTION public.log_security_event(text, text, uuid, uuid, uuid, text, uuid, text, text, jsonb) SET search_path = '';
ALTER FUNCTION public.platform_update_org_plan(uuid, text, integer, integer, integer) SET search_path = '';
ALTER FUNCTION public.platform_update_org_status(uuid, text, text) SET search_path = '';
ALTER FUNCTION public.record_login_attempt(text, boolean, inet, text, text) SET search_path = '';
ALTER FUNCTION public.record_platform_admin_login() SET search_path = '';
ALTER FUNCTION public.revoke_other_admin_sessions(uuid) SET search_path = '';
ALTER FUNCTION public.touch_admin_session(uuid) SET search_path = '';
ALTER FUNCTION public.update_admin_security_settings(boolean, inet[], integer) SET search_path = '';
ALTER FUNCTION public.update_organization_plan(uuid, subscription_plan, organization_status, integer, integer, integer, character varying, timestamp with time zone) SET search_path = '';

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

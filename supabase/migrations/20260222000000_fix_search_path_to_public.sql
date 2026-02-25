-- Migration: Fix search_path from '' to 'public' on SECURITY DEFINER functions
-- Date: 2026-02-22
--
-- The prior security_hardening migration set search_path = '' on 21 functions,
-- but their bodies use unqualified table/function names (e.g. platform_admins,
-- organizations, is_platform_admin()). With an empty search path PostgreSQL
-- cannot resolve these, breaking the entire admin platform.
--
-- Fix: use search_path = 'public' which is still an explicitly hardened path
-- (prevents default mutable search_path hijack) while allowing resolution of
-- public-schema objects. Regular users cannot CREATE in the public schema on
-- Supabase, so this is safe.

BEGIN;

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
      EXECUTE format('ALTER FUNCTION %s SET search_path = ''public''', fn_sig);
    EXCEPTION WHEN undefined_function THEN
      RAISE NOTICE 'Function % does not exist, skipping', fn_sig;
    END;
  END LOOP;
END $$;

COMMIT;

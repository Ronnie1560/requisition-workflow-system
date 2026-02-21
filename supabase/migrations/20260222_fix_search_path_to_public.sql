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

ALTER FUNCTION public.check_admin_ip_allowed(uuid, inet) SET search_path = 'public';
ALTER FUNCTION public.check_login_rate_limit(text, inet) SET search_path = 'public';
ALTER FUNCTION public.cleanup_admin_security_data() SET search_path = 'public';
ALTER FUNCTION public.create_admin_session(inet, text) SET search_path = 'public';
ALTER FUNCTION public.create_organization(character varying, character varying, character varying, subscription_plan) SET search_path = 'public';
ALTER FUNCTION public.get_admin_active_sessions() SET search_path = 'public';
ALTER FUNCTION public.get_admin_security_settings() SET search_path = 'public';
ALTER FUNCTION public.get_all_organizations_with_stats() SET search_path = 'public';
ALTER FUNCTION public.get_organization_usage(uuid) SET search_path = 'public';
ALTER FUNCTION public.get_platform_stats() SET search_path = 'public';
ALTER FUNCTION public.invalidate_admin_session(uuid) SET search_path = 'public';
ALTER FUNCTION public.is_platform_admin() SET search_path = 'public';
ALTER FUNCTION public.log_security_event(text, text, uuid, uuid, uuid, text, uuid, text, text, jsonb) SET search_path = 'public';
ALTER FUNCTION public.platform_update_org_plan(uuid, text, integer, integer, integer) SET search_path = 'public';
ALTER FUNCTION public.platform_update_org_status(uuid, text, text) SET search_path = 'public';
ALTER FUNCTION public.record_login_attempt(text, boolean, inet, text, text) SET search_path = 'public';
ALTER FUNCTION public.record_platform_admin_login() SET search_path = 'public';
ALTER FUNCTION public.revoke_other_admin_sessions(uuid) SET search_path = 'public';
ALTER FUNCTION public.touch_admin_session(uuid) SET search_path = 'public';
ALTER FUNCTION public.update_admin_security_settings(boolean, inet[], integer) SET search_path = 'public';
ALTER FUNCTION public.update_organization_plan(uuid, subscription_plan, organization_status, integer, integer, integer, character varying, timestamp with time zone) SET search_path = 'public';

COMMIT;

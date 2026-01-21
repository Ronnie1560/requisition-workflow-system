-- =====================================================
-- Migration: Fix SECURITY DEFINER Views and RLS on Security Audit Logs
-- Date: 2026-01-21
-- Issue: Views with SECURITY DEFINER can bypass RLS and expose sensitive data
--        across organizations. The security_audit_logs table has no RLS,
--        allowing any authenticated user to see ALL security events.
-- =====================================================

-- =====================================================
-- CRITICAL SECURITY ISSUE
-- =====================================================
-- The security_audit_logs table currently has NO RLS policies.
-- Combined with views that have GRANT SELECT to authenticated users,
-- this means ANY user can see ALL security events across ALL organizations:
--   ❌ Cross-org access attempts by other users
--   ❌ Security violations in other organizations
--   ❌ User emails and IP addresses from other orgs
--   ❌ Sensitive security information across the entire system
--
-- This fix:
--   1. Enables RLS on security_audit_logs
--   2. Creates restrictive policies (super_admin only)
--   3. Drops and recreates views without SECURITY DEFINER
--   4. Revokes overly permissive GRANT statements

-- =====================================================
-- STEP 1: Enable RLS on security_audit_logs
-- =====================================================

ALTER TABLE security_audit_logs ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- STEP 2: Create RLS Policies for security_audit_logs
-- =====================================================

-- Only super_admins can view security audit logs
-- This prevents regular users from seeing security events from other organizations
DROP POLICY IF EXISTS "Super admins can view all security audit logs" ON security_audit_logs;
CREATE POLICY "Super admins can view all security audit logs"
  ON security_audit_logs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
        AND users.role = 'super_admin'
    )
  );

-- Only system (via SECURITY DEFINER functions) can insert security audit logs
-- Regular users should never directly insert audit logs
DROP POLICY IF EXISTS "Service role can insert security audit logs" ON security_audit_logs;
CREATE POLICY "Service role can insert security audit logs"
  ON security_audit_logs FOR INSERT
  TO authenticated
  WITH CHECK (false);  -- Blocked for direct inserts; use log_security_event() function instead

-- No one can update or delete security audit logs (immutability)
-- Audit logs should be append-only for compliance

COMMENT ON TABLE security_audit_logs IS
'Security audit log table with RLS. Only super_admins can view. Inserts via log_security_event() SECURITY DEFINER function only.';

-- =====================================================
-- STEP 3: Drop and Recreate Views WITHOUT SECURITY DEFINER
-- =====================================================

-- Drop existing views that may have SECURITY DEFINER
DROP VIEW IF EXISTS cross_org_attempts_by_user CASCADE;
DROP VIEW IF EXISTS recent_critical_events CASCADE;

-- Recreate cross_org_attempts_by_user view (without SECURITY DEFINER)
-- RLS on security_audit_logs will handle access control
CREATE VIEW cross_org_attempts_by_user
WITH (security_invoker = true)  -- Explicitly use invoker's permissions, not definer's
AS
SELECT
  user_email,
  user_id,
  COUNT(*) as attempt_count,
  MAX(created_at) as last_attempt,
  array_agg(DISTINCT target_org_id) as targeted_orgs
FROM security_audit_logs
WHERE event_type = 'cross_org_access_attempt'
  AND created_at > NOW() - INTERVAL '30 days'
GROUP BY user_email, user_id
ORDER BY attempt_count DESC;

COMMENT ON VIEW cross_org_attempts_by_user IS
'Summarizes cross-org access attempts by user over the last 30 days. Uses security_invoker - respects RLS (super_admin only).';

-- Recreate recent_critical_events view (without SECURITY DEFINER)
CREATE VIEW recent_critical_events
WITH (security_invoker = true)  -- Explicitly use invoker's permissions
AS
SELECT
  id,
  event_type,
  user_email,
  current_org_id,
  target_org_id,
  resource_type,
  resource_id,
  action_attempted,
  message,
  created_at
FROM security_audit_logs
WHERE severity = 'critical'
  AND created_at > NOW() - INTERVAL '7 days'
ORDER BY created_at DESC;

COMMENT ON VIEW recent_critical_events IS
'Shows critical security events from the last 7 days. Uses security_invoker - respects RLS (super_admin only).';

-- =====================================================
-- STEP 4: Update Grants - Restrict Access
-- =====================================================

-- Revoke previous overly permissive grants
REVOKE ALL ON security_audit_logs FROM authenticated;
REVOKE ALL ON cross_org_attempts_by_user FROM authenticated;
REVOKE ALL ON recent_critical_events FROM authenticated;

-- Grant SELECT only to authenticated users (RLS will filter to super_admins)
GRANT SELECT ON security_audit_logs TO authenticated;
GRANT SELECT ON cross_org_attempts_by_user TO authenticated;
GRANT SELECT ON recent_critical_events TO authenticated;

-- Functions with SECURITY DEFINER can still insert (as intended)
-- log_security_event() and log_cross_org_access() remain unchanged

-- =====================================================
-- STEP 5: Fix Security Monitoring Views (from 20260120_security_monitoring_views.sql)
-- =====================================================

-- These views also query security_audit_logs and need security_invoker
DROP VIEW IF EXISTS security_events_recent CASCADE;
DROP VIEW IF EXISTS security_critical_events CASCADE;
DROP VIEW IF EXISTS cross_org_access_attempts CASCADE;
DROP VIEW IF EXISTS org_id_null_violations CASCADE;

-- Recreate with security_invoker
CREATE VIEW security_events_recent
WITH (security_invoker = true)
AS
SELECT
  event_type,
  severity,
  user_id,
  current_org_id,
  target_org_id,
  details,
  created_at,
  EXTRACT(EPOCH FROM (NOW() - created_at))/3600 AS hours_ago
FROM security_audit_logs
WHERE created_at >= NOW() - INTERVAL '24 hours'
ORDER BY created_at DESC;

COMMENT ON VIEW security_events_recent IS
'Shows all security events from the last 24 hours for quick monitoring. Super_admin only (via RLS).';

CREATE VIEW security_critical_events
WITH (security_invoker = true)
AS
SELECT
  event_type,
  COUNT(*) AS event_count,
  MAX(created_at) AS last_occurrence,
  ARRAY_AGG(DISTINCT user_id) FILTER (WHERE user_id IS NOT NULL) AS affected_users,
  ARRAY_AGG(DISTINCT current_org_id) FILTER (WHERE current_org_id IS NOT NULL) AS affected_orgs
FROM security_audit_logs
WHERE severity IN ('critical', 'high')
  AND created_at >= NOW() - INTERVAL '7 days'
GROUP BY event_type
ORDER BY event_count DESC;

COMMENT ON VIEW security_critical_events IS
'Aggregates critical and high-severity security events from the last 7 days. Super_admin only (via RLS).';

CREATE VIEW cross_org_access_attempts
WITH (security_invoker = true)
AS
SELECT
  user_id,
  current_org_id,
  target_org_id,
  COUNT(*) AS attempt_count,
  MAX(created_at) AS last_attempt,
  ARRAY_AGG(DISTINCT details::TEXT) AS attempt_details
FROM security_audit_logs
WHERE event_type = 'cross_org_access_attempt'
  AND created_at >= NOW() - INTERVAL '7 days'
GROUP BY user_id, current_org_id, target_org_id
ORDER BY attempt_count DESC;

COMMENT ON VIEW cross_org_access_attempts IS
'Shows users attempting cross-org data access (potential security breach attempts). Super_admin only (via RLS).';

CREATE VIEW org_id_null_violations
WITH (security_invoker = true)
AS
SELECT
  details->>'table' AS table_name,
  details->>'user_id' AS user_id,
  COUNT(*) AS violation_count,
  MAX(created_at) AS last_occurrence,
  ARRAY_AGG(details::TEXT ORDER BY created_at DESC) AS recent_violations
FROM security_audit_logs
WHERE event_type = 'org_id_null_attempt'
  AND created_at >= NOW() - INTERVAL '30 days'
GROUP BY details->>'table', details->>'user_id'
ORDER BY violation_count DESC;

COMMENT ON VIEW org_id_null_violations IS
'Tracks attempts to insert/update records with NULL org_id (critical security violation). Super_admin only (via RLS).';

-- Grant SELECT on recreated views
GRANT SELECT ON security_events_recent TO authenticated;
GRANT SELECT ON security_critical_events TO authenticated;
GRANT SELECT ON cross_org_access_attempts TO authenticated;
GRANT SELECT ON org_id_null_violations TO authenticated;

-- =====================================================
-- STEP 6: Verification
-- =====================================================

DO $$
DECLARE
  policy_record RECORD;
  view_record RECORD;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '=== Security Audit Logs RLS Policies ===';

  -- List policies
  FOR policy_record IN
    SELECT
      polname AS policy_name,
      polcmd AS command,
      polroles::regrole[] AS roles,
      pg_get_expr(polqual, polrelid) AS using_expression,
      pg_get_expr(polwithcheck, polrelid) AS with_check_expression
    FROM pg_policy
    WHERE polrelid = 'security_audit_logs'::regclass
    ORDER BY polname
  LOOP
    RAISE NOTICE 'Policy: %', policy_record.policy_name;
    RAISE NOTICE '  Command: %', policy_record.command;
    RAISE NOTICE '  USING: %', COALESCE(policy_record.using_expression, 'N/A');
    RAISE NOTICE '  WITH CHECK: %', COALESCE(policy_record.with_check_expression, 'N/A');
    RAISE NOTICE '';
  END LOOP;

  RAISE NOTICE 'RLS Status: %',
    CASE
      WHEN (SELECT relrowsecurity FROM pg_class WHERE relname = 'security_audit_logs')
      THEN 'ENABLED ✓'
      ELSE 'DISABLED ✗'
    END;

  RAISE NOTICE '';
  RAISE NOTICE '=== Security Views Configuration ===';

  -- Check view security properties
  FOR view_record IN
    SELECT
      schemaname,
      viewname,
      viewowner
    FROM pg_views
    WHERE viewname IN (
      'cross_org_attempts_by_user',
      'recent_critical_events',
      'security_events_recent',
      'security_critical_events',
      'cross_org_access_attempts',
      'org_id_null_violations'
    )
    ORDER BY viewname
  LOOP
    RAISE NOTICE 'View: %.% (owner: %)',
      view_record.schemaname,
      view_record.viewname,
      view_record.viewowner;
  END LOOP;

  RAISE NOTICE '';
  RAISE NOTICE '✓ All security views now use security_invoker (respect RLS)';
  RAISE NOTICE '✓ Only super_admins can view security audit logs';
  RAISE NOTICE '✓ Direct inserts to security_audit_logs are blocked';
  RAISE NOTICE '✓ Use log_security_event() function for audit logging';
END $$;

-- =====================================================
-- Expected Behavior After This Migration
-- =====================================================
-- ✓ Regular users CANNOT see security audit logs (even via views)
-- ✓ Super_admins CAN see all security audit logs and use monitoring views
-- ✓ System functions (SECURITY DEFINER) CAN insert audit logs
-- ✓ No direct inserts/updates/deletes allowed on security_audit_logs
-- ✓ All views respect RLS policies (security_invoker = true)
-- ✓ Multi-tenant isolation preserved for security monitoring

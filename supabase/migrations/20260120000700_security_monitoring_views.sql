-- =====================================================
-- Migration: Security Monitoring Views & Functions
-- Date: 2026-01-20
-- Purpose: SQL-based security monitoring for org_id NULL violations and audit events
-- =====================================================

-- This provides a manual monitoring solution that can be queried or automated
-- For production, consider integrating with Datadog/Sentry for automated alerts

-- =====================================================
-- SECURITY MONITORING VIEWS
-- =====================================================

-- View 1: Recent Security Events (Last 24 Hours)
CREATE OR REPLACE VIEW security_events_recent
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
'Shows all security events from the last 24 hours for quick monitoring. Uses security_invoker - respects RLS (super_admin only).';

-- View 2: Critical Security Events Summary
CREATE OR REPLACE VIEW security_critical_events
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
'Aggregates critical and high-severity security events from the last 7 days. Uses security_invoker - respects RLS (super_admin only).';

-- View 3: Cross-Org Access Attempts
CREATE OR REPLACE VIEW cross_org_access_attempts
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
'Shows users attempting cross-org data access (potential security breach attempts). Uses security_invoker - respects RLS (super_admin only).';

-- View 4: org_id NULL Violations
CREATE OR REPLACE VIEW org_id_null_violations
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
'Tracks attempts to insert/update records with NULL org_id (critical security violation). Uses security_invoker - respects RLS (super_admin only).';

-- View 5: Rate Limit Violations
CREATE OR REPLACE VIEW rate_limit_violations
WITH (security_invoker = true)
AS
SELECT
  identifier AS ip_address,
  endpoint,
  COUNT(*) AS total_attempts,
  MAX(last_attempt_at) AS last_blocked,
  SUM(attempt_count) AS cumulative_attempts
FROM rate_limit_log
WHERE attempt_count >= 5
  AND created_at >= NOW() - INTERVAL '7 days'
GROUP BY identifier, endpoint
ORDER BY total_attempts DESC;

COMMENT ON VIEW rate_limit_violations IS
'Shows IP addresses that have been rate limited in the last 7 days. Uses security_invoker - respects RLS.';

-- =====================================================
-- SECURITY MONITORING FUNCTIONS
-- =====================================================

-- Function: Get Security Health Status
CREATE OR REPLACE FUNCTION get_security_health_status()
RETURNS TABLE(
  metric_name TEXT,
  status TEXT,
  value BIGINT,
  threshold BIGINT,
  last_checked TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY

  -- Check 1: Critical events in last 24 hours
  SELECT
    'Critical Events (24h)'::TEXT,
    CASE
      WHEN COUNT(*) = 0 THEN 'OK'
      WHEN COUNT(*) < 5 THEN 'WARNING'
      ELSE 'CRITICAL'
    END::TEXT,
    COUNT(*)::BIGINT,
    5::BIGINT AS threshold,
    NOW()
  FROM security_audit_logs
  WHERE severity = 'critical'
    AND created_at >= NOW() - INTERVAL '24 hours'

  UNION ALL

  -- Check 2: Cross-org access attempts in last 24 hours
  SELECT
    'Cross-Org Attempts (24h)'::TEXT,
    CASE
      WHEN COUNT(*) = 0 THEN 'OK'
      WHEN COUNT(*) < 3 THEN 'WARNING'
      ELSE 'CRITICAL'
    END::TEXT,
    COUNT(*)::BIGINT,
    3::BIGINT,
    NOW()
  FROM security_audit_logs
  WHERE event_type = 'cross_org_access_attempt'
    AND created_at >= NOW() - INTERVAL '24 hours'

  UNION ALL

  -- Check 3: org_id NULL violations in last 24 hours
  SELECT
    'NULL org_id Violations (24h)'::TEXT,
    CASE
      WHEN COUNT(*) = 0 THEN 'OK'
      WHEN COUNT(*) < 2 THEN 'WARNING'
      ELSE 'CRITICAL'
    END::TEXT,
    COUNT(*)::BIGINT,
    2::BIGINT,
    NOW()
  FROM security_audit_logs
  WHERE event_type = 'org_id_null_attempt'
    AND created_at >= NOW() - INTERVAL '24 hours'

  UNION ALL

  -- Check 4: Rate limit violations in last 24 hours
  SELECT
    'Rate Limit Blocks (24h)'::TEXT,
    CASE
      WHEN COUNT(*) = 0 THEN 'OK'
      WHEN COUNT(*) < 10 THEN 'WARNING'
      ELSE 'CRITICAL'
    END::TEXT,
    COUNT(*)::BIGINT,
    10::BIGINT,
    NOW()
  FROM rate_limit_log
  WHERE attempt_count >= 5
    AND last_attempt_at >= NOW() - INTERVAL '24 hours'

  UNION ALL

  -- Check 5: Failed login attempts (if tracked)
  SELECT
    'High Severity Events (7d)'::TEXT,
    CASE
      WHEN COUNT(*) = 0 THEN 'OK'
      WHEN COUNT(*) < 20 THEN 'WARNING'
      ELSE 'CRITICAL'
    END::TEXT,
    COUNT(*)::BIGINT,
    20::BIGINT,
    NOW()
  FROM security_audit_logs
  WHERE severity = 'high'
    AND created_at >= NOW() - INTERVAL '7 days';

END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_security_health_status IS
'Returns overall security health metrics with OK/WARNING/CRITICAL status';

-- Function: Generate Security Report
CREATE OR REPLACE FUNCTION generate_security_report(
  p_days INTEGER DEFAULT 7
)
RETURNS TABLE(
  section TEXT,
  detail TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    'HEADER'::TEXT,
    format('Security Report - Last %s Days', p_days)::TEXT

  UNION ALL

  SELECT
    'HEADER'::TEXT,
    format('Generated: %s', NOW()::TEXT)::TEXT

  UNION ALL

  SELECT
    'DIVIDER'::TEXT,
    '================================================'::TEXT

  UNION ALL

  -- Section 1: Security Health
  SELECT
    'SECTION'::TEXT,
    'Security Health Status'::TEXT

  UNION ALL

  SELECT
    'METRIC'::TEXT,
    format('  %s: %s (Value: %s, Threshold: %s)',
      metric_name, status, value, threshold)
  FROM get_security_health_status()

  UNION ALL

  SELECT
    'DIVIDER'::TEXT,
    '================================================'::TEXT

  UNION ALL

  -- Section 2: Top Security Events
  SELECT
    'SECTION'::TEXT,
    'Top Security Events'::TEXT

  UNION ALL

  (SELECT
    'EVENT'::TEXT,
    format('  %s: %s occurrences (Last: %s)',
      event_type, event_count, last_occurrence)
  FROM security_critical_events
  LIMIT 10)

  UNION ALL

  SELECT
    'DIVIDER'::TEXT,
    '================================================'::TEXT

  UNION ALL

  -- Section 3: Cross-Org Access Attempts
  SELECT
    'SECTION'::TEXT,
    'Cross-Org Access Attempts'::TEXT

  UNION ALL

  (SELECT
    'ALERT'::TEXT,
    format('  User %s attempted %s times (Last: %s)',
      user_id, attempt_count, last_attempt)
  FROM cross_org_access_attempts
  LIMIT 10)

  UNION ALL

  SELECT
    'DIVIDER'::TEXT,
    '================================================'::TEXT

  UNION ALL

  -- Section 4: Rate Limiting
  SELECT
    'SECTION'::TEXT,
    'Rate Limit Violations'::TEXT

  UNION ALL

  (SELECT
    'ALERT'::TEXT,
    format('  IP %s: %s attempts on %s (Last: %s)',
      ip_address, total_attempts, endpoint, last_blocked)
  FROM rate_limit_violations
  LIMIT 10);

END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION generate_security_report IS
'Generates a comprehensive security report for the specified time period';

-- =====================================================
-- AUTOMATED ALERT FUNCTION
-- =====================================================

CREATE OR REPLACE FUNCTION check_security_alerts()
RETURNS TABLE(
  alert_level TEXT,
  alert_message TEXT,
  action_required TEXT
) AS $$
DECLARE
  v_critical_count INTEGER;
  v_null_org_count INTEGER;
  v_cross_org_count INTEGER;
BEGIN
  -- Count critical events in last hour
  SELECT COUNT(*) INTO v_critical_count
  FROM security_audit_logs
  WHERE severity = 'critical'
    AND created_at >= NOW() - INTERVAL '1 hour';

  -- Count NULL org_id attempts in last hour
  SELECT COUNT(*) INTO v_null_org_count
  FROM security_audit_logs
  WHERE event_type = 'org_id_null_attempt'
    AND created_at >= NOW() - INTERVAL '1 hour';

  -- Count cross-org access attempts in last hour
  SELECT COUNT(*) INTO v_cross_org_count
  FROM security_audit_logs
  WHERE event_type = 'cross_org_access_attempt'
    AND created_at >= NOW() - INTERVAL '1 hour';

  -- Alert if critical events detected
  IF v_critical_count > 0 THEN
    RETURN QUERY SELECT
      'CRITICAL'::TEXT,
      format('%s critical security events in last hour', v_critical_count)::TEXT,
      'Review security_events_recent view immediately'::TEXT;
  END IF;

  -- Alert if NULL org_id violations detected
  IF v_null_org_count > 0 THEN
    RETURN QUERY SELECT
      'CRITICAL'::TEXT,
      format('%s org_id NULL violations in last hour', v_null_org_count)::TEXT,
      'Check org_id_null_violations view and investigate trigger failures'::TEXT;
  END IF;

  -- Alert if cross-org access attempts detected
  IF v_cross_org_count >= 3 THEN
    RETURN QUERY SELECT
      'WARNING'::TEXT,
      format('%s cross-org access attempts in last hour', v_cross_org_count)::TEXT,
      'Review cross_org_access_attempts view for potential breach attempts'::TEXT;
  END IF;

  -- If no alerts, return OK status
  IF v_critical_count = 0 AND v_null_org_count = 0 AND v_cross_org_count < 3 THEN
    RETURN QUERY SELECT
      'OK'::TEXT,
      'No security alerts in the last hour'::TEXT,
      'Continue monitoring'::TEXT;
  END IF;

  RETURN;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION check_security_alerts IS
'Checks for security alerts and returns action items. Can be called via cron for monitoring.';

-- =====================================================
-- GRANT PERMISSIONS
-- =====================================================

-- Grant access to monitoring views
GRANT SELECT ON security_events_recent TO authenticated;
GRANT SELECT ON security_critical_events TO authenticated;
GRANT SELECT ON cross_org_access_attempts TO authenticated;
GRANT SELECT ON org_id_null_violations TO authenticated;
GRANT SELECT ON rate_limit_violations TO authenticated;

-- Grant execute on monitoring functions (service_role only for security)
GRANT EXECUTE ON FUNCTION get_security_health_status TO service_role;
GRANT EXECUTE ON FUNCTION generate_security_report TO service_role;
GRANT EXECUTE ON FUNCTION check_security_alerts TO service_role;

-- =====================================================
-- USAGE EXAMPLES
-- =====================================================

COMMENT ON FUNCTION check_security_alerts IS
'Usage Examples:

-- Check for immediate security alerts
SELECT * FROM check_security_alerts();

-- Get overall security health
SELECT * FROM get_security_health_status();

-- Generate 7-day security report
SELECT * FROM generate_security_report(7);

-- View recent security events
SELECT * FROM security_events_recent LIMIT 20;

-- Check for NULL org_id violations
SELECT * FROM org_id_null_violations;

-- Monitor cross-org access attempts
SELECT * FROM cross_org_access_attempts;

-- Setup automated monitoring via pg_cron (optional):
SELECT cron.schedule(
  ''security-health-check'',
  ''0 * * * *'',  -- Every hour
  ''SELECT * FROM check_security_alerts()''
);
';

-- =====================================================
-- Migration: Security Audit Logging
-- Date: 2026-01-20
-- Purpose: Track security events, especially cross-org access attempts
-- =====================================================

-- =====================================================
-- AUDIT LOG TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS security_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Event metadata
  event_type VARCHAR(50) NOT NULL, -- 'cross_org_access', 'auth_failure', 'privilege_escalation', etc.
  severity VARCHAR(20) NOT NULL, -- 'info', 'warning', 'critical'

  -- User information
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  user_email VARCHAR(255),
  user_ip_address INET,
  user_agent TEXT,

  -- Organization context
  current_org_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
  target_org_id UUID REFERENCES organizations(id) ON DELETE SET NULL,

  -- Resource details
  resource_type VARCHAR(50), -- 'requisition', 'project', 'user', etc.
  resource_id UUID,
  action_attempted VARCHAR(50), -- 'read', 'create', 'update', 'delete'

  -- Event details
  message TEXT NOT NULL,
  details JSONB, -- Additional structured data

  -- Response
  was_blocked BOOLEAN DEFAULT true,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- Indexes for querying
  CONSTRAINT check_severity CHECK (severity IN ('info', 'warning', 'critical'))
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_audit_logs_event_type ON security_audit_logs(event_type);
CREATE INDEX IF NOT EXISTS idx_audit_logs_severity ON security_audit_logs(severity);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON security_audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON security_audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_current_org ON security_audit_logs(current_org_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_target_org ON security_audit_logs(target_org_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_blocked ON security_audit_logs(was_blocked) WHERE was_blocked = true;

-- Composite index for critical events
CREATE INDEX IF NOT EXISTS idx_audit_logs_critical_recent
  ON security_audit_logs(severity, created_at DESC)
  WHERE severity = 'critical';

COMMENT ON TABLE security_audit_logs IS
'Security audit log for tracking access attempts, authentication failures, and policy violations';

-- =====================================================
-- AUDIT LOGGING FUNCTION
-- =====================================================

CREATE OR REPLACE FUNCTION log_security_event(
  p_event_type VARCHAR(50),
  p_severity VARCHAR(20),
  p_message TEXT,
  p_current_org_id UUID DEFAULT NULL,
  p_target_org_id UUID DEFAULT NULL,
  p_resource_type VARCHAR(50) DEFAULT NULL,
  p_resource_id UUID DEFAULT NULL,
  p_action_attempted VARCHAR(50) DEFAULT NULL,
  p_was_blocked BOOLEAN DEFAULT true,
  p_details JSONB DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_log_id UUID;
  v_user_id UUID;
  v_user_email VARCHAR(255);
BEGIN
  -- Get current user info
  v_user_id := (SELECT auth.uid());

  IF v_user_id IS NOT NULL THEN
    SELECT email INTO v_user_email
    FROM auth.users
    WHERE id = v_user_id;
  END IF;

  -- Insert audit log
  INSERT INTO public.security_audit_logs (
    event_type,
    severity,
    user_id,
    user_email,
    current_org_id,
    target_org_id,
    resource_type,
    resource_id,
    action_attempted,
    message,
    details,
    was_blocked
  ) VALUES (
    p_event_type,
    p_severity,
    v_user_id,
    v_user_email,
    p_current_org_id,
    p_target_org_id,
    p_resource_type,
    p_resource_id,
    p_action_attempted,
    p_message,
    p_details,
    p_was_blocked
  )
  RETURNING id INTO v_log_id;

  -- If critical, you could trigger alerts here (email, Slack, etc.)
  IF p_severity = 'critical' THEN
    -- Log to PostgreSQL log for immediate visibility
    RAISE WARNING 'SECURITY ALERT: % - %', p_event_type, p_message;
  END IF;

  RETURN v_log_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = '';

COMMENT ON FUNCTION log_security_event(VARCHAR(50), VARCHAR(20), TEXT, UUID, UUID, VARCHAR(50), UUID, VARCHAR(50), BOOLEAN, JSONB) IS
'Logs security events with automatic user context capture. Returns log ID.';

-- =====================================================
-- HELPER: Log Cross-Org Access Attempt
-- =====================================================

CREATE OR REPLACE FUNCTION log_cross_org_access(
  p_resource_type VARCHAR(50),
  p_resource_id UUID,
  p_resource_org_id UUID,
  p_action VARCHAR(50)
)
RETURNS UUID AS $$
DECLARE
  v_current_org_id UUID;
  v_message TEXT;
BEGIN
  v_current_org_id := public.get_current_org_id();

  v_message := format(
    'User attempted to %s %s (id: %s) belonging to org %s while authenticated to org %s',
    p_action,
    p_resource_type,
    p_resource_id,
    p_resource_org_id,
    v_current_org_id
  );

  RETURN public.log_security_event(
    p_event_type := 'cross_org_access_attempt',
    p_severity := 'critical',
    p_message := v_message,
    p_current_org_id := v_current_org_id,
    p_target_org_id := p_resource_org_id,
    p_resource_type := p_resource_type,
    p_resource_id := p_resource_id,
    p_action_attempted := p_action,
    p_was_blocked := true,
    p_details := jsonb_build_object(
      'timestamp', NOW(),
      'detection_method', 'api_validation'
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = '';

COMMENT ON FUNCTION log_cross_org_access(VARCHAR(50), UUID, UUID, VARCHAR(50)) IS
'Convenience function to log cross-organization access attempts';

-- =====================================================
-- RLS POLICIES FOR AUDIT LOGS
-- =====================================================

-- Enable RLS on audit logs table
ALTER TABLE security_audit_logs ENABLE ROW LEVEL SECURITY;

-- Only super admins and org owners can view audit logs for their org
DROP POLICY IF EXISTS "Org owners can view their org audit logs" ON security_audit_logs;
CREATE POLICY "Org owners can view their org audit logs"
  ON security_audit_logs FOR SELECT
  TO authenticated
  USING (
    current_org_id IN (
      SELECT organization_id
      FROM organization_members
      WHERE user_id = auth.uid()
      AND role = 'owner'
      AND is_active = true
    )
  );

-- Service role can view all logs (for monitoring/alerts)
DROP POLICY IF EXISTS "Service role full access" ON security_audit_logs;
CREATE POLICY "Service role full access"
  ON security_audit_logs FOR ALL
  TO service_role
  USING (true);

-- =====================================================
-- AUTOMATIC CLEANUP OF OLD LOGS
-- =====================================================

-- Function to archive old logs (keeps last 90 days by default)
CREATE OR REPLACE FUNCTION cleanup_old_audit_logs(
  p_retention_days INTEGER DEFAULT 90
)
RETURNS INTEGER AS $$
DECLARE
  v_deleted_count INTEGER;
BEGIN
  DELETE FROM public.security_audit_logs
  WHERE created_at < NOW() - (p_retention_days || ' days')::INTERVAL
  AND severity != 'critical'; -- Keep critical logs longer

  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;

  RAISE NOTICE 'Deleted % audit log entries older than % days', v_deleted_count, p_retention_days;

  RETURN v_deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = '';

COMMENT ON FUNCTION cleanup_old_audit_logs IS
'Cleanup old audit logs (except critical ones). Run this periodically via cron job.';

-- =====================================================
-- VIEWS FOR COMMON QUERIES
-- =====================================================

-- View for recent critical security events
CREATE OR REPLACE VIEW recent_critical_events
WITH (security_invoker = true) AS
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
'Shows critical security events from the last 7 days';

-- View for cross-org access attempts by user
CREATE OR REPLACE VIEW cross_org_attempts_by_user
WITH (security_invoker = true) AS
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
'Summarizes cross-org access attempts by user over the last 30 days';

-- =====================================================
-- GRANT PERMISSIONS
-- =====================================================

-- Grant execute permissions on audit functions to authenticated users
GRANT EXECUTE ON FUNCTION log_security_event(VARCHAR(50), VARCHAR(20), TEXT, UUID, UUID, VARCHAR(50), UUID, VARCHAR(50), BOOLEAN, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION log_cross_org_access(VARCHAR(50), UUID, UUID, VARCHAR(50)) TO authenticated;

-- Grant select on views to authenticated users (RLS will filter)
GRANT SELECT ON recent_critical_events TO authenticated;
GRANT SELECT ON cross_org_attempts_by_user TO authenticated;

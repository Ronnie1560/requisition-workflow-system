-- =============================================================================
-- Admin Platform Auth Hardening Migration
-- Date: 2026-02-12
-- Adds: login audit trail, IP allowlisting, rate limiting, session tracking
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Login attempts tracking (rate limiting + audit)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS platform_login_attempts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL,
  ip_address INET,
  user_agent TEXT,
  success BOOLEAN NOT NULL DEFAULT false,
  failure_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_login_attempts_email_created ON platform_login_attempts (email, created_at DESC);
CREATE INDEX idx_login_attempts_ip_created ON platform_login_attempts (ip_address, created_at DESC);

-- RLS: only platform admins can read login attempts
ALTER TABLE platform_login_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "platform_admins_read_login_attempts"
  ON platform_login_attempts FOR SELECT
  USING (is_platform_admin());

CREATE POLICY "anyone_can_insert_login_attempts"
  ON platform_login_attempts FOR INSERT
  WITH CHECK (true);

-- ---------------------------------------------------------------------------
-- 2. Add security columns to platform_admins
-- ---------------------------------------------------------------------------
ALTER TABLE platform_admins
  ADD COLUMN IF NOT EXISTS allowed_ips INET[] DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS require_ip_check BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS session_timeout_minutes INTEGER DEFAULT 60,
  ADD COLUMN IF NOT EXISTS last_login_ip INET,
  ADD COLUMN IF NOT EXISTS failed_login_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS locked_until TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS totp_secret TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS totp_enabled BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS totp_verified_at TIMESTAMPTZ DEFAULT NULL;

-- ---------------------------------------------------------------------------
-- 3. Active sessions tracking
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS platform_admin_sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  admin_id UUID NOT NULL REFERENCES platform_admins(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  ip_address INET,
  user_agent TEXT,
  started_at TIMESTAMPTZ DEFAULT now(),
  last_active_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  is_active BOOLEAN DEFAULT true
);

CREATE INDEX idx_sessions_admin_active ON platform_admin_sessions (admin_id, is_active);
CREATE INDEX idx_sessions_expires ON platform_admin_sessions (expires_at) WHERE is_active = true;

ALTER TABLE platform_admin_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "platform_admins_manage_sessions"
  ON platform_admin_sessions FOR ALL
  USING (is_platform_admin());

-- ---------------------------------------------------------------------------
-- 4. Rate-limiting check function
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION check_login_rate_limit(p_email TEXT, p_ip INET DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_email_attempts INTEGER;
  v_ip_attempts INTEGER;
  v_admin RECORD;
  v_result JSONB;
BEGIN
  -- Count failed attempts in last 15 minutes for this email
  SELECT COUNT(*) INTO v_email_attempts
  FROM platform_login_attempts
  WHERE email = p_email
    AND success = false
    AND created_at > now() - INTERVAL '15 minutes';

  -- Count failed attempts in last 15 minutes for this IP
  IF p_ip IS NOT NULL THEN
    SELECT COUNT(*) INTO v_ip_attempts
    FROM platform_login_attempts
    WHERE ip_address = p_ip
      AND success = false
      AND created_at > now() - INTERVAL '15 minutes';
  ELSE
    v_ip_attempts := 0;
  END IF;

  -- Check if admin account is locked
  SELECT * INTO v_admin
  FROM platform_admins
  WHERE email = p_email AND is_active = true;

  v_result := jsonb_build_object(
    'allowed', true,
    'email_attempts', v_email_attempts,
    'ip_attempts', v_ip_attempts,
    'max_attempts', 5,
    'locked', false,
    'locked_until', null
  );

  -- Account locked?
  IF v_admin IS NOT NULL AND v_admin.locked_until IS NOT NULL AND v_admin.locked_until > now() THEN
    v_result := v_result || jsonb_build_object(
      'allowed', false,
      'locked', true,
      'locked_until', v_admin.locked_until
    );
    RETURN v_result;
  END IF;

  -- Too many email attempts (5 in 15 min)
  IF v_email_attempts >= 5 THEN
    -- Lock account for 15 minutes
    IF v_admin IS NOT NULL THEN
      UPDATE platform_admins
      SET locked_until = now() + INTERVAL '15 minutes',
          failed_login_count = COALESCE(failed_login_count, 0) + 1
      WHERE id = v_admin.id;
    END IF;
    v_result := v_result || jsonb_build_object('allowed', false, 'locked', true);
  END IF;

  -- Too many IP attempts (10 in 15 min)
  IF v_ip_attempts >= 10 THEN
    v_result := v_result || jsonb_build_object('allowed', false);
  END IF;

  RETURN v_result;
END;
$$;

-- ---------------------------------------------------------------------------
-- 5. Record login attempt function
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION record_login_attempt(
  p_email TEXT,
  p_success BOOLEAN,
  p_ip INET DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL,
  p_failure_reason TEXT DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO platform_login_attempts (email, ip_address, user_agent, success, failure_reason)
  VALUES (p_email, p_ip, p_user_agent, p_success, p_failure_reason);

  -- On success, reset failed count and update last login IP
  IF p_success THEN
    UPDATE platform_admins
    SET failed_login_count = 0,
        locked_until = NULL,
        last_login_ip = p_ip,
        last_login_at = now()
    WHERE email = p_email;
  END IF;
END;
$$;

-- ---------------------------------------------------------------------------
-- 6. Check IP allowlist function
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION check_admin_ip_allowed(p_admin_id UUID, p_ip INET)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_admin RECORD;
BEGIN
  SELECT * INTO v_admin
  FROM platform_admins
  WHERE id = p_admin_id AND is_active = true;

  IF v_admin IS NULL THEN
    RETURN false;
  END IF;

  -- If IP check is not required, allow
  IF NOT COALESCE(v_admin.require_ip_check, false) THEN
    RETURN true;
  END IF;

  -- If no IPs configured, allow (safety)
  IF v_admin.allowed_ips IS NULL OR array_length(v_admin.allowed_ips, 1) IS NULL THEN
    RETURN true;
  END IF;

  -- Check if IP is in allowed list
  RETURN p_ip = ANY(v_admin.allowed_ips);
END;
$$;

-- ---------------------------------------------------------------------------
-- 7. Create/refresh session function
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION create_admin_session(
  p_ip INET DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_admin RECORD;
  v_session_id UUID;
  v_timeout INTEGER;
BEGIN
  SELECT * INTO v_admin
  FROM platform_admins
  WHERE user_id = auth.uid() AND is_active = true;

  IF v_admin IS NULL THEN
    RAISE EXCEPTION 'Not a platform admin';
  END IF;

  v_timeout := COALESCE(v_admin.session_timeout_minutes, 60);

  -- Deactivate old sessions
  UPDATE platform_admin_sessions
  SET is_active = false
  WHERE admin_id = v_admin.id
    AND is_active = true
    AND last_active_at < now() - (v_timeout || ' minutes')::INTERVAL;

  -- Create new session
  INSERT INTO platform_admin_sessions (admin_id, user_id, ip_address, user_agent, expires_at)
  VALUES (v_admin.id, auth.uid(), p_ip, p_user_agent, now() + (v_timeout || ' minutes')::INTERVAL)
  RETURNING id INTO v_session_id;

  RETURN v_session_id;
END;
$$;

-- ---------------------------------------------------------------------------
-- 8. Touch session (keep alive)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION touch_admin_session(p_session_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_admin RECORD;
  v_timeout INTEGER;
BEGIN
  SELECT pa.* INTO v_admin
  FROM platform_admins pa
  WHERE pa.user_id = auth.uid() AND pa.is_active = true;

  IF v_admin IS NULL THEN
    RETURN false;
  END IF;

  v_timeout := COALESCE(v_admin.session_timeout_minutes, 60);

  UPDATE platform_admin_sessions
  SET last_active_at = now(),
      expires_at = now() + (v_timeout || ' minutes')::INTERVAL
  WHERE id = p_session_id
    AND admin_id = v_admin.id
    AND is_active = true
    AND expires_at > now();

  RETURN FOUND;
END;
$$;

-- ---------------------------------------------------------------------------
-- 9. Invalidate session
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION invalidate_admin_session(p_session_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE platform_admin_sessions
  SET is_active = false
  WHERE id = p_session_id
    AND user_id = auth.uid();
END;
$$;

-- ---------------------------------------------------------------------------
-- 10. Get admin security settings (for security settings page)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_admin_security_settings()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_admin RECORD;
BEGIN
  SELECT * INTO v_admin
  FROM platform_admins
  WHERE user_id = auth.uid() AND is_active = true;

  IF v_admin IS NULL THEN
    RETURN NULL;
  END IF;

  RETURN jsonb_build_object(
    'id', v_admin.id,
    'email', v_admin.email,
    'name', v_admin.name,
    'require_ip_check', COALESCE(v_admin.require_ip_check, false),
    'allowed_ips', v_admin.allowed_ips,
    'session_timeout_minutes', COALESCE(v_admin.session_timeout_minutes, 60),
    'totp_enabled', COALESCE(v_admin.totp_enabled, false),
    'last_login_at', v_admin.last_login_at,
    'last_login_ip', v_admin.last_login_ip,
    'failed_login_count', COALESCE(v_admin.failed_login_count, 0)
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- 11. Update admin security settings
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION update_admin_security_settings(
  p_require_ip_check BOOLEAN DEFAULT NULL,
  p_allowed_ips INET[] DEFAULT NULL,
  p_session_timeout_minutes INTEGER DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE platform_admins
  SET
    require_ip_check = COALESCE(p_require_ip_check, require_ip_check),
    allowed_ips = CASE WHEN p_allowed_ips IS NOT NULL THEN p_allowed_ips ELSE allowed_ips END,
    session_timeout_minutes = COALESCE(p_session_timeout_minutes, session_timeout_minutes)
  WHERE user_id = auth.uid() AND is_active = true;

  RETURN FOUND;
END;
$$;

-- ---------------------------------------------------------------------------
-- 12. Get active sessions (for admin to see all their sessions)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_admin_active_sessions()
RETURNS SETOF platform_admin_sessions
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT *
  FROM platform_admin_sessions
  WHERE user_id = auth.uid()
    AND is_active = true
    AND expires_at > now()
  ORDER BY last_active_at DESC;
END;
$$;

-- ---------------------------------------------------------------------------
-- 13. Revoke all other sessions
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION revoke_other_admin_sessions(p_current_session_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  UPDATE platform_admin_sessions
  SET is_active = false
  WHERE user_id = auth.uid()
    AND is_active = true
    AND id != p_current_session_id;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

-- ---------------------------------------------------------------------------
-- 14. Cleanup: expire old sessions and purge old login attempts
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION cleanup_admin_security_data()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Expire sessions past their expiration
  UPDATE platform_admin_sessions
  SET is_active = false
  WHERE is_active = true
    AND expires_at < now();

  -- Purge login attempts older than 90 days
  DELETE FROM platform_login_attempts
  WHERE created_at < now() - INTERVAL '90 days';
END;
$$;

-- Grant execute to anon for rate limiting checks (pre-login)
GRANT EXECUTE ON FUNCTION check_login_rate_limit TO anon;
GRANT EXECUTE ON FUNCTION record_login_attempt TO anon;

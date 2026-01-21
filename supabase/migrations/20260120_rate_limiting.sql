-- =====================================================
-- Migration: Rate Limiting for Signup Endpoint
-- Date: 2026-01-20
-- Purpose: Prevent abuse of organization signup endpoint
-- =====================================================

-- Create rate limiting log table
CREATE TABLE IF NOT EXISTS rate_limit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  endpoint VARCHAR(100) NOT NULL,
  identifier VARCHAR(255) NOT NULL, -- IP address or user identifier
  attempt_count INTEGER DEFAULT 1,
  first_attempt_at TIMESTAMPTZ DEFAULT NOW(),
  last_attempt_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_rate_limit_endpoint_identifier
  ON rate_limit_log(endpoint, identifier, last_attempt_at DESC);

-- Index for cleanup queries
CREATE INDEX IF NOT EXISTS idx_rate_limit_created_at
  ON rate_limit_log(created_at);

COMMENT ON TABLE rate_limit_log IS
'Tracks API request rates to prevent abuse. Used for rate limiting signup and other public endpoints.';

COMMENT ON COLUMN rate_limit_log.endpoint IS
'The endpoint being rate limited (e.g., "signup", "login")';

COMMENT ON COLUMN rate_limit_log.identifier IS
'Unique identifier for the requester (IP address, email, etc.)';

COMMENT ON COLUMN rate_limit_log.attempt_count IS
'Number of attempts within the current time window';

-- =====================================================
-- RATE LIMITING FUNCTION
-- =====================================================

CREATE OR REPLACE FUNCTION check_rate_limit(
  p_endpoint VARCHAR(100),
  p_identifier VARCHAR(255),
  p_max_attempts INTEGER DEFAULT 5,
  p_window_minutes INTEGER DEFAULT 60
)
RETURNS JSON AS $$
DECLARE
  v_recent_log RECORD;
  v_window_start TIMESTAMPTZ;
  v_is_allowed BOOLEAN;
  v_retry_after INTEGER;
BEGIN
  -- Calculate time window start
  v_window_start := NOW() - (p_window_minutes || ' minutes')::INTERVAL;

  -- Check for recent attempts within the window
  SELECT
    id,
    attempt_count,
    first_attempt_at,
    last_attempt_at
  INTO v_recent_log
  FROM rate_limit_log
  WHERE endpoint = p_endpoint
    AND identifier = p_identifier
    AND last_attempt_at >= v_window_start
  ORDER BY last_attempt_at DESC
  LIMIT 1;

  -- If no recent log or outside window, create new entry
  IF v_recent_log IS NULL THEN
    INSERT INTO rate_limit_log (endpoint, identifier, attempt_count)
    VALUES (p_endpoint, p_identifier, 1);

    RETURN json_build_object(
      'allowed', true,
      'attempts_remaining', p_max_attempts - 1,
      'retry_after', NULL
    );
  END IF;

  -- Check if limit exceeded
  IF v_recent_log.attempt_count >= p_max_attempts THEN
    -- Calculate seconds until window expires
    v_retry_after := EXTRACT(EPOCH FROM (
      v_recent_log.first_attempt_at + (p_window_minutes || ' minutes')::INTERVAL - NOW()
    ))::INTEGER;

    RETURN json_build_object(
      'allowed', false,
      'attempts_remaining', 0,
      'retry_after', GREATEST(v_retry_after, 0)
    );
  END IF;

  -- Increment attempt count
  UPDATE rate_limit_log
  SET
    attempt_count = attempt_count + 1,
    last_attempt_at = NOW()
  WHERE id = v_recent_log.id;

  RETURN json_build_object(
    'allowed', true,
    'attempts_remaining', p_max_attempts - (v_recent_log.attempt_count + 1),
    'retry_after', NULL
  );
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION check_rate_limit IS
'Checks if a request should be rate limited. Returns JSON with allowed status, attempts remaining, and retry_after seconds.';

-- =====================================================
-- CLEANUP FUNCTION (removes old logs)
-- =====================================================

CREATE OR REPLACE FUNCTION cleanup_rate_limit_logs()
RETURNS INTEGER AS $$
DECLARE
  v_deleted_count INTEGER;
BEGIN
  -- Delete logs older than 24 hours
  DELETE FROM rate_limit_log
  WHERE created_at < NOW() - INTERVAL '24 hours';

  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;

  RETURN v_deleted_count;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION cleanup_rate_limit_logs IS
'Removes rate limit logs older than 24 hours. Should be called periodically via cron job.';

-- =====================================================
-- RLS POLICIES (rate_limit_log should only be accessible by service role)
-- =====================================================

ALTER TABLE rate_limit_log ENABLE ROW LEVEL SECURITY;

-- No user access - only service role can read/write
CREATE POLICY rate_limit_service_role_only ON rate_limit_log
  FOR ALL
  USING (false); -- Deny all user access

COMMENT ON POLICY rate_limit_service_role_only ON rate_limit_log IS
'Rate limit logs are only accessible via service role (Edge Functions). Users cannot view or modify.';

-- =====================================================
-- GRANT PERMISSIONS
-- =====================================================

-- Grant service role full access
GRANT ALL ON rate_limit_log TO service_role;
GRANT EXECUTE ON FUNCTION check_rate_limit TO service_role;
GRANT EXECUTE ON FUNCTION cleanup_rate_limit_logs TO service_role;

-- =====================================================
-- TEST RATE LIMITING FUNCTION
-- =====================================================

DO $$
DECLARE
  test_result JSON;
  i INTEGER;
BEGIN
  RAISE NOTICE '================================================';
  RAISE NOTICE 'RATE LIMITING TESTS';
  RAISE NOTICE '================================================';

  -- Test 1: First attempt should be allowed
  SELECT check_rate_limit('test-endpoint', '192.168.1.1', 3, 5) INTO test_result;

  IF (test_result->>'allowed')::BOOLEAN = true THEN
    RAISE NOTICE '✓ Test 1 PASS: First attempt allowed';
  ELSE
    RAISE NOTICE '✗ Test 1 FAIL: First attempt blocked';
  END IF;

  -- Test 2: Subsequent attempts within limit
  FOR i IN 1..2 LOOP
    SELECT check_rate_limit('test-endpoint', '192.168.1.1', 3, 5) INTO test_result;
  END LOOP;

  IF (test_result->>'allowed')::BOOLEAN = true THEN
    RAISE NOTICE '✓ Test 2 PASS: Attempts within limit allowed';
  ELSE
    RAISE NOTICE '✗ Test 2 FAIL: Attempt within limit blocked';
  END IF;

  -- Test 3: Exceeding limit should block
  SELECT check_rate_limit('test-endpoint', '192.168.1.1', 3, 5) INTO test_result;

  IF (test_result->>'allowed')::BOOLEAN = false AND (test_result->>'retry_after')::INTEGER > 0 THEN
    RAISE NOTICE '✓ Test 3 PASS: Exceeded limit blocked with retry_after: % seconds', (test_result->>'retry_after')::INTEGER;
  ELSE
    RAISE NOTICE '✗ Test 3 FAIL: Limit not enforced properly';
  END IF;

  -- Test 4: Different identifier should be allowed
  SELECT check_rate_limit('test-endpoint', '192.168.1.2', 3, 5) INTO test_result;

  IF (test_result->>'allowed')::BOOLEAN = true THEN
    RAISE NOTICE '✓ Test 4 PASS: Different identifier allowed independently';
  ELSE
    RAISE NOTICE '✗ Test 4 FAIL: Different identifier incorrectly blocked';
  END IF;

  -- Cleanup test data
  DELETE FROM rate_limit_log WHERE endpoint = 'test-endpoint';

  RAISE NOTICE '================================================';
  RAISE NOTICE 'Rate limiting tests completed';
  RAISE NOTICE '================================================';
END $$;

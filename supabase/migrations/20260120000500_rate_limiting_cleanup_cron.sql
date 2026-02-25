-- =====================================================
-- Migration: Rate Limiting Cleanup Cron Job
-- Date: 2026-01-20
-- Purpose: Automatically clean up old rate limit logs daily
-- =====================================================

-- Note: Supabase requires pg_cron extension to be enabled in the dashboard
-- This migration will attempt to create the cron job, but will fail gracefully
-- if pg_cron is not enabled.

-- Try to create the cron job (will fail if pg_cron extension is not enabled)
DO $$
BEGIN
  -- Check if pg_cron extension is available
  IF EXISTS (
    SELECT 1 FROM pg_available_extensions WHERE name = 'pg_cron'
  ) THEN
    -- Enable pg_cron if not already enabled
    CREATE EXTENSION IF NOT EXISTS pg_cron;

    -- Schedule daily cleanup at 3 AM UTC
    -- This removes rate_limit_log entries older than 24 hours
    PERFORM cron.schedule(
      'cleanup-rate-limit-logs',           -- job name
      '0 3 * * *',                         -- cron expression: daily at 3 AM UTC
      'SELECT cleanup_rate_limit_logs();'  -- SQL command to execute
    );

    RAISE NOTICE 'Rate limit cleanup cron job scheduled successfully';
  ELSE
    RAISE NOTICE 'pg_cron extension not available. Manual cleanup required.';
    RAISE NOTICE 'To enable: Go to Supabase Dashboard > Database > Extensions > Enable pg_cron';
    RAISE NOTICE 'Then run: SELECT cron.schedule(''cleanup-rate-limit-logs'', ''0 3 * * *'', ''SELECT cleanup_rate_limit_logs();'');';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Could not schedule cron job: %', SQLERRM;
    RAISE NOTICE 'You can manually clean up rate limit logs by running: SELECT cleanup_rate_limit_logs();';
END $$;

-- =====================================================
-- MANUAL CLEANUP INSTRUCTIONS (if pg_cron is not available)
-- =====================================================

COMMENT ON FUNCTION cleanup_rate_limit_logs IS
'Removes rate limit logs older than 24 hours.

**Automatic Cleanup (Recommended):**
If pg_cron extension is enabled, this function runs automatically daily at 3 AM UTC.

**Manual Cleanup:**
If pg_cron is not available, run this periodically via external cron:
  SELECT cleanup_rate_limit_logs();

**Enable pg_cron:**
1. Go to Supabase Dashboard > Database > Extensions
2. Search for "pg_cron" and enable it
3. Run: SELECT cron.schedule(''cleanup-rate-limit-logs'', ''0 3 * * *'', ''SELECT cleanup_rate_limit_logs();'');
';

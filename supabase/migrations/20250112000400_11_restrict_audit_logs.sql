-- =====================================================
-- SECURITY FIX: Restrict System Table Insertions
-- =====================================================
-- This migration restricts audit logs and notifications insertion to service role only
-- Previously: WITH CHECK (true) allowed any authenticated user to write
-- Now: Only service role or authorized functions can insert

-- =====================================================
-- AUDIT LOGS - Restrict to Service Role Only
-- =====================================================

-- Drop the overly permissive policy
DROP POLICY IF EXISTS "System can insert audit logs" ON audit_logs;

-- Create a new policy that only allows service role
-- Service role is identified by the JWT role claim
CREATE POLICY "Service role can insert audit logs"
  ON audit_logs FOR INSERT
  TO service_role
  WITH CHECK (true);

-- Note: Application code should use the service role client for audit logging
-- Regular users should NOT have INSERT access to audit_logs

-- =====================================================
-- NOTIFICATIONS - Restrict to Service Role Only
-- =====================================================

-- Drop the overly permissive policy
DROP POLICY IF EXISTS "System can create notifications" ON notifications;

-- Create a new policy that only allows service role
CREATE POLICY "Service role can create notifications"
  ON notifications FOR INSERT
  TO service_role
  WITH CHECK (true);

-- Note: Notifications are created by triggers and edge functions using service role
-- Regular users should NOT have INSERT access to notifications table

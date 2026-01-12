-- =====================================================
-- SECURITY FIX: Restrict System Table Insertions (CORRECTED)
-- =====================================================
-- This migration fixes the policy names to match actual database policies

-- =====================================================
-- AUDIT LOGS - Remove ALL existing INSERT policies and create new one
-- =====================================================

-- Drop ALL possible policy name variations
DROP POLICY IF EXISTS "System can insert audit logs" ON audit_logs;
DROP POLICY IF EXISTS "System can create audit logs" ON audit_logs;
DROP POLICY IF EXISTS "authenticated can insert audit_logs" ON audit_logs;

-- Create the restrictive service role policy
CREATE POLICY "Service role can insert audit logs"
  ON audit_logs FOR INSERT
  TO service_role
  WITH CHECK (true);

-- =====================================================
-- NOTIFICATIONS - Remove ALL existing INSERT policies and create new one
-- =====================================================

-- Drop ALL possible policy name variations
DROP POLICY IF EXISTS "System can insert notifications" ON notifications;
DROP POLICY IF EXISTS "System can create notifications" ON notifications;
DROP POLICY IF EXISTS "authenticated can insert notifications" ON notifications;

-- Create the restrictive service role policy
CREATE POLICY "Service role can create notifications"
  ON notifications FOR INSERT
  TO service_role
  WITH CHECK (true);

-- =====================================================
-- VERIFICATION - Check that only service_role policies exist
-- =====================================================

-- Run this after applying the fix to verify:
-- SELECT tablename, policyname, roles, cmd
-- FROM pg_policies
-- WHERE tablename IN ('audit_logs', 'notifications') AND cmd = 'INSERT'
-- ORDER BY tablename, policyname;
--
-- Expected output:
-- audit_logs    | Service role can insert audit logs    | {service_role} | INSERT
-- notifications | Service role can create notifications | {service_role} | INSERT

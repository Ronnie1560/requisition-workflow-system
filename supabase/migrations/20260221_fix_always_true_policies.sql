-- Migration: Fix always-true RLS policies
-- Date: 2026-02-21
--
-- Fixes Supabase Security Advisor "RLS Policy Always True" warnings.
-- Replaces policies with WITH CHECK (true) or USING (true) that were
-- open to all roles, scoping them to service_role only.

BEGIN;

-- platform_login_attempts: was open to PUBLIC role
DROP POLICY IF EXISTS "anyone_can_insert_login_attempts" ON platform_login_attempts;
CREATE POLICY "service_role_can_insert_login_attempts"
  ON platform_login_attempts FOR INSERT
  TO service_role
  WITH CHECK (true);

-- security_audit_logs: was ALL with USING (true) for all roles
DROP POLICY IF EXISTS "Service role full access" ON security_audit_logs;
CREATE POLICY "service_role_full_access"
  ON security_audit_logs FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- audit_logs: was INSERT with CHECK (true) for all roles
DROP POLICY IF EXISTS "Service role can insert audit logs" ON audit_logs;
CREATE POLICY "service_role_can_insert_audit_logs"
  ON audit_logs FOR INSERT
  TO service_role
  WITH CHECK (true);

-- notifications: was INSERT with CHECK (true) for all roles
DROP POLICY IF EXISTS "Service role can create notifications" ON notifications;
CREATE POLICY "service_role_can_create_notifications"
  ON notifications FOR INSERT
  TO service_role
  WITH CHECK (true);

COMMIT;

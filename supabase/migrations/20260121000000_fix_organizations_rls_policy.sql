-- =====================================================
-- Migration: Fix Organizations RLS Policy Security Issue
-- Date: 2026-01-21
-- Issue: Table public.organizations has an overly permissive RLS policy
--        that allows unrestricted INSERT access (WITH CHECK clause is always true)
-- =====================================================

-- Drop the overly permissive policy
-- Organization creation should ONLY happen through the Edge Function
-- (create-organization-signup) which uses the service role key and bypasses RLS.
-- This Edge Function provides:
--   - Rate limiting (5 attempts/hour per IP)
--   - Input sanitization
--   - Email verification
--   - Proper validation
--   - Transaction rollback on errors

DROP POLICY IF EXISTS "Authenticated users can create organizations" ON organizations;

-- =====================================================
-- IMPORTANT: Do NOT create a replacement INSERT policy
-- =====================================================
-- Organization creation is handled exclusively by the Edge Function:
--   supabase/functions/create-organization-signup/index.ts
--
-- The Edge Function uses SUPABASE_SERVICE_ROLE_KEY which bypasses RLS,
-- so it does not need an INSERT policy to function.
--
-- Blocking direct INSERT operations from authenticated users prevents:
--   ❌ Bypassing rate limiting
--   ❌ Bypassing input sanitization
--   ❌ Bypassing email verification
--   ❌ Creating organizations without proper validation
--   ❌ Potential abuse/spam organizations
--
-- If future requirements need direct organization creation by certain users,
-- create a specific policy with proper constraints instead of WITH CHECK (true).
-- For example:
--   - Restrict to specific user roles (e.g., super_admin)
--   - Add constraints on organization properties
--   - Enforce business logic rules

-- =====================================================
-- Verification: Confirm remaining policies are secure
-- =====================================================

-- List all policies on organizations table
DO $$
DECLARE
  policy_record RECORD;
BEGIN
  RAISE NOTICE '=== Organizations Table RLS Policies ===';

  FOR policy_record IN
    SELECT
      polname AS policy_name,
      polcmd AS command,
      polroles::regrole[] AS roles,
      polpermissive AS is_permissive,
      pg_get_expr(polqual, polrelid) AS using_expression,
      pg_get_expr(polwithcheck, polrelid) AS with_check_expression
    FROM pg_policy
    WHERE polrelid = 'organizations'::regclass
    ORDER BY polname
  LOOP
    RAISE NOTICE 'Policy: %', policy_record.policy_name;
    RAISE NOTICE '  Command: %', policy_record.command;
    RAISE NOTICE '  Roles: %', policy_record.roles;
    RAISE NOTICE '  USING: %', COALESCE(policy_record.using_expression, 'N/A');
    RAISE NOTICE '  WITH CHECK: %', COALESCE(policy_record.with_check_expression, 'N/A');
    RAISE NOTICE '';
  END LOOP;

  RAISE NOTICE 'RLS Status: %',
    CASE
      WHEN (SELECT relrowsecurity FROM pg_class WHERE relname = 'organizations')
      THEN 'ENABLED ✓'
      ELSE 'DISABLED ✗'
    END;
END $$;

-- =====================================================
-- Expected Output After This Migration:
-- =====================================================
-- The organizations table should have policies for:
--   ✓ SELECT - Users can view their own organization(s)
--   ✓ UPDATE - Organization admins can update their organization
--   ✗ INSERT - NO INSERT policy (handled by Edge Function only)
--   ✗ DELETE - NO DELETE policy (organizations should not be deleted directly)
--
-- This ensures all organization creation flows through the secure,
-- rate-limited, validated Edge Function pathway.

-- =====================================================
-- Fix 2: Email Notifications RLS Policy Security Issue
-- =====================================================
-- Issue: Table public.email_notifications has overly permissive RLS policies
--        that allow unrestricted INSERT and UPDATE access (WITH CHECK/USING clause is always true)
--
-- Current risk: Any authenticated user can:
--   ❌ Insert arbitrary emails into the queue
--   ❌ Send phishing emails appearing to come from the system
--   ❌ Spam users with fake notifications
--   ❌ Impersonate organization email addresses
--   ❌ Bypass email content validation and sanitization
--
-- Email notification flow:
--   Database triggers/app → queue_email_notification() (SECURITY DEFINER) → email_notifications table → send-emails Edge Function (SERVICE ROLE)
--
-- Both the function and Edge Function use elevated privileges and bypass RLS,
-- so the permissive policies are unnecessary and dangerous.

DROP POLICY IF EXISTS "System can insert email notifications" ON email_notifications;
DROP POLICY IF EXISTS "System can update email notifications" ON email_notifications;

-- =====================================================
-- IMPORTANT: Do NOT create replacement INSERT/UPDATE policies
-- =====================================================
-- Email notification creation is handled exclusively by:
--   1. queue_email_notification() function (SECURITY DEFINER - bypasses RLS)
--   2. send-emails Edge Function (uses SERVICE_ROLE_KEY - bypasses RLS)
--
-- Blocking direct INSERT/UPDATE operations from authenticated users prevents:
--   ❌ Email spam and phishing attacks
--   ❌ Bypassing email content validation
--   ❌ Impersonating the system
--   ❌ Sending unauthorized emails to users
--   ❌ Manipulating email queue status
--
-- The existing SELECT policy for admins can remain:
--   ✓ "Admins can view all email notifications" (read-only, safe)

-- =====================================================
-- Verification: Confirm remaining policies are secure
-- =====================================================

DO $$
DECLARE
  policy_record RECORD;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '=== Email Notifications Table RLS Policies ===';

  FOR policy_record IN
    SELECT
      polname AS policy_name,
      polcmd AS command,
      polroles::regrole[] AS roles,
      polpermissive AS is_permissive,
      pg_get_expr(polqual, polrelid) AS using_expression,
      pg_get_expr(polwithcheck, polrelid) AS with_check_expression
    FROM pg_policy
    WHERE polrelid = 'email_notifications'::regclass
    ORDER BY polname
  LOOP
    RAISE NOTICE 'Policy: %', policy_record.policy_name;
    RAISE NOTICE '  Command: %', policy_record.command;
    RAISE NOTICE '  Roles: %', policy_record.roles;
    RAISE NOTICE '  USING: %', COALESCE(policy_record.using_expression, 'N/A');
    RAISE NOTICE '  WITH CHECK: %', COALESCE(policy_record.with_check_expression, 'N/A');
    RAISE NOTICE '';
  END LOOP;

  RAISE NOTICE 'RLS Status: %',
    CASE
      WHEN (SELECT relrowsecurity FROM pg_class WHERE relname = 'email_notifications')
      THEN 'ENABLED ✓'
      ELSE 'DISABLED ✗'
    END;
END $$;

-- =====================================================
-- Expected Output After This Migration:
-- =====================================================
-- The email_notifications table should have policies for:
--   ✓ SELECT - Admins can view email queue (read-only, safe)
--   ✗ INSERT - NO INSERT policy (handled by SECURITY DEFINER function only)
--   ✗ UPDATE - NO UPDATE policy (handled by send-emails Edge Function only)
--   ✗ DELETE - NO DELETE policy (emails should be archived, not deleted)
--
-- This ensures all email operations flow through secure, validated pathways.

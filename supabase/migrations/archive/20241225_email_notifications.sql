-- =====================================================
-- Email Notification System
-- Date: 2024-12-25
-- Version: 1.0.0
-- Description: Adds email notification capability
--
-- Features:
-- 1. User email notification preferences
-- 2. Email notification queue table
-- 3. Email templates
-- 4. Functions to queue email notifications
-- =====================================================

BEGIN;

-- ============================================
-- STEP 1: Email Notification Preferences
-- ============================================

-- Add email notification preferences to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_notifications_enabled BOOLEAN DEFAULT true;
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_on_submission BOOLEAN DEFAULT true;
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_on_review BOOLEAN DEFAULT true;
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_on_approval BOOLEAN DEFAULT true;
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_on_rejection BOOLEAN DEFAULT true;
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_on_comment BOOLEAN DEFAULT true;

COMMENT ON COLUMN users.email_notifications_enabled IS 'Master switch for all email notifications';
COMMENT ON COLUMN users.email_on_submission IS 'Email when a requisition is submitted for review';
COMMENT ON COLUMN users.email_on_review IS 'Email when a requisition is reviewed';
COMMENT ON COLUMN users.email_on_approval IS 'Email when a requisition is approved';
COMMENT ON COLUMN users.email_on_rejection IS 'Email when a requisition is rejected';
COMMENT ON COLUMN users.email_on_comment IS 'Email when someone comments on your requisition';

-- ============================================
-- STEP 2: Email Notification Queue Table
-- ============================================

CREATE TABLE IF NOT EXISTS email_notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  recipient_email VARCHAR(255) NOT NULL,
  recipient_user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  subject TEXT NOT NULL,
  body_html TEXT NOT NULL,
  body_text TEXT,
  notification_type TEXT NOT NULL,
  related_requisition_id UUID REFERENCES requisitions(id) ON DELETE SET NULL,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed')),
  sent_at TIMESTAMPTZ,
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_email_notifications_status ON email_notifications(status, created_at);
CREATE INDEX idx_email_notifications_recipient ON email_notifications(recipient_user_id);
CREATE INDEX idx_email_notifications_type ON email_notifications(notification_type);

COMMENT ON TABLE email_notifications IS 'Queue for email notifications to be sent';
COMMENT ON COLUMN email_notifications.status IS 'pending: Not sent yet, sent: Successfully sent, failed: Failed to send';
COMMENT ON COLUMN email_notifications.retry_count IS 'Number of times we attempted to send this email';

-- Enable RLS on email notifications
ALTER TABLE email_notifications ENABLE ROW LEVEL SECURITY;

-- Only admins can view email queue (for monitoring)
CREATE POLICY "Admins can view all email notifications"
  ON email_notifications FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'super_admin'
    )
  );

-- System can insert email notifications
CREATE POLICY "System can insert email notifications"
  ON email_notifications FOR INSERT
  WITH CHECK (true);

-- System can update email notifications (for status updates)
CREATE POLICY "System can update email notifications"
  ON email_notifications FOR UPDATE
  USING (true);

-- ============================================
-- STEP 3: Email Template Functions
-- ============================================

/**
 * Generate email body for requisition submitted
 */
CREATE OR REPLACE FUNCTION generate_submission_email(
  p_requisition_id UUID,
  p_recipient_name TEXT
)
RETURNS TABLE(subject TEXT, body_html TEXT, body_text TEXT)
LANGUAGE plpgsql
AS $$
DECLARE
  req RECORD;
  org_name TEXT;
BEGIN
  -- Get requisition details
  SELECT
    r.requisition_number,
    r.title,
    r.total_amount,
    u.full_name as submitter_name,
    p.name as project_name
  INTO req
  FROM requisitions r
  LEFT JOIN users u ON r.submitted_by = u.id
  LEFT JOIN projects p ON r.project_id = p.id
  WHERE r.id = p_requisition_id;

  -- Get organization name
  SELECT organization_name INTO org_name
  FROM organization_settings
  LIMIT 1;

  RETURN QUERY SELECT
    ('New Requisition: ' || req.requisition_number)::TEXT,
    -- HTML version
    ('<html><body>' ||
     '<h2>New Requisition Submitted</h2>' ||
     '<p>Dear ' || p_recipient_name || ',</p>' ||
     '<p>A new requisition has been submitted and requires your attention.</p>' ||
     '<table style="border-collapse: collapse; margin: 20px 0;">' ||
     '<tr><td style="padding: 8px; font-weight: bold;">Requisition #:</td><td style="padding: 8px;">' || req.requisition_number || '</td></tr>' ||
     '<tr><td style="padding: 8px; font-weight: bold;">Title:</td><td style="padding: 8px;">' || req.title || '</td></tr>' ||
     '<tr><td style="padding: 8px; font-weight: bold;">Submitted By:</td><td style="padding: 8px;">' || req.submitter_name || '</td></tr>' ||
     '<tr><td style="padding: 8px; font-weight: bold;">Project:</td><td style="padding: 8px;">' || COALESCE(req.project_name, 'N/A') || '</td></tr>' ||
     '<tr><td style="padding: 8px; font-weight: bold;">Amount:</td><td style="padding: 8px;">UGX ' || TO_CHAR(req.total_amount, 'FM999,999,999') || '</td></tr>' ||
     '</table>' ||
     '<p><a href="' || COALESCE(current_setting('app.base_url', true), 'https://pcm-requisition.vercel.app') || '/requisitions/' || p_requisition_id || '" ' ||
     'style="background-color: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">View Requisition</a></p>' ||
     '<p style="color: #666; margin-top: 30px;">This is an automated message from ' || COALESCE(org_name, 'Requisition System') || '.</p>' ||
     '</body></html>')::TEXT,
    -- Text version
    ('New Requisition Submitted' || E'\n\n' ||
     'Dear ' || p_recipient_name || ',' || E'\n\n' ||
     'A new requisition has been submitted and requires your attention.' || E'\n\n' ||
     'Requisition #: ' || req.requisition_number || E'\n' ||
     'Title: ' || req.title || E'\n' ||
     'Submitted By: ' || req.submitter_name || E'\n' ||
     'Project: ' || COALESCE(req.project_name, 'N/A') || E'\n' ||
     'Amount: UGX ' || TO_CHAR(req.total_amount, 'FM999,999,999') || E'\n\n' ||
     'View requisition at: ' || COALESCE(current_setting('app.base_url', true), 'https://pcm-requisition.vercel.app') || '/requisitions/' || p_requisition_id || E'\n\n' ||
     'This is an automated message from ' || COALESCE(org_name, 'Requisition System') || '.')::TEXT;
END;
$$;

/**
 * Generate email body for requisition approved
 */
CREATE OR REPLACE FUNCTION generate_approval_email(
  p_requisition_id UUID,
  p_recipient_name TEXT,
  p_approver_name TEXT
)
RETURNS TABLE(subject TEXT, body_html TEXT, body_text TEXT)
LANGUAGE plpgsql
AS $$
DECLARE
  req RECORD;
  org_name TEXT;
BEGIN
  -- Get requisition details
  SELECT
    r.requisition_number,
    r.title,
    r.total_amount
  INTO req
  FROM requisitions r
  WHERE r.id = p_requisition_id;

  -- Get organization name
  SELECT organization_name INTO org_name
  FROM organization_settings
  LIMIT 1;

  RETURN QUERY SELECT
    ('Requisition Approved: ' || req.requisition_number)::TEXT,
    -- HTML version
    ('<html><body>' ||
     '<h2 style="color: #059669;">Requisition Approved</h2>' ||
     '<p>Dear ' || p_recipient_name || ',</p>' ||
     '<p>Your requisition has been approved!</p>' ||
     '<table style="border-collapse: collapse; margin: 20px 0;">' ||
     '<tr><td style="padding: 8px; font-weight: bold;">Requisition #:</td><td style="padding: 8px;">' || req.requisition_number || '</td></tr>' ||
     '<tr><td style="padding: 8px; font-weight: bold;">Title:</td><td style="padding: 8px;">' || req.title || '</td></tr>' ||
     '<tr><td style="padding: 8px; font-weight: bold;">Amount:</td><td style="padding: 8px;">UGX ' || TO_CHAR(req.total_amount, 'FM999,999,999') || '</td></tr>' ||
     '<tr><td style="padding: 8px; font-weight: bold;">Approved By:</td><td style="padding: 8px;">' || p_approver_name || '</td></tr>' ||
     '</table>' ||
     '<p><a href="' || COALESCE(current_setting('app.base_url', true), 'https://pcm-requisition.vercel.app') || '/requisitions/' || p_requisition_id || '" ' ||
     'style="background-color: #059669; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">View Requisition</a></p>' ||
     '<p style="color: #666; margin-top: 30px;">This is an automated message from ' || COALESCE(org_name, 'Requisition System') || '.</p>' ||
     '</body></html>')::TEXT,
    -- Text version
    ('Requisition Approved' || E'\n\n' ||
     'Dear ' || p_recipient_name || ',' || E'\n\n' ||
     'Your requisition has been approved!' || E'\n\n' ||
     'Requisition #: ' || req.requisition_number || E'\n' ||
     'Title: ' || req.title || E'\n' ||
     'Amount: UGX ' || TO_CHAR(req.total_amount, 'FM999,999,999') || E'\n' ||
     'Approved By: ' || p_approver_name || E'\n\n' ||
     'View requisition at: ' || COALESCE(current_setting('app.base_url', true), 'https://pcm-requisition.vercel.app') || '/requisitions/' || p_requisition_id || E'\n\n' ||
     'This is an automated message from ' || COALESCE(org_name, 'Requisition System') || '.')::TEXT;
END;
$$;

/**
 * Generate email body for requisition rejected
 */
CREATE OR REPLACE FUNCTION generate_rejection_email(
  p_requisition_id UUID,
  p_recipient_name TEXT,
  p_rejector_name TEXT,
  p_reason TEXT
)
RETURNS TABLE(subject TEXT, body_html TEXT, body_text TEXT)
LANGUAGE plpgsql
AS $$
DECLARE
  req RECORD;
  org_name TEXT;
BEGIN
  -- Get requisition details
  SELECT
    r.requisition_number,
    r.title
  INTO req
  FROM requisitions r
  WHERE r.id = p_requisition_id;

  -- Get organization name
  SELECT organization_name INTO org_name
  FROM organization_settings
  LIMIT 1;

  RETURN QUERY SELECT
    ('Requisition Rejected: ' || req.requisition_number)::TEXT,
    -- HTML version
    ('<html><body>' ||
     '<h2 style="color: #DC2626;">Requisition Rejected</h2>' ||
     '<p>Dear ' || p_recipient_name || ',</p>' ||
     '<p>Your requisition has been rejected.</p>' ||
     '<table style="border-collapse: collapse; margin: 20px 0;">' ||
     '<tr><td style="padding: 8px; font-weight: bold;">Requisition #:</td><td style="padding: 8px;">' || req.requisition_number || '</td></tr>' ||
     '<tr><td style="padding: 8px; font-weight: bold;">Title:</td><td style="padding: 8px;">' || req.title || '</td></tr>' ||
     '<tr><td style="padding: 8px; font-weight: bold;">Rejected By:</td><td style="padding: 8px;">' || p_rejector_name || '</td></tr>' ||
     CASE WHEN p_reason IS NOT NULL THEN
       '<tr><td style="padding: 8px; font-weight: bold; vertical-align: top;">Reason:</td><td style="padding: 8px;">' || p_reason || '</td></tr>'
     ELSE '' END ||
     '</table>' ||
     '<p><a href="' || COALESCE(current_setting('app.base_url', true), 'https://pcm-requisition.vercel.app') || '/requisitions/' || p_requisition_id || '" ' ||
     'style="background-color: #DC2626; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">View Requisition</a></p>' ||
     '<p style="color: #666; margin-top: 30px;">This is an automated message from ' || COALESCE(org_name, 'Requisition System') || '.</p>' ||
     '</body></html>')::TEXT,
    -- Text version
    ('Requisition Rejected' || E'\n\n' ||
     'Dear ' || p_recipient_name || ',' || E'\n\n' ||
     'Your requisition has been rejected.' || E'\n\n' ||
     'Requisition #: ' || req.requisition_number || E'\n' ||
     'Title: ' || req.title || E'\n' ||
     'Rejected By: ' || p_rejector_name || E'\n' ||
     CASE WHEN p_reason IS NOT NULL THEN 'Reason: ' || p_reason || E'\n' ELSE '' END ||
     E'\n' ||
     'View requisition at: ' || COALESCE(current_setting('app.base_url', true), 'https://pcm-requisition.vercel.app') || '/requisitions/' || p_requisition_id || E'\n\n' ||
     'This is an automated message from ' || COALESCE(org_name, 'Requisition System') || '.')::TEXT;
END;
$$;

-- ============================================
-- STEP 4: Function to Queue Email Notifications
-- ============================================

/**
 * Queue an email notification
 */
CREATE OR REPLACE FUNCTION queue_email_notification(
  p_user_id UUID,
  p_notification_type TEXT,
  p_requisition_id UUID,
  p_subject TEXT,
  p_body_html TEXT,
  p_body_text TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  user_email TEXT;
  email_enabled BOOLEAN;
  type_enabled BOOLEAN;
  email_id UUID;
BEGIN
  -- Get user email and preferences
  SELECT
    email,
    email_notifications_enabled,
    CASE p_notification_type
      WHEN 'requisition_submitted' THEN email_on_submission
      WHEN 'requisition_reviewed' THEN email_on_review
      WHEN 'requisition_approved' THEN email_on_approval
      WHEN 'requisition_rejected' THEN email_on_rejection
      WHEN 'requisition_commented' THEN email_on_comment
      ELSE true
    END
  INTO user_email, email_enabled, type_enabled
  FROM users
  WHERE id = p_user_id;

  -- Check if user wants emails and this type is enabled
  IF NOT email_enabled OR NOT type_enabled OR user_email IS NULL THEN
    RETURN NULL;
  END IF;

  -- Queue the email
  INSERT INTO email_notifications (
    recipient_email,
    recipient_user_id,
    subject,
    body_html,
    body_text,
    notification_type,
    related_requisition_id,
    status
  )
  VALUES (
    user_email,
    p_user_id,
    p_subject,
    p_body_html,
    p_body_text,
    p_notification_type,
    p_requisition_id,
    'pending'
  )
  RETURNING id INTO email_id;

  RETURN email_id;
END;
$$;

COMMENT ON FUNCTION queue_email_notification IS
  'Queues an email notification if user has email notifications enabled for this type';

-- ============================================
-- STEP 5: Update Notification Triggers
-- ============================================

-- We'll update the notification trigger to also queue emails
-- This will be done in the next migration to keep it modular

-- ============================================
-- Verification
-- ============================================

DO $$
DECLARE
  pref_columns_count INTEGER;
  email_table_exists BOOLEAN;
  functions_count INTEGER;
BEGIN
  -- Count email preference columns
  SELECT COUNT(*) INTO pref_columns_count
  FROM information_schema.columns
  WHERE table_name = 'users'
    AND column_name LIKE 'email_%';

  -- Check if email_notifications table exists
  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_name = 'email_notifications'
  ) INTO email_table_exists;

  -- Count email-related functions
  SELECT COUNT(*) INTO functions_count
  FROM pg_proc p
  JOIN pg_namespace n ON p.pronamespace = n.oid
  WHERE n.nspname = 'public'
    AND (p.proname LIKE '%email%' OR p.proname LIKE '%generate%');

  RAISE NOTICE '==============================================';
  RAISE NOTICE 'Email Notification System Installed';
  RAISE NOTICE '==============================================';
  RAISE NOTICE 'Email preference columns: %', pref_columns_count;
  RAISE NOTICE 'Email queue table exists: %', email_table_exists;
  RAISE NOTICE 'Email functions installed: %', functions_count;
  RAISE NOTICE '';
  RAISE NOTICE 'Features:';
  RAISE NOTICE '  ✓ User email preferences (opt-in/opt-out)';
  RAISE NOTICE '  ✓ Email notification queue';
  RAISE NOTICE '  ✓ Email templates (submission, approval, rejection)';
  RAISE NOTICE '  ✓ Queue function with preference checking';
  RAISE NOTICE '';
  RAISE NOTICE 'Next Steps:';
  RAISE NOTICE '  1. Set up email service (Resend, SendGrid, etc.)';
  RAISE NOTICE '  2. Create Edge Function to process email queue';
  RAISE NOTICE '  3. Update notification triggers to queue emails';
  RAISE NOTICE '  4. Add UI for email preferences in user settings';
  RAISE NOTICE '==============================================';
END $$;

COMMIT;

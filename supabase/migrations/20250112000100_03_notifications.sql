-- =====================================================
-- PCM Requisition System - Notification System
-- Consolidated Migration: January 12, 2026
-- =====================================================
-- This migration adds:
-- 1. Core notification functions
-- 2. Requisition workflow notifications
-- 3. Comment notifications
-- 4. Email notification functions
-- =====================================================

BEGIN;

-- ============================================
-- STEP 1: Clean Up Old Notification Functions
-- ============================================

-- Drop ALL old notification triggers
DROP TRIGGER IF EXISTS trigger_notify_requisition_status ON requisitions CASCADE;
DROP TRIGGER IF EXISTS trigger_notify_new_comment ON comments CASCADE;
DROP TRIGGER IF EXISTS trigger_notify_on_requisition_submitted ON requisitions CASCADE;
DROP TRIGGER IF EXISTS trigger_notify_on_requisition_reviewed ON requisitions CASCADE;
DROP TRIGGER IF EXISTS trigger_notify_on_requisition_status_change ON requisitions CASCADE;

-- Drop old notification functions (all possible signatures)
DROP FUNCTION IF EXISTS create_notification(UUID, notification_type, VARCHAR, TEXT, VARCHAR, UUID) CASCADE;
DROP FUNCTION IF EXISTS create_notification(UUID, VARCHAR, VARCHAR, TEXT, VARCHAR, UUID) CASCADE;
DROP FUNCTION IF EXISTS create_notification(UUID, VARCHAR, VARCHAR, TEXT, TEXT, UUID) CASCADE;
DROP FUNCTION IF EXISTS create_notification(UUID, TEXT, TEXT, TEXT, TEXT, UUID) CASCADE;
DROP FUNCTION IF EXISTS create_notification(UUID, VARCHAR, VARCHAR, TEXT, VARCHAR) CASCADE;
DROP FUNCTION IF EXISTS create_notification(UUID, TEXT, TEXT, TEXT, TEXT) CASCADE;

DROP FUNCTION IF EXISTS create_notification_for_users(UUID[], VARCHAR, VARCHAR, TEXT, VARCHAR, UUID) CASCADE;
DROP FUNCTION IF EXISTS create_notification_for_users(UUID[], VARCHAR, VARCHAR, TEXT, VARCHAR) CASCADE;
DROP FUNCTION IF EXISTS create_notification_for_users(UUID[], TEXT, TEXT, TEXT, TEXT) CASCADE;

DROP FUNCTION IF EXISTS notify_requisition_status_change() CASCADE;
DROP FUNCTION IF EXISTS notify_new_comment() CASCADE;
DROP FUNCTION IF EXISTS notify_on_requisition_submitted() CASCADE;
DROP FUNCTION IF EXISTS notify_on_requisition_reviewed() CASCADE;
DROP FUNCTION IF EXISTS notify_on_requisition_status_change() CASCADE;

-- ============================================
-- STEP 2: Core Notification Functions
-- ============================================

/**
 * Create a notification for a single user
 *
 * @param p_user_id UUID - The user to notify
 * @param p_type TEXT - Notification type (e.g., 'requisition_submitted')
 * @param p_title TEXT - Notification title
 * @param p_message TEXT - Notification message
 * @param p_link TEXT - Optional link (e.g., '/requisitions/123')
 * @return UUID - The created notification ID
 */
CREATE OR REPLACE FUNCTION create_notification(
  p_user_id UUID,
  p_type TEXT,
  p_title TEXT,
  p_message TEXT,
  p_link TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  notification_id UUID;
BEGIN
  INSERT INTO notifications (
    user_id,
    type,
    title,
    message,
    link,
    related_table,
    related_id,
    is_read,
    created_at
  )
  VALUES (
    p_user_id,
    p_type,
    p_title,
    p_message,
    p_link,
    NULL,
    NULL,
    false,
    NOW()
  )
  RETURNING id INTO notification_id;

  RETURN notification_id;
END;
$$;

COMMENT ON FUNCTION create_notification IS
  'Creates a notification for a single user. Uses TEXT types for all string parameters.';

/**
 * Create notifications for multiple users
 *
 * @param p_user_ids UUID[] - Array of user IDs to notify
 * @param p_type TEXT - Notification type
 * @param p_title TEXT - Notification title
 * @param p_message TEXT - Notification message
 * @param p_link TEXT - Optional link
 * @return INTEGER - Number of notifications created
 */
CREATE OR REPLACE FUNCTION create_notification_for_users(
  p_user_ids UUID[],
  p_type TEXT,
  p_title TEXT,
  p_message TEXT,
  p_link TEXT DEFAULT NULL
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  created_count INTEGER := 0;
  user_id UUID;
BEGIN
  FOREACH user_id IN ARRAY p_user_ids
  LOOP
    PERFORM create_notification(user_id, p_type, p_title, p_message, p_link);
    created_count := created_count + 1;
  END LOOP;

  RETURN created_count;
END;
$$;

COMMENT ON FUNCTION create_notification_for_users IS
  'Creates the same notification for multiple users.';

-- ============================================
-- STEP 3: Comment Notification Trigger
-- ============================================

/**
 * Trigger function: Notify when a comment is added
 */
CREATE OR REPLACE FUNCTION notify_new_comment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  req_submitter UUID;
  req_number VARCHAR(50);
  req_title TEXT;
  commenter_name TEXT;
BEGIN
  SELECT submitted_by, requisition_number, title
  INTO req_submitter, req_number, req_title
  FROM requisitions
  WHERE id = NEW.requisition_id;

  SELECT full_name INTO commenter_name
  FROM users
  WHERE id = NEW.user_id;

  -- Only notify if commenter is NOT the submitter
  IF req_submitter != NEW.user_id THEN
    PERFORM create_notification(
      req_submitter,
      'requisition_commented',
      'New Comment on Requisition',
      COALESCE(commenter_name, 'Someone') || ' commented on requisition "' || req_title || '"',
      '/requisitions/' || NEW.requisition_id::TEXT
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_notify_new_comment ON comments;
CREATE TRIGGER trigger_notify_new_comment
  AFTER INSERT ON comments
  FOR EACH ROW
  EXECUTE FUNCTION notify_new_comment();

-- ============================================
-- STEP 4: Requisition Status Change Notifications
-- ============================================

/**
 * Trigger function: Notify on requisition status changes
 *
 * Handles notifications for all requisition workflow states:
 * - draft → pending (submitted for review)
 * - pending → reviewed (reviewer marks as reviewed)
 * - reviewed → approved (super admin approves)
 * - any → rejected
 */
CREATE OR REPLACE FUNCTION notify_on_requisition_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  submitter_name TEXT;
  reviewer_name TEXT;
  approver_name TEXT;
  reviewer_ids UUID[];
  admin_ids UUID[];
  msg TEXT;
  link_url TEXT;
BEGIN
  link_url := '/requisitions/' || NEW.id::TEXT;

  SELECT full_name INTO submitter_name
  FROM users
  WHERE id = NEW.submitted_by;

  -- CASE 1: Submitted for Review
  IF NEW.status = 'pending' AND (OLD.status IS NULL OR OLD.status = 'draft') THEN
    SELECT ARRAY_AGG(id) INTO reviewer_ids
    FROM users
    WHERE role IN ('reviewer', 'super_admin')
      AND id != NEW.submitted_by;

    IF reviewer_ids IS NOT NULL THEN
      msg := submitter_name || ' submitted requisition "' || NEW.title || '" for review.';
      PERFORM create_notification_for_users(
        reviewer_ids,
        'requisition_submitted',
        'New Requisition Submitted',
        msg,
        link_url
      );
    END IF;
  END IF;

  -- CASE 2: Marked as Reviewed
  IF NEW.status = 'reviewed'
     AND (OLD.status IS NULL OR OLD.status = 'pending')
     AND NEW.reviewed_by IS NOT NULL THEN

    SELECT full_name INTO reviewer_name
    FROM users
    WHERE id = NEW.reviewed_by;

    msg := 'Your requisition "' || NEW.title || '" has been reviewed by ' ||
           COALESCE(reviewer_name, 'a reviewer') || ' and is pending approval.';
    PERFORM create_notification(
      NEW.submitted_by,
      'requisition_reviewed',
      'Requisition Reviewed',
      msg,
      link_url
    );

    SELECT ARRAY_AGG(id) INTO admin_ids
    FROM users
    WHERE role = 'super_admin'
      AND id != NEW.submitted_by
      AND id != NEW.reviewed_by;

    IF admin_ids IS NOT NULL THEN
      msg := 'Requisition "' || NEW.title || '" has been reviewed by ' ||
             COALESCE(reviewer_name, 'a reviewer') || ' and needs your approval.';
      PERFORM create_notification_for_users(
        admin_ids,
        'requisition_pending_approval',
        'Requisition Pending Approval',
        msg,
        link_url
      );
    END IF;
  END IF;

  -- CASE 3: Approved
  IF NEW.status = 'approved' AND (OLD.status IS NULL OR OLD.status != 'approved') THEN
    SELECT full_name INTO approver_name
    FROM users
    WHERE id = NEW.approved_by;

    msg := 'Your requisition "' || NEW.title || '" has been approved';
    IF approver_name IS NOT NULL THEN
      msg := msg || ' by ' || approver_name;
    END IF;
    msg := msg || '.';
    PERFORM create_notification(
      NEW.submitted_by,
      'requisition_approved',
      'Requisition Approved',
      msg,
      link_url
    );

    IF NEW.reviewed_by IS NOT NULL AND NEW.reviewed_by != NEW.approved_by THEN
      msg := 'Requisition "' || NEW.title || '" that you reviewed has been approved';
      IF approver_name IS NOT NULL THEN
        msg := msg || ' by ' || approver_name;
      END IF;
      msg := msg || '.';
      PERFORM create_notification(
        NEW.reviewed_by,
        'requisition_approved',
        'Requisition Approved',
        msg,
        link_url
      );
    END IF;
  END IF;

  -- CASE 4: Rejected
  IF NEW.status = 'rejected' AND (OLD.status IS NULL OR OLD.status != 'rejected') THEN
    SELECT full_name INTO reviewer_name
    FROM users
    WHERE id = COALESCE(NEW.approved_by, NEW.reviewed_by);

    msg := 'Your requisition "' || NEW.title || '" has been rejected';
    IF reviewer_name IS NOT NULL THEN
      msg := msg || ' by ' || reviewer_name;
    END IF;
    msg := msg || '.';
    IF NEW.rejection_reason IS NOT NULL THEN
      msg := msg || ' Reason: ' || NEW.rejection_reason;
    END IF;
    PERFORM create_notification(
      NEW.submitted_by,
      'requisition_rejected',
      'Requisition Rejected',
      msg,
      link_url
    );

    IF NEW.reviewed_by IS NOT NULL
       AND NEW.reviewed_by != COALESCE(NEW.approved_by, NEW.reviewed_by) THEN
      msg := 'Requisition "' || NEW.title || '" that you reviewed has been rejected';
      IF reviewer_name IS NOT NULL THEN
        msg := msg || ' by ' || reviewer_name;
      END IF;
      msg := msg || '.';
      PERFORM create_notification(
        NEW.reviewed_by,
        'requisition_rejected',
        'Requisition Rejected',
        msg,
        link_url
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_notify_on_requisition_status_change ON requisitions;
CREATE TRIGGER trigger_notify_on_requisition_status_change
  AFTER UPDATE ON requisitions
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION notify_on_requisition_status_change();

-- ============================================
-- STEP 5: Email Template Functions
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
SET search_path = 'public'
AS $$
DECLARE
  req RECORD;
  org_name TEXT;
  base_url TEXT;
BEGIN
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

  SELECT organization_name, app_base_url INTO org_name, base_url
  FROM organization_settings
  LIMIT 1;

  base_url := COALESCE(base_url, 'https://requisition-workflow.vercel.app');

  RETURN QUERY SELECT
    ('New Requisition: ' || req.requisition_number)::TEXT,
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
     '<p><a href="' || base_url || '/requisitions/' || p_requisition_id || '" ' ||
     'style="background-color: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">View Requisition</a></p>' ||
     '<p style="color: #666; margin-top: 30px;">This is an automated message from ' || COALESCE(org_name, 'Requisition System') || '.</p>' ||
     '</body></html>')::TEXT,
    ('New Requisition Submitted' || E'\n\n' ||
     'Dear ' || p_recipient_name || ',' || E'\n\n' ||
     'A new requisition has been submitted and requires your attention.' || E'\n\n' ||
     'Requisition #: ' || req.requisition_number || E'\n' ||
     'Title: ' || req.title || E'\n' ||
     'Submitted By: ' || req.submitter_name || E'\n' ||
     'Project: ' || COALESCE(req.project_name, 'N/A') || E'\n' ||
     'Amount: UGX ' || TO_CHAR(req.total_amount, 'FM999,999,999') || E'\n\n' ||
     'View requisition at: ' || base_url || '/requisitions/' || p_requisition_id || E'\n\n' ||
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
SET search_path = 'public'
AS $$
DECLARE
  req RECORD;
  org_name TEXT;
  base_url TEXT;
BEGIN
  SELECT
    r.requisition_number,
    r.title,
    r.total_amount
  INTO req
  FROM requisitions r
  WHERE r.id = p_requisition_id;

  SELECT organization_name, app_base_url INTO org_name, base_url
  FROM organization_settings
  LIMIT 1;

  base_url := COALESCE(base_url, 'https://requisition-workflow.vercel.app');

  RETURN QUERY SELECT
    ('Requisition Approved: ' || req.requisition_number)::TEXT,
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
     '<p><a href="' || base_url || '/requisitions/' || p_requisition_id || '" ' ||
     'style="background-color: #059669; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">View Requisition</a></p>' ||
     '<p style="color: #666; margin-top: 30px;">This is an automated message from ' || COALESCE(org_name, 'Requisition System') || '.</p>' ||
     '</body></html>')::TEXT,
    ('Requisition Approved' || E'\n\n' ||
     'Dear ' || p_recipient_name || ',' || E'\n\n' ||
     'Your requisition has been approved!' || E'\n\n' ||
     'Requisition #: ' || req.requisition_number || E'\n' ||
     'Title: ' || req.title || E'\n' ||
     'Amount: UGX ' || TO_CHAR(req.total_amount, 'FM999,999,999') || E'\n' ||
     'Approved By: ' || p_approver_name || E'\n\n' ||
     'View requisition at: ' || base_url || '/requisitions/' || p_requisition_id || E'\n\n' ||
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
  p_rejection_reason TEXT
)
RETURNS TABLE(subject TEXT, body_html TEXT, body_text TEXT)
LANGUAGE plpgsql
SET search_path = 'public'
AS $$
DECLARE
  req RECORD;
  org_name TEXT;
  base_url TEXT;
BEGIN
  SELECT
    r.requisition_number,
    r.title,
    r.total_amount
  INTO req
  FROM requisitions r
  WHERE r.id = p_requisition_id;

  SELECT organization_name, app_base_url INTO org_name, base_url
  FROM organization_settings
  LIMIT 1;

  base_url := COALESCE(base_url, 'https://requisition-workflow.vercel.app');

  RETURN QUERY SELECT
    ('Requisition Rejected: ' || req.requisition_number)::TEXT,
    ('<html><body>' ||
     '<h2 style="color: #DC2626;">Requisition Rejected</h2>' ||
     '<p>Dear ' || p_recipient_name || ',</p>' ||
     '<p>Your requisition has been rejected.</p>' ||
     '<table style="border-collapse: collapse; margin: 20px 0;">' ||
     '<tr><td style="padding: 8px; font-weight: bold;">Requisition #:</td><td style="padding: 8px;">' || req.requisition_number || '</td></tr>' ||
     '<tr><td style="padding: 8px; font-weight: bold;">Title:</td><td style="padding: 8px;">' || req.title || '</td></tr>' ||
     '<tr><td style="padding: 8px; font-weight: bold;">Amount:</td><td style="padding: 8px;">UGX ' || TO_CHAR(req.total_amount, 'FM999,999,999') || '</td></tr>' ||
     '<tr><td style="padding: 8px; font-weight: bold;">Rejected By:</td><td style="padding: 8px;">' || p_rejector_name || '</td></tr>' ||
     CASE WHEN p_rejection_reason IS NOT NULL THEN
       '<tr><td style="padding: 8px; font-weight: bold;">Reason:</td><td style="padding: 8px; color: #DC2626;">' || p_rejection_reason || '</td></tr>'
     ELSE '' END ||
     '</table>' ||
     '<p><a href="' || base_url || '/requisitions/' || p_requisition_id || '" ' ||
     'style="background-color: #6B7280; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">View Requisition</a></p>' ||
     '<p style="color: #666; margin-top: 30px;">This is an automated message from ' || COALESCE(org_name, 'Requisition System') || '.</p>' ||
     '</body></html>')::TEXT,
    ('Requisition Rejected' || E'\n\n' ||
     'Dear ' || p_recipient_name || ',' || E'\n\n' ||
     'Your requisition has been rejected.' || E'\n\n' ||
     'Requisition #: ' || req.requisition_number || E'\n' ||
     'Title: ' || req.title || E'\n' ||
     'Amount: UGX ' || TO_CHAR(req.total_amount, 'FM999,999,999') || E'\n' ||
     'Rejected By: ' || p_rejector_name || E'\n' ||
     CASE WHEN p_rejection_reason IS NOT NULL THEN 'Reason: ' || p_rejection_reason || E'\n' ELSE '' END || E'\n' ||
     'View requisition at: ' || base_url || '/requisitions/' || p_requisition_id || E'\n\n' ||
     'This is an automated message from ' || COALESCE(org_name, 'Requisition System') || '.')::TEXT;
END;
$$;

/**
 * Queue an email notification
 */
CREATE OR REPLACE FUNCTION queue_email_notification(
  p_recipient_user_id UUID,
  p_notification_type TEXT,
  p_requisition_id UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  recipient RECORD;
  email_content RECORD;
  email_id UUID;
BEGIN
  -- Get recipient details
  SELECT id, email, full_name, email_notifications_enabled
  INTO recipient
  FROM users
  WHERE id = p_recipient_user_id;

  -- Check if email notifications are enabled
  IF NOT COALESCE(recipient.email_notifications_enabled, true) THEN
    RETURN NULL;
  END IF;

  -- Generate email content based on type
  IF p_notification_type = 'requisition_submitted' THEN
    SELECT * INTO email_content
    FROM generate_submission_email(p_requisition_id, recipient.full_name);
  ELSIF p_notification_type = 'requisition_approved' THEN
    SELECT * INTO email_content
    FROM generate_approval_email(p_requisition_id, recipient.full_name, 'System');
  ELSIF p_notification_type = 'requisition_rejected' THEN
    SELECT * INTO email_content
    FROM generate_rejection_email(p_requisition_id, recipient.full_name, 'System', NULL);
  ELSE
    RETURN NULL;
  END IF;

  -- Insert into email queue
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
    recipient.email,
    p_recipient_user_id,
    email_content.subject,
    email_content.body_html,
    email_content.body_text,
    p_notification_type,
    p_requisition_id,
    'pending'
  )
  RETURNING id INTO email_id;

  RETURN email_id;
END;
$$;

-- ============================================
-- STEP 6: Table Comments
-- ============================================

COMMENT ON FUNCTION notify_new_comment IS 'Trigger function to notify submitter when someone comments on their requisition';
COMMENT ON FUNCTION notify_on_requisition_status_change IS 'Trigger function to notify relevant users on requisition status changes';
COMMENT ON FUNCTION generate_submission_email IS 'Generates email content for requisition submission notifications';
COMMENT ON FUNCTION generate_approval_email IS 'Generates email content for requisition approval notifications';
COMMENT ON FUNCTION generate_rejection_email IS 'Generates email content for requisition rejection notifications';
COMMENT ON FUNCTION queue_email_notification IS 'Queues an email notification for asynchronous sending';

COMMIT;

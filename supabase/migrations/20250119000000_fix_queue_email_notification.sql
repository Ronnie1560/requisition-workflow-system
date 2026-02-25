-- Migration: Fix queue_email_notification function signature mismatch
-- Date: 2026-01-19
-- Description: Add overloaded function to support both 3-param and 6-param calls
-- This fixes the error: function queue_email_notification(uuid, unknown, uuid, text, text, text) does not exist

BEGIN;

-- ============================================
-- STEP 1: Ensure the 3-param version exists (with org_id support)
-- ============================================
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
  req_org_id UUID;
BEGIN
  -- Get org_id from requisition
  SELECT org_id INTO req_org_id
  FROM requisitions
  WHERE id = p_requisition_id;

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
  ELSIF p_notification_type = 'requisition_reviewed' THEN
    SELECT * INTO email_content
    FROM generate_submission_email(p_requisition_id, recipient.full_name);
  ELSE
    -- For unknown types, try to generate a generic email
    SELECT * INTO email_content
    FROM generate_submission_email(p_requisition_id, recipient.full_name);
  END IF;

  -- Insert into email queue WITH org_id
  INSERT INTO email_notifications (
    recipient_email,
    recipient_user_id,
    subject,
    body_html,
    body_text,
    notification_type,
    related_requisition_id,
    org_id,
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
    req_org_id,
    'pending'
  )
  RETURNING id INTO email_id;

  RETURN email_id;
EXCEPTION WHEN OTHERS THEN
  -- Log the error but don't fail the transaction
  RAISE WARNING 'Failed to queue email notification: %', SQLERRM;
  RETURN NULL;
END;
$$;

-- ============================================
-- STEP 2: Create 6-param overload for backwards compatibility
-- This handles old trigger code that passes subject, body_html, body_text directly
-- ============================================
CREATE OR REPLACE FUNCTION queue_email_notification(
  p_recipient_user_id UUID,
  p_notification_type TEXT,
  p_requisition_id UUID,
  p_subject TEXT,
  p_body_html TEXT,
  p_body_text TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  recipient RECORD;
  email_id UUID;
  req_org_id UUID;
BEGIN
  -- Get org_id from requisition
  SELECT org_id INTO req_org_id
  FROM requisitions
  WHERE id = p_requisition_id;

  -- Get recipient details
  SELECT id, email, full_name, email_notifications_enabled
  INTO recipient
  FROM users
  WHERE id = p_recipient_user_id;

  -- Check if email notifications are enabled
  IF NOT COALESCE(recipient.email_notifications_enabled, true) THEN
    RETURN NULL;
  END IF;

  -- Insert into email queue WITH org_id
  INSERT INTO email_notifications (
    recipient_email,
    recipient_user_id,
    subject,
    body_html,
    body_text,
    notification_type,
    related_requisition_id,
    org_id,
    status
  )
  VALUES (
    recipient.email,
    p_recipient_user_id,
    p_subject,
    p_body_html,
    p_body_text,
    p_notification_type,
    p_requisition_id,
    req_org_id,
    'pending'
  )
  RETURNING id INTO email_id;

  RETURN email_id;
EXCEPTION WHEN OTHERS THEN
  -- Log the error but don't fail the transaction
  RAISE WARNING 'Failed to queue email notification: %', SQLERRM;
  RETURN NULL;
END;
$$;

-- ============================================
-- STEP 3: Add comments
-- ============================================
COMMENT ON FUNCTION queue_email_notification(UUID, TEXT, UUID) IS 
  'Queues an email notification for asynchronous sending (auto-generates email content based on type)';

COMMENT ON FUNCTION queue_email_notification(UUID, TEXT, UUID, TEXT, TEXT, TEXT) IS 
  'Queues an email notification with explicit subject and body content (backwards compatible)';

COMMIT;

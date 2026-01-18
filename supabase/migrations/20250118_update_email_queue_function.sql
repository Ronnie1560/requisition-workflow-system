-- Migration: Update queue_email_notification function to include org_id
-- Date: 2026-01-18
-- Description: Update email notification queue function to track organization context

-- Drop existing function first (there might be multiple signatures)
DROP FUNCTION IF EXISTS queue_email_notification(UUID, TEXT, UUID);
DROP FUNCTION IF EXISTS queue_email_notification(UUID, TEXT, UUID, TEXT, TEXT, TEXT);

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
  ELSE
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
END;
$$;

COMMENT ON FUNCTION queue_email_notification IS 'Queues an email notification for asynchronous sending (org-aware)';

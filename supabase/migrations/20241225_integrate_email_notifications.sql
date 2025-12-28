-- =====================================================
-- Integrate Email Notifications with Triggers
-- Date: 2024-12-25
-- Version: 1.0.0
-- Description: Updates notification triggers to also queue email notifications
--
-- This migration updates the existing notification triggers to:
-- 1. Send in-app notifications (existing functionality)
-- 2. Queue email notifications (new functionality)
-- =====================================================

BEGIN;

-- ============================================
-- Drop existing triggers to recreate them
-- ============================================
DROP TRIGGER IF EXISTS trigger_notify_on_requisition_status_change ON requisitions CASCADE;
DROP FUNCTION IF EXISTS notify_on_requisition_status_change() CASCADE;

-- ============================================
-- Recreate notification trigger WITH email queueing
-- ============================================

/**
 * Trigger function: Notify on requisition status changes (WITH EMAIL)
 *
 * This function now:
 * 1. Creates in-app notifications
 * 2. Queues email notifications for users with email enabled
 */
CREATE OR REPLACE FUNCTION notify_on_requisition_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  submitter_name TEXT;
  reviewer_name TEXT;
  approver_name TEXT;
  reviewer_admin_ids UUID[];
  approver_admin_ids UUID[];
  msg TEXT;
  link_url TEXT;
  user_id UUID;
  email_content RECORD;
BEGIN
  -- Build link to requisition detail page
  link_url := '/requisitions/' || NEW.id::TEXT;

  -- Get submitter name for messages
  SELECT full_name INTO submitter_name
  FROM users
  WHERE id = NEW.submitted_by;

  -- ============================================
  -- CASE 1: Submitted for Review
  -- ============================================
  IF NEW.status = 'pending' AND (OLD.status IS NULL OR OLD.status = 'draft') THEN
    -- Get all reviewers, approvers, and super admins (except the submitter)
    SELECT ARRAY_AGG(id) INTO reviewer_admin_ids
    FROM users
    WHERE role IN ('reviewer', 'approver', 'super_admin')
      AND id != NEW.submitted_by;

    IF reviewer_admin_ids IS NOT NULL THEN
      msg := submitter_name || ' submitted requisition "' || NEW.title || '" for review.';

      -- Send in-app notifications
      PERFORM create_notification_for_users(
        reviewer_admin_ids,
        'requisition_submitted',
        'New Requisition Submitted',
        msg,
        link_url
      );

      -- Queue email notifications for each user
      FOREACH user_id IN ARRAY reviewer_admin_ids
      LOOP
        -- Get user name for personalized email
        SELECT full_name INTO reviewer_name FROM users WHERE id = user_id;

        -- Generate email content
        SELECT * INTO email_content
        FROM generate_submission_email(NEW.id, reviewer_name);

        -- Queue email
        PERFORM queue_email_notification(
          user_id,
          'requisition_submitted',
          NEW.id,
          email_content.subject,
          email_content.body_html,
          email_content.body_text
        );
      END LOOP;
    END IF;
  END IF;

  -- ============================================
  -- CASE 2: Marked as Reviewed
  -- ============================================
  IF NEW.status = 'reviewed'
     AND (OLD.status IS NULL OR OLD.status = 'pending')
     AND NEW.reviewed_by IS NOT NULL THEN

    -- Get reviewer name
    SELECT full_name INTO reviewer_name
    FROM users
    WHERE id = NEW.reviewed_by;

    -- Notify submitter (in-app)
    msg := 'Your requisition "' || NEW.title || '" has been reviewed by ' ||
           COALESCE(reviewer_name, 'a reviewer') || ' and is pending approval.';
    PERFORM create_notification(
      NEW.submitted_by,
      'requisition_reviewed',
      'Requisition Reviewed',
      msg,
      link_url
    );

    -- Queue email for submitter
    SELECT full_name INTO submitter_name FROM users WHERE id = NEW.submitted_by;
    -- For reviewed status, we'll use the submission email template
    -- In production, create a specific review template
    SELECT * INTO email_content
    FROM generate_submission_email(NEW.id, submitter_name);

    PERFORM queue_email_notification(
      NEW.submitted_by,
      'requisition_reviewed',
      NEW.id,
      'Requisition Reviewed: ' || NEW.requisition_number,
      email_content.body_html,
      email_content.body_text
    );

    -- Notify approvers and super admins (except submitter and reviewer)
    SELECT ARRAY_AGG(id) INTO approver_admin_ids
    FROM users
    WHERE role IN ('approver', 'super_admin')
      AND id != NEW.submitted_by
      AND id != NEW.reviewed_by;

    IF approver_admin_ids IS NOT NULL THEN
      msg := 'Requisition "' || NEW.title || '" has been reviewed by ' ||
             COALESCE(reviewer_name, 'a reviewer') || ' and needs your approval.';

      -- Send in-app notifications
      PERFORM create_notification_for_users(
        approver_admin_ids,
        'requisition_pending_approval',
        'Requisition Pending Approval',
        msg,
        link_url
      );

      -- Queue emails for approvers
      FOREACH user_id IN ARRAY approver_admin_ids
      LOOP
        SELECT full_name INTO approver_name FROM users WHERE id = user_id;
        SELECT * INTO email_content
        FROM generate_submission_email(NEW.id, approver_name);

        PERFORM queue_email_notification(
          user_id,
          'requisition_reviewed',
          NEW.id,
          email_content.subject,
          email_content.body_html,
          email_content.body_text
        );
      END LOOP;
    END IF;
  END IF;

  -- ============================================
  -- CASE 3: Approved
  -- ============================================
  IF NEW.status = 'approved' AND (OLD.status IS NULL OR OLD.status != 'approved') THEN
    -- Get approver name
    SELECT full_name INTO approver_name
    FROM users
    WHERE id = NEW.approved_by;

    -- Notify submitter (in-app)
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

    -- Queue email for submitter
    SELECT full_name INTO submitter_name FROM users WHERE id = NEW.submitted_by;
    SELECT * INTO email_content
    FROM generate_approval_email(NEW.id, submitter_name, COALESCE(approver_name, 'Admin'));

    PERFORM queue_email_notification(
      NEW.submitted_by,
      'requisition_approved',
      NEW.id,
      email_content.subject,
      email_content.body_html,
      email_content.body_text
    );

    -- Notify reviewer if they exist and are different from approver
    IF NEW.reviewed_by IS NOT NULL AND NEW.reviewed_by != NEW.approved_by THEN
      msg := 'Requisition "' || NEW.title || '" that you reviewed has been approved';
      IF approver_name IS NOT NULL THEN
        msg := msg || ' by ' || approver_name;
      END IF;
      msg := msg || '.';

      -- In-app notification
      PERFORM create_notification(
        NEW.reviewed_by,
        'requisition_approved',
        'Requisition Approved',
        msg,
        link_url
      );

      -- Email notification
      SELECT full_name INTO reviewer_name FROM users WHERE id = NEW.reviewed_by;
      SELECT * INTO email_content
      FROM generate_approval_email(NEW.id, reviewer_name, COALESCE(approver_name, 'Admin'));

      PERFORM queue_email_notification(
        NEW.reviewed_by,
        'requisition_approved',
        NEW.id,
        email_content.subject,
        email_content.body_html,
        email_content.body_text
      );
    END IF;
  END IF;

  -- ============================================
  -- CASE 4: Rejected
  -- ============================================
  IF NEW.status = 'rejected' AND (OLD.status IS NULL OR OLD.status != 'rejected') THEN
    -- Get rejector name
    SELECT full_name INTO reviewer_name
    FROM users
    WHERE id = COALESCE(NEW.approved_by, NEW.reviewed_by);

    -- Notify submitter (in-app)
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

    -- Queue email for submitter
    SELECT full_name INTO submitter_name FROM users WHERE id = NEW.submitted_by;
    SELECT * INTO email_content
    FROM generate_rejection_email(
      NEW.id,
      submitter_name,
      COALESCE(reviewer_name, 'Admin'),
      NEW.rejection_reason
    );

    PERFORM queue_email_notification(
      NEW.submitted_by,
      'requisition_rejected',
      NEW.id,
      email_content.subject,
      email_content.body_html,
      email_content.body_text
    );

    -- Notify reviewer if different from rejector
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

      -- Email for reviewer
      SELECT full_name INTO approver_name FROM users WHERE id = NEW.reviewed_by;
      SELECT * INTO email_content
      FROM generate_rejection_email(
        NEW.id,
        approver_name,
        COALESCE(reviewer_name, 'Admin'),
        NEW.rejection_reason
      );

      PERFORM queue_email_notification(
        NEW.reviewed_by,
        'requisition_rejected',
        NEW.id,
        email_content.subject,
        email_content.body_html,
        email_content.body_text
      );
    END IF;

    -- Notify approvers/admins when reviewer rejects
    IF OLD.status IN ('pending', 'under_review') THEN
      SELECT ARRAY_AGG(id) INTO approver_admin_ids
      FROM users
      WHERE role IN ('approver', 'super_admin')
        AND id != NEW.submitted_by
        AND id != COALESCE(NEW.approved_by, NEW.reviewed_by);

      IF approver_admin_ids IS NOT NULL THEN
        msg := 'Requisition "' || NEW.title || '" was rejected during review';
        IF reviewer_name IS NOT NULL THEN
          msg := msg || ' by ' || reviewer_name;
        END IF;
        msg := msg || '.';

        PERFORM create_notification_for_users(
          approver_admin_ids,
          'requisition_rejected',
          'Requisition Rejected',
          msg,
          link_url
        );

        -- Queue emails
        FOREACH user_id IN ARRAY approver_admin_ids
        LOOP
          SELECT full_name INTO approver_name FROM users WHERE id = user_id;
          SELECT * INTO email_content
          FROM generate_rejection_email(
            NEW.id,
            approver_name,
            COALESCE(reviewer_name, 'Reviewer'),
            NEW.rejection_reason
          );

          PERFORM queue_email_notification(
            user_id,
            'requisition_rejected',
            NEW.id,
            email_content.subject,
            email_content.body_html,
            email_content.body_text
          );
        END LOOP;
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Recreate trigger
CREATE TRIGGER trigger_notify_on_requisition_status_change
  AFTER UPDATE ON requisitions
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION notify_on_requisition_status_change();

-- ============================================
-- Verification
-- ============================================

DO $$
BEGIN
  RAISE NOTICE '==============================================';
  RAISE NOTICE 'Email Notifications Integrated';
  RAISE NOTICE '==============================================';
  RAISE NOTICE 'Notification triggers now:';
  RAISE NOTICE '  ✓ Send in-app notifications';
  RAISE NOTICE '  ✓ Queue email notifications';
  RAISE NOTICE '  ✓ Respect user email preferences';
  RAISE NOTICE '';
  RAISE NOTICE 'Email notifications queued for:';
  RAISE NOTICE '  - Requisition submitted';
  RAISE NOTICE '  - Requisition reviewed';
  RAISE NOTICE '  - Requisition approved';
  RAISE NOTICE '  - Requisition rejected';
  RAISE NOTICE '';
  RAISE NOTICE 'Next: Set up email service to process queue';
  RAISE NOTICE '==============================================';
END $$;

COMMIT;

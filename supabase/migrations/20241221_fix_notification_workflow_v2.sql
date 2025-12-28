-- =====================================================
-- Fix Notification Workflow V2
-- Date: 2024-12-21
-- Description: Fix notification triggers with proper parameter formatting
-- =====================================================

BEGIN;

-- Drop existing triggers
DROP TRIGGER IF EXISTS trigger_notify_on_requisition_submitted ON requisitions;
DROP TRIGGER IF EXISTS trigger_notify_on_requisition_reviewed ON requisitions;
DROP TRIGGER IF EXISTS trigger_notify_on_requisition_status_change ON requisitions;

-- Create comprehensive trigger function for all status changes
CREATE OR REPLACE FUNCTION notify_on_requisition_status_change()
RETURNS TRIGGER AS $$
DECLARE
  submitter_name TEXT;
  reviewer_name TEXT;
  reviewer_ids UUID[];
  admin_ids UUID[];
  message_text TEXT;
BEGIN
  -- Get submitter name
  SELECT full_name INTO submitter_name
  FROM users
  WHERE id = NEW.submitted_by;

  -- CASE 1: Draft -> Pending (Submitted for review)
  IF NEW.status = 'pending' AND OLD.status = 'draft' THEN
    -- Get all reviewers and super admins
    SELECT ARRAY_AGG(id) INTO reviewer_ids
    FROM users
    WHERE role IN ('reviewer', 'super_admin')
      AND id != NEW.submitted_by;

    -- Notify reviewers and admins
    IF reviewer_ids IS NOT NULL THEN
      message_text := submitter_name || ' submitted requisition "' || NEW.title || '" for review.';

      PERFORM create_notification_for_users(
        reviewer_ids,
        'requisition_submitted',
        'New Requisition Submitted',
        message_text,
        '/requisitions/' || NEW.id::text
      );
    END IF;
  END IF;

  -- CASE 2: Pending -> Reviewed (Reviewed by reviewer, needs approval)
  IF NEW.status = 'reviewed' AND OLD.status = 'pending' THEN
    -- Get reviewer name
    SELECT full_name INTO reviewer_name
    FROM users
    WHERE id = NEW.reviewed_by;

    -- Notify submitter that requisition has been reviewed
    message_text := 'Your requisition "' || NEW.title || '" has been reviewed by ' ||
                    COALESCE(reviewer_name, 'a reviewer') || ' and is pending approval.';

    PERFORM create_notification(
      NEW.submitted_by,
      'requisition_reviewed',
      'Requisition Reviewed',
      message_text,
      '/requisitions/' || NEW.id::text
    );

    -- Notify super admins that requisition needs approval
    SELECT ARRAY_AGG(id) INTO admin_ids
    FROM users
    WHERE role = 'super_admin'
      AND id != NEW.submitted_by
      AND id != NEW.reviewed_by;

    IF admin_ids IS NOT NULL THEN
      message_text := 'Requisition "' || NEW.title || '" has been reviewed by ' ||
                      COALESCE(reviewer_name, 'a reviewer') || ' and needs your approval.';

      PERFORM create_notification_for_users(
        admin_ids,
        'requisition_pending_approval',
        'Requisition Pending Approval',
        message_text,
        '/requisitions/' || NEW.id::text
      );
    END IF;
  END IF;

  -- CASE 3: Any status -> Approved
  IF NEW.status = 'approved' AND OLD.status != 'approved' THEN
    -- Get approver name
    SELECT full_name INTO reviewer_name
    FROM users
    WHERE id = NEW.approved_by;

    -- Notify submitter
    message_text := 'Your requisition "' || NEW.title || '" has been approved';
    IF reviewer_name IS NOT NULL THEN
      message_text := message_text || ' by ' || reviewer_name;
    END IF;
    message_text := message_text || '.';

    PERFORM create_notification(
      NEW.submitted_by,
      'requisition_approved',
      'Requisition Approved',
      message_text,
      '/requisitions/' || NEW.id::text
    );

    -- If there was a reviewer (different from approver), notify them too
    IF NEW.reviewed_by IS NOT NULL AND NEW.reviewed_by != NEW.approved_by THEN
      message_text := 'Requisition "' || NEW.title || '" that you reviewed has been approved';
      IF reviewer_name IS NOT NULL THEN
        message_text := message_text || ' by ' || reviewer_name;
      END IF;
      message_text := message_text || '.';

      PERFORM create_notification(
        NEW.reviewed_by,
        'requisition_approved',
        'Requisition Approved',
        message_text,
        '/requisitions/' || NEW.id::text
      );
    END IF;
  END IF;

  -- CASE 4: Any status -> Rejected
  IF NEW.status = 'rejected' AND OLD.status != 'rejected' THEN
    -- Get rejector name
    SELECT full_name INTO reviewer_name
    FROM users
    WHERE id = COALESCE(NEW.approved_by, NEW.reviewed_by);

    -- Notify submitter
    message_text := 'Your requisition "' || NEW.title || '" has been rejected';
    IF reviewer_name IS NOT NULL THEN
      message_text := message_text || ' by ' || reviewer_name;
    END IF;
    message_text := message_text || '.';

    IF NEW.rejection_reason IS NOT NULL THEN
      message_text := message_text || ' Reason: ' || NEW.rejection_reason;
    END IF;

    PERFORM create_notification(
      NEW.submitted_by,
      'requisition_rejected',
      'Requisition Rejected',
      message_text,
      '/requisitions/' || NEW.id::text
    );

    -- If there was a reviewer (different from rejector), notify them too
    IF NEW.reviewed_by IS NOT NULL AND NEW.reviewed_by != COALESCE(NEW.approved_by, NEW.reviewed_by) THEN
      message_text := 'Requisition "' || NEW.title || '" that you reviewed has been rejected';
      IF reviewer_name IS NOT NULL THEN
        message_text := message_text || ' by ' || reviewer_name;
      END IF;
      message_text := message_text || '.';

      PERFORM create_notification(
        NEW.reviewed_by,
        'requisition_rejected',
        'Requisition Rejected',
        message_text,
        '/requisitions/' || NEW.id::text
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create single trigger for all status changes
CREATE TRIGGER trigger_notify_on_requisition_status_change
  AFTER UPDATE ON requisitions
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION notify_on_requisition_status_change();

-- Add comments
COMMENT ON FUNCTION notify_on_requisition_status_change IS 'Sends notifications for all requisition status changes: submitted, reviewed, approved, rejected';

-- Success message
DO $$
BEGIN
  RAISE NOTICE '==============================================';
  RAISE NOTICE 'Notification Workflow Fixed Successfully (V2)';
  RAISE NOTICE 'Notifications now cover all workflow states:';
  RAISE NOTICE '  - Draft -> Pending (Submitted)';
  RAISE NOTICE '  - Pending -> Reviewed (Needs Approval)';
  RAISE NOTICE '  - Reviewed -> Approved';
  RAISE NOTICE '  - Any -> Rejected';
  RAISE NOTICE 'Message formatting fixed to avoid parameter errors';
  RAISE NOTICE '==============================================';
END $$;

COMMIT;

-- =====================================================
-- Handle Direct Approval (No Reviewer)
-- Date: 2024-12-21
-- Description: Fix notifications when super admin approves directly without reviewer
-- =====================================================

BEGIN;

-- Drop and recreate the trigger function to handle NULL reviewed_by
DROP FUNCTION IF EXISTS notify_on_requisition_status_change() CASCADE;

CREATE FUNCTION notify_on_requisition_status_change()
RETURNS TRIGGER AS $$
DECLARE
  submitter_name TEXT;
  reviewer_name TEXT;
  approver_name TEXT;
  reviewer_ids UUID[];
  admin_ids UUID[];
  msg TEXT;
  link_url VARCHAR;
BEGIN
  -- Build link URL
  link_url := ('/requisitions/' || NEW.id::text)::VARCHAR;

  -- Get submitter name
  SELECT full_name INTO submitter_name FROM users WHERE id = NEW.submitted_by;

  -- CASE 1: Draft/NULL -> Pending (Submitted for review)
  IF NEW.status = 'pending' AND (OLD.status IS NULL OR OLD.status = 'draft') THEN
    SELECT ARRAY_AGG(id) INTO reviewer_ids
    FROM users
    WHERE role IN ('reviewer', 'super_admin') AND id != NEW.submitted_by;

    IF reviewer_ids IS NOT NULL THEN
      msg := submitter_name || ' submitted requisition "' || NEW.title || '" for review.';
      PERFORM create_notification_for_users(
        reviewer_ids,
        'requisition_submitted'::VARCHAR,
        'New Requisition Submitted'::VARCHAR,
        msg::TEXT,
        link_url
      );
    END IF;
  END IF;

  -- CASE 2: Pending -> Reviewed (Marked as reviewed by reviewer)
  IF NEW.status = 'reviewed' AND OLD.status = 'pending' AND NEW.reviewed_by IS NOT NULL THEN
    SELECT full_name INTO reviewer_name FROM users WHERE id = NEW.reviewed_by;

    -- Notify submitter
    msg := 'Your requisition "' || NEW.title || '" has been reviewed by ' ||
           COALESCE(reviewer_name, 'a reviewer') || ' and is pending approval.';
    PERFORM create_notification(
      NEW.submitted_by,
      'requisition_reviewed'::VARCHAR,
      'Requisition Reviewed'::VARCHAR,
      msg::TEXT,
      link_url
    );

    -- Notify super admins
    SELECT ARRAY_AGG(id) INTO admin_ids
    FROM users
    WHERE role = 'super_admin' AND id != NEW.submitted_by AND id != NEW.reviewed_by;

    IF admin_ids IS NOT NULL THEN
      msg := 'Requisition "' || NEW.title || '" has been reviewed by ' ||
             COALESCE(reviewer_name, 'a reviewer') || ' and needs your approval.';
      PERFORM create_notification_for_users(
        admin_ids,
        'requisition_pending_approval'::VARCHAR,
        'Requisition Pending Approval'::VARCHAR,
        msg::TEXT,
        link_url
      );
    END IF;
  END IF;

  -- CASE 3: Any status -> Approved (Can be direct or after review)
  IF NEW.status = 'approved' AND (OLD.status IS NULL OR OLD.status != 'approved') THEN
    -- Get approver name
    SELECT full_name INTO approver_name FROM users WHERE id = NEW.approved_by;

    -- Get reviewer name (might be NULL for direct approvals)
    IF NEW.reviewed_by IS NOT NULL THEN
      SELECT full_name INTO reviewer_name FROM users WHERE id = NEW.reviewed_by;
    END IF;

    -- Notify submitter
    msg := 'Your requisition "' || NEW.title || '" has been approved';
    IF approver_name IS NOT NULL THEN
      msg := msg || ' by ' || approver_name;
    END IF;
    msg := msg || '.';

    PERFORM create_notification(
      NEW.submitted_by,
      'requisition_approved'::VARCHAR,
      'Requisition Approved'::VARCHAR,
      msg::TEXT,
      link_url
    );

    -- Notify reviewer if they exist AND are different from approver
    IF NEW.reviewed_by IS NOT NULL AND NEW.reviewed_by != COALESCE(NEW.approved_by, '00000000-0000-0000-0000-000000000000'::uuid) THEN
      msg := 'Requisition "' || NEW.title || '" that you reviewed has been approved';
      IF approver_name IS NOT NULL THEN
        msg := msg || ' by ' || approver_name;
      END IF;
      msg := msg || '.';

      PERFORM create_notification(
        NEW.reviewed_by,
        'requisition_approved'::VARCHAR,
        'Requisition Approved'::VARCHAR,
        msg::TEXT,
        link_url
      );
    END IF;
  END IF;

  -- CASE 4: Any status -> Rejected
  IF NEW.status = 'rejected' AND (OLD.status IS NULL OR OLD.status != 'rejected') THEN
    -- Get name of whoever rejected (could be approver or reviewer)
    SELECT full_name INTO reviewer_name FROM users WHERE id = COALESCE(NEW.approved_by, NEW.reviewed_by);

    -- Notify submitter
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
      'requisition_rejected'::VARCHAR,
      'Requisition Rejected'::VARCHAR,
      msg::TEXT,
      link_url
    );

    -- Notify reviewer if they exist and are different from rejector
    IF NEW.reviewed_by IS NOT NULL AND NEW.reviewed_by != COALESCE(NEW.approved_by, NEW.reviewed_by) THEN
      msg := 'Requisition "' || NEW.title || '" that you reviewed has been rejected';
      IF reviewer_name IS NOT NULL THEN
        msg := msg || ' by ' || reviewer_name;
      END IF;
      msg := msg || '.';

      PERFORM create_notification(
        NEW.reviewed_by,
        'requisition_rejected'::VARCHAR,
        'Requisition Rejected'::VARCHAR,
        msg::TEXT,
        link_url
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recreate trigger
CREATE TRIGGER trigger_notify_on_requisition_status_change
  AFTER UPDATE ON requisitions
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION notify_on_requisition_status_change();

-- Success message
DO $$
BEGIN
  RAISE NOTICE '==============================================';
  RAISE NOTICE 'Notification System Fixed for Direct Approvals';
  RAISE NOTICE 'Now handles:';
  RAISE NOTICE '  - Direct approval by super admin (no reviewer)';
  RAISE NOTICE '  - Normal workflow with reviewer';
  RAISE NOTICE '  - NULL reviewed_by values gracefully';
  RAISE NOTICE '==============================================';
END $$;

COMMIT;

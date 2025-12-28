-- =====================================================
-- Complete Notification System Reset
-- Date: 2024-12-21
-- Description: Clean slate - removes everything and recreates properly
-- =====================================================

BEGIN;

-- Step 1: Drop all existing triggers
DROP TRIGGER IF EXISTS trigger_notify_on_requisition_submitted ON requisitions CASCADE;
DROP TRIGGER IF EXISTS trigger_notify_on_requisition_reviewed ON requisitions CASCADE;
DROP TRIGGER IF EXISTS trigger_notify_on_requisition_status_change ON requisitions CASCADE;

-- Step 2: Drop all notification functions
DROP FUNCTION IF EXISTS notify_on_requisition_submitted() CASCADE;
DROP FUNCTION IF EXISTS notify_on_requisition_reviewed() CASCADE;
DROP FUNCTION IF EXISTS notify_on_requisition_status_change() CASCADE;
DROP FUNCTION IF EXISTS create_notification_for_users(UUID[], VARCHAR, VARCHAR, TEXT, VARCHAR) CASCADE;
DROP FUNCTION IF EXISTS create_notification(UUID, VARCHAR, VARCHAR, TEXT, VARCHAR) CASCADE;

-- Step 3: Recreate create_notification function
CREATE FUNCTION create_notification(
  p_user_id UUID,
  p_type VARCHAR,
  p_title VARCHAR,
  p_message TEXT,
  p_link VARCHAR DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  notification_id UUID;
BEGIN
  INSERT INTO notifications (user_id, type, title, message, link)
  VALUES (p_user_id, p_type, p_title, p_message, p_link)
  RETURNING id INTO notification_id;

  RETURN notification_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 4: Recreate create_notification_for_users function
CREATE FUNCTION create_notification_for_users(
  p_user_ids UUID[],
  p_type VARCHAR,
  p_title VARCHAR,
  p_message TEXT,
  p_link VARCHAR DEFAULT NULL
)
RETURNS INTEGER AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 5: Create comprehensive trigger function
CREATE FUNCTION notify_on_requisition_status_change()
RETURNS TRIGGER AS $$
DECLARE
  submitter_name TEXT;
  reviewer_name TEXT;
  reviewer_ids UUID[];
  admin_ids UUID[];
  msg TEXT;
  link_url TEXT;
BEGIN
  -- Build link URL once
  link_url := '/requisitions/' || NEW.id::text;

  -- Get submitter name
  SELECT full_name INTO submitter_name FROM users WHERE id = NEW.submitted_by;

  -- CASE 1: Draft -> Pending (Submitted for review)
  IF NEW.status = 'pending' AND (OLD.status IS NULL OR OLD.status = 'draft') THEN
    SELECT ARRAY_AGG(id) INTO reviewer_ids
    FROM users
    WHERE role IN ('reviewer', 'super_admin') AND id != NEW.submitted_by;

    IF reviewer_ids IS NOT NULL THEN
      msg := submitter_name || ' submitted requisition "' || NEW.title || '" for review.';
      PERFORM create_notification_for_users(reviewer_ids, 'requisition_submitted', 'New Requisition Submitted', msg, link_url);
    END IF;
  END IF;

  -- CASE 2: Pending -> Reviewed (Reviewed by reviewer, needs approval)
  IF NEW.status = 'reviewed' AND OLD.status = 'pending' THEN
    SELECT full_name INTO reviewer_name FROM users WHERE id = NEW.reviewed_by;

    -- Notify submitter
    msg := 'Your requisition "' || NEW.title || '" has been reviewed by ' || COALESCE(reviewer_name, 'a reviewer') || ' and is pending approval.';
    PERFORM create_notification(NEW.submitted_by, 'requisition_reviewed', 'Requisition Reviewed', msg, link_url);

    -- Notify super admins
    SELECT ARRAY_AGG(id) INTO admin_ids
    FROM users
    WHERE role = 'super_admin' AND id != NEW.submitted_by AND id != COALESCE(NEW.reviewed_by, '00000000-0000-0000-0000-000000000000'::uuid);

    IF admin_ids IS NOT NULL THEN
      msg := 'Requisition "' || NEW.title || '" has been reviewed by ' || COALESCE(reviewer_name, 'a reviewer') || ' and needs your approval.';
      PERFORM create_notification_for_users(admin_ids, 'requisition_pending_approval', 'Requisition Pending Approval', msg, link_url);
    END IF;
  END IF;

  -- CASE 3: Any status -> Approved
  IF NEW.status = 'approved' AND (OLD.status IS NULL OR OLD.status != 'approved') THEN
    SELECT full_name INTO reviewer_name FROM users WHERE id = NEW.approved_by;

    -- Notify submitter
    msg := 'Your requisition "' || NEW.title || '" has been approved';
    IF reviewer_name IS NOT NULL THEN
      msg := msg || ' by ' || reviewer_name;
    END IF;
    msg := msg || '.';
    PERFORM create_notification(NEW.submitted_by, 'requisition_approved', 'Requisition Approved', msg, link_url);

    -- Notify reviewer if different from approver
    IF NEW.reviewed_by IS NOT NULL AND NEW.reviewed_by != COALESCE(NEW.approved_by, '00000000-0000-0000-0000-000000000000'::uuid) THEN
      msg := 'Requisition "' || NEW.title || '" that you reviewed has been approved';
      IF reviewer_name IS NOT NULL THEN
        msg := msg || ' by ' || reviewer_name;
      END IF;
      msg := msg || '.';
      PERFORM create_notification(NEW.reviewed_by, 'requisition_approved', 'Requisition Approved', msg, link_url);
    END IF;
  END IF;

  -- CASE 4: Any status -> Rejected
  IF NEW.status = 'rejected' AND (OLD.status IS NULL OR OLD.status != 'rejected') THEN
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
    PERFORM create_notification(NEW.submitted_by, 'requisition_rejected', 'Requisition Rejected', msg, link_url);

    -- Notify reviewer if different from rejector
    IF NEW.reviewed_by IS NOT NULL AND NEW.reviewed_by != COALESCE(NEW.approved_by, NEW.reviewed_by) THEN
      msg := 'Requisition "' || NEW.title || '" that you reviewed has been rejected';
      IF reviewer_name IS NOT NULL THEN
        msg := msg || ' by ' || reviewer_name;
      END IF;
      msg := msg || '.';
      PERFORM create_notification(NEW.reviewed_by, 'requisition_rejected', 'Requisition Rejected', msg, link_url);
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 6: Create trigger
CREATE TRIGGER trigger_notify_on_requisition_status_change
  AFTER UPDATE ON requisitions
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION notify_on_requisition_status_change();

-- Add comments
COMMENT ON FUNCTION create_notification IS 'Creates a notification for a single user';
COMMENT ON FUNCTION create_notification_for_users IS 'Creates notifications for multiple users';
COMMENT ON FUNCTION notify_on_requisition_status_change IS 'Sends notifications for all requisition status changes';

-- Success message
DO $$
BEGIN
  RAISE NOTICE '==============================================';
  RAISE NOTICE 'Notification System Completely Reset';
  RAISE NOTICE 'All functions and triggers recreated from scratch';
  RAISE NOTICE 'Functions:';
  RAISE NOTICE '  - create_notification(uuid, varchar, varchar, text, varchar)';
  RAISE NOTICE '  - create_notification_for_users(uuid[], varchar, varchar, text, varchar)';
  RAISE NOTICE '  - notify_on_requisition_status_change()';
  RAISE NOTICE 'Trigger: trigger_notify_on_requisition_status_change';
  RAISE NOTICE '==============================================';
END $$;

COMMIT;

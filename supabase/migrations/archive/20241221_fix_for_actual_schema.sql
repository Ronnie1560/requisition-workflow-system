-- =====================================================
-- Fix for Actual Notification Schema
-- Date: 2024-12-21
-- Description: Matches the actual table schema with related_table and related_id
-- =====================================================

BEGIN;

-- Drop ALL versions of notification functions (including old signatures)
DROP FUNCTION IF EXISTS create_notification(UUID, VARCHAR, VARCHAR, TEXT, VARCHAR, UUID) CASCADE;
DROP FUNCTION IF EXISTS create_notification(UUID, VARCHAR, VARCHAR, TEXT, VARCHAR) CASCADE;
DROP FUNCTION IF EXISTS create_notification_for_users(UUID[], VARCHAR, VARCHAR, TEXT, VARCHAR, UUID) CASCADE;
DROP FUNCTION IF EXISTS create_notification_for_users(UUID[], VARCHAR, VARCHAR, TEXT, VARCHAR) CASCADE;
DROP FUNCTION IF EXISTS notify_on_requisition_status_change() CASCADE;

-- Drop all triggers
DROP TRIGGER IF EXISTS trigger_notify_on_requisition_status_change ON requisitions CASCADE;

-- Create NEW function matching actual table schema
-- This version uses the link column and leaves related_table/related_id as NULL
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
  -- Insert with explicit column list matching table structure
  INSERT INTO notifications (
    user_id,
    type,
    title,
    message,
    link,
    related_table,
    related_id,
    is_read
  )
  VALUES (
    p_user_id,
    p_type,
    p_title,
    p_message,
    p_link,
    NULL,  -- related_table not used
    NULL,  -- related_id not used
    false
  )
  RETURNING id INTO notification_id;

  RETURN notification_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function for multiple users
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

-- Create trigger function
CREATE FUNCTION notify_on_requisition_status_change()
RETURNS TRIGGER AS $$
DECLARE
  submitter_name TEXT;
  reviewer_name TEXT;
  reviewer_ids UUID[];
  admin_ids UUID[];
  msg TEXT;
  link_url VARCHAR;
BEGIN
  -- Build link URL with explicit VARCHAR cast
  link_url := ('/requisitions/' || NEW.id::text)::VARCHAR;

  -- Get submitter name
  SELECT full_name INTO submitter_name FROM users WHERE id = NEW.submitted_by;

  -- CASE 1: Draft -> Pending (Submitted for review)
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

  -- CASE 2: Pending -> Reviewed (needs approval)
  IF NEW.status = 'reviewed' AND OLD.status = 'pending' THEN
    SELECT full_name INTO reviewer_name FROM users WHERE id = NEW.reviewed_by;

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
    WHERE role = 'super_admin' AND id != NEW.submitted_by AND id != COALESCE(NEW.reviewed_by, '00000000-0000-0000-0000-000000000000'::uuid);

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

  -- CASE 3: Approved
  IF NEW.status = 'approved' AND (OLD.status IS NULL OR OLD.status != 'approved') THEN
    SELECT full_name INTO reviewer_name FROM users WHERE id = NEW.approved_by;

    msg := 'Your requisition "' || NEW.title || '" has been approved';
    IF reviewer_name IS NOT NULL THEN
      msg := msg || ' by ' || reviewer_name;
    END IF;
    msg := msg || '.';

    PERFORM create_notification(
      NEW.submitted_by,
      'requisition_approved'::VARCHAR,
      'Requisition Approved'::VARCHAR,
      msg::TEXT,
      link_url
    );

    -- Notify reviewer if different
    IF NEW.reviewed_by IS NOT NULL AND NEW.reviewed_by != COALESCE(NEW.approved_by, '00000000-0000-0000-0000-000000000000'::uuid) THEN
      msg := 'Requisition "' || NEW.title || '" that you reviewed has been approved';
      IF reviewer_name IS NOT NULL THEN
        msg := msg || ' by ' || reviewer_name;
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

  -- CASE 4: Rejected
  IF NEW.status = 'rejected' AND (OLD.status IS NULL OR OLD.status != 'rejected') THEN
    SELECT full_name INTO reviewer_name FROM users WHERE id = COALESCE(NEW.approved_by, NEW.reviewed_by);

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

    -- Notify reviewer if different
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

-- Create trigger
CREATE TRIGGER trigger_notify_on_requisition_status_change
  AFTER UPDATE ON requisitions
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION notify_on_requisition_status_change();

-- Success message
DO $$
BEGIN
  RAISE NOTICE '==============================================';
  RAISE NOTICE 'Notification System Fixed for Actual Schema';
  RAISE NOTICE 'Function signature: (uuid, varchar, varchar, text, varchar)';
  RAISE NOTICE 'Handles: related_table and related_id (set to NULL)';
  RAISE NOTICE 'All type casts explicit with ::VARCHAR and ::TEXT';
  RAISE NOTICE '==============================================';
END $$;

COMMIT;

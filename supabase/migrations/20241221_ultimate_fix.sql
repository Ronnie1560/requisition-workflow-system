-- =====================================================
-- ULTIMATE Notification System Fix
-- Date: 2024-12-21
-- Description: Drops OLD functions from helper_functions.sql and updates comment notifications
-- =====================================================

BEGIN;

-- ============================================
-- STEP 1: Drop ALL old notification functions and triggers
-- ============================================

-- Drop old triggers first
DROP TRIGGER IF EXISTS trigger_notify_requisition_status ON requisitions CASCADE;
DROP TRIGGER IF EXISTS trigger_notify_new_comment ON comments CASCADE;
DROP TRIGGER IF EXISTS trigger_notify_on_requisition_submitted ON requisitions CASCADE;
DROP TRIGGER IF EXISTS trigger_notify_on_requisition_reviewed ON requisitions CASCADE;
DROP TRIGGER IF EXISTS trigger_notify_on_requisition_status_change ON requisitions CASCADE;

-- Drop old functions with notification_type ENUM (from helper_functions.sql)
DROP FUNCTION IF EXISTS create_notification(UUID, notification_type, VARCHAR, TEXT, VARCHAR, UUID) CASCADE;
DROP FUNCTION IF EXISTS notify_requisition_status_change() CASCADE;
DROP FUNCTION IF EXISTS notify_new_comment() CASCADE;

-- Drop all other possible signatures
DROP FUNCTION IF EXISTS create_notification(UUID, VARCHAR, VARCHAR, TEXT, VARCHAR, UUID) CASCADE;
DROP FUNCTION IF EXISTS create_notification(UUID, VARCHAR, VARCHAR, TEXT, TEXT, UUID) CASCADE;
DROP FUNCTION IF EXISTS create_notification(UUID, TEXT, TEXT, TEXT, TEXT, UUID) CASCADE;
DROP FUNCTION IF EXISTS create_notification(UUID, VARCHAR, VARCHAR, TEXT, VARCHAR) CASCADE;
DROP FUNCTION IF EXISTS create_notification(UUID, TEXT, TEXT, TEXT, TEXT) CASCADE;
DROP FUNCTION IF EXISTS create_notification_for_users(UUID[], VARCHAR, VARCHAR, TEXT, VARCHAR, UUID) CASCADE;
DROP FUNCTION IF EXISTS create_notification_for_users(UUID[], VARCHAR, VARCHAR, TEXT, VARCHAR) CASCADE;
DROP FUNCTION IF EXISTS create_notification_for_users(UUID[], TEXT, TEXT, TEXT, TEXT) CASCADE;
DROP FUNCTION IF EXISTS notify_on_requisition_submitted() CASCADE;
DROP FUNCTION IF EXISTS notify_on_requisition_reviewed() CASCADE;
DROP FUNCTION IF EXISTS notify_on_requisition_status_change() CASCADE;

-- ============================================
-- STEP 2: Create NEW notification functions
-- ============================================

-- Main notification function (5 parameters, TEXT types)
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
    NULL,  -- No longer using related_table
    NULL,  -- No longer using related_id
    false,
    NOW()
  )
  RETURNING id INTO notification_id;

  RETURN notification_id;
END;
$$;

-- Function for multiple users
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

-- ============================================
-- STEP 3: Create NEW comment notification trigger
-- ============================================

CREATE OR REPLACE FUNCTION notify_new_comment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  req_submitter UUID;
  req_number VARCHAR(50);
  req_title TEXT;
  commenter_name TEXT;
BEGIN
  -- Get requisition info
  SELECT submitted_by, requisition_number, title
  INTO req_submitter, req_number, req_title
  FROM requisitions
  WHERE id = NEW.requisition_id;

  -- Get commenter name
  SELECT full_name INTO commenter_name
  FROM users
  WHERE id = NEW.user_id;

  -- Notify submitter if comment is not from them
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

CREATE TRIGGER trigger_notify_new_comment
  AFTER INSERT ON comments
  FOR EACH ROW
  EXECUTE FUNCTION notify_new_comment();

-- ============================================
-- STEP 4: Create NEW requisition status change trigger
-- ============================================

CREATE OR REPLACE FUNCTION notify_on_requisition_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
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
  -- Build link URL
  link_url := '/requisitions/' || NEW.id::TEXT;

  -- Get submitter name
  SELECT full_name INTO submitter_name FROM users WHERE id = NEW.submitted_by;

  -- CASE 1: Draft/NULL -> Pending (Submitted)
  IF NEW.status = 'pending' AND (OLD.status IS NULL OR OLD.status = 'draft') THEN
    SELECT ARRAY_AGG(id) INTO reviewer_ids
    FROM users
    WHERE role IN ('reviewer', 'super_admin') AND id != NEW.submitted_by;

    IF reviewer_ids IS NOT NULL THEN
      msg := submitter_name || ' submitted requisition "' || NEW.title || '" for review.';
      PERFORM create_notification_for_users(reviewer_ids, 'requisition_submitted', 'New Requisition Submitted', msg, link_url);
    END IF;
  END IF;

  -- CASE 2: Pending -> Reviewed
  IF NEW.status = 'reviewed' AND (OLD.status IS NULL OR OLD.status = 'pending') AND NEW.reviewed_by IS NOT NULL THEN
    SELECT full_name INTO reviewer_name FROM users WHERE id = NEW.reviewed_by;

    -- Notify submitter
    msg := 'Your requisition "' || NEW.title || '" has been reviewed by ' || COALESCE(reviewer_name, 'a reviewer') || ' and is pending approval.';
    PERFORM create_notification(NEW.submitted_by, 'requisition_reviewed', 'Requisition Reviewed', msg, link_url);

    -- Notify super admins
    SELECT ARRAY_AGG(id) INTO admin_ids
    FROM users
    WHERE role = 'super_admin'
      AND id != NEW.submitted_by
      AND id != NEW.reviewed_by;

    IF admin_ids IS NOT NULL THEN
      msg := 'Requisition "' || NEW.title || '" has been reviewed by ' || COALESCE(reviewer_name, 'a reviewer') || ' and needs your approval.';
      PERFORM create_notification_for_users(admin_ids, 'requisition_pending_approval', 'Requisition Pending Approval', msg, link_url);
    END IF;
  END IF;

  -- CASE 3: Approved (handles both direct and after review)
  IF NEW.status = 'approved' AND (OLD.status IS NULL OR OLD.status != 'approved') THEN
    -- Get approver name
    SELECT full_name INTO approver_name FROM users WHERE id = NEW.approved_by;

    -- Notify submitter
    msg := 'Your requisition "' || NEW.title || '" has been approved';
    IF approver_name IS NOT NULL THEN
      msg := msg || ' by ' || approver_name;
    END IF;
    msg := msg || '.';
    PERFORM create_notification(NEW.submitted_by, 'requisition_approved', 'Requisition Approved', msg, link_url);

    -- Notify reviewer if exists and different from approver
    IF NEW.reviewed_by IS NOT NULL AND NEW.reviewed_by != NEW.approved_by THEN
      msg := 'Requisition "' || NEW.title || '" that you reviewed has been approved';
      IF approver_name IS NOT NULL THEN
        msg := msg || ' by ' || approver_name;
      END IF;
      msg := msg || '.';
      PERFORM create_notification(NEW.reviewed_by, 'requisition_approved', 'Requisition Approved', msg, link_url);
    END IF;
  END IF;

  -- CASE 4: Rejected
  IF NEW.status = 'rejected' AND (OLD.status IS NULL OR OLD.status != 'rejected') THEN
    -- Get name of rejector
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

    -- Notify reviewer if exists and different from rejector
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
$$;

CREATE TRIGGER trigger_notify_on_requisition_status_change
  AFTER UPDATE ON requisitions
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION notify_on_requisition_status_change();

-- ============================================
-- STEP 5: Verify and report
-- ============================================

DO $$
DECLARE
  func_count INTEGER;
  trig_count INTEGER;
  comment_trig_count INTEGER;
BEGIN
  -- Count notification functions
  SELECT COUNT(*) INTO func_count
  FROM pg_proc p
  JOIN pg_namespace n ON p.pronamespace = n.oid
  WHERE n.nspname = 'public' AND p.proname LIKE '%notification%';

  -- Count requisition triggers
  SELECT COUNT(*) INTO trig_count
  FROM pg_trigger
  WHERE tgrelid = 'requisitions'::regclass AND tgname LIKE '%notif%';

  -- Count comment triggers
  SELECT COUNT(*) INTO comment_trig_count
  FROM pg_trigger
  WHERE tgrelid = 'comments'::regclass AND tgname LIKE '%notif%';

  RAISE NOTICE '==============================================';
  RAISE NOTICE 'ULTIMATE Notification System Fix Complete';
  RAISE NOTICE '==============================================';
  RAISE NOTICE 'Functions created: %', func_count;
  RAISE NOTICE 'Requisition triggers: %', trig_count;
  RAISE NOTICE 'Comment triggers: %', comment_trig_count;
  RAISE NOTICE '';
  RAISE NOTICE 'Function signature:';
  RAISE NOTICE '  create_notification(uuid, text, text, text, text)';
  RAISE NOTICE '';
  RAISE NOTICE 'Fixed:';
  RAISE NOTICE '  ✓ Dropped OLD 6-parameter function from helper_functions.sql';
  RAISE NOTICE '  ✓ Updated comment notification to use new 5-parameter function';
  RAISE NOTICE '  ✓ Removed old notify_requisition_status_change trigger';
  RAISE NOTICE '  ✓ Created new notify_on_requisition_status_change trigger';
  RAISE NOTICE '  ✓ All functions use TEXT instead of VARCHAR or ENUM';
  RAISE NOTICE '==============================================';
END $$;

COMMIT;

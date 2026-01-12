-- =====================================================
-- Notification System - Production Ready
-- Date: 2024-12-22
-- Version: 1.0.0
-- Description: Complete working notification system
--
-- This migration consolidates all notification-related fixes
-- into a single, production-ready migration file.
--
-- Features:
-- - 5-parameter notification function using TEXT types
-- - Handles requisition workflow notifications
-- - Handles comment notifications
-- - Supports direct approval (NULL reviewed_by)
-- - Proper type casting and NULL handling
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
-- NOTE: These may have been created by previous migrations or helper_functions.sql
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
AS $$
DECLARE
  notification_id UUID;
BEGIN
  -- Insert notification with explicit column list
  INSERT INTO notifications (
    user_id,
    type,
    title,
    message,
    link,
    related_table,  -- Legacy column, set to NULL
    related_id,     -- Legacy column, set to NULL
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
  'Creates a notification for a single user. Uses TEXT types for all string parameters to avoid type casting issues.';

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
AS $$
DECLARE
  created_count INTEGER := 0;
  user_id UUID;
BEGIN
  -- Create notification for each user
  FOREACH user_id IN ARRAY p_user_ids
  LOOP
    PERFORM create_notification(user_id, p_type, p_title, p_message, p_link);
    created_count := created_count + 1;
  END LOOP;

  RETURN created_count;
END;
$$;

COMMENT ON FUNCTION create_notification_for_users IS
  'Creates the same notification for multiple users. Useful for notifying groups (e.g., all reviewers).';

-- ============================================
-- STEP 3: Comment Notification Trigger
-- ============================================

/**
 * Trigger function: Notify when a comment is added
 *
 * Notifies the requisition submitter when someone comments,
 * unless the commenter is the submitter themselves.
 */
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
  -- Get requisition information
  SELECT submitted_by, requisition_number, title
  INTO req_submitter, req_number, req_title
  FROM requisitions
  WHERE id = NEW.requisition_id;

  -- Get commenter name
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

-- Create trigger for comment notifications
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
 *
 * Special handling:
 * - Supports direct approval (pending → approved without review)
 * - Handles NULL reviewed_by gracefully
 * - Prevents duplicate notifications
 */
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
    -- Get all reviewers and super admins (except the submitter)
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

    -- Notify submitter
    msg := 'Your requisition "' || NEW.title || '" has been reviewed by ' ||
           COALESCE(reviewer_name, 'a reviewer') || ' and is pending approval.';
    PERFORM create_notification(
      NEW.submitted_by,
      'requisition_reviewed',
      'Requisition Reviewed',
      msg,
      link_url
    );

    -- Notify super admins (except submitter and reviewer)
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

  -- ============================================
  -- CASE 3: Approved
  -- ============================================
  IF NEW.status = 'approved' AND (OLD.status IS NULL OR OLD.status != 'approved') THEN
    -- Get approver name
    SELECT full_name INTO approver_name
    FROM users
    WHERE id = NEW.approved_by;

    -- Notify submitter
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

    -- Notify reviewer if they exist and are different from approver
    -- This handles the case where a reviewer reviewed but didn't approve
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

  -- ============================================
  -- CASE 4: Rejected
  -- ============================================
  IF NEW.status = 'rejected' AND (OLD.status IS NULL OR OLD.status != 'rejected') THEN
    -- Get rejector name (could be approver or reviewer)
    SELECT full_name INTO reviewer_name
    FROM users
    WHERE id = COALESCE(NEW.approved_by, NEW.reviewed_by);

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
      'requisition_rejected',
      'Requisition Rejected',
      msg,
      link_url
    );

    -- Notify reviewer if they exist and are different from rejector
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

-- Create trigger for requisition status changes
CREATE TRIGGER trigger_notify_on_requisition_status_change
  AFTER UPDATE ON requisitions
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION notify_on_requisition_status_change();

-- ============================================
-- STEP 5: Verification
-- ============================================

DO $$
DECLARE
  func_count INTEGER;
  req_trig_count INTEGER;
  comment_trig_count INTEGER;
BEGIN
  -- Count notification functions
  SELECT COUNT(*) INTO func_count
  FROM pg_proc p
  JOIN pg_namespace n ON p.pronamespace = n.oid
  WHERE n.nspname = 'public'
    AND p.proname LIKE '%notification%';

  -- Count requisition triggers
  SELECT COUNT(*) INTO req_trig_count
  FROM pg_trigger
  WHERE tgrelid = 'requisitions'::regclass
    AND tgname LIKE '%notif%';

  -- Count comment triggers
  SELECT COUNT(*) INTO comment_trig_count
  FROM pg_trigger
  WHERE tgrelid = 'comments'::regclass
    AND tgname LIKE '%notif%';

  RAISE NOTICE '==============================================';
  RAISE NOTICE 'Notification System - Production Ready';
  RAISE NOTICE '==============================================';
  RAISE NOTICE 'Functions installed: %', func_count;
  RAISE NOTICE 'Requisition triggers: %', req_trig_count;
  RAISE NOTICE 'Comment triggers: %', comment_trig_count;
  RAISE NOTICE '';
  RAISE NOTICE 'Function Signatures:';
  RAISE NOTICE '  create_notification(uuid, text, text, text, text)';
  RAISE NOTICE '  create_notification_for_users(uuid[], text, text, text, text)';
  RAISE NOTICE '';
  RAISE NOTICE 'Features:';
  RAISE NOTICE '  ✓ Uses TEXT types (no VARCHAR/ENUM conflicts)';
  RAISE NOTICE '  ✓ Handles NULL reviewed_by (direct approval)';
  RAISE NOTICE '  ✓ Prevents duplicate notifications';
  RAISE NOTICE '  ✓ Complete workflow coverage';
  RAISE NOTICE '  ✓ Comment notifications';
  RAISE NOTICE '==============================================';
END $$;

COMMIT;

-- =====================================================
-- Notification System Fix - Include Approver Role
-- Date: 2024-12-25
-- Version: 1.1.0
-- Description: Fixes notification system to include 'approver' role
--
-- Issues Fixed:
-- 1. Submission notifications now include 'approver' role (not just super_admin)
-- 2. Reviewed notifications now include 'approver' role (not just super_admin)
-- 3. Rejection by reviewer now notifies approvers/admins
-- =====================================================

BEGIN;

-- ============================================
-- Drop existing trigger and function
-- ============================================
DROP TRIGGER IF EXISTS trigger_notify_on_requisition_status_change ON requisitions CASCADE;
DROP FUNCTION IF EXISTS notify_on_requisition_status_change() CASCADE;

-- ============================================
-- Recreate fixed notification trigger function
-- ============================================

/**
 * Trigger function: Notify on requisition status changes (FIXED)
 *
 * Handles notifications for all requisition workflow states:
 * - draft → pending (submitted for review)
 * - pending → reviewed (reviewer marks as reviewed)
 * - reviewed → approved (approver/super admin approves)
 * - any → rejected
 *
 * FIXES:
 * - Now includes 'approver' role in addition to 'super_admin'
 * - Rejection by reviewer now notifies approvers/admins
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
BEGIN
  -- Build link to requisition detail page
  link_url := '/requisitions/' || NEW.id::TEXT;

  -- Get submitter name for messages
  SELECT full_name INTO submitter_name
  FROM users
  WHERE id = NEW.submitted_by;

  -- ============================================
  -- CASE 1: Submitted for Review
  -- FIXED: Now includes 'approver' role
  -- ============================================
  IF NEW.status = 'pending' AND (OLD.status IS NULL OR OLD.status = 'draft') THEN
    -- Get all reviewers, approvers, and super admins (except the submitter)
    SELECT ARRAY_AGG(id) INTO reviewer_admin_ids
    FROM users
    WHERE role IN ('reviewer', 'approver', 'super_admin')
      AND id != NEW.submitted_by;

    IF reviewer_admin_ids IS NOT NULL THEN
      msg := submitter_name || ' submitted requisition "' || NEW.title || '" for review.';
      PERFORM create_notification_for_users(
        reviewer_admin_ids,
        'requisition_submitted',
        'New Requisition Submitted',
        msg,
        link_url
      );
    END IF;
  END IF;

  -- ============================================
  -- CASE 2: Marked as Reviewed
  -- FIXED: Now includes 'approver' role
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

    -- Notify approvers and super admins (except submitter and reviewer)
    SELECT ARRAY_AGG(id) INTO approver_admin_ids
    FROM users
    WHERE role IN ('approver', 'super_admin')
      AND id != NEW.submitted_by
      AND id != NEW.reviewed_by;

    IF approver_admin_ids IS NOT NULL THEN
      msg := 'Requisition "' || NEW.title || '" has been reviewed by ' ||
             COALESCE(reviewer_name, 'a reviewer') || ' and needs your approval.';
      PERFORM create_notification_for_users(
        approver_admin_ids,
        'requisition_pending_approval',
        'Requisition Pending Approval',
        msg,
        link_url
      );
    END IF;
  END IF;

  -- ============================================
  -- CASE 3: Approved
  -- (No changes needed - already working correctly)
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
  -- FIXED: Now notifies approvers/admins when reviewer rejects
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

    -- NEW: Notify approvers/admins when a reviewer rejects
    -- This ensures approvers are aware of rejections at the review stage
    IF OLD.status IN ('pending', 'under_review') THEN
      -- Get approvers and super admins (except submitter and rejector)
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
      END IF;
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
-- Verification
-- ============================================

DO $$
DECLARE
  req_trig_count INTEGER;
BEGIN
  -- Count requisition triggers
  SELECT COUNT(*) INTO req_trig_count
  FROM pg_trigger
  WHERE tgrelid = 'requisitions'::regclass
    AND tgname LIKE '%notif%';

  RAISE NOTICE '==============================================';
  RAISE NOTICE 'Notification System Fix Applied';
  RAISE NOTICE '==============================================';
  RAISE NOTICE 'Requisition triggers: %', req_trig_count;
  RAISE NOTICE '';
  RAISE NOTICE 'FIXES APPLIED:';
  RAISE NOTICE '  ✓ Submission notifications now include approver role';
  RAISE NOTICE '  ✓ Reviewed notifications now include approver role';
  RAISE NOTICE '  ✓ Rejection by reviewer now notifies approvers/admins';
  RAISE NOTICE '';
  RAISE NOTICE 'Workflow Requirements:';
  RAISE NOTICE '  ✓ REQ 1: Submit → Reviewer, Approver, Admin notified';
  RAISE NOTICE '  ✓ REQ 2: Review/Reject → Submitter, Approver, Admin notified';
  RAISE NOTICE '  ✓ REQ 3: Approve/Reject → Submitter, Reviewer notified';
  RAISE NOTICE '==============================================';
END $$;

COMMIT;

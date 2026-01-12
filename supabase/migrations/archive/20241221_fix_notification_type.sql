-- =====================================================
-- Fix Notification Type Column
-- Date: 2024-12-21
-- Description: Fix the type mismatch for the 'type' column in notifications table
-- =====================================================

BEGIN;

-- Step 1: Drop the type column if it exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'notifications' AND column_name = 'type'
  ) THEN
    ALTER TABLE notifications DROP COLUMN type;
    RAISE NOTICE 'Dropped existing type column';
  END IF;
END $$;

-- Step 2: Drop the custom enum type if it exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'notification_type') THEN
    DROP TYPE notification_type CASCADE;
    RAISE NOTICE 'Dropped notification_type enum';
  END IF;
END $$;

-- Step 3: Add the type column as VARCHAR (to match our functions)
ALTER TABLE notifications ADD COLUMN type VARCHAR(50) NOT NULL DEFAULT 'info';

-- Step 4: Recreate the helper functions to ensure they use the correct type
CREATE OR REPLACE FUNCTION create_notification(
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

CREATE OR REPLACE FUNCTION create_notification_for_users(
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

-- Step 5: Recreate triggers to ensure they work with the fixed type
DROP TRIGGER IF EXISTS trigger_notify_on_requisition_submitted ON requisitions;
DROP TRIGGER IF EXISTS trigger_notify_on_requisition_reviewed ON requisitions;

CREATE OR REPLACE FUNCTION notify_on_requisition_submitted()
RETURNS TRIGGER AS $$
DECLARE
  submitter_name TEXT;
  reviewer_ids UUID[];
BEGIN
  -- Only trigger when moving from draft to pending
  IF NEW.status = 'pending' AND OLD.status = 'draft' THEN
    -- Get submitter name
    SELECT full_name INTO submitter_name
    FROM users
    WHERE id = NEW.submitted_by;

    -- Get all reviewers and super admins
    SELECT ARRAY_AGG(id) INTO reviewer_ids
    FROM users
    WHERE role IN ('reviewer', 'super_admin')
      AND id != NEW.submitted_by;

    -- Create notifications for all reviewers
    IF reviewer_ids IS NOT NULL THEN
      PERFORM create_notification_for_users(
        reviewer_ids,
        'requisition_submitted',
        'New Requisition Submitted',
        submitter_name || ' submitted requisition "' || NEW.title || '" for review.',
        '/requisitions/' || NEW.id
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_notify_on_requisition_submitted
  AFTER UPDATE ON requisitions
  FOR EACH ROW
  EXECUTE FUNCTION notify_on_requisition_submitted();

CREATE OR REPLACE FUNCTION notify_on_requisition_reviewed()
RETURNS TRIGGER AS $$
DECLARE
  reviewer_name TEXT;
BEGIN
  -- Notify when requisition is approved or rejected
  IF NEW.status IN ('approved', 'rejected') AND OLD.status != NEW.status THEN
    -- Get reviewer name
    SELECT full_name INTO reviewer_name
    FROM users
    WHERE id = COALESCE(NEW.approved_by, NEW.reviewed_by);

    -- Notify submitter
    PERFORM create_notification(
      NEW.submitted_by,
      CASE
        WHEN NEW.status = 'approved' THEN 'requisition_approved'
        ELSE 'requisition_rejected'
      END,
      CASE
        WHEN NEW.status = 'approved' THEN 'Requisition Approved'
        ELSE 'Requisition Rejected'
      END,
      'Your requisition "' || NEW.title || '" has been ' || NEW.status ||
      CASE
        WHEN reviewer_name IS NOT NULL THEN ' by ' || reviewer_name
        ELSE ''
      END || '.',
      '/requisitions/' || NEW.id
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_notify_on_requisition_reviewed
  AFTER UPDATE ON requisitions
  FOR EACH ROW
  EXECUTE FUNCTION notify_on_requisition_reviewed();

-- Add comment
COMMENT ON COLUMN notifications.type IS 'Type of notification: requisition_approved, requisition_rejected, requisition_submitted, budget_alert, info, etc.';

-- Success message
DO $$
BEGIN
  RAISE NOTICE '==============================================';
  RAISE NOTICE 'Notification Type Fixed Successfully';
  RAISE NOTICE 'Column type changed from ENUM to VARCHAR';
  RAISE NOTICE 'All triggers recreated';
  RAISE NOTICE '==============================================';
END $$;

COMMIT;

-- =====================================================
-- Notifications System - Repair Script
-- Date: 2024-12-21
-- Description: Fixes incomplete notifications table by adding missing columns and objects
-- =====================================================

BEGIN;

-- First, let's ensure the table exists and add any missing columns
DO $$
BEGIN
  -- Add 'link' column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'notifications' AND column_name = 'link'
  ) THEN
    ALTER TABLE notifications ADD COLUMN link VARCHAR(500);
    RAISE NOTICE 'Added missing column: link';
  END IF;

  -- Add 'type' column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'notifications' AND column_name = 'type'
  ) THEN
    ALTER TABLE notifications ADD COLUMN type VARCHAR(50) NOT NULL DEFAULT 'info';
    RAISE NOTICE 'Added missing column: type';
  END IF;

  -- Add 'title' column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'notifications' AND column_name = 'title'
  ) THEN
    ALTER TABLE notifications ADD COLUMN title VARCHAR(255) NOT NULL DEFAULT 'Notification';
    RAISE NOTICE 'Added missing column: title';
  END IF;

  -- Add 'message' column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'notifications' AND column_name = 'message'
  ) THEN
    ALTER TABLE notifications ADD COLUMN message TEXT NOT NULL DEFAULT '';
    RAISE NOTICE 'Added missing column: message';
  END IF;

  -- Add 'is_read' column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'notifications' AND column_name = 'is_read'
  ) THEN
    ALTER TABLE notifications ADD COLUMN is_read BOOLEAN NOT NULL DEFAULT false;
    RAISE NOTICE 'Added missing column: is_read';
  END IF;

  -- Add 'read_at' column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'notifications' AND column_name = 'read_at'
  ) THEN
    ALTER TABLE notifications ADD COLUMN read_at TIMESTAMP WITH TIME ZONE;
    RAISE NOTICE 'Added missing column: read_at';
  END IF;

  -- Add 'created_at' column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'notifications' AND column_name = 'created_at'
  ) THEN
    ALTER TABLE notifications ADD COLUMN created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW();
    RAISE NOTICE 'Added missing column: created_at';
  END IF;

  -- Add 'updated_at' column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'notifications' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE notifications ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW();
    RAISE NOTICE 'Added missing column: updated_at';
  END IF;
END $$;

-- Create indexes if they don't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_notifications_user_id') THEN
    CREATE INDEX idx_notifications_user_id ON notifications(user_id);
    RAISE NOTICE 'Created index: idx_notifications_user_id';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_notifications_is_read') THEN
    CREATE INDEX idx_notifications_is_read ON notifications(is_read);
    RAISE NOTICE 'Created index: idx_notifications_is_read';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_notifications_created_at') THEN
    CREATE INDEX idx_notifications_created_at ON notifications(created_at DESC);
    RAISE NOTICE 'Created index: idx_notifications_created_at';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_notifications_user_unread') THEN
    CREATE INDEX idx_notifications_user_unread ON notifications(user_id, is_read) WHERE is_read = false;
    RAISE NOTICE 'Created index: idx_notifications_user_unread';
  END IF;
END $$;

-- Enable RLS
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view their own notifications" ON notifications;
DROP POLICY IF EXISTS "Users can update their own notifications" ON notifications;
DROP POLICY IF EXISTS "Users can delete their own notifications" ON notifications;
DROP POLICY IF EXISTS "System can insert notifications" ON notifications;

-- Create RLS Policies
CREATE POLICY "Users can view their own notifications"
  ON notifications FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own notifications"
  ON notifications FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own notifications"
  ON notifications FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "System can insert notifications"
  ON notifications FOR INSERT
  WITH CHECK (true);

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS update_notifications_updated_at ON notifications;

-- Create updated timestamp trigger
CREATE TRIGGER update_notifications_updated_at
  BEFORE UPDATE ON notifications
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Helper function to create notifications
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

-- Helper function to create notification for multiple users
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

-- Drop existing triggers if they exist
DROP TRIGGER IF EXISTS trigger_notify_on_requisition_submitted ON requisitions;
DROP TRIGGER IF EXISTS trigger_notify_on_requisition_reviewed ON requisitions;

-- Trigger: Notify reviewers when requisition is submitted
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

-- Trigger: Notify submitter when requisition is approved/rejected
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

-- Add comments
COMMENT ON TABLE notifications IS 'In-app notifications for users';
COMMENT ON COLUMN notifications.type IS 'Type of notification: requisition_approved, requisition_rejected, budget_alert, etc.';
COMMENT ON COLUMN notifications.link IS 'Optional link to related resource (e.g., /requisitions/123)';

-- Success message
DO $$
BEGIN
  RAISE NOTICE '==============================================';
  RAISE NOTICE 'Notifications System Repaired Successfully';
  RAISE NOTICE 'Table: notifications (repaired)';
  RAISE NOTICE 'All missing columns added';
  RAISE NOTICE 'Auto-notifications enabled for requisitions';
  RAISE NOTICE '==============================================';
END $$;

COMMIT;

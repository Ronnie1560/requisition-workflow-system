-- Migration: Fix create_notification function column reference
-- Date: 2026-02-25
-- Description: The create_notification function referenced 'related_requisition_id'
--   which does not exist on the notifications table. The correct columns are
--   'related_table' (varchar) and 'related_id' (uuid).
-- Error: column "related_requisition_id" of relation "notifications" does not exist (42703)

-- Drop the broken function first (parameter name changed, so CREATE OR REPLACE won't work)
DROP FUNCTION IF EXISTS create_notification(UUID, VARCHAR, TEXT, VARCHAR, UUID);

-- Recreate with correct column references
CREATE OR REPLACE FUNCTION create_notification(
  p_user_id UUID,
  p_title VARCHAR(255),
  p_message TEXT,
  p_type VARCHAR(50) DEFAULT 'info',
  p_related_id UUID DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  notif_id UUID;
BEGIN
  INSERT INTO public.notifications (
    user_id,
    title,
    message,
    type,
    related_table,
    related_id
  )
  VALUES (
    p_user_id,
    p_title,
    p_message,
    p_type::public.notification_type,
    CASE WHEN p_related_id IS NOT NULL THEN 'requisitions' ELSE NULL END,
    p_related_id
  )
  RETURNING id INTO notif_id;

  RETURN notif_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = '';

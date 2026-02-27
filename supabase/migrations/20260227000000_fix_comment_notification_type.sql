-- ============================================================
-- Fix: "public.notification_type" does not exist error
-- ============================================================
-- The notify_new_comment trigger calls create_notification()
-- which has two overloaded signatures. The older signature
-- (varchar params) casts p_type::public.notification_type but
-- that enum was removed during the workflow_role migration.
--
-- The newer signature (text params) works correctly without
-- any cast. Dropping the broken overload forces all calls to
-- use the working version.
-- ============================================================

-- Drop the broken overload that references notification_type enum
DROP FUNCTION IF EXISTS public.create_notification(
  uuid,           -- p_user_id
  character varying,  -- p_title
  text,           -- p_message
  character varying,  -- p_type
  uuid            -- p_related_id
);

-- Update notify_new_comment to match the remaining create_notification
-- signature: (uuid, text, text, text, text)
-- Pass a proper link path instead of raw UUID for the 5th param
CREATE OR REPLACE FUNCTION public.notify_new_comment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_requisition_submitter UUID;
  v_requisition_number VARCHAR(50);
  v_commenter_name TEXT;
BEGIN
  -- Skip internal/system comments
  IF NEW.is_internal = true THEN
    RETURN NEW;
  END IF;

  -- Get requisition info
  SELECT r.submitted_by, r.requisition_number
  INTO v_requisition_submitter, v_requisition_number
  FROM public.requisitions r
  WHERE r.id = NEW.requisition_id;

  -- Get commenter name
  SELECT full_name INTO v_commenter_name
  FROM public.users
  WHERE id = NEW.user_id;

  -- Notify the requisition submitter (if not the commenter)
  IF v_requisition_submitter IS NOT NULL AND v_requisition_submitter != NEW.user_id THEN
    PERFORM public.create_notification(
      v_requisition_submitter,
      'comment_added'::text,
      'New Comment on Your Requisition'::text,
      format('%s commented on requisition %s', v_commenter_name, v_requisition_number)::text,
      '/requisitions/' || NEW.requisition_id::text
    );
  END IF;

  RETURN NEW;
END;
$$;

-- Verify: only the working signature remains
DO $$
DECLARE
  fn_count INT;
BEGIN
  SELECT COUNT(*) INTO fn_count
  FROM pg_proc
  WHERE proname = 'create_notification'
    AND pronamespace = 'public'::regnamespace;

  RAISE NOTICE 'Remaining create_notification overloads: %', fn_count;

  IF fn_count = 1 THEN
    RAISE NOTICE 'OK: Only the working (text params) version remains';
  ELSE
    RAISE WARNING 'Unexpected: % overloads remain, expected 1', fn_count;
  END IF;
END $$;

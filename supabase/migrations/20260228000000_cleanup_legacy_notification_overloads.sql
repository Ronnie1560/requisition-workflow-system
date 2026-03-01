-- ============================================================
-- Cleanup: Remove legacy notification function overloads
-- ============================================================
-- The 5-param create_notification (without org_id) relied on
-- set_org_id_trigger to populate org_id, which is fragile in
-- SECURITY DEFINER context. All callers now use the 6-param
-- version with explicit org_id. Drop the old overloads.
-- ============================================================

BEGIN;

-- ============================================================
-- 1. Drop legacy 5-param create_notification
-- ============================================================
DROP FUNCTION IF EXISTS public.create_notification(UUID, TEXT, TEXT, TEXT, TEXT);

-- ============================================================
-- 2. Drop legacy 5-param create_notification_for_users
-- ============================================================
DROP FUNCTION IF EXISTS public.create_notification_for_users(UUID[], TEXT, TEXT, TEXT, TEXT);

-- ============================================================
-- 3. Create org-aware create_notification_for_users
-- ============================================================
CREATE OR REPLACE FUNCTION public.create_notification_for_users(
  p_user_ids UUID[],
  p_type TEXT,
  p_title TEXT,
  p_message TEXT,
  p_link TEXT,
  p_org_id UUID
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  created_count INTEGER := 0;
  uid UUID;
BEGIN
  FOREACH uid IN ARRAY p_user_ids
  LOOP
    PERFORM create_notification(uid, p_type, p_title, p_message, p_link, p_org_id);
    created_count := created_count + 1;
  END LOOP;

  RETURN created_count;
END;
$$;

COMMENT ON FUNCTION create_notification(UUID, TEXT, TEXT, TEXT, TEXT, UUID) IS
  'Creates a notification for a single user with explicit org_id';
COMMENT ON FUNCTION create_notification_for_users(UUID[], TEXT, TEXT, TEXT, TEXT, UUID) IS
  'Creates the same notification for multiple users with explicit org_id';

-- ============================================================
-- 4. Verify only org-aware versions remain
-- ============================================================
DO $$
DECLARE
  fn_record RECORD;
  count_5param INT := 0;
BEGIN
  FOR fn_record IN
    SELECT p.proname, pg_get_function_arguments(p.oid) as args
    FROM pg_proc p
    WHERE p.proname IN ('create_notification', 'create_notification_for_users')
      AND p.pronamespace = 'public'::regnamespace
  LOOP
    RAISE NOTICE '  %(%)', fn_record.proname, fn_record.args;
    -- Check if any overload is missing p_org_id
    IF fn_record.args NOT LIKE '%org_id%' THEN
      count_5param := count_5param + 1;
    END IF;
  END LOOP;

  IF count_5param = 0 THEN
    RAISE NOTICE 'OK: All notification functions now require explicit org_id';
  ELSE
    RAISE WARNING 'Found % function(s) without org_id parameter', count_5param;
  END IF;
END $$;

COMMIT;

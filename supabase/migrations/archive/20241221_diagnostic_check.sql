-- =====================================================
-- Diagnostic Check for Notification System
-- Date: 2024-12-21
-- Description: Check current state of notification functions and triggers
-- =====================================================

-- Check if create_notification function exists and its signature
SELECT
  p.proname as function_name,
  pg_get_function_arguments(p.oid) as arguments,
  pg_get_function_result(p.oid) as return_type
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND p.proname LIKE '%notification%'
ORDER BY p.proname;

-- Check triggers on requisitions table
SELECT
  tgname as trigger_name,
  tgtype,
  tgenabled as enabled,
  pg_get_triggerdef(oid) as definition
FROM pg_trigger
WHERE tgrelid = 'requisitions'::regclass
  AND tgname LIKE '%notif%'
ORDER BY tgname;

-- Check notifications table structure
SELECT
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'notifications'
ORDER BY ordinal_position;

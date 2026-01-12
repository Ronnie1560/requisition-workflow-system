-- Check receipt_items policies
SELECT
  policyname,
  cmd as action,
  roles,
  qual as using_clause,
  with_check as with_check_clause,
  permissive
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'receipt_items'
ORDER BY cmd, policyname;

-- Check receipt_transactions policies
SELECT
  policyname,
  cmd as action,
  roles,
  qual as using_clause,
  with_check as with_check_clause,
  permissive
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'receipt_transactions'
ORDER BY cmd, policyname;

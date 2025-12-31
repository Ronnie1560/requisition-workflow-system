-- Check purchase_orders policies for dashboard_user role
SELECT
  policyname,
  cmd as action,
  roles,
  qual as using_clause,
  with_check as with_check_clause,
  permissive
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'purchase_orders'
  AND 'dashboard_user' = ANY(roles)
ORDER BY cmd, policyname;

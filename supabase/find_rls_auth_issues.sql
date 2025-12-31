-- =====================================================
-- Find RLS Policies with Auth Initialization Issues
-- Policies that call auth.uid() without SELECT wrapper
-- =====================================================

SELECT
  schemaname,
  tablename,
  policyname,
  cmd as action,
  CASE
    WHEN qual LIKE '%auth.uid()%' AND qual NOT LIKE '%(SELECT auth.uid()%' THEN '❌ USING needs fix'
    WHEN qual LIKE '%(SELECT auth.uid()%' THEN '✅ USING optimized'
    ELSE '➖ No auth.uid() in USING'
  END as using_status,
  CASE
    WHEN with_check LIKE '%auth.uid()%' AND with_check NOT LIKE '%(SELECT auth.uid()%' THEN '❌ WITH CHECK needs fix'
    WHEN with_check LIKE '%(SELECT auth.uid()%' THEN '✅ WITH CHECK optimized'
    ELSE '➖ No auth.uid() in WITH CHECK'
  END as with_check_status,
  qual as using_clause,
  with_check as with_check_clause
FROM pg_policies
WHERE schemaname = 'public'
  AND (
    (qual LIKE '%auth.uid()%' AND qual NOT LIKE '%(SELECT auth.uid()%')
    OR
    (with_check LIKE '%auth.uid()%' AND with_check NOT LIKE '%(SELECT auth.uid()%')
  )
ORDER BY tablename, policyname;

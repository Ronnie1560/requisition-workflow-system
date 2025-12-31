-- =====================================================
-- Fix SECURITY DEFINER Views
-- Date: 2024-12-31
-- Issue: Views with SECURITY DEFINER bypass RLS policies
-- =====================================================

-- Convert users_with_assignments view to SECURITY INVOKER
-- This ensures the view respects the querying user's RLS policies
-- instead of the view creator's permissions

ALTER VIEW users_with_assignments SET (security_invoker = true);

-- Verify the fix
SELECT
  n.nspname || '.' || c.relname AS view_name,
  CASE
    WHEN c.reloptions IS NOT NULL AND 'security_invoker=true' = ANY(c.reloptions) THEN '✅ SECURITY INVOKER'
    ELSE '❌ SECURITY DEFINER'
  END AS security_status
FROM pg_catalog.pg_class c
JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
WHERE c.relkind = 'v'
  AND n.nspname = 'public'
  AND c.relname = 'users_with_assignments';

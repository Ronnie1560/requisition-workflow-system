-- =====================================================
-- Move pg_net Extension to Dedicated Schema
-- Date: 2024-12-31
-- Issue: Extension pg_net is installed in public schema
-- =====================================================

-- Best practice: Extensions should be in their own schema, not 'public'
-- This improves security and organization

-- Step 1: Create extensions schema if it doesn't exist
CREATE SCHEMA IF NOT EXISTS extensions;

-- Step 2: Move pg_net extension to extensions schema
-- Note: We need to drop and recreate the extension in the new schema
-- This is safe because pg_net doesn't store data, it just provides functions

-- Check if pg_net exists in public schema
DO $$
DECLARE
  ext_version TEXT;
BEGIN
  -- Get current pg_net version if it exists
  SELECT extversion INTO ext_version
  FROM pg_extension e
  JOIN pg_namespace n ON n.oid = e.extnamespace
  WHERE e.extname = 'pg_net'
    AND n.nspname = 'public';

  IF ext_version IS NOT NULL THEN
    RAISE NOTICE 'Found pg_net version % in public schema', ext_version;

    -- Drop from public schema (CASCADE removes dependent objects)
    DROP EXTENSION pg_net CASCADE;
    RAISE NOTICE 'Dropped pg_net from public schema';

    -- Create in extensions schema
    CREATE EXTENSION pg_net SCHEMA extensions;
    RAISE NOTICE 'Created pg_net in extensions schema';

    RAISE NOTICE 'Successfully moved pg_net extension';
  ELSE
    RAISE NOTICE 'pg_net extension not found in public schema (may already be moved)';
  END IF;
END $$;

-- Step 3: Grant necessary permissions
GRANT USAGE ON SCHEMA extensions TO postgres, anon, authenticated, service_role;

-- Step 4: Verify the fix
SELECT
  e.extname as extension_name,
  n.nspname as schema_name,
  CASE
    WHEN n.nspname = 'public' THEN '❌ In public schema'
    ELSE '✅ In dedicated schema'
  END as status
FROM pg_extension e
JOIN pg_namespace n ON n.oid = e.extnamespace
WHERE e.extname = 'pg_net';

-- =====================================================
-- FIX: organization_members foreign key to users table
-- Ensures PostgREST can detect the relationship for queries
-- =====================================================

-- Drop existing constraint if it exists (to recreate it properly)
DO $$
BEGIN
  -- Check if constraint exists and drop it
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'organization_members_user_id_fkey'
    AND table_name = 'organization_members'
  ) THEN
    ALTER TABLE organization_members DROP CONSTRAINT organization_members_user_id_fkey;
  END IF;
END $$;

-- Recreate the foreign key constraint
-- This ensures PostgREST can auto-detect the relationship
ALTER TABLE organization_members
  ADD CONSTRAINT organization_members_user_id_fkey
  FOREIGN KEY (user_id)
  REFERENCES users(id)
  ON DELETE CASCADE;

-- Verify the foreign key exists
SELECT
  'Foreign key constraint created' as status,
  tc.constraint_name,
  tc.table_name,
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
  AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_name = 'organization_members'
  AND kcu.column_name = 'user_id';

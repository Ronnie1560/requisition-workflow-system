-- =====================================================
-- FIX: fiscal_year_settings - Remove global unique constraint for multi-tenancy
-- The table had a constraint allowing only ONE record globally
-- This needs to be changed to allow one record PER ORGANIZATION
-- =====================================================

-- Drop the old global unique constraint
DROP INDEX IF EXISTS single_fiscal_settings;

-- Add org_id column if it doesn't exist (should already exist from multi-tenancy migration)
ALTER TABLE fiscal_year_settings ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES organizations(id) ON DELETE CASCADE;

-- Create index on org_id for performance
CREATE INDEX IF NOT EXISTS idx_fiscal_year_settings_org ON fiscal_year_settings(org_id);

-- Add unique constraint: one fiscal year setting per organization
-- This allows multiple records (one per org) instead of just one global record
CREATE UNIQUE INDEX IF NOT EXISTS unique_fiscal_settings_per_org ON fiscal_year_settings(org_id);

-- Verify the fix
SELECT
  'Fiscal year settings constraint fixed' as status,
  COUNT(*) as total_records,
  COUNT(DISTINCT org_id) as organizations_with_settings
FROM fiscal_year_settings;

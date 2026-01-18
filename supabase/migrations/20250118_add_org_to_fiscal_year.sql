-- Migration: Add org_id to fiscal_year_settings
-- Date: 2026-01-18
-- Description: Make fiscal year settings organization-specific instead of system-wide

-- Step 1: Drop the unique constraint that forces a single row
DROP INDEX IF EXISTS single_fiscal_settings;

-- Step 2: Add org_id column (nullable initially for existing data)
ALTER TABLE fiscal_year_settings
ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES organizations(id) ON DELETE CASCADE;

-- Step 3: Create index for org_id lookups
CREATE INDEX IF NOT EXISTS idx_fiscal_year_org ON fiscal_year_settings(org_id);

-- Step 4: Create unique constraint - one fiscal year setting per organization
CREATE UNIQUE INDEX IF NOT EXISTS unique_fiscal_year_per_org ON fiscal_year_settings(org_id);

-- Step 5: Update any existing fiscal year settings to use the first organization
-- (This is a one-time migration for existing data)
DO $$
DECLARE
  first_org_id UUID;
BEGIN
  -- Get the first organization ID
  SELECT id INTO first_org_id FROM organizations ORDER BY created_at LIMIT 1;

  -- If there are fiscal year settings without org_id, assign them to the first org
  IF first_org_id IS NOT NULL THEN
    UPDATE fiscal_year_settings
    SET org_id = first_org_id
    WHERE org_id IS NULL;
  END IF;
END $$;

-- Step 6: Make org_id NOT NULL after migration
ALTER TABLE fiscal_year_settings
ALTER COLUMN org_id SET NOT NULL;

-- Add comment
COMMENT ON TABLE fiscal_year_settings IS 'Organization-specific fiscal year settings. Each organization can have different fiscal year start dates.';

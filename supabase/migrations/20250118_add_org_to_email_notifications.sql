-- Migration: Add org_id to email_notifications table
-- Date: 2026-01-18
-- Description: Make email notifications organization-specific for proper multi-tenancy

-- Step 1: Add org_id column (nullable initially for existing data)
ALTER TABLE email_notifications
ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES organizations(id) ON DELETE CASCADE;

-- Step 2: Create index for org_id lookups
CREATE INDEX IF NOT EXISTS idx_email_notifications_org ON email_notifications(org_id);

-- Step 3: Update existing records to use requisition's org_id
UPDATE email_notifications en
SET org_id = r.org_id
FROM requisitions r
WHERE en.related_requisition_id = r.id
AND en.org_id IS NULL;

-- Step 4: For any remaining records without org_id, assign to first organization
-- (This handles edge cases where related_requisition_id might be NULL)
DO $$
DECLARE
  first_org_id UUID;
BEGIN
  -- Get the first organization ID
  SELECT id INTO first_org_id FROM organizations ORDER BY created_at LIMIT 1;

  -- Update any remaining email notifications without org_id
  IF first_org_id IS NOT NULL THEN
    UPDATE email_notifications
    SET org_id = first_org_id
    WHERE org_id IS NULL;
  END IF;
END $$;

-- Step 5: Make org_id NOT NULL after migration
ALTER TABLE email_notifications
ALTER COLUMN org_id SET NOT NULL;

-- Add comment
COMMENT ON COLUMN email_notifications.org_id IS 'Organization that triggered this email notification';

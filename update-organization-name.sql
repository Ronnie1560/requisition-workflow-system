-- Update organization name to PASSION CHRISTIAN MINISTRIES
UPDATE organization_settings
SET
  organization_name = 'PASSION CHRISTIAN MINISTRIES',
  updated_at = NOW()
WHERE true;

-- Verify the update
SELECT organization_name, updated_at
FROM organization_settings;

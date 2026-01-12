-- =====================================================
-- Fix: Initialize organization_settings for item code generation
-- =====================================================

-- Ensure organization_settings has at least one row with item code settings
INSERT INTO organization_settings (
  organization_name,
  item_code_prefix,
  item_code_next_number,
  item_code_padding,
  created_at,
  updated_at
)
SELECT
  'Your Organization',
  'ITEM',
  1,
  3,
  NOW(),
  NOW()
WHERE NOT EXISTS (SELECT 1 FROM organization_settings);

-- If organization_settings exists but doesn't have item code columns populated
UPDATE organization_settings
SET
  item_code_prefix = COALESCE(item_code_prefix, 'ITEM'),
  item_code_next_number = COALESCE(item_code_next_number, 1),
  item_code_padding = COALESCE(item_code_padding, 3)
WHERE item_code_prefix IS NULL
   OR item_code_next_number IS NULL
   OR item_code_padding IS NULL;

-- Initialize counter based on existing ITEM-XXX codes
DO $$
DECLARE
  max_number INTEGER;
BEGIN
  -- Find the highest number in existing ITEM-XXX codes
  SELECT COALESCE(MAX(
    CASE
      WHEN code ~ '^ITEM-[0-9]+$'
      THEN CAST(SUBSTRING(code FROM 6) AS INTEGER)
      ELSE 0
    END
  ), 0) + 1
  INTO max_number
  FROM items;

  -- Set the next number if it's higher than current
  UPDATE organization_settings
  SET item_code_next_number = GREATEST(item_code_next_number, max_number);
END $$;

-- Test the function
SELECT generate_item_code() as test_code;

-- =====================================================
-- Fix: Update generate_item_code() function to include WHERE clause
-- =====================================================

CREATE OR REPLACE FUNCTION generate_item_code()
RETURNS VARCHAR(50)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_prefix VARCHAR(10);
  v_next_number INTEGER;
  v_padding INTEGER;
  v_new_code VARCHAR(50);
  v_settings_id UUID;
BEGIN
  -- Get settings from organization_settings
  SELECT
    id,
    COALESCE(item_code_prefix, 'ITEM'),
    COALESCE(item_code_next_number, 1),
    COALESCE(item_code_padding, 3)
  INTO v_settings_id, v_prefix, v_next_number, v_padding
  FROM organization_settings
  LIMIT 1;

  -- If no settings found, raise an exception
  IF v_settings_id IS NULL THEN
    RAISE EXCEPTION 'No organization_settings found. Please initialize the settings first.';
  END IF;

  -- Generate code with padding
  v_new_code := v_prefix || '-' || LPAD(v_next_number::TEXT, v_padding, '0');

  -- Increment the counter (with WHERE clause)
  UPDATE organization_settings
  SET item_code_next_number = v_next_number + 1,
      updated_at = NOW()
  WHERE id = v_settings_id;

  RETURN v_new_code;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION generate_item_code() TO authenticated;
GRANT EXECUTE ON FUNCTION generate_item_code() TO service_role;

-- Test the function
SELECT generate_item_code() as test_result;

-- =====================================================
-- Fix: Change global UNIQUE constraints on code columns
-- to per-organization UNIQUE constraints (org_id, code)
--
-- Problem: categories.code, items.code, uom_types.code,
-- and categories.name all have global UNIQUE constraints.
-- In a multi-tenant system, each org should independently
-- use codes like "CAT-001" without colliding with other orgs.
--
-- Also fixes: generate_item_code() to scope by org_id
-- =====================================================

-- 1. categories.code: global UNIQUE → per-org UNIQUE
ALTER TABLE categories DROP CONSTRAINT IF EXISTS categories_code_key;
CREATE UNIQUE INDEX IF NOT EXISTS categories_org_code_unique ON categories(org_id, code);

-- 2. categories.name: global UNIQUE → per-org UNIQUE
ALTER TABLE categories DROP CONSTRAINT IF EXISTS categories_name_key;
CREATE UNIQUE INDEX IF NOT EXISTS categories_org_name_unique ON categories(org_id, name);

-- 3. items.code: global UNIQUE → per-org UNIQUE
ALTER TABLE items DROP CONSTRAINT IF EXISTS items_code_key;
CREATE UNIQUE INDEX IF NOT EXISTS items_org_code_unique ON items(org_id, code);

-- 4. uom_types.code: global UNIQUE → per-org UNIQUE
ALTER TABLE uom_types DROP CONSTRAINT IF EXISTS uom_types_code_key;
CREATE UNIQUE INDEX IF NOT EXISTS uom_types_org_code_unique ON uom_types(org_id, code);

-- 5. Fix generate_item_code() to scope by caller's org_id
CREATE OR REPLACE FUNCTION generate_item_code(p_category_id UUID DEFAULT NULL)
RETURNS VARCHAR
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  prefix VARCHAR(10);
  next_num INTEGER;
  padding INTEGER;
  new_code VARCHAR(50);
  category_code VARCHAR(50);
  caller_org_id UUID;
BEGIN
  -- Get the caller's org_id from their user profile
  SELECT org_id INTO caller_org_id
  FROM users
  WHERE id = auth.uid();

  IF caller_org_id IS NULL THEN
    RAISE EXCEPTION 'User does not belong to an organization';
  END IF;

  -- Get organization settings scoped to caller's org
  SELECT
    COALESCE(item_code_prefix, 'ITEM'),
    COALESCE(item_code_next_number, 1),
    COALESCE(item_code_padding, 3)
  INTO prefix, next_num, padding
  FROM organization_settings
  WHERE org_id = caller_org_id
  LIMIT 1;

  -- Fallback if no settings found
  IF prefix IS NULL THEN
    prefix := 'ITEM';
    next_num := 1;
    padding := 3;
  END IF;

  -- If category provided, use category code as prefix
  IF p_category_id IS NOT NULL THEN
    SELECT code INTO category_code
    FROM categories
    WHERE id = p_category_id AND org_id = caller_org_id;

    IF category_code IS NOT NULL THEN
      prefix := category_code;
    END IF;
  END IF;

  -- Generate code with padding
  new_code := prefix || '-' || LPAD(next_num::TEXT, padding, '0');

  -- Increment counter (scoped to org)
  UPDATE organization_settings
  SET item_code_next_number = next_num + 1,
      updated_at = NOW()
  WHERE org_id = caller_org_id;

  RETURN new_code;
END;
$$;

GRANT EXECUTE ON FUNCTION generate_item_code(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION generate_item_code(UUID) TO service_role;

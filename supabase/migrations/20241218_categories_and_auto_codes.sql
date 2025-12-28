-- =====================================================
-- Categories and Auto Item Code Generation
-- =====================================================

-- =====================================================
-- TABLE: categories
-- Master list of item categories
-- =====================================================
CREATE TABLE categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code VARCHAR(50) NOT NULL UNIQUE,
  name VARCHAR(100) NOT NULL UNIQUE,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add indexes
CREATE INDEX idx_categories_code ON categories(code);
CREATE INDEX idx_categories_is_active ON categories(is_active);

-- =====================================================
-- Migrate existing categories from items table
-- =====================================================
-- Insert unique categories from items table into categories table
INSERT INTO categories (code, name, is_active, created_at)
SELECT
  UPPER(REPLACE(REPLACE(category, ' ', '_'), '-', '_')) as code,
  category as name,
  true as is_active,
  NOW() as created_at
FROM (
  SELECT DISTINCT category
  FROM items
  WHERE category IS NOT NULL AND category != ''
) AS distinct_categories
ON CONFLICT (code) DO NOTHING;

-- =====================================================
-- Update items table to use category_id
-- =====================================================
-- Add new category_id column
ALTER TABLE items ADD COLUMN category_id UUID REFERENCES categories(id);

-- Migrate data: Link existing category text to category_id
UPDATE items
SET category_id = categories.id
FROM categories
WHERE items.category = categories.name;

-- Add index for category_id
CREATE INDEX idx_items_category_id ON items(category_id);

-- Optional: Keep old category column for now (can be removed later)
-- ALTER TABLE items DROP COLUMN category;

-- =====================================================
-- Item Code Auto-Generation System
-- =====================================================
-- Add item code settings to organization_settings table
ALTER TABLE organization_settings
ADD COLUMN IF NOT EXISTS item_code_prefix VARCHAR(10) DEFAULT 'ITEM',
ADD COLUMN IF NOT EXISTS item_code_next_number INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS item_code_padding INTEGER DEFAULT 3;

-- Function to generate next item code
CREATE OR REPLACE FUNCTION generate_item_code()
RETURNS VARCHAR(50) AS $$
DECLARE
  v_prefix VARCHAR(10);
  v_next_number INTEGER;
  v_padding INTEGER;
  v_new_code VARCHAR(50);
BEGIN
  -- Get settings from organization_settings
  SELECT
    COALESCE(item_code_prefix, 'ITEM'),
    COALESCE(item_code_next_number, 1),
    COALESCE(item_code_padding, 3)
  INTO v_prefix, v_next_number, v_padding
  FROM organization_settings
  LIMIT 1;

  -- Generate code with padding
  v_new_code := v_prefix || '-' || LPAD(v_next_number::TEXT, v_padding, '0');

  -- Increment the counter
  UPDATE organization_settings
  SET item_code_next_number = v_next_number + 1,
      updated_at = NOW();

  RETURN v_new_code;
END;
$$ LANGUAGE plpgsql;

-- Function to set custom next item number (for admin use)
CREATE OR REPLACE FUNCTION set_next_item_code_number(next_num INTEGER)
RETURNS VOID AS $$
BEGIN
  UPDATE organization_settings
  SET item_code_next_number = next_num,
      updated_at = NOW();
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- Update existing items to have sequential codes
-- (Only for items that don't follow the pattern)
-- =====================================================
-- Note: This is commented out to preserve existing codes
-- Uncomment only if you want to regenerate all item codes

-- DO $$
-- DECLARE
--   item_record RECORD;
--   new_code VARCHAR(50);
-- BEGIN
--   FOR item_record IN
--     SELECT id FROM items WHERE code NOT LIKE 'ITEM-%' ORDER BY created_at
--   LOOP
--     new_code := generate_item_code();
--     UPDATE items SET code = new_code WHERE id = item_record.id;
--   END LOOP;
-- END $$;

-- =====================================================
-- Initialize item code counter based on existing items
-- =====================================================
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

  -- Set the next number
  UPDATE organization_settings
  SET item_code_next_number = max_number
  WHERE item_code_next_number < max_number;
END $$;

-- =====================================================
-- RLS Policies for categories table
-- =====================================================
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

-- All authenticated users can view active categories
CREATE POLICY "All authenticated users can view active categories"
  ON categories FOR SELECT
  TO authenticated
  USING (is_active = true);

-- Only super_admin can view all categories (including inactive)
CREATE POLICY "Super admin can view all categories"
  ON categories FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'super_admin'
    )
  );

-- Only super_admin can create categories
CREATE POLICY "Super admin can create categories"
  ON categories FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'super_admin'
    )
  );

-- Only super_admin can update categories
CREATE POLICY "Super admin can update categories"
  ON categories FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'super_admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'super_admin'
    )
  );

-- Only super_admin can delete categories (soft delete by setting is_active = false)
CREATE POLICY "Super admin can delete categories"
  ON categories FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'super_admin'
    )
  );

-- =====================================================
-- Comments
-- =====================================================
COMMENT ON TABLE categories IS 'Master list of item categories for classification and organization';
COMMENT ON FUNCTION generate_item_code() IS 'Generates next sequential item code based on organization settings';
COMMENT ON FUNCTION set_next_item_code_number(INTEGER) IS 'Allows admin to set custom starting number for item codes';

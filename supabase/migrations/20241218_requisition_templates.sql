-- =====================================================
-- Requisition Templates
-- Allow users to save common requisitions as templates for quick reuse
-- =====================================================

-- Create requisition_templates table
CREATE TABLE IF NOT EXISTS requisition_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  template_name VARCHAR(255) NOT NULL,
  description TEXT,

  -- Template data (mirrors requisition fields)
  type requisition_type DEFAULT 'purchase',
  project_id UUID REFERENCES projects(id),
  expense_account_id UUID REFERENCES expense_accounts(id),
  title VARCHAR(255),
  requisition_description TEXT,
  justification TEXT,
  delivery_location TEXT,
  supplier_preference TEXT,

  -- Metadata
  created_by UUID NOT NULL REFERENCES users(id),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create requisition_template_items table
CREATE TABLE IF NOT EXISTS requisition_template_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  template_id UUID NOT NULL REFERENCES requisition_templates(id) ON DELETE CASCADE,

  -- Item details
  item_id UUID REFERENCES items(id),
  item_description TEXT,
  quantity NUMERIC(10, 2) NOT NULL,
  uom_id UUID REFERENCES uom_types(id),
  unit_price NUMERIC(15, 2),
  notes TEXT,
  line_number INTEGER,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX idx_requisition_templates_created_by ON requisition_templates(created_by);
CREATE INDEX idx_requisition_templates_active ON requisition_templates(is_active);
CREATE INDEX idx_requisition_template_items_template_id ON requisition_template_items(template_id);

-- RLS Policies for requisition_templates
ALTER TABLE requisition_templates ENABLE ROW LEVEL SECURITY;

-- Users can view their own templates
CREATE POLICY "Users can view own templates"
  ON requisition_templates FOR SELECT
  USING (auth.uid() = created_by);

-- Users can create their own templates
CREATE POLICY "Users can create own templates"
  ON requisition_templates FOR INSERT
  WITH CHECK (auth.uid() = created_by);

-- Users can update their own templates
CREATE POLICY "Users can update own templates"
  ON requisition_templates FOR UPDATE
  USING (auth.uid() = created_by);

-- Users can delete their own templates
CREATE POLICY "Users can delete own templates"
  ON requisition_templates FOR DELETE
  USING (auth.uid() = created_by);

-- RLS Policies for requisition_template_items
ALTER TABLE requisition_template_items ENABLE ROW LEVEL SECURITY;

-- Users can view items of their templates
CREATE POLICY "Users can view own template items"
  ON requisition_template_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM requisition_templates
      WHERE id = template_id AND created_by = auth.uid()
    )
  );

-- Users can create items for their templates
CREATE POLICY "Users can create own template items"
  ON requisition_template_items FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM requisition_templates
      WHERE id = template_id AND created_by = auth.uid()
    )
  );

-- Users can update items of their templates
CREATE POLICY "Users can update own template items"
  ON requisition_template_items FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM requisition_templates
      WHERE id = template_id AND created_by = auth.uid()
    )
  );

-- Users can delete items of their templates
CREATE POLICY "Users can delete own template items"
  ON requisition_template_items FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM requisition_templates
      WHERE id = template_id AND created_by = auth.uid()
    )
  );

-- Add updated_at trigger for templates
CREATE OR REPLACE FUNCTION update_requisition_template_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_requisition_template_timestamp
  BEFORE UPDATE ON requisition_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_requisition_template_updated_at();

-- Add comments
COMMENT ON TABLE requisition_templates IS 'Stores requisition templates for quick reuse';
COMMENT ON TABLE requisition_template_items IS 'Line items for requisition templates';
COMMENT ON COLUMN requisition_templates.template_name IS 'User-friendly name for the template';
COMMENT ON COLUMN requisition_templates.requisition_description IS 'Default description for requisitions created from this template';

-- =====================================================
-- System Settings Migration
-- Adds tables for organization details, fiscal year, and approval workflows
-- =====================================================

-- =====================================================
-- TABLE: organization_settings
-- Stores organization/company details
-- =====================================================
CREATE TABLE organization_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_name VARCHAR(255) NOT NULL,
  address_line1 VARCHAR(255),
  address_line2 VARCHAR(255),
  city VARCHAR(100),
  state_province VARCHAR(100),
  postal_code VARCHAR(20),
  country VARCHAR(100),
  phone VARCHAR(20),
  email VARCHAR(255),
  website VARCHAR(255),
  tax_id VARCHAR(50),
  logo_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Only allow one organization settings record
CREATE UNIQUE INDEX single_org_settings ON organization_settings ((true));

-- =====================================================
-- TABLE: fiscal_year_settings
-- Stores fiscal year configuration
-- =====================================================
CREATE TABLE fiscal_year_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  fiscal_year_start_month INTEGER NOT NULL CHECK (fiscal_year_start_month BETWEEN 1 AND 12),
  fiscal_year_start_day INTEGER NOT NULL CHECK (fiscal_year_start_day BETWEEN 1 AND 31),
  current_fiscal_year INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Only allow one fiscal year settings record
CREATE UNIQUE INDEX single_fiscal_settings ON fiscal_year_settings ((true));

-- =====================================================
-- TABLE: approval_workflows
-- Defines approval workflows based on amount thresholds
-- =====================================================
CREATE TABLE approval_workflows (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workflow_name VARCHAR(100) NOT NULL,
  description TEXT,
  amount_threshold_min NUMERIC(15, 2) NOT NULL DEFAULT 0,
  amount_threshold_max NUMERIC(15, 2),
  required_approvers_count INTEGER NOT NULL DEFAULT 1,
  approval_roles TEXT[] NOT NULL DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  priority INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT positive_min_amount CHECK (amount_threshold_min >= 0),
  CONSTRAINT valid_max_amount CHECK (amount_threshold_max IS NULL OR amount_threshold_max > amount_threshold_min),
  CONSTRAINT positive_approvers CHECK (required_approvers_count > 0)
);

-- Create index for efficient workflow lookup
CREATE INDEX idx_approval_workflows_active ON approval_workflows(is_active, priority);
CREATE INDEX idx_approval_workflows_amounts ON approval_workflows(amount_threshold_min, amount_threshold_max);

-- =====================================================
-- Insert default data
-- =====================================================

-- Default organization settings
INSERT INTO organization_settings (
  organization_name,
  country
) VALUES (
  'Your Organization',
  'United States'
);

-- Default fiscal year settings (Calendar year: January 1)
INSERT INTO fiscal_year_settings (
  fiscal_year_start_month,
  fiscal_year_start_day,
  current_fiscal_year
) VALUES (
  1,  -- January
  1,  -- 1st
  EXTRACT(YEAR FROM CURRENT_DATE)
);

-- Default approval workflows
INSERT INTO approval_workflows (workflow_name, description, amount_threshold_min, amount_threshold_max, required_approvers_count, approval_roles, priority) VALUES
  ('Low Value', 'Requisitions under $1,000', 0, 999.99, 1, ARRAY['approver', 'super_admin'], 1),
  ('Medium Value', 'Requisitions $1,000 - $9,999', 1000, 9999.99, 1, ARRAY['approver', 'super_admin'], 2),
  ('High Value', 'Requisitions $10,000 - $49,999', 10000, 49999.99, 2, ARRAY['approver', 'super_admin'], 3),
  ('Very High Value', 'Requisitions $50,000 and above', 50000, NULL, 3, ARRAY['super_admin'], 4);

-- =====================================================
-- RLS Policies
-- =====================================================

-- Enable RLS
ALTER TABLE organization_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE fiscal_year_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE approval_workflows ENABLE ROW LEVEL SECURITY;

-- Organization settings policies
CREATE POLICY "Anyone can view organization settings"
  ON organization_settings FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Only admins can update organization settings"
  ON organization_settings FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'super_admin'
    )
  );

-- Fiscal year settings policies
CREATE POLICY "Anyone can view fiscal year settings"
  ON fiscal_year_settings FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Only admins can update fiscal year settings"
  ON fiscal_year_settings FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'super_admin'
    )
  );

-- Approval workflows policies
CREATE POLICY "Anyone can view approval workflows"
  ON approval_workflows FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Only admins can manage approval workflows"
  ON approval_workflows FOR ALL
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
COMMENT ON TABLE organization_settings IS 'Organization/company details and settings';
COMMENT ON TABLE fiscal_year_settings IS 'Fiscal year configuration';
COMMENT ON TABLE approval_workflows IS 'Approval workflow definitions based on amount thresholds';

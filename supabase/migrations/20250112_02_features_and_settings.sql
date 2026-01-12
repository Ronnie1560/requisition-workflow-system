-- =====================================================
-- PCM Requisition System - Features and Settings
-- Consolidated Migration: January 12, 2026
-- =====================================================
-- This migration adds:
-- 1. Organization settings (name, address, logo, etc.)
-- 2. Fiscal year settings
-- 3. Approval workflows
-- 4. User preferences
-- 5. Categories and auto item codes
-- 6. Requisition templates
-- 7. Email notification preferences
-- =====================================================

BEGIN;

-- =====================================================
-- PART 1: ORGANIZATION SETTINGS
-- =====================================================

CREATE TABLE IF NOT EXISTS organization_settings (
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
  -- Item code generation settings
  item_code_prefix VARCHAR(10) DEFAULT 'ITEM',
  item_code_next_number INTEGER DEFAULT 1,
  item_code_padding INTEGER DEFAULT 3,
  -- App settings
  app_base_url TEXT DEFAULT 'https://pcm-requisition.vercel.app',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Only allow one organization settings record
CREATE UNIQUE INDEX IF NOT EXISTS single_org_settings ON organization_settings ((true));

-- =====================================================
-- PART 2: FISCAL YEAR SETTINGS
-- =====================================================

CREATE TABLE IF NOT EXISTS fiscal_year_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  fiscal_year_start_month INTEGER NOT NULL CHECK (fiscal_year_start_month BETWEEN 1 AND 12),
  fiscal_year_start_day INTEGER NOT NULL CHECK (fiscal_year_start_day BETWEEN 1 AND 31),
  current_fiscal_year INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS single_fiscal_settings ON fiscal_year_settings ((true));

-- =====================================================
-- PART 3: APPROVAL WORKFLOWS
-- =====================================================

CREATE TABLE IF NOT EXISTS approval_workflows (
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

CREATE INDEX IF NOT EXISTS idx_approval_workflows_active ON approval_workflows(is_active, priority);
CREATE INDEX IF NOT EXISTS idx_approval_workflows_amounts ON approval_workflows(amount_threshold_min, amount_threshold_max);

-- =====================================================
-- PART 4: USER PREFERENCES
-- =====================================================

CREATE TABLE IF NOT EXISTS user_preferences (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  theme VARCHAR(20) DEFAULT 'light' CHECK (theme IN ('light', 'dark', 'system')),
  accent_color VARCHAR(20) DEFAULT 'blue',
  enable_notifications BOOLEAN DEFAULT true,
  notification_sound BOOLEAN DEFAULT true,
  email_notifications BOOLEAN DEFAULT true,
  requisition_updates BOOLEAN DEFAULT true,
  approval_notifications BOOLEAN DEFAULT true,
  weekly_digest BOOLEAN DEFAULT false,
  default_project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  default_expense_account_id UUID REFERENCES expense_accounts(id) ON DELETE SET NULL,
  items_per_page INTEGER DEFAULT 20 CHECK (items_per_page BETWEEN 10 AND 100),
  compact_view BOOLEAN DEFAULT false,
  show_archived BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

CREATE INDEX IF NOT EXISTS idx_user_preferences_user_id ON user_preferences(user_id);

-- =====================================================
-- PART 5: CATEGORIES
-- =====================================================

CREATE TABLE IF NOT EXISTS categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code VARCHAR(50) NOT NULL UNIQUE,
  name VARCHAR(100) NOT NULL UNIQUE,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_categories_code ON categories(code);
CREATE INDEX IF NOT EXISTS idx_categories_is_active ON categories(is_active);

-- Add category_id to items table if not exists
ALTER TABLE items ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES categories(id);
CREATE INDEX IF NOT EXISTS idx_items_category_id ON items(category_id);

-- =====================================================
-- PART 6: REQUISITION TEMPLATES
-- =====================================================

CREATE TABLE IF NOT EXISTS requisition_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  template_name VARCHAR(255) NOT NULL,
  description TEXT,
  type requisition_type DEFAULT 'purchase',
  project_id UUID REFERENCES projects(id),
  expense_account_id UUID REFERENCES expense_accounts(id),
  title VARCHAR(255),
  requisition_description TEXT,
  justification TEXT,
  delivery_location TEXT,
  supplier_preference TEXT,
  created_by UUID NOT NULL REFERENCES users(id),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS requisition_template_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  template_id UUID NOT NULL REFERENCES requisition_templates(id) ON DELETE CASCADE,
  item_id UUID REFERENCES items(id),
  item_description TEXT,
  quantity NUMERIC(10, 2) NOT NULL,
  uom_id UUID REFERENCES uom_types(id),
  unit_price NUMERIC(15, 2),
  notes TEXT,
  line_number INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_requisition_templates_created_by ON requisition_templates(created_by);
CREATE INDEX IF NOT EXISTS idx_requisition_templates_active ON requisition_templates(is_active);
CREATE INDEX IF NOT EXISTS idx_requisition_template_items_template_id ON requisition_template_items(template_id);

-- =====================================================
-- PART 7: EMAIL NOTIFICATION PREFERENCES (on users table)
-- =====================================================

ALTER TABLE users ADD COLUMN IF NOT EXISTS email_notifications_enabled BOOLEAN DEFAULT true;
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_on_submission BOOLEAN DEFAULT true;
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_on_review BOOLEAN DEFAULT true;
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_on_approval BOOLEAN DEFAULT true;
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_on_rejection BOOLEAN DEFAULT true;
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_on_comment BOOLEAN DEFAULT true;

-- =====================================================
-- PART 8: EMAIL NOTIFICATIONS QUEUE TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS email_notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  recipient_email VARCHAR(255) NOT NULL,
  recipient_user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  subject TEXT NOT NULL,
  body_html TEXT NOT NULL,
  body_text TEXT,
  notification_type TEXT NOT NULL,
  related_requisition_id UUID REFERENCES requisitions(id) ON DELETE SET NULL,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed')),
  sent_at TIMESTAMPTZ,
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_email_notifications_status ON email_notifications(status, created_at);
CREATE INDEX IF NOT EXISTS idx_email_notifications_recipient ON email_notifications(recipient_user_id);
CREATE INDEX IF NOT EXISTS idx_email_notifications_type ON email_notifications(notification_type);

-- =====================================================
-- PART 9: SCHEMA ENHANCEMENTS
-- =====================================================

-- Add link column to notifications table
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS link TEXT;

-- Add expense_account_id to requisitions (flexible budgeting)
ALTER TABLE requisitions ADD COLUMN IF NOT EXISTS expense_account_id UUID REFERENCES expense_accounts(id);
CREATE INDEX IF NOT EXISTS idx_requisitions_expense_account ON requisitions(expense_account_id);

-- Make project_account_id nullable for flexible budgeting
ALTER TABLE requisitions ALTER COLUMN project_account_id DROP NOT NULL;

-- Add rejection_reason to requisitions
ALTER TABLE requisitions ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

-- =====================================================
-- RLS POLICIES FOR NEW TABLES
-- =====================================================

-- Organization Settings RLS
ALTER TABLE organization_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view organization settings" ON organization_settings;
CREATE POLICY "Anyone can view organization settings"
  ON organization_settings FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Admins can update organization settings" ON organization_settings;
CREATE POLICY "Admins can update organization settings"
  ON organization_settings FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'super_admin'));

DROP POLICY IF EXISTS "Admins can insert organization settings" ON organization_settings;
CREATE POLICY "Admins can insert organization settings"
  ON organization_settings FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'super_admin'));

-- Fiscal Year Settings RLS
ALTER TABLE fiscal_year_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view fiscal year settings" ON fiscal_year_settings;
CREATE POLICY "Anyone can view fiscal year settings"
  ON fiscal_year_settings FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Admins can manage fiscal year settings" ON fiscal_year_settings;
CREATE POLICY "Admins can manage fiscal year settings"
  ON fiscal_year_settings FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'super_admin'));

-- Approval Workflows RLS
ALTER TABLE approval_workflows ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view approval workflows" ON approval_workflows;
CREATE POLICY "Anyone can view approval workflows"
  ON approval_workflows FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Admins can manage approval workflows" ON approval_workflows;
CREATE POLICY "Admins can manage approval workflows"
  ON approval_workflows FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'super_admin'));

-- User Preferences RLS
ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own preferences" ON user_preferences;
CREATE POLICY "Users can view own preferences"
  ON user_preferences FOR SELECT TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can manage own preferences" ON user_preferences;
CREATE POLICY "Users can manage own preferences"
  ON user_preferences FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Categories RLS
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view categories" ON categories;
CREATE POLICY "Anyone can view categories"
  ON categories FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Admins can manage categories" ON categories;
CREATE POLICY "Admins can manage categories"
  ON categories FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'super_admin'));

-- Requisition Templates RLS
ALTER TABLE requisition_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own templates" ON requisition_templates;
CREATE POLICY "Users can view own templates"
  ON requisition_templates FOR SELECT USING (auth.uid() = created_by);

DROP POLICY IF EXISTS "Users can manage own templates" ON requisition_templates;
CREATE POLICY "Users can manage own templates"
  ON requisition_templates FOR ALL
  USING (auth.uid() = created_by) WITH CHECK (auth.uid() = created_by);

-- Requisition Template Items RLS
ALTER TABLE requisition_template_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own template items" ON requisition_template_items;
CREATE POLICY "Users can view own template items"
  ON requisition_template_items FOR SELECT
  USING (EXISTS (SELECT 1 FROM requisition_templates WHERE id = template_id AND created_by = auth.uid()));

DROP POLICY IF EXISTS "Users can manage own template items" ON requisition_template_items;
CREATE POLICY "Users can manage own template items"
  ON requisition_template_items FOR ALL
  USING (EXISTS (SELECT 1 FROM requisition_templates WHERE id = template_id AND created_by = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM requisition_templates WHERE id = template_id AND created_by = auth.uid()));

-- Email Notifications RLS
ALTER TABLE email_notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view all email notifications" ON email_notifications;
CREATE POLICY "Admins can view all email notifications"
  ON email_notifications FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'super_admin'));

DROP POLICY IF EXISTS "System can insert email notifications" ON email_notifications;
CREATE POLICY "System can insert email notifications"
  ON email_notifications FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "System can update email notifications" ON email_notifications;
CREATE POLICY "System can update email notifications"
  ON email_notifications FOR UPDATE USING (true);

-- =====================================================
-- SEED DATA
-- =====================================================

-- Default organization settings (only insert if not exists)
INSERT INTO organization_settings (organization_name, country, app_base_url)
SELECT 'Passion Christian Ministries', 'United States', 'https://pcm-requisition.vercel.app'
WHERE NOT EXISTS (SELECT 1 FROM organization_settings);

-- Default fiscal year settings
INSERT INTO fiscal_year_settings (fiscal_year_start_month, fiscal_year_start_day, current_fiscal_year)
SELECT 1, 1, EXTRACT(YEAR FROM CURRENT_DATE)
WHERE NOT EXISTS (SELECT 1 FROM fiscal_year_settings);

-- Default approval workflows
INSERT INTO approval_workflows (workflow_name, description, amount_threshold_min, amount_threshold_max, required_approvers_count, approval_roles, priority)
SELECT 'Low Value', 'Requisitions under $1,000', 0, 999.99, 1, ARRAY['approver', 'super_admin'], 1
WHERE NOT EXISTS (SELECT 1 FROM approval_workflows WHERE workflow_name = 'Low Value');

INSERT INTO approval_workflows (workflow_name, description, amount_threshold_min, amount_threshold_max, required_approvers_count, approval_roles, priority)
SELECT 'Medium Value', 'Requisitions $1,000 - $9,999', 1000, 9999.99, 1, ARRAY['approver', 'super_admin'], 2
WHERE NOT EXISTS (SELECT 1 FROM approval_workflows WHERE workflow_name = 'Medium Value');

INSERT INTO approval_workflows (workflow_name, description, amount_threshold_min, amount_threshold_max, required_approvers_count, approval_roles, priority)
SELECT 'High Value', 'Requisitions $10,000 - $49,999', 10000, 49999.99, 2, ARRAY['approver', 'super_admin'], 3
WHERE NOT EXISTS (SELECT 1 FROM approval_workflows WHERE workflow_name = 'High Value');

INSERT INTO approval_workflows (workflow_name, description, amount_threshold_min, amount_threshold_max, required_approvers_count, approval_roles, priority)
SELECT 'Very High Value', 'Requisitions $50,000 and above', 50000, NULL, 3, ARRAY['super_admin'], 4
WHERE NOT EXISTS (SELECT 1 FROM approval_workflows WHERE workflow_name = 'Very High Value');

-- =====================================================
-- TABLE COMMENTS
-- =====================================================

COMMENT ON TABLE organization_settings IS 'Organization/company details and application settings';
COMMENT ON TABLE fiscal_year_settings IS 'Fiscal year configuration';
COMMENT ON TABLE approval_workflows IS 'Approval workflow definitions based on amount thresholds';
COMMENT ON TABLE user_preferences IS 'User-specific application preferences and defaults';
COMMENT ON TABLE categories IS 'Master list of item categories';
COMMENT ON TABLE requisition_templates IS 'Saved requisition templates for quick reuse';
COMMENT ON TABLE requisition_template_items IS 'Line items for requisition templates';
COMMENT ON TABLE email_notifications IS 'Queue for email notifications to be sent via Edge Function';

COMMIT;

-- =====================================================
-- PCM Requisition System - Multi-Tenancy Migration (FIXED)
-- Converts single-tenant to multi-tenant SaaS
-- Strategy: Row-Level Isolation
-- Fixed: Only adds org_id to tables that actually exist
-- =====================================================

-- =====================================================
-- STEP 1: Create Organizations Table
-- =====================================================

-- Subscription Plan Enum
DO $$ BEGIN
  CREATE TYPE subscription_plan AS ENUM (
    'free',
    'starter',
    'professional',
    'enterprise'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Organization Status Enum
DO $$ BEGIN
  CREATE TYPE organization_status AS ENUM (
    'active',
    'suspended',
    'cancelled',
    'trial'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Organizations table (tenants)
CREATE TABLE IF NOT EXISTS organizations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Basic Info
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(100) NOT NULL UNIQUE, -- URL-friendly identifier (subdomain)

  -- Contact Info
  email VARCHAR(255),
  phone VARCHAR(20),
  website VARCHAR(255),

  -- Address
  address_line1 VARCHAR(255),
  address_line2 VARCHAR(255),
  city VARCHAR(100),
  state_province VARCHAR(100),
  postal_code VARCHAR(20),
  country VARCHAR(100) DEFAULT 'Uganda',

  -- Branding
  logo_url TEXT,
  primary_color VARCHAR(7) DEFAULT '#3B82F6',

  -- Business Info
  tax_id VARCHAR(50),
  industry VARCHAR(100),

  -- Subscription
  plan subscription_plan NOT NULL DEFAULT 'free',
  status organization_status NOT NULL DEFAULT 'trial',
  trial_ends_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '14 days'),
  subscription_ends_at TIMESTAMPTZ,

  -- Limits (based on plan)
  max_users INTEGER DEFAULT 5,
  max_projects INTEGER DEFAULT 10,
  max_requisitions_per_month INTEGER DEFAULT 100,

  -- Stripe Integration (for billing)
  stripe_customer_id VARCHAR(255),
  stripe_subscription_id VARCHAR(255),

  -- Metadata
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

-- Index for slug lookups (subdomain routing)
CREATE UNIQUE INDEX IF NOT EXISTS idx_organizations_slug ON organizations(slug);
CREATE INDEX IF NOT EXISTS idx_organizations_status ON organizations(status);

-- =====================================================
-- STEP 2: Create Organization Memberships Table
-- Users can belong to multiple organizations
-- =====================================================

DO $$ BEGIN
  CREATE TYPE org_member_role AS ENUM (
    'owner',      -- Full control, billing
    'admin',      -- Manage users, settings
    'member'      -- Regular access
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS organization_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role org_member_role NOT NULL DEFAULT 'member',

  -- Invitation tracking
  invited_by UUID REFERENCES auth.users(id),
  invited_at TIMESTAMPTZ DEFAULT NOW(),
  accepted_at TIMESTAMPTZ,

  -- Status
  is_active BOOLEAN DEFAULT true,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Each user can only be in an org once
  UNIQUE(organization_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_org_members_org ON organization_members(organization_id);
CREATE INDEX IF NOT EXISTS idx_org_members_user ON organization_members(user_id);

-- =====================================================
-- STEP 3: Add org_id to EXISTING tables only
-- =====================================================

-- Add org_id to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES organizations(id);
CREATE INDEX IF NOT EXISTS idx_users_org ON users(org_id);

-- Add org_id to projects table
ALTER TABLE projects ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES organizations(id);
CREATE INDEX IF NOT EXISTS idx_projects_org ON projects(org_id);

-- Add org_id to user_project_assignments table
ALTER TABLE user_project_assignments ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES organizations(id);
CREATE INDEX IF NOT EXISTS idx_user_project_assignments_org ON user_project_assignments(org_id);

-- Add org_id to expense_accounts table
ALTER TABLE expense_accounts ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES organizations(id);
CREATE INDEX IF NOT EXISTS idx_expense_accounts_org ON expense_accounts(org_id);

-- Add org_id to requisitions table
ALTER TABLE requisitions ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES organizations(id);
CREATE INDEX IF NOT EXISTS idx_requisitions_org ON requisitions(org_id);

-- Add org_id to requisition_items table
ALTER TABLE requisition_items ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES organizations(id);
CREATE INDEX IF NOT EXISTS idx_requisition_items_org ON requisition_items(org_id);

-- Add org_id to purchase_orders table
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES organizations(id);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_org ON purchase_orders(org_id);

-- Add org_id to receipt_transactions table
ALTER TABLE receipt_transactions ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES organizations(id);
CREATE INDEX IF NOT EXISTS idx_receipt_transactions_org ON receipt_transactions(org_id);

-- Add org_id to receipt_items table
ALTER TABLE receipt_items ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES organizations(id);
CREATE INDEX IF NOT EXISTS idx_receipt_items_org ON receipt_items(org_id);

-- Add org_id to notifications table
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES organizations(id);
CREATE INDEX IF NOT EXISTS idx_notifications_org ON notifications(org_id);

-- Add org_id to approval_workflows table (if exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'approval_workflows') THEN
    ALTER TABLE approval_workflows ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES organizations(id);
    CREATE INDEX IF NOT EXISTS idx_approval_workflows_org ON approval_workflows(org_id);
  END IF;
END $$;

-- Add org_id to fiscal_year_settings table (if exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'fiscal_year_settings') THEN
    ALTER TABLE fiscal_year_settings ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES organizations(id);
    CREATE INDEX IF NOT EXISTS idx_fiscal_year_settings_org ON fiscal_year_settings(org_id);
  END IF;
END $$;

-- Add org_id to uom_types table (if exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'uom_types') THEN
    ALTER TABLE uom_types ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES organizations(id);
    CREATE INDEX IF NOT EXISTS idx_uom_types_org ON uom_types(org_id);
  END IF;
END $$;

-- Add org_id to items table (if exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'items') THEN
    ALTER TABLE items ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES organizations(id);
    CREATE INDEX IF NOT EXISTS idx_items_org ON items(org_id);
  END IF;
END $$;

-- Add org_id to categories table (if exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'categories') THEN
    ALTER TABLE categories ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES organizations(id);
    CREATE INDEX IF NOT EXISTS idx_categories_org ON categories(org_id);
  END IF;
END $$;

-- Add org_id to requisition_templates table (if exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'requisition_templates') THEN
    ALTER TABLE requisition_templates ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES organizations(id);
    CREATE INDEX IF NOT EXISTS idx_requisition_templates_org ON requisition_templates(org_id);
  END IF;
END $$;

-- =====================================================
-- STEP 4: Convert organization_settings to per-org
-- =====================================================

-- Remove the single-org constraint
DROP INDEX IF EXISTS single_org_settings;

-- Add org_id to organization_settings
ALTER TABLE organization_settings ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES organizations(id);
CREATE INDEX IF NOT EXISTS idx_organization_settings_org ON organization_settings(org_id);

-- Add unique constraint per org
CREATE UNIQUE INDEX IF NOT EXISTS idx_organization_settings_unique_org
  ON organization_settings(org_id) WHERE org_id IS NOT NULL;

-- =====================================================
-- STEP 5: Helper functions to get current user's org
-- =====================================================

-- Function to get user's current organization from JWT or session
CREATE OR REPLACE FUNCTION get_current_org_id()
RETURNS UUID AS $$
DECLARE
  org_id UUID;
BEGIN
  -- Try to get org_id from JWT claims first
  org_id := (current_setting('request.jwt.claims', true)::json->>'org_id')::UUID;

  IF org_id IS NOT NULL THEN
    RETURN org_id;
  END IF;

  -- Fallback: get user's primary organization (first one they're a member of)
  SELECT om.organization_id INTO org_id
  FROM organization_members om
  WHERE om.user_id = auth.uid()
    AND om.is_active = true
  ORDER BY om.created_at ASC
  LIMIT 1;

  RETURN org_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if user belongs to an organization
CREATE OR REPLACE FUNCTION user_belongs_to_org(check_org_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM organization_members
    WHERE organization_id = check_org_id
      AND user_id = auth.uid()
      AND is_active = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if user is org admin/owner
CREATE OR REPLACE FUNCTION user_is_org_admin(check_org_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM organization_members
    WHERE organization_id = check_org_id
      AND user_id = auth.uid()
      AND role IN ('owner', 'admin')
      AND is_active = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if user is org owner
CREATE OR REPLACE FUNCTION user_is_org_owner(check_org_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM organization_members
    WHERE organization_id = check_org_id
      AND user_id = auth.uid()
      AND role = 'owner'
      AND is_active = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- STEP 6: RLS Policies for Organizations
-- =====================================================

ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;

-- Users can view orgs they belong to
DROP POLICY IF EXISTS "Users can view their organizations" ON organizations;
CREATE POLICY "Users can view their organizations"
  ON organizations FOR SELECT TO authenticated
  USING (user_belongs_to_org(id));

-- Only owners can update org
DROP POLICY IF EXISTS "Owners can update organization" ON organizations;
CREATE POLICY "Owners can update organization"
  ON organizations FOR UPDATE TO authenticated
  USING (user_is_org_owner(id));

-- Anyone can create an org (for signup)
DROP POLICY IF EXISTS "Authenticated users can create organizations" ON organizations;
CREATE POLICY "Authenticated users can create organizations"
  ON organizations FOR INSERT TO authenticated
  WITH CHECK (true);

-- =====================================================
-- STEP 7: RLS Policies for Organization Members
-- =====================================================

ALTER TABLE organization_members ENABLE ROW LEVEL SECURITY;

-- Users can view members of their orgs
DROP POLICY IF EXISTS "Users can view org members" ON organization_members;
CREATE POLICY "Users can view org members"
  ON organization_members FOR SELECT TO authenticated
  USING (user_belongs_to_org(organization_id));

-- Admins can add members
DROP POLICY IF EXISTS "Admins can add org members" ON organization_members;
CREATE POLICY "Admins can add org members"
  ON organization_members FOR INSERT TO authenticated
  WITH CHECK (user_is_org_admin(organization_id));

-- Admins can update members (but not owners)
DROP POLICY IF EXISTS "Admins can update org members" ON organization_members;
CREATE POLICY "Admins can update org members"
  ON organization_members FOR UPDATE TO authenticated
  USING (
    user_is_org_admin(organization_id)
    AND (role != 'owner' OR user_id = auth.uid())
  );

-- Admins can remove members (but not owners)
DROP POLICY IF EXISTS "Admins can remove org members" ON organization_members;
CREATE POLICY "Admins can remove org members"
  ON organization_members FOR DELETE TO authenticated
  USING (
    user_is_org_admin(organization_id)
    AND role != 'owner'
  );

-- =====================================================
-- STEP 8: Update RLS Policies for Data Tables
-- Now filter by org_id instead of just auth.uid()
-- =====================================================

-- USERS table
DROP POLICY IF EXISTS "Users can view users in same org" ON users;
CREATE POLICY "Users can view users in same org"
  ON users FOR SELECT TO authenticated
  USING (org_id IS NULL OR user_belongs_to_org(org_id));

DROP POLICY IF EXISTS "Admins can manage users in their org" ON users;
CREATE POLICY "Admins can manage users in their org"
  ON users FOR ALL TO authenticated
  USING (org_id IS NULL OR user_is_org_admin(org_id));

-- PROJECTS table
DROP POLICY IF EXISTS "Users can view projects" ON projects;
DROP POLICY IF EXISTS "Users can view org projects" ON projects;
CREATE POLICY "Users can view org projects"
  ON projects FOR SELECT TO authenticated
  USING (org_id IS NULL OR user_belongs_to_org(org_id));

DROP POLICY IF EXISTS "Admins can manage org projects" ON projects;
CREATE POLICY "Admins can manage org projects"
  ON projects FOR ALL TO authenticated
  USING (org_id IS NULL OR user_is_org_admin(org_id));

-- REQUISITIONS table
DROP POLICY IF EXISTS "Users can view org requisitions" ON requisitions;
CREATE POLICY "Users can view org requisitions"
  ON requisitions FOR SELECT TO authenticated
  USING (org_id IS NULL OR user_belongs_to_org(org_id));

DROP POLICY IF EXISTS "Users can create requisitions in org" ON requisitions;
CREATE POLICY "Users can create requisitions in org"
  ON requisitions FOR INSERT TO authenticated
  WITH CHECK (org_id IS NULL OR user_belongs_to_org(org_id));

DROP POLICY IF EXISTS "Users can update own requisitions" ON requisitions;
CREATE POLICY "Users can update own requisitions"
  ON requisitions FOR UPDATE TO authenticated
  USING (
    (org_id IS NULL OR user_belongs_to_org(org_id))
    AND (submitted_by = auth.uid() OR user_is_org_admin(org_id))
  );

-- EXPENSE_ACCOUNTS table
DROP POLICY IF EXISTS "Users can view org expense accounts" ON expense_accounts;
CREATE POLICY "Users can view org expense accounts"
  ON expense_accounts FOR SELECT TO authenticated
  USING (org_id IS NULL OR user_belongs_to_org(org_id));

-- NOTIFICATIONS table
DROP POLICY IF EXISTS "Users can view their org notifications" ON notifications;
CREATE POLICY "Users can view their org notifications"
  ON notifications FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    AND (org_id IS NULL OR user_belongs_to_org(org_id))
  );

-- APPROVAL_WORKFLOWS table (if exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'approval_workflows') THEN
    EXECUTE 'DROP POLICY IF EXISTS "Users can view org workflows" ON approval_workflows';
    EXECUTE 'CREATE POLICY "Users can view org workflows"
      ON approval_workflows FOR SELECT TO authenticated
      USING (org_id IS NULL OR user_belongs_to_org(org_id))';

    EXECUTE 'DROP POLICY IF EXISTS "Admins can manage org workflows" ON approval_workflows';
    EXECUTE 'CREATE POLICY "Admins can manage org workflows"
      ON approval_workflows FOR ALL TO authenticated
      USING (org_id IS NULL OR user_is_org_admin(org_id))';
  END IF;
END $$;

-- ORGANIZATION_SETTINGS table (per-org settings)
DROP POLICY IF EXISTS "Anyone can view organization settings" ON organization_settings;
DROP POLICY IF EXISTS "Users can view their org settings" ON organization_settings;
CREATE POLICY "Users can view their org settings"
  ON organization_settings FOR SELECT TO authenticated
  USING (org_id IS NULL OR user_belongs_to_org(org_id));

DROP POLICY IF EXISTS "Admins can update organization settings" ON organization_settings;
DROP POLICY IF EXISTS "Admins can manage org settings" ON organization_settings;
CREATE POLICY "Admins can manage org settings"
  ON organization_settings FOR ALL TO authenticated
  USING (org_id IS NULL OR user_is_org_admin(org_id));

-- =====================================================
-- STEP 9: Trigger to auto-set org_id on insert
-- =====================================================

CREATE OR REPLACE FUNCTION set_org_id_on_insert()
RETURNS TRIGGER AS $$
BEGIN
  -- If org_id is not set, use current org
  IF NEW.org_id IS NULL THEN
    NEW.org_id := get_current_org_id();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to all tables with org_id
DO $$
DECLARE
  tbl TEXT;
  table_exists BOOLEAN;
  tables TEXT[] := ARRAY[
    'users', 'projects', 'user_project_assignments', 'expense_accounts',
    'requisitions', 'requisition_items', 'purchase_orders',
    'receipt_transactions', 'receipt_items', 'notifications',
    'approval_workflows', 'fiscal_year_settings', 'organization_settings',
    'items', 'categories', 'requisition_templates', 'uom_types'
  ];
BEGIN
  FOREACH tbl IN ARRAY tables
  LOOP
    -- Check if table exists
    SELECT EXISTS (
      SELECT FROM information_schema.tables
      WHERE table_name = tbl
    ) INTO table_exists;

    -- Only create trigger if table exists
    IF table_exists THEN
      EXECUTE format('
        DROP TRIGGER IF EXISTS set_org_id_trigger ON %I;
        CREATE TRIGGER set_org_id_trigger
          BEFORE INSERT ON %I
          FOR EACH ROW
          EXECUTE FUNCTION set_org_id_on_insert();
      ', tbl, tbl);
    END IF;
  END LOOP;
END $$;

-- =====================================================
-- STEP 10: Function to create organization with owner
-- =====================================================

CREATE OR REPLACE FUNCTION create_organization(
  p_name VARCHAR(255),
  p_slug VARCHAR(100),
  p_email VARCHAR(255) DEFAULT NULL,
  p_plan subscription_plan DEFAULT 'free'
)
RETURNS UUID AS $$
DECLARE
  v_org_id UUID;
  v_user_id UUID;
BEGIN
  v_user_id := auth.uid();

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'User must be authenticated';
  END IF;

  -- Create organization
  INSERT INTO organizations (name, slug, email, plan, created_by)
  VALUES (p_name, p_slug, p_email, p_plan, v_user_id)
  RETURNING id INTO v_org_id;

  -- Add creator as owner
  INSERT INTO organization_members (organization_id, user_id, role, accepted_at)
  VALUES (v_org_id, v_user_id, 'owner', NOW());

  -- Create default organization settings
  INSERT INTO organization_settings (org_id, organization_name)
  VALUES (v_org_id, p_name);

  -- Create default fiscal year settings (if table exists)
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'fiscal_year_settings') THEN
    INSERT INTO fiscal_year_settings (org_id, start_month, start_day)
    VALUES (v_org_id, 1, 1);
  END IF;

  RETURN v_org_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- STEP 11: Function to invite user to organization
-- =====================================================

CREATE OR REPLACE FUNCTION invite_user_to_org(
  p_org_id UUID,
  p_email VARCHAR(255),
  p_role org_member_role DEFAULT 'member'
)
RETURNS UUID AS $$
DECLARE
  v_user_id UUID;
  v_member_id UUID;
BEGIN
  -- Check if inviter is admin
  IF NOT user_is_org_admin(p_org_id) THEN
    RAISE EXCEPTION 'Only admins can invite users';
  END IF;

  -- Find user by email
  SELECT id INTO v_user_id FROM auth.users WHERE email = p_email;

  IF v_user_id IS NULL THEN
    -- User doesn't exist yet - create pending invitation
    -- This would be handled by an edge function that sends invite email
    RAISE EXCEPTION 'User not found. Send invitation email instead.';
  END IF;

  -- Check if already a member
  IF EXISTS (SELECT 1 FROM organization_members WHERE organization_id = p_org_id AND user_id = v_user_id) THEN
    RAISE EXCEPTION 'User is already a member of this organization';
  END IF;

  -- Add user to organization
  INSERT INTO organization_members (organization_id, user_id, role, invited_by)
  VALUES (p_org_id, v_user_id, p_role, auth.uid())
  RETURNING id INTO v_member_id;

  RETURN v_member_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- STEP 12: View for user's organizations
-- =====================================================

CREATE OR REPLACE VIEW user_organizations AS
SELECT
  o.id,
  o.name,
  o.slug,
  o.logo_url,
  o.plan,
  o.status,
  om.role as member_role,
  om.created_at as joined_at
FROM organizations o
JOIN organization_members om ON o.id = om.organization_id
WHERE om.user_id = auth.uid()
  AND om.is_active = true
  AND o.status IN ('active', 'trial')
ORDER BY om.created_at ASC;

-- =====================================================
-- STEP 13: Migration for existing data
-- Creates a default org for existing single-tenant data
-- =====================================================

DO $$
DECLARE
  v_default_org_id UUID;
  v_first_admin_id UUID;
  v_org_name VARCHAR(255);
BEGIN
  -- Check if there's existing data without org_id
  IF EXISTS (SELECT 1 FROM users WHERE org_id IS NULL LIMIT 1) THEN

    -- Get org name from existing settings
    SELECT organization_name INTO v_org_name
    FROM organization_settings
    WHERE org_id IS NULL
    LIMIT 1;

    v_org_name := COALESCE(v_org_name, 'Default Organization');

    -- Find first super_admin as owner
    SELECT id INTO v_first_admin_id
    FROM users
    WHERE role = 'super_admin'
    ORDER BY created_at ASC
    LIMIT 1;

    -- Create default organization
    INSERT INTO organizations (name, slug, status, plan, created_by)
    VALUES (v_org_name, 'default', 'active', 'professional', v_first_admin_id)
    RETURNING id INTO v_default_org_id;

    -- Update all existing data with default org_id
    UPDATE users SET org_id = v_default_org_id WHERE org_id IS NULL;
    UPDATE projects SET org_id = v_default_org_id WHERE org_id IS NULL;
    UPDATE user_project_assignments SET org_id = v_default_org_id WHERE org_id IS NULL;
    UPDATE expense_accounts SET org_id = v_default_org_id WHERE org_id IS NULL;
    UPDATE requisitions SET org_id = v_default_org_id WHERE org_id IS NULL;
    UPDATE requisition_items SET org_id = v_default_org_id WHERE org_id IS NULL;
    UPDATE purchase_orders SET org_id = v_default_org_id WHERE org_id IS NULL;
    UPDATE receipt_transactions SET org_id = v_default_org_id WHERE org_id IS NULL;
    UPDATE receipt_items SET org_id = v_default_org_id WHERE org_id IS NULL;
    UPDATE notifications SET org_id = v_default_org_id WHERE org_id IS NULL;
    UPDATE organization_settings SET org_id = v_default_org_id WHERE org_id IS NULL;

    -- Update conditional tables if they exist
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'approval_workflows') THEN
      UPDATE approval_workflows SET org_id = v_default_org_id WHERE org_id IS NULL;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'fiscal_year_settings') THEN
      UPDATE fiscal_year_settings SET org_id = v_default_org_id WHERE org_id IS NULL;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'items') THEN
      UPDATE items SET org_id = v_default_org_id WHERE org_id IS NULL;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'categories') THEN
      UPDATE categories SET org_id = v_default_org_id WHERE org_id IS NULL;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'requisition_templates') THEN
      UPDATE requisition_templates SET org_id = v_default_org_id WHERE org_id IS NULL;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'uom_types') THEN
      UPDATE uom_types SET org_id = v_default_org_id WHERE org_id IS NULL;
    END IF;

    -- Add all existing users as members of default org
    INSERT INTO organization_members (organization_id, user_id, role, accepted_at)
    SELECT
      v_default_org_id,
      id,
      CASE
        WHEN role = 'super_admin' THEN 'owner'::org_member_role
        WHEN role IN ('approver', 'reviewer') THEN 'admin'::org_member_role
        ELSE 'member'::org_member_role
      END,
      NOW()
    FROM users
    WHERE org_id = v_default_org_id
    ON CONFLICT (organization_id, user_id) DO NOTHING;

    RAISE NOTICE 'Migrated existing data to organization: % (ID: %)', v_org_name, v_default_org_id;
  END IF;
END $$;

-- =====================================================
-- STEP 14: Comments
-- =====================================================

COMMENT ON TABLE organizations IS 'Multi-tenant organizations (tenants)';
COMMENT ON TABLE organization_members IS 'User memberships in organizations';
COMMENT ON FUNCTION get_current_org_id() IS 'Gets current org from JWT or user membership';
COMMENT ON FUNCTION user_belongs_to_org(UUID) IS 'Checks if current user belongs to org';
COMMENT ON FUNCTION user_is_org_admin(UUID) IS 'Checks if current user is admin/owner of org';
COMMENT ON FUNCTION create_organization(VARCHAR, VARCHAR, VARCHAR, subscription_plan) IS 'Creates org with current user as owner';

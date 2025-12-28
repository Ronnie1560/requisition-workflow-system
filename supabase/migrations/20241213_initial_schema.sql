-- =====================================================
-- PCM Requisition System - Initial Database Schema
-- Sprint 1: Database Setup
-- =====================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- ENUMS
-- =====================================================

-- User Role Enum
CREATE TYPE user_role AS ENUM (
  'submitter',
  'reviewer',
  'approver',
  'store_manager',
  'super_admin'
);

-- Requisition Status Enum
CREATE TYPE requisition_status AS ENUM (
  'draft',
  'pending',
  'under_review',
  'approved',
  'rejected',
  'cancelled',
  'partially_received',
  'completed'
);

-- Requisition Type Enum
CREATE TYPE requisition_type AS ENUM (
  'purchase',
  'expense',
  'petty_cash'
);

-- Purchase Order Status Enum
CREATE TYPE po_status AS ENUM (
  'draft',
  'issued',
  'partially_received',
  'received',
  'cancelled'
);

-- Receipt Transaction Type Enum
CREATE TYPE receipt_type AS ENUM (
  'full',
  'partial',
  'return'
);

-- Notification Type Enum
CREATE TYPE notification_type AS ENUM (
  'requisition_submitted',
  'requisition_approved',
  'requisition_rejected',
  'requisition_commented',
  'po_issued',
  'receipt_completed',
  'assignment_added'
);

-- =====================================================
-- TABLE: users (extends auth.users)
-- Stores additional user profile information
-- =====================================================
CREATE TABLE users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email VARCHAR(255) NOT NULL UNIQUE,
  full_name VARCHAR(255) NOT NULL,
  phone VARCHAR(20),
  role user_role NOT NULL DEFAULT 'submitter',
  department VARCHAR(100),
  employee_id VARCHAR(50) UNIQUE,
  is_active BOOLEAN DEFAULT true,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- TABLE: projects
-- Organization projects/departments/cost centers
-- =====================================================
CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code VARCHAR(20) NOT NULL UNIQUE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  start_date DATE,
  end_date DATE,
  budget NUMERIC(15, 2),
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- TABLE: expense_accounts
-- Chart of accounts for expense categorization
-- =====================================================
CREATE TABLE expense_accounts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code VARCHAR(20) NOT NULL UNIQUE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  parent_id UUID REFERENCES expense_accounts(id),
  level INTEGER NOT NULL DEFAULT 1,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- TABLE: project_accounts
-- Links projects to expense accounts with budgets
-- =====================================================
CREATE TABLE project_accounts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES expense_accounts(id) ON DELETE CASCADE,
  budget_amount NUMERIC(15, 2) NOT NULL DEFAULT 0,
  spent_amount NUMERIC(15, 2) NOT NULL DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(project_id, account_id)
);

-- =====================================================
-- TABLE: uom_types
-- Units of Measure (pieces, kilograms, liters, etc.)
-- =====================================================
CREATE TABLE uom_types (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code VARCHAR(10) NOT NULL UNIQUE,
  name VARCHAR(50) NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- TABLE: items
-- Master catalog of all items/services
-- =====================================================
CREATE TABLE items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code VARCHAR(50) NOT NULL UNIQUE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  category VARCHAR(100),
  default_uom_id UUID REFERENCES uom_types(id),
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- TABLE: account_items
-- Approved items per project-account with pricing
-- Pre-approved items that can be requisitioned
-- =====================================================
CREATE TABLE account_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_account_id UUID NOT NULL REFERENCES project_accounts(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  unit_price NUMERIC(15, 2) NOT NULL,
  max_quantity NUMERIC(10, 2),
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(project_account_id, item_id)
);

-- =====================================================
-- TABLE: user_project_assignments
-- Assigns users to projects with specific roles
-- =====================================================
CREATE TABLE user_project_assignments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  role user_role NOT NULL,
  is_active BOOLEAN DEFAULT true,
  assigned_by UUID REFERENCES users(id),
  assigned_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, project_id, role)
);

-- =====================================================
-- TABLE: requisitions
-- Main requisition/purchase request table
-- =====================================================
CREATE TABLE requisitions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  requisition_number VARCHAR(50) NOT NULL UNIQUE,
  type requisition_type NOT NULL DEFAULT 'purchase',
  project_id UUID NOT NULL REFERENCES projects(id),
  project_account_id UUID NOT NULL REFERENCES project_accounts(id),
  title VARCHAR(255) NOT NULL,
  description TEXT,
  status requisition_status NOT NULL DEFAULT 'draft',
  priority VARCHAR(20) DEFAULT 'normal',

  -- User references
  submitted_by UUID NOT NULL REFERENCES users(id),
  reviewed_by UUID REFERENCES users(id),
  approved_by UUID REFERENCES users(id),

  -- Timestamps
  submitted_at TIMESTAMPTZ,
  reviewed_at TIMESTAMPTZ,
  approved_at TIMESTAMPTZ,
  required_by DATE,

  -- Financial
  total_amount NUMERIC(15, 2) DEFAULT 0,

  -- Additional info
  justification TEXT,
  supplier_preference VARCHAR(255),
  delivery_location VARCHAR(255),

  -- Metadata
  is_urgent BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- TABLE: requisition_items
-- Line items for each requisition
-- =====================================================
CREATE TABLE requisition_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  requisition_id UUID NOT NULL REFERENCES requisitions(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES items(id),
  account_item_id UUID REFERENCES account_items(id),

  -- Item details
  item_description TEXT,
  quantity NUMERIC(10, 2) NOT NULL,
  uom_id UUID NOT NULL REFERENCES uom_types(id),

  -- Pricing
  unit_price NUMERIC(15, 2) NOT NULL,
  total_price NUMERIC(15, 2) NOT NULL,

  -- Status tracking
  quantity_ordered NUMERIC(10, 2) DEFAULT 0,
  quantity_received NUMERIC(10, 2) DEFAULT 0,

  -- Metadata
  line_number INTEGER NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT positive_quantity CHECK (quantity > 0),
  CONSTRAINT positive_price CHECK (unit_price >= 0)
);

-- =====================================================
-- TABLE: comments
-- Comments on requisitions (approval notes, questions)
-- =====================================================
CREATE TABLE comments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  requisition_id UUID NOT NULL REFERENCES requisitions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id),
  comment_text TEXT NOT NULL,
  is_internal BOOLEAN DEFAULT false,
  parent_comment_id UUID REFERENCES comments(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- TABLE: attachments
-- File attachments for requisitions
-- =====================================================
CREATE TABLE attachments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  requisition_id UUID NOT NULL REFERENCES requisitions(id) ON DELETE CASCADE,
  uploaded_by UUID NOT NULL REFERENCES users(id),
  file_name VARCHAR(255) NOT NULL,
  file_path TEXT NOT NULL,
  file_size INTEGER,
  file_type VARCHAR(100),
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- TABLE: purchase_orders
-- Purchase orders generated from approved requisitions
-- =====================================================
CREATE TABLE purchase_orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  po_number VARCHAR(50) NOT NULL UNIQUE,
  requisition_id UUID NOT NULL REFERENCES requisitions(id),

  -- Supplier info
  supplier_name VARCHAR(255) NOT NULL,
  supplier_contact VARCHAR(255),
  supplier_address TEXT,

  -- Delivery info
  delivery_location VARCHAR(255),
  delivery_date DATE,

  -- Status and financial
  status po_status NOT NULL DEFAULT 'draft',
  total_amount NUMERIC(15, 2) NOT NULL,

  -- Terms
  payment_terms TEXT,
  delivery_terms TEXT,

  -- User references
  issued_by UUID REFERENCES users(id),
  received_by UUID REFERENCES users(id),

  -- Timestamps
  issue_date DATE,
  received_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- TABLE: po_items
-- Line items for purchase orders
-- =====================================================
CREATE TABLE po_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  po_id UUID NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  requisition_item_id UUID NOT NULL REFERENCES requisition_items(id),
  item_id UUID NOT NULL REFERENCES items(id),

  -- Item details
  item_description TEXT,
  quantity NUMERIC(10, 2) NOT NULL,
  uom_id UUID NOT NULL REFERENCES uom_types(id),

  -- Pricing
  unit_price NUMERIC(15, 2) NOT NULL,
  total_price NUMERIC(15, 2) NOT NULL,

  -- Receipt tracking
  quantity_received NUMERIC(10, 2) DEFAULT 0,

  -- Metadata
  line_number INTEGER NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT positive_quantity CHECK (quantity > 0),
  CONSTRAINT positive_price CHECK (unit_price >= 0)
);

-- =====================================================
-- TABLE: receipt_transactions
-- Goods receipt transactions
-- =====================================================
CREATE TABLE receipt_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  receipt_number VARCHAR(50) NOT NULL UNIQUE,
  po_id UUID NOT NULL REFERENCES purchase_orders(id),
  receipt_type receipt_type NOT NULL DEFAULT 'full',

  -- Receipt details
  received_by UUID NOT NULL REFERENCES users(id),
  received_date DATE NOT NULL,
  receipt_notes TEXT,

  -- Quality check
  quality_checked BOOLEAN DEFAULT false,
  quality_notes TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- TABLE: receipt_items
-- Line items for each receipt transaction
-- =====================================================
CREATE TABLE receipt_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  receipt_id UUID NOT NULL REFERENCES receipt_transactions(id) ON DELETE CASCADE,
  po_item_id UUID NOT NULL REFERENCES po_items(id),

  -- Receipt details
  quantity_received NUMERIC(10, 2) NOT NULL,
  quantity_accepted NUMERIC(10, 2) NOT NULL,
  quantity_rejected NUMERIC(10, 2) DEFAULT 0,

  -- Storage
  storage_location VARCHAR(255),
  batch_number VARCHAR(100),

  -- Quality
  condition_notes TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT positive_received CHECK (quantity_received > 0),
  CONSTRAINT valid_accepted CHECK (quantity_accepted <= quantity_received),
  CONSTRAINT valid_rejected CHECK (quantity_rejected <= quantity_received)
);

-- =====================================================
-- TABLE: audit_logs
-- System audit trail for all critical actions
-- =====================================================
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  table_name VARCHAR(100) NOT NULL,
  record_id UUID NOT NULL,
  action VARCHAR(50) NOT NULL, -- INSERT, UPDATE, DELETE, APPROVE, REJECT, etc.
  old_values JSONB,
  new_values JSONB,
  changed_by UUID REFERENCES users(id),
  changed_at TIMESTAMPTZ DEFAULT NOW(),
  ip_address INET,
  user_agent TEXT
);

-- =====================================================
-- TABLE: notifications
-- User notifications for workflow events
-- =====================================================
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type notification_type NOT NULL,
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,

  -- Related record
  related_table VARCHAR(100),
  related_id UUID,

  -- Status
  is_read BOOLEAN DEFAULT false,
  read_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- INDEXES FOR PERFORMANCE
-- =====================================================

-- Users indexes
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_is_active ON users(is_active);

-- Projects indexes
CREATE INDEX idx_projects_code ON projects(code);
CREATE INDEX idx_projects_is_active ON projects(is_active);

-- Expense accounts indexes
CREATE INDEX idx_expense_accounts_code ON expense_accounts(code);
CREATE INDEX idx_expense_accounts_parent ON expense_accounts(parent_id);

-- Project accounts indexes
CREATE INDEX idx_project_accounts_project ON project_accounts(project_id);
CREATE INDEX idx_project_accounts_account ON project_accounts(account_id);

-- Items indexes
CREATE INDEX idx_items_code ON items(code);
CREATE INDEX idx_items_category ON items(category);
CREATE INDEX idx_items_is_active ON items(is_active);

-- Account items indexes
CREATE INDEX idx_account_items_project_account ON account_items(project_account_id);
CREATE INDEX idx_account_items_item ON account_items(item_id);

-- User project assignments indexes
CREATE INDEX idx_user_assignments_user ON user_project_assignments(user_id);
CREATE INDEX idx_user_assignments_project ON user_project_assignments(project_id);

-- Requisitions indexes
CREATE INDEX idx_requisitions_number ON requisitions(requisition_number);
CREATE INDEX idx_requisitions_status ON requisitions(status);
CREATE INDEX idx_requisitions_project ON requisitions(project_id);
CREATE INDEX idx_requisitions_submitted_by ON requisitions(submitted_by);
CREATE INDEX idx_requisitions_created_at ON requisitions(created_at DESC);

-- Requisition items indexes
CREATE INDEX idx_requisition_items_req ON requisition_items(requisition_id);
CREATE INDEX idx_requisition_items_item ON requisition_items(item_id);

-- Comments indexes
CREATE INDEX idx_comments_requisition ON comments(requisition_id);
CREATE INDEX idx_comments_user ON comments(user_id);
CREATE INDEX idx_comments_created ON comments(created_at DESC);

-- Attachments indexes
CREATE INDEX idx_attachments_requisition ON attachments(requisition_id);

-- Purchase orders indexes
CREATE INDEX idx_po_number ON purchase_orders(po_number);
CREATE INDEX idx_po_requisition ON purchase_orders(requisition_id);
CREATE INDEX idx_po_status ON purchase_orders(status);

-- PO items indexes
CREATE INDEX idx_po_items_po ON po_items(po_id);
CREATE INDEX idx_po_items_req_item ON po_items(requisition_item_id);

-- Receipt transactions indexes
CREATE INDEX idx_receipt_number ON receipt_transactions(receipt_number);
CREATE INDEX idx_receipt_po ON receipt_transactions(po_id);
CREATE INDEX idx_receipt_date ON receipt_transactions(received_date DESC);

-- Receipt items indexes
CREATE INDEX idx_receipt_items_receipt ON receipt_items(receipt_id);
CREATE INDEX idx_receipt_items_po_item ON receipt_items(po_item_id);

-- Audit logs indexes
CREATE INDEX idx_audit_table_record ON audit_logs(table_name, record_id);
CREATE INDEX idx_audit_changed_by ON audit_logs(changed_by);
CREATE INDEX idx_audit_changed_at ON audit_logs(changed_at DESC);

-- Notifications indexes
CREATE INDEX idx_notifications_user ON notifications(user_id);
CREATE INDEX idx_notifications_is_read ON notifications(is_read);
CREATE INDEX idx_notifications_created ON notifications(created_at DESC);

-- =====================================================
-- TRIGGERS FOR UPDATED_AT
-- =====================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at triggers to relevant tables
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON projects
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_expense_accounts_updated_at BEFORE UPDATE ON expense_accounts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_project_accounts_updated_at BEFORE UPDATE ON project_accounts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_items_updated_at BEFORE UPDATE ON items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_account_items_updated_at BEFORE UPDATE ON account_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_requisitions_updated_at BEFORE UPDATE ON requisitions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_requisition_items_updated_at BEFORE UPDATE ON requisition_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_comments_updated_at BEFORE UPDATE ON comments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_purchase_orders_updated_at BEFORE UPDATE ON purchase_orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- COMMENTS ON TABLES
-- =====================================================

COMMENT ON TABLE users IS 'Extended user profiles with role information';
COMMENT ON TABLE projects IS 'Organization projects/departments/cost centers';
COMMENT ON TABLE expense_accounts IS 'Chart of accounts for expense categorization';
COMMENT ON TABLE project_accounts IS 'Links projects to expense accounts with budgets';
COMMENT ON TABLE uom_types IS 'Units of measure (pieces, kg, liters, etc.)';
COMMENT ON TABLE items IS 'Master catalog of items and services';
COMMENT ON TABLE account_items IS 'Pre-approved items for each project-account with pricing';
COMMENT ON TABLE user_project_assignments IS 'User assignments to projects with roles';
COMMENT ON TABLE requisitions IS 'Purchase requisitions and expense claims';
COMMENT ON TABLE requisition_items IS 'Line items for requisitions';
COMMENT ON TABLE comments IS 'Comments and approval notes on requisitions';
COMMENT ON TABLE attachments IS 'File attachments (receipts, quotes, etc.)';
COMMENT ON TABLE purchase_orders IS 'Purchase orders generated from requisitions';
COMMENT ON TABLE po_items IS 'Line items for purchase orders';
COMMENT ON TABLE receipt_transactions IS 'Goods receipt transactions';
COMMENT ON TABLE receipt_items IS 'Line items for receipts';
COMMENT ON TABLE audit_logs IS 'System audit trail';
COMMENT ON TABLE notifications IS 'User notifications for workflow events';

-- =====================================================
-- Migration: Composite Indexes for Multi-Tenant Performance
-- Date: 2026-01-20
-- Purpose: Add composite indexes for commonly queried org_id combinations
-- =====================================================

-- These indexes optimize queries that filter by org_id and other columns
-- Critical for multi-tenant performance as queries almost always filter by org_id first

-- =====================================================
-- REQUISITIONS TABLE
-- =====================================================

-- Most common query: Get requisitions by org and status
CREATE INDEX IF NOT EXISTS idx_requisitions_org_status
  ON requisitions(org_id, status);

-- Filter by org and submitter (user's own requisitions)
CREATE INDEX IF NOT EXISTS idx_requisitions_org_submitter
  ON requisitions(org_id, submitted_by);

-- Filter by org and date (recent requisitions)
CREATE INDEX IF NOT EXISTS idx_requisitions_org_created
  ON requisitions(org_id, created_at DESC);

-- Filter by org and project (project-specific requisitions)
CREATE INDEX IF NOT EXISTS idx_requisitions_org_project
  ON requisitions(org_id, project_id)
  WHERE project_id IS NOT NULL;

-- =====================================================
-- PURCHASE ORDERS TABLE
-- =====================================================

-- Most common query: Get POs by org and status
CREATE INDEX IF NOT EXISTS idx_purchase_orders_org_status
  ON purchase_orders(org_id, status);

-- Filter by org and created date
CREATE INDEX IF NOT EXISTS idx_purchase_orders_org_created
  ON purchase_orders(org_id, created_at DESC);

-- Filter by org and supplier (for supplier lookups)
CREATE INDEX IF NOT EXISTS idx_purchase_orders_org_supplier
  ON purchase_orders(org_id, supplier_name);

-- =====================================================
-- PROJECTS TABLE
-- =====================================================

-- Get active projects by org
CREATE INDEX IF NOT EXISTS idx_projects_org_active
  ON projects(org_id, is_active)
  WHERE is_active = true;

-- Get projects by org and created date
CREATE INDEX IF NOT EXISTS idx_projects_org_created
  ON projects(org_id, created_at DESC);

-- =====================================================
-- EXPENSE ACCOUNTS TABLE
-- =====================================================

-- Get expense accounts by org and status
CREATE INDEX IF NOT EXISTS idx_expense_accounts_org_active
  ON expense_accounts(org_id, is_active);

-- Get expense accounts by org and code (for lookups)
CREATE INDEX IF NOT EXISTS idx_expense_accounts_org_code
  ON expense_accounts(org_id, code);

-- =====================================================
-- USERS TABLE
-- =====================================================

-- Get users by org and status
CREATE INDEX IF NOT EXISTS idx_users_org_active
  ON users(org_id, is_active);

-- Get users by org and role
CREATE INDEX IF NOT EXISTS idx_users_org_role
  ON users(org_id, role);

-- =====================================================
-- ORGANIZATION MEMBERS TABLE
-- =====================================================

-- Get members by org and status
CREATE INDEX IF NOT EXISTS idx_org_members_org_active
  ON organization_members(organization_id, is_active);

-- Get members by org and role
CREATE INDEX IF NOT EXISTS idx_org_members_org_role
  ON organization_members(organization_id, role);

-- =====================================================
-- NOTIFICATIONS TABLE
-- =====================================================

-- Get notifications by org and user
CREATE INDEX IF NOT EXISTS idx_notifications_org_user
  ON notifications(org_id, user_id);

-- Get unread notifications by org and user
CREATE INDEX IF NOT EXISTS idx_notifications_org_user_unread
  ON notifications(org_id, user_id, is_read)
  WHERE is_read = false;

-- Get notifications by org and created date
CREATE INDEX IF NOT EXISTS idx_notifications_org_created
  ON notifications(org_id, created_at DESC);

-- =====================================================
-- ITEMS TABLE
-- =====================================================

-- Get items by org and status
CREATE INDEX IF NOT EXISTS idx_items_org_active
  ON items(org_id, is_active);

-- Get items by org and category
CREATE INDEX IF NOT EXISTS idx_items_org_category
  ON items(org_id, category_id)
  WHERE category_id IS NOT NULL;

-- Get items by org and code (for lookups)
CREATE INDEX IF NOT EXISTS idx_items_org_code
  ON items(org_id, code);

-- =====================================================
-- CATEGORIES TABLE
-- =====================================================

-- Get categories by org and status
CREATE INDEX IF NOT EXISTS idx_categories_org_active
  ON categories(org_id, is_active);

-- =====================================================
-- RECEIPT TRANSACTIONS TABLE
-- =====================================================

-- Get receipts by org and PO
CREATE INDEX IF NOT EXISTS idx_receipts_org_po
  ON receipt_transactions(org_id, po_id);

-- Get receipts by org and received date
CREATE INDEX IF NOT EXISTS idx_receipts_org_received
  ON receipt_transactions(org_id, received_date DESC);

-- Get receipts by org and created date
CREATE INDEX IF NOT EXISTS idx_receipts_org_created
  ON receipt_transactions(org_id, created_at DESC);

-- =====================================================
-- APPROVAL WORKFLOWS TABLE
-- =====================================================

-- Get workflows by org and active status
CREATE INDEX IF NOT EXISTS idx_workflows_org_active
  ON approval_workflows(org_id, is_active);

-- Get workflows by org and priority
CREATE INDEX IF NOT EXISTS idx_workflows_org_priority
  ON approval_workflows(org_id, priority);

-- =====================================================
-- COMMENTS TABLE
-- =====================================================

-- Get comments by requisition (already isolated via requisition relationship)
CREATE INDEX IF NOT EXISTS idx_comments_requisition
  ON comments(requisition_id, created_at DESC);

-- =====================================================
-- ATTACHMENTS TABLE
-- =====================================================

-- Get attachments by requisition (already isolated via requisition relationship)
CREATE INDEX IF NOT EXISTS idx_attachments_requisition
  ON attachments(requisition_id);

-- =====================================================
-- ANALYSIS AND COMMENTS
-- =====================================================

COMMENT ON INDEX idx_requisitions_org_status IS
'Optimizes most common requisition queries: filtering by org and status (e.g., pending, approved)';

COMMENT ON INDEX idx_requisitions_org_submitter IS
'Optimizes queries for user-specific requisitions (My Requisitions view)';

COMMENT ON INDEX idx_projects_org_active IS
'Optimizes queries for active projects only, reduces index size with partial index';

COMMENT ON INDEX idx_notifications_org_user_unread IS
'Optimizes unread notification badge counts, uses partial index for efficiency';

-- Analyze tables to update query planner statistics
ANALYZE requisitions;
ANALYZE purchase_orders;
ANALYZE projects;
ANALYZE expense_accounts;
ANALYZE users;
ANALYZE organization_members;
ANALYZE notifications;
ANALYZE items;
ANALYZE categories;
ANALYZE receipt_transactions;
ANALYZE approval_workflows;
ANALYZE comments;
ANALYZE attachments;

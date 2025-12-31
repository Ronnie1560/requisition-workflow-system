-- =====================================================
-- Add Missing Foreign Key Indexes
-- Date: 2024-12-31
-- Issue: 20 foreign keys without indexes cause slow JOINs and deletes
-- =====================================================

-- Missing indexes on foreign keys cause:
-- 1. Slow JOIN operations (sequential scans instead of index scans)
-- 2. Slow DELETE on parent tables (checking child references)
-- 3. Slow UPDATE on foreign key columns

-- =====================================================
-- ATTACHMENTS TABLE
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_attachments_uploaded_by
  ON attachments(uploaded_by);

-- =====================================================
-- CATEGORIES TABLE
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_categories_created_by
  ON categories(created_by);

-- =====================================================
-- COMMENTS TABLE
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_comments_parent_comment_id
  ON comments(parent_comment_id);

-- =====================================================
-- EMAIL_NOTIFICATIONS TABLE
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_email_notifications_related_requisition_id
  ON email_notifications(related_requisition_id);

-- =====================================================
-- ITEMS TABLE
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_items_created_by
  ON items(created_by);

CREATE INDEX IF NOT EXISTS idx_items_default_uom_id
  ON items(default_uom_id);

-- =====================================================
-- PO_ITEMS TABLE
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_po_items_item_id
  ON po_items(item_id);

CREATE INDEX IF NOT EXISTS idx_po_items_uom_id
  ON po_items(uom_id);

-- =====================================================
-- PROJECTS TABLE
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_projects_created_by
  ON projects(created_by);

-- =====================================================
-- PURCHASE_ORDERS TABLE
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_purchase_orders_issued_by
  ON purchase_orders(issued_by);

CREATE INDEX IF NOT EXISTS idx_purchase_orders_received_by
  ON purchase_orders(received_by);

-- =====================================================
-- RECEIPT_TRANSACTIONS TABLE
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_receipt_transactions_received_by
  ON receipt_transactions(received_by);

-- =====================================================
-- REQUISITION_ITEMS TABLE
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_requisition_items_uom_id
  ON requisition_items(uom_id);

-- =====================================================
-- REQUISITION_TEMPLATE_ITEMS TABLE
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_requisition_template_items_item_id
  ON requisition_template_items(item_id);

CREATE INDEX IF NOT EXISTS idx_requisition_template_items_uom_id
  ON requisition_template_items(uom_id);

-- =====================================================
-- REQUISITION_TEMPLATES TABLE
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_requisition_templates_expense_account_id
  ON requisition_templates(expense_account_id);

CREATE INDEX IF NOT EXISTS idx_requisition_templates_project_id
  ON requisition_templates(project_id);

-- =====================================================
-- REQUISITIONS TABLE
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_requisitions_approved_by
  ON requisitions(approved_by);

CREATE INDEX IF NOT EXISTS idx_requisitions_reviewed_by
  ON requisitions(reviewed_by);

-- =====================================================
-- USER_PROJECT_ASSIGNMENTS TABLE
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_user_project_assignments_assigned_by
  ON user_project_assignments(assigned_by);

-- =====================================================
-- Verify all foreign keys now have indexes
-- =====================================================

WITH foreign_keys AS (
  SELECT
    tc.table_name,
    kcu.column_name,
    tc.constraint_name
  FROM information_schema.table_constraints AS tc
  JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
  WHERE tc.constraint_type = 'FOREIGN KEY'
    AND tc.table_schema = 'public'
),
indexed_columns AS (
  SELECT
    schemaname,
    tablename,
    array_agg(attname) AS indexed_columns
  FROM (
    SELECT
      n.nspname AS schemaname,
      c.relname AS tablename,
      a.attname
    FROM pg_index idx
    JOIN pg_class c ON c.oid = idx.indrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum = ANY(idx.indkey)
    WHERE n.nspname = 'public'
  ) sub
  GROUP BY schemaname, tablename
)
SELECT
  fk.table_name,
  fk.column_name,
  CASE
    WHEN EXISTS (
      SELECT 1
      FROM indexed_columns ic
      WHERE ic.tablename = fk.table_name
        AND fk.column_name = ANY(ic.indexed_columns)
    ) THEN '✅ Indexed'
    ELSE '❌ Missing Index'
  END AS index_status
FROM foreign_keys fk
WHERE NOT EXISTS (
  SELECT 1
  FROM indexed_columns ic
  WHERE ic.tablename = fk.table_name
    AND fk.column_name = ANY(ic.indexed_columns)
)
ORDER BY fk.table_name, fk.column_name;

-- Expected result: No rows (all foreign keys now have indexes)

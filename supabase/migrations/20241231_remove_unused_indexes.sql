-- =====================================================
-- Remove Unused Indexes
-- Date: 2024-12-31
-- Issue: 24 indexes with 0 scans waste space and slow writes
-- =====================================================

-- Strategy: Drop indexes with 0 scans, EXCEPT:
-- 1. Constraint indexes (single_org_settings, single_fiscal_settings)
-- 2. Indexes that might be needed for future features
-- 3. Critical audit/compliance indexes

-- Note: These can be recreated later if needed. All are small (< 100 kB)

-- =====================================================
-- AUDIT LOGS - Keep idx_audit_changed_by (has 9 scans)
-- =====================================================

DROP INDEX IF EXISTS idx_audit_changed_at;
-- Keep: idx_audit_changed_by (9 scans, actively used)

DROP INDEX IF EXISTS idx_audit_table_record;
-- Note: Can recreate if needed for specific audit queries

-- =====================================================
-- APPROVAL WORKFLOWS
-- =====================================================

DROP INDEX IF EXISTS idx_approval_workflows_active;
-- Note: Workflows table likely queried by other criteria

DROP INDEX IF EXISTS idx_approval_workflows_amounts;
-- Note: Can recreate when amount-based workflow queries are implemented

-- =====================================================
-- NOTIFICATIONS - Keep composite indexes for future use
-- =====================================================

-- Keep idx_notifications_user_unread (likely composite: user_id, is_read)
-- Keep idx_notifications_user_created (likely composite: user_id, created_at)

DROP INDEX IF EXISTS idx_notifications_is_read;
-- Redundant: Covered by idx_notifications_user_unread

DROP INDEX IF EXISTS idx_notifications_created_at;
-- Redundant: Covered by idx_notifications_user_created

-- =====================================================
-- ITEMS
-- =====================================================

DROP INDEX IF EXISTS idx_items_category;
-- Keep: idx_items_category_id (has 1 scan, actively used)

-- =====================================================
-- COMMENTS
-- =====================================================

DROP INDEX IF EXISTS idx_comments_created;
-- Keep: idx_comments_user (has 9 scans, actively used)

-- =====================================================
-- EMAIL NOTIFICATIONS - Keep active ones
-- =====================================================

-- Keep: idx_email_notifications_pending (5 scans)
-- Keep: idx_email_notifications_recipient (6 scans)

DROP INDEX IF EXISTS idx_email_notifications_type;
-- Less commonly queried by type alone

-- =====================================================
-- CATEGORIES
-- =====================================================

DROP INDEX IF EXISTS idx_categories_is_active;
-- Note: RLS policies already filter active categories

-- =====================================================
-- EXPENSE ACCOUNTS
-- =====================================================

DROP INDEX IF EXISTS idx_expense_accounts_parent;
-- Note: Can recreate when hierarchical queries are needed

-- =====================================================
-- REQUISITIONS - Keep active ones
-- =====================================================

-- Keep: idx_requisitions_status (6 scans)
-- Keep: idx_requisitions_expense_account (1 scan)

DROP INDEX IF EXISTS idx_requisitions_rejected;
-- Redundant: Status index covers this

-- =====================================================
-- REQUISITION TEMPLATES
-- =====================================================

DROP INDEX IF EXISTS idx_requisition_template_items_template_id;
-- Note: Will be added back when template queries are optimized

DROP INDEX IF EXISTS idx_requisition_templates_active;
-- Note: Can recreate if template filtering becomes common

-- =====================================================
-- PURCHASE ORDERS - Keep active ones
-- =====================================================

-- Keep: idx_po_requisition (1 scan)

DROP INDEX IF EXISTS idx_po_status;
DROP INDEX IF EXISTS idx_po_items_po;

-- =====================================================
-- RECEIPTS
-- =====================================================

DROP INDEX IF EXISTS idx_receipt_po;
DROP INDEX IF EXISTS idx_receipt_date;
DROP INDEX IF EXISTS idx_receipt_items_receipt;
DROP INDEX IF EXISTS idx_receipt_items_po_item;

-- =====================================================
-- KEEP CONSTRAINT INDEXES (critical for data integrity)
-- =====================================================

-- single_org_settings - KEEP (ensures only one organization settings row)
-- single_fiscal_settings - KEEP (ensures only one fiscal year settings row)

-- =====================================================
-- Verify remaining indexes
-- =====================================================

SELECT
  schemaname,
  relname as tablename,
  indexrelname as indexname,
  idx_scan as index_scans,
  pg_size_pretty(pg_relation_size(indexrelid)) as index_size
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
  AND idx_scan = 0
  AND indexrelname NOT LIKE '%_pkey'
  AND indexrelname NOT LIKE '%_key'
ORDER BY pg_relation_size(indexrelid) DESC;

-- Expected: Only constraint indexes and intentionally kept composite indexes

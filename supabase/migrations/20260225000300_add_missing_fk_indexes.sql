-- ============================================================
-- Add Missing Foreign Key Indexes
-- ============================================================
-- Supabase Performance Advisor flagged 11 foreign keys without
-- covering indexes. These indexes improve JOIN performance and
-- speed up cascading DELETE operations.
-- ============================================================

-- organizations.created_by
CREATE INDEX IF NOT EXISTS idx_organizations_created_by
  ON public.organizations (created_by);

-- platform_admin_sessions.user_id
CREATE INDEX IF NOT EXISTS idx_platform_admin_sessions_user_id
  ON public.platform_admin_sessions (user_id);

-- platform_admins.granted_by
CREATE INDEX IF NOT EXISTS idx_platform_admins_granted_by
  ON public.platform_admins (granted_by);

-- platform_announcements.created_by
CREATE INDEX IF NOT EXISTS idx_platform_announcements_created_by
  ON public.platform_announcements (created_by);

-- platform_feedback.submitted_by
CREATE INDEX IF NOT EXISTS idx_platform_feedback_submitted_by
  ON public.platform_feedback (submitted_by);

-- platform_feedback.responded_by
CREATE INDEX IF NOT EXISTS idx_platform_feedback_responded_by
  ON public.platform_feedback (responded_by);

-- platform_feedback_votes.user_id
CREATE INDEX IF NOT EXISTS idx_platform_feedback_votes_user_id
  ON public.platform_feedback_votes (user_id);

-- po_items.po_id
CREATE INDEX IF NOT EXISTS idx_po_items_po_id
  ON public.po_items (po_id);

-- receipt_items.receipt_id
CREATE INDEX IF NOT EXISTS idx_receipt_items_receipt_id
  ON public.receipt_items (receipt_id);

-- receipt_transactions.po_id
CREATE INDEX IF NOT EXISTS idx_receipt_transactions_po_id
  ON public.receipt_transactions (po_id);

-- requisition_template_items.template_id
CREATE INDEX IF NOT EXISTS idx_requisition_template_items_template_id
  ON public.requisition_template_items (template_id);

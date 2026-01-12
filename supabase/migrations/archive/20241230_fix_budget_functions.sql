-- =====================================================
-- Fix Project Budget Functions - Column Name Mismatch
-- Date: 2024-12-30
-- Issue: Functions return wrong column names, causing UI to show $0.00
-- =====================================================

-- Drop and recreate get_project_budget_summary_v2 with correct column names
DROP FUNCTION IF EXISTS get_project_budget_summary_v2(UUID);

CREATE OR REPLACE FUNCTION get_project_budget_summary_v2(p_project_id UUID)
RETURNS TABLE (
  project_name VARCHAR(255),
  total_budget NUMERIC,
  spent_amount NUMERIC,
  pending_amount NUMERIC,
  under_review_amount NUMERIC,
  available_budget NUMERIC,
  utilization_percentage NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.name as project_name,
    p.budget as total_budget,
    p.spent_amount,
    COALESCE(pending.pending_total, 0) as pending_amount,
    COALESCE(under_review.under_review_total, 0) as under_review_amount,
    (COALESCE(p.budget, 0) - COALESCE(p.spent_amount, 0) -
     COALESCE(pending.pending_total, 0) - COALESCE(under_review.under_review_total, 0)) as available_budget,
    CASE
      WHEN COALESCE(p.budget, 0) > 0 THEN
        ROUND((COALESCE(p.spent_amount, 0) / p.budget * 100), 2)
      ELSE 0
    END as utilization_percentage
  FROM projects p
  LEFT JOIN (
    SELECT project_id, SUM(total_amount) as pending_total
    FROM requisitions
    WHERE status = 'pending'
    GROUP BY project_id
  ) pending ON pending.project_id = p.id
  LEFT JOIN (
    SELECT project_id, SUM(total_amount) as under_review_total
    FROM requisitions
    WHERE status = 'under_review'
    GROUP BY project_id
  ) under_review ON under_review.project_id = p.id
  WHERE p.id = p_project_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop and recreate get_project_expense_breakdown with correct column names
DROP FUNCTION IF EXISTS get_project_expense_breakdown(UUID);

CREATE OR REPLACE FUNCTION get_project_expense_breakdown(p_project_id UUID)
RETURNS TABLE (
  expense_account_name VARCHAR(255),
  total_spent NUMERIC,
  total_pending NUMERIC,
  total_committed NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    ea.name as expense_account_name,
    COALESCE(approved.approved_total, 0) as total_spent,
    COALESCE(pending.pending_total, 0) as total_pending,
    (COALESCE(approved.approved_total, 0) + COALESCE(pending.pending_total, 0)) as total_committed
  FROM expense_accounts ea
  LEFT JOIN (
    SELECT expense_account_id, SUM(total_amount) as approved_total
    FROM requisitions
    WHERE project_id = p_project_id
      AND status = 'approved'
    GROUP BY expense_account_id
  ) approved ON approved.expense_account_id = ea.id
  LEFT JOIN (
    SELECT expense_account_id, SUM(total_amount) as pending_total
    FROM requisitions
    WHERE project_id = p_project_id
      AND status IN ('pending', 'under_review')
    GROUP BY expense_account_id
  ) pending ON pending.expense_account_id = ea.id
  WHERE (approved.approved_total IS NOT NULL OR pending.pending_total IS NOT NULL)
  ORDER BY total_committed DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add comments
COMMENT ON FUNCTION get_project_budget_summary_v2(UUID) IS
  'Returns overall budget summary for a project including spent, pending, and available amounts with correct column names';

COMMENT ON FUNCTION get_project_expense_breakdown(UUID) IS
  'Returns breakdown of spending by expense account for visibility and reporting with correct column names';

-- =====================================================
-- Migration: Flexible Project Budgeting (Option 2)
-- Change from expense-account-level budgets to project-level budgets
-- =====================================================

-- Step 1: Add expense_account_id to requisitions table
-- This allows us to track which expense category a requisition is for
-- without needing project_accounts for budget control
ALTER TABLE requisitions
ADD COLUMN IF NOT EXISTS expense_account_id UUID REFERENCES expense_accounts(id);

-- Step 2: Populate expense_account_id from existing project_accounts
UPDATE requisitions r
SET expense_account_id = pa.account_id
FROM project_accounts pa
WHERE r.project_account_id = pa.id
  AND r.expense_account_id IS NULL;

-- Step 3: Make project_account_id nullable (for gradual migration)
ALTER TABLE requisitions
ALTER COLUMN project_account_id DROP NOT NULL;

-- Step 4: Add spent_amount to projects table to track total spending
ALTER TABLE projects
ADD COLUMN IF NOT EXISTS spent_amount NUMERIC(15, 2) DEFAULT 0;

-- Step 5: Migrate spent amounts from project_accounts to projects
-- Sum up all spent amounts from project_accounts for each project
UPDATE projects p
SET spent_amount = COALESCE(
  (SELECT SUM(spent_amount)
   FROM project_accounts
   WHERE project_id = p.id),
  0
);

-- Step 6: Update budget validation function to check project budget
DROP FUNCTION IF EXISTS check_budget_available(UUID, NUMERIC, UUID);

CREATE OR REPLACE FUNCTION check_budget_available(
  p_project_id UUID,
  p_amount NUMERIC,
  p_current_requisition_id UUID DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
  available_budget NUMERIC;
  total_budget NUMERIC;
  spent_budget NUMERIC;
  pending_budget NUMERIC;
BEGIN
  -- Get project budget and spent amounts
  SELECT budget, spent_amount
  INTO total_budget, spent_budget
  FROM projects
  WHERE id = p_project_id;

  -- If no budget is set, allow unlimited spending
  IF total_budget IS NULL OR total_budget = 0 THEN
    RETURN TRUE;
  END IF;

  -- Calculate total pending/under_review requisitions for this project
  -- Exclude the current requisition being validated (to avoid double-counting)
  SELECT COALESCE(SUM(total_amount), 0)
  INTO pending_budget
  FROM requisitions
  WHERE project_id = p_project_id
    AND status IN ('pending', 'under_review')
    AND (p_current_requisition_id IS NULL OR id != p_current_requisition_id);

  -- Calculate available budget
  available_budget := total_budget - spent_budget - pending_budget;

  RETURN available_budget >= p_amount;
END;
$$ LANGUAGE plpgsql;

-- Step 7: Update the validation trigger to use project_id instead of project_account_id
DROP TRIGGER IF EXISTS trigger_validate_requisition_submission ON requisitions;

CREATE OR REPLACE FUNCTION validate_requisition_submission()
RETURNS TRIGGER AS $$
DECLARE
  item_count INTEGER;
  budget_ok BOOLEAN;
BEGIN
  -- Only validate when moving to pending status
  IF NEW.status = 'pending' AND OLD.status = 'draft' THEN

    -- Check if requisition has items
    SELECT COUNT(*) INTO item_count
    FROM requisition_items
    WHERE requisition_id = NEW.id;

    IF item_count = 0 THEN
      RAISE EXCEPTION 'Cannot submit requisition without items';
    END IF;

    -- Check budget availability at project level
    budget_ok := check_budget_available(NEW.project_id, NEW.total_amount, NEW.id);

    IF NOT budget_ok THEN
      RAISE EXCEPTION 'Insufficient budget for this requisition';
    END IF;

    -- Set submitted timestamp
    NEW.submitted_at := NOW();
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_validate_requisition_submission
  BEFORE UPDATE ON requisitions
  FOR EACH ROW
  EXECUTE FUNCTION validate_requisition_submission();

-- Step 8: Update spent tracking to work at project level
DROP TRIGGER IF EXISTS trigger_update_project_account_spent ON requisitions;

CREATE OR REPLACE FUNCTION update_project_spent()
RETURNS TRIGGER AS $$
BEGIN
  -- When requisition is approved, add to project spent amount
  IF NEW.status = 'approved' AND OLD.status != 'approved' THEN
    UPDATE projects
    SET spent_amount = spent_amount + NEW.total_amount,
        updated_at = NOW()
    WHERE id = NEW.project_id;
  END IF;

  -- When requisition is cancelled/rejected from approved status, subtract
  IF OLD.status = 'approved' AND NEW.status IN ('cancelled', 'rejected') THEN
    UPDATE projects
    SET spent_amount = spent_amount - OLD.total_amount,
        updated_at = NOW()
    WHERE id = OLD.project_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_project_spent
  AFTER UPDATE ON requisitions
  FOR EACH ROW
  EXECUTE FUNCTION update_project_spent();

-- Step 9: Create helper function to get project budget summary
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

-- Step 10: Create function to get budget breakdown by expense account
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

-- Step 11: Add comments
COMMENT ON FUNCTION check_budget_available(UUID, NUMERIC, UUID) IS
  'Checks if sufficient budget is available at project level, accounting for pending and under_review requisitions';

COMMENT ON FUNCTION get_project_budget_summary_v2(UUID) IS
  'Returns overall budget summary for a project including spent, pending, and available amounts';

COMMENT ON FUNCTION get_project_expense_breakdown(UUID) IS
  'Returns breakdown of spending by expense account for visibility and reporting';

COMMENT ON COLUMN projects.spent_amount IS
  'Total amount spent (approved requisitions) for this project';

COMMENT ON COLUMN requisitions.expense_account_id IS
  'Expense account for categorization and reporting (not for budget control)';

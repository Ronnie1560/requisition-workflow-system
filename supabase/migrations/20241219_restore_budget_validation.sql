-- =====================================================
-- Restore Budget Validation Function
-- Date: 2024-12-19
-- Description: Restore check_budget_available function that was removed
--              in cleanup migration but is still needed by trigger
-- =====================================================

-- Recreate the budget validation function for project-level budgeting
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

COMMENT ON FUNCTION check_budget_available(UUID, NUMERIC, UUID) IS
'Checks if sufficient budget is available in the project for a requisition. Returns TRUE if budget is available or unlimited.';

-- Success message
DO $$
BEGIN
  RAISE NOTICE '==============================================';
  RAISE NOTICE 'Budget validation function restored';
  RAISE NOTICE 'Function: check_budget_available(project_id, amount, requisition_id)';
  RAISE NOTICE '==============================================';
END $$;

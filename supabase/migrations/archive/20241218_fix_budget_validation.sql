-- =====================================================
-- Fix: Budget validation should include pending requisitions
-- =====================================================

-- Drop the old function with explicit signature
DROP FUNCTION IF EXISTS check_budget_available(UUID, NUMERIC);

-- Also drop the old trigger to ensure clean replacement
DROP TRIGGER IF EXISTS trigger_validate_requisition_submission ON requisitions;

-- Create improved budget check that includes pending/under_review requisitions
CREATE OR REPLACE FUNCTION check_budget_available(
  p_project_account_id UUID,
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
  -- Get budget and spent amounts
  SELECT budget_amount, spent_amount
  INTO total_budget, spent_budget
  FROM project_accounts
  WHERE id = p_project_account_id;

  -- Calculate total pending/under_review requisitions
  -- Exclude the current requisition being validated (to avoid double-counting on updates)
  SELECT COALESCE(SUM(total_amount), 0)
  INTO pending_budget
  FROM requisitions
  WHERE project_account_id = p_project_account_id
    AND status IN ('pending', 'under_review')
    AND (p_current_requisition_id IS NULL OR id != p_current_requisition_id);

  -- Calculate available budget
  available_budget := total_budget - spent_budget - pending_budget;

  RETURN available_budget >= p_amount;
END;
$$ LANGUAGE plpgsql;

-- Update the validation trigger function to pass the current requisition ID
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

    -- Check budget availability (pass current requisition ID to avoid double-counting)
    budget_ok := check_budget_available(NEW.project_account_id, NEW.total_amount, NEW.id);

    IF NOT budget_ok THEN
      RAISE EXCEPTION 'Insufficient budget for this requisition';
    END IF;

    -- Set submitted timestamp
    NEW.submitted_at := NOW();
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recreate the trigger
CREATE TRIGGER trigger_validate_requisition_submission
  BEFORE UPDATE ON requisitions
  FOR EACH ROW
  EXECUTE FUNCTION validate_requisition_submission();

-- Test the function
-- This will show available budget considering pending requisitions
COMMENT ON FUNCTION check_budget_available(UUID, NUMERIC, UUID) IS
  'Checks if sufficient budget is available, accounting for pending and under_review requisitions';

-- =====================================================
-- PCM Requisition System - Database Helper Functions
-- Sprint 1: Business Logic Functions
-- =====================================================

-- =====================================================
-- REQUISITION NUMBER GENERATION
-- =====================================================

CREATE OR REPLACE FUNCTION generate_requisition_number()
RETURNS TEXT AS $$
DECLARE
  next_num INTEGER;
  year_prefix TEXT;
BEGIN
  year_prefix := TO_CHAR(NOW(), 'YY');

  SELECT COALESCE(MAX(
    CAST(
      SUBSTRING(requisition_number FROM '[0-9]+$') AS INTEGER
    )
  ), 0) + 1
  INTO next_num
  FROM requisitions
  WHERE requisition_number LIKE 'REQ-' || year_prefix || '%';

  RETURN 'REQ-' || year_prefix || '-' || LPAD(next_num::TEXT, 5, '0');
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- PURCHASE ORDER NUMBER GENERATION
-- =====================================================

CREATE OR REPLACE FUNCTION generate_po_number()
RETURNS TEXT AS $$
DECLARE
  next_num INTEGER;
  year_prefix TEXT;
BEGIN
  year_prefix := TO_CHAR(NOW(), 'YY');

  SELECT COALESCE(MAX(
    CAST(
      SUBSTRING(po_number FROM '[0-9]+$') AS INTEGER
    )
  ), 0) + 1
  INTO next_num
  FROM purchase_orders
  WHERE po_number LIKE 'PO-' || year_prefix || '%';

  RETURN 'PO-' || year_prefix || '-' || LPAD(next_num::TEXT, 5, '0');
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- RECEIPT NUMBER GENERATION
-- =====================================================

CREATE OR REPLACE FUNCTION generate_receipt_number()
RETURNS TEXT AS $$
DECLARE
  next_num INTEGER;
  year_prefix TEXT;
BEGIN
  year_prefix := TO_CHAR(NOW(), 'YY');

  SELECT COALESCE(MAX(
    CAST(
      SUBSTRING(receipt_number FROM '[0-9]+$') AS INTEGER
    )
  ), 0) + 1
  INTO next_num
  FROM receipt_transactions
  WHERE receipt_number LIKE 'GR-' || year_prefix || '%';

  RETURN 'GR-' || year_prefix || '-' || LPAD(next_num::TEXT, 5, '0');
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- AUTO-ASSIGN REQUISITION NUMBER ON INSERT
-- =====================================================

CREATE OR REPLACE FUNCTION auto_assign_requisition_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.requisition_number IS NULL OR NEW.requisition_number = '' THEN
    NEW.requisition_number := generate_requisition_number();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_auto_assign_requisition_number
  BEFORE INSERT ON requisitions
  FOR EACH ROW
  EXECUTE FUNCTION auto_assign_requisition_number();

-- =====================================================
-- CALCULATE REQUISITION TOTAL
-- =====================================================

CREATE OR REPLACE FUNCTION calculate_requisition_total(req_id UUID)
RETURNS NUMERIC AS $$
DECLARE
  total NUMERIC;
BEGIN
  SELECT COALESCE(SUM(total_price), 0)
  INTO total
  FROM requisition_items
  WHERE requisition_id = req_id;

  RETURN total;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- UPDATE REQUISITION TOTAL ON ITEM CHANGE
-- =====================================================

CREATE OR REPLACE FUNCTION update_requisition_total()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE requisitions
  SET total_amount = calculate_requisition_total(
    COALESCE(NEW.requisition_id, OLD.requisition_id)
  )
  WHERE id = COALESCE(NEW.requisition_id, OLD.requisition_id);

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_requisition_total_insert
  AFTER INSERT ON requisition_items
  FOR EACH ROW
  EXECUTE FUNCTION update_requisition_total();

CREATE TRIGGER trigger_update_requisition_total_update
  AFTER UPDATE ON requisition_items
  FOR EACH ROW
  EXECUTE FUNCTION update_requisition_total();

CREATE TRIGGER trigger_update_requisition_total_delete
  AFTER DELETE ON requisition_items
  FOR EACH ROW
  EXECUTE FUNCTION update_requisition_total();

-- =====================================================
-- AUTO-CALCULATE ITEM TOTAL PRICE
-- =====================================================

CREATE OR REPLACE FUNCTION calculate_item_total()
RETURNS TRIGGER AS $$
BEGIN
  NEW.total_price := NEW.quantity * NEW.unit_price;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_calculate_requisition_item_total
  BEFORE INSERT OR UPDATE ON requisition_items
  FOR EACH ROW
  EXECUTE FUNCTION calculate_item_total();

CREATE TRIGGER trigger_calculate_po_item_total
  BEFORE INSERT OR UPDATE ON po_items
  FOR EACH ROW
  EXECUTE FUNCTION calculate_item_total();

-- =====================================================
-- UPDATE PROJECT ACCOUNT SPENT AMOUNT
-- =====================================================

CREATE OR REPLACE FUNCTION update_project_account_spent()
RETURNS TRIGGER AS $$
BEGIN
  -- When requisition is approved, add to spent amount
  IF NEW.status = 'approved' AND OLD.status != 'approved' THEN
    UPDATE project_accounts
    SET spent_amount = spent_amount + NEW.total_amount
    WHERE id = NEW.project_account_id;
  END IF;

  -- When requisition is cancelled/rejected, subtract from spent amount
  IF OLD.status = 'approved' AND NEW.status IN ('cancelled', 'rejected') THEN
    UPDATE project_accounts
    SET spent_amount = spent_amount - OLD.total_amount
    WHERE id = OLD.project_account_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_project_account_spent
  AFTER UPDATE ON requisitions
  FOR EACH ROW
  EXECUTE FUNCTION update_project_account_spent();

-- =====================================================
-- CREATE AUDIT LOG ENTRY
-- =====================================================

CREATE OR REPLACE FUNCTION create_audit_log(
  p_table_name VARCHAR(100),
  p_record_id UUID,
  p_action VARCHAR(50),
  p_old_values JSONB DEFAULT NULL,
  p_new_values JSONB DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  log_id UUID;
BEGIN
  INSERT INTO audit_logs (
    table_name,
    record_id,
    action,
    old_values,
    new_values,
    changed_by
  )
  VALUES (
    p_table_name,
    p_record_id,
    p_action,
    p_old_values,
    p_new_values,
    auth.uid()
  )
  RETURNING id INTO log_id;

  RETURN log_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- AUTO AUDIT LOG FOR REQUISITIONS
-- =====================================================

CREATE OR REPLACE FUNCTION audit_requisition_changes()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM create_audit_log(
      'requisitions',
      NEW.id,
      'INSERT',
      NULL,
      to_jsonb(NEW)
    );
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    PERFORM create_audit_log(
      'requisitions',
      NEW.id,
      'UPDATE',
      to_jsonb(OLD),
      to_jsonb(NEW)
    );
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM create_audit_log(
      'requisitions',
      OLD.id,
      'DELETE',
      to_jsonb(OLD),
      NULL
    );
    RETURN OLD;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_audit_requisitions
  AFTER INSERT OR UPDATE OR DELETE ON requisitions
  FOR EACH ROW
  EXECUTE FUNCTION audit_requisition_changes();

-- =====================================================
-- CREATE NOTIFICATION
-- =====================================================

CREATE OR REPLACE FUNCTION create_notification(
  p_user_id UUID,
  p_type notification_type,
  p_title VARCHAR(255),
  p_message TEXT,
  p_related_table VARCHAR(100) DEFAULT NULL,
  p_related_id UUID DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  notif_id UUID;
BEGIN
  INSERT INTO notifications (
    user_id,
    type,
    title,
    message,
    related_table,
    related_id
  )
  VALUES (
    p_user_id,
    p_type,
    p_title,
    p_message,
    p_related_table,
    p_related_id
  )
  RETURNING id INTO notif_id;

  RETURN notif_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- NOTIFY ON REQUISITION STATUS CHANGE
-- =====================================================

CREATE OR REPLACE FUNCTION notify_requisition_status_change()
RETURNS TRIGGER AS $$
DECLARE
  reviewer_id UUID;
  approver_id UUID;
BEGIN
  -- Only process status changes
  IF OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;

  -- Requisition submitted - notify reviewers
  IF NEW.status = 'pending' THEN
    -- Get first reviewer for the project
    SELECT user_id INTO reviewer_id
    FROM user_project_assignments
    WHERE project_id = NEW.project_id
      AND role = 'reviewer'
      AND is_active = true
    LIMIT 1;

    IF reviewer_id IS NOT NULL THEN
      PERFORM create_notification(
        reviewer_id,
        'requisition_submitted',
        'New Requisition for Review',
        'Requisition ' || NEW.requisition_number || ' has been submitted for review.',
        'requisitions',
        NEW.id
      );
    END IF;
  END IF;

  -- Requisition reviewed - notify approvers
  IF NEW.status = 'under_review' THEN
    SELECT user_id INTO approver_id
    FROM user_project_assignments
    WHERE project_id = NEW.project_id
      AND role = 'approver'
      AND is_active = true
    LIMIT 1;

    IF approver_id IS NOT NULL THEN
      PERFORM create_notification(
        approver_id,
        'requisition_submitted',
        'Requisition Ready for Approval',
        'Requisition ' || NEW.requisition_number || ' has been reviewed and is ready for approval.',
        'requisitions',
        NEW.id
      );
    END IF;
  END IF;

  -- Requisition approved - notify submitter
  IF NEW.status = 'approved' THEN
    PERFORM create_notification(
      NEW.submitted_by,
      'requisition_approved',
      'Requisition Approved',
      'Your requisition ' || NEW.requisition_number || ' has been approved.',
      'requisitions',
      NEW.id
    );
  END IF;

  -- Requisition rejected - notify submitter
  IF NEW.status = 'rejected' THEN
    PERFORM create_notification(
      NEW.submitted_by,
      'requisition_rejected',
      'Requisition Rejected',
      'Your requisition ' || NEW.requisition_number || ' has been rejected.',
      'requisitions',
      NEW.id
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_notify_requisition_status
  AFTER UPDATE ON requisitions
  FOR EACH ROW
  EXECUTE FUNCTION notify_requisition_status_change();

-- =====================================================
-- NOTIFY ON NEW COMMENT
-- =====================================================

CREATE OR REPLACE FUNCTION notify_new_comment()
RETURNS TRIGGER AS $$
DECLARE
  req_submitter UUID;
  req_number VARCHAR(50);
BEGIN
  -- Get requisition info
  SELECT submitted_by, requisition_number
  INTO req_submitter, req_number
  FROM requisitions
  WHERE id = NEW.requisition_id;

  -- Notify submitter if comment is not from them
  IF req_submitter != NEW.user_id THEN
    PERFORM create_notification(
      req_submitter,
      'requisition_commented',
      'New Comment on Requisition',
      'A new comment was added to requisition ' || req_number,
      'requisitions',
      NEW.requisition_id
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_notify_new_comment
  AFTER INSERT ON comments
  FOR EACH ROW
  EXECUTE FUNCTION notify_new_comment();

-- =====================================================
-- CHECK BUDGET AVAILABILITY
-- =====================================================

CREATE OR REPLACE FUNCTION check_budget_available(
  p_project_account_id UUID,
  p_amount NUMERIC
)
RETURNS BOOLEAN AS $$
DECLARE
  available_budget NUMERIC;
BEGIN
  SELECT (budget_amount - spent_amount)
  INTO available_budget
  FROM project_accounts
  WHERE id = p_project_account_id;

  RETURN available_budget >= p_amount;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- VALIDATE REQUISITION BEFORE SUBMISSION
-- =====================================================

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

    -- Check budget availability
    budget_ok := check_budget_available(NEW.project_account_id, NEW.total_amount);

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

-- =====================================================
-- GET USER'S PROJECT ROLE
-- =====================================================

CREATE OR REPLACE FUNCTION get_user_project_role(p_user_id UUID, p_project_id UUID)
RETURNS user_role AS $$
DECLARE
  user_role_result user_role;
BEGIN
  SELECT role INTO user_role_result
  FROM user_project_assignments
  WHERE user_id = p_user_id
    AND project_id = p_project_id
    AND is_active = true
  LIMIT 1;

  RETURN user_role_result;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- GET REQUISITION STATISTICS FOR DASHBOARD
-- =====================================================

CREATE OR REPLACE FUNCTION get_requisition_stats(p_user_id UUID)
RETURNS TABLE (
  total_requisitions BIGINT,
  pending_requisitions BIGINT,
  approved_requisitions BIGINT,
  rejected_requisitions BIGINT,
  total_amount NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*)::BIGINT as total_requisitions,
    COUNT(*) FILTER (WHERE status = 'pending')::BIGINT as pending_requisitions,
    COUNT(*) FILTER (WHERE status = 'approved')::BIGINT as approved_requisitions,
    COUNT(*) FILTER (WHERE status = 'rejected')::BIGINT as rejected_requisitions,
    COALESCE(SUM(total_amount), 0) as total_amount
  FROM requisitions
  WHERE submitted_by = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- GET PROJECT BUDGET SUMMARY
-- =====================================================

CREATE OR REPLACE FUNCTION get_project_budget_summary(p_project_id UUID)
RETURNS TABLE (
  account_name VARCHAR(255),
  budget_amount NUMERIC,
  spent_amount NUMERIC,
  remaining_amount NUMERIC,
  utilization_percentage NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    ea.name as account_name,
    pa.budget_amount,
    pa.spent_amount,
    (pa.budget_amount - pa.spent_amount) as remaining_amount,
    CASE
      WHEN pa.budget_amount > 0 THEN
        ROUND((pa.spent_amount / pa.budget_amount * 100), 2)
      ELSE 0
    END as utilization_percentage
  FROM project_accounts pa
  INNER JOIN expense_accounts ea ON ea.id = pa.account_id
  WHERE pa.project_id = p_project_id
    AND pa.is_active = true
  ORDER BY ea.name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- COMMENTS
-- =====================================================

COMMENT ON FUNCTION generate_requisition_number() IS 'Generates unique requisition number in format REQ-YY-XXXXX';
COMMENT ON FUNCTION generate_po_number() IS 'Generates unique PO number in format PO-YY-XXXXX';
COMMENT ON FUNCTION generate_receipt_number() IS 'Generates unique receipt number in format GR-YY-XXXXX';
COMMENT ON FUNCTION calculate_requisition_total(UUID) IS 'Calculates total amount for a requisition';
COMMENT ON FUNCTION check_budget_available(UUID, NUMERIC) IS 'Checks if sufficient budget is available';
COMMENT ON FUNCTION get_requisition_stats(UUID) IS 'Returns requisition statistics for a user';
COMMENT ON FUNCTION get_project_budget_summary(UUID) IS 'Returns budget summary for a project';

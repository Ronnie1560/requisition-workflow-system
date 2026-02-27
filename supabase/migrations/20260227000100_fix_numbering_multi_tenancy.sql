-- ============================================================
-- Fix: Requisition/PO/Receipt Numbering for Multi-Tenancy
-- ============================================================
-- Problems:
-- 1. generate_requisition_number(), generate_po_number(), and
--    generate_receipt_number() scan the ENTIRE table for MAX,
--    ignoring org_id. Orgs see gaps and can infer other orgs'
--    activity volume.
-- 2. UNIQUE constraints are global (requisition_number, po_number,
--    receipt_number) instead of per-org. Two orgs can never have
--    the same number (e.g., both can't have REQ-26-00001).
-- 3. No concurrency protection — MAX+1 without locking can
--    produce duplicates under concurrent inserts.
--
-- Fix:
-- - Generator functions now accept org_id and filter by it
-- - Advisory locks prevent race conditions per org+year
-- - UNIQUE constraints changed to (org_id, number)
-- - Each org gets its own independent sequence starting at 00001
-- ============================================================

BEGIN;

-- ============================================================
-- 0. Drop old no-arg overloads (replaced by UUID DEFAULT NULL)
-- ============================================================
DROP FUNCTION IF EXISTS public.generate_requisition_number();
DROP FUNCTION IF EXISTS public.generate_po_number();
DROP FUNCTION IF EXISTS public.generate_receipt_number();

-- ============================================================
-- 1. Create org-aware generate_requisition_number(UUID)
-- ============================================================
CREATE OR REPLACE FUNCTION generate_requisition_number(p_org_id UUID DEFAULT NULL)
RETURNS TEXT AS $$
DECLARE
  next_num INTEGER;
  year_prefix TEXT;
  v_org_id UUID;
BEGIN
  -- Use provided org_id or fall back to JWT context
  v_org_id := COALESCE(p_org_id, get_current_org_id());

  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'org_id is required for requisition number generation';
  END IF;

  year_prefix := TO_CHAR(NOW(), 'YY');

  -- Advisory lock: hash of org_id + year to prevent concurrent duplicates
  -- Using hashtext for a stable int hash
  PERFORM pg_advisory_xact_lock(hashtext('req_num_' || v_org_id::text || '_' || year_prefix));

  SELECT COALESCE(MAX(
    CAST(
      SUBSTRING(requisition_number FROM '[0-9]+$') AS INTEGER
    )
  ), 0) + 1
  INTO next_num
  FROM requisitions
  WHERE org_id = v_org_id
    AND requisition_number LIKE 'REQ-' || year_prefix || '-%';

  RETURN 'REQ-' || year_prefix || '-' || LPAD(next_num::TEXT, 5, '0');
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- 2. Replace generate_po_number() with org-aware version
-- ============================================================
CREATE OR REPLACE FUNCTION generate_po_number(p_org_id UUID DEFAULT NULL)
RETURNS TEXT AS $$
DECLARE
  next_num INTEGER;
  year_prefix TEXT;
  v_org_id UUID;
BEGIN
  v_org_id := COALESCE(p_org_id, get_current_org_id());

  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'org_id is required for PO number generation';
  END IF;

  year_prefix := TO_CHAR(NOW(), 'YY');

  PERFORM pg_advisory_xact_lock(hashtext('po_num_' || v_org_id::text || '_' || year_prefix));

  SELECT COALESCE(MAX(
    CAST(
      SUBSTRING(po_number FROM '[0-9]+$') AS INTEGER
    )
  ), 0) + 1
  INTO next_num
  FROM purchase_orders
  WHERE org_id = v_org_id
    AND po_number LIKE 'PO-' || year_prefix || '-%';

  RETURN 'PO-' || year_prefix || '-' || LPAD(next_num::TEXT, 5, '0');
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- 3. Replace generate_receipt_number() with org-aware version
-- ============================================================
CREATE OR REPLACE FUNCTION generate_receipt_number(p_org_id UUID DEFAULT NULL)
RETURNS TEXT AS $$
DECLARE
  next_num INTEGER;
  year_prefix TEXT;
  v_org_id UUID;
BEGIN
  v_org_id := COALESCE(p_org_id, get_current_org_id());

  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'org_id is required for receipt number generation';
  END IF;

  year_prefix := TO_CHAR(NOW(), 'YY');

  PERFORM pg_advisory_xact_lock(hashtext('rcpt_num_' || v_org_id::text || '_' || year_prefix));

  SELECT COALESCE(MAX(
    CAST(
      SUBSTRING(receipt_number FROM '[0-9]+$') AS INTEGER
    )
  ), 0) + 1
  INTO next_num
  FROM receipt_transactions
  WHERE org_id = v_org_id
    AND receipt_number LIKE 'GR-' || year_prefix || '-%';

  RETURN 'GR-' || year_prefix || '-' || LPAD(next_num::TEXT, 5, '0');
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- 4. Update auto-assign trigger to pass org_id
--    (set_org_id_trigger fires first alphabetically, so
--     NEW.org_id is already populated)
-- ============================================================
CREATE OR REPLACE FUNCTION auto_assign_requisition_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.requisition_number IS NULL OR NEW.requisition_number = '' THEN
    NEW.requisition_number := generate_requisition_number(NEW.org_id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- 5. Change UNIQUE constraints from global to per-org
-- ============================================================

-- requisitions: drop global unique, add (org_id, requisition_number)
ALTER TABLE requisitions
  DROP CONSTRAINT IF EXISTS requisitions_requisition_number_key;

ALTER TABLE requisitions
  ADD CONSTRAINT requisitions_org_requisition_number_key
  UNIQUE (org_id, requisition_number);

-- purchase_orders: drop global unique, add (org_id, po_number)
ALTER TABLE purchase_orders
  DROP CONSTRAINT IF EXISTS purchase_orders_po_number_key;

ALTER TABLE purchase_orders
  ADD CONSTRAINT purchase_orders_org_po_number_key
  UNIQUE (org_id, po_number);

-- receipt_transactions: drop global unique, add (org_id, receipt_number)
ALTER TABLE receipt_transactions
  DROP CONSTRAINT IF EXISTS receipt_transactions_receipt_number_key;

ALTER TABLE receipt_transactions
  ADD CONSTRAINT receipt_transactions_org_receipt_number_key
  UNIQUE (org_id, receipt_number);

-- ============================================================
-- 6. Update function comments
-- ============================================================
COMMENT ON FUNCTION generate_requisition_number(UUID) IS 'Generates per-org unique requisition number in format REQ-YY-XXXXX';
COMMENT ON FUNCTION generate_po_number(UUID) IS 'Generates per-org unique PO number in format PO-YY-XXXXX';
COMMENT ON FUNCTION generate_receipt_number(UUID) IS 'Generates per-org unique receipt number in format GR-YY-XXXXX';

-- ============================================================
-- 7. Verify
-- ============================================================
DO $$
DECLARE
  constraint_count INT;
BEGIN
  -- Check that org-scoped unique constraints exist
  SELECT COUNT(*) INTO constraint_count
  FROM information_schema.table_constraints
  WHERE constraint_type = 'UNIQUE'
    AND constraint_name IN (
      'requisitions_org_requisition_number_key',
      'purchase_orders_org_po_number_key',
      'receipt_transactions_org_receipt_number_key'
    );

  IF constraint_count = 3 THEN
    RAISE NOTICE 'OK: All 3 per-org unique constraints created successfully';
  ELSE
    RAISE WARNING 'Expected 3 per-org unique constraints, found %', constraint_count;
  END IF;
END $$;

COMMIT;

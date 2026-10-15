-- Migration: Close remaining segregation-of-duties gaps in requisition workflow
-- Date: 2026-03-04 (rewritten 2026-10-15 against production)
--
-- Production already enforces the requisition workflow with two triggers
-- that were never committed to this repo:
--   trg_validate_requisition_write      -> validate_requisition_write()
--   trg_guard_requisition_items_write   -> guard_requisition_items_write()
-- (status transitions, own-requisition block for reviewers/approvers,
-- reviewed_by/approved_by attribution, content freeze, draft-only items).
-- This migration records their production bodies here and closes the
-- gaps that remained:
--
--   1. In-org super_admins bypassed every rule, including on their OWN
--      requisitions: they could approve their own requisition, or edit
--      its content / line items after approval.
--      -> super_admin powers no longer apply to requisitions they
--         submitted; on their own requisitions they are a normal
--         submitter (edit own draft, submit).
--   2. Requisitions could be INSERTed directly as 'pending', skipping
--      validate_requisition_submission (item count + budget check runs
--      only on draft -> pending).
--      -> INSERT must be 'draft'.
--   3. DELETE was unguarded (super_admin delete policy covers any
--      status, so approved records could be removed).
--      -> API deletes limited to draft / rejected / cancelled.
--
-- Bypass convention is unchanged from production: auth.uid() IS NULL
-- (service role, direct DB) or platform admin.
-- =====================================================

BEGIN;

-- =====================================================
-- STEP 1: validate_requisition_write (production body + fixes 1, 2)
-- =====================================================

CREATE OR REPLACE FUNCTION public.validate_requisition_write()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid;
  v_role text;
  v_same_org boolean;
  v_is_super boolean;
  v_is_own boolean;
  v_old_status text;
  v_new_status text;
  -- Columns allowed to change during a status transition (workflow metadata).
  -- Everything else (title, amounts, project, line content...) is frozen.
  c_workflow_cols CONSTANT text[] := ARRAY[
    'status', 'submitted_at', 'reviewed_by', 'reviewed_at',
    'approved_by', 'approved_at', 'rejection_reason', 'updated_at'
  ];
BEGIN
  v_uid := auth.uid();

  -- Service role, direct DB connections, and platform admins bypass.
  IF v_uid IS NULL OR public.jwt_is_platform_admin() THEN
    RETURN NEW;
  END IF;

  v_role := COALESCE(public.jwt_workflow_role(), 'submitter');

  IF TG_OP = 'INSERT' THEN
    -- Must start as draft so draft -> pending runs the submission checks
    IF NEW.status::text <> 'draft' THEN
      RAISE EXCEPTION 'Requisitions must be created in draft status (got %)', NEW.status;
    END IF;
    IF NEW.submitted_by IS DISTINCT FROM v_uid THEN
      RAISE EXCEPTION 'submitted_by must be the authenticated user';
    END IF;
    IF NEW.reviewed_by IS NOT NULL OR NEW.approved_by IS NOT NULL
       OR NEW.reviewed_at IS NOT NULL OR NEW.approved_at IS NOT NULL THEN
      RAISE EXCEPTION 'Review/approval fields cannot be set when creating a requisition';
    END IF;
    RETURN NEW;
  END IF;

  -- UPDATE path
  v_same_org   := (OLD.org_id IS NOT NULL AND OLD.org_id = public.jwt_org_id());
  v_is_own     := (v_uid = OLD.submitted_by);
  -- Super admin powers never apply to their own requisitions
  v_is_super   := (v_role = 'super_admin' AND v_same_org AND NOT v_is_own);
  v_old_status := OLD.status::text;
  v_new_status := NEW.status::text;

  -- Immutable columns
  IF NEW.submitted_by IS DISTINCT FROM OLD.submitted_by THEN
    RAISE EXCEPTION 'submitted_by cannot be changed';
  END IF;
  IF NEW.org_id IS DISTINCT FROM OLD.org_id THEN
    RAISE EXCEPTION 'org_id cannot be changed';
  END IF;

  -- Attribution: reviewer/approver identity may only be set to the actor.
  -- (In-org super admins may also clear them when correcting mistakes.)
  IF NEW.reviewed_by IS DISTINCT FROM OLD.reviewed_by
     AND NOT (NEW.reviewed_by = v_uid OR (NEW.reviewed_by IS NULL AND v_is_super)) THEN
    RAISE EXCEPTION 'reviewed_by may only be set to the authenticated user';
  END IF;
  IF NEW.approved_by IS DISTINCT FROM OLD.approved_by
     AND NOT (NEW.approved_by = v_uid OR (NEW.approved_by IS NULL AND v_is_super)) THEN
    RAISE EXCEPTION 'approved_by may only be set to the authenticated user';
  END IF;

  -- No status change: plain content edit
  IF v_new_status = v_old_status THEN
    IF v_is_super THEN
      RETURN NEW;
    END IF;
    IF v_old_status = 'draft' AND v_is_own THEN
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'A requisition in % status can no longer be edited', v_old_status;
  END IF;

  -- Status transition: in-org super admin may perform any transition
  -- (on requisitions they did not submit)
  IF v_is_super THEN
    RETURN NEW;
  END IF;

  -- Everyone else: content is frozen during a transition
  IF (to_jsonb(OLD) - c_workflow_cols) IS DISTINCT FROM (to_jsonb(NEW) - c_workflow_cols) THEN
    RAISE EXCEPTION 'Requisition content cannot be modified during a status change';
  END IF;

  -- Submitter submits their own draft
  IF v_old_status = 'draft' AND v_new_status = 'pending' AND v_is_own THEN
    RETURN NEW;
  END IF;

  -- Reviewer / approver actions: same org, never on their own requisition
  IF v_same_org AND NOT v_is_own THEN
    IF v_role = 'reviewer'
       AND v_old_status IN ('pending', 'under_review')
       AND v_new_status IN ('under_review', 'reviewed', 'rejected') THEN
      RETURN NEW;
    END IF;

    IF v_role = 'approver'
       AND v_old_status = 'reviewed'
       AND v_new_status IN ('approved', 'rejected') THEN
      RETURN NEW;
    END IF;
  END IF;

  -- Fulfilment (store manager) on already-approved requisitions,
  -- never on their own requisition
  IF v_same_org AND NOT v_is_own AND v_role = 'store_manager'
     AND v_old_status IN ('approved', 'partially_received')
     AND v_new_status IN ('partially_received', 'completed', 'cancelled') THEN
    RETURN NEW;
  END IF;

  IF v_is_own AND v_new_status IN ('under_review', 'reviewed', 'approved', 'rejected', 'partially_received', 'completed') THEN
    RAISE EXCEPTION 'You cannot review, approve or reject your own requisition';
  END IF;

  RAISE EXCEPTION 'Status change % -> % is not permitted for role %',
    v_old_status, v_new_status, v_role;
END;
$function$;

-- =====================================================
-- STEP 2: guard_requisition_items_write (production body + fix 1)
-- =====================================================

CREATE OR REPLACE FUNCTION public.guard_requisition_items_write()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid;
  v_role text;
  v_org uuid;
  v_req record;
  v_req_ids uuid[];
  v_id uuid;
BEGIN
  v_uid := auth.uid();

  IF v_uid IS NULL OR public.jwt_is_platform_admin() THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  v_role := COALESCE(public.jwt_workflow_role(), 'submitter');
  v_org  := public.jwt_org_id();

  -- An UPDATE could re-parent a line item; validate against both requisitions.
  SELECT array_agg(DISTINCT rid) INTO v_req_ids
  FROM unnest(ARRAY[
    CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN NEW.requisition_id END,
    CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN OLD.requisition_id END
  ]) AS rid
  WHERE rid IS NOT NULL;

  FOREACH v_id IN ARRAY v_req_ids
  LOOP
    SELECT r.status::text AS status, r.org_id, r.submitted_by
    INTO v_req
    FROM requisitions r
    WHERE r.id = v_id;

    -- Parent not found: only reachable when the parent requisition is being
    -- deleted and the FK cascade is removing its line items (the parent row
    -- is already gone when this BEFORE DELETE fires). The delete itself was
    -- authorized by the requisitions DELETE policy, so allow the cascade.
    -- For INSERT/UPDATE the FK constraint guarantees the parent exists.
    IF NOT FOUND THEN
      CONTINUE;
    END IF;

    -- In-org super admin may manage line items, except on their own requisitions
    IF v_role = 'super_admin' AND v_req.org_id IS NOT NULL AND v_req.org_id = v_org
       AND v_req.submitted_by IS DISTINCT FROM v_uid THEN
      CONTINUE;
    END IF;

    -- Submitter may manage line items of their own draft
    IF v_req.status = 'draft' AND v_req.submitted_by = v_uid THEN
      CONTINUE;
    END IF;

    RAISE EXCEPTION 'Line items can only be modified while the requisition is in draft status';
  END LOOP;

  RETURN COALESCE(NEW, OLD);
END;
$function$;

-- =====================================================
-- STEP 3: Delete guard (fix 3)
-- =====================================================

CREATE OR REPLACE FUNCTION public.guard_requisition_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NULL OR public.jwt_is_platform_admin() THEN
    RETURN OLD;
  END IF;

  IF OLD.status::text NOT IN ('draft', 'rejected', 'cancelled') THEN
    RAISE EXCEPTION 'Requisitions with status % cannot be deleted', OLD.status;
  END IF;

  RETURN OLD;
END;
$function$;

DROP TRIGGER IF EXISTS trg_guard_requisition_delete ON public.requisitions;
CREATE TRIGGER trg_guard_requisition_delete
  BEFORE DELETE ON public.requisitions
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_requisition_delete();

-- Production triggers (recorded here; already exist there)
DROP TRIGGER IF EXISTS trg_validate_requisition_write ON public.requisitions;
CREATE TRIGGER trg_validate_requisition_write
  BEFORE INSERT OR UPDATE ON public.requisitions
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_requisition_write();

DROP TRIGGER IF EXISTS trg_guard_requisition_items_write ON public.requisition_items;
CREATE TRIGGER trg_guard_requisition_items_write
  BEFORE INSERT OR UPDATE OR DELETE ON public.requisition_items
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_requisition_items_write();

-- =====================================================
-- STEP 4: Verification
-- =====================================================
DO $$
BEGIN
  IF position('NOT v_is_own' IN pg_get_functiondef('public.validate_requisition_write()'::regprocedure)) = 0 THEN
    RAISE EXCEPTION 'validate_requisition_write missing own-requisition carve-out';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_guard_requisition_delete'
                 AND tgrelid = 'public.requisitions'::regclass) THEN
    RAISE EXCEPTION 'trg_guard_requisition_delete missing';
  END IF;
  RAISE NOTICE 'requisition workflow: super_admin self-approval, pending inserts and approved deletes blocked';
END $$;

COMMIT;

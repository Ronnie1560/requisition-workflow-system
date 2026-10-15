-- Migration: Enforce the requisition approval workflow in the database
-- Date: 2026-03-04
--
-- Problem (segregation of duties):
--   Review/approval rules lived only in the client
--   (RequisitionDetail.jsx canReview/canApprove/canReject). The database
--   accepted any status change the RLS policies let through:
--     - a submitter could UPDATE their own requisition to 'approved'
--       (the UPDATE policy admits submitted_by = auth.uid())
--     - a submitter could INSERT a requisition already 'approved' with
--       approved_by = themselves (INSERT policy only checks submitted_by
--       and org_id; the client passes status through)
--     - reviewed_by / approved_by / *_at stamps were client-supplied
--     - line items could be added/changed on any requisition in the org
--       at any status (INSERT policy only checks org_id), silently
--       changing total_amount after approval
--     - super_admins could delete approved requisitions
--
-- Fix: BEFORE triggers on requisitions and requisition_items that apply
-- to API callers only (current_user authenticated/anon). service_role,
-- SECURITY DEFINER functions and cascaded deletes are not affected.
--
--   Transition                                  Who
--   draft -> pending | cancelled                submitter
--   pending -> cancelled                        submitter
--   pending -> under_review                     reviewer, super_admin
--   under_review -> reviewed                    reviewer, super_admin
--   pending | under_review -> rejected          reviewer, super_admin
--   reviewed -> approved | rejected             approver, super_admin
--   pending | under_review -> approved          super_admin
--   approved -> partially_received | completed  store_manager, super_admin
--   partially_received -> completed             store_manager, super_admin
--
--   Nobody may review, approve, reject or receive a requisition they
--   submitted (super_admins included). Content is editable only by the
--   submitter while 'draft'. Workflow stamps are set by the server.
--   Line items change only while the parent is 'draft', by its submitter.
--   API deletes are limited to draft / rejected / cancelled.
--
-- Statuses are compared as text so the guard does not depend on which
-- enum values an environment has (e.g. 'reviewed').
-- =====================================================

BEGIN;

-- =====================================================
-- STEP 1: requisitions INSERT/UPDATE/DELETE guard
-- =====================================================
-- Must stay SECURITY INVOKER: current_user has to reflect the caller.

CREATE OR REPLACE FUNCTION public.guard_requisition_workflow()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO 'public'
AS $$
DECLARE
  v_actor UUID := (SELECT auth.uid());
  v_role TEXT;
  v_old TEXT;
  v_new TEXT;
  v_is_submitter BOOLEAN;
  v_allowed BOOLEAN;
  v_workflow_cols TEXT[] := ARRAY[
    'status', 'submitted_at', 'reviewed_by', 'reviewed_at',
    'approved_by', 'approved_at', 'rejection_reason', 'updated_at'
  ];
BEGIN
  -- Only constrain direct API writes (PostgREST runs as authenticated/anon).
  IF current_user NOT IN ('authenticated', 'anon') THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  -- ---------- INSERT: new requisitions always start as draft ----------
  IF TG_OP = 'INSERT' THEN
    IF NEW.status::TEXT <> 'draft' THEN
      RAISE EXCEPTION 'New requisitions must start as draft'
        USING ERRCODE = '42501';
    END IF;
    NEW.submitted_at := NULL;
    NEW.reviewed_by := NULL;
    NEW.reviewed_at := NULL;
    NEW.approved_by := NULL;
    NEW.approved_at := NULL;
    RETURN NEW;
  END IF;

  -- ---------- DELETE: keep in-flight and approved records ----------
  IF TG_OP = 'DELETE' THEN
    IF OLD.status::TEXT NOT IN ('draft', 'rejected', 'cancelled') THEN
      RAISE EXCEPTION 'Requisitions with status % cannot be deleted', OLD.status
        USING ERRCODE = '42501';
    END IF;
    RETURN OLD;
  END IF;

  -- ---------- UPDATE ----------
  v_old := OLD.status::TEXT;
  v_new := NEW.status::TEXT;
  v_is_submitter := OLD.submitted_by = v_actor;

  -- Content (everything except workflow columns) is frozen once submitted
  IF (to_jsonb(NEW) - v_workflow_cols) IS DISTINCT FROM (to_jsonb(OLD) - v_workflow_cols) THEN
    IF NOT (v_old = 'draft' AND v_new = 'draft' AND v_is_submitter) THEN
      RAISE EXCEPTION 'Requisition details can only be edited by the submitter while it is a draft'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  -- No status change: workflow stamps are not editable
  IF v_new = v_old THEN
    IF NEW.submitted_at IS DISTINCT FROM OLD.submitted_at
       OR NEW.reviewed_by IS DISTINCT FROM OLD.reviewed_by
       OR NEW.reviewed_at IS DISTINCT FROM OLD.reviewed_at
       OR NEW.approved_by IS DISTINCT FROM OLD.approved_by
       OR NEW.approved_at IS DISTINCT FROM OLD.approved_at
       OR NEW.rejection_reason IS DISTINCT FROM OLD.rejection_reason THEN
      RAISE EXCEPTION 'Review and approval details cannot be edited directly'
        USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
  END IF;

  -- Segregation of duties: the submitter may only submit or withdraw
  IF v_is_submitter
     AND NOT (v_old = 'draft' AND v_new IN ('pending', 'cancelled'))
     AND NOT (v_old = 'pending' AND v_new = 'cancelled') THEN
    RAISE EXCEPTION 'You cannot review, approve or reject your own requisition'
      USING ERRCODE = '42501';
  END IF;

  v_role := public.get_user_role(OLD.org_id)::TEXT;

  v_allowed := CASE
    WHEN v_old = 'draft' AND v_new IN ('pending', 'cancelled') THEN v_is_submitter
    WHEN v_old = 'pending' AND v_new = 'cancelled' THEN v_is_submitter
    WHEN v_old = 'pending' AND v_new = 'under_review' THEN v_role IN ('reviewer', 'super_admin')
    WHEN v_old = 'under_review' AND v_new = 'reviewed' THEN v_role IN ('reviewer', 'super_admin')
    WHEN v_old IN ('pending', 'under_review') AND v_new = 'rejected' THEN v_role IN ('reviewer', 'super_admin')
    WHEN v_old = 'reviewed' AND v_new IN ('approved', 'rejected') THEN v_role IN ('approver', 'super_admin')
    WHEN v_old IN ('pending', 'under_review') AND v_new = 'approved' THEN v_role = 'super_admin'
    WHEN v_old = 'approved' AND v_new IN ('partially_received', 'completed') THEN v_role IN ('store_manager', 'super_admin')
    WHEN v_old = 'partially_received' AND v_new = 'completed' THEN v_role IN ('store_manager', 'super_admin')
    ELSE false
  END;

  IF NOT v_allowed THEN
    RAISE EXCEPTION 'Requisition cannot move from % to % (your role: %)', v_old, v_new, v_role
      USING ERRCODE = '42501';
  END IF;

  -- Server-owned stamps: who acted and when
  NEW.submitted_at := CASE WHEN v_new = 'pending' THEN NOW() ELSE OLD.submitted_at END;

  IF v_new IN ('reviewed', 'rejected') THEN
    NEW.reviewed_by := v_actor;
    NEW.reviewed_at := NOW();
  ELSE
    NEW.reviewed_by := OLD.reviewed_by;
    NEW.reviewed_at := OLD.reviewed_at;
  END IF;

  IF v_new = 'approved' THEN
    NEW.approved_by := v_actor;
    NEW.approved_at := NOW();
  ELSE
    NEW.approved_by := OLD.approved_by;
    NEW.approved_at := OLD.approved_at;
  END IF;

  IF v_new <> 'rejected' THEN
    NEW.rejection_reason := OLD.rejection_reason;
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.guard_requisition_workflow() IS
  'Enforces requisition status transitions, segregation of duties and server-set '
  'review/approval stamps for API callers. service_role and SECURITY DEFINER bypass it.';

DROP TRIGGER IF EXISTS guard_requisition_workflow ON public.requisitions;
CREATE TRIGGER guard_requisition_workflow
  BEFORE INSERT OR UPDATE OR DELETE ON public.requisitions
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_requisition_workflow();

-- =====================================================
-- STEP 2: requisition_items only change on the submitter's draft
-- =====================================================

CREATE OR REPLACE FUNCTION public.guard_requisition_items_draft_only()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO 'public'
AS $$
DECLARE
  v_req_id UUID;
  v_status TEXT;
  v_submitter UUID;
BEGIN
  IF current_user NOT IN ('authenticated', 'anon') THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  -- Check the parent before (OLD) and after (NEW) the change
  FOREACH v_req_id IN ARRAY ARRAY[
    CASE WHEN TG_OP <> 'INSERT' THEN OLD.requisition_id END,
    CASE WHEN TG_OP <> 'DELETE' THEN NEW.requisition_id END
  ]
  LOOP
    CONTINUE WHEN v_req_id IS NULL;

    SELECT r.status::TEXT, r.submitted_by INTO v_status, v_submitter
    FROM public.requisitions r
    WHERE r.id = v_req_id;

    IF v_status IS DISTINCT FROM 'draft' OR v_submitter IS DISTINCT FROM (SELECT auth.uid()) THEN
      RAISE EXCEPTION 'Line items can only be changed by the submitter while the requisition is a draft'
        USING ERRCODE = '42501';
    END IF;
  END LOOP;

  RETURN COALESCE(NEW, OLD);
END;
$$;

COMMENT ON FUNCTION public.guard_requisition_items_draft_only() IS
  'Blocks API changes to requisition_items unless the parent requisition is a draft '
  'owned by the caller. service_role, SECURITY DEFINER and cascades bypass it.';

DROP TRIGGER IF EXISTS guard_requisition_items_draft_only ON public.requisition_items;
CREATE TRIGGER guard_requisition_items_draft_only
  BEFORE INSERT OR UPDATE OR DELETE ON public.requisition_items
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_requisition_items_draft_only();

-- =====================================================
-- STEP 3: Verification
-- =====================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'guard_requisition_workflow'
                 AND tgrelid = 'public.requisitions'::regclass) THEN
    RAISE EXCEPTION 'guard_requisition_workflow trigger missing';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'guard_requisition_items_draft_only'
                 AND tgrelid = 'public.requisition_items'::regclass) THEN
    RAISE EXCEPTION 'guard_requisition_items_draft_only trigger missing';
  END IF;
  RAISE NOTICE 'requisition workflow enforced (transitions, segregation of duties, draft-only items)';
END $$;

COMMIT;

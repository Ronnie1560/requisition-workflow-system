-- ============================================================
-- Fix: Email Notification Functions for Multi-Tenancy
-- ============================================================
-- Issues fixed:
-- 1. notify_on_requisition_status_change() notifies reviewers/admins
--    across ALL orgs instead of just the requisition's org.
--    Also uses deprecated 'role' column instead of 'workflow_role'.
-- 2. Email template functions fetch organization_settings with
--    LIMIT 1 and no org filter — picks a random org's base URL.
-- 3. create_notification() doesn't explicitly set org_id — relies
--    on set_org_id_trigger which may not work reliably in
--    SECURITY DEFINER context.
-- ============================================================

BEGIN;

-- ============================================================
-- 1. Fix notify_on_requisition_status_change() — scope to org
-- ============================================================
CREATE OR REPLACE FUNCTION notify_on_requisition_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  submitter_name TEXT;
  reviewer_name TEXT;
  approver_name TEXT;
  reviewer_ids UUID[];
  admin_ids UUID[];
  msg TEXT;
  link_url TEXT;
  v_org_id UUID;
BEGIN
  link_url := '/requisitions/' || NEW.id::TEXT;
  v_org_id := NEW.org_id;

  SELECT full_name INTO submitter_name
  FROM users
  WHERE id = NEW.submitted_by;

  -- CASE 1: Submitted for Review
  -- Notify reviewers and super_admins in the SAME org only
  IF NEW.status = 'pending' AND (OLD.status IS NULL OR OLD.status = 'draft') THEN
    SELECT ARRAY_AGG(u.id) INTO reviewer_ids
    FROM users u
    INNER JOIN organization_members om ON om.user_id = u.id
    WHERE om.organization_id = v_org_id
      AND om.workflow_role IN ('reviewer', 'super_admin')
      AND u.id != NEW.submitted_by;

    IF reviewer_ids IS NOT NULL THEN
      msg := COALESCE(submitter_name, 'Someone') || ' submitted requisition "' || NEW.title || '" for review.';
      PERFORM create_notification_for_users(
        reviewer_ids,
        'requisition_submitted',
        'New Requisition Submitted',
        msg,
        link_url
      );
    END IF;
  END IF;

  -- CASE 2: Marked as Reviewed
  -- Notify submitter + super_admins in the SAME org
  IF NEW.status = 'reviewed'
     AND (OLD.status IS NULL OR OLD.status = 'pending')
     AND NEW.reviewed_by IS NOT NULL THEN

    SELECT full_name INTO reviewer_name
    FROM users
    WHERE id = NEW.reviewed_by;

    msg := 'Your requisition "' || NEW.title || '" has been reviewed by ' ||
           COALESCE(reviewer_name, 'a reviewer') || ' and is pending approval.';
    PERFORM create_notification(
      NEW.submitted_by,
      'requisition_reviewed',
      'Requisition Reviewed',
      msg,
      link_url
    );

    SELECT ARRAY_AGG(u.id) INTO admin_ids
    FROM users u
    INNER JOIN organization_members om ON om.user_id = u.id
    WHERE om.organization_id = v_org_id
      AND om.workflow_role = 'super_admin'
      AND u.id != NEW.submitted_by
      AND u.id != NEW.reviewed_by;

    IF admin_ids IS NOT NULL THEN
      msg := 'Requisition "' || NEW.title || '" has been reviewed by ' ||
             COALESCE(reviewer_name, 'a reviewer') || ' and needs your approval.';
      PERFORM create_notification_for_users(
        admin_ids,
        'requisition_pending_approval',
        'Requisition Pending Approval',
        msg,
        link_url
      );
    END IF;
  END IF;

  -- CASE 3: Approved
  IF NEW.status = 'approved' AND (OLD.status IS NULL OR OLD.status != 'approved') THEN
    SELECT full_name INTO approver_name
    FROM users
    WHERE id = NEW.approved_by;

    msg := 'Your requisition "' || NEW.title || '" has been approved';
    IF approver_name IS NOT NULL THEN
      msg := msg || ' by ' || approver_name;
    END IF;
    msg := msg || '.';
    PERFORM create_notification(
      NEW.submitted_by,
      'requisition_approved',
      'Requisition Approved',
      msg,
      link_url
    );

    IF NEW.reviewed_by IS NOT NULL AND NEW.reviewed_by != NEW.approved_by THEN
      msg := 'Requisition "' || NEW.title || '" that you reviewed has been approved';
      IF approver_name IS NOT NULL THEN
        msg := msg || ' by ' || approver_name;
      END IF;
      msg := msg || '.';
      PERFORM create_notification(
        NEW.reviewed_by,
        'requisition_approved',
        'Requisition Approved',
        msg,
        link_url
      );
    END IF;
  END IF;

  -- CASE 4: Rejected
  IF NEW.status = 'rejected' AND (OLD.status IS NULL OR OLD.status != 'rejected') THEN
    SELECT full_name INTO reviewer_name
    FROM users
    WHERE id = COALESCE(NEW.approved_by, NEW.reviewed_by);

    msg := 'Your requisition "' || NEW.title || '" has been rejected';
    IF reviewer_name IS NOT NULL THEN
      msg := msg || ' by ' || reviewer_name;
    END IF;
    msg := msg || '.';
    IF NEW.rejection_reason IS NOT NULL THEN
      msg := msg || ' Reason: ' || NEW.rejection_reason;
    END IF;
    PERFORM create_notification(
      NEW.submitted_by,
      'requisition_rejected',
      'Requisition Rejected',
      msg,
      link_url
    );

    IF NEW.reviewed_by IS NOT NULL
       AND NEW.reviewed_by != COALESCE(NEW.approved_by, NEW.reviewed_by) THEN
      msg := 'Requisition "' || NEW.title || '" that you reviewed has been rejected';
      IF reviewer_name IS NOT NULL THEN
        msg := msg || ' by ' || reviewer_name;
      END IF;
      msg := msg || '.';
      PERFORM create_notification(
        NEW.reviewed_by,
        'requisition_rejected',
        'Requisition Rejected',
        msg,
        link_url
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- ============================================================
-- 2. Fix email template functions — org-scoped settings lookup
-- ============================================================

-- generate_submission_email: use requisition's org_id for settings
CREATE OR REPLACE FUNCTION generate_submission_email(
  p_requisition_id UUID,
  p_recipient_name TEXT
)
RETURNS TABLE(subject TEXT, body_html TEXT, body_text TEXT)
LANGUAGE plpgsql
SET search_path = 'public'
AS $$
DECLARE
  req RECORD;
  org_name TEXT;
  base_url TEXT;
BEGIN
  SELECT
    r.requisition_number,
    r.title,
    r.total_amount,
    r.org_id,
    o.name as organization_name,
    u.full_name as submitter_name,
    p.name as project_name
  INTO req
  FROM requisitions r
  LEFT JOIN organizations o ON r.org_id = o.id
  LEFT JOIN users u ON r.submitted_by = u.id
  LEFT JOIN projects p ON r.project_id = p.id
  WHERE r.id = p_requisition_id;

  -- Get base URL from THIS org's settings
  SELECT os.app_base_url INTO base_url
  FROM organization_settings os
  WHERE os.org_id = req.org_id;

  base_url := COALESCE(base_url, 'https://ledgerworkflow.com');
  org_name := COALESCE(req.organization_name, 'Requisition Workflow');

  RETURN QUERY SELECT
    ('New Requisition Submitted: ' || req.requisition_number)::TEXT,
    ('<html><body>' ||
     '<h2 style="color: #2563eb;">New Requisition Submitted</h2>' ||
     '<p>Dear ' || p_recipient_name || ',</p>' ||
     '<p>A new requisition has been submitted in <strong>' || org_name || '</strong> and requires your attention.</p>' ||
     '<table style="border-collapse: collapse; margin: 20px 0;">' ||
     '<tr><td style="padding: 8px; font-weight: bold;">Requisition #:</td><td style="padding: 8px;">' || req.requisition_number || '</td></tr>' ||
     '<tr><td style="padding: 8px; font-weight: bold;">Title:</td><td style="padding: 8px;">' || req.title || '</td></tr>' ||
     '<tr><td style="padding: 8px; font-weight: bold;">Submitted By:</td><td style="padding: 8px;">' || COALESCE(req.submitter_name, 'N/A') || '</td></tr>' ||
     '<tr><td style="padding: 8px; font-weight: bold;">Project:</td><td style="padding: 8px;">' || COALESCE(req.project_name, 'N/A') || '</td></tr>' ||
     '<tr><td style="padding: 8px; font-weight: bold;">Amount:</td><td style="padding: 8px;">UGX ' || TO_CHAR(req.total_amount, 'FM999,999,999') || '</td></tr>' ||
     '</table>' ||
     '<p><a href="' || base_url || '/requisitions/' || p_requisition_id || '" ' ||
     'style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">View Requisition</a></p>' ||
     '<p style="color: #666; margin-top: 30px;">This is an automated message from ' || org_name || '.</p>' ||
     '</body></html>')::TEXT,
    ('New Requisition Submitted' || E'\n\n' ||
     'Dear ' || p_recipient_name || ',' || E'\n\n' ||
     'A new requisition has been submitted in ' || org_name || ' and requires your attention.' || E'\n\n' ||
     'Requisition #: ' || req.requisition_number || E'\n' ||
     'Title: ' || req.title || E'\n' ||
     'Submitted By: ' || COALESCE(req.submitter_name, 'N/A') || E'\n' ||
     'Project: ' || COALESCE(req.project_name, 'N/A') || E'\n' ||
     'Amount: UGX ' || TO_CHAR(req.total_amount, 'FM999,999,999') || E'\n\n' ||
     'View requisition at: ' || base_url || '/requisitions/' || p_requisition_id || E'\n\n' ||
     'This is an automated message from ' || org_name || '.')::TEXT;
END;
$$;

-- generate_approval_email: use requisition's org_id for settings
CREATE OR REPLACE FUNCTION generate_approval_email(
  p_requisition_id UUID,
  p_recipient_name TEXT,
  p_approver_name TEXT
)
RETURNS TABLE(subject TEXT, body_html TEXT, body_text TEXT)
LANGUAGE plpgsql
SET search_path = 'public'
AS $$
DECLARE
  req RECORD;
  org_name TEXT;
  base_url TEXT;
BEGIN
  SELECT
    r.requisition_number,
    r.title,
    r.total_amount,
    r.org_id,
    o.name as organization_name
  INTO req
  FROM requisitions r
  LEFT JOIN organizations o ON r.org_id = o.id
  WHERE r.id = p_requisition_id;

  SELECT os.app_base_url INTO base_url
  FROM organization_settings os
  WHERE os.org_id = req.org_id;

  base_url := COALESCE(base_url, 'https://ledgerworkflow.com');
  org_name := COALESCE(req.organization_name, 'Requisition Workflow');

  RETURN QUERY SELECT
    ('Requisition Approved: ' || req.requisition_number)::TEXT,
    ('<html><body>' ||
     '<h2 style="color: #059669;">Requisition Approved</h2>' ||
     '<p>Dear ' || p_recipient_name || ',</p>' ||
     '<p>Your requisition in <strong>' || org_name || '</strong> has been approved!</p>' ||
     '<table style="border-collapse: collapse; margin: 20px 0;">' ||
     '<tr><td style="padding: 8px; font-weight: bold;">Requisition #:</td><td style="padding: 8px;">' || req.requisition_number || '</td></tr>' ||
     '<tr><td style="padding: 8px; font-weight: bold;">Title:</td><td style="padding: 8px;">' || req.title || '</td></tr>' ||
     '<tr><td style="padding: 8px; font-weight: bold;">Amount:</td><td style="padding: 8px;">UGX ' || TO_CHAR(req.total_amount, 'FM999,999,999') || '</td></tr>' ||
     '<tr><td style="padding: 8px; font-weight: bold;">Approved By:</td><td style="padding: 8px;">' || p_approver_name || '</td></tr>' ||
     '</table>' ||
     '<p><a href="' || base_url || '/requisitions/' || p_requisition_id || '" ' ||
     'style="background-color: #059669; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">View Requisition</a></p>' ||
     '<p style="color: #666; margin-top: 30px;">This is an automated message from ' || org_name || '.</p>' ||
     '</body></html>')::TEXT,
    ('Requisition Approved' || E'\n\n' ||
     'Dear ' || p_recipient_name || ',' || E'\n\n' ||
     'Your requisition in ' || org_name || ' has been approved!' || E'\n\n' ||
     'Requisition #: ' || req.requisition_number || E'\n' ||
     'Title: ' || req.title || E'\n' ||
     'Amount: UGX ' || TO_CHAR(req.total_amount, 'FM999,999,999') || E'\n' ||
     'Approved By: ' || p_approver_name || E'\n\n' ||
     'View requisition at: ' || base_url || '/requisitions/' || p_requisition_id || E'\n\n' ||
     'This is an automated message from ' || org_name || '.')::TEXT;
END;
$$;

-- generate_rejection_email: use requisition's org_id for settings
CREATE OR REPLACE FUNCTION generate_rejection_email(
  p_requisition_id UUID,
  p_recipient_name TEXT,
  p_rejector_name TEXT,
  p_rejection_reason TEXT
)
RETURNS TABLE(subject TEXT, body_html TEXT, body_text TEXT)
LANGUAGE plpgsql
SET search_path = 'public'
AS $$
DECLARE
  req RECORD;
  org_name TEXT;
  base_url TEXT;
BEGIN
  SELECT
    r.requisition_number,
    r.title,
    r.total_amount,
    r.org_id,
    o.name as organization_name
  INTO req
  FROM requisitions r
  LEFT JOIN organizations o ON r.org_id = o.id
  WHERE r.id = p_requisition_id;

  SELECT os.app_base_url INTO base_url
  FROM organization_settings os
  WHERE os.org_id = req.org_id;

  base_url := COALESCE(base_url, 'https://ledgerworkflow.com');
  org_name := COALESCE(req.organization_name, 'Requisition Workflow');

  RETURN QUERY SELECT
    ('Requisition Rejected: ' || req.requisition_number)::TEXT,
    ('<html><body>' ||
     '<h2 style="color: #dc2626;">Requisition Rejected</h2>' ||
     '<p>Dear ' || p_recipient_name || ',</p>' ||
     '<p>Your requisition in <strong>' || org_name || '</strong> has been rejected.</p>' ||
     '<table style="border-collapse: collapse; margin: 20px 0;">' ||
     '<tr><td style="padding: 8px; font-weight: bold;">Requisition #:</td><td style="padding: 8px;">' || req.requisition_number || '</td></tr>' ||
     '<tr><td style="padding: 8px; font-weight: bold;">Title:</td><td style="padding: 8px;">' || req.title || '</td></tr>' ||
     '<tr><td style="padding: 8px; font-weight: bold;">Amount:</td><td style="padding: 8px;">UGX ' || TO_CHAR(req.total_amount, 'FM999,999,999') || '</td></tr>' ||
     '<tr><td style="padding: 8px; font-weight: bold;">Rejected By:</td><td style="padding: 8px;">' || p_rejector_name || '</td></tr>' ||
     CASE WHEN p_rejection_reason IS NOT NULL THEN
       '<tr><td style="padding: 8px; font-weight: bold;">Reason:</td><td style="padding: 8px;">' || p_rejection_reason || '</td></tr>'
     ELSE '' END ||
     '</table>' ||
     '<p><a href="' || base_url || '/requisitions/' || p_requisition_id || '" ' ||
     'style="background-color: #dc2626; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">View Requisition</a></p>' ||
     '<p style="color: #666; margin-top: 30px;">This is an automated message from ' || org_name || '.</p>' ||
     '</body></html>')::TEXT,
    ('Requisition Rejected' || E'\n\n' ||
     'Dear ' || p_recipient_name || ',' || E'\n\n' ||
     'Your requisition in ' || org_name || ' has been rejected.' || E'\n\n' ||
     'Requisition #: ' || req.requisition_number || E'\n' ||
     'Title: ' || req.title || E'\n' ||
     'Amount: UGX ' || TO_CHAR(req.total_amount, 'FM999,999,999') || E'\n' ||
     'Rejected By: ' || p_rejector_name || E'\n' ||
     CASE WHEN p_rejection_reason IS NOT NULL THEN 'Reason: ' || p_rejection_reason || E'\n' ELSE '' END || E'\n' ||
     'View requisition at: ' || base_url || '/requisitions/' || p_requisition_id || E'\n\n' ||
     'This is an automated message from ' || org_name || '.')::TEXT;
END;
$$;

-- ============================================================
-- 3. Fix create_notification() — explicitly set org_id
--    Instead of relying on set_org_id_trigger (fragile in
--    SECURITY DEFINER context), accept org_id as parameter
-- ============================================================

-- Add org-aware overload that callers should prefer
CREATE OR REPLACE FUNCTION create_notification(
  p_user_id UUID,
  p_type TEXT,
  p_title TEXT,
  p_message TEXT,
  p_link TEXT,
  p_org_id UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  notification_id UUID;
BEGIN
  INSERT INTO notifications (
    user_id,
    type,
    title,
    message,
    link,
    org_id,
    is_read,
    created_at
  )
  VALUES (
    p_user_id,
    p_type,
    p_title,
    p_message,
    p_link,
    p_org_id,
    false,
    NOW()
  )
  RETURNING id INTO notification_id;

  RETURN notification_id;
END;
$$;

-- ============================================================
-- 4. Update notify_on_requisition_status_change to pass org_id
--    to create_notification (use the 6-param overload)
-- ============================================================

-- Already done in step 1 above — but the create_notification calls
-- in step 1 use the 5-param version (no org_id). Let's update the
-- trigger to use the org-aware version.
CREATE OR REPLACE FUNCTION notify_on_requisition_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  submitter_name TEXT;
  reviewer_name TEXT;
  approver_name TEXT;
  reviewer_ids UUID[];
  admin_ids UUID[];
  msg TEXT;
  link_url TEXT;
  v_org_id UUID;
BEGIN
  link_url := '/requisitions/' || NEW.id::TEXT;
  v_org_id := NEW.org_id;

  SELECT full_name INTO submitter_name
  FROM users
  WHERE id = NEW.submitted_by;

  -- CASE 1: Submitted for Review
  IF NEW.status = 'pending' AND (OLD.status IS NULL OR OLD.status = 'draft') THEN
    SELECT ARRAY_AGG(u.id) INTO reviewer_ids
    FROM users u
    INNER JOIN organization_members om ON om.user_id = u.id
    WHERE om.organization_id = v_org_id
      AND om.workflow_role IN ('reviewer', 'super_admin')
      AND u.id != NEW.submitted_by;

    IF reviewer_ids IS NOT NULL THEN
      msg := COALESCE(submitter_name, 'Someone') || ' submitted requisition "' || NEW.title || '" for review.';
      PERFORM create_notification(
        unnest(reviewer_ids),
        'requisition_submitted',
        'New Requisition Submitted',
        msg,
        link_url,
        v_org_id
      );
    END IF;
  END IF;

  -- CASE 2: Marked as Reviewed
  IF NEW.status = 'reviewed'
     AND (OLD.status IS NULL OR OLD.status = 'pending')
     AND NEW.reviewed_by IS NOT NULL THEN

    SELECT full_name INTO reviewer_name
    FROM users
    WHERE id = NEW.reviewed_by;

    msg := 'Your requisition "' || NEW.title || '" has been reviewed by ' ||
           COALESCE(reviewer_name, 'a reviewer') || ' and is pending approval.';
    PERFORM create_notification(
      NEW.submitted_by,
      'requisition_reviewed',
      'Requisition Reviewed',
      msg,
      link_url,
      v_org_id
    );

    SELECT ARRAY_AGG(u.id) INTO admin_ids
    FROM users u
    INNER JOIN organization_members om ON om.user_id = u.id
    WHERE om.organization_id = v_org_id
      AND om.workflow_role = 'super_admin'
      AND u.id != NEW.submitted_by
      AND u.id != NEW.reviewed_by;

    IF admin_ids IS NOT NULL THEN
      msg := 'Requisition "' || NEW.title || '" has been reviewed by ' ||
             COALESCE(reviewer_name, 'a reviewer') || ' and needs your approval.';
      PERFORM create_notification(
        unnest(admin_ids),
        'requisition_pending_approval',
        'Requisition Pending Approval',
        msg,
        link_url,
        v_org_id
      );
    END IF;
  END IF;

  -- CASE 3: Approved
  IF NEW.status = 'approved' AND (OLD.status IS NULL OR OLD.status != 'approved') THEN
    SELECT full_name INTO approver_name
    FROM users
    WHERE id = NEW.approved_by;

    msg := 'Your requisition "' || NEW.title || '" has been approved';
    IF approver_name IS NOT NULL THEN
      msg := msg || ' by ' || approver_name;
    END IF;
    msg := msg || '.';
    PERFORM create_notification(
      NEW.submitted_by,
      'requisition_approved',
      'Requisition Approved',
      msg,
      link_url,
      v_org_id
    );

    IF NEW.reviewed_by IS NOT NULL AND NEW.reviewed_by != NEW.approved_by THEN
      msg := 'Requisition "' || NEW.title || '" that you reviewed has been approved';
      IF approver_name IS NOT NULL THEN
        msg := msg || ' by ' || approver_name;
      END IF;
      msg := msg || '.';
      PERFORM create_notification(
        NEW.reviewed_by,
        'requisition_approved',
        'Requisition Approved',
        msg,
        link_url,
        v_org_id
      );
    END IF;
  END IF;

  -- CASE 4: Rejected
  IF NEW.status = 'rejected' AND (OLD.status IS NULL OR OLD.status != 'rejected') THEN
    SELECT full_name INTO reviewer_name
    FROM users
    WHERE id = COALESCE(NEW.approved_by, NEW.reviewed_by);

    msg := 'Your requisition "' || NEW.title || '" has been rejected';
    IF reviewer_name IS NOT NULL THEN
      msg := msg || ' by ' || reviewer_name;
    END IF;
    msg := msg || '.';
    IF NEW.rejection_reason IS NOT NULL THEN
      msg := msg || ' Reason: ' || NEW.rejection_reason;
    END IF;
    PERFORM create_notification(
      NEW.submitted_by,
      'requisition_rejected',
      'Requisition Rejected',
      msg,
      link_url,
      v_org_id
    );

    IF NEW.reviewed_by IS NOT NULL
       AND NEW.reviewed_by != COALESCE(NEW.approved_by, NEW.reviewed_by) THEN
      msg := 'Requisition "' || NEW.title || '" that you reviewed has been rejected';
      IF reviewer_name IS NOT NULL THEN
        msg := msg || ' by ' || reviewer_name;
      END IF;
      msg := msg || '.';
      PERFORM create_notification(
        NEW.reviewed_by,
        'requisition_rejected',
        'Requisition Rejected',
        msg,
        link_url,
        v_org_id
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- ============================================================
-- 5. Update notify_new_comment to pass org_id explicitly
-- ============================================================
CREATE OR REPLACE FUNCTION notify_new_comment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_requisition_submitter UUID;
  v_requisition_number VARCHAR(50);
  v_commenter_name TEXT;
  v_org_id UUID;
BEGIN
  -- Skip internal/system comments
  IF NEW.is_internal = true THEN
    RETURN NEW;
  END IF;

  -- Get requisition info including org_id
  SELECT r.submitted_by, r.requisition_number, r.org_id
  INTO v_requisition_submitter, v_requisition_number, v_org_id
  FROM public.requisitions r
  WHERE r.id = NEW.requisition_id;

  -- Get commenter name
  SELECT full_name INTO v_commenter_name
  FROM public.users
  WHERE id = NEW.user_id;

  -- Notify the requisition submitter (if not the commenter)
  IF v_requisition_submitter IS NOT NULL AND v_requisition_submitter != NEW.user_id THEN
    PERFORM public.create_notification(
      v_requisition_submitter,
      'comment_added'::text,
      'New Comment on Your Requisition'::text,
      format('%s commented on requisition %s', v_commenter_name, v_requisition_number)::text,
      '/requisitions/' || NEW.requisition_id::text,
      v_org_id
    );
  END IF;

  RETURN NEW;
END;
$$;

-- ============================================================
-- 6. Verify
-- ============================================================
DO $$
DECLARE
  fn_count INT;
BEGIN
  -- Verify create_notification has both overloads (5-param + 6-param)
  SELECT COUNT(*) INTO fn_count
  FROM pg_proc
  WHERE proname = 'create_notification'
    AND pronamespace = 'public'::regnamespace;

  RAISE NOTICE 'create_notification overloads: % (expected 2: 5-param + 6-param)', fn_count;

  -- Verify notify_on_requisition_status_change exists
  SELECT COUNT(*) INTO fn_count
  FROM pg_proc
  WHERE proname = 'notify_on_requisition_status_change'
    AND pronamespace = 'public'::regnamespace;

  RAISE NOTICE 'notify_on_requisition_status_change functions: %', fn_count;
END $$;

COMMIT;

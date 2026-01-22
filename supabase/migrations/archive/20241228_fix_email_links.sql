-- =====================================================
-- Fix Email Notification Links
-- Date: 2024-12-28
-- Description: Update email template functions to use correct production URL
--
-- This fixes the issue where "View Requisition" links in emails
-- were showing as "http://requisitions/..." instead of the full URL
-- =====================================================

BEGIN;

-- ============================================
-- Update Submission Email Template
-- ============================================

CREATE OR REPLACE FUNCTION generate_submission_email(
  p_requisition_id UUID,
  p_recipient_name TEXT
)
RETURNS TABLE(subject TEXT, body_html TEXT, body_text TEXT)
LANGUAGE plpgsql
AS $$
DECLARE
  req RECORD;
  org_name TEXT;
BEGIN
  -- Get requisition details
  SELECT
    r.requisition_number,
    r.title,
    r.total_amount,
    u.full_name as submitter_name,
    p.name as project_name
  INTO req
  FROM requisitions r
  LEFT JOIN users u ON r.submitted_by = u.id
  LEFT JOIN projects p ON r.project_id = p.id
  WHERE r.id = p_requisition_id;

  -- Get organization name
  SELECT organization_name INTO org_name
  FROM organization_settings
  LIMIT 1;

  RETURN QUERY SELECT
    ('New Requisition: ' || req.requisition_number)::TEXT,
    -- HTML version
    ('<html><body>' ||
     '<h2>New Requisition Submitted</h2>' ||
     '<p>Dear ' || p_recipient_name || ',</p>' ||
     '<p>A new requisition has been submitted and requires your attention.</p>' ||
     '<table style="border-collapse: collapse; margin: 20px 0;">' ||
     '<tr><td style="padding: 8px; font-weight: bold;">Requisition #:</td><td style="padding: 8px;">' || req.requisition_number || '</td></tr>' ||
     '<tr><td style="padding: 8px; font-weight: bold;">Title:</td><td style="padding: 8px;">' || req.title || '</td></tr>' ||
     '<tr><td style="padding: 8px; font-weight: bold;">Submitted By:</td><td style="padding: 8px;">' || req.submitter_name || '</td></tr>' ||
     '<tr><td style="padding: 8px; font-weight: bold;">Project:</td><td style="padding: 8px;">' || COALESCE(req.project_name, 'N/A') || '</td></tr>' ||
     '<tr><td style="padding: 8px; font-weight: bold;">Amount:</td><td style="padding: 8px;">UGX ' || TO_CHAR(req.total_amount, 'FM999,999,999') || '</td></tr>' ||
     '</table>' ||
     '<p><a href="' || COALESCE(current_setting('app.base_url', true), 'https://requisition-workflow.vercel.app') || '/requisitions/' || p_requisition_id || '" ' ||
     'style="background-color: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">View Requisition</a></p>' ||
     '<p style="color: #666; margin-top: 30px;">This is an automated message from ' || COALESCE(org_name, 'Requisition System') || '.</p>' ||
     '</body></html>')::TEXT,
    -- Text version
    ('New Requisition Submitted' || E'\n\n' ||
     'Dear ' || p_recipient_name || ',' || E'\n\n' ||
     'A new requisition has been submitted and requires your attention.' || E'\n\n' ||
     'Requisition #: ' || req.requisition_number || E'\n' ||
     'Title: ' || req.title || E'\n' ||
     'Submitted By: ' || req.submitter_name || E'\n' ||
     'Project: ' || COALESCE(req.project_name, 'N/A') || E'\n' ||
     'Amount: UGX ' || TO_CHAR(req.total_amount, 'FM999,999,999') || E'\n\n' ||
     'View requisition at: ' || COALESCE(current_setting('app.base_url', true), 'https://requisition-workflow.vercel.app') || '/requisitions/' || p_requisition_id || E'\n\n' ||
     'This is an automated message from ' || COALESCE(org_name, 'Requisition System') || '.')::TEXT;
END;
$$;

-- ============================================
-- Update Approval Email Template
-- ============================================

CREATE OR REPLACE FUNCTION generate_approval_email(
  p_requisition_id UUID,
  p_recipient_name TEXT,
  p_approver_name TEXT
)
RETURNS TABLE(subject TEXT, body_html TEXT, body_text TEXT)
LANGUAGE plpgsql
AS $$
DECLARE
  req RECORD;
  org_name TEXT;
BEGIN
  -- Get requisition details
  SELECT
    r.requisition_number,
    r.title,
    r.total_amount
  INTO req
  FROM requisitions r
  WHERE r.id = p_requisition_id;

  -- Get organization name
  SELECT organization_name INTO org_name
  FROM organization_settings
  LIMIT 1;

  RETURN QUERY SELECT
    ('Requisition Approved: ' || req.requisition_number)::TEXT,
    -- HTML version
    ('<html><body>' ||
     '<h2 style="color: #059669;">Requisition Approved</h2>' ||
     '<p>Dear ' || p_recipient_name || ',</p>' ||
     '<p>Your requisition has been approved!</p>' ||
     '<table style="border-collapse: collapse; margin: 20px 0;">' ||
     '<tr><td style="padding: 8px; font-weight: bold;">Requisition #:</td><td style="padding: 8px;">' || req.requisition_number || '</td></tr>' ||
     '<tr><td style="padding: 8px; font-weight: bold;">Title:</td><td style="padding: 8px;">' || req.title || '</td></tr>' ||
     '<tr><td style="padding: 8px; font-weight: bold;">Amount:</td><td style="padding: 8px;">UGX ' || TO_CHAR(req.total_amount, 'FM999,999,999') || '</td></tr>' ||
     '<tr><td style="padding: 8px; font-weight: bold;">Approved By:</td><td style="padding: 8px;">' || p_approver_name || '</td></tr>' ||
     '</table>' ||
     '<p><a href="' || COALESCE(current_setting('app.base_url', true), 'https://requisition-workflow.vercel.app') || '/requisitions/' || p_requisition_id || '" ' ||
     'style="background-color: #059669; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">View Requisition</a></p>' ||
     '<p style="color: #666; margin-top: 30px;">This is an automated message from ' || COALESCE(org_name, 'Requisition System') || '.</p>' ||
     '</body></html>')::TEXT,
    -- Text version
    ('Requisition Approved' || E'\n\n' ||
     'Dear ' || p_recipient_name || ',' || E'\n\n' ||
     'Your requisition has been approved!' || E'\n\n' ||
     'Requisition #: ' || req.requisition_number || E'\n' ||
     'Title: ' || req.title || E'\n' ||
     'Amount: UGX ' || TO_CHAR(req.total_amount, 'FM999,999,999') || E'\n' ||
     'Approved By: ' || p_approver_name || E'\n\n' ||
     'View requisition at: ' || COALESCE(current_setting('app.base_url', true), 'https://requisition-workflow.vercel.app') || '/requisitions/' || p_requisition_id || E'\n\n' ||
     'This is an automated message from ' || COALESCE(org_name, 'Requisition System') || '.')::TEXT;
END;
$$;

-- ============================================
-- Update Rejection Email Template
-- ============================================

CREATE OR REPLACE FUNCTION generate_rejection_email(
  p_requisition_id UUID,
  p_recipient_name TEXT,
  p_rejector_name TEXT,
  p_reason TEXT
)
RETURNS TABLE(subject TEXT, body_html TEXT, body_text TEXT)
LANGUAGE plpgsql
AS $$
DECLARE
  req RECORD;
  org_name TEXT;
BEGIN
  -- Get requisition details
  SELECT
    r.requisition_number,
    r.title
  INTO req
  FROM requisitions r
  WHERE r.id = p_requisition_id;

  -- Get organization name
  SELECT organization_name INTO org_name
  FROM organization_settings
  LIMIT 1;

  RETURN QUERY SELECT
    ('Requisition Rejected: ' || req.requisition_number)::TEXT,
    -- HTML version
    ('<html><body>' ||
     '<h2 style="color: #DC2626;">Requisition Rejected</h2>' ||
     '<p>Dear ' || p_recipient_name || ',</p>' ||
     '<p>Your requisition has been rejected.</p>' ||
     '<table style="border-collapse: collapse; margin: 20px 0;">' ||
     '<tr><td style="padding: 8px; font-weight: bold;">Requisition #:</td><td style="padding: 8px;">' || req.requisition_number || '</td></tr>' ||
     '<tr><td style="padding: 8px; font-weight: bold;">Title:</td><td style="padding: 8px;">' || req.title || '</td></tr>' ||
     '<tr><td style="padding: 8px; font-weight: bold;">Rejected By:</td><td style="padding: 8px;">' || p_rejector_name || '</td></tr>' ||
     CASE WHEN p_reason IS NOT NULL THEN
       '<tr><td style="padding: 8px; font-weight: bold; vertical-align: top;">Reason:</td><td style="padding: 8px;">' || p_reason || '</td></tr>'
     ELSE '' END ||
     '</table>' ||
     '<p><a href="' || COALESCE(current_setting('app.base_url', true), 'https://requisition-workflow.vercel.app') || '/requisitions/' || p_requisition_id || '" ' ||
     'style="background-color: #DC2626; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">View Requisition</a></p>' ||
     '<p style="color: #666; margin-top: 30px;">This is an automated message from ' || COALESCE(org_name, 'Requisition System') || '.</p>' ||
     '</body></html>')::TEXT,
    -- Text version
    ('Requisition Rejected' || E'\n\n' ||
     'Dear ' || p_recipient_name || ',' || E'\n\n' ||
     'Your requisition has been rejected.' || E'\n\n' ||
     'Requisition #: ' || req.requisition_number || E'\n' ||
     'Title: ' || req.title || E'\n' ||
     'Rejected By: ' || p_rejector_name || E'\n' ||
     CASE WHEN p_reason IS NOT NULL THEN 'Reason: ' || p_reason || E'\n' ELSE '' END ||
     E'\n' ||
     'View requisition at: ' || COALESCE(current_setting('app.base_url', true), 'https://requisition-workflow.vercel.app') || '/requisitions/' || p_requisition_id || E'\n\n' ||
     'This is an automated message from ' || COALESCE(org_name, 'Requisition System') || '.')::TEXT;
END;
$$;

-- ============================================
-- Verification
-- ============================================

DO $$
BEGIN
  RAISE NOTICE '==============================================';
  RAISE NOTICE 'Email Template Functions Updated';
  RAISE NOTICE '==============================================';
  RAISE NOTICE 'Updated functions:';
  RAISE NOTICE '  ✓ generate_submission_email()';
  RAISE NOTICE '  ✓ generate_approval_email()';
  RAISE NOTICE '  ✓ generate_rejection_email()';
  RAISE NOTICE '';
  RAISE NOTICE 'All email links now default to:';
  RAISE NOTICE '  https://requisition-workflow.vercel.app';
  RAISE NOTICE '';
  RAISE NOTICE 'Fix Applied: "View Requisition" links will now work correctly';
  RAISE NOTICE '==============================================';
END $$;

COMMIT;

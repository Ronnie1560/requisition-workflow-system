-- Migration: Update email template functions to use organization-specific names
-- Date: 2026-01-18
-- Description: Update email generation functions to fetch org name from requisition's organization

-- Drop existing functions first to avoid parameter name conflicts
DROP FUNCTION IF EXISTS generate_submission_email(UUID, TEXT);
DROP FUNCTION IF EXISTS generate_approval_email(UUID, TEXT, TEXT);
DROP FUNCTION IF EXISTS generate_rejection_email(UUID, TEXT, TEXT, TEXT);

/**
 * Generate email body for new requisition submission
 * Updated to use organization name from requisition's org
 */
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
  -- Get requisition details and organization name
  SELECT
    r.requisition_number,
    r.title,
    r.total_amount,
    r.created_at,
    o.name as organization_name,
    u.full_name as submitter_name,
    p.name as project_name
  INTO req
  FROM requisitions r
  LEFT JOIN organizations o ON r.org_id = o.id
  LEFT JOIN users u ON r.submitted_by = u.id
  LEFT JOIN projects p ON r.project_id = p.id
  WHERE r.id = p_requisition_id;

  -- Get base URL (fallback to default if not set)
  SELECT app_base_url INTO base_url
  FROM organization_settings
  LIMIT 1;

  base_url := COALESCE(base_url, 'https://requisition-workflow.vercel.app');
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

/**
 * Generate email body for requisition approved
 * Updated to use organization name from requisition's org
 */
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
  -- Get requisition details and organization name
  SELECT
    r.requisition_number,
    r.title,
    r.total_amount,
    o.name as organization_name
  INTO req
  FROM requisitions r
  LEFT JOIN organizations o ON r.org_id = o.id
  WHERE r.id = p_requisition_id;

  -- Get base URL
  SELECT app_base_url INTO base_url
  FROM organization_settings
  LIMIT 1;

  base_url := COALESCE(base_url, 'https://requisition-workflow.vercel.app');
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

/**
 * Generate email body for requisition rejected
 * Updated to use organization name from requisition's org
 */
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
  -- Get requisition details and organization name
  SELECT
    r.requisition_number,
    r.title,
    r.total_amount,
    o.name as organization_name
  INTO req
  FROM requisitions r
  LEFT JOIN organizations o ON r.org_id = o.id
  WHERE r.id = p_requisition_id;

  -- Get base URL
  SELECT app_base_url INTO base_url
  FROM organization_settings
  LIMIT 1;

  base_url := COALESCE(base_url, 'https://requisition-workflow.vercel.app');
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

-- Update function comments
COMMENT ON FUNCTION generate_submission_email IS 'Generates email content for requisition submission notifications (org-aware)';
COMMENT ON FUNCTION generate_approval_email IS 'Generates email content for requisition approval notifications (org-aware)';
COMMENT ON FUNCTION generate_rejection_email IS 'Generates email content for requisition rejection notifications (org-aware)';

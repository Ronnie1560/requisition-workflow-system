-- =====================================================
-- Fix: user_organizations view missing contact/address columns
-- 
-- The user_organizations view was missing email, phone, website,
-- address, and other org fields. This caused Organization Settings
-- to show empty values even when data was saved during signup.
-- =====================================================

DROP VIEW IF EXISTS user_organizations CASCADE;

CREATE VIEW user_organizations
WITH (security_invoker = true)
AS
SELECT
  o.id,
  o.name,
  o.slug,
  o.logo_url,
  o.plan,
  o.status,
  o.trial_ends_at,
  o.subscription_ends_at,
  o.max_users,
  o.max_projects,
  o.max_requisitions_per_month,
  o.stripe_customer_id,
  o.stripe_subscription_id,
  -- Contact info (was missing)
  o.email,
  o.phone,
  o.website,
  -- Address (was missing)
  o.address_line1,
  o.address_line2,
  o.city,
  o.state_province,
  o.postal_code,
  o.country,
  -- Business info (was missing)
  o.tax_id,
  o.industry,
  -- Branding (was missing)
  o.primary_color,
  -- Member info
  om.role as member_role,
  om.workflow_role,
  om.created_at as joined_at
FROM organizations o
JOIN organization_members om ON o.id = om.organization_id
WHERE om.user_id = auth.uid()
  AND om.is_active = true
  AND o.status IN ('active', 'trial');

COMMENT ON VIEW user_organizations IS
'Shows organizations for the current user with billing, contact, address info and workflow role. Uses security_invoker - respects RLS.';

GRANT SELECT ON user_organizations TO authenticated;

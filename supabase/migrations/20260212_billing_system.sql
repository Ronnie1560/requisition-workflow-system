-- =====================================================
-- Migration: Update user_organizations view to include billing columns
-- and create billing_history table
-- =====================================================

-- 1. Update user_organizations view to include billing-related columns
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
  om.role as member_role,
  om.created_at as joined_at
FROM organizations o
JOIN organization_members om ON o.id = om.organization_id
WHERE om.user_id = auth.uid()
  AND om.is_active = true
  AND o.status IN ('active', 'trial');

COMMENT ON VIEW user_organizations IS
'Shows organizations for the current user with billing info. Uses security_invoker - respects RLS.';

GRANT SELECT ON user_organizations TO authenticated;

-- 2. Create billing_history table to track subscription events
CREATE TABLE IF NOT EXISTS billing_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  event_type VARCHAR(50) NOT NULL, -- 'subscription_created', 'subscription_updated', 'payment_succeeded', 'payment_failed', 'trial_started', 'trial_ended', 'plan_changed', 'cancelled'
  plan_from subscription_plan,
  plan_to subscription_plan,
  amount_cents INTEGER DEFAULT 0,
  currency VARCHAR(3) DEFAULT 'USD',
  stripe_event_id VARCHAR(255),
  stripe_invoice_id VARCHAR(255),
  stripe_subscription_id VARCHAR(255),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_billing_history_org_id ON billing_history(organization_id);
CREATE INDEX IF NOT EXISTS idx_billing_history_created_at ON billing_history(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_billing_history_stripe_event ON billing_history(stripe_event_id);

-- RLS
ALTER TABLE billing_history ENABLE ROW LEVEL SECURITY;

-- Only org owners/admins can view billing history
CREATE POLICY billing_history_select ON billing_history
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.organization_id = billing_history.organization_id
        AND om.user_id = auth.uid()
        AND om.is_active = true
        AND om.role IN ('owner', 'admin')
    )
  );

-- Only system (service role) can insert billing history
-- No INSERT policy for authenticated - webhooks use service role

-- 3. Create function to update org plan from webhook
CREATE OR REPLACE FUNCTION update_organization_plan(
  p_org_id UUID,
  p_plan subscription_plan,
  p_status organization_status,
  p_max_users INTEGER,
  p_max_projects INTEGER,
  p_max_requisitions INTEGER,
  p_stripe_subscription_id VARCHAR DEFAULT NULL,
  p_subscription_ends_at TIMESTAMPTZ DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE organizations
  SET
    plan = p_plan,
    status = p_status,
    max_users = p_max_users,
    max_projects = p_max_projects,
    max_requisitions_per_month = p_max_requisitions,
    stripe_subscription_id = COALESCE(p_stripe_subscription_id, stripe_subscription_id),
    subscription_ends_at = COALESCE(p_subscription_ends_at, subscription_ends_at),
    updated_at = NOW()
  WHERE id = p_org_id;
END;
$$;

-- 4. Create function to get organization usage stats for billing
CREATE OR REPLACE FUNCTION get_organization_usage(p_org_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_users_count INTEGER;
  v_projects_count INTEGER;
  v_requisitions_count INTEGER;
  v_result JSON;
BEGIN
  -- Count active members
  SELECT COUNT(*) INTO v_users_count
  FROM organization_members
  WHERE organization_id = p_org_id AND is_active = true;

  -- Count active projects
  SELECT COUNT(*) INTO v_projects_count
  FROM projects
  WHERE org_id = p_org_id AND is_active = true;

  -- Count requisitions this month
  SELECT COUNT(*) INTO v_requisitions_count
  FROM requisitions
  WHERE org_id = p_org_id
    AND created_at >= date_trunc('month', NOW())
    AND created_at < date_trunc('month', NOW()) + INTERVAL '1 month';

  v_result := json_build_object(
    'users', v_users_count,
    'projects', v_projects_count,
    'requisitions_this_month', v_requisitions_count
  );

  RETURN v_result;
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION get_organization_usage TO authenticated;

-- Verify
DO $$
BEGIN
  RAISE NOTICE '✅ Billing migration complete:';
  RAISE NOTICE '  - user_organizations view updated with billing columns';
  RAISE NOTICE '  - billing_history table created with RLS';
  RAISE NOTICE '  - update_organization_plan function created';
  RAISE NOTICE '  - get_organization_usage function created';
END;
$$;

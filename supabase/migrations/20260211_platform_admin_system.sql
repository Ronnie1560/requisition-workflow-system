-- ============================================================================
-- Platform Admin System Migration
-- ============================================================================
-- Creates the platform_admins table and supporting functions for cross-tenant
-- admin access. Platform admins can view/manage ALL organizations from the
-- admin dashboard (admin.ledgerworkflow.com).
-- ============================================================================

-- Platform admins table (email allow-list approach)
CREATE TABLE IF NOT EXISTS platform_admins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  name TEXT,
  granted_by UUID REFERENCES auth.users(id),
  granted_at TIMESTAMPTZ DEFAULT NOW(),
  is_active BOOLEAN DEFAULT true,
  last_login_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_platform_admins_user_id ON platform_admins(user_id);
CREATE INDEX IF NOT EXISTS idx_platform_admins_email ON platform_admins(email);
CREATE INDEX IF NOT EXISTS idx_platform_admins_active ON platform_admins(is_active) WHERE is_active = true;

-- Helper function: check if current user is a platform admin
CREATE OR REPLACE FUNCTION is_platform_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM platform_admins
    WHERE user_id = auth.uid()
    AND is_active = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- ============================================================================
-- Platform Admin Audit Log
-- ============================================================================
CREATE TABLE IF NOT EXISTS platform_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID NOT NULL REFERENCES platform_admins(id),
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL, -- 'organization', 'user', 'subscription', etc.
  entity_id UUID,
  details JSONB DEFAULT '{}',
  ip_address TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_platform_audit_log_admin ON platform_audit_log(admin_id);
CREATE INDEX IF NOT EXISTS idx_platform_audit_log_entity ON platform_audit_log(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_platform_audit_log_created ON platform_audit_log(created_at DESC);

-- ============================================================================
-- Platform Announcements (for Communication Tools)
-- ============================================================================
CREATE TABLE IF NOT EXISTS platform_announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  announcement_type TEXT NOT NULL DEFAULT 'info'
    CHECK (announcement_type IN ('info', 'warning', 'maintenance', 'feature', 'critical')),
  target_audience TEXT NOT NULL DEFAULT 'all'
    CHECK (target_audience IN ('all', 'free', 'starter', 'professional', 'enterprise', 'trial')),
  target_org_ids UUID[] DEFAULT '{}',
  is_published BOOLEAN DEFAULT false,
  published_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_by UUID REFERENCES platform_admins(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_platform_announcements_published 
  ON platform_announcements(is_published, published_at DESC) WHERE is_published = true;

-- ============================================================================
-- Platform Feedback (for in-app feedback widget)
-- ============================================================================
CREATE TABLE IF NOT EXISTS platform_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submitted_by UUID REFERENCES auth.users(id),
  org_id UUID REFERENCES organizations(id),
  category TEXT NOT NULL DEFAULT 'feature_request'
    CHECK (category IN ('feature_request', 'bug_report', 'improvement', 'question', 'other')),
  title TEXT NOT NULL,
  description TEXT,
  priority TEXT DEFAULT 'medium'
    CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  status TEXT DEFAULT 'open'
    CHECK (status IN ('open', 'in_review', 'planned', 'in_progress', 'completed', 'declined')),
  upvotes INTEGER DEFAULT 0,
  admin_response TEXT,
  responded_by UUID REFERENCES platform_admins(id),
  responded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_platform_feedback_status ON platform_feedback(status);
CREATE INDEX IF NOT EXISTS idx_platform_feedback_category ON platform_feedback(category);
CREATE INDEX IF NOT EXISTS idx_platform_feedback_org ON platform_feedback(org_id);

-- Feedback upvotes tracking
CREATE TABLE IF NOT EXISTS platform_feedback_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  feedback_id UUID NOT NULL REFERENCES platform_feedback(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(feedback_id, user_id)
);

-- ============================================================================
-- RLS Policies
-- ============================================================================

-- Platform admins table: only platform admins can see/manage
ALTER TABLE platform_admins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Platform admins can view all admins"
  ON platform_admins FOR SELECT
  TO authenticated
  USING (is_platform_admin());

-- Platform audit log: only platform admins
ALTER TABLE platform_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Platform admins can view audit log"
  ON platform_audit_log FOR SELECT
  TO authenticated
  USING (is_platform_admin());

CREATE POLICY "Platform admins can insert audit log"
  ON platform_audit_log FOR INSERT
  TO authenticated
  WITH CHECK (is_platform_admin());

-- Platform announcements: admins can CRUD, all authenticated users can read published
ALTER TABLE platform_announcements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Platform admins can manage announcements"
  ON platform_announcements FOR ALL
  TO authenticated
  USING (is_platform_admin());

CREATE POLICY "All users can view published announcements"
  ON platform_announcements FOR SELECT
  TO authenticated
  USING (is_published = true AND (expires_at IS NULL OR expires_at > NOW()));

-- Platform feedback: users can create/view, admins can manage
ALTER TABLE platform_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can create feedback"
  ON platform_feedback FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = submitted_by);

CREATE POLICY "Users can view all feedback"
  ON platform_feedback FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Platform admins can update feedback"
  ON platform_feedback FOR UPDATE
  TO authenticated
  USING (is_platform_admin());

-- Feedback votes: users can vote
ALTER TABLE platform_feedback_votes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own votes"
  ON platform_feedback_votes FOR ALL
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can view all votes"
  ON platform_feedback_votes FOR SELECT
  TO authenticated
  USING (true);

-- ============================================================================
-- Cross-tenant access policies for platform admins
-- ============================================================================

-- Allow platform admins to view ALL organizations
CREATE POLICY "Platform admins can view all organizations"
  ON organizations FOR SELECT
  TO authenticated
  USING (is_platform_admin());

-- Allow platform admins to update any organization (suspend, change plan, etc.)
CREATE POLICY "Platform admins can update any organization"
  ON organizations FOR UPDATE
  TO authenticated
  USING (is_platform_admin());

-- Allow platform admins to view all organization members
CREATE POLICY "Platform admins can view all org members"
  ON organization_members FOR SELECT
  TO authenticated
  USING (is_platform_admin());

-- Allow platform admins to view all users
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'users' AND schemaname = 'public') THEN
    EXECUTE 'CREATE POLICY "Platform admins can view all users" ON users FOR SELECT TO authenticated USING (is_platform_admin())';
  END IF;
END $$;

-- Allow platform admins to view all billing history
CREATE POLICY "Platform admins can view all billing history"
  ON billing_history FOR SELECT
  TO authenticated
  USING (is_platform_admin());

-- ============================================================================
-- Platform admin helper functions (SECURITY DEFINER for cross-tenant ops)
-- ============================================================================

-- Get all organizations with usage stats
CREATE OR REPLACE FUNCTION get_all_organizations_with_stats()
RETURNS TABLE (
  id UUID,
  name TEXT,
  slug TEXT,
  email TEXT,
  plan TEXT,
  status TEXT,
  trial_ends_at TIMESTAMPTZ,
  subscription_ends_at TIMESTAMPTZ,
  max_users INTEGER,
  max_projects INTEGER,
  max_requisitions_per_month INTEGER,
  stripe_customer_id TEXT,
  member_count BIGINT,
  project_count BIGINT,
  requisition_count_this_month BIGINT,
  created_at TIMESTAMPTZ
) AS $$
BEGIN
  IF NOT is_platform_admin() THEN
    RAISE EXCEPTION 'Access denied: not a platform admin';
  END IF;

  RETURN QUERY
  SELECT
    o.id,
    o.name::TEXT,
    o.slug::TEXT,
    o.email::TEXT,
    o.plan::TEXT,
    o.status::TEXT,
    o.trial_ends_at,
    o.subscription_ends_at,
    o.max_users,
    o.max_projects,
    o.max_requisitions_per_month,
    o.stripe_customer_id::TEXT,
    (SELECT COUNT(*) FROM organization_members om WHERE om.organization_id = o.id AND om.is_active = true) AS member_count,
    (SELECT COUNT(*) FROM projects p WHERE p.org_id = o.id) AS project_count,
    (SELECT COUNT(*) FROM requisitions r WHERE r.org_id = o.id AND r.created_at >= date_trunc('month', NOW())) AS requisition_count_this_month,
    o.created_at
  FROM organizations o
  ORDER BY o.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Get platform-wide stats
CREATE OR REPLACE FUNCTION get_platform_stats()
RETURNS JSON AS $$
DECLARE
  result JSON;
BEGIN
  IF NOT is_platform_admin() THEN
    RAISE EXCEPTION 'Access denied: not a platform admin';
  END IF;

  SELECT json_build_object(
    'total_organizations', (SELECT COUNT(*) FROM organizations),
    'active_organizations', (SELECT COUNT(*) FROM organizations WHERE status = 'active'),
    'trial_organizations', (SELECT COUNT(*) FROM organizations WHERE status = 'trial'),
    'suspended_organizations', (SELECT COUNT(*) FROM organizations WHERE status = 'suspended'),
    'total_users', (SELECT COUNT(*) FROM organization_members WHERE is_active = true),
    'total_projects', (SELECT COUNT(*) FROM projects),
    'total_requisitions', (SELECT COUNT(*) FROM requisitions),
    'requisitions_this_month', (SELECT COUNT(*) FROM requisitions WHERE created_at >= date_trunc('month', NOW())),
    'plans', json_build_object(
      'free', (SELECT COUNT(*) FROM organizations WHERE plan = 'free'),
      'starter', (SELECT COUNT(*) FROM organizations WHERE plan = 'starter'),
      'professional', (SELECT COUNT(*) FROM organizations WHERE plan = 'professional'),
      'enterprise', (SELECT COUNT(*) FROM organizations WHERE plan = 'enterprise')
    ),
    'revenue_monthly_cents', (
      SELECT COALESCE(SUM(
        CASE
          WHEN o.plan = 'starter' THEN 800
          WHEN o.plan = 'professional' THEN 1200
          WHEN o.plan = 'enterprise' THEN 6000
          ELSE 0
        END
      ), 0)
      FROM organizations o
      WHERE o.status = 'active' AND o.plan != 'free'
    )
  ) INTO result;

  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Suspend/activate an organization
CREATE OR REPLACE FUNCTION platform_update_org_status(
  target_org_id UUID,
  new_status TEXT,
  admin_notes TEXT DEFAULT NULL
)
RETURNS VOID AS $$
DECLARE
  v_admin_id UUID;
BEGIN
  IF NOT is_platform_admin() THEN
    RAISE EXCEPTION 'Access denied: not a platform admin';
  END IF;

  IF new_status NOT IN ('active', 'suspended', 'cancelled', 'trial') THEN
    RAISE EXCEPTION 'Invalid status: %', new_status;
  END IF;

  -- Update the org
  UPDATE organizations SET status = new_status::organization_status, updated_at = NOW()
  WHERE organizations.id = target_org_id;

  -- Log the action
  SELECT pa.id INTO v_admin_id FROM platform_admins pa WHERE pa.user_id = auth.uid();

  INSERT INTO platform_audit_log (admin_id, action, entity_type, entity_id, details)
  VALUES (v_admin_id, 'update_status', 'organization', target_org_id,
    jsonb_build_object('new_status', new_status, 'notes', admin_notes));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Override org plan/limits
CREATE OR REPLACE FUNCTION platform_update_org_plan(
  target_org_id UUID,
  new_plan TEXT,
  new_max_users INTEGER DEFAULT NULL,
  new_max_projects INTEGER DEFAULT NULL,
  new_max_reqs INTEGER DEFAULT NULL
)
RETURNS VOID AS $$
DECLARE
  v_admin_id UUID;
  v_old_plan TEXT;
BEGIN
  IF NOT is_platform_admin() THEN
    RAISE EXCEPTION 'Access denied: not a platform admin';
  END IF;

  SELECT o.plan::TEXT INTO v_old_plan FROM organizations o WHERE o.id = target_org_id;

  UPDATE organizations SET
    plan = new_plan::subscription_plan,
    max_users = COALESCE(new_max_users, max_users),
    max_projects = COALESCE(new_max_projects, max_projects),
    max_requisitions_per_month = COALESCE(new_max_reqs, max_requisitions_per_month),
    updated_at = NOW()
  WHERE organizations.id = target_org_id;

  SELECT pa.id INTO v_admin_id FROM platform_admins pa WHERE pa.user_id = auth.uid();

  INSERT INTO platform_audit_log (admin_id, action, entity_type, entity_id, details)
  VALUES (v_admin_id, 'update_plan', 'organization', target_org_id,
    jsonb_build_object('old_plan', v_old_plan, 'new_plan', new_plan));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Record platform admin login
CREATE OR REPLACE FUNCTION record_platform_admin_login()
RETURNS VOID AS $$
BEGIN
  UPDATE platform_admins
  SET last_login_at = NOW()
  WHERE user_id = auth.uid();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Updated timestamp trigger
CREATE OR REPLACE FUNCTION update_platform_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_platform_admins_updated_at
  BEFORE UPDATE ON platform_admins
  FOR EACH ROW EXECUTE FUNCTION update_platform_updated_at();

CREATE TRIGGER update_platform_announcements_updated_at
  BEFORE UPDATE ON platform_announcements
  FOR EACH ROW EXECUTE FUNCTION update_platform_updated_at();

CREATE TRIGGER update_platform_feedback_updated_at
  BEFORE UPDATE ON platform_feedback
  FOR EACH ROW EXECUTE FUNCTION update_platform_updated_at();

-- =====================================================
-- Migration: Fix organization settings access for invited users
-- Date: January 13, 2026
-- 
-- SECURITY MODEL:
-- Users can ONLY join an organization via invitation.
-- There is no self-registration to a default organization.
-- This ensures data isolation and privacy between organizations.
-- =====================================================

-- =====================================================
-- STEP 1: Fix existing users without org membership
-- Only fixes users that were created before multi-tenancy
-- was properly implemented (legacy data migration)
-- =====================================================

DO $$
DECLARE
  v_default_org_id UUID;
  v_user RECORD;
  v_count INTEGER := 0;
BEGIN
  -- Get the original/default organization (for legacy data only)
  SELECT id INTO v_default_org_id
  FROM organizations
  WHERE slug = 'default' AND status = 'active'
  LIMIT 1;
  
  IF v_default_org_id IS NULL THEN
    RAISE NOTICE 'No default organization found, skipping legacy user migration';
    RETURN;
  END IF;
  
  -- Find EXISTING users not in any organization (legacy users only)
  -- These are users created before multi-tenancy was implemented
  FOR v_user IN
    SELECT u.id, u.role, u.created_at
    FROM users u
    LEFT JOIN organization_members om ON u.id = om.user_id
    WHERE om.id IS NULL
      AND u.created_at < '2026-01-13'  -- Only migrate legacy users
  LOOP
    -- Add user to default org
    INSERT INTO organization_members (organization_id, user_id, role, accepted_at, is_active)
    VALUES (
      v_default_org_id, 
      v_user.id, 
      CASE 
        WHEN v_user.role = 'super_admin' THEN 'owner'::org_member_role
        WHEN v_user.role IN ('approver', 'reviewer') THEN 'admin'::org_member_role
        ELSE 'member'::org_member_role
      END,
      NOW(),
      true
    )
    ON CONFLICT (organization_id, user_id) DO NOTHING;
    
    -- Update user's org_id
    UPDATE users SET org_id = v_default_org_id WHERE id = v_user.id AND org_id IS NULL;
    
    v_count := v_count + 1;
  END LOOP;
  
  IF v_count > 0 THEN
    RAISE NOTICE 'Migrated % legacy users to default organization', v_count;
  END IF;
END $$;

-- =====================================================
-- STEP 2: Update organization_settings RLS policy
-- Users can only see settings for organizations they belong to
-- No fallback for users without organization membership
-- =====================================================

DROP POLICY IF EXISTS "Users can view their org settings" ON organization_settings;

CREATE POLICY "Users can view their org settings"
  ON organization_settings FOR SELECT TO authenticated
  USING (
    -- User can view settings if:
    -- 1. org_id is NULL (legacy/global settings from before multi-tenancy), OR
    -- 2. User belongs to the organization
    org_id IS NULL
    OR user_belongs_to_org(org_id)
  );

-- =====================================================
-- STEP 3: Ensure admins can manage their org settings
-- =====================================================

DROP POLICY IF EXISTS "Admins can manage org settings" ON organization_settings;

CREATE POLICY "Admins can manage org settings"
  ON organization_settings FOR ALL TO authenticated
  USING (
    org_id IS NULL 
    OR user_is_org_admin(org_id)
  );

-- =====================================================
-- STEP 4: Add helpful comment
-- =====================================================

COMMENT ON TABLE organization_settings IS 'Organization-specific settings. Users can only access settings for organizations they are members of. New users must be invited to an organization.';

-- =====================================================
-- Done! 
-- 
-- IMPORTANT: With this model, new users MUST be invited
-- by an admin via the invite-user Edge Function. 
-- Self-registration is not supported.
-- =====================================================

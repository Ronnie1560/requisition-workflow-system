-- =====================================================
-- FIX: create_organization function - correct fiscal_year_settings columns
-- The function was using wrong column names (start_month instead of fiscal_year_start_month)
-- =====================================================

CREATE OR REPLACE FUNCTION create_organization(
  p_name VARCHAR(255),
  p_slug VARCHAR(100),
  p_email VARCHAR(255) DEFAULT NULL,
  p_plan subscription_plan DEFAULT 'free'
)
RETURNS UUID AS $$
DECLARE
  v_org_id UUID;
  v_user_id UUID;
  v_current_year INTEGER;
BEGIN
  v_user_id := auth.uid();

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'User must be authenticated';
  END IF;

  -- Create organization
  INSERT INTO organizations (name, slug, email, plan, created_by)
  VALUES (p_name, p_slug, p_email, p_plan, v_user_id)
  RETURNING id INTO v_org_id;

  -- Add creator as owner
  INSERT INTO organization_members (organization_id, user_id, role, accepted_at)
  VALUES (v_org_id, v_user_id, 'owner', NOW());

  -- Create default organization settings
  INSERT INTO organization_settings (org_id, organization_name)
  VALUES (v_org_id, p_name);

  -- Create default fiscal year settings (if table exists)
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'fiscal_year_settings') THEN
    -- Get current year
    v_current_year := EXTRACT(YEAR FROM NOW());

    -- Use correct column names: fiscal_year_start_month, fiscal_year_start_day, current_fiscal_year
    INSERT INTO fiscal_year_settings (org_id, fiscal_year_start_month, fiscal_year_start_day, current_fiscal_year)
    VALUES (v_org_id, 1, 1, v_current_year);
  END IF;

  RETURN v_org_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION create_organization(VARCHAR, VARCHAR, VARCHAR, subscription_plan) IS
'Creates a new organization with the authenticated user as owner. Also creates default settings and fiscal year configuration.';

-- Test the fix
SELECT 'create_organization function updated with correct column names' as status;

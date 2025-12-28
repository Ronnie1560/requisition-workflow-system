-- =====================================================
-- Add Project Link to Expense Accounts
-- Date: 2024-12-19
-- Description: Links expense accounts to projects (one-to-many)
--              Each expense account belongs to ONE project
-- =====================================================

BEGIN;

-- Step 1: Add project_id column (nullable initially)
ALTER TABLE expense_accounts
ADD COLUMN project_id UUID REFERENCES projects(id);

-- Step 2: Create a default project if no projects exist
DO $$
DECLARE
  default_project_id UUID;
  project_exists BOOLEAN;
BEGIN
  -- Check if any projects exist
  SELECT EXISTS(SELECT 1 FROM projects LIMIT 1) INTO project_exists;

  -- If no projects exist, create a default one
  IF NOT project_exists THEN
    INSERT INTO projects (code, name, description, is_active, created_by)
    VALUES (
      'DEFAULT',
      'General Project',
      'Default project for existing expense accounts. Please reassign accounts to appropriate projects.',
      true,
      (SELECT id FROM users WHERE role = 'super_admin' LIMIT 1)
    )
    RETURNING id INTO default_project_id;

    RAISE NOTICE 'Created default project with ID: %', default_project_id;
  ELSE
    -- Use the first active project as default
    SELECT id INTO default_project_id FROM projects WHERE is_active = true ORDER BY created_at LIMIT 1;

    -- If no active projects, use any project
    IF default_project_id IS NULL THEN
      SELECT id INTO default_project_id FROM projects ORDER BY created_at LIMIT 1;
    END IF;

    RAISE NOTICE 'Using existing project as default with ID: %', default_project_id;
  END IF;

  -- Step 3: Assign all existing expense accounts to the default project
  UPDATE expense_accounts
  SET project_id = default_project_id
  WHERE project_id IS NULL;

  RAISE NOTICE 'Assigned all existing expense accounts to default project';
END $$;

-- Step 4: Make project_id NOT NULL (now that all accounts have a project)
ALTER TABLE expense_accounts
ALTER COLUMN project_id SET NOT NULL;

-- Step 5: Add index for better query performance
CREATE INDEX idx_expense_accounts_project_id
ON expense_accounts(project_id);

-- Step 6: Add comment
COMMENT ON COLUMN expense_accounts.project_id IS
'Project that this expense account belongs to. Each expense account can only belong to ONE project.';

-- Success message
DO $$
BEGIN
  RAISE NOTICE '==============================================';
  RAISE NOTICE 'Expense Account-Project linking completed';
  RAISE NOTICE 'All expense accounts now require a project';
  RAISE NOTICE 'Each expense account belongs to ONE project';
  RAISE NOTICE '==============================================';
END $$;

COMMIT;

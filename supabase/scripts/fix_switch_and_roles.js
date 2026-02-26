const { Client } = require('pg');
const c = new Client({
  connectionString: 'postgresql://postgres.winfoubqhkrigtgjwrpm:mzI13j0u912ZpAIU@aws-1-eu-west-1.pooler.supabase.com:5432/postgres',
  ssl: { rejectUnauthorized: false }
});

(async () => {
  await c.connect();

  // =========================================================
  // FIX 1: organization_members SELECT policy
  // Allow users to see their OWN memberships across ALL orgs
  // (needed for org switcher / user_organizations view)
  // =========================================================
  console.log('Fix 1: Updating organization_members SELECT policy...');

  await c.query(`
    DROP POLICY IF EXISTS "Users can view org members" ON organization_members;
    CREATE POLICY "Users can view org members"
      ON organization_members
      FOR SELECT
      TO authenticated
      USING (
        organization_id = jwt_org_id()           -- see all members of current org
        OR user_id = auth.uid()                   -- see own memberships across all orgs
        OR jwt_is_platform_admin()                -- platform admins see all
      );
  `);
  console.log('  DONE: Users can now see their own memberships across all orgs');

  // =========================================================
  // FIX 2: Remove global users.role update from RPC
  // Only update the per-org workflow_role, not the global role
  // =========================================================
  console.log('\nFix 2: Updating update_member_workflow_role RPC...');

  await c.query(`
    CREATE OR REPLACE FUNCTION update_member_workflow_role(
      p_org_id UUID,
      p_user_id UUID,
      p_workflow_role user_role
    )
    RETURNS VOID
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
    BEGIN
      -- Verify caller is org admin or super_admin
      IF NOT (user_is_org_admin(p_org_id) OR is_super_admin(p_org_id)) THEN
        RAISE EXCEPTION 'Permission denied: must be org admin or super admin';
      END IF;

      -- Update the per-org workflow role ONLY
      UPDATE organization_members
      SET workflow_role = p_workflow_role,
          updated_at = NOW()
      WHERE organization_id = p_org_id
        AND user_id = p_user_id
        AND is_active = true;

      -- NOTE: We no longer update users.role (global) because in multi-org
      -- a user can have different roles in different organizations.
    END;
    $$;
  `);
  console.log('  DONE: RPC no longer updates global users.role');

  // =========================================================
  // FIX 3: Restore Ronald's correct roles
  // Hope Shine: super_admin | Jasiri: reviewer
  // The global users.role was overwritten to 'reviewer'
  // =========================================================
  console.log('\nFix 3: Restoring Ronald role...');
  const ronaldId = '121d1c68-e7fc-4cb9-9133-dbf367714176';
  const hopeId = '3b274f91-9613-4b4b-b6e2-733f56880b05';

  // Restore global users.role to match the home org (Hope Shine = super_admin)
  const r1 = await c.query(`
    SELECT workflow_role FROM organization_members
    WHERE user_id = $1 AND organization_id = $2
  `, [ronaldId, hopeId]);

  if (r1.rows.length > 0) {
    await c.query(`UPDATE users SET role = $1 WHERE id = $2`, [r1.rows[0].workflow_role, ronaldId]);
    console.log('  Restored users.role to:', r1.rows[0].workflow_role);
  }

  // Verify
  const r2 = await c.query(`
    SELECT om.organization_id, o.name, om.workflow_role, u.role AS global_role
    FROM organization_members om
    JOIN organizations o ON o.id = om.organization_id
    JOIN users u ON u.id = om.user_id
    WHERE om.user_id = $1
  `, [ronaldId]);
  console.log('\n=== Ronald roles after fix ===');
  console.table(r2.rows);

  console.log('\nAll DB fixes deployed!');
  await c.end();
})().catch(e => { console.error('ERROR:', e.message); process.exit(1); });

const { Client } = require('pg');
const c = new Client({
  connectionString: 'postgresql://postgres.winfoubqhkrigtgjwrpm:mzI13j0u912ZpAIU@aws-1-eu-west-1.pooler.supabase.com:5432/postgres',
  ssl: { rejectUnauthorized: false }
});

(async () => {
  await c.connect();

  const userId = '121d1c68-e7fc-4cb9-9133-dbf367714176'; // ronaldelvismutesasira@gmail.com
  const jasiriOrgId = '4a625ee7-35a6-443c-ba7f-f95127968eee';
  const hopeShineOrgId = '3b274f91-9613-4b4b-b6e2-733f56880b05';

  // 1. Check organization_members for this user
  const memberships = await c.query(`
    SELECT om.*, o.name as org_name
    FROM organization_members om
    JOIN organizations o ON o.id = om.organization_id
    WHERE om.user_id = $1
    ORDER BY om.created_at
  `, [userId]);
  console.log('=== organization_members for ronaldelvismutesasira ===');
  console.table(memberships.rows);

  // 2. Check users table - what org_id is set?
  const user = await c.query(`
    SELECT id, email, full_name, org_id, role
    FROM users WHERE id = $1
  `, [userId]);
  console.log('=== users table entry ===');
  console.table(user.rows);

  // 3. Check how the Users list page queries - look at the view/query
  // The users list likely filters by org_id on the users table
  const jasiriUsers = await c.query(`
    SELECT u.id, u.email, u.full_name, u.org_id, om.role as member_role, om.workflow_role
    FROM organization_members om
    JOIN users u ON u.id = om.user_id
    WHERE om.organization_id = $1 AND om.is_active = true
  `, [jasiriOrgId]);
  console.log('=== Jasiri Foundation members (via organization_members) ===');
  console.table(jasiriUsers.rows);

  // 4. Check what query users.org_id = jasiri would return
  const jasiriUsersDirect = await c.query(`
    SELECT id, email, full_name, org_id
    FROM users WHERE org_id = $1
  `, [jasiriOrgId]);
  console.log('=== Users with org_id = Jasiri (direct users table) ===');
  console.table(jasiriUsersDirect.rows);

  // 5. Check the user_organizations view definition
  const viewDef = await c.query(`
    SELECT pg_get_viewdef('user_organizations'::regclass, true) as def
  `);
  console.log('=== user_organizations VIEW definition ===');
  console.log(viewDef.rows[0]?.def);

  // 6. Check auth.users metadata for active_org_id
  const authMeta = await c.query(`
    SELECT id, email, raw_user_meta_data->>'active_org_id' as active_org_id,
           raw_user_meta_data->>'full_name' as meta_name,
           raw_user_meta_data->>'role' as meta_role
    FROM auth.users WHERE id = $1
  `, [userId]);
  console.log('=== auth.users metadata ===');
  console.table(authMeta.rows);

  await c.end();
})().catch(e => { console.error('ERROR:', e.message); process.exit(1); });

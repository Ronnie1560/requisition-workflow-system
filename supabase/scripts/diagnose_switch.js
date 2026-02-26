const { Client } = require('pg');
const c = new Client({
  connectionString: 'postgresql://postgres.winfoubqhkrigtgjwrpm:mzI13j0u912ZpAIU@aws-1-eu-west-1.pooler.supabase.com:5432/postgres',
  ssl: { rejectUnauthorized: false }
});

(async () => {
  await c.connect();
  const ronaldId = '121d1c68-e7fc-4cb9-9133-dbf367714176';

  // 1. Check user_organizations view definition first
  const r0 = await c.query(`SELECT pg_get_viewdef('user_organizations', true) AS def`);
  console.log('=== user_organizations VIEW definition ===');
  console.log(r0.rows[0].def);

  // 2. Check what it returns (no user filter since it uses auth.uid() internally)
  const r1 = await c.query(`SELECT * FROM user_organizations LIMIT 10`);
  console.log('\n=== user_organizations sample (service_role sees all) ===');
  console.table(r1.rows);
  console.log('=== user_organizations view for Ronald ===');
  console.table(r1.rows);

  // 2. Check what organization_members shows
  const r2 = await c.query(`SELECT organization_id, role, workflow_role, is_active FROM organization_members WHERE user_id = $1`, [ronaldId]);
  console.log('\n=== organization_members for Ronald ===');
  console.table(r2.rows);

  // 3. Check users.role (global)
  const r3 = await c.query(`SELECT id, role, org_id FROM users WHERE id = $1`, [ronaldId]);
  console.log('\n=== users table for Ronald ===');
  console.table(r3.rows);

  // 4. Check the user_organizations view definition
  const r4 = await c.query(`SELECT pg_get_viewdef('user_organizations', true) AS def`);
  console.log('\n=== user_organizations VIEW definition ===');
  console.log(r4.rows[0].def);

  await c.end();
})().catch(e => { console.error('ERROR:', e.message); process.exit(1); });

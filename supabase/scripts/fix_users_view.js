const { Client } = require('pg');
const c = new Client({
  connectionString: 'postgresql://postgres.winfoubqhkrigtgjwrpm:mzI13j0u912ZpAIU@aws-1-eu-west-1.pooler.supabase.com:5432/postgres',
  ssl: { rejectUnauthorized: false }
});

(async () => {
  await c.connect();

  // 1. Recreate users_with_assignments view to be multi-org aware
  // The key change: JOIN organization_members first, expose organization_id as org_id
  // This way a user in 2 orgs produces 2 rows, each filterable by org_id
  console.log('Recreating users_with_assignments view...');

  await c.query(`
    DROP VIEW IF EXISTS users_with_assignments CASCADE;

    CREATE VIEW users_with_assignments
    WITH (security_invoker = true)
    AS
    SELECT
      u.id,
      u.email,
      u.full_name,
      u.role,
      u.department,
      u.phone,
      u.is_active,
      u.created_at,
      u.updated_at,
      u.avatar_url,
      om.organization_id AS org_id,
      u.employee_id,
      om.role AS org_role,
      om.workflow_role,
      om.is_active AS org_membership_active,
      om.accepted_at AS org_joined_at,
      COALESCE(
        json_agg(
          json_build_object(
            'id', upa.id,
            'role', upa.role,
            'is_active', upa.is_active,
            'project', json_build_object(
              'id', p.id,
              'code', p.code,
              'name', p.name
            )
          )
        ) FILTER (WHERE upa.id IS NOT NULL),
        '[]'::json
      ) AS project_assignments
    FROM users u
    INNER JOIN organization_members om ON om.user_id = u.id AND om.is_active = true
    LEFT JOIN user_project_assignments upa ON upa.user_id = u.id AND upa.org_id = om.organization_id AND upa.is_active = true
    LEFT JOIN projects p ON p.id = upa.project_id
    GROUP BY u.id, om.organization_id, om.role, om.workflow_role, om.is_active, om.accepted_at;

    GRANT SELECT ON users_with_assignments TO authenticated;
    GRANT SELECT ON users_with_assignments TO service_role;
  `);
  console.log('  View recreated with multi-org support');

  // 2. Verify: Check Jasiri Foundation users via the new view
  const jasiriOrgId = '4a625ee7-35a6-443c-ba7f-f95127968eee';
  const result = await c.query(`
    SELECT id, email, full_name, org_id, org_role, workflow_role
    FROM users_with_assignments
    WHERE org_id = $1
  `, [jasiriOrgId]);
  console.log('\n=== Jasiri Foundation users (via updated view) ===');
  console.table(result.rows);

  // 3. Verify Hope Shine still shows their users
  const hopeOrgId = '3b274f91-9613-4b4b-b6e2-733f56880b05';
  const result2 = await c.query(`
    SELECT id, email, full_name, org_id, org_role, workflow_role
    FROM users_with_assignments
    WHERE org_id = $1
  `, [hopeOrgId]);
  console.log('\n=== Hope Shine Uganda users (via updated view) ===');
  console.table(result2.rows);

  console.log('\nDone!');
  await c.end();
})().catch(e => { console.error('ERROR:', e.message); process.exit(1); });

const { Client } = require('pg');
const c = new Client({
  connectionString: 'postgresql://postgres.winfoubqhkrigtgjwrpm:mzI13j0u912ZpAIU@aws-1-eu-west-1.pooler.supabase.com:5432/postgres',
  ssl: { rejectUnauthorized: false }
});

(async () => {
  await c.connect();

  // Check organization_members RLS policies
  const r1 = await c.query(`
    SELECT policyname, cmd, qual, with_check
    FROM pg_policies
    WHERE tablename = 'organization_members'
    ORDER BY policyname
  `);
  console.log('=== organization_members RLS policies ===');
  r1.rows.forEach(p => {
    console.log(`\n[${p.cmd}] ${p.policyname}`);
    console.log('  USING:', p.qual);
    if (p.with_check) console.log('  WITH CHECK:', p.with_check);
  });

  // Check organizations RLS SELECT policy
  const r2 = await c.query(`
    SELECT policyname, cmd, qual
    FROM pg_policies
    WHERE tablename = 'organizations' AND cmd = 'SELECT'
  `);
  console.log('\n=== organizations SELECT policy ===');
  r2.rows.forEach(p => {
    console.log(`[${p.cmd}] ${p.policyname}`);
    console.log('  USING:', p.qual);
  });

  await c.end();
})().catch(e => { console.error('ERROR:', e.message); process.exit(1); });

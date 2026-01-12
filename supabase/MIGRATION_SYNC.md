# Migration History Synchronization

## Current Issue
The local migration files don't match the remote database's migration history table (`supabase_migrations.schema_migrations`).

## Solution: Manual Sync

Run these commands to mark existing migrations as applied:

```bash
# Mark all existing migrations as applied in remote database
npx supabase migration repair --status applied 20241213
npx supabase migration repair --status applied 20250112
```

Note: The repair command requires just the timestamp prefix (YYYYMMDD), not the full filename.

## Alternative: Fresh Migration History

If repair doesn't work, you can reset the migration history by:

1. Manually inserting into the migration history table via SQL Editor:

```sql
-- Check current migration history
SELECT * FROM supabase_migrations.schema_migrations ORDER BY version;

-- Manually insert missing migrations (if needed)
INSERT INTO supabase_migrations.schema_migrations (version, name, inserted_at)
VALUES
  ('20241213000000', '20241213_helper_functions', NOW()),
  ('20241213000001', '20241213_initial_schema', NOW()),
  ('20241213000002', '20241213_rls_policies', NOW()),
  ('20241213000003', '20241213_seed_data', NOW()),
  ('20250112000000', '20250112_02_features_and_settings', NOW()),
  ('20250112000001', '20250112_03_notifications', NOW()),
  ('20250112000002', '20250112_04_performance_and_security', NOW()),
  ('20250112000003', '20250112_10_multi_tenancy', NOW())
ON CONFLICT (version) DO NOTHING;
```

2. Then deploy the new migration:

```bash
npx supabase db push
```

## For This Deployment

Since we only need to deploy one new migration (`20250112_11_restrict_audit_logs.sql`),
use the Supabase Dashboard SQL Editor as documented in the main instructions.

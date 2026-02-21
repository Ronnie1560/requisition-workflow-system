# AI Agent Context — Requisition Workflow System

> **This file is the single source of truth for AI coding agents.**
> Tool-specific files (`.github/copilot-instructions.md`, `CLAUDE.md`, `.gemini/context.md`)
> import or reference this file. Keep this file updated when infrastructure changes.

---

## Project Overview

Multi-tenant requisition/procurement workflow system built with:
- **Frontend**: React + Vite (`client/`) — deployed on Vercel
- **Admin Panel**: React + Vite (`admin/`) — deployed on Vercel
- **Backend**: Supabase (Postgres + Auth + Edge Functions + RLS)
- **Edge Functions**: Deno/TypeScript (`supabase/functions/`)

## Repository

- **GitHub**: `Ronnie1560/requisition-workflow-system`
- **Branch**: `main`
- **Git push note**: Git sends progress to stderr — exit code 1 with `main -> main` in output means **success**, not failure.

---

## Supabase Connection

### Remote Database (Production)

| Property | Value |
|---|---|
| Project Ref | `winfoubqhkrigtgjwrpm` |
| Project Name | Requisition Workflow |
| Region | West EU (Ireland) |
| Pooler Host | `aws-1-eu-west-1.pooler.supabase.com` |
| Port | `5432` |
| Database | `postgres` |
| User | `postgres.winfoubqhkrigtgjwrpm` |
| Connection String | `postgresql://postgres.winfoubqhkrigtgjwrpm:<PASSWORD>@aws-1-eu-west-1.pooler.supabase.com:5432/postgres` |

### ⚠️ Connection Gotchas

1. **Pooler hostname**: Use `aws-1-eu-west-1.pooler.supabase.com` — NOT `aws-0-eu-west-1` or `db.winfoubqhkrigtgjwrpm.supabase.co` (direct connection may be blocked).
2. **Password**: Ask the user for the DB password. Never hardcode it. The user knows it.
3. **SSL**: Always use `ssl: { rejectUnauthorized: false }` with Node.js `pg` client.
4. **psql**: May not be installed on the user's Windows machine. Use **Node.js `pg` client** as the reliable fallback:
   ```js
   const { Client } = require('pg');
   const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });
   await client.connect();
   await client.query(sql);
   await client.end();
   ```
5. **Supabase CLI**: Installed globally (`npx supabase`). Use for edge function deployment:
   ```bash
   npx supabase functions deploy <function-name> --project-ref winfoubqhkrigtgjwrpm
   ```
6. **Migration deployment**: `supabase db push` may fail if migration history is out of sync. Deploy SQL directly via the Node.js `pg` client pattern above.

### Dashboard

- **URL**: `https://supabase.com/dashboard/project/winfoubqhkrigtgjwrpm`
- **Auth Hooks**: `Dashboard > Authentication > Auth Hooks`
- **SQL Editor**: `Dashboard > SQL Editor`

---

## Architecture: Multi-Tenancy

### Pattern
Pool model — every data table has an `org_id` column. Tenant isolation enforced via RLS.

### JWT Claims (Custom Access Token Hook)
All RLS policies read org context from JWT claims, NOT from database lookups:

```sql
-- These functions read from the JWT (O(1), no DB query):
public.jwt_org_id()         -- returns current org UUID
public.jwt_org_role()       -- returns 'owner'|'admin'|'member'
public.jwt_workflow_role()  -- returns 'super_admin'|'admin'|'approver'|'submitter'
public.jwt_is_platform_admin() -- returns boolean
```

The `custom_access_token_hook()` function injects these claims at token mint time.

### Key Tables
- `organizations` — tenant records
- `organization_members` — M:N user↔org with `role` and `workflow_role`
- `platform_admins` — super admin users (column: `user_id`, NOT `auth_user_id`)
- All data tables: `requisitions`, `purchase_orders`, `items`, `categories`, `projects`, etc.

### Key Helper Functions (for non-RLS use)
- `get_current_org_id()` — reads org_id from JWT (with fallback)
- `set_org_id_on_insert()` — trigger that auto-sets org_id on INSERT
- `user_belongs_to_org(org_id)` — checks membership (STABLE, used in triggers)
- `user_is_org_admin(org_id)` — checks admin role (STABLE)
- `is_super_admin()` — checks platform_admins table

---

## Project Structure

```
├── client/                  # Main React app (Vite)
│   ├── src/
│   │   ├── components/      # UI components
│   │   ├── context/         # React contexts (OrganizationContext.jsx is critical)
│   │   ├── services/api/    # Supabase API calls
│   │   └── lib/             # supabaseClient.js
│   └── package.json
├── admin/                   # Admin panel (Vite)
│   └── src/
├── supabase/
│   ├── config.toml          # Local dev config + auth hook config
│   ├── migrations/          # SQL migrations (48+ files)
│   ├── functions/           # Edge functions (Deno)
│   │   ├── create-organization-signup/
│   │   ├── invite-user/
│   │   ├── send-emails/
│   │   └── stripe-webhook/
│   └── scripts/             # Utility SQL scripts
├── tests/                   # Test suites
├── docs/                    # Documentation
└── package.json             # Root (workspace scripts)
```

### Critical Files
- `client/src/context/OrganizationContext.jsx` — org state + JWT sync
- `client/src/services/api/*.js` — all Supabase queries
- `supabase/migrations/20260221_jwt_claims_optimization.sql` — JWT hook + all 72 RLS policies
- `supabase/migrations/20260221_fix_org_id_null_guard.sql` — null guard triggers

---

## Environment & Tools

- **OS**: Windows 11
- **Node.js**: v24+ (available)
- **npm**: Available (`pg` package installed at root)
- **Supabase CLI**: v2.75+ via npx
- **Git**: Configured with GitHub credentials
- **psql**: NOT reliably available — use Node.js `pg` client
- **Docker**: NOT reliably running — avoid Docker-dependent commands

---

## Common Tasks

### Deploy a SQL migration
```js
// Create a temp .js file, run with: node deploy.js "<DB_PASSWORD>"
const { Client } = require('pg');
const client = new Client({
  connectionString: `postgresql://postgres.winfoubqhkrigtgjwrpm:${process.argv[2]}@aws-1-eu-west-1.pooler.supabase.com:5432/postgres`,
  ssl: { rejectUnauthorized: false }
});
await client.connect();
await client.query(`<YOUR SQL HERE>`);
await client.end();
```

### Deploy an Edge Function
```bash
npx supabase functions deploy <function-name> --project-ref winfoubqhkrigtgjwrpm
```

### Run the dev server
```bash
cd client && npm run dev
```

### Check RLS policies
```sql
SELECT tablename, policyname, cmd, qual, with_check
FROM pg_policies WHERE schemaname = 'public'
ORDER BY tablename, policyname;
```

---

## Rules for AI Agents

1. **Always ask for the DB password** — never assume or hardcode it.
2. **Use Node.js `pg` for SQL execution** — psql is unreliable on this machine.
3. **Clean up temp scripts** after deployment (`Remove-Item <file>`).
4. **Test hook changes** by simulating `custom_access_token_hook()` before telling the user to try login.
5. **`platform_admins.user_id`** — the column is `user_id`, NOT `auth_user_id`.
6. **Git push stderr is normal** — check for `main -> main` in output to confirm success.
7. **All INSERT operations on data tables** must include `org_id` — the trigger guards against NULL but explicit is better.
8. **org_id column on `organization_members`** is called `organization_id` (not `org_id`).

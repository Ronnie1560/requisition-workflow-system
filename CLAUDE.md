# CLAUDE.md — Project Instructions for Claude Code

Read AI_CONTEXT.md for full project context. This file highlights what matters most.

## Critical Connection Info

- Supabase project: `winfoubqhkrigtgjwrpm`
- DB host: `aws-1-eu-west-1.pooler.supabase.com:5432` (NOT aws-0)
- DB user: `postgres.winfoubqhkrigtgjwrpm`
- Ask the user for the DB password. Never assume it.
- psql is NOT available. Use Node.js `pg` client:
  ```js
  const { Client } = require('pg');
  const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });
  ```

## Architecture

- Multi-tenant with `org_id` on every table, RLS isolation
- JWT custom access token hook injects org context into claims
- RLS policies use: `jwt_org_id()`, `jwt_org_role()`, `jwt_workflow_role()`, `jwt_is_platform_admin()`
- These are O(1) JWT reads, not DB queries

## Column Name Traps

- `platform_admins.user_id` — NOT `auth_user_id`
- `organization_members.organization_id` — NOT `org_id`

## Deployment

- SQL: Use Node.js `pg` client (psql unavailable, `supabase db push` unreliable)
- Edge Functions: `npx supabase functions deploy <name> --project-ref winfoubqhkrigtgjwrpm`
- Git push: stderr output is normal on Windows. `main -> main` = success.
- Always clean up temp deployment scripts.

## Key Files

- `AI_CONTEXT.md` — full context document
- `client/src/context/OrganizationContext.jsx` — org state + JWT sync
- `client/src/services/api/` — all Supabase queries
- `supabase/migrations/` — 48+ SQL files
- `supabase/functions/` — Deno edge functions

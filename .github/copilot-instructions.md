# GitHub Copilot Instructions

> See [AI_CONTEXT.md](../../AI_CONTEXT.md) for full project context, database credentials pattern, and architecture details.

## Quick Reference

- **Stack**: React + Vite frontend, Supabase backend (Postgres + Auth + Edge Functions)
- **Multi-tenancy**: Pool model with `org_id` on every table, RLS enforced via JWT claims
- **Supabase Project**: `winfoubqhkrigtgjwrpm` (West EU Ireland)
- **GitHub**: `Ronnie1560/requisition-workflow-system`, branch `main`

## Database Connection

- **Host**: `aws-1-eu-west-1.pooler.supabase.com:5432` (NOT `aws-0`)
- **User**: `postgres.winfoubqhkrigtgjwrpm`
- **psql is NOT available** — use Node.js `pg` client with `ssl: { rejectUnauthorized: false }`
- Always ask the user for the DB password

## Key Conventions

- RLS policies use `jwt_org_id()`, `jwt_org_role()`, `jwt_workflow_role()`, `jwt_is_platform_admin()` — these read from JWT claims, not DB
- `platform_admins` table column is `user_id` (NOT `auth_user_id`)
- `organization_members` uses `organization_id` (NOT `org_id`)
- All data table INSERTs must include `org_id`
- Edge functions: deploy with `npx supabase functions deploy <name> --project-ref winfoubqhkrigtgjwrpm`
- Git push stderr output is normal on Windows — look for `main -> main` to confirm success
- Clean up any temp deployment scripts after use

## Project Structure

```
client/src/context/OrganizationContext.jsx  — org state + JWT sync (critical)
client/src/services/api/*.js                — all Supabase queries
supabase/migrations/                        — 48+ SQL migration files
supabase/functions/                         — Deno edge functions
```

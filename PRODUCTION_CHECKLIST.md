# Production Readiness Checklist

Complete these steps in the **Supabase Dashboard** before allowing client signups.

---

## 1. Authentication Settings

Go to **Authentication → Settings → Auth Settings**:

- [ ] **Site URL**: Set to `https://pcm-requisition.vercel.app`
- [ ] **Redirect URLs**: Add `https://pcm-requisition.vercel.app/**`
- [ ] **Enable email confirmations**: **ON** (users must verify email before signing in)
- [ ] **Secure password change**: **ON** (require recent login to change password)
- [ ] **Minimum password length**: **8**
- [ ] **Password requirements**: **Letters and digits**
- [ ] **Double confirm email changes**: **ON**

## 2. Email / SMTP

Go to **Authentication → Settings → SMTP Settings**:

- [ ] **Enable Custom SMTP**: ON
- [ ] Configure your production SMTP provider (e.g., Resend, SendGrid, Postmark)
- [ ] **Sender email**: Use a real domain email (e.g., `no-reply@pcm-requisition.app`)
- [ ] **Sender name**: `PCM Requisition System`
- [ ] Test by sending a password reset email to yourself

## 3. Email Templates

Go to **Authentication → Email Templates**:

- [ ] **Confirmation email**: Customize with your branding
- [ ] **Password reset email**: Customize with your branding  
- [ ] **Invite email**: Customize with your branding
- [ ] Ensure all templates use `{{ .SiteURL }}` for links (not hardcoded URLs)

## 4. Rate Limiting

Go to **Authentication → Settings → Rate Limits**:

- [ ] **Email sent rate limit**: Set to at least `10/hour` for production (currently `2/hour` in dev config)
- [ ] **SMS rate limit**: Leave default unless using SMS auth

## 5. Edge Functions

Go to **Edge Functions**:

- [ ] Verify all edge functions are deployed and healthy:
  - `create-organization-signup`
  - `rate-limited-login`
  - `invite-user`
  - `resend-invitation`
  - `send-emails`
  - `cleanup-orphaned-signups`
- [ ] Verify edge function secrets are set (SMTP credentials, etc.)

## 6. Database

Go to **SQL Editor** and run the new migration:

- [ ] Run `supabase/migrations/20260210_remove_demo_data.sql` to remove demo projects, items, and expense accounts
- [ ] Verify: `SELECT count(*) FROM projects WHERE id LIKE '33333333%';` should return **0**
- [ ] Verify: `SELECT count(*) FROM items WHERE id LIKE '44444444%';` should return **0**
- [ ] Verify: `SELECT count(*) FROM expense_accounts WHERE id LIKE '11111111%' OR id LIKE '22222222%';` should return **0**
- [ ] Verify: UOM types still exist: `SELECT count(*) FROM uom_types;` should return **30+**

## 7. RLS & Security

- [ ] Run `supabase/security_audit.sql` in the SQL Editor and verify **0 critical findings**
- [ ] Confirm no tables have overly permissive policies (`qual = 'true'`)
- [ ] Confirm all tables have RLS enabled

## 8. Vercel / Deployment

- [ ] Verify environment variables are set in Vercel Dashboard:
  - `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_ANON_KEY`
  - `VITE_SENTRY_DSN`
  - `VITE_APP_BASE_URL` = `https://pcm-requisition.vercel.app`
- [ ] Trigger a fresh production deployment after all changes
- [ ] Test the full signup flow end-to-end:
  1. Organization signup → email confirmation → login → create project → create item → submit requisition

## 9. Post-Launch Monitoring

- [ ] Sentry error monitoring active
- [ ] Supabase Dashboard → Logs tab accessible
- [ ] Set up Supabase database backup schedule (Project Settings → Database → Backups)

---

## Changes Made (2026-02-10)

| Change | File |
|--------|------|
| New migration to delete demo data | `supabase/migrations/20260210_remove_demo_data.sql` |
| Password: 8 chars min + letters_digits | `supabase/config.toml` |
| Email confirmation enabled | `supabase/config.toml` |
| Secure password change enabled | `supabase/config.toml` |
| Loose SQL scripts moved to archive | `supabase/scripts/` |

> **Note:** `config.toml` only affects local Supabase development. For production, you **must** apply the equivalent settings in the Supabase Dashboard as listed above.

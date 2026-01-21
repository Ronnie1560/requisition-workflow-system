# Setting Up Supabase Edge Function Secrets

## Required Secrets for Edge Functions

Your Edge Functions need these secrets to be set in Supabase:

### For `invite-user` function:
- `RESEND_API_KEY` - Your Resend API key for sending emails

### For `send-emails` function:
- `RESEND_API_KEY` - Your Resend API key for sending emails
- `SUPABASE_URL` - Auto-provided by Supabase
- `SUPABASE_SERVICE_ROLE_KEY` - Auto-provided by Supabase

### For `create-organization-signup` function:
- `RESEND_API_KEY` - Your Resend API key for sending verification emails
- `FROM_EMAIL` - Sender email address (default: noreply@passionchristianministries.org)
- `APP_BASE_URL` - Your app URL (default: https://pcm-requisition.vercel.app)
- `ALLOWED_ORIGINS` - Comma-separated list of allowed CORS origins

### For `cleanup-orphaned-signups` function:
- `CLEANUP_SECRET_KEY` - Secret key to authorize cleanup requests (required)
- `ORPHAN_RETENTION_DAYS` - Days to wait before cleaning up unverified signups (default: 7)

## How to Set Secrets in Supabase CLI

### Option 1: Using Supabase CLI (Recommended)

```bash
# Navigate to your project directory
cd C:\Users\rmute\.gemini\antigravity\scratch

# Set the Resend API key
supabase secrets set RESEND_API_KEY=your_resend_api_key_here
```

### Option 2: Using Supabase Dashboard

1. Go to: https://supabase.com/dashboard
2. Select your project: **winfoubqhkrigtgjwrpm**
3. Navigate to: **Edge Functions** → **Settings** (or **Secrets**)
4. Add secret:
   - Name: `RESEND_API_KEY`
   - Value: [Your Resend API key]
5. Click **Add Secret** or **Save**

## Note About Auto-Provided Secrets

Supabase automatically provides these secrets to Edge Functions:
- `SUPABASE_URL` - Your project URL
- `SUPABASE_ANON_KEY` - Your anon/public key
- `SUPABASE_SERVICE_ROLE_KEY` - Your service role key (the one you just rotated)

You don't need to manually set these - Supabase handles them automatically and updates them when you rotate keys.

## After Setting Secrets

Edge Functions will automatically use the new secrets on their next invocation. No redeployment needed!

## Testing

After setting the `RESEND_API_KEY`:
1. Go to your app: https://pcm-requisition.vercel.app
2. Try inviting a user again
3. The invitation email should now be sent successfully

---

**Important**: Keep this file local and never commit it to Git (it's already in .gitignore as *.md files with credentials).

# Supabase Edge Function Deployment Guide

This guide explains how to deploy and test the `invite-user` Edge Function for handling user invitations.

## Why We Need an Edge Function

The user invitation feature requires admin privileges to:
- Create new users in Supabase Auth
- Send invitation emails
- Create user profiles in the database

Since these operations require the **Service Role Key** (which should never be exposed to the client), we use a Supabase Edge Function that runs server-side with secure access to admin APIs.

## Prerequisites

1. **Supabase CLI installed**
   ```bash
   # Install Supabase CLI
   npm install -g supabase

   # Verify installation
   supabase --version
   ```

2. **Supabase Project Access**
   - Project URL
   - Service Role Key (from Supabase Dashboard > Settings > API)

3. **Docker Desktop** (for local testing)
   - Download from: https://www.docker.com/products/docker-desktop

## Project Structure

```
scratch/
├── supabase/
│   └── functions/
│       └── invite-user/
│           └── index.ts          # Edge Function code
└── docs/
    └── EDGE_FUNCTION_DEPLOYMENT.md  # This file
```

## Local Development & Testing

### 1. Initialize Supabase Project (if not already done)

```bash
cd c:\Users\rmute\.gemini\antigravity\scratch
supabase init
```

### 2. Link to Your Supabase Project

```bash
# Login to Supabase
supabase login

# Link to your project
supabase link --project-ref your-project-ref
```

To find your project ref:
- Go to Supabase Dashboard > Settings > General
- Copy the "Reference ID"

### 3. Start Local Supabase (Optional for Testing)

```bash
supabase start
```

This starts:
- Local Postgres database
- Local Edge Functions runtime
- Studio UI at http://localhost:54323

### 4. Serve Edge Function Locally

```bash
supabase functions serve invite-user --env-file .env.local
```

Create `.env.local` in the root directory:
```env
SUPABASE_URL=your-project-url
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

**Important**: Add `.env.local` to `.gitignore` to prevent committing secrets!

### 5. Test Locally

```bash
curl -i --location --request POST 'http://localhost:54321/functions/v1/invite-user' \
  --header 'Authorization: Bearer YOUR_USER_JWT_TOKEN' \
  --header 'Content-Type: application/json' \
  --data '{
    "email": "test@example.com",
    "fullName": "Test User",
    "role": "submitter",
    "projects": []
  }'
```

## Production Deployment

### 1. Deploy Edge Function

```bash
supabase functions deploy invite-user
```

This will:
- Upload the function code to Supabase
- Make it available at: `https://[your-project-ref].supabase.co/functions/v1/invite-user`

### 2. Set Environment Variables (Production)

Edge Functions in production need environment variables set in the Supabase Dashboard:

1. Go to **Edge Functions** in your Supabase Dashboard
2. Click on the `invite-user` function
3. Go to **Settings** > **Secrets**
4. Add these secrets (they're auto-populated, just verify):
   - `SUPABASE_URL` - Your project URL
   - `SUPABASE_ANON_KEY` - Your anon/public key
   - `SUPABASE_SERVICE_ROLE_KEY` - Your service role key

### 3. Verify Deployment

Check the function logs:
```bash
supabase functions logs invite-user
```

Or in the Dashboard:
- Go to **Edge Functions** > `invite-user` > **Logs**

## Testing the Complete Flow

### From the Application

1. **Login as super_admin**
   ```
   http://localhost:5173/login
   ```

2. **Navigate to Users**
   ```
   http://localhost:5173/users
   ```

3. **Click "Invite User"**
   ```
   http://localhost:5173/users/invite
   ```

4. **Fill in the form**:
   - Email: `newuser@example.com`
   - Full Name: `New User`
   - Role: Select any role
   - Projects: Select project(s)

5. **Click "Send Invitation"**

6. **Check the email** (sent to the email address you provided)

7. **Click the invitation link** in the email

8. **Set password** on the reset-password page

9. **Login** with the new credentials

### Using cURL (API Testing)

```bash
# First, get your JWT token (login as admin)
# You can find this in your browser's DevTools > Application > Local Storage > supabase.auth.token

curl -i --location --request POST 'https://your-project-ref.supabase.co/functions/v1/invite-user' \
  --header 'Authorization: Bearer YOUR_JWT_TOKEN' \
  --header 'Content-Type: application/json' \
  --data '{
    "email": "newuser@example.com",
    "fullName": "New User",
    "role": "submitter",
    "projects": ["project-uuid-1", "project-uuid-2"]
  }'
```

Expected response:
```json
{
  "success": true,
  "user": {
    "id": "user-uuid",
    "email": "newuser@example.com",
    "full_name": "New User",
    "role": "submitter"
  }
}
```

## Troubleshooting

### Function Not Found (404)

**Problem**: Getting 404 when calling the function

**Solutions**:
1. Verify deployment: `supabase functions list`
2. Check function name matches exactly: `invite-user`
3. Redeploy: `supabase functions deploy invite-user`

### Unauthorized (401)

**Problem**: Getting 401 Unauthorized

**Solutions**:
1. Check that you're logged in (valid JWT token)
2. Token must be passed in Authorization header
3. Verify token hasn't expired (tokens expire after 1 hour)

### Forbidden (403)

**Problem**: Getting 403 Forbidden

**Solutions**:
1. Verify the logged-in user has `super_admin` role
2. Check the users table for the correct role
3. Ensure RLS policies allow reading from users table

### User Already Exists (409)

**Problem**: Getting 409 Conflict

**Solutions**:
1. Check if user already exists in Auth > Users
2. Use a different email address
3. Delete the existing user if it's a test account

### Internal Server Error (500)

**Problem**: Getting 500 error

**Solutions**:
1. Check function logs: `supabase functions logs invite-user`
2. Verify all environment variables are set correctly
3. Check database for any constraint violations
4. Ensure Service Role Key has proper permissions

### Email Not Sending

**Problem**: Function succeeds but email doesn't arrive

**Solutions**:
1. Check spam/junk folder
2. Verify email templates are configured (see SUPABASE_EMAIL_SETUP.md)
3. Check Supabase Auth logs for email delivery errors
4. Verify SMTP settings in Dashboard > Authentication > Settings
5. On free tier, check if you've hit rate limits

## Monitoring & Logs

### View Logs in Dashboard

1. Go to **Edge Functions**
2. Click on `invite-user`
3. Go to **Logs** tab
4. Filter by error level if needed

### View Logs via CLI

```bash
# Tail logs in real-time
supabase functions logs invite-user --follow

# View last 100 logs
supabase functions logs invite-user --limit 100
```

## Security Considerations

1. **Never expose Service Role Key** - It's only used in the Edge Function
2. **Validate user is admin** - Function checks for super_admin role
3. **Rate limiting** - Consider implementing rate limits for invitations
4. **Email validation** - Function validates email format
5. **Duplicate prevention** - Checks if user already exists

## Performance Optimization

### Cold Starts

Edge Functions may have cold starts (first request after idle period). To minimize:
1. Keep function code small and focused
2. Import only necessary dependencies
3. Consider using a cron job to keep function warm

### Concurrent Invitations

If inviting multiple users:
```javascript
// Don't do this (sequential)
for (const user of users) {
  await inviteUser(user)
}

// Do this (parallel)
const invitations = users.map(user => inviteUser(user))
await Promise.all(invitations)
```

## Updating the Edge Function

When you make changes to `supabase/functions/invite-user/index.ts`:

```bash
# Redeploy
supabase functions deploy invite-user

# Verify new version is running
supabase functions logs invite-user --limit 1
```

## Cost Considerations

Supabase Edge Functions pricing (as of 2024):
- **Free tier**: 500,000 invocations/month
- **Pro tier**: 2,000,000 invocations/month + $2 per million after
- **Bandwidth**: $0.09 per GB

For most applications, user invitations will stay well within free tier limits.

## Alternative: Database Functions (If Edge Functions Don't Work)

If you can't use Edge Functions, you can create a PostgreSQL function with similar logic, but you'll lose the ability to use `inviteUserByEmail` and will need to handle email sending differently.

## Next Steps

1. Deploy the Edge Function to production
2. Test with a real email address
3. Configure email templates (see SUPABASE_EMAIL_SETUP.md)
4. Train admins on user invitation process
5. Set up monitoring/alerting for failed invitations

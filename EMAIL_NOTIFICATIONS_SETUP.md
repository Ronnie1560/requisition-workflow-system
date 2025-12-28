# Email Notifications Setup Guide

This guide will help you set up email notifications for your requisition management system.

## Overview

The email notification system consists of:
1. **Database migrations** - Add email preferences and queue table
2. **Email templates** - Pre-built HTML/text email templates
3. **Supabase Edge Function** - Processes the email queue
4. **React component** - User interface for managing preferences

## Step 1: Apply Database Migrations

Apply the migrations in order:

```bash
# 1. Base email notification system
supabase migration apply 20241225_email_notifications.sql

# 2. Integrate with notification triggers
supabase migration apply 20241225_integrate_email_notifications.sql
```

Or if using Supabase CLI:
```bash
supabase db push
```

## Step 2: Choose an Email Service

You can use any of these email services:

### Option A: Resend (Recommended)
- **Website**: https://resend.com
- **Free Tier**: 100 emails/day, 3,000/month
- **Setup Time**: ~5 minutes
- **Pros**: Modern API, great developer experience, generous free tier

### Option B: SendGrid
- **Website**: https://sendgrid.com
- **Free Tier**: 100 emails/day
- **Setup Time**: ~10 minutes
- **Pros**: Established, reliable, good documentation

### Option C: Mailgun
- **Website**: https://www.mailgun.com
- **Free Tier**: 5,000 emails/month (first 3 months)
- **Setup Time**: ~10 minutes
- **Pros**: Powerful API, good for transactional emails

## Step 3: Get Your API Key

### For Resend:
1. Sign up at https://resend.com
2. Go to API Keys
3. Click "Create API Key"
4. Copy the key (starts with `re_`)

### For SendGrid:
1. Sign up at https://sendgrid.com
2. Go to Settings > API Keys
3. Click "Create API Key"
4. Give it "Full Access" or "Mail Send" permission
5. Copy the key (starts with `SG.`)

## Step 4: Configure Environment Variables

### In Supabase Dashboard:
1. Go to your project
2. Navigate to **Settings > Edge Functions**
3. Add these secrets:

```bash
# Required
RESEND_API_KEY=re_your_api_key_here
FROM_EMAIL=noreply@yourdomain.com

# Optional (defaults shown)
APP_BASE_URL=https://yourdomain.com  # or http://localhost:5173 for dev
```

### For local development (.env.local):
```bash
RESEND_API_KEY=re_your_api_key_here
FROM_EMAIL=noreply@yourdomain.com
APP_BASE_URL=http://localhost:5173
```

## Step 5: Deploy the Edge Function

```bash
# Login to Supabase CLI
supabase login

# Link to your project
supabase link --project-ref your-project-ref

# Deploy the function
supabase functions deploy send-emails
```

## Step 6: Set Up Automated Email Processing

### Option A: Using Supabase Cron (Recommended)

Add a cron job to run the email function every 5 minutes:

```sql
-- Run in Supabase SQL Editor
select cron.schedule(
  'process-email-queue',
  '*/5 * * * *',  -- Every 5 minutes
  $$
  select
    net.http_post(
      url:='https://your-project-ref.supabase.co/functions/v1/send-emails',
      headers:='{"Authorization": "Bearer YOUR_ANON_KEY"}'::jsonb
    ) as request_id;
  $$
);
```

### Option B: Using GitHub Actions

Create `.github/workflows/send-emails.yml`:

```yaml
name: Process Email Queue

on:
  schedule:
    - cron: '*/5 * * * *'  # Every 5 minutes
  workflow_dispatch:  # Allow manual trigger

jobs:
  send-emails:
    runs-on: ubuntu-latest
    steps:
      - name: Call Edge Function
        run: |
          curl -X POST \
            -H "Authorization: Bearer ${{ secrets.SUPABASE_ANON_KEY }}" \
            https://your-project-ref.supabase.co/functions/v1/send-emails
```

### Option C: Using External Cron Service

Use services like:
- **Cron-job.org** (free, reliable)
- **EasyCron** (free tier available)
- **Uptime Robot** (free HTTP monitoring with 5-minute intervals)

Set up a HTTP request to:
```
POST https://your-project-ref.supabase.co/functions/v1/send-emails
Header: Authorization: Bearer YOUR_ANON_KEY
```

## Step 7: Add Email Preferences to User Settings

Add the email preferences component to your user settings page:

```jsx
// In client/src/pages/settings/UserSettings.jsx
import EmailNotificationSettings from '../../components/settings/EmailNotificationSettings'

// Add to your settings tabs:
{activeTab === 'notifications' && (
  <EmailNotificationSettings />
)}
```

## Step 8: Verify Email Domain (Production)

### For Resend:
1. Go to Domains in Resend dashboard
2. Click "Add Domain"
3. Add your domain (e.g., `yourdomain.com`)
4. Add the provided DNS records:
   - TXT record for verification
   - MX records (if receiving emails)
   - DKIM records (for authentication)
5. Wait for verification (usually < 1 hour)

### For SendGrid:
1. Go to Settings > Sender Authentication
2. Click "Authenticate Your Domain"
3. Follow the wizard to add DNS records
4. Verify the domain

## Testing

### Test Email Preferences UI:
1. Login to your app
2. Go to User Settings
3. Navigate to Email Notifications tab
4. Toggle preferences and save

### Test Email Sending:
```bash
# Manually trigger the Edge Function
curl -X POST \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  https://your-project-ref.supabase.co/functions/v1/send-emails
```

### Test Workflow:
1. Create and submit a new requisition
2. Check the email queue:
```sql
SELECT * FROM email_notifications
WHERE status = 'pending'
ORDER BY created_at DESC;
```
3. Wait for cron to run or manually trigger the function
4. Check your email inbox
5. Verify email queue status updated to 'sent':
```sql
SELECT * FROM email_notifications
WHERE status = 'sent'
ORDER BY sent_at DESC LIMIT 10;
```

## Email Templates

The system includes three pre-built email templates:

1. **Submission** - When a requisition is submitted
2. **Approval** - When a requisition is approved
3. **Rejection** - When a requisition is rejected

### Customizing Templates

Edit the template functions in the database:
- `generate_submission_email()`
- `generate_approval_email()`
- `generate_rejection_email()`

Example:
```sql
-- Customize the submission email
CREATE OR REPLACE FUNCTION generate_submission_email(
  p_requisition_id UUID,
  p_recipient_name TEXT
)
RETURNS TABLE(subject TEXT, body_html TEXT, body_text TEXT)
LANGUAGE plpgsql
AS $$
BEGIN
  -- Your custom email template here
END;
$$;
```

## Monitoring

### Check Email Queue Status
```sql
-- Pending emails
SELECT COUNT(*) as pending_count
FROM email_notifications
WHERE status = 'pending';

-- Failed emails
SELECT * FROM email_notifications
WHERE status = 'failed'
ORDER BY created_at DESC;

-- Recent sent emails
SELECT
  recipient_email,
  subject,
  sent_at
FROM email_notifications
WHERE status = 'sent'
ORDER BY sent_at DESC
LIMIT 20;
```

### View Email Send Rate
```sql
SELECT
  DATE(created_at) as date,
  COUNT(*) as total_emails,
  COUNT(*) FILTER (WHERE status = 'sent') as sent,
  COUNT(*) FILTER (WHERE status = 'failed') as failed
FROM email_notifications
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY DATE(created_at)
ORDER BY date DESC;
```

## Troubleshooting

### Emails Not Sending

1. **Check API Key**:
   ```sql
   -- Verify function can access secrets
   SELECT current_setting('custom.resend_api_key', true);
   ```

2. **Check Queue**:
   ```sql
   SELECT * FROM email_notifications
   WHERE status = 'pending'
   ORDER BY created_at DESC;
   ```

3. **Check Errors**:
   ```sql
   SELECT
     recipient_email,
     error_message,
     retry_count
   FROM email_notifications
   WHERE status = 'failed';
   ```

4. **Check Function Logs**:
   - Go to Supabase Dashboard
   - Navigate to Edge Functions > send-emails
   - Check the Logs tab

### Emails Going to Spam

1. **Verify Domain**: Make sure DNS records are properly configured
2. **Add SPF Record**: Prevent spoofing
3. **Add DKIM**: Authenticate emails
4. **Avoid Spam Words**: Check email content
5. **Test Spam Score**: Use https://www.mail-tester.com

### High Failure Rate

1. **Check API Limits**: Verify you haven't exceeded your email service limits
2. **Check Retry Count**: Emails fail after 3 retries
3. **Validate Email Addresses**: Ensure recipient emails are valid
4. **Check Service Status**: Verify email service is operational

## Cost Estimates

### Resend (Recommended)
- **Free**: Up to 3,000 emails/month
- **Paid**: $20/month for 50,000 emails
- **Best for**: Startups, small teams

### SendGrid
- **Free**: Up to 100 emails/day
- **Paid**: $15/month for 40,000 emails
- **Best for**: Established businesses

### Supabase Edge Functions
- **Free**: 500,000 invocations/month
- With 5-minute cron: ~8,640 invocations/month (well within free tier)

## Security Best Practices

1. **Never commit API keys** to version control
2. **Use environment variables** for all secrets
3. **Implement rate limiting** if exposing function publicly
4. **Validate email addresses** before queueing
5. **Monitor for abuse** (check sent email counts)
6. **Use HTTPS only** for all API calls
7. **Sanitize user input** in email templates

## Support

For issues or questions:
- Check Resend docs: https://resend.com/docs
- Check SendGrid docs: https://docs.sendgrid.com
- Check Supabase docs: https://supabase.com/docs

## Next Steps

Once email notifications are working:
1. ✅ Monitor email delivery rates
2. ✅ Gather user feedback on email frequency
3. ✅ Consider adding email digests (daily/weekly summaries)
4. ✅ Add email templates for comments
5. ✅ Implement email unsubscribe links (required for compliance)
6. ✅ Add email analytics (open rates, click rates)

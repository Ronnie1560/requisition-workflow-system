# Email Template Setup Instructions

## Quick Setup Guide for PCM Requisition Invitations

### Step 1: Access Email Templates

1. Go to: **https://supabase.com/dashboard/project/winfoubqhkrigtgjwrpm/auth/templates**
2. Or navigate: **Authentication** → **Email Templates** in your Supabase Dashboard

### Step 2: Configure Invite User Template

1. **Click on "Invite User"** template

2. **Subject Line** - Replace with:
   ```
   Welcome to PCM Requisition System - Set Your Password
   ```

3. **Email Body** - Copy the entire content from:
   `docs/EMAIL_TEMPLATE_CUSTOM.html`

   Or use the simplified version below if you prefer plain text:

### Step 3: Simplified Text Version (Alternative)

If you prefer a simpler email without fancy styling:

**Subject:**
```
Welcome to PCM Requisition System
```

**Body:**
```html
<h2>Welcome to PCM Requisition System!</h2>

<p>Hello,</p>

<p>You've been invited to join the PCM Requisition System. To get started, please click the button below to set your password:</p>

<p>
  <a href="{{ .ConfirmationURL }}" style="display: inline-block; background-color: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">
    Set Your Password
  </a>
</p>

<h3>What's Next?</h3>
<ol>
  <li>Click the button above to set your password</li>
  <li>Log in to the PCM Requisition System</li>
  <li>Access your assigned projects</li>
  <li>Start creating and managing requisitions</li>
</ol>

<p>If the button doesn't work, copy and paste this link into your browser:</p>
<p>{{ .ConfirmationURL }}</p>

<p><small>This invitation link will expire in 24 hours. If you didn't expect this invitation, please ignore this email.</small></p>

<hr>
<p><small>PCM Requisition System - This is an automated message, please do not reply.</small></p>
```

### Step 4: Configure URL Settings

1. Go to: **Authentication** → **URL Configuration**
2. Set **Site URL**: `http://localhost:5173` (for development)
3. Add **Redirect URLs**:
   - `http://localhost:5173/reset-password`
   - `http://localhost:5173/*` (wildcard for all routes)

For production, update these to your production domain:
   - Site URL: `https://yourdomain.com`
   - Redirect: `https://yourdomain.com/reset-password`

### Step 5: SMTP Configuration (Optional but Recommended)

For better email delivery in production:

1. Go to: **Authentication** → **SMTP Settings**
2. Toggle **Enable Custom SMTP**
3. Configure with your email provider:

**Gmail Example:**
```
Host: smtp.gmail.com
Port: 587
Username: your-email@gmail.com
Password: [App Password - not your regular password]
Sender Email: your-email@gmail.com
Sender Name: PCM Requisition System
```

**Other Providers:**
- **SendGrid**: smtp.sendgrid.net (Port: 587)
- **AWS SES**: email-smtp.us-east-1.amazonaws.com (Port: 587)
- **Mailgun**: smtp.mailgun.org (Port: 587)

### Step 6: Test Configuration

1. Send a test invitation to yourself
2. Check spam/junk folder if not received
3. Click the invitation link
4. Verify it redirects to reset-password page
5. Set password and login

### Important Variables

These variables are automatically replaced by Supabase:
- `{{ .Email }}` - Recipient's email
- `{{ .ConfirmationURL }}` - Password setup link
- `{{ .Token }}` - Verification token
- `{{ .SiteURL }}` - Your site URL

### Testing Checklist

- [ ] Email arrives within 2 minutes
- [ ] Email not in spam folder
- [ ] Invitation link works
- [ ] Link redirects to reset-password page
- [ ] Password setup works
- [ ] User can login after setup
- [ ] User sees assigned projects

### Troubleshooting

**Email not arriving?**
- Check spam/junk folder
- Verify SMTP settings
- Check Supabase Authentication logs
- Free tier has rate limits (upgrade if needed)

**Link not working?**
- Verify Redirect URLs are configured
- Check Site URL matches your app
- Ensure reset-password page exists

**Email formatting broken?**
- Test with simplified text version first
- Ensure HTML is valid
- Some email clients don't support all CSS

### Production Checklist

Before going live:
- [ ] Update Site URL to production domain
- [ ] Update Redirect URLs to production domain
- [ ] Configure custom SMTP (recommended)
- [ ] Test with real email addresses
- [ ] Verify email doesn't go to spam
- [ ] Customize email branding (logo, colors)
- [ ] Set appropriate rate limits

---

## Quick Links

- **Email Templates**: https://supabase.com/dashboard/project/winfoubqhkrigtgjwrpm/auth/templates
- **URL Config**: https://supabase.com/dashboard/project/winfoubqhkrigtgjwrpm/auth/url-configuration
- **SMTP Settings**: https://supabase.com/dashboard/project/winfoubqhkrigtgjwrpm/settings/auth
- **Auth Logs**: https://supabase.com/dashboard/project/winfoubqhkrigtgjwrpm/logs/auth-logs
- **Function Logs**: https://supabase.com/dashboard/project/winfoubqhkrigtgjwrpm/functions/invite-user/logs

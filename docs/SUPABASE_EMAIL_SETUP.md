# Supabase Email Templates Configuration

This guide will help you configure email templates for user invitations in Supabase.

## Prerequisites

- Access to Supabase Dashboard
- Project already set up with authentication enabled

## Steps to Configure Email Templates

### 1. Access Email Templates

1. Go to your Supabase Dashboard: https://supabase.com/dashboard
2. Select your project
3. Navigate to **Authentication** > **Email Templates** from the left sidebar

### 2. Configure the Invite User Template

The "Invite User" template is sent when an admin invites a new user via the `inviteUser()` function.

#### Default Template Variables

Supabase provides these variables you can use in your templates:

- `{{ .Email }}` - User's email address
- `{{ .ConfirmationURL }}` - Link to set password and activate account
- `{{ .Token }}` - Verification token
- `{{ .TokenHash }}` - Hashed token
- `{{ .SiteURL }}` - Your site URL (configured in Auth settings)
- `{{ .RedirectTo }}` - Redirect URL after confirmation

#### Recommended Custom Template

Here's a professional invitation email template:

**Subject Line:**
```
Welcome to PCM Requisition System - Set Your Password
```

**Email Body (HTML):**
```html
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Welcome to PCM Requisition System</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="background-color: #4F46E5; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
        <h1 style="color: white; margin: 0; font-size: 24px;">PCM Requisition System</h1>
    </div>

    <div style="background-color: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
        <h2 style="color: #1f2937; margin-top: 0;">You've Been Invited!</h2>

        <p>Hello,</p>

        <p>You've been invited to join the <strong>PCM Requisition System</strong>. Our team has created an account for you to manage requisitions, approvals, and procurement processes.</p>

        <p>To get started, please click the button below to set your password and activate your account:</p>

        <div style="text-align: center; margin: 30px 0;">
            <a href="{{ .ConfirmationURL }}"
               style="background-color: #4F46E5; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">
                Set Your Password
            </a>
        </div>

        <p style="color: #6b7280; font-size: 14px;">
            This link will expire in 24 hours. If you didn't expect this invitation, you can safely ignore this email.
        </p>

        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">

        <div style="background-color: #eff6ff; padding: 15px; border-radius: 6px; border-left: 4px solid #4F46E5;">
            <p style="margin: 0; font-size: 14px; color: #1e40af;">
                <strong>What's Next?</strong><br>
                1. Click the button above to set your password<br>
                2. Log in to the system<br>
                3. Access your assigned projects and start managing requisitions
            </p>
        </div>

        <p style="margin-top: 30px; color: #6b7280; font-size: 14px;">
            If the button doesn't work, copy and paste this link into your browser:<br>
            <a href="{{ .ConfirmationURL }}" style="color: #4F46E5; word-break: break-all;">{{ .ConfirmationURL }}</a>
        </p>

        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">

        <p style="color: #6b7280; font-size: 12px; text-align: center; margin: 0;">
            PCM Requisition System<br>
            This is an automated message, please do not reply to this email.
        </p>
    </div>
</body>
</html>
```

### 3. Configure Site URL and Redirect URL

1. Go to **Authentication** > **URL Configuration**
2. Set your **Site URL** to: `http://localhost:5173` (development) or your production URL
3. Add **Redirect URLs**:
   - `http://localhost:5173/reset-password`
   - Your production URL + `/reset-password`

### 4. Test Email Configuration

Before testing with real users, you can test email delivery:

1. Go to **Authentication** > **Users**
2. Click **Invite User**
3. Enter a test email address
4. Check your email inbox for the invitation

### 5. Email Provider Configuration (Optional)

By default, Supabase uses their SMTP service with rate limits:
- **Free tier**: Limited emails per hour
- **Paid tiers**: Higher limits

For production, consider configuring a custom SMTP provider:

1. Go to **Authentication** > **Settings** > **SMTP Settings**
2. Configure your own SMTP server (Gmail, SendGrid, AWS SES, etc.)

#### Example SMTP Providers

**SendGrid:**
- Host: `smtp.sendgrid.net`
- Port: `587`
- Username: `apikey`
- Password: Your SendGrid API Key

**Gmail:**
- Host: `smtp.gmail.com`
- Port: `587`
- Username: Your Gmail address
- Password: App-specific password

**AWS SES:**
- Host: `email-smtp.us-east-1.amazonaws.com` (or your region)
- Port: `587`
- Username: Your SMTP credentials
- Password: Your SMTP credentials

### 6. Customize Other Templates (Optional)

While you're in Email Templates, you may also want to customize:

- **Confirm Signup** - For manual user registrations
- **Magic Link** - For passwordless login (if you enable it)
- **Change Email Address** - When users update their email
- **Reset Password** - For password recovery

## Testing the Complete Flow

1. **As Admin**: Navigate to `/users/invite` in your app
2. **Fill in the form**:
   - Email: Test email address
   - Full Name: Test User
   - Role: Select a role
   - Projects: Select project(s)
3. **Click "Send Invitation"**
4. **Check email**: The test user should receive the invitation
5. **Click the link**: Should redirect to `/reset-password`
6. **Set password**: User sets their password
7. **Login**: User can now log in with their credentials

## Troubleshooting

### Emails Not Arriving

1. Check your spam/junk folder
2. Verify SMTP settings in Supabase dashboard
3. Check Supabase logs: **Authentication** > **Logs**
4. Ensure Site URL is correctly configured

### Confirmation Link Not Working

1. Verify Redirect URLs are properly configured
2. Check that your app is running on the configured URL
3. Ensure the reset-password page exists and is accessible

### Rate Limiting

If you hit rate limits:
1. Upgrade your Supabase plan
2. Configure custom SMTP provider
3. Implement email queuing for bulk invitations

## Security Best Practices

1. **Always use HTTPS** in production for Site URL
2. **Whitelist redirect URLs** only for your domain
3. **Set appropriate token expiry** (default is 24 hours)
4. **Monitor authentication logs** for suspicious activity
5. **Use environment-specific URLs** (dev, staging, production)

## Next Steps

Once email templates are configured:
1. Test the invitation flow with a real email
2. Customize branding (colors, logo) to match your organization
3. Set up custom SMTP for production
4. Train admins on the user invitation process

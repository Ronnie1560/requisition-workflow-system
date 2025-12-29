# Supabase Configuration Guide

## Setting Invitation Link Expiration to 24 Hours

To ensure invitation links expire after 24 hours instead of the default 1 hour, you need to configure the Supabase Auth settings.

### Steps:

1. **Open Supabase Dashboard**
   - Go to [https://supabase.com/dashboard](https://supabase.com/dashboard)
   - Select your PCM Requisition project

2. **Navigate to Auth Settings**
   - Click on **Authentication** in the left sidebar
   - Click on **Email Templates**

3. **Configure Recovery Email Template**
   - Find the **"Confirm signup"** or **"Magic Link"** template (depending on your setup)
   - Look for the **Token expiration** or **Link expiration** setting
   - Change the value from `3600` seconds (1 hour) to `86400` seconds (24 hours)

4. **Alternative: Auth URL Configuration**
   - Navigate to **Authentication** → **URL Configuration**
   - Look for **"Email link validity"** or **"Token expiration"**
   - Set to **86400 seconds** (24 hours)

### Business Rules (Implemented):

✅ **Single-use links**: Links can only be used once (Supabase default behavior)
✅ **24-hour expiration**: Links expire after 24 hours (after configuration)
✅ **Resend capability**: Admins can resend invitation links if they expire

### Technical Notes:

- The `auth.admin.generateLink()` method does not accept a custom expiration parameter
- Expiration is controlled at the project level in Supabase Dashboard
- Both `invite-user` and `resend-invitation` Edge Functions use the same recovery link mechanism
- Email templates have been updated to reflect 24-hour expiration

### Verification:

After changing the settings, you can verify by:
1. Creating a new user invitation
2. Checking the invitation email
3. Waiting more than 1 hour (but less than 24 hours)
4. Confirming the link still works

---

**Last Updated**: 2025-01-29

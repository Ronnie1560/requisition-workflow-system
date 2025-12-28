# PCM Requisition System - Deployment Guide

## Pre-Deployment Checklist

### 1. Run Database Migrations

```powershell
# Navigate to project root
cd c:\Users\rmute\.gemini\antigravity\scratch

# Push all migrations to Supabase
supabase db push
```

This will apply:
- `20241227_add_rejection_reason.sql` - Adds rejection_reason column
- `20241227_pre_deployment_fixes.sql` - Performance indexes, race condition fixes, app_base_url

### 2. Configure Environment Variables

#### Supabase Edge Function Secrets
Set these in your Supabase dashboard (Project Settings → Edge Functions → Secrets) or via CLI:

```powershell
supabase secrets set RESEND_API_KEY=re_xxxxxxxxxxxx
supabase secrets set FROM_EMAIL=noreply@yourdomain.com
supabase secrets set APP_BASE_URL=https://your-production-url.com
```

#### Update Organization Settings
After deployment, update the app_base_url in the organization_settings table:

```sql
UPDATE organization_settings 
SET app_base_url = 'https://your-production-url.com';
```

### 3. Deploy Edge Functions

```powershell
# Deploy the email sending function
supabase functions deploy send-emails

# Deploy the invite user function (if not already deployed)
supabase functions deploy invite-user
```

### 4. Set Up Email Cron Job

In Supabase Dashboard → Edge Functions → Schedules:

1. Create a new schedule for `send-emails`
2. Set cron expression: `*/5 * * * *` (every 5 minutes)
3. Or use: `*/1 * * * *` (every minute for faster delivery)

Alternatively, create a database webhook to trigger on INSERT to `email_notifications`.

### 5. Build Frontend for Production

```powershell
cd client

# Install dependencies (if not done)
npm install

# Build for production
npm run build
```

The build output will be in `client/dist/`.

### 6. Deploy Frontend

Options:
- **Vercel**: `vercel --prod`
- **Netlify**: Drag & drop `dist/` folder or connect GitHub
- **Manual**: Copy `dist/` contents to your web server

### 7. Update Supabase URL (if needed)

In `client/.env.production`:
```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

---

## Post-Deployment Verification

### Test Checklist

1. **Authentication**
   - [ ] Login works
   - [ ] Logout works
   - [ ] Password reset works

2. **Requisition Workflow**
   - [ ] Create draft requisition
   - [ ] Submit requisition
   - [ ] Email notification received (submitter notified)
   - [ ] Review requisition
   - [ ] Email notification received (reviewer notified)
   - [ ] Approve requisition
   - [ ] Email notification received (approver notified)
   - [ ] Reject requisition (test rejection reason is saved)

3. **Reports**
   - [ ] Dashboard loads
   - [ ] Reports load correctly
   - [ ] Drill-down works on report items

4. **Print/Export**
   - [ ] Print requisition shows organization details
   - [ ] CSV export works
   - [ ] PDF export works

5. **Admin Functions**
   - [ ] User management works
   - [ ] Organization settings update works
   - [ ] Logo upload works

---

## Rollback Procedure

If issues occur:

1. **Frontend**: Redeploy previous version from Git
2. **Database**: Migrations can be rolled back with:
   ```sql
   -- Remove rejection_reason column
   ALTER TABLE requisitions DROP COLUMN IF EXISTS rejection_reason;
   
   -- Remove app_base_url column
   ALTER TABLE organization_settings DROP COLUMN IF EXISTS app_base_url;
   ```

---

## Monitoring

### Email Queue
Check pending emails:
```sql
SELECT * FROM email_notifications 
WHERE status = 'pending' 
ORDER BY created_at DESC 
LIMIT 20;
```

Check failed emails:
```sql
SELECT * FROM email_notifications 
WHERE status = 'failed' 
ORDER BY created_at DESC;
```

### Error Logs
- Check Supabase Dashboard → Logs → Edge Functions
- Check Supabase Dashboard → Logs → Postgres

---

## Known Limitations

1. **PDF Export**: Uses browser print dialog (not direct PDF download)
2. **Email Delivery**: Depends on Resend API availability
3. **Real-time**: Notifications use Supabase Realtime (WebSocket)

---

## Support Contacts

- **Technical Issues**: [Your support email]
- **Supabase Status**: https://status.supabase.com
- **Resend Status**: https://status.resend.com

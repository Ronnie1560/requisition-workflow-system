# Production Deployment Guide
**PCM Requisition System**

This guide walks you through deploying the application to production with all critical fixes implemented.

---

## Prerequisites

- ✅ All 10 critical fixes committed and pushed to GitHub
- ✅ Edge functions deployed with CORS fixes
- ✅ Database migration deployed and verified
- ✅ Production environment ready

---

## Step 1: Configure Sentry (Error Monitoring)

### 1.1 Create Sentry Account
1. Go to https://sentry.io
2. Sign up for free account (or login)
3. Create a new project:
   - Platform: **React**
   - Project name: **pcm-requisition-system**

### 1.2 Get Your Sentry DSN
1. After creating project, you'll see your DSN
2. It looks like: `https://abc123@o123456.ingest.sentry.io/123456`
3. Copy this DSN - you'll need it for environment variables

---

## Step 2: Configure Production Environment Variables

### 2.1 Update `.env.production` File

The file has been created at `client/.env.production`. You need to fill in these values:

```env
# Already filled in:
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here

# YOU NEED TO FILL IN:

# Sentry DSN (from Step 1.2)
VITE_SENTRY_DSN=https://your-sentry-dsn-here

# Your production domain (after deployment)
VITE_APP_BASE_URL=https://your-production-domain.com
```

### 2.2 What to Put in VITE_APP_BASE_URL

**Option A: If using Vercel**
- Before first deployment: Leave empty or use placeholder
- After first deployment: Update with your Vercel URL (e.g., `https://requisition-workflow.vercel.app`)

**Option B: If using Netlify**
- Before first deployment: Leave empty or use placeholder
- After first deployment: Update with your Netlify URL (e.g., `https://pcm-requisition.netlify.app`)

**Option C: If using custom domain**
- Use your custom domain (e.g., `https://requisition.passionchristianministries.org`)

---

## Step 3: Build Production Bundle

### 3.1 Install Dependencies (if not already done)

```bash
cd client
npm install
```

### 3.2 Build Production Bundle

```bash
npm run build
```

Expected output:
```
✓ built in XXs
dist/index.html                     1.56 kB
dist/assets/index-BtngBBBQ.css     46.26 kB │ gzip: 8.07 kB
dist/assets/vendor-excel-xxx.js   938.62 kB │ gzip: 270.57 kB
dist/assets/vendor-pdf-xxx.js     417.39 kB │ gzip: 136.02 kB
dist/assets/vendor-charts-xxx.js  378.11 kB │ gzip: 111.84 kB
dist/assets/index-xxx.js          814.71 kB │ gzip: 252.49 kB
```

### 3.3 Verify Build

Check that `dist/` folder was created:
```bash
ls dist/
```

Should contain:
- `index.html`
- `assets/` folder with JS and CSS files

---

## Step 4: Deploy to Hosting Platform

Choose your hosting platform:

### Option A: Deploy to Vercel (Recommended)

#### 4.1 Install Vercel CLI

```bash
npm install -g vercel
```

#### 4.2 Login to Vercel

```bash
vercel login
```

#### 4.3 Deploy

```bash
cd client
vercel --prod
```

Follow the prompts:
- **Set up and deploy?** Yes
- **Which scope?** Select your account
- **Link to existing project?** No (or Yes if you have one)
- **Project name?** `pcm-requisition-system`
- **Directory?** `.` (current directory)
- **Build command?** `npm run build`
- **Output directory?** `dist`

#### 4.4 Configure Environment Variables on Vercel

1. Go to Vercel Dashboard: https://vercel.com/dashboard
2. Select your project
3. Go to **Settings** → **Environment Variables**
4. Add each variable from `.env.production`:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `VITE_SENTRY_DSN`
   - `VITE_SENTRY_ENVIRONMENT` = `production`
   - `VITE_APP_BASE_URL` = (your Vercel URL)
5. **Redeploy** after adding variables

---

### Option B: Deploy to Netlify

#### 4.1 Install Netlify CLI

```bash
npm install -g netlify-cli
```

#### 4.2 Login to Netlify

```bash
netlify login
```

#### 4.3 Deploy

```bash
cd client
netlify deploy --prod
```

Follow the prompts:
- **Create new site or use existing?** Create new
- **Team?** Select your team
- **Site name?** `pcm-requisition-system`
- **Publish directory?** `dist`

#### 4.4 Configure Environment Variables on Netlify

1. Go to Netlify Dashboard
2. Select your site
3. Go to **Site settings** → **Environment variables**
4. Add each variable from `.env.production`
5. **Trigger deploy** after adding variables

---

### Option C: Manual Deployment (Any Host)

1. **Build locally**:
   ```bash
   cd client
   npm run build
   ```

2. **Upload `dist/` folder** to your web server

3. **Configure environment variables** on your hosting platform

4. **Important**: Ensure your server is configured for SPA routing
   - All routes should serve `index.html`
   - Most hosts have a "Redirect all to index.html" option

---

## Step 5: Update Edge Function Environment

After you have your production URL, update the edge function environment:

1. Go to Supabase Dashboard → Functions → Settings
2. Update `APP_BASE_URL` to your production domain
3. Example: `https://requisition-workflow.vercel.app`

---

## Step 6: Verify Production Deployment

### 6.1 Test Basic Functionality

1. **Open your production URL**
2. **Check browser console** (F12 → Console)
   - Should see no errors
   - Should see `[Web Vitals]` logs (if monitoring is working)

3. **Test Authentication**
   - Try logging in
   - Check console for errors

4. **Test CSP Headers**
   - Open DevTools → Network tab
   - Reload page
   - Click on the main document
   - Check Response Headers for CSP headers

### 6.2 Test Password Policy

1. Go to `/register` (or `/reset-password`)
2. Try weak password: `weak`
   - Should show error: "Password must be at least 8 characters"
3. Try password without uppercase: `lowercase123`
   - Should show error: "Password must contain at least one uppercase letter"
4. Try strong password: `Strong123`
   - Should be accepted ✓

### 6.3 Test Lazy Loading

1. Open DevTools → Network tab
2. Reload page
3. Verify initial bundle does NOT include:
   - `exceljs`
   - `jspdf`
   - `recharts`

4. Navigate to Reports page
   - Should see `vendor-charts-xxx.js` load

5. Click "Export to Excel"
   - Should see `vendor-excel-xxx.js` load

6. Click "Export PDF"
   - Should see `vendor-pdf-xxx.js` load

### 6.4 Test Error Tracking (Sentry)

1. Open browser console
2. Run: `throw new Error('Test production error')`
3. Check Sentry dashboard (https://sentry.io)
4. Should see error captured with full stack trace

### 6.5 Test Edge Functions (CORS)

1. Login as super_admin
2. Go to Users Management
3. Try inviting a new user
4. Check console - should be NO CORS errors
5. Email should be sent successfully

---

## Step 7: Update App Base URL (if needed)

If you left `VITE_APP_BASE_URL` empty initially:

1. Update `.env.production` with your production URL
2. Rebuild:
   ```bash
   npm run build
   ```
3. Redeploy to your hosting platform

---

## Step 8: Monitor Production

### 8.1 Sentry Dashboard
- Monitor errors: https://sentry.io
- Check Web Vitals performance metrics
- Review user feedback

### 8.2 Supabase Dashboard
- Monitor database performance
- Check edge function logs
- Review authentication metrics

### 8.3 Web Vitals Targets

Monitor these Core Web Vitals in Sentry:
- **LCP** (Largest Contentful Paint): < 2.5s ✓
- **FID** (First Input Delay): < 100ms ✓
- **CLS** (Cumulative Layout Shift): < 0.1 ✓
- **TTFB** (Time to First Byte): < 800ms ✓
- **INP** (Interaction to Next Paint): < 200ms ✓

---

## Troubleshooting

### Build Fails

**Error**: Module not found
- **Fix**: Run `npm install` again

**Error**: Environment variable undefined
- **Fix**: Check `.env.production` file exists and variables are set

### Deployment Issues

**Error**: 404 on page refresh
- **Fix**: Configure SPA routing on your host (serve index.html for all routes)

**Error**: CORS errors in console
- **Fix**:
  1. Check edge function environment has correct `APP_BASE_URL`
  2. Verify production URL matches exactly (no trailing slash)

### Sentry Not Working

**Error**: No errors appearing in Sentry
- **Fix**:
  1. Verify `VITE_SENTRY_DSN` is set correctly
  2. Check Sentry project is active
  3. Trigger test error: `throw new Error('Test')`

### Lazy Loading Not Working

**Error**: Large initial bundle size
- **Fix**:
  1. Verify production build (not dev server)
  2. Check Network tab for separate chunks
  3. Ensure dynamic imports are not removed by tree-shaking

---

## Post-Deployment Checklist

- [ ] Production URL is live and accessible
- [ ] Authentication works (login/register/logout)
- [ ] CSP headers present (check Network → Response Headers)
- [ ] Password policy enforced (8+ chars, complexity)
- [ ] Lazy loading working (check Network tab for chunks)
- [ ] Export functions work (Excel, PDF)
- [ ] Error tracking active (test error appears in Sentry)
- [ ] Web Vitals being tracked (check Sentry)
- [ ] Edge functions working (invite user, no CORS errors)
- [ ] No console errors on page load
- [ ] All critical fixes verified per [TESTING_CHECKLIST.md](TESTING_CHECKLIST.md)

---

## Rollback Plan

If deployment fails:

1. **Revert to previous version**:
   ```bash
   git revert HEAD
   git push origin main
   ```

2. **Redeploy previous version** on hosting platform

3. **Check Supabase Dashboard** for any database issues

---

## Success Criteria

✅ **Security**: All 4 security fixes active
✅ **Monitoring**: Errors tracked in Sentry
✅ **Performance**: Bundle size reduced by 67%
✅ **Reliability**: Retry logic handling network failures
✅ **User Experience**: Fast initial load, smooth exports

---

## Next Steps After Production

1. **Monitor for 24-48 hours**
   - Check Sentry for errors
   - Review Web Vitals metrics
   - Gather user feedback

2. **Plan Week 3-4 Enhancements**
   - Based on [COMPREHENSIVE_SYSTEM_REVIEW_2026.md](COMPREHENSIVE_SYSTEM_REVIEW_2026.md)
   - Implement MFA
   - Add server-side file validation
   - Build advanced reporting features

3. **Regular Maintenance**
   - Weekly: Review Sentry errors
   - Monthly: Check Web Vitals trends
   - Quarterly: Security audit

---

**Deployment Support**: If you encounter issues, refer to:
- [DEPLOYMENT_SUMMARY.md](DEPLOYMENT_SUMMARY.md) - Implementation details
- [TESTING_CHECKLIST.md](TESTING_CHECKLIST.md) - Testing guide
- [MIGRATION_SYNC.md](supabase/MIGRATION_SYNC.md) - Database migration guide

Good luck with your deployment! 🚀

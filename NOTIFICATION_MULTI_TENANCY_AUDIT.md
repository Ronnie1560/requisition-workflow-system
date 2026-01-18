# Notification System Multi-Tenancy Audit

**Date**: 2026-01-18
**Status**: ⚠️ **CRITICAL ISSUES FOUND**

---

## Executive Summary

The notification system was built for single-tenancy and **DOES NOT properly support multi-tenant data isolation**. Users belonging to multiple organizations will see notifications from **ALL** organizations, creating confusion and potential data leakage.

---

## 🔍 Findings

### 1. In-App Notifications ⚠️ **PARTIALLY ISOLATED**

**Table Structure**: `notifications`
- ✅ HAS `org_id` column (added in multi-tenancy migration)
- ✅ HAS org_id index
- ✅ HAS RLS policies

**The Problem**:
```javascript
// client/src/context/NotificationContext.jsx:57-62
const { data, error } = await supabase
  .from('notifications')
  .select('*')
  .eq('user_id', user.id)  // ❌ Only filters by user_id, NOT org_id!
  .order('created_at', { ascending: false })
  .limit(50)
```

**Current Behavior**:
- Frontend query only filters by `user_id`
- RLS policy checks `user_belongs_to_org(org_id)` which returns TRUE for ALL organizations the user belongs to
- **Result**: Users see notifications from ALL their organizations, not just the currently selected one

**Example Scenario**:
- User belongs to "Jasiri Foundation" and "Default Organization"
- User switches to "Jasiri Foundation"
- User STILL sees notifications from "Default Organization" ❌

---

### 2. Email Notifications ⚠️ **NOT ISOLATED**

**Table Structure**: `email_notifications`
- ❌ DOES NOT have `org_id` column
- ❌ NO multi-tenant filtering

**The Problem**:
```sql
-- supabase/migrations/20250112_03_notifications.sql:602-620
INSERT INTO email_notifications (
  recipient_email,
  recipient_user_id,
  subject,
  body_html,
  body_text,
  notification_type,
  related_requisition_id,
  status
)
-- ❌ No org_id column!
```

**Email Sending** ([send-emails/index.ts](supabase/functions/send-emails/index.ts:42-48)):
```typescript
const { data: emails, error: fetchError } = await supabase
  .from('email_notifications')
  .select('*')
  .eq('status', 'pending')
  .lt('retry_count', 3)
  .order('created_at', { ascending: true })
  .limit(10)
// ❌ NO org_id filtering!
```

**Current Behavior**:
- Email queue has no organization context
- Emails are sent regardless of which organization triggered them
- Email templates don't indicate which organization sent them (uses hardcoded "Passion Christian Ministries")

**Example Scenario**:
- User belongs to "Jasiri Foundation" and "Default Organization"
- Requisition approved in "Jasiri Foundation"
- Email sent says "Passion Christian Ministries" instead of "Jasiri Foundation" ❌

---

## 🔴 Critical Issues

### Issue 1: Cross-Organization Notification Visibility
**Severity**: HIGH
**Impact**: Users see notifications from all organizations they belong to
**Example**: User working in "Jasiri" sees notifications from "Default Org"
**Security Risk**: Medium (data leakage, but limited to users who belong to multiple orgs)

### Issue 2: Email Branding Confusion
**Severity**: MEDIUM
**Impact**: All emails say "Passion Christian Ministries" regardless of organization
**Example**: "Jasiri Foundation" users receive emails with wrong organization name
**Security Risk**: Low (confusion but no data leakage)

### Issue 3: Email Notification Lacks Organization Context
**Severity**: MEDIUM
**Impact**: Cannot filter or track emails by organization
**Example**: Cannot see which organization triggered an email
**Security Risk**: Low (operational issue, not security)

---

## ✅ What's Working

1. **In-App Notifications Table Structure**:
   - Has `org_id` column
   - Has RLS policies (though they use `user_belongs_to_org` which is too permissive)
   - Notifications ARE created with `org_id` (from trigger functions)

2. **Email Trigger Functions**:
   - Properly get requisition context
   - Create notifications when requisition status changes
   - Check user email preferences

---

## 🛠️ Recommended Fixes

### Fix 1: Update In-App Notification Filtering (High Priority)

**File**: `client/src/context/NotificationContext.jsx`

```javascript
import { useOrganization } from './OrganizationContext'

// Inside NotificationProvider:
const { currentOrg } = useOrganization()

// Update loadNotifications (line 54):
const loadNotifications = useCallback(async () => {
  if (!user?.id || !currentOrg?.id) return

  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', user.id)
    .eq('org_id', currentOrg.id)  // ✅ ADD THIS LINE
    .order('created_at', { ascending: false })
    .limit(50)

  if (!error && data) {
    setNotifications(data)
    setUnreadCount(data.filter(n => !n.is_read).length)
  }
}, [user, currentOrg])  // ✅ Add currentOrg to dependencies
```

**Update Real-time Subscription** (line 138-149):
```javascript
const channel = supabase
  .channel('notifications')
  .on(
    'postgres_changes',
    {
      event: 'INSERT',
      schema: 'public',
      table: 'notifications',
      filter: `user_id=eq.${user.id}&org_id=eq.${currentOrg.id}`  // ✅ ADD org_id filter
    },
    (payload) => {
      setNotifications(prev => [payload.new, ...prev])
      setUnreadCount(prev => prev + 1)
    }
  )
  .subscribe()
```

---

### Fix 2: Add org_id to Email Notifications (High Priority)

**Create Migration**: `supabase/migrations/20250118_add_org_to_email_notifications.sql`

```sql
-- Add org_id to email_notifications table
ALTER TABLE email_notifications
ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES organizations(id) ON DELETE CASCADE;

-- Create index
CREATE INDEX IF NOT EXISTS idx_email_notifications_org ON email_notifications(org_id);

-- Update existing records to use requisition's org_id
UPDATE email_notifications en
SET org_id = r.org_id
FROM requisitions r
WHERE en.related_requisition_id = r.id
AND en.org_id IS NULL;

-- Make org_id NOT NULL (after migration)
-- ALTER TABLE email_notifications ALTER COLUMN org_id SET NOT NULL;
```

---

### Fix 3: Update queue_email_notification Function

**File**: `supabase/migrations/20250118_update_email_queue_function.sql`

```sql
-- Update function to include org_id
CREATE OR REPLACE FUNCTION queue_email_notification(
  p_recipient_user_id UUID,
  p_notification_type TEXT,
  p_requisition_id UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  recipient RECORD;
  email_content RECORD;
  email_id UUID;
  req_org_id UUID;
BEGIN
  -- Get org_id from requisition
  SELECT org_id INTO req_org_id
  FROM requisitions
  WHERE id = p_requisition_id;

  -- Get recipient details
  SELECT email, full_name INTO recipient
  FROM users
  WHERE id = p_recipient_user_id;

  IF recipient.email IS NULL THEN
    RETURN NULL;
  END IF;

  -- Generate email content based on notification type
  IF p_notification_type = 'requisition_submitted' THEN
    SELECT * INTO email_content
    FROM generate_submission_email(p_requisition_id, recipient.full_name);
  ELSIF p_notification_type = 'requisition_approved' THEN
    SELECT * INTO email_content
    FROM generate_approval_email(p_requisition_id, recipient.full_name, 'System');
  ELSIF p_notification_type = 'requisition_rejected' THEN
    SELECT * INTO email_content
    FROM generate_rejection_email(p_requisition_id, recipient.full_name, 'System', NULL);
  ELSE
    RETURN NULL;
  END IF;

  -- Insert into email queue WITH org_id
  INSERT INTO email_notifications (
    recipient_email,
    recipient_user_id,
    subject,
    body_html,
    body_text,
    notification_type,
    related_requisition_id,
    org_id,  -- ✅ ADD THIS
    status
  )
  VALUES (
    recipient.email,
    p_recipient_user_id,
    email_content.subject,
    email_content.body_html,
    email_content.body_text,
    p_notification_type,
    p_requisition_id,
    req_org_id,  -- ✅ ADD THIS
    'pending'
  )
  RETURNING id INTO email_id;

  RETURN email_id;
END;
$$;
```

---

### Fix 4: Update Email Templates to Use Organization Name

**Update Email Generation Functions** to fetch and use organization name:

```sql
-- Example: Update generate_submission_email function
CREATE OR REPLACE FUNCTION generate_submission_email(
  p_requisition_id UUID,
  p_recipient_name TEXT
)
RETURNS TABLE(subject TEXT, body_html TEXT, body_text TEXT)
LANGUAGE plpgsql
AS $$
DECLARE
  req RECORD;
  base_url TEXT;
  org_name TEXT;
BEGIN
  -- Get requisition and organization details
  SELECT
    r.requisition_number,
    r.title,
    r.total_amount,
    o.name as organization_name  -- ✅ Get org name
  INTO req
  FROM requisitions r
  JOIN organizations o ON r.org_id = o.id
  WHERE r.id = p_requisition_id;

  org_name := req.organization_name;  -- ✅ Use org name

  base_url := COALESCE(current_setting('app.base_url', true), 'https://requisition-workflow.vercel.app');

  RETURN QUERY SELECT
    ('New Requisition Submitted - ' || req.requisition_number)::TEXT,
    ('<html>...</html>')::TEXT,  -- Use org_name in email body
    ('Dear ' || p_recipient_name || ',

     A new requisition has been submitted in ' || org_name || '.')::TEXT;
END;
$$;
```

---

## 📊 Implementation Priority

| Priority | Task | Effort | Impact |
|----------|------|--------|--------|
| **P0** | Fix in-app notification filtering | 30 min | HIGH - Immediate data isolation |
| **P1** | Add org_id to email_notifications table | 15 min | MEDIUM - Database structure |
| **P2** | Update queue_email_notification function | 30 min | MEDIUM - Email org context |
| **P3** | Update email templates with org name | 1 hour | LOW - Branding clarity |

**Total Estimated Time**: 2-3 hours

---

## 🧪 Testing Checklist

### In-App Notifications
- [ ] User belongs to 2+ organizations
- [ ] Switch to Organization A
- [ ] Create/approve requisition in Org A
- [ ] Verify notification appears
- [ ] Switch to Organization B
- [ ] Verify Org A notification does NOT appear
- [ ] Create requisition in Org B
- [ ] Verify ONLY Org B notification appears

### Email Notifications
- [ ] Create requisition in "Jasiri Foundation"
- [ ] Approve requisition
- [ ] Check email subject/body
- [ ] Verify it says "Jasiri Foundation" not "Passion Christian Ministries"
- [ ] Repeat in "Default Organization"
- [ ] Verify each email has correct organization name

---

## 📝 Summary

**Current State**:
- ❌ In-app notifications: Users see notifications from ALL organizations
- ❌ Email notifications: No organization context, wrong branding

**After Fixes**:
- ✅ In-app notifications: Users see ONLY current organization notifications
- ✅ Email notifications: Tagged with correct organization, proper branding

**Risk Level**: MEDIUM
- Affects users who belong to multiple organizations
- Creates confusion but limited security risk (users can only see their own notifications)
- Should be fixed before users actively use multiple organizations

**Recommendation**: Implement P0 and P1 fixes **immediately** (< 1 hour total) to ensure proper data isolation as users start creating multiple organizations.

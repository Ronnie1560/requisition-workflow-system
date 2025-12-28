# 🔔 Notification System Setup Guide

## Overview
Complete notification system with toast notifications and in-app notification center.

## Features
✅ Toast notifications (success, error, warning, info)
✅ In-app notification center with bell icon
✅ Real-time notifications using Supabase
✅ Automatic notifications for requisition workflows
✅ Mark as read/unread
✅ Delete individual or clear all
✅ Professional animations

---

## Quick Setup (5 Steps)

### Step 1: Run Database Migration

Run the SQL migration in your Supabase SQL Editor:

**File:** `supabase/migrations/20241219_notifications_system.sql`

This creates:
- `notifications` table
- RLS policies
- Helper functions
- Auto-notification triggers for requisitions

---

### Step 2: Install date-fns Package

```bash
cd client
npm install date-fns
```

---

### Step 3: Import Notification CSS

**File:** `client/src/App.jsx`

Add this import:

```javascript
import './styles/notifications.css'
```

**Example:**
```javascript
import React from 'react'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import './styles/print.css'
import './styles/notifications.css'  // <-- ADD THIS
```

---

### Step 4: Wrap App with NotificationProvider

**File:** `client/src/App.jsx` or `client/src/main.jsx`

```javascript
import { NotificationProvider } from './context/NotificationContext'
import ToastContainer from './components/notifications/ToastContainer'

function App() {
  return (
    <AuthProvider>
      <NotificationProvider>  {/* <-- ADD THIS */}
        <BrowserRouter>
          <Routes>
            {/* your routes */}
          </Routes>
          <ToastContainer />  {/* <-- ADD THIS */}
        </BrowserRouter>
      </NotificationProvider>
    </AuthProvider>
  )
}
```

---

### Step 5: Add Notification Center to Layout

**File:** `client/src/components/layout/MainLayout.jsx`

Import:
```javascript
import NotificationCenter from '../notifications/NotificationCenter'
```

Add to header (around line 150-200, near the user menu):

**BEFORE:**
```javascript
<div className="flex items-center gap-4">
  {/* User menu */}
</div>
```

**AFTER:**
```javascript
<div className="flex items-center gap-4">
  <NotificationCenter />  {/* <-- ADD THIS */}
  {/* User menu */}
</div>
```

---

## ✅ Done!

Your notification system is now active!

---

## Usage Examples

### Using Toast Notifications in Your Components

```javascript
import { useNotifications } from '../context/NotificationContext'

function MyComponent() {
  const { toast } = useNotifications()

  const handleSuccess = () => {
    toast.success('Operation completed successfully!')
  }

  const handleError = () => {
    toast.error('Something went wrong. Please try again.')
  }

  const handleWarning = () => {
    toast.warning('This action cannot be undone.')
  }

  const handleInfo = () => {
    toast.info('Your session will expire in 5 minutes.')
  }

  // Custom toast with options
  const handleCustom = () => {
    toast.custom({
      title: 'Custom Title',
      message: 'Custom message here',
      type: 'success',
      duration: 10000 // 10 seconds
    })
  }

  return <button onClick={handleSuccess}>Show Toast</button>
}
```

### Replace Existing Alert/Error Patterns

**BEFORE:**
```javascript
setError('Failed to save')
setSuccess('Saved successfully')
```

**AFTER:**
```javascript
toast.error('Failed to save')
toast.success('Saved successfully')
```

---

## Automatic Notifications

The system automatically creates notifications for:

### 1. **Requisition Submitted**
- Who gets notified: All reviewers and super admins
- Trigger: When requisition status changes from 'draft' to 'pending'
- Message: "Jane Doe submitted requisition 'Office Supplies' for review."

### 2. **Requisition Approved**
- Who gets notified: Requisition submitter
- Trigger: When requisition is approved
- Message: "Your requisition 'Office Supplies' has been approved by John Smith."

### 3. **Requisition Rejected**
- Who gets notified: Requisition submitter
- Trigger: When requisition is rejected
- Message: "Your requisition 'Office Supplies' has been rejected by John Smith."

---

## Customization

### Add More Notification Types

**File:** `client/src/components/notifications/NotificationCenter.jsx`

Add to `typeConfig` object (around line 87):

```javascript
const typeConfig = {
  // Existing types...

  // Add new type
  purchase_order_created: {
    icon: Package,
    color: 'text-purple-600',
    bgColor: 'bg-purple-50'
  }
}
```

### Create Custom Notifications from Backend

Use the helper function in SQL or via Supabase client:

**SQL:**
```sql
SELECT create_notification(
  'user-uuid-here'::UUID,
  'budget_alert',
  'Budget Warning',
  'Your project budget is 90% utilized.',
  '/projects/123'
);
```

**JavaScript:**
```javascript
await supabase.rpc('create_notification', {
  p_user_id: userId,
  p_type: 'budget_alert',
  p_title: 'Budget Warning',
  p_message: 'Your project budget is 90% utilized.',
  p_link: '/projects/123'
})
```

### Notify Multiple Users

```javascript
await supabase.rpc('create_notification_for_users', {
  p_user_ids: [user1Id, user2Id, user3Id],
  p_type: 'info',
  p_title: 'System Maintenance',
  p_message: 'Scheduled maintenance tonight at 10 PM.',
  p_link: null
})
```

---

## Notification Bell Icon Location

The notification bell will appear in your header navigation, typically:
- Next to the user profile menu
- Shows unread count badge (red dot with number)
- Clicking opens notification center dropdown

---

## Testing

### Test Toast Notifications
1. Navigate to any page
2. Add this temporarily to test:
```javascript
useEffect(() => {
  toast.success('Welcome back!')
}, [])
```

### Test In-App Notifications
1. Submit a requisition as a regular user
2. Log in as a reviewer/admin
3. You should see a notification in the bell icon
4. Click to see the notification center

### Test Real-Time
1. Open app in two browser windows
2. Log in as different users
3. Submit/approve requisition in one window
4. See notification appear in real-time in the other

---

## File Structure

```
client/src/
├── context/
│   └── NotificationContext.jsx          # Context provider
├── components/
│   └── notifications/
│       ├── ToastContainer.jsx           # Toast notifications
│       └── NotificationCenter.jsx       # Bell icon dropdown
└── styles/
    └── notifications.css                # Animations

supabase/migrations/
└── 20241219_notifications_system.sql    # Database setup
```

---

## Troubleshooting

### Toasts not showing
- Check `ToastContainer` is rendered in App.jsx
- Check `NotificationProvider` wraps your app
- Check console for errors

### Notifications not in real-time
- Check Supabase real-time is enabled in project settings
- Check console for Supabase channel errors
- Verify user is authenticated

### Bell icon not showing
- Check `NotificationCenter` is imported in MainLayout
- Check placement in JSX
- Verify user is logged in

### Database errors
- Ensure migration ran successfully
- Check RLS policies are enabled
- Verify user_id references are correct

---

## Next Steps

Consider adding:
- Email notifications
- Push notifications (web push API)
- Notification preferences per user
- Notification history page
- Sound alerts for important notifications

---

**Setup Complete!** 🎉

Your notification system is ready to use.

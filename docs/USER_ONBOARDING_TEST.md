# User Onboarding Workflow - Testing Checklist

This document provides a comprehensive testing checklist for the complete user onboarding workflow in the PCM Requisition System.

## Test Environment Setup

### Prerequisites

- [ ] Supabase project is set up and running
- [ ] All database migrations have been executed
- [ ] Edge Function `invite-user` is deployed
- [ ] Email templates are configured
- [ ] Dev server is running (`npm run dev`)
- [ ] You have a super_admin account to test with

### Test Data Preparation

Create test email addresses (use + addressing if using Gmail):
- Admin account: `admin@example.com` (your existing super_admin)
- Test users:
  - `testuser1+submitter@example.com`
  - `testuser2+reviewer@example.com`
  - `testuser3+approver@example.com`

## Test Scenarios

### Scenario 1: Admin Invites a New Submitter

**Objective**: Verify that an admin can successfully invite a new user with submitter role.

#### Steps:

1. **Login as Admin**
   - [ ] Navigate to `http://localhost:5173/login`
   - [ ] Enter super_admin credentials
   - [ ] Click "Sign In"
   - [ ] Verify redirect to dashboard
   - [ ] Verify "Users" menu item is visible in sidebar

2. **Navigate to Users Page**
   - [ ] Click "Users" in the sidebar
   - [ ] Verify URL is `/users`
   - [ ] Verify user statistics are displayed (Total, Active, etc.)
   - [ ] Verify existing users are listed in the table

3. **Access Invite User Page**
   - [ ] Click "Invite User" button (top right)
   - [ ] Verify URL is `/users/invite`
   - [ ] Verify form is displayed with all fields

4. **Fill Invitation Form**
   - [ ] Enter email: `testuser1+submitter@example.com`
   - [ ] Enter full name: `Test Submitter`
   - [ ] Select role: `Submitter`
   - [ ] Select at least one project from the list
   - [ ] Verify project checkboxes are working
   - [ ] Verify role description updates when changing role

5. **Submit Invitation**
   - [ ] Click "Send Invitation" button
   - [ ] Verify button shows loading state ("Sending...")
   - [ ] Verify success message is displayed
   - [ ] Verify success message shows: "An invitation email has been sent to testuser1+submitter@example.com"
   - [ ] Verify automatic redirect to `/users` after 2 seconds

6. **Verify User in List**
   - [ ] On `/users` page, verify new user appears in the table
   - [ ] Verify user shows: Name, Email, Role badge (Submitter), Status (Active)
   - [ ] Verify project count is correct

7. **Check Email**
   - [ ] Open email inbox for `testuser1+submitter@example.com`
   - [ ] Verify invitation email was received
   - [ ] Verify email has proper subject line
   - [ ] Verify email has "Set Your Password" button
   - [ ] Verify email content is properly formatted

8. **User Sets Password**
   - [ ] Click "Set Your Password" button in email
   - [ ] Verify redirect to `/reset-password` page
   - [ ] Enter a strong password (e.g., `TestPass123!`)
   - [ ] Confirm the password
   - [ ] Click "Set Password" or "Update Password"
   - [ ] Verify success message
   - [ ] Verify redirect to login page

9. **User First Login**
   - [ ] On login page, enter: `testuser1+submitter@example.com`
   - [ ] Enter the password set in previous step
   - [ ] Click "Sign In"
   - [ ] Verify successful login
   - [ ] Verify redirect to dashboard
   - [ ] Verify user name appears in top-right menu
   - [ ] Verify role is displayed correctly

10. **Verify User Permissions**
    - [ ] Verify "Users" menu is NOT visible (not admin)
    - [ ] Click "Requisitions" in sidebar
    - [ ] Click "Create New" button
    - [ ] Verify user can see assigned projects in dropdown
    - [ ] Verify user can create a requisition
    - [ ] Logout

#### Expected Results:
✅ Admin successfully invites user
✅ User receives email
✅ User sets password successfully
✅ User can login with new credentials
✅ User has correct role and permissions
✅ User is assigned to correct projects

---

### Scenario 2: Admin Invites a Reviewer

**Objective**: Verify reviewer role assignment and permissions.

#### Steps:

1. **Login as Admin** (repeat login steps)

2. **Invite Reviewer**
   - [ ] Go to `/users/invite`
   - [ ] Email: `testuser2+reviewer@example.com`
   - [ ] Full Name: `Test Reviewer`
   - [ ] Role: `Reviewer`
   - [ ] Projects: Select 2 projects
   - [ ] Click "Send Invitation"
   - [ ] Verify success

3. **User Accepts Invitation**
   - [ ] Check email for `testuser2+reviewer@example.com`
   - [ ] Click invitation link
   - [ ] Set password: `ReviewPass123!`
   - [ ] Login with new credentials

4. **Verify Reviewer Permissions**
   - [ ] Navigate to `/requisitions`
   - [ ] Verify can see requisitions from assigned projects
   - [ ] Click on a requisition with status "Pending"
   - [ ] Verify can add comments
   - [ ] Verify CANNOT approve/reject (should not see approve buttons)
   - [ ] Try to create a requisition
   - [ ] Verify error message about permissions
   - [ ] Logout

#### Expected Results:
✅ Reviewer can view requisitions
✅ Reviewer can add comments
✅ Reviewer CANNOT create requisitions
✅ Reviewer CANNOT approve/reject

---

### Scenario 3: Admin Invites an Approver

**Objective**: Verify approver role assignment and permissions.

#### Steps:

1. **Login as Admin**

2. **Invite Approver**
   - [ ] Go to `/users/invite`
   - [ ] Email: `testuser3+approver@example.com`
   - [ ] Full Name: `Test Approver`
   - [ ] Role: `Approver`
   - [ ] Projects: Select all projects
   - [ ] Click "Send Invitation"

3. **User Accepts Invitation**
   - [ ] Check email, click link
   - [ ] Set password: `ApprovePass123!`
   - [ ] Login

4. **Verify Approver Permissions**
   - [ ] Go to `/requisitions`
   - [ ] Filter by status: "Pending Review"
   - [ ] Click on a pending requisition
   - [ ] Verify "Approve" and "Reject" buttons are visible
   - [ ] Click "Approve"
   - [ ] Add approval comment
   - [ ] Submit approval
   - [ ] Verify requisition status changes to "Approved"
   - [ ] Verify comment appears in comments section
   - [ ] Logout

#### Expected Results:
✅ Approver can view requisitions
✅ Approver can approve requisitions
✅ Approver can reject requisitions
✅ Approval updates requisition status

---

### Scenario 4: Admin Manages Existing User

**Objective**: Verify admin can edit user details, change roles, and manage project assignments.

#### Steps:

1. **Login as Admin**

2. **Edit User Profile**
   - [ ] Go to `/users`
   - [ ] Find `Test Submitter` in the list
   - [ ] Click edit icon (pencil)
   - [ ] Verify URL is `/users/[user-id]`
   - [ ] Update full name to `Test Submitter Updated`
   - [ ] Add employee ID: `EMP-001`
   - [ ] Add phone: `+256 700 000000`
   - [ ] Add department: `Finance`
   - [ ] Click "Save Changes"
   - [ ] Verify success message
   - [ ] Verify changes are reflected

3. **Change User Role**
   - [ ] On same user detail page
   - [ ] Change role from "Submitter" to "Reviewer"
   - [ ] Click "Update Role"
   - [ ] Verify success message
   - [ ] Verify role badge updates
   - [ ] Go back to `/users`
   - [ ] Verify role is updated in users list

4. **Add Project Assignment**
   - [ ] Go back to user detail page
   - [ ] In "Project Assignments" section
   - [ ] Click "Add Project"
   - [ ] Select a project not yet assigned
   - [ ] Click "Add"
   - [ ] Verify project appears in the list
   - [ ] Verify success message

5. **Remove Project Assignment**
   - [ ] On same page
   - [ ] Click trash icon next to a project
   - [ ] Confirm removal in alert dialog
   - [ ] Verify project is removed from list
   - [ ] Verify success message

6. **Deactivate User**
   - [ ] On same page
   - [ ] Click "Deactivate User" button
   - [ ] Verify confirmation (if implemented)
   - [ ] Verify status changes to "Inactive"
   - [ ] Verify success message
   - [ ] Go to `/users`
   - [ ] Change filter to "Inactive Only"
   - [ ] Verify user appears in inactive list

7. **Reactivate User**
   - [ ] Click on the inactive user
   - [ ] Click "Activate User" button
   - [ ] Verify status changes to "Active"
   - [ ] Verify success message

8. **Verify User Sees Changes**
   - [ ] Logout as admin
   - [ ] Login as the modified user
   - [ ] Verify new role permissions apply
   - [ ] Verify can see newly assigned projects
   - [ ] Verify CANNOT see removed projects
   - [ ] Logout

#### Expected Results:
✅ Admin can update user profile
✅ Admin can change user roles
✅ Admin can add/remove project assignments
✅ Admin can activate/deactivate users
✅ Changes take effect immediately

---

### Scenario 5: Error Handling

**Objective**: Verify proper error handling in edge cases.

#### Steps:

1. **Duplicate Email**
   - [ ] Login as admin
   - [ ] Try to invite user with existing email
   - [ ] Verify error message: "User with this email already exists"
   - [ ] Verify invitation is not sent

2. **Invalid Email Format**
   - [ ] Try to invite with email: `notanemail`
   - [ ] Verify error message: "Please enter a valid email address"
   - [ ] Verify form validation works

3. **Missing Required Fields**
   - [ ] Leave full name empty
   - [ ] Try to submit
   - [ ] Verify error message: "Please fill in all required fields"

4. **Unauthorized Access**
   - [ ] Logout
   - [ ] Login as a non-admin user (submitter/reviewer)
   - [ ] Try to navigate to `/users`
   - [ ] Verify redirect to `/dashboard`
   - [ ] Verify "Users" menu is not visible
   - [ ] Try to access `/users/invite` directly (type in URL)
   - [ ] Verify redirect to `/dashboard`

5. **Expired Invitation Link**
   - [ ] Use an invitation link older than 24 hours (or modify Supabase settings to make it expire faster)
   - [ ] Click the link
   - [ ] Verify error message about expired link
   - [ ] Verify option to request new invitation

6. **Network Error Handling**
   - [ ] Open browser DevTools > Network tab
   - [ ] Set to "Offline" mode
   - [ ] Try to send invitation
   - [ ] Verify error message appears
   - [ ] Verify user-friendly error (not raw error)

#### Expected Results:
✅ All error cases are handled gracefully
✅ User-friendly error messages are displayed
✅ No sensitive information is exposed
✅ Unauthorized access is prevented

---

### Scenario 6: Email Delivery and Templates

**Objective**: Verify email content and branding.

#### Steps:

1. **Send Test Invitation**
   - [ ] Login as admin
   - [ ] Invite a new user

2. **Check Email Content**
   - [ ] Verify email subject matches configured template
   - [ ] Verify email body has proper HTML formatting
   - [ ] Verify branding (colors, logo if configured)
   - [ ] Verify "Set Your Password" button is visible
   - [ ] Verify button link is correct
   - [ ] Verify email footer has correct information

3. **Verify Email Link**
   - [ ] Copy the invitation link from email
   - [ ] Paste in browser
   - [ ] Verify it goes to `/reset-password`
   - [ ] Verify token is included in URL
   - [ ] Verify page loads correctly

4. **Test Different Roles**
   - [ ] Invite users with different roles
   - [ ] Verify all receive emails
   - [ ] Verify email content is appropriate for each role

#### Expected Results:
✅ Emails are delivered promptly
✅ Email content is professional and branded
✅ Links in emails work correctly
✅ All email elements render properly

---

### Scenario 7: Multiple Users and Search/Filter

**Objective**: Verify user list, search, and filter functionality.

#### Steps:

1. **Create Multiple Test Users**
   - [ ] Invite 5+ users with different:
     - Roles (mix of submitter, reviewer, approver)
     - Project assignments
     - Names (use different first letters)

2. **Test User List Display**
   - [ ] Go to `/users`
   - [ ] Verify all users are displayed
   - [ ] Verify statistics are accurate
   - [ ] Verify table columns show correct data

3. **Test Search Functionality**
   - [ ] Enter partial name in search box
   - [ ] Verify real-time filtering works
   - [ ] Clear search
   - [ ] Search by email
   - [ ] Verify search is case-insensitive
   - [ ] Search for non-existent user
   - [ ] Verify "No users found" message

4. **Test Role Filter**
   - [ ] Select "Submitter" from role dropdown
   - [ ] Verify only submitters are shown
   - [ ] Change to "Approver"
   - [ ] Verify only approvers are shown
   - [ ] Select "All Roles"
   - [ ] Verify all users are shown again

5. **Test Status Filter**
   - [ ] Deactivate one user
   - [ ] Set filter to "Active Only"
   - [ ] Verify deactivated user is hidden
   - [ ] Set filter to "Inactive Only"
   - [ ] Verify only inactive user is shown

6. **Test Combined Filters**
   - [ ] Apply both search and role filter
   - [ ] Verify results match both criteria
   - [ ] Apply search, role, and status filters
   - [ ] Verify correct filtering

7. **Test Statistics**
   - [ ] Verify "Total Users" count is accurate
   - [ ] Verify "Active" count matches active users
   - [ ] Verify "Inactive" count matches inactive users
   - [ ] Verify role counts (Approvers, Admins, etc.) are accurate
   - [ ] Deactivate/activate users and verify stats update

#### Expected Results:
✅ All users are displayed correctly
✅ Search works for name, email, and employee ID
✅ Filters work correctly (role, status)
✅ Combined filters work together
✅ Statistics are accurate and update in real-time

---

## Performance Testing

### Load Testing

1. **Multiple Concurrent Invitations**
   - [ ] Invite 10 users rapidly (one after another)
   - [ ] Verify all invitations are sent
   - [ ] Verify no race conditions or duplicates
   - [ ] Check Edge Function logs for errors

2. **Large User List**
   - [ ] Create 50+ test users
   - [ ] Navigate to `/users`
   - [ ] Verify page loads within 2 seconds
   - [ ] Test search performance with large dataset
   - [ ] Test filtering performance

### Browser Compatibility

- [ ] Test in Chrome
- [ ] Test in Firefox
- [ ] Test in Edge
- [ ] Test in Safari (if available)
- [ ] Test on mobile browser (responsive design)

---

## Security Testing

1. **Authentication**
   - [ ] Try accessing `/users` without login
   - [ ] Verify redirect to `/login`
   - [ ] Try accessing `/users/:id` without login
   - [ ] Verify redirect

2. **Authorization**
   - [ ] Login as submitter
   - [ ] Try to access `/users` (type in URL)
   - [ ] Verify redirect or access denied
   - [ ] Try to call Edge Function directly with submitter JWT
   - [ ] Verify 403 Forbidden response

3. **Input Validation**
   - [ ] Try SQL injection in email field: `test@test.com'; DROP TABLE users--`
   - [ ] Verify proper sanitization
   - [ ] Try XSS in name field: `<script>alert('XSS')</script>`
   - [ ] Verify proper escaping
   - [ ] Try extremely long inputs
   - [ ] Verify field length limits

4. **Session Management**
   - [ ] Login, wait for token expiry (1 hour)
   - [ ] Try to invite user with expired token
   - [ ] Verify redirect to login
   - [ ] Verify error message

---

## Rollback Plan

If issues are found:

1. **Disable User Invitations**
   ```sql
   -- Temporarily disable Edge Function by updating database
   -- (Manual workaround)
   ```

2. **Manual User Creation**
   - Use Supabase Dashboard > Authentication > Users
   - Click "Invite User"
   - Manually assign roles in users table
   - Manually assign projects in user_project_assignments table

3. **Revert to Previous Code**
   ```bash
   git checkout [previous-commit]
   npm run dev
   ```

---

## Sign-off Checklist

Before marking user onboarding as production-ready:

- [ ] All 7 test scenarios completed successfully
- [ ] No critical bugs found
- [ ] Email templates are configured and branded
- [ ] Edge Function is deployed to production
- [ ] Performance is acceptable (< 2s load times)
- [ ] Security tests passed
- [ ] Browser compatibility verified
- [ ] Mobile responsiveness verified
- [ ] Documentation is complete
- [ ] Admin training completed
- [ ] Rollback plan is documented

---

## Known Limitations

1. **Email Rate Limits**
   - Supabase free tier has email sending limits
   - Consider upgrading or using custom SMTP for bulk invitations

2. **Password Requirements**
   - Currently using Supabase default (8 characters minimum)
   - Can be customized in Supabase Dashboard > Authentication > Policies

3. **Invitation Expiry**
   - Default 24 hours
   - Can be adjusted in Supabase Dashboard

4. **Project Assignment**
   - Currently defaults all assignments to 'submitter' role per project
   - Future enhancement: Allow different roles per project

---

## Success Criteria

✅ Admin can invite users with all 5 roles
✅ Invited users receive emails within 1 minute
✅ Users can set passwords and login successfully
✅ User permissions are correctly enforced
✅ Admin can manage users (edit, deactivate, assign projects)
✅ Search and filter work correctly
✅ No security vulnerabilities found
✅ Performance is acceptable
✅ Error handling is user-friendly

---

## Next Steps After Testing

1. Train super_admins on the user invitation workflow
2. Create user onboarding documentation for end users
3. Set up monitoring/alerts for failed invitations
4. Plan for bulk user imports (if needed)
5. Consider implementing:
   - User self-service profile updates
   - Password strength requirements
   - Two-factor authentication
   - Audit logs for user management actions

# Multi-Tenancy Testing Guide

**Status**: ✅ Deployed and Ready to Test
**Last Updated**: January 13, 2026

---

## Deployment Confirmation

✅ **Database Migration**: Successfully deployed
✅ **Default Organization**: Created (1 org, 10 members)
✅ **Frontend RPC Parameters**: Fixed
✅ **Ready for Testing**: Yes

---

## Quick Verification Tests

### 1. Check Default Organization (Database)

Run this in Supabase SQL Editor:

```sql
-- View default organization
SELECT id, name, slug, plan, status, max_users, max_projects
FROM organizations;

-- Expected: 1 row with name from your org settings, slug='default', plan='professional'
```

### 2. Check Organization Members

```sql
-- View all members
SELECT
  om.id,
  om.role,
  u.email,
  u.full_name,
  u.role as user_role
FROM organization_members om
JOIN users u ON om.user_id = u.id
WHERE om.organization_id = (SELECT id FROM organizations WHERE slug = 'default')
ORDER BY om.role;

-- Expected: 10 members
-- super_admin users → 'owner' role
-- approver/reviewer users → 'admin' role
-- other users → 'member' role
```

### 3. Check Multi-Tenant Views

```sql
-- Test user_organizations view
SELECT * FROM user_organizations LIMIT 5;

-- Expected: Returns organizations for current authenticated user
```

---

## Frontend Testing Checklist

### Test 1: Login and Organization Context

1. **Login to Application**:
   - URL: https://requisition-workflow.vercel.app/login
   - Use any existing user credentials

2. **Expected Behavior**:
   - ✅ Login succeeds
   - ✅ User is automatically assigned to "Default Organization"
   - ✅ No errors in browser console

3. **Check Browser Console**:
   ```javascript
   // Open DevTools → Console
   // Should see:
   [OrganizationContext] Loaded organizations { count: 1 }
   ```

### Test 2: View Organization Settings

1. **Navigate to Organization Settings**:
   - Look for "Organization Settings" or "Settings" in navigation
   - (May need to add UI if not already visible)

2. **Expected Behavior**:
   - ✅ Can view organization details
   - ✅ Organization name matches database
   - ✅ Shows subscription plan and limits

### Test 3: Create New Organization

**Prerequisites**: Logged in as user with organization creation permission

1. **Navigate to Create Organization Page**:
   - Look for "Create Organization" or similar option
   - OR navigate to: `/organizations/create`

2. **Fill in Form**:
   - Name: "Test Organization"
   - Slug: "test-org"
   - Email: "test@example.com"

3. **Submit Form**

4. **Expected Behavior**:
   - ✅ Organization created successfully
   - ✅ User becomes owner of new organization
   - ✅ Page reloads and switches to new organization
   - ✅ No errors in console

5. **Verify in Database**:
   ```sql
   SELECT * FROM organizations WHERE slug = 'test-org';
   SELECT * FROM organization_members WHERE organization_id = (
     SELECT id FROM organizations WHERE slug = 'test-org'
   );
   ```

### Test 4: Data Isolation

**This is the most critical test for multi-tenancy!**

1. **Setup**: Create two organizations (or use default + test-org)

2. **In Organization A (Default)**:
   - Create a new project: "Project A"
   - Create a new requisition: "Requisition A"

3. **Switch to Organization B (Test Org)**:
   - Use organization switcher
   - Page should reload

4. **Expected Behavior**:
   - ✅ "Project A" is NOT visible
   - ✅ "Requisition A" is NOT visible
   - ✅ Projects/Requisitions list is empty (or only shows Org B data)
   - ✅ No errors in console

5. **Switch Back to Organization A**:
   - "Project A" and "Requisition A" should be visible again

6. **Verify in Database**:
   ```sql
   -- Check that projects have correct org_id
   SELECT p.name, o.name as organization
   FROM projects p
   JOIN organizations o ON p.org_id = o.id
   ORDER BY o.name;

   -- Each project should belong to exactly one organization
   ```

### Test 5: Invite User to Organization

**Prerequisites**:
- Logged in as owner or admin
- Have an existing user email to invite

1. **Navigate to Organization Members**:
   - Settings → Members or Team

2. **Click "Invite User"**

3. **Enter User Details**:
   - Email: (existing user email)
   - Role: "member"

4. **Submit Invitation**

5. **Expected Behavior**:
   - ✅ User added to organization members
   - ✅ Success message displayed
   - ✅ User appears in members list

6. **Verify in Database**:
   ```sql
   SELECT
     om.role,
     u.email,
     om.invited_by,
     om.accepted_at
   FROM organization_members om
   JOIN users u ON om.user_id = u.id
   WHERE om.organization_id = (SELECT id FROM organizations WHERE slug = 'default')
   ORDER BY om.created_at DESC
   LIMIT 5;
   ```

### Test 6: Update Member Role

1. **Navigate to Organization Members**

2. **Find a Member** (not an owner)

3. **Change Role**:
   - Change from "member" to "admin"

4. **Expected Behavior**:
   - ✅ Role updated successfully
   - ✅ UI reflects new role
   - ✅ No errors

### Test 7: Remove Member

1. **Navigate to Organization Members**

2. **Find a Member** (not an owner)

3. **Click "Remove" or "Delete"**

4. **Expected Behavior**:
   - ✅ Member removed from organization
   - ✅ Member no longer appears in list
   - ✅ Cannot remove owners

---

## API Testing (Optional)

Test the RPC functions directly using browser console:

### Test create_organization

```javascript
// Open DevTools → Console
const { data, error } = await supabase.rpc('create_organization', {
  p_name: 'API Test Org',
  p_slug: 'api-test-org',
  p_email: 'apitest@example.com',
  p_plan: 'free'
})

console.log('Result:', { data, error })
// Expected: Returns UUID of new organization
```

### Test invite_user_to_org

```javascript
// Get current org ID first
const { data: orgs } = await supabase.from('user_organizations').select('*')
const currentOrgId = orgs[0].id

// Invite user (must be existing user)
const { data, error } = await supabase.rpc('invite_user_to_org', {
  p_org_id: currentOrgId,
  p_email: 'existing.user@example.com',
  p_role: 'member'
})

console.log('Result:', { data, error })
// Expected: Returns member ID or error if user not found
```

### Test Helper Functions

```javascript
// Test get_current_org_id
const { data: currentOrg } = await supabase.rpc('get_current_org_id')
console.log('Current Org ID:', currentOrg)

// Test user_belongs_to_org
const orgId = 'YOUR_ORG_ID_HERE'
const { data: belongs } = await supabase.rpc('user_belongs_to_org', { check_org_id: orgId })
console.log('User belongs to org?', belongs)

// Test user_is_org_admin
const { data: isAdmin } = await supabase.rpc('user_is_org_admin', { check_org_id: orgId })
console.log('User is admin?', isAdmin)
```

---

## RLS Policy Testing

Verify Row-Level Security is working correctly:

### Test 1: Cross-Organization Data Access

```sql
-- As User A in Organization A
-- Try to access Organization B's data directly
SET LOCAL role = authenticated;
SET LOCAL request.jwt.claims = '{"sub": "USER_A_ID"}'::jsonb;

-- This should return EMPTY (no cross-org access)
SELECT * FROM projects WHERE org_id = 'ORG_B_ID';

-- This should return data (same org)
SELECT * FROM projects WHERE org_id = 'ORG_A_ID';
```

### Test 2: Admin vs Member Permissions

```sql
-- As a MEMBER, try to update organization settings
-- Should FAIL
UPDATE organizations
SET name = 'Hacked Name'
WHERE id = 'ORG_ID';

-- As an OWNER, same update
-- Should SUCCEED
```

---

## Known Issues & Limitations

### 1. Organization Switcher UI

**Issue**: Organization switcher may not be visible in navigation
**Workaround**: Check [MainLayout.jsx](client/src/components/layout/MainLayout.jsx) for organization switcher component

### 2. Multiple Organization View

**Behavior**: If user belongs to only 1 organization, switcher may be hidden
**Expected**: This is by design (`hasMultipleOrgs` check in OrganizationContext)

### 3. Invitation Email

**Limitation**: `invite_user_to_org` requires user to already exist in auth.users
**Reason**: Email sending would be handled by edge function (not yet implemented)
**Workaround**: Only invite existing users for now

---

## Troubleshooting

### Error: "No organization selected"

**Symptom**: User sees "Please create or join an organization" message

**Cause**: User is not a member of any organization

**Fix**:
```sql
-- Add user to default organization
INSERT INTO organization_members (organization_id, user_id, role, accepted_at)
VALUES (
  (SELECT id FROM organizations WHERE slug = 'default'),
  'USER_ID_HERE',
  'member',
  NOW()
);
```

### Error: "Only admins can invite users"

**Symptom**: Invitation fails with permission error

**Cause**: User role is 'member', not 'admin' or 'owner'

**Fix**:
```sql
-- Update user role to admin
UPDATE organization_members
SET role = 'admin'
WHERE user_id = 'USER_ID'
  AND organization_id = 'ORG_ID';
```

### Error: RLS policy violation

**Symptom**: Queries return empty results or permission denied

**Cause**: RLS policies not correctly filtering by org_id

**Fix**: Check `org_id` is set on all records:
```sql
-- Find records without org_id
SELECT 'users' as table_name, COUNT(*) FROM users WHERE org_id IS NULL
UNION ALL
SELECT 'projects', COUNT(*) FROM projects WHERE org_id IS NULL
UNION ALL
SELECT 'requisitions', COUNT(*) FROM requisitions WHERE org_id IS NULL;

-- If any records exist without org_id, update them:
UPDATE users SET org_id = (SELECT id FROM organizations WHERE slug = 'default')
WHERE org_id IS NULL;
```

---

## Production Deployment Checklist

Before deploying multi-tenancy to production:

- [ ] All tests above pass
- [ ] Data isolation verified (Test 4)
- [ ] RLS policies tested
- [ ] Organization switcher UI implemented
- [ ] Member invitation workflow tested
- [ ] Role management tested
- [ ] Performance tested with multiple organizations
- [ ] Backup created before deployment
- [ ] Rollback plan documented

---

## Next Steps

After successful testing:

1. **Add Organization Switcher to Navigation**
   - Display current organization name
   - Dropdown to switch between organizations
   - "Create Organization" link

2. **Implement Organization Settings Page**
   - Edit organization details
   - View subscription plan and limits
   - Manage members
   - View usage statistics

3. **Add Billing Integration** (Optional)
   - Stripe customer creation
   - Subscription management
   - Plan upgrades/downgrades

4. **Email Invitations** (Optional)
   - Edge function to send invitation emails
   - Invitation acceptance flow
   - Pending invitations management

---

## Success Criteria

Multi-tenancy is fully functional when:

✅ Users can create organizations
✅ Users can switch between organizations
✅ Data is completely isolated between organizations
✅ Users can invite members to their organization
✅ Organization owners can manage members and settings
✅ RLS policies prevent cross-organization data access
✅ All existing features work within organization context

---

**Questions or Issues?**

Check:
- [MULTI_TENANCY_STATUS.md](MULTI_TENANCY_STATUS.md) - Implementation details
- [supabase/migrations/20250113_01_multi_tenancy_fixed.sql](supabase/migrations/20250113_01_multi_tenancy_fixed.sql) - Migration file
- [client/src/context/OrganizationContext.jsx](client/src/context/OrganizationContext.jsx) - Frontend context
- [client/src/services/api/organizations.js](client/src/services/api/organizations.js) - API service

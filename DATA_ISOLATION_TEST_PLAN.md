# Data Isolation Testing - Comprehensive Test Plan

**Objective**: Verify that data is completely isolated between organizations
**Date**: January 13, 2026

---

## Pre-Test Setup

### Current State
- ✅ Default Organization (with all existing data)
- ✅ Jasiri Foundation (new organization you created)
- ✅ You are a member of BOTH organizations
- ✅ Data isolation fix deployed

### Test Users
- **User A**: You (member of both Default Organization and Jasiri Foundation)
- **User B**: The user you invited to Jasiri Foundation

---

## Test Suite 1: Basic Data Isolation

### Test 1.1: View Dashboard in Default Organization
**Steps**:
1. Log in to your account
2. Ensure you're in **Default Organization** (check sidebar organization switcher)
3. Navigate to **Dashboard**
4. Note the counts:
   - Total Requisitions: ___
   - Total Projects: ___
   - Active Users: ___

**Expected Result**: ✅ You should see all the existing data from before multi-tenancy

**Screenshot Location**: `_____`

---

### Test 1.2: View Dashboard in Jasiri Foundation
**Steps**:
1. Click **Organization Switcher** in sidebar
2. Select **Jasiri Foundation**
3. Page should reload
4. Navigate to **Dashboard**
5. Note the counts:
   - Total Requisitions: ___
   - Total Projects: ___
   - Active Users: ___

**Expected Result**:
- ✅ Requisitions: 0 (or only Jasiri-specific ones)
- ✅ Projects: 0 (or only Jasiri-specific ones)
- ✅ Active Users: 2 (you + invited user)
- ❌ FAIL: If you see Default Organization data

**Screenshot Location**: `_____`

---

### Test 1.3: View Projects List
**Steps**:
1. While in **Jasiri Foundation**, navigate to **Projects**
2. Note all visible projects: `_____`
3. Switch to **Default Organization**
4. Navigate to **Projects**
5. Note all visible projects: `_____`

**Expected Result**:
- ✅ Jasiri Foundation: Should ONLY show projects created in Jasiri (if any)
- ✅ Default Organization: Should show all existing projects
- ✅ NO overlap between the two lists

**Pass/Fail**: `_____`

---

### Test 1.4: View Requisitions List
**Steps**:
1. While in **Jasiri Foundation**, navigate to **Requisitions**
2. Note all visible requisitions: `_____`
3. Switch to **Default Organization**
4. Navigate to **Requisitions**
5. Note all visible requisitions: `_____`

**Expected Result**:
- ✅ Jasiri Foundation: Should ONLY show requisitions created in Jasiri (if any)
- ✅ Default Organization: Should show all existing requisitions
- ✅ NO overlap between the two lists

**Pass/Fail**: `_____`

---

### Test 1.5: View Users List (Admin Only)
**Steps**:
1. While in **Jasiri Foundation**, navigate to **Users** (if you're admin)
2. Note all visible users: `_____`
3. Switch to **Default Organization**
4. Navigate to **Users**
5. Note all visible users: `_____`

**Expected Result**:
- ✅ Jasiri Foundation: Should ONLY show 2 users (you + invited user)
- ✅ Default Organization: Should show all 10 existing users
- ✅ NO overlap (except you, since you're in both)

**Pass/Fail**: `_____`

---

## Test Suite 2: Creating Data in Jasiri Foundation

### Test 2.1: Create Project in Jasiri Foundation
**Steps**:
1. Switch to **Jasiri Foundation**
2. Navigate to **Projects**
3. Click **"Create Project"** or **"New Project"**
4. Fill in project details:
   - Name: "Jasiri Test Project 1"
   - Budget: 50000
   - Start Date: Today
5. Save the project
6. Note the project ID or name: `_____`

**Expected Result**: ✅ Project created successfully

**Pass/Fail**: `_____`

---

### Test 2.2: Verify Project Isolation
**Steps**:
1. While still in **Jasiri Foundation**, verify "Jasiri Test Project 1" is visible in Projects list
2. Switch to **Default Organization**
3. Navigate to **Projects**
4. Search for "Jasiri Test Project 1"

**Expected Result**:
- ✅ "Jasiri Test Project 1" is visible in Jasiri Foundation
- ✅ "Jasiri Test Project 1" is NOT visible in Default Organization
- ✅ Complete isolation confirmed

**Pass/Fail**: `_____`

---

### Test 2.3: Create Requisition in Jasiri Foundation
**Steps**:
1. Switch to **Jasiri Foundation**
2. Navigate to **Requisitions**
3. Click **"New Requisition"**
4. Fill in requisition details:
   - Title: "Jasiri Test Requisition 1"
   - Project: "Jasiri Test Project 1"
   - Add some line items
5. Submit the requisition
6. Note the requisition ID: `_____`

**Expected Result**: ✅ Requisition created successfully

**Pass/Fail**: `_____`

---

### Test 2.4: Verify Requisition Isolation
**Steps**:
1. While in **Jasiri Foundation**, verify "Jasiri Test Requisition 1" is visible
2. Switch to **Default Organization**
3. Navigate to **Requisitions**
4. Search for "Jasiri Test Requisition 1"

**Expected Result**:
- ✅ Visible in Jasiri Foundation
- ✅ NOT visible in Default Organization

**Pass/Fail**: `_____`

---

## Test Suite 3: Cross-Organization Access Attempts

### Test 3.1: Direct URL Access (Security Test)
**Steps**:
1. While in **Jasiri Foundation**, copy the URL of "Jasiri Test Project 1" detail page
   - Example: `/projects/abc-123-def`
2. Switch to **Default Organization**
3. Manually paste and navigate to the Jasiri project URL
4. Observe what happens

**Expected Result**:
- ✅ Should show "Not Found" or "Access Denied"
- ✅ Should NOT show the Jasiri project details
- ✅ RLS policies blocking access

**Pass/Fail**: `_____`

---

### Test 3.2: API Access Test (Database Level)
**Steps**:
1. Open **Browser DevTools** → **Console**
2. While in **Default Organization**, run this query:
```javascript
const { data, error } = await supabase
  .from('projects')
  .select('*')
console.log('Projects:', data.length, data.map(p => p.name))
```
3. Note the results: `_____`
4. Switch to **Jasiri Foundation**, run the same query
5. Note the results: `_____`

**Expected Result**:
- ✅ Default Organization: Shows all default projects
- ✅ Jasiri Foundation: Shows ONLY Jasiri projects
- ✅ Different results based on organization context

**Pass/Fail**: `_____`

---

## Test Suite 4: Multi-User Testing (User B)

### Test 4.1: User B Login to Jasiri Foundation
**Steps**:
1. Log out from your account
2. Log in as **User B** (the user you invited)
3. Check which organization they see by default
4. Navigate to **Dashboard**

**Expected Result**:
- ✅ User B should see Jasiri Foundation by default
- ✅ Should NOT see Default Organization in org switcher (they're not a member)
- ✅ Dashboard shows only Jasiri data

**Pass/Fail**: `_____`

---

### Test 4.2: User B Cannot Access Default Organization
**Steps**:
1. While logged in as User B
2. Check if they can switch to Default Organization
3. Try to manually navigate to a Default Org project URL

**Expected Result**:
- ✅ Default Organization should NOT appear in org switcher
- ✅ Direct URL access should fail (Access Denied)
- ✅ User B is completely isolated from Default Org

**Pass/Fail**: `_____`

---

## Test Suite 5: Organization Settings Isolation

### Test 5.1: Organization Settings
**Steps**:
1. Log in as your account (member of both orgs)
2. Switch to **Jasiri Foundation**
3. Navigate to **Organization Settings**
4. Note the organization name, plan, and details: `_____`
5. Switch to **Default Organization**
6. Navigate to **Organization Settings**
7. Note the organization name, plan, and details: `_____`

**Expected Result**:
- ✅ Each organization has separate settings
- ✅ Changing settings in one doesn't affect the other

**Pass/Fail**: `_____`

---

### Test 5.2: Members List
**Steps**:
1. In **Jasiri Foundation**, go to **Settings → Members**
2. Note the members list: `_____`
3. Switch to **Default Organization**
4. Go to **Settings → Members**
5. Note the members list: `_____`

**Expected Result**:
- ✅ Jasiri Foundation: 2 members (you + invited user)
- ✅ Default Organization: 10 members (all original users)
- ✅ Completely different member lists

**Pass/Fail**: `_____`

---

## Test Suite 6: Edge Cases

### Test 6.1: Creating Data in Default, Switching to Jasiri
**Steps**:
1. Switch to **Default Organization**
2. Create a new project: "Default Test Project"
3. Immediately switch to **Jasiri Foundation**
4. Check Projects list

**Expected Result**:
- ✅ "Default Test Project" should NOT appear in Jasiri
- ✅ Organization context switch is immediate

**Pass/Fail**: `_____`

---

### Test 6.2: Notifications Isolation
**Steps**:
1. In **Jasiri Foundation**, create a requisition and submit it for approval
2. Switch to **Default Organization**
3. Check notification bell

**Expected Result**:
- ✅ Notifications should be org-specific
- ✅ Jasiri requisition approval notification should only appear in Jasiri context

**Pass/Fail**: `_____`

---

## Test Suite 7: Database Verification

### Test 7.1: Verify org_id on All Records
Run this in **Supabase SQL Editor**:
```sql
-- Check that NO records have NULL org_id
SELECT
  'NULL org_id verification' as check_name,
  (SELECT COUNT(*) FROM projects WHERE org_id IS NULL) as projects_null,
  (SELECT COUNT(*) FROM requisitions WHERE org_id IS NULL) as requisitions_null,
  (SELECT COUNT(*) FROM users WHERE org_id IS NULL) as users_null;
```

**Expected Result**:
- ✅ All counts should be 0 (no NULL org_id)

**Result**: `_____`

---

### Test 7.2: Verify Data Distribution
Run this in **Supabase SQL Editor**:
```sql
-- Show data distribution by organization
SELECT
  o.name as organization,
  (SELECT COUNT(*) FROM projects WHERE org_id = o.id) as projects,
  (SELECT COUNT(*) FROM requisitions WHERE org_id = o.id) as requisitions,
  (SELECT COUNT(*) FROM users WHERE org_id = o.id) as users
FROM organizations o
ORDER BY o.created_at;
```

**Expected Result**:
- ✅ Default Organization: Has all the original data
- ✅ Jasiri Foundation: Has only Jasiri-specific data

**Result**: `_____`

---

## Summary Report

### Overall Results

| Test Suite | Tests Passed | Tests Failed | Pass Rate |
|------------|-------------|--------------|-----------|
| Suite 1: Basic Data Isolation | ___/5 | ___/5 | ___% |
| Suite 2: Creating Data | ___/4 | ___/4 | ___% |
| Suite 3: Cross-Org Access | ___/2 | ___/2 | ___% |
| Suite 4: Multi-User Testing | ___/2 | ___/2 | ___% |
| Suite 5: Settings Isolation | ___/2 | ___/2 | ___% |
| Suite 6: Edge Cases | ___/2 | ___/2 | ___% |
| Suite 7: Database Verification | ___/2 | ___/2 | ___% |
| **TOTAL** | **___/19** | **___/19** | **___%** |

---

## Critical Failures (if any)

List any tests that failed and describe what happened:

1. `_____`
2. `_____`
3. `_____`

---

## Final Verdict

- [ ] ✅ **PASS**: Data is completely isolated between organizations
- [ ] ❌ **FAIL**: Data leakage detected - needs investigation

**Notes**:
```
_____
```

---

## Screenshots

Attach screenshots for:
1. Jasiri Foundation Dashboard: `_____`
2. Default Organization Dashboard: `_____`
3. Projects list in Jasiri: `_____`
4. Projects list in Default: `_____`
5. Any failures: `_____`

---

**Tester**: _____
**Date**: January 13, 2026
**Time**: _____
**Build Version**: Production (Vercel)

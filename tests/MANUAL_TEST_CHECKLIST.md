# Manual Multi-Tenancy Test Checklist

## Pre-Test Setup

Before running tests, ensure you have:
- [ ] Two test organizations created (Org A and Org B)
- [ ] Two test users (one in each organization)
- [ ] Supabase credentials configured
- [ ] Database migrations applied

## 🔒 Security Test Scenarios

### Test 1: Organization Data Isolation ✅

**Objective**: Verify users can only see their own organization's data

**Steps**:
1. Log in as User A (Org A)
2. Navigate to Projects page
3. Note the projects visible
4. Log out
5. Log in as User B (Org B)
6. Navigate to Projects page
7. Verify NONE of Org A's projects are visible

**Expected Result**: ✅ Users only see their own org's data
**Failure Result**: ❌ If Org B user sees Org A data = DATA LEAKAGE

---

### Test 2: Cross-Org Resource Access Prevention ✅

**Objective**: Verify users cannot access resources from other orgs via URL manipulation

**Steps**:
1. Log in as User A (Org A)
2. Open a requisition and copy its ID from the URL
   - Example: `/requisitions/abc-123-def`
3. Log out
4. Log in as User B (Org B)
5. Try to access the URL with Org A's requisition ID
   - Navigate to: `/requisitions/abc-123-def`

**Expected Result**: ✅ "Not found" or "Access denied" error
**Failure Result**: ❌ If Org B user can view/edit Org A requisition = SECURITY BREACH

---

### Test 3: Organization Switching ✅

**Objective**: Verify data refreshes correctly when switching organizations

**Steps**:
1. Create a user that belongs to both Org A and Org B
2. Log in as this user
3. View the organization selector in the header
4. Note the current org's projects/requisitions
5. Switch to the other organization
6. Verify:
   - Data refreshes automatically (no page reload needed)
   - Different projects/requisitions are shown
   - No data from previous org is visible

**Expected Result**: ✅ Clean switch with proper data isolation
**Failure Result**: ❌ If old org data persists = ISOLATION FAILURE

---

### Test 4: Comment/Attachment Cross-Org Prevention ✅

**Objective**: Verify comments and attachments respect org boundaries

**Steps**:
1. Log in as User A (Org A)
2. Create a requisition and note its ID
3. Add a comment or upload an attachment
4. Log out
5. Log in as User B (Org B)
6. Try to add a comment to Org A's requisition via API:
   ```javascript
   // In browser console
   await supabase.from('comments').insert({
     requisition_id: 'org-a-requisition-id',
     comment_text: 'Hacking attempt',
     user_id: 'current-user-id'
   })
   ```

**Expected Result**: ✅ Error: "Requisition not found or access denied"
**Failure Result**: ❌ If comment is added = SECURITY BREACH

---

### Test 5: NULL org_id Prevention ✅

**Objective**: Verify database prevents NULL org_id insertions

**Steps**:
1. Open browser console on any authenticated page
2. Try to create a project without org_id:
   ```javascript
   await supabase.from('projects').insert({
     name: 'Hack Project',
     status: 'active',
     is_active: true
     // org_id intentionally omitted
   })
   ```

**Expected Result**: ✅ Error containing "org_id cannot be NULL"
**Failure Result**: ❌ If project is created = MULTI-TENANCY VIOLATION

---

### Test 6: Audit Logging ✅

**Objective**: Verify cross-org access attempts are logged

**Steps**:
1. Perform Test 2 or Test 4 (attempt cross-org access)
2. Log in as an org owner/admin
3. Query audit logs (if you have access):
   ```javascript
   const { data } = await supabase
     .from('security_audit_logs')
     .select('*')
     .eq('event_type', 'cross_org_access_attempt')
     .order('created_at', { ascending: false })
     .limit(10)
   ```

**Expected Result**: ✅ Cross-org attempts are logged with details
**Failure Result**: ❌ If no logs found = AUDIT FAILURE

---

### Test 7: Email Verification ✅

**Objective**: Verify new users must verify email before accessing system

**Steps**:
1. Create a new organization via signup flow
2. Check the email inbox for verification email
3. Try to log in WITHOUT clicking verification link
4. Click verification link
5. Try to log in again

**Expected Result**:
- ✅ Login blocked before verification
- ✅ Login succeeds after verification

**Failure Result**: ❌ If login works without verification = AUTH BYPASS

---

### Test 8: Input Sanitization (XSS Prevention) ✅

**Objective**: Verify XSS attacks are prevented

**Steps**:
1. Try to create an organization with malicious name:
   ```
   <script>alert('XSS')</script>Test Org
   ```
2. Submit the form
3. View the organization name in the UI

**Expected Result**: ✅ Script tags are encoded/stripped, no alert pops up
**Failure Result**: ❌ If alert appears = XSS VULNERABILITY

---

### Test 9: CORS Protection ✅

**Objective**: Verify Edge Functions reject requests from unauthorized origins

**Steps**:
1. Open browser console on a different domain (e.g., google.com)
2. Try to call the signup Edge Function:
   ```javascript
   fetch('https://your-project.supabase.co/functions/v1/create-organization-signup', {
     method: 'POST',
     headers: {
       'Content-Type': 'application/json'
     },
     body: JSON.stringify({
       organization: { name: 'Test', slug: 'test', email: 'test@test.com' },
       admin: { fullName: 'Test', email: 'test@test.com', password: 'password' }
     })
   })
   ```

**Expected Result**: ✅ CORS error (request blocked)
**Failure Result**: ❌ If request succeeds from unauthorized domain = CORS BYPASS

---

### Test 10: Update/Delete Permission Checks ✅

**Objective**: Verify users cannot update/delete resources from other orgs

**Steps**:
1. Log in as User A (Org A)
2. Get a project ID from Org A
3. Log out
4. Log in as User B (Org B)
5. Try to update Org A's project via browser console:
   ```javascript
   await supabase.from('projects')
     .update({ name: 'Hacked Name' })
     .eq('id', 'org-a-project-id')
   ```
6. Try to delete:
   ```javascript
   await supabase.from('projects')
     .delete()
     .eq('id', 'org-a-project-id')
   ```

**Expected Result**: ✅ No rows affected, RLS policies block the operation
**Failure Result**: ❌ If update/delete succeeds = RLS POLICY FAILURE

---

## Test Results Summary

After completing all tests, fill in the results:

| Test # | Test Name | Result | Notes |
|--------|-----------|--------|-------|
| 1 | Data Isolation | ⬜ Pass / ⬜ Fail | |
| 2 | Cross-Org Access Prevention | ⬜ Pass / ⬜ Fail | |
| 3 | Organization Switching | ⬜ Pass / ⬜ Fail | |
| 4 | Comment/Attachment Protection | ⬜ Pass / ⬜ Fail | |
| 5 | NULL org_id Prevention | ⬜ Pass / ⬜ Fail | |
| 6 | Audit Logging | ⬜ Pass / ⬜ Fail | |
| 7 | Email Verification | ⬜ Pass / ⬜ Fail | |
| 8 | XSS Prevention | ⬜ Pass / ⬜ Fail | |
| 9 | CORS Protection | ⬜ Pass / ⬜ Fail | |
| 10 | Update/Delete Permissions | ⬜ Pass / ⬜ Fail | |

**Pass Rate**: __/10 tests passed

---

## SQL Database Tests

For comprehensive RLS policy testing, run the SQL test suite:

```bash
psql <YOUR_DATABASE_URL> -f supabase/migrations/20260120_rls_policy_tests.sql
```

This will automatically test:
- Projects isolation
- Requisitions isolation
- Items isolation
- Cross-org update prevention
- Cross-org delete prevention
- Expense accounts isolation
- NULL org_id prevention

**Expected Output**: 100% pass rate (7/7 tests)

---

## Remediation Steps

If any test fails:

1. **Document the failure**:
   - Which test failed
   - What was the expected vs actual result
   - Any error messages

2. **Check relevant code**:
   - Test 1-3: RLS policies and API filtering
   - Test 4: Comment/attachment API validation
   - Test 5: Database trigger `set_org_id_on_insert`
   - Test 6: Audit logging functions
   - Test 7: Email verification in signup Edge Function
   - Test 8: Input sanitization utilities
   - Test 9: CORS configuration in Edge Functions
   - Test 10: RLS UPDATE/DELETE policies

3. **Review documentation**:
   - [MULTI_TENANCY_BEST_PRACTICES.md](../docs/MULTI_TENANCY_BEST_PRACTICES.md)
   - [SECURITY_REVIEW_SUMMARY.md](../docs/SECURITY_REVIEW_SUMMARY.md)

4. **Get help**:
   - Check audit logs for clues
   - Review database logs
   - Consult security documentation

---

## Sign-Off

**Tester Name**: _____________________
**Date**: _____________________
**Pass Rate**: _____%
**Ready for Production**: ⬜ Yes / ⬜ No

**Notes**:

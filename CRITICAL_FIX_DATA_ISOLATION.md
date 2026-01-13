# CRITICAL FIX: Data Isolation Failure

**Issue**: Users see data from ALL organizations they belong to, not just the currently selected one

**Root Cause**: RLS policies check `user_belongs_to_org(org_id)` which returns TRUE for ALL organizations the user is a member of. Since you're a member of both Default Organization and Jasiri Foundation, you see data from BOTH.

**Solution**: Add explicit `org_id` filtering in frontend queries using the currently selected organization

---

## Immediate Fix (Fastest)

### Step 1: Add org_id filtering to getAllProjects

File: `client/src/services/api/projects.js`

```javascript
import { getCurrentOrgId } from './orgContext'

export const getAllProjects = async (filters = {}) => {
  try {
    const orgId = getCurrentOrgId()
    if (!orgId) {
      throw new Error('No organization selected')
    }

    let query = supabase
      .from('projects')
      .select('*')
      .eq('org_id', orgId)  // ADD THIS LINE
      .order('created_at', { ascending: false })

    // Rest of the function...
  }
}
```

### Step 2: Add org_id filtering to getRequisitions

File: `client/src/services/api/requisitions.js`

Add `.eq('org_id', getCurrentOrgId())` to all SELECT queries

---

## Long-term Solution

Update RLS policies to use a session variable for the current org, not just membership check.

This requires:
1. Setting a PostgreSQL session variable when switching orgs
2. Updating RLS policies to check that variable
3. More complex but more secure

---

## Quick Test

After applying the fix, run in browser console:

```javascript
const orgId = localStorage.getItem('pcm_selected_org_id')
console.log('Current Org:', orgId)

const { data } = await supabase
  .from('projects')
  .select('*')
  .eq('org_id', orgId)

console.log('Projects:', data.map(p => p.name))
```

Switch organizations and run again - should show different results.

---

## Files That Need Updates

1. `client/src/services/api/projects.js` - getAllProjects, getProjectById
2. `client/src/services/api/requisitions.js` - getAllRequisitions, getRequisitionById
3. `client/src/services/api/users.js` - getAllUsers
4. `client/src/services/api/expenseAccounts.js` - getAll ExpenseAccounts
5. `client/src/services/api/dashboard.js` - getDashboardData
6. `client/src/services/api/reports.js` - All report queries

**Estimate**: 30-60 minutes to update all files

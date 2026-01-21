# Multi-Tenancy Integration Tests

This directory contains comprehensive integration tests for verifying multi-tenant data isolation and security.

## Test Coverage

### 1. **Database RLS Policy Tests** (`supabase/migrations/20260120_rls_policy_tests.sql`)
- Tests Row-Level Security policies directly in PostgreSQL
- Verifies org isolation for all major tables
- Tests cross-org access prevention
- Validates NULL org_id prevention

### 2. **Application Layer Tests** (`tests/integration/multi-tenancy.test.js`)
- Tests API-level org isolation
- Verifies RLS policy enforcement
- Tests audit logging functionality
- Validates data integrity constraints

## Prerequisites

### For SQL Tests
- PostgreSQL client (`psql`) installed
- Access to test/staging database
- Service role credentials

### For JavaScript Tests
- Node.js 18+ installed
- Vitest test runner: `npm install -D vitest @supabase/supabase-js`
- Test environment variables configured

## Running the Tests

### Option 1: SQL Tests (Database Level)

Run directly against your database:

```bash
# Using psql
psql -h your-db-host -U postgres -d your-database -f supabase/migrations/20260120_rls_policy_tests.sql

# Using Supabase CLI
supabase db execute -f supabase/migrations/20260120_rls_policy_tests.sql
```

**Expected Output:**
```
 test_name                    | table_name       | status | details
------------------------------+------------------+--------+----------------------------------------
 Projects Isolation           | projects         | PASS   | User from Org A sees 1 projects...
 Requisitions Isolation       | requisitions     | PASS   | Org A user cannot see Org B...
 Items Isolation              | items            | PASS   | Org A user cannot see Org B items
 Cross-Org Update Prevention  | projects         | PASS   | RLS policies prevent cross-org updates
 Cross-Org Delete Prevention  | projects         | PASS   | RLS policies prevent cross-org deletes
 Expense Accounts Isolation   | expense_accounts | PASS   | Org A user cannot see Org B expense...
 NULL org_id Prevention       | projects         | PASS   | Trigger correctly prevents NULL org_id

 total_tests | passed | failed | pass_rate
-------------+--------+--------+-----------
           7 |      7 |      0 |    100.00
```

### Option 2: JavaScript Tests (Application Level)

#### Setup

1. **Create test environment file:**

```bash
# .env.test
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

2. **Install dependencies:**

```bash
npm install -D vitest @supabase/supabase-js
```

3. **Create test organizations:**

You need two test organizations in your database. You can create them via:
- The signup UI
- The SQL script above
- Supabase Studio

#### Run Tests

```bash
# Run all integration tests
npm run test:integration

# Or with vitest directly
npx vitest run tests/integration/multi-tenancy.test.js

# Watch mode for development
npx vitest tests/integration/multi-tenancy.test.js
```

**Expected Output:**
```
 ✓ tests/integration/multi-tenancy.test.js (12)
   ✓ Multi-Tenancy Integration Tests (12)
     ✓ Organization Isolation (4)
       ✓ should prevent cross-org project access
       ✓ should prevent cross-org requisition access
       ✓ should prevent cross-org item access
       ✓ should prevent cross-org expense account access
     ✓ RLS Policy Enforcement (3)
       ✓ should enforce SELECT policies
       ✓ should enforce UPDATE policies
       ✓ should enforce DELETE policies
     ✓ Audit Logging (2)
       ✓ should log cross-org access attempts
       ✓ should track critical security events
     ✓ Data Integrity (2)
       ✓ should prevent NULL org_id insertions
       ✓ should auto-set org_id from context when missing
     ✓ Index Performance (1)
       ✓ should have composite indexes for common queries

 Test Files  1 passed (1)
      Tests  12 passed (12)
```

## What Each Test Validates

### Organization Isolation Tests
- ✅ Projects: Users can only see projects from their org
- ✅ Requisitions: Users can only see requisitions from their org
- ✅ Items: Users can only see items from their org
- ✅ Expense Accounts: Users can only see expense accounts from their org

### RLS Policy Tests
- ✅ SELECT: Only returns rows matching user's org_id
- ✅ UPDATE: Cannot update rows from other orgs
- ✅ DELETE: Cannot delete rows from other orgs
- ✅ INSERT: New rows automatically get correct org_id

### Security Tests
- ✅ Cross-Org Access: Blocked and logged
- ✅ NULL org_id: Prevented by trigger
- ✅ Audit Logging: All security events recorded
- ✅ Data Leakage: No information disclosure

### Performance Tests
- ✅ Composite Indexes: Exist for common queries
- ✅ Query Performance: Fast with proper indexes

## Interpreting Results

### PASS ✅
- Test succeeded
- Security controls are working as expected
- No data leakage detected

### FAIL ❌
- **CRITICAL**: Security vulnerability detected
- Immediate investigation required
- Do not deploy to production

### Common Failure Scenarios

#### Data Leakage
```
FAIL - Org A user can see Org B requisitions - DATA LEAKAGE!
```
**Fix**: Check RLS policies on requisitions table

#### Cross-Org Access
```
FAIL - Cross-org update succeeded - SECURITY BREACH!
```
**Fix**: Verify UPDATE policies have USING clause

#### NULL org_id
```
FAIL - NULL org_id insert succeeded - SECURITY BREACH!
```
**Fix**: Check set_org_id_on_insert trigger is applied

## Continuous Integration

### GitHub Actions Example

```yaml
# .github/workflows/test-multi-tenancy.yml
name: Multi-Tenancy Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Install dependencies
        run: npm install

      - name: Run integration tests
        env:
          VITE_SUPABASE_URL: ${{ secrets.SUPABASE_TEST_URL }}
          VITE_SUPABASE_ANON_KEY: ${{ secrets.SUPABASE_TEST_KEY }}
        run: npm run test:integration

      - name: Run SQL tests
        run: |
          psql ${{ secrets.DATABASE_URL }} -f supabase/migrations/20260120_rls_policy_tests.sql
```

## Manual Testing Checklist

In addition to automated tests, perform these manual checks:

### Pre-Deployment Checklist

- [ ] Run all automated tests (100% pass rate required)
- [ ] Sign in as User A, verify can only see Org A data
- [ ] Sign in as User B, verify can only see Org B data
- [ ] Try accessing Org A resource URL while logged into Org B
- [ ] Check audit logs for any suspicious activity
- [ ] Verify performance with realistic data volumes
- [ ] Test org switching (data refreshes correctly)
- [ ] Verify email verification flow
- [ ] Test signup with malicious inputs (XSS attempts)
- [ ] Check database for any rows with NULL org_id

### Security Penetration Tests

- [ ] Attempt SQL injection in org filters
- [ ] Try modifying JWT claims to access other orgs
- [ ] Attempt CSRF attacks on org switching
- [ ] Try enumerating resource IDs from other orgs
- [ ] Test session hijacking scenarios
- [ ] Verify CORS restrictions work
- [ ] Test rate limiting on signup endpoint

## Troubleshooting

### Tests Fail to Connect

```bash
Error: Missing Supabase credentials
```

**Solution**: Check your `.env.test` file has correct credentials

### RLS Tests Return "Permission Denied"

```bash
ERROR: permission denied for table projects
```

**Solution**: Run tests with service role key, not anon key

### No Test Organizations Found

```bash
⚠️ No organizations found for testing
```

**Solution**: Create test orgs manually or run setup script

### Cleanup Issues

```bash
ERROR: foreign key constraint violation
```

**Solution**: Delete child records first (requisitions before projects)

## Best Practices

1. **Always run tests before deploying**
   - Pre-deployment: All tests must pass
   - Post-deployment: Verify in production

2. **Keep test data isolated**
   - Use dedicated test database
   - Don't test on production data
   - Clean up after tests

3. **Monitor test performance**
   - Tests should complete in < 30 seconds
   - Slow tests indicate missing indexes

4. **Review audit logs regularly**
   - Check for failed access attempts
   - Investigate anomalies
   - Set up alerts for critical events

5. **Update tests with new features**
   - New tables → new RLS tests
   - New APIs → new integration tests
   - New security controls → new validation tests

## Additional Resources

- [Multi-Tenancy Best Practices](../../docs/MULTI_TENANCY_BEST_PRACTICES.md)
- [RLS Policy Guide](https://supabase.com/docs/guides/auth/row-level-security)
- [PostgreSQL RLS Documentation](https://www.postgresql.org/docs/current/ddl-rowsecurity.html)
- [Security Audit Logging](../../docs/EMAIL_VERIFICATION_IMPLEMENTATION.md)

## Support

If tests fail:
1. Check the [Troubleshooting](#troubleshooting) section
2. Review error messages carefully
3. Verify database migrations are applied
4. Check Supabase logs for RLS policy violations
5. Review audit logs for security events

## License

These tests are part of the PCM Requisition System and subject to the same license terms.

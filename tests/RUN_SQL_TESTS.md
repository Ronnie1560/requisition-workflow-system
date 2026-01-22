# How to Run SQL RLS Policy Tests

Your Supabase Project: `https://your-project-ref.supabase.co`

## ✅ Option 1: Supabase Dashboard (Easiest - Recommended)

### Steps:

1. **Go to Supabase Dashboard**:
   - Open: https://supabase.com/dashboard
   - Sign in to your account
   - Select project: `your-project-ref`

2. **Open SQL Editor**:
   - Click **SQL Editor** in the left sidebar
   - Click **New Query**

3. **Copy the test file**:
   - Open: `supabase/migrations/20260120_rls_policy_tests.sql`
   - Copy ALL the contents (Ctrl+A, Ctrl+C)

4. **Paste and Run**:
   - Paste into the SQL Editor
   - Click **Run** button (or press Ctrl+Enter)

5. **View Results**:
   - Look for the test results table
   - Check for **PASS/FAIL** status
   - Review the summary at the bottom

### Expected Output:

```
 test_name                    | table_name       | status | details
------------------------------+------------------+--------+------------------
 Projects Isolation           | projects         | PASS   | ✓ User from Org A sees 1 projects
 Requisitions Isolation       | requisitions     | PASS   | ✓ Org A user cannot see Org B...
 Items Isolation              | items            | PASS   | ✓ Org A user cannot see Org B items
 Cross-Org Update Prevention  | projects         | PASS   | ✓ RLS policies prevent updates
 Cross-Org Delete Prevention  | projects         | PASS   | ✓ RLS policies prevent deletes
 Expense Accounts Isolation   | expense_accounts | PASS   | ✓ Org A user cannot see Org B...
 NULL org_id Prevention       | projects         | PASS   | ✓ Trigger prevents NULL org_id

 total_tests | passed | failed | pass_rate
-------------+--------+--------+-----------
           7 |      7 |      0 |    100.00
```

✅ **You want to see 7/7 PASS (100% pass rate)**

---

## ✅ Option 2: Install PostgreSQL Client (psql)

### For Windows:

1. **Download PostgreSQL**:
   - Go to: https://www.postgresql.org/download/windows/
   - Download installer (includes psql)
   - Install (you only need the command-line tools)

2. **Run the test**:
   ```cmd
   psql "postgresql://postgres:[YOUR-PASSWORD]@db.your-project-ref.supabase.co:5432/postgres" -f supabase\migrations\20260120_rls_policy_tests.sql
   ```

3. **Get your password**:
   - Supabase Dashboard → Project Settings → Database
   - Copy the database password
   - Replace `[YOUR-PASSWORD]` in command above

---

## ✅ Option 3: Supabase CLI (For Developers)

### Install Supabase CLI:

```bash
# Using npm
npm install -g supabase

# Or using scoop (Windows)
scoop install supabase
```

### Run the test:

```bash
# Login to Supabase
supabase login

# Link to your project
supabase link --project-ref your-project-ref

# Run the test
supabase db execute -f supabase/migrations/20260120_rls_policy_tests.sql
```

---

## 📊 What the Tests Check

The SQL tests will validate:

1. **Projects Isolation** - Users can only see their org's projects
2. **Requisitions Isolation** - Users can only see their org's requisitions
3. **Items Isolation** - Users can only see their org's items
4. **Cross-Org Update Prevention** - Cannot update other org's data
5. **Cross-Org Delete Prevention** - Cannot delete other org's data
6. **Expense Accounts Isolation** - Users can only see their org's accounts
7. **NULL org_id Prevention** - Database prevents NULL org_id insertions

---

## ✅ Success Criteria

**PASS**: All 7 tests show `PASS` status and pass rate is `100.00`

**Example of SUCCESS**:
```
total_tests | passed | failed | pass_rate
-------------+--------+--------+-----------
           7 |      7 |      0 |    100.00
```

---

## ❌ What to Do if Tests Fail

If any test shows `FAIL`:

1. **Note which test failed**
2. **Read the details column** for the error message
3. **Check the relevant RLS policies**:
   - Go to Supabase Dashboard → Database → Policies
   - Find the table that failed
   - Verify policies are enabled

4. **Verify migrations applied**:
   - Check that all migration files have been run
   - Supabase Dashboard → Database → Migrations

5. **Check this file for help**:
   - `tests/TEST_RESULTS_SUMMARY.md` - Troubleshooting section
   - `docs/MULTI_TENANCY_BEST_PRACTICES.md` - RLS policy guide

---

## 🎯 Recommended: Use Option 1 (Dashboard)

**Easiest and fastest**: Copy/paste into Supabase SQL Editor

This is what I recommend for your first test run!

---

## 📞 Need Help?

If you encounter issues:
- Check that test organizations don't already exist with slugs 'test-org-a' or 'test-org-b'
- Ensure all migrations have been applied to your database
- Review the test output carefully for error messages

# Database Setup Guide

## Overview

This guide explains how to set up the PCM Requisition System database in Supabase.

## Database Schema

The system includes **18 core tables** organized into several functional groups:

### Core Tables
- `users` - Extended user profiles with role information
- `projects` - Organization projects/departments/cost centers
- `expense_accounts` - Chart of accounts for expense categorization
- `project_accounts` - Links projects to expense accounts with budgets

### Catalog Tables
- `uom_types` - Units of measure (pieces, kg, liters, etc.)
- `items` - Master catalog of items and services
- `account_items` - Pre-approved items for each project-account with pricing

### Assignment Tables
- `user_project_assignments` - User assignments to projects with roles

### Requisition Tables
- `requisitions` - Purchase requisitions and expense claims
- `requisition_items` - Line items for requisitions
- `comments` - Comments and approval notes on requisitions
- `attachments` - File attachments (receipts, quotes, etc.)

### Purchase Order Tables
- `purchase_orders` - Purchase orders generated from requisitions
- `po_items` - Line items for purchase orders

### Receipt Tables
- `receipt_transactions` - Goods receipt transactions
- `receipt_items` - Line items for receipts

### System Tables
- `audit_logs` - System audit trail
- `notifications` - User notifications for workflow events

## Migration Files

The database setup consists of 4 migration files in the `supabase/migrations/` folder:

1. **`20241213_initial_schema.sql`** - Core database schema
   - All table definitions
   - Enums for status types, roles, etc.
   - Indexes for performance
   - Triggers for updated_at columns
   - Table comments

2. **`20241213_rls_policies.sql`** - Row Level Security policies
   - Enable RLS on all tables
   - Helper functions for security checks
   - Granular access control policies based on user roles

3. **`20241213_helper_functions.sql`** - Business logic functions
   - Auto-generate requisition/PO/receipt numbers
   - Calculate totals automatically
   - Budget validation
   - Notification system
   - Audit logging
   - Dashboard statistics

4. **`20241213_seed_data.sql`** - Test/development data
   - 25 UOM types (pieces, kg, liters, hours, etc.)
   - 16 expense accounts (2-level hierarchy)
   - 3 sample projects
   - 8 project-account budget allocations
   - 10 sample items (office supplies, IT equipment, services)
   - Pre-approved items with pricing

## How to Run Migrations

### Option 1: Using Supabase Dashboard (Recommended)

1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor**
3. Run each migration file in order:
   - First: `20241213_initial_schema.sql`
   - Second: `20241213_rls_policies.sql`
   - Third: `20241213_helper_functions.sql`
   - Fourth: `20241213_seed_data.sql`

4. Click "Run" for each file

### Option 2: Using Supabase CLI

```bash
# Initialize Supabase in your project (if not already done)
supabase init

# Link to your remote project
supabase link --project-ref your-project-ref

# Push migrations to Supabase
supabase db push

# Or run migrations individually
supabase db execute --file supabase/migrations/20241213_initial_schema.sql
supabase db execute --file supabase/migrations/20241213_rls_policies.sql
supabase db execute --file supabase/migrations/20241213_helper_functions.sql
supabase db execute --file supabase/migrations/20241213_seed_data.sql
```

### Option 3: Copy & Paste in SQL Editor

1. Open each migration file
2. Copy the entire contents
3. Paste into Supabase SQL Editor
4. Run the query

## Post-Migration Setup

### 1. Create Your First User

Sign up through the application's registration page. This will create a user in Supabase Auth and automatically create a profile in the `users` table.

### 2. Promote to Super Admin

After signing up, promote your account to super admin using SQL:

```sql
UPDATE users
SET role = 'super_admin'
WHERE email = 'your-email@example.com';
```

### 3. Assign Users to Projects

As a super admin, you can assign users to projects through the application, or manually via SQL:

```sql
INSERT INTO user_project_assignments (user_id, project_id, role, assigned_by)
VALUES (
  (SELECT id FROM users WHERE email = 'user@example.com'),
  (SELECT id FROM projects WHERE code = 'MAIN'),
  'submitter',
  (SELECT id FROM users WHERE role = 'super_admin' LIMIT 1)
);
```

## User Roles Explained

- **Submitter** - Can create and submit requisitions
- **Reviewer** - Can review requisitions (first approval stage)
- **Approver** - Can approve requisitions (final approval stage)
- **Store Manager** - Can manage purchase orders and receipts
- **Super Admin** - Full system access, can manage all data

## Security Features

### Row Level Security (RLS)

All tables have RLS enabled with policies that ensure:

- Users can only see data they're authorized to access
- Submitters can only edit their own draft requisitions
- Reviewers/Approvers can only access requisitions from their assigned projects
- Super admins have full access to all data
- Audit logs are only visible to super admins

### Helper Functions

Security helper functions:
- `get_user_role()` - Get current user's role
- `is_super_admin()` - Check if user is super admin
- `has_project_role(project_id, role)` - Check project role
- `is_assigned_to_project(project_id)` - Check project assignment
- `owns_requisition(req_id)` - Check requisition ownership
- `can_review_requisition(req_id)` - Check review permission
- `can_approve_requisition(req_id)` - Check approval permission

## Automated Features

### Auto-Generated Numbers

- Requisitions: `REQ-24-00001`, `REQ-24-00002`, etc.
- Purchase Orders: `PO-24-00001`, `PO-24-00002`, etc.
- Receipts: `GR-24-00001`, `GR-24-00002`, etc.

### Auto-Calculated Totals

- Requisition item totals (quantity × unit price)
- Requisition total amounts
- Project account spent amounts
- Budget utilization

### Auto-Notifications

Users receive notifications when:
- New requisition is submitted (notifies reviewers)
- Requisition is reviewed (notifies approvers)
- Requisition is approved (notifies submitter)
- Requisition is rejected (notifies submitter)
- New comment is added (notifies submitter)

### Audit Trail

All changes to requisitions are automatically logged in `audit_logs` table with:
- What changed (old values → new values)
- Who made the change
- When it was changed
- IP address and user agent

## Testing the Setup

### Verify Tables Created

```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;
```

### Check Seed Data

```sql
-- Check UOM types
SELECT * FROM uom_types;

-- Check projects
SELECT * FROM projects;

-- Check expense accounts
SELECT * FROM expense_accounts;

-- Check items
SELECT * FROM items;
```

### Test Helper Functions

```sql
-- Generate a requisition number
SELECT generate_requisition_number();

-- Get budget summary for a project
SELECT * FROM get_project_budget_summary('33333333-3333-3333-3333-333333333301');
```

## Troubleshooting

### RLS Blocking Queries

If you can't see data, check:
1. Are you authenticated? (`auth.uid()` should return your user ID)
2. Do you have the correct role in the `users` table?
3. Are you assigned to the relevant project in `user_project_assignments`?

### Foreign Key Errors

Ensure you're running migrations in order. Some tables depend on others being created first.

### Function Errors

If helper functions fail, ensure:
1. RLS policies are created after tables
2. Helper functions are created after tables and RLS policies

## Next Steps

After database setup:

1. ✅ Test the connection using the Connection Test page
2. ✅ Sign up and create your super admin account
3. ✅ Assign users to projects
4. 🚀 Start creating requisitions!

## Database Diagram

```
users ─┬─> requisitions ─> requisition_items
       │                 └> comments
       │                 └> attachments
       │                 └> purchase_orders ─> po_items
       │                                     └> receipt_transactions ─> receipt_items
       │
       └─> user_project_assignments

projects ─┬─> project_accounts ─> account_items
          └─> requisitions

expense_accounts ─> project_accounts

items ─┬─> requisition_items
       ├─> account_items
       └─> po_items

uom_types ─┬─> items (default_uom_id)
           ├─> requisition_items
           └─> po_items
```

## Support

For questions or issues with database setup, refer to:
- [Supabase Documentation](https://supabase.com/docs)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)

# Multi-Tenancy Implementation Guide

## Overview

The PCM Requisition System has been upgraded to a multi-tenant SaaS architecture using **Row-Level Isolation** with PostgreSQL Row-Level Security (RLS) policies.

## Architecture

### Strategy: Row-Level Isolation

All tenants share the same database tables, with data isolation enforced at the database level through:

1. **`org_id` Foreign Key**: Every data table has an `org_id` column referencing the `organizations` table
2. **RLS Policies**: PostgreSQL policies filter data based on user's organization membership
3. **Helper Functions**: Database functions like `get_current_org_id()` and `user_belongs_to_org()` enable secure filtering

### Benefits

- ✅ **Cost Effective**: Single database instance serves all tenants
- ✅ **Easy Maintenance**: One schema to maintain and migrate
- ✅ **Secure**: Database-level isolation prevents data leaks
- ✅ **Flexible**: Users can belong to multiple organizations
- ✅ **Scalable**: Add tenants without infrastructure changes

## Database Schema

### New Tables

#### `organizations`
```sql
CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(100) UNIQUE NOT NULL,
  logo_url TEXT,
  email VARCHAR(255),
  phone VARCHAR(50),
  website VARCHAR(255),
  address_line1 VARCHAR(255),
  city VARCHAR(100),
  country VARCHAR(100) DEFAULT 'Uganda',
  tax_id VARCHAR(100),
  
  -- Subscription fields
  plan subscription_plan DEFAULT 'free',
  status organization_status DEFAULT 'trial',
  trial_ends_at TIMESTAMPTZ,
  max_users INTEGER DEFAULT 5,
  max_projects INTEGER DEFAULT 10,
  max_requisitions_per_month INTEGER DEFAULT 100,
  
  -- Billing (Stripe integration ready)
  stripe_customer_id VARCHAR(255),
  stripe_subscription_id VARCHAR(255),
  billing_email VARCHAR(255),
  
  -- Metadata
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### `organization_members`
```sql
CREATE TABLE organization_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role org_member_role DEFAULT 'member',
  invited_by UUID REFERENCES auth.users(id),
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(org_id, user_id)
);
```

### Subscription Plans

| Plan | Users | Projects | Requisitions/mo | Features |
|------|-------|----------|-----------------|----------|
| Free | 5 | 10 | 100 | Basic features |
| Starter | 15 | 50 | 500 | Email notifications |
| Professional | 50 | Unlimited | Unlimited | Advanced reports, API |
| Enterprise | Unlimited | Unlimited | Unlimited | SSO, Custom branding |

### Organization Roles

| Role | Permissions |
|------|-------------|
| `owner` | Full control, billing, delete org |
| `admin` | Manage members, settings |
| `member` | Standard user access |

## Helper Functions

### `get_current_org_id()`
Returns the current user's first organization ID. Used in RLS policies.

```sql
CREATE OR REPLACE FUNCTION get_current_org_id()
RETURNS UUID AS $$
  SELECT org_id FROM organization_members
  WHERE user_id = auth.uid()
  LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE;
```

### `user_belongs_to_org(org_id UUID)`
Checks if the current user belongs to the specified organization.

```sql
CREATE OR REPLACE FUNCTION user_belongs_to_org(org_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM organization_members
    WHERE organization_members.org_id = $1
    AND user_id = auth.uid()
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;
```

### `user_is_org_admin(org_id UUID)`
Checks if user has admin privileges in the organization.

### `user_is_org_owner(org_id UUID)`
Checks if user is the organization owner.

## RLS Policy Pattern

All data tables use this policy pattern:

```sql
-- SELECT: Allow if user belongs to the organization
CREATE POLICY "Users can view org data"
ON table_name FOR SELECT
USING (org_id IS NULL OR user_belongs_to_org(org_id));

-- INSERT: Set org_id automatically via trigger
CREATE POLICY "Users can insert org data"
ON table_name FOR INSERT
WITH CHECK (org_id IS NULL OR user_belongs_to_org(org_id));

-- UPDATE/DELETE: Require org membership
CREATE POLICY "Users can modify org data"
ON table_name FOR UPDATE
USING (org_id IS NULL OR user_belongs_to_org(org_id));
```

### Automatic org_id Assignment

A trigger automatically sets `org_id` on insert:

```sql
CREATE OR REPLACE FUNCTION set_org_id_on_insert()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.org_id IS NULL THEN
    NEW.org_id := get_current_org_id();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

## Frontend Components

### OrganizationContext

Provider that manages organization state:

```jsx
import { OrganizationProvider, useOrganization } from './context/OrganizationContext'

// In App.jsx
<AuthProvider>
  <OrganizationProvider>
    <App />
  </OrganizationProvider>
</AuthProvider>

// In components
const {
  organizations,     // All user's organizations
  currentOrg,        // Currently selected org
  loading,           // Loading state
  switchOrganization, // Change org
  createOrganization, // Create new org
  updateOrganization, // Update org settings
  inviteUser,        // Invite member
  getMembers,        // Get org members
  removeMember,      // Remove member
  isOwner,           // Is current user owner?
  canManageOrg,      // Can user manage org?
} = useOrganization()
```

### OrganizationSwitcher

Dropdown component in sidebar for switching organizations:

```jsx
import OrganizationSwitcher from './components/organizations/OrganizationSwitcher'

// Displays:
// - Current org name and plan
// - Dropdown to switch orgs
// - Links to org settings and create new org
```

### Pages

- `/organizations/new` - Create new organization
- `/settings/organization` - Org settings (general, members, billing)

## API Endpoints

### Organizations Service

```javascript
import {
  getUserOrganizations,
  getOrganizationById,
  createOrganization,
  updateOrganization,
  deleteOrganization,
  getOrganizationMembers,
  inviteUserToOrganization,
  removeMember,
  updateMemberRole,
} from './services/api/organizations'
```

## Migration Steps

### For Existing Deployments

1. **Backup Database**
   ```bash
   pg_dump -U postgres -d your_db > backup.sql
   ```

2. **Run Migration**
   ```bash
   supabase db push
   # Or manually run: 20250112_10_multi_tenancy.sql
   ```

3. **Data Migration**
   The migration automatically:
   - Creates a default organization from existing `organization_settings`
   - Assigns all existing users as members
   - Sets `org_id` on all existing data

4. **Update Environment**
   No new environment variables required

5. **Deploy Frontend**
   ```bash
   cd client && npm run build
   ```

## Usage Examples

### Creating an Organization

```javascript
const { createOrganization } = useOrganization()

const result = await createOrganization({
  name: 'My Company',
  slug: 'my-company',
  email: 'admin@mycompany.com'
})
```

### Switching Organizations

```javascript
const { switchOrganization, organizations } = useOrganization()

// Switch to another org
switchOrganization(organizations[1].id)
```

### Inviting Users

```javascript
const { inviteUser } = useOrganization()

await inviteUser('newuser@email.com', 'member')
```

## Security Considerations

1. **RLS is Enforced at Database Level**: Even if frontend code is compromised, users cannot access other orgs' data

2. **Backward Compatibility**: `org_id IS NULL` condition allows existing data to work until migrated

3. **Member Verification**: All operations verify user's org membership

4. **Owner-Only Actions**: Billing and deletion require owner role

5. **Audit Trail**: `created_at`, `updated_at`, and `joined_at` timestamps for compliance

## Testing Multi-Tenancy

```bash
# Run the test suite
cd client && npm run test

# Test org isolation manually:
# 1. Create two test users
# 2. Create orgs for each
# 3. Verify each user only sees their org's data
```

## Stripe Integration (Future)

The schema is prepared for Stripe billing:

```javascript
// In /api/create-checkout-session
const session = await stripe.checkout.sessions.create({
  customer: org.stripe_customer_id,
  subscription_data: {
    metadata: { org_id: org.id }
  },
  // ...
})
```

## Troubleshooting

### User can't see any data

1. Check user has organization membership:
   ```sql
   SELECT * FROM organization_members WHERE user_id = 'user-uuid';
   ```

2. Verify org_id is set on data:
   ```sql
   SELECT id, org_id FROM projects LIMIT 10;
   ```

### Can't create organization

Check the user is authenticated and `create_organization` function exists:
```sql
SELECT * FROM pg_proc WHERE proname = 'create_organization';
```

### RLS blocking access

Test the helper functions:
```sql
SELECT get_current_org_id();
SELECT user_belongs_to_org('org-uuid');
```

## Files Changed

### Database
- `supabase/migrations/20250112_10_multi_tenancy.sql`

### Frontend Context
- `client/src/context/OrganizationContext.jsx`

### Components
- `client/src/components/organizations/OrganizationSwitcher.jsx`

### Pages
- `client/src/pages/organizations/CreateOrganization.jsx`
- `client/src/pages/organizations/OrganizationSettings.jsx`

### Services
- `client/src/services/api/organizations.js`

### Layout
- `client/src/components/layout/MainLayout.jsx` (added OrganizationSwitcher)
- `client/src/App.jsx` (added OrganizationProvider and routes)

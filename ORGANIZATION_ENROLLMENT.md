# Organization Enrollment Flow

**Status**: ⚠️ Partially Implemented
**Last Updated**: January 13, 2026

---

## Current State

### ✅ What's Implemented

1. **Existing User Creates Organization**:
   - Users who are already in the system can create organizations
   - Function: `create_organization(p_name, p_slug, p_email, p_plan)`
   - Frontend: CreateOrganization component exists
   - User becomes owner automatically

2. **Default Organization**:
   - All existing users were migrated to "Default Organization"
   - New users registering currently join Default Organization

### ⚠️ What's Missing

1. **New Organization Signup Flow**:
   - No self-service signup for brand new organizations
   - No organization creation during user registration
   - No trial management for new organizations

2. **Onboarding Experience**:
   - No organization setup wizard
   - No team invitation during setup
   - No billing/payment integration

---

## Recommended Implementation

### Option 1: Separate Organization Signup (Recommended for SaaS)

**Flow**:
1. User visits `/signup` or `/create-organization`
2. **Step 1**: Create Organization
   - Organization name
   - Slug (subdomain)
   - Industry (optional)
   - Plan selection
3. **Step 2**: Create Admin Account
   - Full name
   - Email
   - Password (strong password required)
   - Phone (optional)
4. **Step 3**: Setup Complete
   - Organization created
   - User created and added as owner
   - Redirect to dashboard
   - Show onboarding wizard (optional)

**Database Changes Needed**: None (already supported)

**Frontend Changes Needed**:
- New signup page with organization + user creation
- Multi-step form component
- Update registration logic

### Option 2: User Signup First, Then Create Organization

**Flow**:
1. User visits `/register`
2. Creates personal account (joins Default Organization)
3. After login, prompted: "Create your organization or join existing?"
4. If "Create", redirect to CreateOrganization page
5. Organization created, user becomes owner

**Pros**:
- Simpler implementation
- Users can try the system first (in Default Org)
- Can join existing orgs later

**Cons**:
- Users start in shared Default Organization
- Extra step to create their own org
- Confusing for true SaaS model

### Option 3: Hybrid (Best User Experience)

**Flow**:
1. Two separate entry points:
   - `/register` - Personal account (joins Default)
   - `/signup-organization` - Create new organization + account
2. During organization signup:
   - Organization details collected first
   - User account created
   - User automatically becomes owner
   - Never touches Default Organization
3. During personal signup:
   - User account created
   - Joins Default Organization (or pending invitations)
   - Can create organization later

---

## Implementation Guide

### Step 1: Create Organization Signup Page

**File**: `client/src/pages/auth/OrganizationSignup.jsx`

```jsx
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { logger } from '../../utils/logger'

export default function OrganizationSignup() {
  const navigate = useNavigate()
  const [step, setStep] = useState(1) // 1: Org Details, 2: Admin Account
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  // Organization details
  const [orgData, setOrgData] = useState({
    name: '',
    slug: '',
    email: '',
    plan: 'free'
  })

  // Admin user details
  const [userData, setUserData] = useState({
    full_name: '',
    email: '',
    password: '',
    phone: ''
  })

  const handleOrgSubmit = (e) => {
    e.preventDefault()
    // Validate organization details
    if (!orgData.name || !orgData.slug) {
      setError('Organization name and slug are required')
      return
    }
    setStep(2) // Move to admin account creation
  }

  const handleUserSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      // Step 1: Create user account
      const { data: authData, error: signupError } = await supabase.auth.signUp({
        email: userData.email,
        password: userData.password,
        options: {
          data: {
            full_name: userData.full_name,
            phone: userData.phone
          }
        }
      })

      if (signupError) throw signupError

      // Step 2: Create organization (will be called by authenticated user)
      const { data: orgId, error: orgError } = await supabase.rpc('create_organization', {
        p_name: orgData.name,
        p_slug: orgData.slug,
        p_email: orgData.email || userData.email,
        p_plan: orgData.plan
      })

      if (orgError) throw orgError

      logger.info('Organization created successfully', { orgId })

      // Redirect to dashboard or onboarding
      navigate('/dashboard')
    } catch (err) {
      logger.error('Organization signup failed', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full space-y-8 p-8 bg-white rounded-lg shadow">
        <div>
          <h2 className="text-3xl font-bold text-center">Create Your Organization</h2>
          <p className="mt-2 text-center text-gray-600">
            {step === 1 ? 'Step 1: Organization Details' : 'Step 2: Admin Account'}
          </p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
            {error}
          </div>
        )}

        {step === 1 ? (
          <form onSubmit={handleOrgSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Organization Name *
              </label>
              <input
                type="text"
                required
                value={orgData.name}
                onChange={(e) => setOrgData({ ...orgData, name: e.target.value })}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                placeholder="Acme Corporation"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">
                Slug (URL) *
              </label>
              <input
                type="text"
                required
                value={orgData.slug}
                onChange={(e) => setOrgData({ ...orgData, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-') })}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                placeholder="acme-corp"
              />
              <p className="mt-1 text-sm text-gray-500">
                Your organization's unique identifier
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">
                Organization Email
              </label>
              <input
                type="email"
                value={orgData.email}
                onChange={(e) => setOrgData({ ...orgData, email: e.target.value })}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                placeholder="contact@acme.com"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">
                Plan
              </label>
              <select
                value={orgData.plan}
                onChange={(e) => setOrgData({ ...orgData, plan: e.target.value })}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              >
                <option value="free">Free (5 users, 10 projects)</option>
                <option value="starter">Starter (20 users, 50 projects)</option>
                <option value="professional">Professional (100 users, unlimited projects)</option>
                <option value="enterprise">Enterprise (Unlimited)</option>
              </select>
            </div>

            <button
              type="submit"
              className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              Continue to Admin Account
            </button>
          </form>
        ) : (
          <form onSubmit={handleUserSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Full Name *
              </label>
              <input
                type="text"
                required
                value={userData.full_name}
                onChange={(e) => setUserData({ ...userData, full_name: e.target.value })}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                placeholder="John Doe"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">
                Email *
              </label>
              <input
                type="email"
                required
                value={userData.email}
                onChange={(e) => setUserData({ ...userData, email: e.target.value })}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                placeholder="john@acme.com"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">
                Password *
              </label>
              <input
                type="password"
                required
                value={userData.password}
                onChange={(e) => setUserData({ ...userData, password: e.target.value })}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                placeholder="••••••••"
              />
              <p className="mt-1 text-sm text-gray-500">
                Minimum 8 characters, must include uppercase, lowercase, and number
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">
                Phone
              </label>
              <input
                type="tel"
                value={userData.phone}
                onChange={(e) => setUserData({ ...userData, phone: e.target.value })}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                placeholder="+256 700 000 000"
              />
            </div>

            <div className="flex gap-4">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="flex-1 py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
              >
                Back
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
              >
                {loading ? 'Creating...' : 'Create Organization'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
```

### Step 2: Update Routes

**File**: `client/src/App.jsx`

```jsx
import OrganizationSignup from './pages/auth/OrganizationSignup'

// Add route
<Route path="/signup-organization" element={<OrganizationSignup />} />
```

### Step 3: Add Database Trigger (Optional)

Automatically create user profile when auth user is created:

```sql
-- Function to create user profile on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO users (id, email, full_name, phone, role)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'phone',
    'submitter'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger on auth.users insert
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();
```

### Step 4: Update Landing Page

Add prominent "Create Organization" CTA:

```jsx
// Landing page or login page
<div className="text-center">
  <h1>Welcome to PCM Requisition System</h1>
  <div className="mt-8 space-x-4">
    <Link to="/login" className="btn-secondary">
      Sign In
    </Link>
    <Link to="/signup-organization" className="btn-primary">
      Create Your Organization
    </Link>
  </div>
</div>
```

---

## Alternative: No-Code Enrollment via Supabase Dashboard

If you don't want to build a full signup flow yet:

### Manual Organization Creation (Admin Process)

1. **Client contacts you** to create an organization
2. **You run SQL** in Supabase SQL Editor:

```sql
-- Create organization manually
DO $$
DECLARE
  v_org_id UUID;
  v_admin_email VARCHAR := 'client@example.com'; -- Client's email
  v_admin_id UUID;
BEGIN
  -- Create organization
  INSERT INTO organizations (name, slug, email, plan, status)
  VALUES ('Client Organization', 'client-org', 'contact@client.com', 'professional', 'active')
  RETURNING id INTO v_org_id;

  -- Check if user exists
  SELECT id INTO v_admin_id FROM auth.users WHERE email = v_admin_email;

  -- If user doesn't exist, they need to register first
  IF v_admin_id IS NULL THEN
    RAISE EXCEPTION 'User % must register first', v_admin_email;
  END IF;

  -- Add user as owner
  INSERT INTO organization_members (organization_id, user_id, role, accepted_at)
  VALUES (v_org_id, v_admin_id, 'owner', NOW());

  -- Create org settings
  INSERT INTO organization_settings (org_id, organization_name)
  VALUES (v_org_id, 'Client Organization');

  RAISE NOTICE 'Organization created: % (ID: %)', 'Client Organization', v_org_id;
END $$;
```

3. **Send invitation link** to client
4. **Client logs in** and sees their organization

---

## Enrollment Best Practices

### 1. Trial Management

- Set 14-day trial for new organizations
- Automatically expire trial after period
- Prompt for payment when trial ends

### 2. Email Verification

- Require email verification before org creation
- Prevents spam/abuse

### 3. Slug Validation

- Ensure slugs are unique
- Validate format (lowercase, alphanumeric, hyphens only)
- Reserve system slugs (admin, api, app, etc.)

### 4. Onboarding Checklist

After organization creation:
- [ ] Create first project
- [ ] Invite team members
- [ ] Set up approval workflow
- [ ] Create first requisition

### 5. Billing Integration (Future)

When user selects paid plan:
- Create Stripe customer
- Collect payment method
- Create subscription
- Store stripe_customer_id and stripe_subscription_id

---

## Decision Matrix

| Approach | Complexity | User Experience | Time to Implement |
|----------|------------|-----------------|-------------------|
| Option 1 (Separate Signup) | High | Best | 2-3 days |
| Option 2 (User First) | Low | Good | 1 day |
| Option 3 (Hybrid) | Medium | Excellent | 2 days |
| Manual (No-Code) | Minimal | Poor | 0 days (already works) |

---

## Recommended Next Steps

1. **Immediate** (Use Manual Process):
   - Document manual enrollment process
   - Create SQL script for admins
   - Use for first 5-10 organizations

2. **Short Term** (1-2 weeks):
   - Implement Option 2 (User First)
   - Add "Create Organization" button to dashboard
   - Test with beta users

3. **Medium Term** (1-2 months):
   - Upgrade to Option 3 (Hybrid)
   - Add organization signup page
   - Implement trial management
   - Add Stripe billing

4. **Long Term** (3+ months):
   - Self-service onboarding wizard
   - In-app tour for new organizations
   - Team invitation during signup
   - Organization templates

---

## Questions to Consider

1. **Who can create organizations?**
   - Anyone? (Public SaaS)
   - Only invited users? (Private/B2B)
   - Manual approval required? (Curated)

2. **What happens to Default Organization?**
   - Keep for demo/testing?
   - Remove after implementing signup?
   - Use for shared resources?

3. **Pricing Strategy?**
   - Free forever?
   - Free trial then paid?
   - Contact for pricing?

4. **Email Verification?**
   - Required before org creation?
   - Can create org, verify later?

5. **Subdomain Routing?**
   - Use slug for subdomains? (acme.pcm-requisition.app)
   - Or just internal identifier?

---

## Current Recommendation

**Start with Option 2** (User First, Then Create Org):
- Fastest to implement (1 day)
- Reuses existing components
- No breaking changes
- Can upgrade to Option 3 later

**Implementation**:
1. Keep existing `/register` for user signup
2. After login, show modal: "Would you like to create your organization?"
3. If yes → redirect to CreateOrganization page
4. If no → continue in Default Organization

This gives you time to test multi-tenancy with real users before committing to a full onboarding flow.

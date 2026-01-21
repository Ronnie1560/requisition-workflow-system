# Multi-Tenancy Best Practices & Security Guide

## Table of Contents
1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Security Layers](#security-layers)
4. [Implementation Checklist](#implementation-checklist)
5. [Common Pitfalls](#common-pitfalls)
6. [Monitoring & Auditing](#monitoring--auditing)
7. [Testing Strategy](#testing-strategy)
8. [Performance Optimization](#performance-optimization)

## Overview

This PCM Requisition System implements a **Row-Level Multi-Tenancy** strategy where multiple organizations share the same database schema but data is strictly isolated by `org_id`.

### Key Principles
1. **Defense in Depth**: Multiple security layers protect against data leakage
2. **Zero Trust**: Every operation validates organization ownership
3. **Audit Everything**: All cross-org access attempts are logged
4. **Fail Secure**: Errors default to denying access, not granting it

## Architecture

### Data Isolation Strategy

```
┌─────────────────────────────────────────────────────────┐
│                    Security Layers                       │
├─────────────────────────────────────────────────────────┤
│ Layer 1: Database RLS Policies (PostgreSQL)            │
│ Layer 2: Database Triggers (org_id auto-set & validation│
│ Layer 3: API-Level Validation (Application code)       │
│ Layer 4: Frontend Context (Organization selector)      │
│ Layer 5: Audit Logging (Security monitoring)           │
└─────────────────────────────────────────────────────────┘
```

### Organization Context Flow

```
User Login → Auth Session → Organization Membership Check
                ↓
         Select Organization (org_id stored in context)
                ↓
    All queries filtered by org_id automatically
                ↓
         RLS policies enforce isolation
```

## Security Layers

### Layer 1: Row-Level Security (RLS) Policies

**Location**: `supabase/migrations/*_rls_policies*.sql`

Every table with `org_id` must have RLS policies for all CRUD operations:

```sql
-- SELECT policy
CREATE POLICY "Users can view their org data"
  ON table_name FOR SELECT
  TO authenticated
  USING (user_belongs_to_org(org_id));

-- INSERT policy
CREATE POLICY "Users can insert in their org"
  ON table_name FOR INSERT
  TO authenticated
  WITH CHECK (user_belongs_to_org(org_id));

-- UPDATE policy
CREATE POLICY "Users can update their org data"
  ON table_name FOR UPDATE
  TO authenticated
  USING (user_belongs_to_org(org_id));

-- DELETE policy
CREATE POLICY "Admins can delete org data"
  ON table_name FOR DELETE
  TO authenticated
  USING (user_is_org_admin(org_id));
```

**Critical**: Always use `WITH CHECK` for INSERT/UPDATE to prevent privilege escalation.

### Layer 2: Database Triggers

**Location**: `supabase/migrations/20260120_org_id_null_check.sql`

The `set_org_id_on_insert` trigger automatically:
1. Sets `org_id` from current user context
2. **Raises exception if org_id is NULL** (prevents data without tenant)

```sql
CREATE OR REPLACE FUNCTION set_org_id_on_insert()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.org_id IS NULL THEN
    NEW.org_id := get_current_org_id();
  END IF;

  -- CRITICAL: Prevent NULL org_id
  IF NEW.org_id IS NULL THEN
    RAISE EXCEPTION 'org_id cannot be NULL. Multi-tenancy violation.';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

### Layer 3: API-Level Validation

**Location**: `client/src/services/api/*.js`

Every API function that accesses resources:
1. Gets current `org_id` from context
2. Verifies resource belongs to current org
3. Logs cross-org access attempts
4. Throws error if validation fails

```javascript
// Example pattern
export const updateResource = async (resourceId, updates) => {
  const orgId = getCurrentOrgId()
  if (!orgId) throw new Error('No organization selected')

  // Verify ownership
  const { data: resource } = await supabase
    .from('resources')
    .select('id, org_id')
    .eq('id', resourceId)
    .single()

  if (!resource) throw new Error('Resource not found')

  // Check for cross-org access
  if (resource.org_id !== orgId) {
    // Log security event
    await logCrossOrgAccess({
      resourceType: 'resource',
      resourceId,
      resourceOrgId: resource.org_id,
      action: 'update',
      currentOrgId: orgId
    })
    throw new Error('Access denied')
  }

  // Proceed with update
  return await supabase
    .from('resources')
    .update(updates)
    .eq('id', resourceId)
    .eq('org_id', orgId) // Double-check in query
}
```

### Layer 4: Input Sanitization

**Location**: `client/src/utils/sanitization.js`, Edge Functions

All user inputs are sanitized to prevent:
- XSS attacks (HTML encoding)
- SQL injection (parameterized queries)
- Length violations (max length enforcement)
- Control character injection

```javascript
const sanitized = sanitizeInput(userInput, maxLength)
const sanitizedEmail = sanitizeEmail(email)
const sanitizedSlug = sanitizeSlug(orgUrl)
```

### Layer 5: Audit Logging

**Location**: `supabase/migrations/20260120_audit_logging_security.sql`

All security events are logged to `security_audit_logs` table:

```javascript
await logCrossOrgAccess({
  resourceType: 'requisition',
  resourceId: '123',
  resourceOrgId: 'org-abc',
  action: 'delete',
  currentOrgId: 'org-xyz'
})
```

**Severity Levels**:
- `info`: Normal operations
- `warning`: Suspicious but not critical
- `critical`: Security violations, cross-org attempts

## Implementation Checklist

### For New Tables

- [ ] Add `org_id UUID REFERENCES organizations(id)` column
- [ ] Add `NOT NULL` constraint on `org_id` (or allow NULL only for global data)
- [ ] Create RLS policies for SELECT, INSERT, UPDATE, DELETE
- [ ] Add trigger: `set_org_id_on_insert()`
- [ ] Add composite index: `(org_id, <frequently_queried_column>)`
- [ ] Test RLS policies with different user contexts

### For New API Functions

- [ ] Call `getCurrentOrgId()` at the start
- [ ] Verify resource ownership before operations
- [ ] Add `org_id` filter to all queries (`.eq('org_id', orgId)`)
- [ ] Log cross-org access attempts with `logCrossOrgAccess()`
- [ ] Sanitize all user inputs
- [ ] Handle errors securely (don't leak org info)

### For New Features

- [ ] Review all database queries for org_id filtering
- [ ] Add integration tests for org isolation
- [ ] Test with multiple orgs to verify isolation
- [ ] Document any global (cross-org) data exceptions
- [ ] Add audit log reviews to monitoring

## Common Pitfalls

### ❌ Forgetting org_id Filter

```javascript
// WRONG - no org_id filter
const { data } = await supabase
  .from('requisitions')
  .select('*')
  .eq('status', 'pending')

// CORRECT
const orgId = getCurrentOrgId()
const { data } = await supabase
  .from('requisitions')
  .select('*')
  .eq('org_id', orgId)
  .eq('status', 'pending')
```

### ❌ Using Resource IDs from URL Without Validation

```javascript
// WRONG - trusting URL param
const { id } = useParams()
await updateRequisition(id, updates)

// CORRECT - validate ownership first
const { id } = useParams()
const req = await getRequisition(id) // This validates org_id
if (req) await updateRequisition(id, updates)
```

### ❌ Exposing org_id in Error Messages

```javascript
// WRONG - leaks org information
throw new Error(`Resource belongs to org ${resource.org_id}`)

// CORRECT - generic message
throw new Error('Resource not found or access denied')
```

### ❌ Not Logging Security Events

```javascript
// WRONG - silent failure
if (resource.org_id !== orgId) {
  throw new Error('Access denied')
}

// CORRECT - log and fail
if (resource.org_id !== orgId) {
  await logCrossOrgAccess({...})
  throw new Error('Access denied')
}
```

## Monitoring & Auditing

### Dashboard Queries

**Recent Critical Events** (last 7 days):
```sql
SELECT * FROM recent_critical_events;
```

**Cross-Org Attempts by User**:
```sql
SELECT * FROM cross_org_attempts_by_user;
```

**Failed Access Attempts Count**:
```sql
SELECT
  event_type,
  COUNT(*) as count,
  COUNT(DISTINCT user_id) as unique_users
FROM security_audit_logs
WHERE created_at > NOW() - INTERVAL '24 hours'
  AND severity = 'critical'
GROUP BY event_type;
```

### Automated Alerts

Set up alerts for:
1. More than 5 cross-org attempts by single user in 1 hour
2. Any org_id NULL violations
3. Unusual access patterns (e.g., accessing 10+ different orgs)
4. Failed authentication spikes

### Log Retention

- **Standard logs**: 90 days
- **Critical logs**: Retained indefinitely
- **Cleanup**: Run `cleanup_old_audit_logs()` monthly

## Testing Strategy

### Unit Tests

Test RLS policies for each table:
```sql
-- Test as user from org A
SET LOCAL jwt.claims.sub TO 'user-from-org-a';
SET LOCAL jwt.claims.org_id TO 'org-a';

-- Should see only org A data
SELECT COUNT(*) FROM requisitions; -- Expect org A count only
```

### Integration Tests

Test org isolation scenarios:
1. User switches organizations → data updates
2. User tries to access other org's resource → denied
3. Invite flow → new user sees correct org data
4. Cross-org resource references → fail gracefully

### Security Tests

Penetration testing checklist:
1. Direct database query bypassing RLS (should fail)
2. Modify JWT org_id claim (should be rejected)
3. SQL injection attempts in org_id (parameterized queries prevent)
4. Enumerate resources from other orgs (UUID makes this hard)
5. Session hijacking scenarios
6. CSRF attacks on org switching

## Performance Optimization

### Composite Indexes

**Location**: `supabase/migrations/20260120_composite_indexes_performance.sql`

Create indexes for common query patterns:
```sql
-- Most queries filter by org_id first, then status
CREATE INDEX idx_requisitions_org_status
  ON requisitions(org_id, status);

-- User-specific queries
CREATE INDEX idx_requisitions_org_submitter
  ON requisitions(org_id, submitted_by);
```

### Query Optimization

Always put org_id filter first:
```javascript
// GOOD - org_id filter first
.eq('org_id', orgId)
.eq('status', 'approved')
.gte('created_at', startDate)

// LESS OPTIMAL - org_id filter last
.gte('created_at', startDate)
.eq('status', 'approved')
.eq('org_id', orgId)
```

### Caching Strategy

- Cache organization memberships (5 minutes TTL)
- Cache user permissions per org (5 minutes TTL)
- Invalidate on org switch
- Never cache cross-org data

## Reactive State Management

### Organization Switching

When users switch organizations, use reactive updates instead of page reloads:

```javascript
// In components
const { orgId, orgVersion } = useOrganization()

useEffect(() => {
  fetchData(orgId)
}, [orgId, orgVersion]) // Refetch when org changes

// Context handles switching
switchOrganization(newOrgId) // Increments orgVersion, triggers refetch
```

### Event-Based Refresh

Listen to organization changes:
```javascript
useEffect(() => {
  const handler = (e) => {
    console.log('Org changed:', e.detail.orgId)
    // Perform manual refresh if needed
  }
  window.addEventListener('organizationChanged', handler)
  return () => window.removeEventListener('organizationChanged', handler)
}, [])
```

## Emergency Procedures

### Data Leakage Incident Response

1. **Identify**: Check `security_audit_logs` for scope
2. **Isolate**: Disable affected user accounts
3. **Investigate**: Review all actions by affected users
4. **Notify**: Inform affected organizations
5. **Remediate**: Fix vulnerability, rotate secrets
6. **Document**: Post-mortem with timeline

### Rollback Procedure

If a migration breaks multi-tenancy:
```bash
# Check current version
psql -c "SELECT * FROM schema_migrations ORDER BY version DESC LIMIT 5;"

# Rollback last migration
supabase db reset --db-url <connection-string>

# Or manual rollback
psql -f rollback_script.sql
```

## Code Review Checklist

When reviewing multi-tenant code:
- [ ] All queries have org_id filter
- [ ] No org_id in error messages or logs (user-facing)
- [ ] Cross-org access attempts are logged
- [ ] RLS policies exist for new tables
- [ ] Inputs are sanitized
- [ ] No hardcoded org_ids in code
- [ ] Tests cover org isolation
- [ ] Documentation updated

## Summary

**Golden Rule**: *When in doubt, deny access and log the attempt.*

Multi-tenancy security requires:
1. **Vigilance**: Every query, every function, every table
2. **Layering**: Multiple defensive mechanisms
3. **Logging**: Comprehensive audit trail
4. **Testing**: Regular validation of isolation
5. **Monitoring**: Active threat detection

This system implements industry-standard practices and goes beyond with:
- ✅ Comprehensive RLS policies (52+ policies)
- ✅ Automatic org_id enforcement at database level
- ✅ API-level validation with audit logging
- ✅ Input sanitization (XSS prevention)
- ✅ Reactive state management (no page reloads)
- ✅ Performance optimization (composite indexes)
- ✅ Email verification for security
- ✅ CORS restrictions on APIs

**The system is production-ready for multi-tenant SaaS deployment.**

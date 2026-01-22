# 30-DAY ACTION PLAN - PCM Requisition System
**Created:** January 22, 2026 | **Target Completion:** February 22, 2026

---

## 📋 OVERVIEW

This document provides a detailed sprint plan to address the findings from the Senior Review. The plan is organized into 4 weekly milestones with specific, actionable items.

---

## 🎯 SPRINT GOALS

| Goal | Current | Target | Timeline |
|------|---------|--------|----------|
| Deploy Multi-Tenancy | ⏳ Ready | ✅ Active | Week 1 |
| Test Coverage | 37% | 50% | Week 2 |
| Component Refactoring | 3x large files | 0 oversized | Week 2 |
| Performance Optimization | 8/10 | 9/10 | Week 3 |
| Test Coverage | 50% | 70% | Week 4 |
| Security Hardening | 7.5/10 | 8.5/10 | Week 4 |

---

## 📅 WEEK 1: STABILIZE & DEPLOY (Jan 22-28)

### Goal: Deploy Multi-Tenancy to Production

#### Task 1.1: Deploy Multi-Tenancy Migration 🔴 CRITICAL
**Owner:** Backend Lead  
**Effort:** 2-3 hours  
**Risk:** MEDIUM

**Deliverables:**
- [ ] Backup production database (automated)
- [ ] Review migration: `20250112_10_multi_tenancy.sql`
- [ ] Execute: `20250113_01_multi_tenancy_fixed.sql`
- [ ] Execute: `20260120_critical_rls_policies_write_operations.sql`
- [ ] Execute: `20260120_org_id_null_check.sql`
- [ ] Verify org_id on all tables
- [ ] Run integration test suite
- [ ] Monitor Sentry for 24 hours
- [ ] Document rollback procedure

**Pre-Deployment Checklist:**
```sql
-- Verify database state BEFORE deployment
SELECT COUNT(DISTINCT org_id) FROM requisitions WHERE org_id IS NULL;
-- Should return: 0

SELECT column_name FROM information_schema.columns 
WHERE table_name = 'organizations' 
AND column_name = 'id';
-- Should return: organizations table exists

SELECT COUNT(*) FROM pg_policies 
WHERE tablename IN ('requisitions', 'projects', 'users')
AND policyname LIKE '%org%';
-- Should return: > 20 policies
```

**Post-Deployment Checklist:**
```sql
-- Verify database state AFTER deployment
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'requisitions' 
ORDER BY ordinal_position;
-- org_id should be present

SELECT COUNT(*) FROM pg_indexes 
WHERE tablename IN ('requisitions', 'projects')
AND indexname LIKE '%org%';
-- Should return: > 5 indexes on org tables
```

**Success Criteria:**
- ✅ All migrations executed without errors
- ✅ org_id on requisitions, projects, users tables
- ✅ Integration tests pass (cross-org access prevented)
- ✅ Zero data loss
- ✅ Zero 5xx errors in Sentry for 24 hours

---

#### Task 1.2: Integration Testing - Multi-Tenancy 🟡 HIGH
**Owner:** QA Lead  
**Effort:** 3-4 hours  
**Risk:** LOW

**Test Cases:**
```bash
# Run multi-tenancy integration tests
npm run test:integration

# Expected output:
✓ Organization Isolation
  ✓ should prevent cross-org project access
  ✓ should prevent cross-org requisition access
  ✓ should prevent cross-org item access
  ✓ should prevent cross-org expense account access

✓ RLS Policy Enforcement
  ✓ should enforce SELECT policies
  ✓ should enforce UPDATE policies
  ✓ should enforce DELETE policies

✓ Audit Logging
  ✓ should log cross-org access attempts
  ✓ should track critical security events

✓ Data Integrity
  ✓ should prevent NULL org_id insertions
  ✓ should auto-set org_id from context

✓ Index Performance
  ✓ should have composite indexes for common queries
```

**Success Criteria:**
- ✅ All 15+ integration tests pass
- ✅ No cross-org data access possible
- ✅ Performance within acceptable range (<300ms)

---

#### Task 1.3: Production Monitoring Setup 🟡 HIGH
**Owner:** DevOps Lead  
**Effort:** 2-3 hours  
**Risk:** LOW

**Configuration:**
```javascript
// Sentry alerts for multi-tenancy issues
Sentry.captureMessage('Cross-org access attempt detected', 'warning', {
  tags: {
    type: 'security',
    severity: 'high',
  },
})

// Check audit logs for any violations
SELECT user_id, org_id, action, COUNT(*) as attempts
FROM audit_logs
WHERE action = 'CROSS_ORG_ATTEMPT'
GROUP BY user_id, org_id, action
HAVING COUNT(*) > 0;
```

**Success Criteria:**
- ✅ Sentry configured for multi-tenancy events
- ✅ Alert threshold: 1 cross-org attempt = immediate alert
- ✅ Monitoring dashboard updated

---

#### Task 1.4: Documentation Update
**Owner:** Tech Lead  
**Effort:** 1-2 hours  
**Risk:** NONE

**Deliverables:**
- [ ] Update README.md with multi-tenancy status
- [ ] Create deployment log entry
- [ ] Update PRODUCTION_VERIFICATION.md
- [ ] Update RUNBOOK.md with multi-tenancy checks

---

### Week 1 Summary
**Status:** ✅ Ready for Week 2  
**Estimated Effort:** 10-12 hours  
**Team:** 2-3 people

---

## 📅 WEEK 2: QUALITY & REFACTORING (Jan 29 - Feb 4)

### Goal: Refactor Large Components & Add Unit Tests

#### Task 2.1: Refactor CreateRequisition Component 🔴 CRITICAL
**Owner:** Frontend Lead  
**Effort:** 8-10 hours  
**Risk:** MEDIUM (feature-critical)

**Step-by-step:**

1. **Create RequisitionMetadataForm component** (2h)
```javascript
// components/requisitions/RequisitionMetadataForm.jsx
import React from 'react'
import PropTypes from 'prop-types'
import { useProjects } from '../../hooks/useProjects'

export function RequisitionMetadataForm({ data, onChange, errors, disabled }) {
  const { projects, loading } = useProjects()
  
  return (
    <div className="space-y-4">
      {/* Metadata form fields */}
    </div>
  )
}

RequisitionMetadataForm.propTypes = {
  data: PropTypes.shape({
    requisition_number: PropTypes.string,
    project_id: PropTypes.string,
    description: PropTypes.string,
  }).isRequired,
  onChange: PropTypes.func.isRequired,
  errors: PropTypes.object,
  disabled: PropTypes.bool,
}

RequisitionMetadataForm.defaultProps = {
  errors: {},
  disabled: false,
}
```

2. **Create RequisitionLineItems component** (2-3h)
```javascript
// components/requisitions/RequisitionLineItems.jsx
import React from 'react'
import PropTypes from 'prop-types'
import LineItemRow from './LineItemRow'

export function RequisitionLineItems({ items, onChange, errors, disabled }) {
  const addItem = () => {
    const newItem = { id: generateId(), item_name: '', quantity: 1 }
    onChange([...items, newItem])
  }
  
  const removeItem = (itemId) => {
    onChange(items.filter(i => i.id !== itemId))
  }
  
  return (
    <div>
      {items.map((item, idx) => (
        <LineItemRow
          key={item.id}
          item={item}
          onChange={(updated) => updateItem(idx, updated)}
          onRemove={() => removeItem(item.id)}
          errors={errors[item.id]}
          disabled={disabled}
        />
      ))}
      <button onClick={addItem}>Add Item</button>
    </div>
  )
}

RequisitionLineItems.propTypes = {
  items: PropTypes.arrayOf(PropTypes.object).isRequired,
  onChange: PropTypes.func.isRequired,
  errors: PropTypes.object,
  disabled: PropTypes.bool,
}
```

3. **Create custom hook useRequisitionForm** (2h)
```javascript
// hooks/useRequisitionForm.js
import { useState, useCallback } from 'react'
import { requisitionService } from '../services/api/requisitions'

export function useRequisitionForm(initialData = null) {
  const [formData, setFormData] = useState(initialData || {})
  const [items, setItems] = useState([])
  const [approvals, setApprovals] = useState([])
  const [errors, setErrors] = useState({})
  const [loading, setLoading] = useState(false)
  
  const handleMetadataChange = useCallback((field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }, [])
  
  const handleItemsChange = useCallback((newItems) => {
    setItems(newItems)
  }, [])
  
  const handleSubmit = useCallback(async () => {
    try {
      setLoading(true)
      // Validation
      const validation = validateForm(formData, items, approvals)
      if (!validation.valid) {
        setErrors(validation.errors)
        return
      }
      
      // Submit
      await requisitionService.create({
        ...formData,
        items,
        approvals,
      })
    } catch (error) {
      setErrors({ submit: error.message })
    } finally {
      setLoading(false)
    }
  }, [formData, items, approvals])
  
  return {
    formData,
    items,
    approvals,
    errors,
    loading,
    handlers: {
      handleMetadataChange,
      handleItemsChange,
      handleSubmit,
    },
  }
}
```

4. **Update CreateRequisition to use new components** (2h)
```javascript
// pages/requisitions/CreateRequisition.jsx
import React from 'react'
import { useRequisitionForm } from '../../hooks/useRequisitionForm'
import RequisitionMetadataForm from '../../components/requisitions/RequisitionMetadataForm'
import RequisitionLineItems from '../../components/requisitions/RequisitionLineItems'
import ApprovalWorkflowConfig from '../../components/requisitions/ApprovalWorkflowConfig'

export default function CreateRequisition() {
  const { formData, items, approvals, errors, loading, handlers } = useRequisitionForm()
  
  return (
    <div className="space-y-6">
      <h1>Create Requisition</h1>
      
      <RequisitionMetadataForm
        data={formData}
        onChange={handlers.handleMetadataChange}
        errors={errors}
      />
      
      <RequisitionLineItems
        items={items}
        onChange={handlers.handleItemsChange}
        errors={errors}
      />
      
      <ApprovalWorkflowConfig
        approvals={approvals}
        onChange={handlers.handleApprovalsChange}
        errors={errors}
      />
      
      <button
        onClick={handlers.handleSubmit}
        disabled={loading}
        className="btn-primary"
      >
        {loading ? 'Creating...' : 'Create Requisition'}
      </button>
    </div>
  )
}
```

**Testing the refactor:**
```bash
# Verify functionality still works
npm run dev
# Manually test:
# 1. Create new requisition
# 2. Add multiple line items
# 3. Submit successfully
# 4. Verify in database
```

**Success Criteria:**
- ✅ CreateRequisition < 300 lines
- ✅ All sub-components < 250 lines
- ✅ No functionality changes
- ✅ Form submission works end-to-end
- ✅ Error handling preserved

---

#### Task 2.2: Add Unit Tests for Components 🟡 HIGH
**Owner:** QA Lead  
**Effort:** 6-8 hours  
**Risk:** LOW

**Test files to create:**
```javascript
// Test count: ~30 tests
client/src/components/requisitions/__tests__/
├── RequisitionMetadataForm.test.js (8 tests)
├── RequisitionLineItems.test.js (8 tests)
├── ApprovalWorkflowConfig.test.js (6 tests)
└── LineItemRow.test.js (8 tests)

client/src/hooks/__tests__/
├── useRequisitionForm.test.js (10 tests)
└── useAsync.test.js (8 tests)

client/src/services/api/__tests__/
├── requisitions.test.js (12 tests)
└── projects.test.js (10 tests)
```

**Example test structure:**
```javascript
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RequisitionMetadataForm } from '../RequisitionMetadataForm'
import * as projectsAPI from '../../../services/api/projects'

jest.mock('../../../services/api/projects')

describe('RequisitionMetadataForm', () => {
  const mockData = {
    requisition_number: '',
    project_id: '',
    description: '',
  }
  
  const mockOnChange = jest.fn()
  
  it('should render all required fields', () => {
    render(
      <RequisitionMetadataForm 
        data={mockData}
        onChange={mockOnChange}
      />
    )
    
    expect(screen.getByLabelText(/requisition number/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/project/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/description/i)).toBeInTheDocument()
  })
  
  it('should call onChange when field is updated', async () => {
    render(
      <RequisitionMetadataForm
        data={mockData}
        onChange={mockOnChange}
      />
    )
    
    const input = screen.getByLabelText(/description/i)
    await userEvent.type(input, 'Test description')
    
    expect(mockOnChange).toHaveBeenCalledWith('description', 'Test description')
  })
  
  // ... more tests
})
```

**Running tests:**
```bash
npm run test                    # Run all tests
npm run test:coverage          # Generate coverage
npm run test:watch             # Watch mode for TDD
npm run test:ui                # Visual test runner
```

**Success Criteria:**
- ✅ 30+ new unit tests added
- ✅ All tests pass
- ✅ Test coverage increases 37% → 50%
- ✅ All critical paths tested

---

#### Task 2.3: Fix console.log in OrganizationContext 🟡 MEDIUM
**Owner:** Frontend Lead  
**Effort:** 0.5 hours  
**Risk:** NONE

**Current Code:**
```javascript
// client/src/context/OrganizationContext.jsx:25
const handler = (e) => { console.log('Org changed to:', e.detail.orgId) }
```

**Fixed Code:**
```javascript
const handler = (e) => { logger.debug('Org changed to:', e.detail.orgId) }
```

**Testing:**
```bash
# Verify no console output in production build
npm run build
# Check dist/index.html - should have no console statements
```

---

#### Task 2.4: Add React.memo to List Components 🟡 MEDIUM
**Owner:** Frontend Lead  
**Effort:** 2-3 hours  
**Risk:** LOW

**Files to update:**
```javascript
// client/src/pages/requisitions/RequisitionsList.jsx
export default React.memo(function RequisitionsList() {
  // ... component code
})

// client/src/components/requisitions/RequisitionTable.jsx
export default React.memo(function RequisitionTable({ items }) {
  // ... component code
})

// client/src/components/requisitions/RequisitionRow.jsx
export default React.memo(function RequisitionRow({ data }) {
  // ... component code
})
```

**Testing:**
```bash
# Performance before/after
# Use React DevTools Profiler:
# 1. Open React DevTools
# 2. Go to Profiler tab
# 3. Record rendering
# 4. Should see fewer re-renders
```

---

### Week 2 Summary
**Status:** ✅ Ready for Week 3  
**Estimated Effort:** 18-20 hours  
**Team:** 2-3 people  
**Expected Coverage Increase:** 37% → 50%

---

## 📅 WEEK 3: PERFORMANCE & MONITORING (Feb 5-11)

### Goal: Optimize Performance & Add Monitoring

#### Task 3.1: Add Database Performance Indexes 🟡 HIGH
**Owner:** Database Admin  
**Effort:** 2-3 hours  
**Risk:** LOW

**Migration file to create:**
```sql
-- migrations/20260122_performance_indexes.sql

-- Composite index for pagination
CREATE INDEX idx_requisitions_org_created_desc 
  ON requisitions(org_id, created_at DESC)
  WHERE status != 'archived';

-- Index for filtering by status
CREATE INDEX idx_requisitions_org_status 
  ON requisitions(org_id, status, created_at DESC);

-- Index for approval workflow queries
CREATE INDEX idx_requisitions_org_approver
  ON requisitions(org_id, approver_user_id, status)
  WHERE status IN ('pending_approval', 'approved');

-- Index for reporting
CREATE INDEX idx_requisition_items_org_account
  ON requisition_items(org_id, expense_account_id, created_at);

-- Index for user assignments
CREATE INDEX idx_user_project_assignments_user_org
  ON user_project_assignments(user_id, org_id);

-- Index for project queries
CREATE INDEX idx_projects_org_status
  ON projects(org_id, status, created_at DESC);
```

**Testing performance:**
```sql
-- Before index creation
EXPLAIN ANALYZE
SELECT * FROM requisitions 
WHERE org_id = 'org-123' 
ORDER BY created_at DESC 
LIMIT 50;
-- Expected: Sequential scan (slow)

-- After index creation
EXPLAIN ANALYZE
SELECT * FROM requisitions 
WHERE org_id = 'org-123' 
ORDER BY created_at DESC 
LIMIT 50;
-- Expected: Index scan (fast)
```

**Success Criteria:**
- ✅ Query response times < 100ms (down from 150-300ms)
- ✅ No sequential scans on core queries
- ✅ Index size acceptable

---

#### Task 3.2: Setup Uptime Monitoring 🟡 HIGH
**Owner:** DevOps Lead  
**Effort:** 1-2 hours  
**Risk:** NONE

**Configuration:**
1. **UptimeRobot Setup**
   - Service: https://uptimerobot.com/
   - Add monitor: https://requisition-workflow.vercel.app
   - Check interval: Every 5 minutes
   - Alert: Email + Slack
   - Success: HTTP 200

2. **Health Check Endpoint** (backend)
```javascript
// Create health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    database: 'connected',
  })
})
```

3. **Performance Monitoring** (Vercel)
   - Enable Core Web Vitals monitoring
   - Set alerts for:
     - FCP > 2s
     - LCP > 4s
     - CLS > 0.1

---

#### Task 3.3: Create Grafana Dashboard 🟡 HIGH
**Owner:** DevOps Lead  
**Effort:** 3-4 hours  
**Risk:** LOW

**Metrics to track:**
```
1. API Metrics
   - Requests per minute
   - Response time (p50, p95, p99)
   - Error rate (5xx, 4xx)
   - Rate limit hits

2. Database Metrics
   - Query execution time
   - Connection pool usage
   - Slow query logs
   - RLS policy execution time

3. Security Metrics
   - Failed login attempts
   - Cross-org access attempts
   - Rate limit violations
   - Audit log volume

4. Application Metrics
   - User sessions
   - Active organizations
   - Requisitions created/day
   - API errors
```

**Setup steps:**
1. Connect Grafana to Supabase metrics
2. Create dashboard with above metrics
3. Set alert thresholds
4. Configure Slack notifications

---

#### Task 3.4: Add useMemo Optimization 🟡 MEDIUM
**Owner:** Frontend Lead  
**Effort:** 2-3 hours  
**Risk:** LOW

**Files to optimize:**
```javascript
// pages/reports/ReportsEnhanced.jsx
const filteredData = useMemo(() => {
  return requisitions.filter(r => r.status === filter)
}, [requisitions, filter])

// pages/requisitions/RequisitionsList.jsx
const sortedRequisitions = useMemo(() => {
  return [...requisitions].sort((a, b) => {
    return new Date(b.created_at) - new Date(a.created_at)
  })
}, [requisitions])

// components/common/Pagination.jsx
const pageData = useMemo(() => {
  const start = (currentPage - 1) * pageSize
  return data.slice(start, start + pageSize)
}, [data, currentPage, pageSize])
```

**Performance testing:**
```javascript
// Use React DevTools Profiler
// Record before/after
// Should see 20-30% reduction in render time
```

---

#### Task 3.5: Add 20+ More Unit Tests 🟡 HIGH
**Owner:** QA Lead  
**Effort:** 6-8 hours  
**Risk:** LOW

**Target coverage:**
- Service tests: +10 tests
- Hook tests: +5 tests
- Utility tests: +5 tests
- Total: 20+ tests
- Expected result: 50% → 65% coverage

---

### Week 3 Summary
**Status:** ✅ Ready for Week 4  
**Estimated Effort:** 15-18 hours  
**Team:** 2 people  
**Expected Coverage:** 50% → 65%

---

## 📅 WEEK 4: HARDENING & DOCUMENTATION (Feb 12-18)

### Goal: Security Hardening & Documentation

#### Task 4.1: Add MFA for Admin Accounts 🔴 CRITICAL
**Owner:** Backend Lead  
**Effort:** 8-10 hours  
**Risk:** MEDIUM

**Database Schema:**
```sql
CREATE TABLE IF NOT EXISTS mfa_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  org_id UUID NOT NULL,
  totp_enabled BOOLEAN DEFAULT false,
  backup_codes TEXT[] DEFAULT NULL,
  last_used_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, org_id),
  INDEX (user_id, org_id)
);

CREATE TABLE IF NOT EXISTS mfa_backup_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  code_hash TEXT NOT NULL,
  used BOOLEAN DEFAULT false,
  used_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS login_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  email VARCHAR(255),
  success BOOLEAN NOT NULL,
  ip_address INET,
  user_agent TEXT,
  attempted_at TIMESTAMP DEFAULT NOW(),
  INDEX (email, attempted_at),
  INDEX (ip_address, attempted_at)
);
```

**Frontend Implementation:**
```javascript
// pages/settings/MFASetup.jsx
export function MFASetup() {
  const [showQRCode, setShowQRCode] = useState(false)
  const [backupCodes, setBackupCodes] = useState([])
  
  const handleEnableMFA = async () => {
    // Generate TOTP secret
    const secret = generateTOTPSecret()
    const qrCode = generateQRCode(secret)
    
    setShowQRCode(true)
    // Display QR code for scanning
    
    // Generate backup codes
    const codes = generateBackupCodes(10)
    setBackupCodes(codes)
  }
  
  return (
    <div>
      <h2>Enable Multi-Factor Authentication</h2>
      {showQRCode && (
        <>
          <img src={qrCode} alt="MFA Setup" />
          <p>Scan this QR code with your authenticator app</p>
          <input type="text" placeholder="Enter 6-digit code" />
          <button>Verify & Enable</button>
          <div>
            <h3>Backup Codes</h3>
            {backupCodes.map(code => (
              <code key={code}>{code}</code>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
```

**Success Criteria:**
- ✅ MFA required for admin/owner accounts
- ✅ TOTP configuration works
- ✅ Backup codes generated
- ✅ Failed attempts logged
- ✅ Account lockout after 5 failed attempts

---

#### Task 4.2: Implement Brute Force Protection 🟡 HIGH
**Owner:** Backend Lead  
**Effort:** 3-4 hours  
**Risk:** LOW

**Implementation:**
```sql
-- Function to check login attempts
CREATE OR REPLACE FUNCTION check_login_attempts(p_email VARCHAR)
RETURNS TABLE (
  attempts_last_hour INT,
  is_locked BOOLEAN,
  minutes_until_unlock INT
) AS $$
DECLARE
  v_attempts INT;
  v_locked_until TIMESTAMP;
BEGIN
  -- Count attempts in last hour
  SELECT COUNT(*) INTO v_attempts
  FROM login_attempts
  WHERE email = p_email
    AND attempted_at > NOW() - INTERVAL '1 hour'
    AND success = false;
  
  -- Check if account is locked
  SELECT COUNT(*) INTO v_locked_until
  FROM auth.users
  WHERE email = p_email
    AND locked_until > NOW();
  
  RETURN QUERY SELECT
    v_attempts,
    v_locked_until > NOW(),
    EXTRACT(EPOCH FROM (v_locked_until - NOW())) / 60;
END;
$$ LANGUAGE plpgsql;

-- Lock account after 5 failed attempts
CREATE OR REPLACE FUNCTION lock_account_on_failed_attempts()
RETURNS VOID AS $$
DECLARE
  v_email VARCHAR;
BEGIN
  FOR v_email IN
    SELECT email FROM login_attempts
    WHERE attempted_at > NOW() - INTERVAL '1 hour'
      AND success = false
    GROUP BY email
    HAVING COUNT(*) >= 5
  LOOP
    UPDATE auth.users
    SET locked_until = NOW() + INTERVAL '30 minutes'
    WHERE email = v_email;
  END LOOP;
END;
$$ LANGUAGE plpgsql;
```

---

#### Task 4.3: Create Operational Runbook 🟡 HIGH
**Owner:** DevOps Lead  
**Effort:** 3-4 hours  
**Risk:** NONE

**Document structure:**
```markdown
# PCM Requisition System - Operational Runbook

## Quick Reference

### Common Tasks
- Reset user password
- Clear cache
- Restart services
- Emergency shutdown

### Monitoring
- Check system health
- View error logs
- Monitor database load
- Check uptime status

### Incident Response
- Handle database failures
- Handle email service failures
- Handle authentication issues
- Handle API rate limiting

### Data Management
- Database backup/restore
- User data export
- Audit log export
- Clean up old data
```

---

#### Task 4.4: Update CSP Headers 🟡 MEDIUM
**Owner:** Frontend Lead  
**Effort:** 1-2 hours  
**Risk:** LOW

**Current vercel.json:**
```json
{
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        {
          "key": "Content-Security-Policy",
          "value": "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self'; connect-src 'self' https://*.supabase.co https://o4508358952747008.ingest.us.sentry.io; frame-ancestors 'none';"
        }
      ]
    }
  ]
}
```

**Improved (stricter):**
```json
{
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        {
          "key": "Content-Security-Policy",
          "value": "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self'; connect-src 'self' https://*.supabase.co https://o4508358952747008.ingest.us.sentry.io; frame-ancestors 'none'; object-src 'none'; base-uri 'self';"
        },
        {
          "key": "X-Content-Type-Options",
          "value": "nosniff"
        },
        {
          "key": "X-Frame-Options",
          "value": "DENY"
        },
        {
          "key": "X-XSS-Protection",
          "value": "1; mode=block"
        }
      ]
    }
  ]
}
```

---

#### Task 4.5: Complete Test Coverage to 70% 🟡 HIGH
**Owner:** QA Lead  
**Effort:** 8-10 hours  
**Risk:** LOW

**Target tests:**
- Add 15+ page component tests
- Add 10+ integration tests
- Add 5+ E2E test scenarios
- Total: 70%+ coverage

**Running final coverage:**
```bash
npm run test:coverage
# Should output:
# Statements   : 70% ( 350/500 )
# Branches     : 68% ( 270/400 )
# Functions    : 72% ( 180/250 )
# Lines        : 70% ( 350/500 )
```

---

#### Task 4.6: Create Architecture Decision Records (ADRs)
**Owner:** Tech Lead  
**Effort:** 2-3 hours  
**Risk:** NONE

**ADRs to create:**
```markdown
# Architecture Decision Records

## ADR-001: Multi-Tenancy via Row-Level Security
- Decision: Use PostgreSQL RLS for multi-tenancy
- Rationale: Built-in, performant, secure by default
- Consequences: Org-id required on all tables

## ADR-002: Context API for State Management
- Decision: Use React Context API instead of Redux
- Rationale: Simple for this use case, less boilerplate
- Consequences: Limited to org/auth/notifications state

## ADR-003: Lazy Loading Strategy
- Decision: Lazy load all pages except Login/Dashboard
- Rationale: Reduce initial bundle size
- Consequences: Slightly slower page transitions

## ADR-004: Service Layer Pattern
- Decision: Centralized API calls in service modules
- Rationale: Testable, reusable, single source of truth
- Consequences: All API calls go through services
```

---

### Week 4 Summary
**Status:** ✅ SPRINT COMPLETE  
**Estimated Effort:** 20-25 hours  
**Team:** 3-4 people  
**Expected Final Coverage:** 70%+

---

## 🎯 30-DAY RESULTS

### Before (Day 1)
```
Test Coverage: 37%
Component Sizes: CreateRequisition 723 lines
Performance: 8/10
Security: 7.5/10
Monitoring: Basic
Documentation: Good
```

### After (Day 30)
```
Test Coverage: 70%+
Component Sizes: All < 300 lines
Performance: 9/10
Security: 8.5/10
Monitoring: Comprehensive
Documentation: Excellent + ADRs
```

---

## 📊 EFFORT SUMMARY

| Week | Tasks | Hours | Team |
|------|-------|-------|------|
| 1 | Deploy, test, monitor | 10-12 | 2-3 |
| 2 | Refactor, unit tests | 18-20 | 2-3 |
| 3 | Performance, monitoring | 15-18 | 2 |
| 4 | Security, docs, coverage | 20-25 | 3-4 |
| **TOTAL** | **30+ items** | **63-75h** | **Peak: 4 people** |

---

## ✅ SUCCESS CRITERIA

All items must be completed by February 22, 2026:
- [ ] Multi-tenancy deployed to production
- [ ] 70%+ test coverage achieved
- [ ] All large components refactored
- [ ] Performance optimized (8/10 → 9/10)
- [ ] Security hardened (7.5/10 → 8.5/10)
- [ ] Monitoring implemented
- [ ] Runbook created
- [ ] ADRs documented

---

**Status: READY FOR EXECUTION** ✅

*For detailed code review, see: [CODE_REVIEW_DETAILED.md](CODE_REVIEW_DETAILED.md)*  
*For full senior review, see: [SENIOR_REVIEW_JANUARY_2026.md](SENIOR_REVIEW_JANUARY_2026.md)*

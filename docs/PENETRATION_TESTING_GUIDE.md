# Penetration Testing Guide
# The Requisition Workflow System

**Date**: January 20, 2026
**Purpose**: Guide for conducting security penetration testing
**Audience**: Security teams, DevOps, System administrators

---

## Overview

This guide provides a comprehensive framework for penetration testing the multi-tenant Requisition Workflow System to validate security controls and identify potential vulnerabilities.

---

## Testing Scope

### In-Scope Components

**1. Multi-Tenant Isolation**
- Organization data segregation
- Cross-org access prevention
- RLS policy effectiveness
- API authorization

**2. Authentication & Authorization**
- Email verification flow
- Password security
- Session management
- Role-based access control

**3. Input Validation**
- XSS prevention
- SQL injection resistance
- Input sanitization
- File upload security

**4. API Security**
- Rate limiting
- CORS policies
- Error handling
- Data exposure

**5. Data Protection**
- Encryption in transit (TLS)
- Encryption at rest
- Sensitive data handling
- Audit logging

### Out-of-Scope

- Physical security
- Social engineering
- DoS attacks (DDoS simulation requires permission)
- Third-party services (Supabase infrastructure)

---

## Pre-Testing Requirements

### 1. Authorization

Before conducting penetration testing:

- [ ] Get written authorization from system owner
- [ ] Define testing window (recommended: non-business hours)
- [ ] Notify all stakeholders
- [ ] Set up test environment (staging/dedicated test instance)
- [ ] Establish emergency contact procedures

### 2. Test Environment Setup

**Option A: Use Staging Environment** (Recommended)
```bash
# Deploy to staging with production-like data
supabase link --project-ref <staging-project>
supabase db push
```

**Option B: Create Test Organizations**
```sql
-- Create isolated test organizations
INSERT INTO organizations (name, slug, email, status, plan)
VALUES
  ('Pentest Org A', 'pentest-org-a', 'pentest-a@test.com', 'active', 'free'),
  ('Pentest Org B', 'pentest-org-b', 'pentest-b@test.com', 'active', 'free');
```

### 3. Tools Required

**Recommended Testing Tools:**
- **Burp Suite** - Web application security testing
- **OWASP ZAP** - Automated vulnerability scanning
- **sqlmap** - SQL injection testing
- **Postman/cURL** - API testing
- **Browser DevTools** - Manual testing

**Installation:**
```bash
# Install OWASP ZAP
wget https://github.com/zaproxy/zaproxy/releases/download/v2.14.0/ZAP_2_14_0_unix.sh
chmod +x ZAP_2_14_0_unix.sh
./ZAP_2_14_0_unix.sh

# Install sqlmap
git clone --depth 1 https://github.com/sqlmapproject/sqlmap.git sqlmap-dev
```

---

## Test Cases

### 1. Multi-Tenant Isolation Tests

#### Test 1.1: Cross-Org Data Leakage
**Objective**: Verify users cannot access data from other organizations

**Steps**:
1. Create User A in Org A
2. Create User B in Org B
3. Authenticate as User A
4. Attempt to access User B's data via API
5. Try modifying URLs to access Org B resources

**Expected Result**: All attempts return 403 Forbidden or empty results

**Test Commands**:
```bash
# Login as User A (Org A)
curl -X POST https://your-domain/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user-a@org-a.com","password":"password"}'

# Save token
TOKEN_A="<token-from-response>"

# Try to access Org B's projects
curl https://your-domain/api/projects \
  -H "Authorization: Bearer $TOKEN_A" \
  -H "X-Organization-Id: <org-b-id>"  # Should fail

# Try to modify Org B project
curl -X PUT https://your-domain/api/projects/<org-b-project-id> \
  -H "Authorization: Bearer $TOKEN_A" \
  -d '{"name":"Hacked"}'  # Should fail
```

**Success Criteria**:
- ✅ No data from Org B returned
- ✅ Update/Delete operations fail
- ✅ Attempts logged in `security_audit_logs`

#### Test 1.2: Database RLS Policy Bypass
**Objective**: Attempt to bypass RLS policies via SQL injection

**Steps**:
1. Test all input fields for SQL injection
2. Attempt query manipulation
3. Try PostgreSQL-specific injection vectors

**Test Vectors**:
```
' OR '1'='1
'; DROP TABLE projects--
' UNION SELECT * FROM organizations--
'; SET ROLE postgres--
'; SET SESSION AUTHORIZATION postgres--
```

**Success Criteria**:
- ✅ All injection attempts fail
- ✅ Parameterized queries prevent injection
- ✅ No error messages leak database structure

#### Test 1.3: NULL org_id Injection
**Objective**: Attempt to create records with NULL org_id

**Test Commands**:
```bash
# Try to create project with NULL org_id
curl -X POST https://your-domain/api/projects \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"name":"Test","org_id":null}'

# Try to update existing project to NULL org_id
curl -X PUT https://your-domain/api/projects/<project-id> \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"org_id":null}'
```

**Success Criteria**:
- ✅ Requests rejected with error
- ✅ Trigger prevents NULL org_id
- ✅ Violation logged in audit logs

---

### 2. Authentication & Authorization Tests

#### Test 2.1: Broken Authentication
**Objective**: Test authentication bypass techniques

**Test Scenarios**:
```bash
# Test 1: Weak password acceptance
curl -X POST https://your-domain/api/auth/signup \
  -d '{"email":"test@test.com","password":"123"}'  # Should fail (min 8 chars)

# Test 2: Missing email verification
curl -X POST https://your-domain/api/auth/login \
  -d '{"email":"unverified@test.com","password":"password123"}'  # Should fail

# Test 3: JWT token tampering
# Modify JWT payload and try to access API
# Should be rejected due to signature validation
```

**Success Criteria**:
- ✅ Weak passwords rejected
- ✅ Unverified emails cannot login
- ✅ Tampered JWTs rejected

#### Test 2.2: Session Management
**Objective**: Verify secure session handling

**Tests**:
1. Check JWT expiration
2. Test token refresh mechanism
3. Verify logout clears session
4. Test concurrent session handling

---

### 3. Input Validation Tests

#### Test 3.1: XSS (Cross-Site Scripting)
**Objective**: Attempt to inject malicious scripts

**Test Payloads**:
```javascript
<script>alert('XSS')</script>
<img src=x onerror=alert('XSS')>
javascript:alert('XSS')
<svg onload=alert('XSS')>
<iframe src="javascript:alert('XSS')">
```

**Test Locations**:
- Organization name
- Project name/description
- Requisition title/justification
- Comments
- File names

**Success Criteria**:
- ✅ All payloads encoded/sanitized
- ✅ No script execution in browser
- ✅ HTML special characters escaped

#### Test 3.2: File Upload Vulnerabilities
**Objective**: Test file upload security

**Test Cases**:
```bash
# Test 1: Upload executable file
curl -X POST https://your-domain/api/attachments \
  -F "file=@malicious.exe"  # Should fail

# Test 2: Upload oversized file
dd if=/dev/zero of=large.file bs=1M count=100  # 100MB
curl -X POST https://your-domain/api/attachments \
  -F "file=@large.file"  # Should fail if size limit enforced

# Test 3: Path traversal in filename
curl -X POST https://your-domain/api/attachments \
  -F "file=@test.txt;filename=../../../etc/passwd"  # Should sanitize
```

**Success Criteria**:
- ✅ Executable files rejected
- ✅ File size limits enforced
- ✅ Filenames sanitized

---

### 4. API Security Tests

#### Test 4.1: Rate Limiting
**Objective**: Verify rate limiting prevents abuse

**Test**:
```bash
# Rapid signup attempts from same IP
for i in {1..10}; do
  curl -X POST https://your-domain/api/auth/signup \
    -d "{\"email\":\"test$i@test.com\",\"password\":\"password123\"}"
done
```

**Success Criteria**:
- ✅ 6th attempt returns 429 Too Many Requests
- ✅ Retry-After header present
- ✅ Rate limit tracked in database

#### Test 4.2: CORS Policy
**Objective**: Verify CORS restrictions

**Test**:
```bash
# Attempt request from unauthorized origin
curl https://your-domain/api/projects \
  -H "Origin: https://evil-site.com" \
  -H "Authorization: Bearer $TOKEN"
```

**Success Criteria**:
- ✅ Only allowed origins accepted
- ✅ Credentials not exposed to unauthorized origins

---

### 5. Data Protection Tests

#### Test 5.1: Sensitive Data Exposure
**Objective**: Check for exposed sensitive information

**Test Checklist**:
- [ ] Error messages don't leak stack traces
- [ ] API responses don't include sensitive fields
- [ ] Database credentials not exposed
- [ ] JWT secrets not in client code
- [ ] No passwords in logs

**Test Commands**:
```bash
# Check for exposed secrets in responses
curl https://your-domain/api/config

# Trigger error and check response
curl https://your-domain/api/invalid-endpoint

# Check for verbose error messages
curl -X POST https://your-domain/api/projects \
  -d 'invalid json{{'
```

**Success Criteria**:
- ✅ Generic error messages only
- ✅ No database errors exposed
- ✅ No credentials in responses

---

## Automated Security Scanning

### OWASP ZAP Scan

```bash
# Start ZAP in daemon mode
zap.sh -daemon -port 8080 -config api.disablekey=true

# Run spider
curl "http://localhost:8080/JSON/spider/action/scan/?url=https://your-domain"

# Run active scan
curl "http://localhost:8080/JSON/ascan/action/scan/?url=https://your-domain"

# Generate HTML report
curl "http://localhost:8080/OTHER/core/other/htmlreport/" > zap-report.html
```

### SQL Injection Testing with sqlmap

```bash
# Test login endpoint
python sqlmap.py -u "https://your-domain/api/auth/login" \
  --data="email=test@test.com&password=test" \
  --level=5 --risk=3

# Test GET parameters
python sqlmap.py -u "https://your-domain/api/projects?id=1" \
  --cookie="session=<your-session-cookie>" \
  --level=3
```

---

## Test Report Template

### Executive Summary
- Testing period: [Date range]
- Tester: [Name/Organization]
- Environment: [Production/Staging]
- Tools used: [List]

### Findings Summary

| Severity | Count | Status |
|----------|-------|--------|
| Critical | 0 | ✅ |
| High | 0 | ✅ |
| Medium | X | ⚠️ |
| Low | X | ℹ️ |
| Info | X | ℹ️ |

### Detailed Findings

**Finding #1: [Title]**
- **Severity**: Critical/High/Medium/Low
- **Category**: [XSS/SQLi/Auth/etc.]
- **Description**: [What was found]
- **Impact**: [Potential consequences]
- **Reproduction Steps**:
  1. Step 1
  2. Step 2
- **Remediation**: [How to fix]
- **Status**: Open/Fixed/Accepted Risk

### Recommendations
1. [Recommendation 1]
2. [Recommendation 2]

---

## Post-Testing Actions

### 1. Cleanup Test Data
```sql
-- Remove test organizations
DELETE FROM projects WHERE org_id IN (
  SELECT id FROM organizations WHERE slug LIKE 'pentest-%'
);
DELETE FROM organizations WHERE slug LIKE 'pentest-%';

-- Clear test audit logs
DELETE FROM security_audit_logs
WHERE details::TEXT LIKE '%pentest%';
```

### 2. Review Findings
- Prioritize by severity
- Create remediation tickets
- Set fix deadlines
- Re-test after fixes

### 3. Update Documentation
- Document new vulnerabilities found
- Update security procedures
- Revise test cases
- Schedule next pentest

---

## Professional Penetration Testing Firms

If hiring external security firm:

**Recommended Firms** (check latest reviews):
- **HackerOne** - Bug bounty platform
- **Synack** - Crowdsourced security testing
- **Rapid7** - Penetration testing services
- **Bishop Fox** - Full-service security testing
- **Trail of Bits** - Advanced security audits

**What to Request**:
- Multi-tenant security focus
- Web application penetration test
- API security assessment
- OWASP Top 10 coverage
- Written report with remediation guidance

**Expected Cost**: $5,000 - $25,000 depending on scope

---

## Compliance Requirements

### SOC 2 Type II
Requires annual penetration testing with:
- Written scope and authorization
- Qualified testers (OSCP/CEH certified)
- Documented findings
- Remediation tracking

### PCI DSS
If processing payments:
- Quarterly vulnerability scans
- Annual penetration tests
- ASV-approved scanner

---

## Continuous Security Monitoring

### Daily Checks
```sql
-- Run security health check
SELECT * FROM check_security_alerts();
```

### Weekly Reviews
```sql
-- Generate weekly security report
SELECT * FROM generate_security_report(7);

-- Review critical events
SELECT * FROM security_critical_events;
```

### Monthly Actions
- Review all audit logs
- Update security policies
- Test disaster recovery
- Review user access

---

## Resources

**OWASP Testing Guide**:
https://owasp.org/www-project-web-security-testing-guide/

**OWASP Top 10**:
https://owasp.org/www-project-top-ten/

**CWE/SANS Top 25**:
https://cwe.mitre.org/top25/

**Penetration Testing Execution Standard**:
http://www.pentest-standard.org/

---

**Document Version**: 1.0
**Last Updated**: January 20, 2026
**Next Review**: Every 6 months or after major security changes

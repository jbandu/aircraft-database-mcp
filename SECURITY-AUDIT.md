# Security & Architecture Audit Report

**Date:** 2024-11-27
**Project:** Aircraft Database MCP Server
**Version:** 1.0.0

---

## Executive Summary

Comprehensive security and architecture review of the Aircraft Database MCP Server codebase. Overall assessment: **Good foundation with critical gaps that need addressing**.

**Risk Level:** 🟡 **MEDIUM** (Development ready, needs hardening for production)

---

## 1. Authentication & Authorization

### ✅ Strengths
- API key-based authentication implemented
- Support for database-backed API keys with bcrypt hashing
- Dual header support (X-API-Key and Authorization: Bearer)
- Rate limiting by API key/IP address

### ⚠️ Critical Issues
1. **Missing API_KEYS environment variable**
   - No default API keys configured in .env
   - Auth will fail for all requests in current state
   - **Risk:** HIGH - API completely inaccessible

2. **Missing api_keys table in database**
   - Schema references but table doesn't exist
   - Need migration script
   - **Risk:** HIGH - Database auth path will fail

3. **No role-based access control (RBAC)**
   - All API keys have same permissions
   - No read-only vs read-write distinction
   - **Risk:** MEDIUM - Potential privilege escalation

4. **No API key rotation mechanism**
   - Keys valid until expiry (if set)
   - No way to invalidate compromised keys except database DELETE
   - **Risk:** MEDIUM - Prolonged exposure if key leaks

### 🔧 Recommendations
- [ ] Add default API key to .env for development
- [ ] Create api_keys table migration
- [ ] Implement RBAC with permissions
- [ ] Add API key management endpoints (create, revoke, rotate)
- [ ] Add rate limiting per API key tier

---

## 2. SQL Injection Protection

### ✅ Strengths
- **All queries use parameterized statements** ✅
- PostgreSQL's `pg` library with proper parameter binding
- No string concatenation in queries observed

### ✅ Example (Good)
```typescript
// src/lib/db-clients.ts:139
await pool.query<T>(query, params);

// src/mcp-server/tools/get-airline-fleet.ts:150
WHERE a.current_airline_id = (
  SELECT id FROM airlines
  WHERE UPPER(iata_code) = UPPER($1) OR UPPER(icao_code) = UPPER($1)
  LIMIT 1
)
```

### ✅ Verdict
**NO SQL INJECTION VULNERABILITIES FOUND** 🎉

---

## 3. Input Validation & Sanitization

### ⚠️ Critical Issues

1. **Inconsistent validation across endpoints**
   - MCP tools use Zod schemas ✅
   - REST API routes have minimal validation ⚠️
   - Scraper inputs not validated ⚠️

2. **No input sanitization middleware**
   - XSS possible if data displayed in web UI
   - No HTML entity encoding
   - **Risk:** MEDIUM - XSS if building frontend

3. **Missing request body size limits per endpoint**
   - Global 10MB limit but not per-route
   - Could enable DoS with large payloads
   - **Risk:** LOW-MEDIUM

4. **No validation for file uploads**
   - Not currently implemented, but could be added
   - **Risk:** LOW (future concern)

### 🔧 Recommendations
- [ ] Create unified validation middleware using Zod
- [ ] Add input sanitization for all text fields
- [ ] Implement per-route body size limits
- [ ] Add content-type validation
- [ ] Validate all enum values strictly

---

## 4. Error Handling & Information Disclosure

### ⚠️ Issues Found

1. **Verbose error messages in production**
```typescript
// src/api/middleware/error-handler.ts
error: process.env.NODE_ENV === 'development' ? err.message : 'Internal Server Error',
```
- Still exposes `err.message` which might contain sensitive info
- **Risk:** LOW - Minor information disclosure

2. **Database errors exposed to client**
```typescript
// Multiple files
catch (error) {
  return {
    text: `Error: ${error instanceof Error ? error.message : String(error)}`
  };
}
```
- PostgreSQL error messages could reveal schema info
- **Risk:** MEDIUM - Schema information disclosure

3. **No error correlation IDs**
- Hard to trace errors across logs
- **Risk:** LOW - Operational issue

### 🔧 Recommendations
- [ ] Sanitize all error messages
- [ ] Add request ID tracking
- [ ] Implement error codes instead of messages
- [ ] Log full errors server-side only
- [ ] Create error response template

---

## 5. Secrets Management

### ⚠️ Critical Issues

1. **Secrets in .env file (not encrypted)**
   - API keys, database passwords in plaintext
   - Risk if .env committed to git (mitigated by .gitignore)
   - **Risk:** HIGH if deployed incorrectly

2. **No secret rotation strategy**
   - Database passwords static
   - No automated rotation
   - **Risk:** MEDIUM

3. **Claude API key in environment variables**
   - Should use secret management service
   - **Risk:** MEDIUM

4. **SSL disabled for database**
```typescript
// .env
POSTGRES_SSL=false
```
- Database traffic in plaintext
- **Risk:** HIGH for production

### 🔧 Recommendations
- [ ] Use secret management service (AWS Secrets Manager, Vault)
- [ ] Enable SSL for all database connections
- [ ] Implement secret rotation schedule
- [ ] Never commit .env to git (already protected ✅)
- [ ] Use environment-specific secrets

---

## 6. Rate Limiting & DoS Protection

### ✅ Strengths
- Token bucket rate limiter implemented ✅
- Variable costs per endpoint ✅
- Per-API-key and per-IP limiting ✅

### ⚠️ Issues

1. **Rate limits not persisted**
   - In-memory only (cleared on restart)
   - Can't enforce across multiple instances
   - **Risk:** MEDIUM for scaled deployments

2. **No distributed rate limiting**
   - Won't work with load balancer + multiple instances
   - **Risk:** HIGH for production scaling

3. **No slowloris protection**
   - Long-lived connections not limited
   - **Risk:** MEDIUM

4. **Scraper rate limiting**
   - 2-second delay between requests ✅
   - But concurrent limit (5) might overwhelm targets
   - **Risk:** LOW - Could get IP banned

### 🔧 Recommendations
- [ ] Use Redis for distributed rate limiting
- [ ] Add connection timeout middleware
- [ ] Implement request timeout (30s max)
- [ ] Add circuit breaker for external services
- [ ] Reduce scraper concurrent limit to 3

---

## 7. CORS & Security Headers

### ✅ Strengths
- Helmet.js security headers ✅
- CORS configured with allowed origins ✅

### ⚠️ Issues

1. **CORS allows credentials but origin validation weak**
```typescript
// src/api/server.ts:57
origin: this.getAllowedOrigins(),
credentials: true,
```
- `getAllowedOrigins()` not shown but could be `*`
- **Risk:** MEDIUM if misconfigured

2. **Missing security headers**
   - No `Strict-Transport-Security` for HTTPS enforcement
   - No `Content-Security-Policy`
   - **Risk:** LOW-MEDIUM

3. **API accessible from any origin in dev mode**
   - Expected for dev, dangerous for prod
   - **Risk:** MEDIUM if misconfigured

### 🔧 Recommendations
- [ ] Strict origin whitelist for production
- [ ] Add HSTS header (HTTPS only)
- [ ] Implement CSP header
- [ ] Add X-Frame-Options: DENY
- [ ] Environment-specific CORS config

---

## 8. Logging & Monitoring

### ✅ Strengths
- Winston logger implemented ✅
- Log levels configurable ✅
- Request logging middleware ✅

### ⚠️ Issues

1. **No audit logging for sensitive operations**
   - API key creation/deletion not logged
   - Data modifications not audited
   - **Risk:** HIGH - Can't detect malicious activity

2. **Logs might contain sensitive data**
   - API keys could be logged
   - Database passwords in error logs
   - **Risk:** MEDIUM

3. **No log rotation configured**
   - Logs will grow unbounded
   - **Risk:** LOW - Disk space exhaustion

4. **No centralized logging**
   - Hard to aggregate in production
   - **Risk:** LOW - Operational issue

### 🔧 Recommendations
- [ ] Implement audit log table
- [ ] Sanitize logs (redact secrets)
- [ ] Configure log rotation (winston-daily-rotate-file)
- [ ] Add structured logging with correlation IDs
- [ ] Integrate with centralized logging (ELK, Datadog)

---

## 9. Database Security

### ✅ Strengths
- Connection pooling configured ✅
- Parameterized queries throughout ✅
- Password hashing with bcrypt ✅

### ⚠️ Issues

1. **SSL disabled for PostgreSQL**
```bash
POSTGRES_SSL=false
```
- Database traffic unencrypted
- **Risk:** HIGH for production

2. **Database credentials in environment variables**
   - Not using IAM authentication
   - **Risk:** MEDIUM

3. **No row-level security (RLS)**
   - All authenticated users can access all data
   - **Risk:** LOW (by design?)

4. **Database connection string in logs**
   - Visible in error messages
   - **Risk:** MEDIUM

### 🔧 Recommendations
- [ ] Enable SSL for all database connections
- [ ] Use IAM authentication (AWS RDS, Cloud SQL)
- [ ] Implement row-level security if multi-tenant
- [ ] Redact connection strings from logs
- [ ] Use read replicas for heavy queries

---

## 10. Code Organization & Modularity

### ✅ Strengths
- Clean separation: MCP server, REST API, scrapers ✅
- Middleware pattern for cross-cutting concerns ✅
- Centralized logging and database clients ✅

### ⚠️ Improvements Needed

1. **No service layer**
   - Business logic mixed with route handlers
   - Hard to unit test
   - **Impact:** MEDIUM - Code reusability

2. **No repository pattern**
   - Database queries scattered across codebase
   - Hard to mock for testing
   - **Impact:** MEDIUM - Testability

3. **Missing dependency injection**
   - Tight coupling to global instances
   - Hard to test
   - **Impact:** LOW-MEDIUM

4. **No tests**
   - Zero test coverage
   - **Impact:** HIGH - Can't verify correctness

### 🔧 Recommendations
- [ ] Create service layer (AirlineService, AircraftService)
- [ ] Implement repository pattern (AirlineRepository)
- [ ] Add dependency injection container
- [ ] Write unit tests (Jest)
- [ ] Write integration tests
- [ ] Add E2E tests for critical flows

---

## 11. External Dependencies & Supply Chain

### ✅ Strengths
- Using well-maintained packages ✅
- Minimal dependency tree ✅

### ⚠️ Issues

1. **No dependency scanning**
   - Vulnerabilities not detected automatically
   - **Risk:** MEDIUM

2. **No package lock verification**
   - No integrity checking
   - **Risk:** LOW-MEDIUM

3. **Playwright downloaded browsers**
   - Large attack surface
   - **Risk:** LOW

### 🔧 Recommendations
- [ ] Add `npm audit` to CI pipeline
- [ ] Use Dependabot for auto-updates
- [ ] Enable package lock verification
- [ ] Consider Snyk or similar tool
- [ ] Pin Docker base image versions

---

## 12. Web Scraping Security

### ⚠️ Issues

1. **User agent reveals identity**
```bash
SCRAPER_USER_AGENT=Mozilla/5.0 (compatible; NumberLabs-AircraftBot/1.0)
```
- Easy to block/ban
- **Risk:** LOW - Operational issue

2. **No robots.txt checking**
   - Might violate site ToS
   - **Risk:** MEDIUM - Legal liability

3. **Headless browser fingerprinting**
   - Playwright can be detected
   - **Risk:** LOW - Might get blocked

4. **No proxy support**
   - Single IP can be rate limited
   - **Risk:** LOW

### 🔧 Recommendations
- [ ] Implement robots.txt checker
- [ ] Add proxy rotation
- [ ] Use stealth mode for Playwright
- [ ] Respect Retry-After headers
- [ ] Add backoff on 429/503 responses

---

## Priority Action Items

### 🔴 Critical (Fix Immediately)

1. **Create api_keys table and add default API key**
   - API currently non-functional

2. **Enable PostgreSQL SSL**
   - Database traffic unencrypted

3. **Add audit logging for sensitive operations**
   - Can't detect malicious activity

4. **Implement input validation middleware**
   - XSS and injection risks

### 🟡 High Priority (Fix Soon)

5. **Add role-based access control**
6. **Implement secret management**
7. **Add error sanitization**
8. **Write tests (unit + integration)**
9. **Add distributed rate limiting (Redis)**

### 🟢 Medium Priority (Roadmap)

10. **Implement service layer**
11. **Add dependency scanning**
12. **Implement log rotation**
13. **Add health check for all deps**
14. **Implement robots.txt checking**

---

## Security Score

| Category | Score | Status |
|----------|-------|--------|
| Authentication | 6/10 | 🟡 Needs work |
| SQL Injection | 10/10 | ✅ Excellent |
| Input Validation | 5/10 | 🟡 Needs work |
| Error Handling | 6/10 | 🟡 Needs work |
| Secrets Management | 4/10 | 🔴 Critical |
| Rate Limiting | 7/10 | 🟡 Good |
| CORS/Headers | 7/10 | 🟡 Good |
| Logging | 6/10 | 🟡 Needs work |
| Database Security | 5/10 | 🔴 Critical |
| Code Quality | 7/10 | 🟡 Good |
| Dependencies | 6/10 | 🟡 Needs work |
| Scraping | 6/10 | 🟡 Needs work |

**Overall Score: 6.3/10** 🟡

---

## Compliance Considerations

### GDPR (If applicable)
- [ ] Add data retention policies
- [ ] Implement right to be forgotten
- [ ] Add data export functionality
- [ ] Document data processing

### SOC 2 (If applicable)
- [ ] Add audit logging
- [ ] Implement access controls
- [ ] Add encryption at rest
- [ ] Document security policies

---

## Next Steps

See `SECURITY-IMPROVEMENTS.md` for detailed implementation plan.

---

**Reviewed by:** Claude (AI Assistant)
**Next Review:** After critical fixes implemented

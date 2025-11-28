# Railway Deployment Guide - Complete Checklist

**For: Claude Code + Railway + PostgreSQL Stack**

This guide captures lessons learned from deploying Node.js/TypeScript MCP servers and APIs to Railway. Every item here represents a real deployment blocker we encountered.

---

## 🚀 Quick Start Checklist

### Pre-Deployment

- [ ] **Port Configuration** (CRITICAL)
  ```typescript
  // ✅ CORRECT - Railway assigns PORT dynamically
  const port = parseInt(process.env.PORT || process.env.API_PORT || '3000', 10);

  // ❌ WRONG - Hardcoded port will fail
  const port = 3000;
  const port = parseInt(process.env.API_PORT || '3000', 10);
  ```

- [ ] **Database Connection String**
  - Use Railway's provided `POSTGRES_URL` or `DATABASE_URL`
  - Enable SSL: `POSTGRES_SSL=true`
  - Set reasonable timeouts: `connectionTimeoutMillis: 10000` (10s minimum)

- [ ] **Environment Variables**
  - Document ALL required env vars in `.env.example`
  - Never commit `.env` or `.env.railway` files
  - Add them to `.gitignore`

- [ ] **Build Configuration**
  - Verify `npm run build` works locally
  - Ensure build outputs to correct directory (usually `dist/`)
  - Test build with `NODE_ENV=production`

### Railway Configuration Files

#### 1. `railway.toml` (Required)

**For Development (Fast Iteration):**
```toml
[build]
builder = "NIXPACKS"  # Auto-detects Node.js, fastest

[deploy]
startCommand = "npm run start"
restartPolicyType = "ON_FAILURE"
restartPolicyMaxRetries = 10
# NO healthcheck during development

[services.variables]
NODE_ENV = "production"
```

**For Production (With Docker):**
```toml
[build]
builder = "DOCKERFILE"
dockerfilePath = "Dockerfile"

[deploy]
startCommand = "npm run start"
restartPolicyType = "ON_FAILURE"
restartPolicyMaxRetries = 10
# Add healthcheck only AFTER deployment works
# healthcheckPath = "/health"
# healthcheckTimeout = 10

[services.variables]
NODE_ENV = "production"
```

#### 2. `.dockerignore` (If using Docker)

```
node_modules
npm-debug.log
.env
.env.*
.git
.gitignore
README.md
.vscode
.idea
*.log
dist
build
coverage
.DS_Store
```

#### 3. Simple `Dockerfile` (Recommended for Development)

```dockerfile
FROM node:20
WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci

# Copy source and build
COPY . .
RUN npm run build

# Expose port (Railway ignores this, but good practice)
EXPOSE 3000

# Start app
CMD ["npm", "run", "start"]
```

---

## ⚠️ Critical Railway Gotchas

### 1. PORT Environment Variable (THE #1 BLOCKER)

**Problem:**
```typescript
// This WILL fail on Railway
const port = parseInt(process.env.API_PORT || '3000', 10);
```

**Why:** Railway assigns a dynamic `PORT` env var. Your app MUST use it, or Railway's proxy can't connect.

**Solution:**
```typescript
// Railway's PORT takes precedence
const port = parseInt(
  process.env.PORT ||        // Railway's dynamic port (REQUIRED)
  process.env.API_PORT ||    // Your custom env var (optional)
  '3000',                    // Local dev fallback
  10
);
```

**Symptom:** 502 Bad Gateway, "connection refused" in Railway logs

---

### 2. Healthcheck Timing Issues

**Problem:** Healthcheck starts before app is ready

**Railway Behavior:**
- Healthcheck starts immediately when container starts
- If healthcheck timeout is 10s and app takes 3s to start, you only get 7s of actual checking
- App can be running perfectly but healthcheck fails → deployment fails

**Solution for Development:**
```toml
# Comment out healthcheck entirely
# healthcheckPath = "/health"
# healthcheckTimeout = 10
```

**Solution for Production:**
- Add healthcheck ONLY after confirming app deploys successfully
- Use longer timeout: `healthcheckTimeout = 30`
- Ensure `/health` endpoint responds FAST (< 1 second)

---

### 3. Builder Selection (railway.toml)

**CRITICAL:** Railway ignores your Dockerfile unless explicitly configured

```toml
[build]
builder = "DOCKERFILE"      # Use Docker
dockerfilePath = "Dockerfile"

# NOT
builder = "NIXPACKS"        # Ignores Dockerfile entirely
```

**When to use each:**
- **NIXPACKS**: Development, fast iteration, simple Node.js apps
- **DOCKERFILE**: Production, multi-stage builds, custom dependencies

---

### 4. Database Connection Timeouts

**Problem:** Railway's managed Postgres can be slow to connect

```typescript
// ❌ TOO SHORT - Will timeout on Railway
const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  connectionTimeoutMillis: 2000,  // 2 seconds
});

// ✅ CORRECT - Accounts for network latency
const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  connectionTimeoutMillis: 10000,  // 10 seconds
  ssl: process.env.POSTGRES_SSL === 'true' ? { rejectUnauthorized: false } : false,
});
```

---

### 5. Table Name Mismatches

**Problem:** Development DB schema differs from production

**Prevention:**
1. Use migrations (Prisma, Drizzle, TypeORM)
2. Keep dev and prod schemas identical
3. Version control your schema

**Quick Fix (Not recommended for production):**
```bash
# Find all instances of wrong table name
grep -r "scraping_jobs" src/
# Replace
sed -i '' 's/scraping_jobs/scrape_jobs/g' src/**/*.ts
```

---

## 📋 Deployment Workflow

### First-Time Deployment

1. **Install Railway CLI**
   ```bash
   npm install -g @railway/cli
   railway login
   ```

2. **Link Project**
   ```bash
   cd your-project
   railway link  # Select your project
   ```

3. **Set Environment Variables**
   ```bash
   # Set one by one
   railway variables set POSTGRES_URL="postgresql://..."
   railway variables set API_KEYS="your-key"

   # Or view all
   railway variables
   ```

4. **Create railway.toml**
   ```toml
   [build]
   builder = "NIXPACKS"  # Start simple

   [deploy]
   startCommand = "npm run start"
   restartPolicyType = "ON_FAILURE"
   restartPolicyMaxRetries = 10
   ```

5. **Deploy**
   ```bash
   # Automatic (on git push)
   git push origin main

   # Manual (faster for testing)
   railway up --detach
   ```

6. **Monitor Deployment**
   ```bash
   # Check status
   railway status

   # Stream logs
   railway logs

   # Test internal health
   railway run -- curl http://localhost:3000/health
   ```

7. **Test Public URL**
   ```bash
   # Get your URL
   railway variables | grep RAILWAY_PUBLIC_DOMAIN

   # Test
   curl https://your-app.up.railway.app/health
   ```

---

## 🐛 Debugging Checklist

When deployment fails, check in this order:

### 1. Build Phase
- [ ] Does `npm run build` work locally?
- [ ] Are all dependencies in `package.json`?
- [ ] Is TypeScript compiling without errors?

### 2. Start Phase
- [ ] Does `npm start` work locally with `NODE_ENV=production`?
- [ ] Are you using the correct start command in `railway.toml`?
- [ ] Is your app listening on `process.env.PORT`?

### 3. Connection Phase
- [ ] 404 "Application not found" → Healthcheck failing or wrong port
- [ ] 502 "Failed to respond" → App crashed or wrong port
- [ ] 504 Gateway timeout → App too slow to start

### 4. Database Phase
- [ ] Can you connect to Railway Postgres locally?
  ```bash
  psql $POSTGRES_URL
  ```
- [ ] Is SSL enabled? (`POSTGRES_SSL=true`)
- [ ] Are migrations applied?

### 5. Railway-Specific
- [ ] Check Railway dashboard for deployment status
- [ ] View full logs in Railway web UI (CLI logs are limited)
- [ ] Verify env vars are set: `railway variables`

---

## 🏗️ Project Structure Best Practices

```
your-project/
├── src/
│   ├── api/
│   │   └── server.ts          # Express server
│   ├── mcp-server/
│   │   └── index.ts           # MCP stdio server
│   └── lib/
│       └── db-clients.ts      # Database connection
├── dist/                      # Build output (gitignored)
├── .env.example               # Template with all env vars
├── .gitignore                 # Include .env*, node_modules, dist
├── railway.toml               # Railway configuration
├── Dockerfile                 # If using Docker
├── .dockerignore              # If using Docker
└── package.json
```

### package.json Scripts

```json
{
  "scripts": {
    "build": "tsc",
    "dev": "tsx watch src/api/server.ts",
    "start": "node dist/api/server.js",
    "start:api": "node dist/api/server.js",
    "start:mcp": "node dist/mcp-server/index.js"
  }
}
```

---

## 🔐 Environment Variables Template

Create `.env.example`:

```bash
# Server
NODE_ENV=production
PORT=3000                      # Railway overrides this
API_PORT=3000                  # Fallback for local dev

# Database (Railway Postgres)
POSTGRES_URL=postgresql://user:pass@host:port/db
POSTGRES_SSL=true

# Authentication
API_KEYS=key1,key2,key3

# Feature Flags
ENABLE_SCHEDULER=false
ENABLE_NEO4J=false

# Logging
LOG_LEVEL=info

# External APIs (if any)
CLAUDE_API_KEY=sk-ant-...
```

---

## 🚦 Deployment Status Indicators

### Application Not Found (404)
```json
{"status":"error","code":404,"message":"Application not found"}
```
**Meaning:** Railway proxy can't reach your app
**Causes:**
1. Healthcheck failing (check Railway logs)
2. App not listening on `PORT` env var
3. App crashed on startup

**Fix:**
```bash
# Check if app is running internally
railway run -- curl http://localhost:3000/health

# If it works internally, issue is PORT configuration
```

### Connection Refused (502)
```json
{"status":"error","code":502,"message":"Application failed to respond"}
```
**Meaning:** Railway proxy tried to connect but couldn't
**Causes:**
1. Wrong port (not using `process.env.PORT`)
2. App listening on localhost instead of 0.0.0.0
3. App crashed

**Fix:**
```typescript
// Ensure you're binding to all interfaces
app.listen(port, '0.0.0.0', () => {
  console.log(`Listening on ${port}`);
});
```

### Healthy Response
```json
{"status":"healthy","timestamp":"2025-11-28T13:33:07.640Z"}
```
**Meaning:** Everything working! 🎉

---

## 📊 Railway CLI Commands Reference

```bash
# Authentication
railway login
railway whoami

# Project Management
railway init                    # Create new project
railway link                    # Link to existing project
railway unlink                  # Unlink current project

# Deployment
railway up                      # Deploy and wait
railway up --detach             # Deploy in background
railway status                  # Check deployment status

# Environment Variables
railway variables               # List all variables
railway variables set KEY=value # Set variable
railway variables unset KEY     # Remove variable

# Logs & Monitoring
railway logs                    # Stream logs (can hang)
railway logs --tail 100         # Last 100 lines

# Running Commands
railway run -- <command>        # Run in Railway environment
railway run -- curl http://localhost:3000/health

# Troubleshooting
railway list                    # List all projects
railway service                 # Show service info
```

---

## 🎯 Golden Rules

1. **ALWAYS** use `process.env.PORT` first, fallback to custom vars
2. **NEVER** hardcode ports, URLs, or database connections
3. **START SIMPLE** - Use NIXPACKS before Docker
4. **SKIP HEALTHCHECKS** until deployment works
5. **TEST LOCALLY** with `NODE_ENV=production` before deploying
6. **USE MIGRATIONS** for database schema changes
7. **DOCUMENT ENV VARS** in `.env.example`
8. **MONITOR TIMEOUTS** - Railway has network latency
9. **CHECK LOGS** in Railway dashboard (CLI logs incomplete)
10. **COMMIT `railway.toml`** to git, never `.env` files

---

## 📈 Optimization (Add After Deployment Works)

Once your app deploys successfully, optimize in this order:

1. **Add Healthchecks**
   ```toml
   healthcheckPath = "/health"
   healthcheckTimeout = 30
   ```

2. **Switch to Docker** (if needed)
   ```toml
   builder = "DOCKERFILE"
   ```

3. **Multi-Stage Build** (reduce image size)
   ```dockerfile
   FROM node:20-alpine AS builder
   # Build stage

   FROM node:20-alpine AS runner
   # Run stage
   ```

4. **Resource Limits**
   - Set in Railway dashboard
   - Monitor actual usage first

5. **CDN & Caching**
   - Add after traffic increases
   - Use Railway's edge caching

---

## 🆘 Emergency Rollback

If deployment breaks production:

```bash
# View recent deployments
# (Use Railway dashboard)

# Rollback via CLI
railway redeploy <deployment-id>

# Or fix forward (faster)
git revert HEAD
git push origin main
```

---

## ✅ Pre-Deployment Checklist (Final)

Before pushing to Railway:

- [ ] App uses `process.env.PORT`
- [ ] Database connection has 10s+ timeout
- [ ] SSL enabled for PostgreSQL
- [ ] All env vars documented in `.env.example`
- [ ] `railway.toml` committed to git
- [ ] `.env` files in `.gitignore`
- [ ] Build works: `npm run build`
- [ ] Start works: `NODE_ENV=production npm start`
- [ ] Health endpoint responds fast (< 1s)
- [ ] Migrations applied to Railway DB (if any)
- [ ] No hardcoded secrets in code

---

## 📚 Additional Resources

- **Railway Docs:** https://docs.railway.app
- **Railway CLI:** https://docs.railway.app/develop/cli
- **PostgreSQL on Railway:** https://docs.railway.app/databases/postgresql
- **Troubleshooting:** https://docs.railway.app/troubleshoot/fixing-common-errors

---

**Last Updated:** 2025-11-28
**Stack:** Node.js 20 + TypeScript + Express + PostgreSQL
**Deployment Time:** ~60 seconds (NIXPACKS) | ~120 seconds (Docker)

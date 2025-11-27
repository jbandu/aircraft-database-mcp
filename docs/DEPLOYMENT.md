# Deployment Guide

Complete guide for deploying the Aircraft Database MCP Server to production.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Railway Deployment (Recommended)](#railway-deployment)
3. [Vercel Dashboard Deployment](#vercel-dashboard-deployment)
4. [Docker Deployment](#docker-deployment)
5. [Environment Variables](#environment-variables)
6. [Database Setup](#database-setup)
7. [Post-Deployment](#post-deployment)
8. [Monitoring](#monitoring)
9. [Troubleshooting](#troubleshooting)

## Prerequisites

### Required Services

- **Railway Account**: [railway.app](https://railway.app) - For API and databases
- **Vercel Account**: [vercel.com](https://vercel.com) - For dashboard (optional)
- **Claude API Key**: [console.anthropic.com](https://console.anthropic.com) - For LLM scraping
- **GitHub Account**: For CI/CD and deployments

### Local Tools

```bash
# Install Railway CLI
npm install -g @railway/cli

# Install Vercel CLI (optional)
npm install -g vercel

# Install Docker (for local testing)
# https://docs.docker.com/get-docker/
```

## Railway Deployment

Railway provides the simplest deployment path with managed PostgreSQL, Neo4j, and Redis.

### Step 1: Create Railway Project

```bash
# Login to Railway
railway login

# Create new project
railway init

# Link to existing project (if already created in dashboard)
railway link
```

### Step 2: Add Databases

**In Railway Dashboard**:

1. **Add PostgreSQL**:
   - Click "New" → "Database" → "PostgreSQL"
   - Railway automatically creates `RAILWAY_POSTGRESQL_URL`

2. **Add Neo4j** (Optional):
   - Click "New" → "Database" → "Neo4j"
   - Note the connection details

3. **Add Redis** (Optional):
   - Click "New" → "Database" → "Redis"
   - Railway automatically creates `REDIS_URL`

### Step 3: Configure Environment Variables

In Railway dashboard, add these variables:

```bash
NODE_ENV=production
API_PORT=3000
LOG_LEVEL=info

# Database (automatically provided by Railway)
POSTGRES_URL=${RAILWAY_POSTGRESQL_URL}
NEO4J_URI=${NEO4J_URL}
NEO4J_USER=neo4j
NEO4J_PASSWORD=<from-neo4j-service>
REDIS_URL=${REDIS_URL}

# API Configuration
API_KEYS=<generate-secure-keys>
CORS_ORIGINS=<your-dashboard-url>

# LLM
LLM_MODE=claude
CLAUDE_API_KEY=<your-claude-api-key>

# MCP Server
MCP_SERVER_NAME=aircraft-database
MCP_SERVER_VERSION=1.0.0

# Scraping
SCRAPER_USER_AGENT=NumberLabs-AircraftBot/1.0
SCRAPER_RATE_LIMIT_MS=2000
SCRAPER_TIMEOUT_MS=30000
SCRAPER_MAX_RETRIES=3
SCRAPER_CONCURRENT_LIMIT=5
SCRAPER_SCHEDULE_ENABLED=true
SCRAPER_SCHEDULE_CRON=0 2 * * *
PLAYWRIGHT_HEADLESS=true
```

**Generate Secure API Keys**:
```bash
# Generate random API keys
openssl rand -hex 32
openssl rand -hex 32
```

### Step 4: Deploy

```bash
# Deploy from local
railway up

# Or connect GitHub repository for automatic deployments
# In Railway dashboard: Settings → Connect GitHub Repo
```

### Step 5: Run Database Migrations

```bash
# Connect to Railway service
railway run npm run db:migrate

# Seed initial data
railway run npm run db:seed
```

### Step 6: Verify Deployment

```bash
# Check health endpoint
curl https://your-railway-app.up.railway.app/health

# Test API
curl -H "X-API-Key: your-key" \
  https://your-railway-app.up.railway.app/api/v1/stats/global
```

## Vercel Dashboard Deployment

Deploy the Next.js dashboard to Vercel for optimal performance.

### Step 1: Prepare Dashboard

```bash
cd dashboard

# Ensure environment variables are set
cp .env.example .env.local

# Test build locally
npm run build
```

### Step 2: Deploy to Vercel

**Option A: Vercel CLI**

```bash
# Login
vercel login

# Deploy
vercel --prod

# Set environment variables
vercel env add NEXT_PUBLIC_API_BASE_URL production
vercel env add NEXT_PUBLIC_API_KEY production
```

**Option B: Vercel Dashboard**

1. Go to [vercel.com/new](https://vercel.com/new)
2. Import your GitHub repository
3. Set root directory to `dashboard`
4. Configure environment variables:
   - `NEXT_PUBLIC_API_BASE_URL`: Your Railway API URL
   - `NEXT_PUBLIC_API_KEY`: Your API key
5. Click "Deploy"

### Step 3: Configure Custom Domain (Optional)

In Vercel dashboard:
1. Go to Settings → Domains
2. Add your custom domain
3. Follow DNS configuration instructions

### Step 4: Update CORS

Update your Railway API's `CORS_ORIGINS`:
```bash
CORS_ORIGINS=https://your-dashboard.vercel.app
```

### Step 5: Verify Dashboard

1. Open `https://your-dashboard.vercel.app`
2. Check that all pages load
3. Verify API connectivity
4. Test real-time updates

## Docker Deployment

For self-hosted deployments, use Docker Compose.

### Step 1: Clone Repository

```bash
git clone https://github.com/yourusername/aircraft-database-mcp.git
cd aircraft-database-mcp
```

### Step 2: Configure Environment

```bash
# Copy and edit environment file
cp .env.example .env
nano .env

# Update these critical values:
# - POSTGRES_URL
# - NEO4J credentials
# - CLAUDE_API_KEY
# - API_KEYS
```

### Step 3: Build and Start Services

```bash
# Build images
docker-compose build

# Start all services
docker-compose up -d

# Check status
docker-compose ps

# View logs
docker-compose logs -f api
```

### Step 4: Initialize Database

```bash
# Run migrations
docker-compose exec api npm run db:migrate

# Seed data
docker-compose exec api npm run db:seed
```

### Step 5: Verify Deployment

```bash
# Check health
curl http://localhost:3000/health

# Check dashboard
open http://localhost:3001
```

### Docker Compose Services

The `docker-compose.yml` includes:
- **postgres**: PostgreSQL 15
- **neo4j**: Neo4j 5.15 Community
- **redis**: Redis 7
- **api**: MCP Server + REST API
- **dashboard**: Next.js dashboard

### Production Docker Deployment

For production, use a container orchestration platform:

**Kubernetes**:
```bash
# Create Kubernetes manifests
kubectl create namespace aircraft-db
kubectl apply -f k8s/
```

**Docker Swarm**:
```bash
# Initialize swarm
docker swarm init

# Deploy stack
docker stack deploy -c docker-compose.yml aircraft-db
```

## Environment Variables

### Required Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `NODE_ENV` | Environment | `production` |
| `POSTGRES_URL` | PostgreSQL connection | `postgresql://...` |
| `CLAUDE_API_KEY` | Claude API key | `sk-ant-api03-...` |
| `API_KEYS` | API keys (comma-separated) | `key1,key2` |

### Optional Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `NEO4J_URI` | Neo4j connection | N/A |
| `REDIS_URL` | Redis connection | N/A |
| `LOG_LEVEL` | Logging level | `info` |
| `API_PORT` | API server port | `3000` |

### LLM Configuration

**Production (Claude API)**:
```bash
LLM_MODE=claude
CLAUDE_API_KEY=sk-ant-api03-your-key
```

**Development (Ollama)**:
```bash
LLM_MODE=ollama
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=llama3.2
```

### Scraping Configuration

```bash
SCRAPER_USER_AGENT=NumberLabs-AircraftBot/1.0
SCRAPER_RATE_LIMIT_MS=2000
SCRAPER_TIMEOUT_MS=30000
SCRAPER_MAX_RETRIES=3
SCRAPER_CONCURRENT_LIMIT=5
SCRAPER_SCHEDULE_ENABLED=true
SCRAPER_SCHEDULE_CRON=0 2 * * *  # Daily at 2 AM
SCRAPER_TIMEZONE=UTC
PLAYWRIGHT_HEADLESS=true
```

## Database Setup

### PostgreSQL Schema

**Railway / Neon**:
1. Database is automatically created
2. Run migrations:
```bash
railway run npm run db:migrate
# or
npm run db:migrate
```

**Self-hosted**:
```bash
# Create database
createdb aircraft_db

# Run schema
psql aircraft_db < src/database/postgres/schema.sql
```

### Seed Initial Data

```bash
# Seed top 100 airlines
npm run db:seed

# Verify seeding
npm run db:seed -- --stats
```

### Neo4j Setup (Optional)

**Neo4j Aura**:
1. Create free instance at [neo4j.com/aura](https://neo4j.com/cloud/aura/)
2. Copy connection URI and credentials
3. Set environment variables
4. Run initialization:
```bash
npm run neo4j:init
```

**Sync from PostgreSQL**:
```bash
# Full sync
npm run neo4j:sync:full

# Incremental sync
npm run neo4j:sync
```

### Redis Setup (Optional)

**Railway / Upstash**:
- Redis URL automatically provided
- No additional configuration needed

**Self-hosted**:
```bash
# Install Redis
brew install redis  # macOS
apt install redis  # Ubuntu

# Start Redis
redis-server
```

## Post-Deployment

### 1. Health Checks

```bash
# API health
curl https://your-api-url/health

# Check response
{
  "status": "healthy",
  "timestamp": "2025-01-15T10:00:00.000Z",
  "uptime": 3600,
  "database": "connected"
}
```

### 2. Test API Endpoints

```bash
# Get global stats
curl -H "X-API-Key: your-key" \
  https://your-api-url/api/v1/stats/global

# List airlines
curl -H "X-API-Key: your-key" \
  https://your-api-url/api/v1/airlines
```

### 3. Initialize Scraping

```bash
# Schedule scraping jobs for top airlines
npm run scraper:setup

# Manually trigger a scraping job
curl -X POST -H "X-API-Key: your-key" \
  -H "Content-Type: application/json" \
  -d '{"airline_code": "AA", "priority": "high"}' \
  https://your-api-url/api/v1/jobs
```

### 4. Configure Monitoring

**Sentry** (Error Tracking):
```bash
# Add to environment
SENTRY_DSN=https://...@sentry.io/...
```

**Datadog** (Performance Monitoring):
```bash
DATADOG_API_KEY=your-datadog-key
```

### 5. Set Up Backups

**Railway**:
- Automatic daily backups included
- Manual backups: Dashboard → Database → Backups

**Self-hosted**:
```bash
# PostgreSQL backup
pg_dump aircraft_db > backup.sql

# Automated backups (cron)
0 2 * * * pg_dump aircraft_db > ~/backups/aircraft_db_$(date +\%Y\%m\%d).sql
```

## Monitoring

### Application Monitoring

**Logs**:
```bash
# Railway
railway logs

# Docker
docker-compose logs -f api

# Kubernetes
kubectl logs -f deployment/aircraft-db-api
```

**Metrics to Monitor**:
- API response times (< 200ms target)
- Error rates (< 1% target)
- Database connection pool usage
- Scraping job success rate
- Memory and CPU usage

### Database Monitoring

**PostgreSQL**:
```sql
-- Active connections
SELECT count(*) FROM pg_stat_activity;

-- Table sizes
SELECT
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

**Neo4j**:
```cypher
// Node counts
MATCH (n) RETURN labels(n) AS label, count(n) AS count

// Relationship counts
MATCH ()-[r]->() RETURN type(r) AS type, count(r) AS count
```

### Alerting

**Set up alerts for**:
- API downtime (health check failures)
- High error rates (> 5%)
- Database connection failures
- Scraping job failures
- High memory/CPU usage

**Tools**:
- Railway: Built-in alerts
- Vercel: Deployment notifications
- Sentry: Error notifications
- Datadog: Custom alerts
- PagerDuty: On-call rotations

## Troubleshooting

### API Not Responding

**Check health endpoint**:
```bash
curl https://your-api-url/health
```

**Common issues**:
1. Database not connected: Check `POSTGRES_URL`
2. Port conflicts: Verify `API_PORT`
3. Missing dependencies: Run `npm install`

### Database Connection Errors

**PostgreSQL**:
```bash
# Test connection
psql $POSTGRES_URL -c "SELECT NOW();"

# Common issues:
# - SSL required: Add ?sslmode=require to URL
# - Authentication: Verify username/password
# - Network: Check firewall/security groups
```

**Neo4j**:
```bash
# Test connection
cypher-shell -u neo4j -p password -a bolt://host:7687

# Common issues:
# - Wrong protocol: Use bolt:// not http://
# - Authentication: Verify credentials
# - Encryption: Some hosts require +s (bolt+s://)
```

### Scraping Jobs Failing

**Check logs**:
```bash
# Railway
railway logs --service aircraft-mcp-api

# Docker
docker-compose logs api
```

**Common issues**:
1. **Rate limiting**: Adjust `SCRAPER_RATE_LIMIT_MS`
2. **Timeouts**: Increase `SCRAPER_TIMEOUT_MS`
3. **Playwright**: Ensure headless mode enabled
4. **Claude API**: Check API key and rate limits

### Dashboard Not Loading

**Check console for errors**:
1. Open browser DevTools
2. Check Network tab for failed API calls
3. Verify `NEXT_PUBLIC_API_BASE_URL` is correct
4. Ensure CORS is configured in API

**Common issues**:
1. CORS errors: Add dashboard URL to `CORS_ORIGINS`
2. API key invalid: Verify `NEXT_PUBLIC_API_KEY`
3. API not accessible: Check API health

### Performance Issues

**Slow API responses**:
1. Check database indexes
2. Monitor database connection pool
3. Enable Redis caching
4. Review slow queries

**High memory usage**:
1. Check for memory leaks
2. Monitor Playwright instances
3. Review scraping concurrent limit
4. Restart service if needed

**Database locks**:
```sql
-- Check for locks
SELECT * FROM pg_locks WHERE NOT granted;

-- Kill blocking queries (if safe)
SELECT pg_terminate_backend(pid) FROM pg_stat_activity
WHERE state = 'active' AND pid != pg_backend_pid();
```

## CI/CD

### GitHub Actions

The project includes two workflows:

**CI Workflow** (`.github/workflows/ci.yml`):
- Runs on push/PR to main/develop
- Lints and type checks code
- Runs tests
- Builds application and Docker images

**Deploy Workflow** (`.github/workflows/deploy.yml`):
- Runs on push to main
- Deploys API to Railway
- Deploys dashboard to Vercel
- Runs health checks

### Required Secrets

Add these to GitHub repository settings:

| Secret | Description |
|--------|-------------|
| `RAILWAY_TOKEN` | Railway CLI token |
| `VERCEL_TOKEN` | Vercel CLI token |
| `API_URL` | Production API URL |
| `DASHBOARD_URL` | Production dashboard URL |

### Manual Deployment

**Disable automatic deployments**:
```bash
# Railway
railway down --service aircraft-mcp-api

# Vercel
# Dashboard → Settings → Git → Disable Automatic Deployments
```

**Manual deploy**:
```bash
# Railway
railway up --service aircraft-mcp-api

# Vercel
cd dashboard
vercel --prod
```

## Security Checklist

- [ ] All environment variables set
- [ ] Secure API keys generated (32+ characters)
- [ ] CORS configured (no wildcard in production)
- [ ] Database SSL enabled
- [ ] Secrets not committed to git
- [ ] Rate limiting enabled
- [ ] Health checks configured
- [ ] Monitoring and alerts set up
- [ ] Backups configured
- [ ] Logs reviewed regularly

## Support

**Issues**: [GitHub Issues](https://github.com/yourusername/aircraft-database-mcp/issues)
**Documentation**: [docs/](../docs/)
**Railway**: [docs.railway.app](https://docs.railway.app)
**Vercel**: [vercel.com/docs](https://vercel.com/docs)

---

For questions or issues, please open a GitHub issue or contact support@numberlabs.ai.

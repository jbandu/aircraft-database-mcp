# Scraper Scheduler Integration

## Overview

The scraper scheduler has been integrated into the REST API server, eliminating the need to run a separate scheduler process. When you start the API server, the scheduler automatically starts and processes scraping jobs in the background.

## What Changed

### 1. API Server Integration

**File**: `src/api/server.ts`

The API server now:
- Initializes databases on startup
- Starts the scraper scheduler automatically (if enabled)
- Handles graceful shutdown for both API and scheduler
- Provides unified process management

### 2. Job Queue Schema Updates

**File**: `src/scrapers/workflows/job-queue.ts`

Updated to work with the actual database schema:
- Uses `airline_code` (string) instead of `airline_id` (integer)
- Uses `job_id` column for job identification
- Maps to correct columns: `result_summary`, `error_message`, etc.
- All CRUD operations updated accordingly

### 3. Scheduler Updates

**File**: `src/scrapers/workflows/scheduler.ts`

Updated to use correct job identifiers:
- Uses `job.job_id` instead of `job.id`
- Properly tracks active jobs by job_id
- Correctly updates job status in database

### 4. Environment Variables

**New Variable**: `SCRAPER_SCHEDULER_ENABLED`

- **Default**: `true`
- **Purpose**: Enable/disable the scheduler
- **Usage**: Set to `false` to run API server without scheduler

Updated `.env` and `.env.example` with:
```bash
# Scraper Scheduler (runs with API server)
SCRAPER_SCHEDULER_ENABLED=true
SCRAPER_POLL_INTERVAL_MS=5000
SCRAPER_WORKFLOW_CONCURRENCY=5
```

### 5. Documentation Updates

**Files**: `README.md`, `.env.example`

- Updated "Web Scraping" section with new architecture
- Clarified how scraping works (job queue → scheduler → workflow)
- Added scheduler configuration reference
- Updated environment variable examples

## How It Works Now

### Architecture

```
User/Client App
  ↓
POST /api/v1/jobs (Create scraping job)
  ↓
Job added to scraping_jobs table (status: pending)
  ↓
Scheduler (running in API server process)
  ├─ Polls queue every 5 seconds
  ├─ Picks up pending jobs
  ├─ Executes scraping workflow
  └─ Updates job status (running → completed/failed)
  ↓
Results saved to database
```

### Starting the System

**Before** (two separate processes):
```bash
# Terminal 1
npm run start:api

# Terminal 2
npm run scraper:schedule
```

**After** (single process):
```bash
npm run start:api
# Scheduler runs automatically!
```

### Creating and Processing Jobs

**1. Create a Job** (via REST API):
```bash
curl -X POST http://localhost:3000/api/v1/jobs \
  -H "X-API-Key: your-key" \
  -H "Content-Type: application/json" \
  -d '{"airline_code": "AA", "priority": "normal"}'
```

**2. Job Processing** (automatic):
- Job created with status `pending`
- Scheduler picks it up within 5 seconds
- Status changes: `pending` → `running` → `completed`
- Results: `discovered_count`, `new_count`, `updated_count`

**3. Check Job Status**:
```bash
curl http://localhost:3000/api/v1/jobs/job_AA_1234567890 \
  -H "X-API-Key: your-key"
```

## Configuration

### Scheduler Settings

| Variable | Default | Description |
|----------|---------|-------------|
| `SCRAPER_SCHEDULER_ENABLED` | `true` | Enable/disable scheduler |
| `SCRAPER_CONCURRENT_LIMIT` | `3` | Max concurrent jobs |
| `SCRAPER_POLL_INTERVAL_MS` | `5000` | Poll frequency (5 seconds) |
| `SCRAPER_WORKFLOW_CONCURRENCY` | `5` | Parallel aircraft per job |

### Automatic Job Creation

The scheduler can also create jobs automatically on a schedule:

```bash
SCRAPER_SCHEDULE_ENABLED=true      # Enable cron-based job creation
SCRAPER_SCHEDULE_CRON=0 2 * * *    # Daily at 2 AM
```

When enabled, the scheduler will:
- Check for airlines needing updates
- Create jobs for airlines not scraped recently
- Prioritize airlines never scraped

## Benefits

### For Developers

✅ **Simpler Setup**: One process instead of two
✅ **Better DX**: Just run `npm run start:api`
✅ **Unified Logs**: All logs in one place
✅ **Graceful Shutdown**: Proper cleanup on exit

### For Operations

✅ **Fewer Moving Parts**: Easier to deploy and monitor
✅ **Single Health Check**: One endpoint to monitor
✅ **Simpler Scaling**: Scale API = Scale scheduler
✅ **Unified Configuration**: One .env file

### For Users

✅ **Faster Response**: Jobs process automatically
✅ **Real-time Updates**: Dashboard shows live progress
✅ **Reliable**: No "forgot to start scheduler" issues

## Monitoring

### Check Scheduler Status

The scheduler logs its activity:

```
[scheduler] Starting scraper scheduler
[scheduler] Found pending job: job_UA_1764273760199 for UA (1/5)
[scheduler] Executing job job_UA_1764273760199 for UA
[workflow] Starting full fleet update for UA
[workflow] Phase 1: Fleet Discovery
[scheduler] Job completed successfully: 150 found, 5 added, 12 updated
```

### Queue Statistics

Check job queue status:

```sql
SELECT
  status,
  COUNT(*) as count,
  AVG(duration_seconds) as avg_duration
FROM scraping_jobs
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY status;
```

## Troubleshooting

### Scheduler Not Processing Jobs

**Symptom**: Jobs stay in `pending` status

**Check**:
1. Is `SCRAPER_SCHEDULER_ENABLED=true` in `.env`?
2. Are there any errors in logs?
3. Are jobs properly formatted in database?

**Solution**:
```bash
# Check environment
echo $SCRAPER_SCHEDULER_ENABLED

# View logs
tail -f logs/combined-*.log | grep scheduler

# Check pending jobs
psql -d aircraft_db -c "SELECT * FROM scraping_jobs WHERE status='pending'"
```

### Jobs Failing Immediately

**Symptom**: Jobs go from `pending` → `running` → `failed`

**Check**:
- Scraping agent errors (missing columns, network issues)
- Database connection issues
- LLM service availability (Ollama/Claude)

**Solution**: Check error_message in job record

### High Memory Usage

**Symptom**: Process memory grows over time

**Check**:
- Number of active jobs (should be ≤ SCRAPER_CONCURRENT_LIMIT)
- Job queue size
- Database connection pool

**Solution**:
```bash
# Reduce concurrency
SCRAPER_CONCURRENT_LIMIT=1

# Increase poll interval
SCRAPER_POLL_INTERVAL_MS=10000
```

## Migration Guide

If you have existing deployment with separate scheduler:

### Before

**docker-compose.yml**:
```yaml
services:
  api:
    command: npm run start:api
  scheduler:
    command: npm run scraper:schedule
```

### After

**docker-compose.yml**:
```yaml
services:
  api:
    command: npm run start:api
    environment:
      - SCRAPER_SCHEDULER_ENABLED=true
  # scheduler service removed!
```

## Future Enhancements

Potential improvements:

1. **Distributed Scheduler**: Redis-based job locking for multiple API instances
2. **Job Priorities**: Dynamic priority adjustment based on data age
3. **Backpressure**: Pause scheduling when system load is high
4. **Metrics**: Prometheus metrics for scheduler performance
5. **Admin UI**: Web interface for scheduler control

## Summary

The scheduler integration makes the system:
- **Simpler** to run (one process)
- **Easier** to deploy (fewer services)
- **More reliable** (always runs with API)
- **Better DX** (unified logs and config)

Just start the API server and scraping jobs are automatically processed! 🎉

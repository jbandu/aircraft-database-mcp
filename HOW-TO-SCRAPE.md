# How to Run the Aircraft Data Scraper

Your scraping infrastructure is **fully operational** with 1,400+ lines of code!

## Prerequisites Verified ✅

- ✅ **Ollama** installed with llama3.2 model (for LLM-powered data extraction)
- ✅ **Playwright** installed (for browser automation)
- ✅ **PostgreSQL** database ready
- ✅ **3 Scraping Agents** implemented:
  - Fleet Discovery Agent (350 lines)
  - Aircraft Details Agent (517 lines)
  - Validation Agent (599 lines)

---

## Method 1: MCP Inspector (Visual Testing)

**Best for:** Quick testing and exploration

1. Open http://localhost:6274
2. Click `trigger_fleet_update` in the left sidebar
3. Enter parameters:
   ```json
   {
     "airline_codes": ["AA"],
     "priority": "high",
     "force_refresh": true
   }
   ```
4. Click "Call Tool"

This creates a scraping job in the `scraping_jobs` table.

---

## Method 2: Command Line (Direct Execution)

**Best for:** One-time scraping or manual control

```bash
# Dry run (preview without saving to database)
npm run scraper:run -- --airline=AA --dry-run

# Actually scrape American Airlines
npm run scraper:run -- --airline=AA

# Force full scrape (ignore recent updates)
npm run scraper:run -- --airline=AA --force

# Scrape multiple airlines
npm run scraper:run -- --airline=AA,DL,UA
```

### What This Does:

**Phase 1: Fleet Discovery**
- Visits airline website + aviation databases
- Uses LLM to intelligently extract aircraft registrations
- Sources: Official fleet pages, airfleets.net, planespotters.net

**Phase 2: Details Extraction**
- For each aircraft, scrapes manufacturer specs
- Gets seating config, engines, delivery date
- Processes in parallel batches (default: 5 concurrent)

**Phase 3: Validation**
- Validates data completeness and accuracy
- Assigns confidence score (0.0 - 1.0)
- Flags issues for review

**Phase 4: Database Update**
- Saves validated data to PostgreSQL
- Updates existing records or inserts new ones
- Logs all changes for audit trail

**Output Example:**
```json
{
  "airline_code": "AA",
  "aircraft_found": 45,
  "aircraft_added": 12,
  "aircraft_updated": 30,
  "aircraft_skipped": 3,
  "errors": 0,
  "duration_ms": 45231,
  "confidence_avg": 0.87
}
```

---

## Method 3: REST API (Programmatic)

**Best for:** Automation and integration with other systems

### Create a Scraping Job

```bash
curl -X POST http://localhost:3000/api/v1/jobs \
  -H "Content-Type: application/json" \
  -d '{
    "airline_code": "AA",
    "priority": "high",
    "include_aircraft_details": true,
    "force_update": false
  }'
```

**Response:**
```json
{
  "jobId": "job_abc123",
  "status": "pending",
  "airline": "American Airlines",
  "created_at": "2024-03-15T10:30:00Z"
}
```

### Check Job Status

```bash
curl http://localhost:3000/api/v1/jobs/job_abc123
```

### View All Jobs

```bash
# All jobs
curl http://localhost:3000/api/v1/jobs

# Pending jobs
curl "http://localhost:3000/api/v1/jobs?status=pending"

# Completed jobs
curl "http://localhost:3000/api/v1/jobs?status=completed"
```

---

## Monitoring & Debugging

### Check Scraping Jobs in Database

```bash
# View all jobs
psql aircraft_db -c "SELECT * FROM scraping_jobs ORDER BY created_at DESC LIMIT 10;"

# Count by status
psql aircraft_db -c "
  SELECT status, COUNT(*)
  FROM scraping_jobs
  GROUP BY status;
"

# Recent completed jobs
psql aircraft_db -c "
  SELECT
    sj.id,
    al.name as airline,
    sj.status,
    sj.created_at,
    sj.completed_at,
    sj.metadata->>'aircraft_found' as aircraft_found
  FROM scraping_jobs sj
  JOIN airlines al ON sj.airline_id = al.id
  WHERE sj.status = 'completed'
  ORDER BY sj.completed_at DESC
  LIMIT 10;
"
```

### View Logs

```bash
# MCP Server logs (includes scraper activity)
tail -f logs/mcp-server.log | grep scraper

# Filter for specific airline
tail -f logs/mcp-server.log | grep "AA"

# Show only errors
tail -f logs/mcp-server.log | grep error
```

### Monitor Real-Time Progress

```bash
# Watch scraping jobs
npm run scraper:monitor:watch

# One-time status check
npm run scraper:monitor
```

---

## Scheduled Automated Scraping

Set up regular scraping for all top airlines:

```bash
# Set up schedule (creates jobs for top 100 airlines)
npm run scraper:setup

# Start the scheduler (runs based on SCRAPER_SCHEDULE_CRON)
npm run scraper:schedule
```

**Default Schedule:** Daily at 2 AM UTC

**Configure in .env:**
```bash
SCRAPER_SCHEDULE_ENABLED=true
SCRAPER_SCHEDULE_CRON=0 2 * * *   # Daily at 2 AM
SCRAPER_TIMEZONE=UTC
```

---

## Configuration Options

All configurable via `.env`:

```bash
# LLM Configuration
LLM_MODE=ollama                    # or "claude"
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=llama3.2
CLAUDE_API_KEY=sk-ant-...         # If using Claude

# Scraping Behavior
SCRAPER_USER_AGENT=NumberLabs-AircraftBot/1.0
SCRAPER_RATE_LIMIT_MS=2000        # Wait 2s between requests
SCRAPER_TIMEOUT_MS=30000           # 30s timeout per page
SCRAPER_MAX_RETRIES=3              # Retry 3 times on failure
SCRAPER_CONCURRENT_LIMIT=5         # Max 5 concurrent scrapers

# Browser Automation
PLAYWRIGHT_HEADLESS=true           # Headless browser (faster)
PLAYWRIGHT_BROWSER=chromium        # or firefox, webkit
```

---

## Example: Scrape American Airlines

Let's scrape American Airlines step-by-step:

**Step 1: Run the scraper**
```bash
npm run scraper:run -- --airline=AA
```

**Step 2: Monitor progress**
```bash
# In another terminal
tail -f logs/mcp-server.log | grep "AA\|workflow"
```

**Step 3: Check results**
```bash
# View discovered aircraft
psql aircraft_db -c "
  SELECT
    a.registration,
    at.manufacturer,
    at.model,
    a.delivery_date,
    a.status,
    a.data_confidence
  FROM aircraft a
  JOIN aircraft_types at ON a.aircraft_type_id = at.id
  JOIN airlines al ON a.current_airline_id = al.id
  WHERE al.iata_code = 'AA'
  ORDER BY a.registration
  LIMIT 10;
"
```

**Step 4: Query via MCP Inspector**
1. Open http://localhost:6274
2. Click `get_airline_fleet`
3. Enter: `{"airline_code": "AA"}`
4. See the freshly scraped data!

---

## Data Sources

The scraper intelligently queries multiple sources:

**Primary Sources:**
- ✈️ Airline official websites (fleet pages)
- ✈️ Airfleets.net (comprehensive database)
- ✈️ Planespotters.net (registration tracking)
- ✈️ Ch-aviation.com (fleet data)

**Manufacturer Sources:**
- Boeing specifications
- Airbus specifications
- Engine manufacturer data

**Fallback Sources:**
- FlightRadar24 (for active aircraft)
- Aviation databases with historical data

The LLM intelligently decides which sources to use based on availability and data quality.

---

## Data Quality & Validation

Every scraped record includes:

**Confidence Score (0.0 - 1.0):**
- **0.9-1.0:** High confidence (complete data from official sources)
- **0.7-0.9:** Medium confidence (most data present)
- **0.5-0.7:** Low confidence (incomplete or unverified)
- **<0.5:** Very low confidence (minimal data)

**Validation Checks:**
- ✅ Required fields present (registration, type, airline)
- ✅ Data format correct (dates, numbers, codes)
- ✅ Values within expected ranges
- ✅ Cross-reference with known aircraft types
- ✅ Detect anomalies (impossible dates, invalid registrations)

**Flagged Issues:**
- Missing critical fields
- Conflicting data from multiple sources
- Unusual values requiring manual review

---

## Troubleshooting

### Ollama Connection Failed

```bash
# Check if Ollama is running
curl http://localhost:11434/api/generate

# Start Ollama
ollama serve

# Verify model is installed
ollama list
```

### Playwright Browser Errors

```bash
# Reinstall browsers
npx playwright install --force

# Check installation
npx playwright --version
```

### Rate Limiting / Blocked

If you're getting rate limited:

```bash
# Increase delay between requests
SCRAPER_RATE_LIMIT_MS=5000  # 5 seconds

# Reduce concurrent scrapers
SCRAPER_CONCURRENT_LIMIT=2

# Use headless mode (less detectable)
PLAYWRIGHT_HEADLESS=true
```

### No Aircraft Found

Common reasons:
- Website structure changed (LLM will try to adapt)
- Rate limiting (increase delays)
- Invalid airline code (check database: `SELECT * FROM airlines;`)

**Solution:** Check logs for specific errors:
```bash
tail -100 logs/mcp-server.log | grep error
```

---

## Best Practices

### 1. Start Small
- Test with 1-2 airlines first
- Use `--dry-run` flag to preview results
- Verify data quality before scaling up

### 2. Be Respectful
- Use appropriate rate limiting (2+ seconds)
- Set a polite user agent
- Don't scrape during peak hours
- Consider official APIs for production use

### 3. Monitor Quality
- Check confidence scores regularly
- Review flagged issues
- Validate against known data sources
- Update scrapers as websites change

### 4. Schedule Wisely
- Run during off-peak hours (2-4 AM)
- Space out large scraping jobs
- Don't scrape same airline too frequently (24+ hours)

---

## Next Steps

1. **Test locally:** Run `npm run scraper:run -- --airline=AA --dry-run`
2. **Verify results:** Check MCP Inspector and database
3. **Scale up:** Add more airlines gradually
4. **Automate:** Set up scheduled scraping
5. **Monitor:** Watch logs and data quality scores

---

## Support

**Documentation:**
- Full guide: `docs/SCRAPING-GUIDE.md`
- Local setup: `docs/LOCAL-SETUP.md`
- Quick start: `QUICK-START.md`

**Logs:**
- Main log: `logs/mcp-server.log`
- Live monitoring: `npm run scraper:monitor:watch`

**Database:**
- Connection: `postgresql://srihaanbandu@localhost:5432/aircraft_db`
- Tables: `scraping_jobs`, `aircraft`, `airlines`

---

**Happy Scraping! ✈️**

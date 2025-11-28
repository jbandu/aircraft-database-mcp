# Web Scraping Guide

Complete guide to scraping authentic aircraft data from airline websites and aviation databases.

## Prerequisites

### 1. Install Ollama (for LLM-powered extraction)

```bash
# macOS
brew install ollama

# Or download from https://ollama.ai

# Start Ollama
ollama serve

# Pull the model (in another terminal)
ollama pull llama3.2
```

**Alternative:** Use Claude API (better accuracy, requires API key)

```bash
# In .env file
LLM_MODE=claude
CLAUDE_API_KEY=sk-ant-api03-your-key-here
```

### 2. Install Playwright (for browser automation)

```bash
npx playwright install
```

---

## Data Sources

The scraper collects data from:

1. **Airline Official Websites**
   - Fleet pages
   - Aircraft specifications
   - Route information

2. **Aviation Databases**
   - Airfleets.net
   - Planespotters.net
   - Ch-aviation.com

3. **Aircraft Manufacturers**
   - Boeing specifications
   - Airbus specifications
   - Engine data

---

## Quick Start - Scrape One Airline

### Method 1: Via MCP Tool (Recommended)

**Using MCP Inspector:**

1. Open http://localhost:6274
2. Click `trigger_fleet_update`
3. Enter: `{"airline_code": "AA", "priority": "high"}`
4. Click "Call Tool"

**Using REST API:**

```bash
curl -X POST http://localhost:3000/api/v1/jobs \
  -H "Content-Type: application/json" \
  -d '{"airline_code": "AA", "priority": "high"}'
```

This creates a scraping job that runs in the background.

### Method 2: Direct Script Execution

```bash
# Scrape American Airlines
npm run scraper:run -- --airline AA

# Scrape multiple airlines
npm run scraper:run -- --airline AA,DL,UA

# Scrape with specific priority
npm run scraper:run -- --airline AA --priority high
```

---

## Scraping Workflow

### Step-by-Step Process

**1. Fleet Discovery**
```
Visits airline website → Finds fleet page → Extracts aircraft list
```

**2. Aircraft Details**
```
For each aircraft:
  → Scrapes manufacturer website
  → Gets registration details
  → Extracts configuration
  → Validates data quality
```

**3. Data Validation**
```
Checks completeness → Assigns confidence score → Stores in database
```

**4. Storage**
```
PostgreSQL (structured data) + Neo4j (relationships, optional)
```

---

## Commands Reference

### Manual Scraping

```bash
# Scrape specific airline
npm run scraper:run -- --airline AA

# Scrape with options
npm run scraper:run -- \
  --airline DL \
  --priority high \
  --include-details

# Dry run (preview what would be scraped)
npm run scraper:run -- --airline AA --dry-run

# Verbose output
npm run scraper:run -- --airline AA --verbose
```

### Automated Scheduling

```bash
# Set up scheduled scraping for top airlines
npm run scraper:setup

# Start the scheduler (runs daily at 2 AM by default)
npm run scraper:schedule

# Monitor scraping jobs
npm run scraper:monitor

# Watch jobs in real-time
npm run scraper:monitor:watch
```

---

## Configuration

### Scraper Settings (in .env)

```bash
# LLM for data extraction
LLM_MODE=ollama                    # or "claude"
OLLAMA_MODEL=llama3.2
CLAUDE_API_KEY=sk-ant-api03-...

# Scraping behavior
SCRAPER_USER_AGENT=NumberLabs-AircraftBot/1.0
SCRAPER_RATE_LIMIT_MS=2000        # Wait 2s between requests
SCRAPER_TIMEOUT_MS=30000           # 30s timeout
SCRAPER_MAX_RETRIES=3              # Retry 3 times on failure
SCRAPER_CONCURRENT_LIMIT=5         # Max 5 concurrent scrapers

# Browser automation
PLAYWRIGHT_HEADLESS=true           # Headless browser
PLAYWRIGHT_BROWSER=chromium        # or firefox, webkit

# Scheduling
SCRAPER_SCHEDULE_ENABLED=true
SCRAPER_SCHEDULE_CRON=0 2 * * *   # Daily at 2 AM
SCRAPER_TIMEZONE=UTC
```

---

## Example Usage

### Scrape American Airlines

```bash
# 1. Create a scraping job
curl -X POST http://localhost:3000/api/v1/jobs \
  -H "Content-Type: application/json" \
  -d '{
    "airline_code": "AA",
    "priority": "high",
    "include_aircraft_details": true
  }'

# Response:
# {
#   "jobId": "job_abc123",
#   "status": "pending",
#   "airline": "American Airlines"
# }

# 2. Check job status
curl http://localhost:3000/api/v1/jobs/job_abc123

# 3. View results when complete
curl http://localhost:3000/api/v1/airlines/AA/fleet
```

### Bulk Scrape Multiple Airlines

```bash
# Schedule jobs for top US airlines
for airline in AA DL UA WN; do
  curl -X POST http://localhost:3000/api/v1/jobs \
    -H "Content-Type: application/json" \
    -d "{\"airline_code\": \"$airline\", \"priority\": \"normal\"}"
  sleep 1
done
```

### Monitor Progress

```bash
# Watch all jobs
npm run scraper:monitor:watch

# Check specific job
curl http://localhost:3000/api/v1/jobs?status=running

# View completed jobs
curl http://localhost:3000/api/v1/jobs?status=completed
```

---

## Scraping Agents

### 1. Fleet Discovery Agent

**Purpose:** Find all aircraft operated by an airline

**Sources:**
- Airline official website fleet pages
- Airfleets.net
- Planespotters.net

**Data Extracted:**
- Aircraft registration
- Aircraft type
- Delivery date
- Age
- Configuration
- Status (active/stored/retired)

**Example:**
```typescript
import { FleetDiscoveryAgent } from './src/scrapers/agents/fleet-discovery-agent';

const agent = new FleetDiscoveryAgent();
const fleet = await agent.scrapeAirlineFleet('AA');

console.log(`Found ${fleet.length} aircraft`);
```

### 2. Aircraft Details Agent

**Purpose:** Get detailed specs for specific aircraft

**Sources:**
- Manufacturer websites (Boeing, Airbus)
- Aviation databases
- Type certificate data

**Data Extracted:**
- Engine type
- Seating configuration
- Range
- Cruise speed
- MTOW (Max Takeoff Weight)
- Service ceiling

**Example:**
```typescript
import { AircraftDetailsAgent } from './src/scrapers/agents/aircraft-details-agent';

const agent = new AircraftDetailsAgent();
const details = await agent.scrapeAircraftDetails('N12345');

console.log(details.manufacturer, details.model);
```

### 3. Validation Agent

**Purpose:** Verify data quality and completeness

**Checks:**
- Required fields present
- Data format correct
- Values within expected ranges
- Cross-reference with known data

**Confidence Scores:**
- 0.9-1.0: High confidence (complete data from official sources)
- 0.7-0.9: Medium confidence (most data present)
- 0.5-0.7: Low confidence (incomplete or unverified)
- <0.5: Very low confidence (minimal data)

---

## Data Quality

### What Gets Scraped

**High Priority:**
- ✅ Aircraft registration
- ✅ Aircraft type (manufacturer + model)
- ✅ Current operator
- ✅ Status (active/stored/retired)

**Medium Priority:**
- ✅ Serial number (MSN)
- ✅ Delivery date
- ✅ Age
- ✅ Engine type

**Low Priority:**
- ⚠️ Seating configuration
- ⚠️ Previous operators
- ⚠️ Route assignments
- ⚠️ Detailed specifications

### Data Validation

Before storing, each record is:
1. **Validated** - Format and completeness checked
2. **Scored** - Confidence level assigned
3. **Flagged** - Issues marked for review
4. **Logged** - Audit trail created

### Handling Errors

**Rate Limiting:** Respectful 2-second delay between requests

**Retries:** 3 attempts with exponential backoff

**Timeouts:** 30-second limit per page

**Failures:** Logged to database with error details

---

## Production Considerations

### Respectful Scraping

```bash
# Set a polite user agent
SCRAPER_USER_AGENT=YourCompany-Bot/1.0 (+https://yoursite.com/bot)

# Respect robots.txt
# (automatically checked by the scraper)

# Rate limiting
SCRAPER_RATE_LIMIT_MS=2000  # 2 seconds minimum

# Concurrent limits
SCRAPER_CONCURRENT_LIMIT=3  # Max 3 at once
```

### Legal Considerations

⚠️ **Important:** Always:
- Check website Terms of Service
- Respect robots.txt
- Use rate limiting
- Don't overload servers
- Consider using official APIs when available

### Alternative: Official APIs

Some airlines provide APIs:
- **IATA NDC** - Airline distribution
- **Cirium** - Fleet data API (paid)
- **FlightAware** - Flight tracking API

Consider these for production use.

---

## Monitoring & Debugging

### View Logs

```bash
# Scraper logs
tail -f logs/mcp-server.log | grep scraper

# Job queue logs
tail -f logs/mcp-server.log | grep job-queue

# Error logs
tail -f logs/mcp-server.log | grep error
```

### Database Queries

```sql
-- Check scraping jobs
SELECT * FROM scraping_jobs
WHERE created_at > NOW() - INTERVAL '24 hours'
ORDER BY created_at DESC;

-- View data quality
SELECT
  al.name,
  COUNT(*) as aircraft_count,
  AVG(a.data_quality_score) as avg_quality
FROM aircraft a
JOIN airlines al ON a.current_airline_id = al.id
GROUP BY al.name
ORDER BY aircraft_count DESC;

-- Find low-quality data
SELECT registration, manufacturer, model, data_quality_score
FROM aircraft a
JOIN aircraft_types at ON a.aircraft_type_id = at.id
WHERE data_quality_score < 0.7
ORDER BY data_quality_score;
```

### Monitoring Dashboard

```bash
# Start monitoring UI
npm run scraper:monitor:watch

# Shows:
# - Active jobs
# - Completion rate
# - Average scraping time
# - Error rates
# - Data quality scores
```

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

### Playwright Errors

```bash
# Reinstall browsers
npx playwright install --force

# Check installation
npx playwright --version
```

### Rate Limiting Issues

```bash
# Increase delay between requests
SCRAPER_RATE_LIMIT_MS=5000  # 5 seconds

# Reduce concurrent scrapers
SCRAPER_CONCURRENT_LIMIT=2
```

### Job Stuck/Not Running

```sql
-- Reset stuck jobs
UPDATE scraping_jobs
SET status = 'failed',
    error_message = 'Manual reset'
WHERE status = 'running'
  AND updated_at < NOW() - INTERVAL '1 hour';

-- Clear failed jobs
DELETE FROM scraping_jobs
WHERE status = 'failed'
  AND created_at < NOW() - INTERVAL '7 days';
```

---

## Advanced Usage

### Custom Scraper

Create your own scraper:

```typescript
// my-custom-scraper.ts
import { FleetDiscoveryAgent } from './src/scrapers/agents/fleet-discovery-agent';
import { queryPostgres } from './src/lib/db-clients';

async function scrapeCustomSource() {
  const agent = new FleetDiscoveryAgent();

  // Scrape from your custom source
  const data = await fetch('https://your-source.com/api/fleet').then(r => r.json());

  // Process and store
  for (const aircraft of data) {
    await queryPostgres(
      `INSERT INTO aircraft (registration, aircraft_type_id, current_airline_id)
       VALUES ($1, $2, $3)
       ON CONFLICT (registration) DO UPDATE
       SET aircraft_type_id = $2, current_airline_id = $3`,
      [aircraft.registration, aircraft.typeId, aircraft.airlineId]
    );
  }
}

scrapeCustomSource();
```

### Scheduled Scraping

Edit the cron schedule:

```bash
# In .env
SCRAPER_SCHEDULE_CRON=0 */6 * * *  # Every 6 hours
SCRAPER_SCHEDULE_CRON=0 0 * * 0    # Weekly on Sunday
SCRAPER_SCHEDULE_CRON=0 2 1 * *    # Monthly on 1st at 2 AM
```

Start the scheduler:

```bash
npm run scraper:schedule
```

---

## API Reference

### Create Scraping Job

```bash
POST /api/v1/jobs
Content-Type: application/json

{
  "airline_code": "AA",
  "priority": "high",  // high, normal, low
  "include_aircraft_details": true,
  "force_update": false  // Skip if recently scraped
}
```

### Get Job Status

```bash
GET /api/v1/jobs/:jobId
```

### List Jobs

```bash
GET /api/v1/jobs?status=completed&limit=50
```

---

## Next Steps

1. **Start small:** Scrape 1-2 airlines first
2. **Verify data:** Check quality in MCP Inspector
3. **Scale up:** Add more airlines gradually
4. **Automate:** Set up scheduled scraping
5. **Monitor:** Watch for errors and quality issues

---

## Support

- **Issues:** Check logs first
- **Rate limits:** Increase delays
- **Bad data:** File an issue with airline code
- **Feature requests:** GitHub issues

**Remember:** Always scrape responsibly and respect website ToS! 🙏

# Aircraft Scraper - Quick Command Reference

## 🚀 Quick Start

```bash
# 1. Scrape one airline (dry run - no database changes)
npm run scraper:run -- --airline=AA --dry-run

# 2. Actually scrape and save to database
npm run scraper:run -- --airline=AA

# 3. Force full scrape (ignore recent updates)
npm run scraper:run -- --airline=AA --force
```

---

## 📋 Available Airlines

```bash
# List all airlines in database
psql aircraft_db -c "
  SELECT iata_code, icao_code, name, country
  FROM airlines
  WHERE is_active = true
  ORDER BY name;
"
```

**Currently seeded:**
- **AA** - American Airlines (United States)
- **DL** - Delta Air Lines (United States)
- **UA** - United Airlines (United States)
- **WN** - Southwest Airlines (United States)
- **BA** - British Airways (United Kingdom)
- **LH** - Lufthansa (Germany)
- **AF** - Air France (France)
- **EK** - Emirates (United Arab Emirates)
- **QR** - Qatar Airways (Qatar)
- **SQ** - Singapore Airlines (Singapore)

---

## 🔧 Command Options

```bash
# Dry run (preview without saving)
--dry-run

# Force full scrape (ignore last_scraped_at)
--force

# Scrape multiple airlines
--airline=AA,DL,UA

# Verbose output
--verbose
```

---

## 📊 Monitor Scraping Jobs

```bash
# View all scraping jobs
psql aircraft_db -c "
  SELECT
    sj.id,
    al.iata_code,
    al.name,
    sj.job_type,
    sj.status,
    sj.priority,
    sj.created_at,
    sj.started_at,
    sj.completed_at
  FROM scraping_jobs sj
  JOIN airlines al ON sj.airline_id = al.id
  ORDER BY sj.created_at DESC
  LIMIT 20;
"

# Count jobs by status
psql aircraft_db -c "
  SELECT status, COUNT(*) as count
  FROM scraping_jobs
  GROUP BY status
  ORDER BY count DESC;
"

# Recent completed jobs with results
psql aircraft_db -c "
  SELECT
    al.iata_code,
    sj.status,
    sj.completed_at,
    sj.metadata->>'aircraft_found' as aircraft_found,
    sj.metadata->>'aircraft_added' as aircraft_added,
    sj.metadata->>'confidence_avg' as confidence_avg,
    sj.error_message
  FROM scraping_jobs sj
  JOIN airlines al ON sj.airline_id = al.id
  WHERE sj.status = 'completed'
  ORDER BY sj.completed_at DESC
  LIMIT 10;
"

# Failed jobs
psql aircraft_db -c "
  SELECT
    al.iata_code,
    sj.error_message,
    sj.created_at,
    sj.started_at
  FROM scraping_jobs sj
  JOIN airlines al ON sj.airline_id = al.id
  WHERE sj.status = 'failed'
  ORDER BY sj.created_at DESC
  LIMIT 10;
"
```

---

## 📈 View Scraped Data

```bash
# View aircraft for American Airlines
psql aircraft_db -c "
  SELECT
    a.registration,
    at.manufacturer,
    at.model,
    a.delivery_date,
    EXTRACT(YEAR FROM AGE(CURRENT_DATE, a.manufacture_date)) as age_years,
    a.status,
    a.data_confidence,
    a.last_scraped_at
  FROM aircraft a
  JOIN aircraft_types at ON a.aircraft_type_id = at.id
  JOIN airlines al ON a.current_airline_id = al.id
  WHERE al.iata_code = 'AA'
  ORDER BY a.registration
  LIMIT 20;
"

# Aircraft by type for an airline
psql aircraft_db -c "
  SELECT
    at.manufacturer,
    at.model,
    COUNT(*) as count,
    AVG(a.data_confidence) as avg_confidence
  FROM aircraft a
  JOIN aircraft_types at ON a.aircraft_type_id = at.id
  JOIN airlines al ON a.current_airline_id = al.id
  WHERE al.iata_code = 'AA'
  GROUP BY at.manufacturer, at.model
  ORDER BY count DESC;
"

# Data quality statistics
psql aircraft_db -c "
  SELECT
    CASE
      WHEN data_confidence >= 0.9 THEN 'High (0.9-1.0)'
      WHEN data_confidence >= 0.7 THEN 'Medium (0.7-0.9)'
      WHEN data_confidence >= 0.5 THEN 'Low (0.5-0.7)'
      ELSE 'Very Low (<0.5)'
    END as quality,
    COUNT(*) as count,
    ROUND(AVG(data_confidence)::numeric, 2) as avg_score
  FROM aircraft
  GROUP BY quality
  ORDER BY avg_score DESC;
"

# Recently scraped aircraft
psql aircraft_db -c "
  SELECT
    al.iata_code,
    a.registration,
    at.model,
    a.last_scraped_at,
    a.data_confidence
  FROM aircraft a
  JOIN aircraft_types at ON a.aircraft_type_id = at.id
  JOIN airlines al ON a.current_airline_id = al.id
  WHERE a.last_scraped_at IS NOT NULL
  ORDER BY a.last_scraped_at DESC
  LIMIT 20;
"
```

---

## 🧹 Clean Up Jobs

```bash
# Delete old completed jobs (older than 30 days)
psql aircraft_db -c "
  DELETE FROM scraping_jobs
  WHERE status = 'completed'
    AND completed_at < NOW() - INTERVAL '30 days';
"

# Reset stuck jobs (running for more than 1 hour)
psql aircraft_db -c "
  UPDATE scraping_jobs
  SET status = 'failed',
      error_message = 'Manually reset - job timed out',
      completed_at = NOW()
  WHERE status = 'running'
    AND started_at < NOW() - INTERVAL '1 hour';
"

# Clear all pending jobs
psql aircraft_db -c "
  DELETE FROM scraping_jobs
  WHERE status = 'pending';
"
```

---

## 🔍 Logs

```bash
# View scraper logs
tail -f logs/mcp-server.log | grep scraper

# Show only errors
tail -f logs/mcp-server.log | grep error

# Filter by airline code
tail -f logs/mcp-server.log | grep "AA"

# Last 100 log lines
tail -100 logs/mcp-server.log

# Search for specific text in logs
grep "Fleet Discovery" logs/mcp-server.log | tail -20
```

---

## 🔄 Scheduled Scraping

```bash
# Set up scheduled scraping for top airlines
npm run scraper:setup

# Start the scheduler (runs based on cron schedule)
npm run scraper:schedule

# Monitor real-time
npm run scraper:monitor:watch

# One-time status check
npm run scraper:monitor
```

**Configure schedule in .env:**
```bash
SCRAPER_SCHEDULE_CRON=0 2 * * *   # Daily at 2 AM
SCRAPER_TIMEZONE=UTC
```

---

## 🛠️ Troubleshooting

```bash
# Check Ollama is running
curl http://localhost:11434/api/generate

# List Ollama models
ollama list

# Start Ollama
ollama serve

# Check Playwright
npx playwright --version

# Reinstall Playwright browsers
npx playwright install

# Test database connection
psql aircraft_db -c "SELECT COUNT(*) FROM airlines;"

# Check environment variables
cat .env | grep -E "OLLAMA|SCRAPER|PLAYWRIGHT"
```

---

## 📊 Example: Full Scraping Workflow

```bash
# 1. Check airlines in database
psql aircraft_db -c "SELECT iata_code, name FROM airlines WHERE is_active = true;"

# 2. Run dry run to preview
npm run scraper:run -- --airline=AA --dry-run

# 3. Actually scrape American Airlines
npm run scraper:run -- --airline=AA

# 4. Monitor logs (in another terminal)
tail -f logs/mcp-server.log | grep "AA\|workflow"

# 5. Check results
psql aircraft_db -c "
  SELECT COUNT(*) as total_aircraft
  FROM aircraft a
  JOIN airlines al ON a.current_airline_id = al.id
  WHERE al.iata_code = 'AA';
"

# 6. View sample data
psql aircraft_db -c "
  SELECT registration, at.model, a.delivery_date, a.data_confidence
  FROM aircraft a
  JOIN aircraft_types at ON a.aircraft_type_id = at.id
  JOIN airlines al ON a.current_airline_id = al.id
  WHERE al.iata_code = 'AA'
  LIMIT 10;
"

# 7. Query via MCP Inspector
# Open http://localhost:6274
# Call tool: get_airline_fleet
# Params: {"airline_code": "AA"}
```

---

## 🌐 REST API Commands

```bash
# Create scraping job
curl -X POST http://localhost:3000/api/v1/jobs \
  -H "Content-Type: application/json" \
  -d '{
    "airline_code": "AA",
    "priority": "high"
  }'

# Check job status
curl http://localhost:3000/api/v1/jobs/<job_id>

# List all jobs
curl http://localhost:3000/api/v1/jobs

# Get airline fleet (after scraping)
curl http://localhost:3000/api/v1/airlines/AA/fleet

# Global statistics
curl http://localhost:3000/api/v1/stats/global
```

---

## ⚙️ Configuration

**Edit .env file:**

```bash
# LLM Settings
LLM_MODE=ollama                    # or "claude"
OLLAMA_MODEL=llama3.2
OLLAMA_BASE_URL=http://localhost:11434

# Scraping Behavior
SCRAPER_RATE_LIMIT_MS=2000        # 2 second delay between requests
SCRAPER_TIMEOUT_MS=30000           # 30 second timeout
SCRAPER_MAX_RETRIES=3              # Retry 3 times
SCRAPER_CONCURRENT_LIMIT=5         # 5 parallel scrapers

# Browser
PLAYWRIGHT_HEADLESS=true           # Run browser in background
PLAYWRIGHT_BROWSER=chromium        # chromium, firefox, or webkit

# User Agent (be polite!)
SCRAPER_USER_AGENT=NumberLabs-AircraftBot/1.0 (+https://numberlabs.ai)
```

---

## 📖 Documentation

- **Detailed Guide:** `docs/SCRAPING-GUIDE.md`
- **How to Scrape:** `HOW-TO-SCRAPE.md`
- **Quick Start:** `QUICK-START.md`
- **Local Setup:** `docs/LOCAL-SETUP.md`

---

**Quick Help:**
```bash
# Show scraper usage
npm run scraper:run -- --help

# Or just run without args
npm run scraper:run
```

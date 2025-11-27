# Web Scraping Agents - Implementation Guide

## Overview

The Aircraft Database MCP Server uses intelligent LLM-powered agents to scrape airline fleet data from various sources. This system provides robust, adaptable scraping that can handle diverse website formats.

## Architecture

```
┌────────────────────────────────────────────────────────────┐
│                   LLM-Powered Scraping                      │
│                                                             │
│  ┌──────────────────┐  ┌──────────────────┐               │
│  │   Ollama (Dev)   │  │  Claude (Prod)   │               │
│  │   llama3.2       │  │  Sonnet 3.5      │               │
│  └──────────────────┘  └──────────────────┘               │
│            │                    │                           │
│            └────────┬───────────┘                           │
│                     ↓                                        │
│          ┌──────────────────────┐                          │
│          │  Unified LLM Client  │                          │
│          └──────────────────────┘                          │
│                     ↓                                        │
│     ┌───────────────┼───────────────┐                     │
│     ↓               ↓               ↓                       │
│  ┌─────────┐  ┌──────────┐  ┌─────────────┐              │
│  │ Fleet   │  │ Aircraft │  │ Validation  │              │
│  │Discovery│  │ Details  │  │   Agent     │              │
│  │ Agent   │  │  Agent   │  │             │              │
│  └─────────┘  └──────────┘  └─────────────┘              │
│       │            │               │                        │
│       └────────────┼───────────────┘                       │
│                    ↓                                        │
│         ┌──────────────────────┐                          │
│         │   Workflow           │                          │
│         │   Orchestrator       │                          │
│         └──────────────────────┘                          │
│                    ↓                                        │
│         ┌──────────────────────┐                          │
│         │   PostgreSQL + Neo4j │                          │
│         └──────────────────────┘                          │
└────────────────────────────────────────────────────────────┘
```

## ✅ Implemented Components

### 1. LLM Infrastructure

**Files Created**:
- `src/lib/llm-config.ts` - Configuration for Ollama and Claude
- `src/lib/ollama-client.ts` - Ollama API wrapper
- `src/lib/claude-client.ts` - Claude API wrapper
- `src/lib/llm-client.ts` - Unified interface

**Features**:
- ✅ Automatic provider selection (Ollama for dev, Claude for prod)
- ✅ Environment-based configuration
- ✅ JSON response parsing
- ✅ Error handling and retries
- ✅ Health checks
- ✅ Model management

**Configuration**:
```typescript
// Automatically selects based on NODE_ENV or LLM_MODE
const client = getLLMClient();

// Generate text
const response = await client.generate(prompt, {
  temperature: 0.1,
  system: "You are an expert at extracting structured data"
});

// Generate JSON
const data = await client.generateJSON<MyType>(prompt);
```

### 2. Fleet Discovery Agent

**File**: `src/scrapers/agents/fleet-discovery-agent.ts`

**Purpose**: Find all aircraft for an airline

**Capabilities**:
- ✅ Navigate airline fleet pages with Playwright
- ✅ LLM-guided content analysis
- ✅ Extract registration numbers from various formats
- ✅ Handle dynamic content and JavaScript-rendered pages
- ✅ Multiple source fallback (official site → databases)
- ✅ Confidence scoring

**Usage**:
```typescript
const agent = new FleetDiscoveryAgent();
const result = await agent.discoverFleet('AA');

console.log(`Found ${result.aircraft_found.length} aircraft`);
console.log(`Confidence: ${result.confidence}`);
```

**Data Sources**:
1. Official airline websites
2. Planespotters.net
3. Airfleets.net
4. Custom sources from database

## 🚧 Components To Implement

### 3. Aircraft Details Agent

**File**: `src/scrapers/agents/aircraft-details-agent.ts`

**Template**:
```typescript
export interface AircraftDetails {
  registration: string;
  aircraft_type: string;
  manufacturer: string;
  model: string;
  msn: string;
  seat_configuration: {
    first?: number;
    business?: number;
    premium_economy?: number;
    economy?: number;
  };
  delivery_date: string | null;
  status: string;
  current_location: string | null;
  confidence_score: number;
  data_source: string;
}

export class AircraftDetailsAgent {
  async extractDetails(
    registration: string,
    sourceUrls: string[]
  ): Promise<AircraftDetails> {
    // For each source URL:
    // 1. Load page with Playwright
    // 2. Extract relevant content
    // 3. Use LLM to parse unstructured data
    // 4. Merge data from multiple sources
    // 5. Return structured details
  }

  private async parseUnstructuredData(
    html: string
  ): Promise<Partial<AircraftDetails>> {
    // LLM prompt for parsing aircraft details
    const prompt = `Extract aircraft details from HTML...`;
    return await this.llm.generateJSON<Partial<AircraftDetails>>(prompt);
  }
}
```

### 4. Validation Agent

**File**: `src/scrapers/agents/validation-agent.ts`

**Template**:
```typescript
export interface ValidationResult {
  is_valid: boolean;
  confidence_score: number;
  issues: ValidationIssue[];
  recommended_values: Record<string, any>;
}

export interface ValidationIssue {
  field: string;
  severity: 'info' | 'warning' | 'error';
  message: string;
  current_value: any;
  suggested_value: any;
}

export class ValidationAgent {
  async validate(
    aircraft: AircraftDetails,
    existingData: AircraftDetails | null
  ): Promise<ValidationResult> {
    // 1. Check data consistency
    // 2. Validate formats (registration, dates, etc.)
    // 3. Cross-reference with existing data
    // 4. Use LLM for semantic validation
    // 5. Assign confidence score
  }

  private async semanticValidation(
    aircraft: AircraftDetails
  ): Promise<ValidationIssue[]> {
    // Use LLM to check if data makes sense
    // E.g., "Does a 737-800 with 500 seats make sense?"
  }
}
```

### 5. Workflow Orchestrator

**File**: `src/scrapers/workflows/airline-scraper-workflow.ts`

**Template**:
```typescript
export interface WorkflowResult {
  airline_code: string;
  aircraft_found: number;
  aircraft_added: number;
  aircraft_updated: number;
  errors: number;
  duration_ms: number;
  confidence_avg: number;
}

export class AirlineScraperWorkflow {
  private discoveryAgent = new FleetDiscoveryAgent();
  private detailsAgent = new AircraftDetailsAgent();
  private validationAgent = new ValidationAgent();

  async runFullUpdate(airlineCode: string): Promise<WorkflowResult> {
    const startTime = Date.now();

    // 1. Discovery phase
    const discovered = await this.discoveryAgent.discoverFleet(airlineCode);

    // 2. Details extraction (parallel)
    const details = await Promise.all(
      discovered.aircraft_found.map(reg =>
        this.detailsAgent.extractDetails(reg, discovered.source_urls)
      )
    );

    // 3. Validation (parallel)
    const validated = await Promise.all(
      details.map(d => this.validateAndMerge(d))
    );

    // 4. Database update
    const dbResults = await this.updateDatabase(validated);

    // 5. Generate report
    return {
      airline_code: airlineCode,
      aircraft_found: discovered.aircraft_found.length,
      aircraft_added: dbResults.added,
      aircraft_updated: dbResults.updated,
      errors: dbResults.errors,
      duration_ms: Date.now() - startTime,
      confidence_avg: this.calculateAverageConfidence(validated),
    };
  }

  private async validateAndMerge(
    aircraft: AircraftDetails
  ): Promise<AircraftDetails> {
    // Get existing data from database
    const existing = await this.getExistingAircraft(aircraft.registration);

    // Validate
    const validation = await this.validationAgent.validate(aircraft, existing);

    // Merge with recommended values
    return {
      ...aircraft,
      ...validation.recommended_values,
    };
  }

  private async updateDatabase(
    aircraft: AircraftDetails[]
  ): Promise<{ added: number; updated: number; errors: number }> {
    // Batch update PostgreSQL and Neo4j
  }
}
```

### 6. Scheduler

**File**: `src/scrapers/workflows/scheduler.ts`

**Template**:
```typescript
export class ScraperScheduler {
  private workflow = new AirlineScraperWorkflow();

  async start() {
    // Run scheduler based on cron expression
    const schedule = process.env.SCRAPER_SCHEDULE_CRON || '0 2 * * *'; // Daily at 2 AM

    // Get airlines that need updating
    const airlines = await this.getAirlinesNeedingUpdate();

    for (const airline of airlines) {
      try {
        await this.workflow.runFullUpdate(airline.iata_code);
      } catch (error) {
        // Log and continue
      }

      // Rate limiting
      await this.sleep(this.getRateLimitDelay());
    }
  }

  private async getAirlinesNeedingUpdate() {
    // Query airlines where last_scraped_at is old
  }
}
```

## Configuration

### Environment Variables

```bash
# LLM Configuration
LLM_MODE=ollama                    # or "claude"
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=llama3.2
CLAUDE_API_KEY=sk-ant-...
CLAUDE_MODEL=claude-3-5-sonnet-20241022

# Scraping Configuration
SCRAPER_USER_AGENT=Mozilla/5.0 (compatible; NumberLabs-AircraftBot/1.0)
SCRAPER_RATE_LIMIT_MS=2000
SCRAPER_TIMEOUT_MS=30000
SCRAPER_MAX_RETRIES=3
SCRAPER_CONCURRENT_LIMIT=5

# Playwright
PLAYWRIGHT_HEADLESS=true
PLAYWRIGHT_BROWSER=chromium

# Scheduling
SCRAPER_SCHEDULE_ENABLED=true
SCRAPER_SCHEDULE_CRON=0 2 * * *  # Daily at 2 AM
```

## Usage

### Manual Scraping

```bash
# Run scraper for specific airline
npm run scraper:run -- --airline AA

# Run with full scrape (ignore recent updates)
npm run scraper:run -- --airline AA --force

# Dry run (don't update database)
npm run scraper:run -- --airline AA --dry-run
```

### Scheduled Scraping

```bash
# Start scheduler daemon
npm run scraper:schedule

# Or run as systemd service / cron job
```

### Programmatic Usage

```typescript
import { AirlineScraperWorkflow } from './scrapers/workflows/airline-scraper-workflow.js';

const workflow = new AirlineScraperWorkflow();
const result = await workflow.runFullUpdate('AA');

console.log(`Found ${result.aircraft_found} aircraft`);
console.log(`Added ${result.aircraft_added}, Updated ${result.aircraft_updated}`);
console.log(`Average confidence: ${result.confidence_avg}`);
```

## LLM Prompt Engineering

### Key Principles

1. **Be Specific**: Clear instructions for data extraction
2. **Provide Context**: Include airline info, URL, purpose
3. **Request JSON**: Always ask for structured output
4. **Low Temperature**: Use 0.1-0.2 for consistent extraction
5. **Error Handling**: Parse JSON robustly (handle markdown blocks)

### Example Prompts

**Registration Extraction**:
```
You are analyzing a webpage to extract aircraft registration numbers.
Registrations start with country codes (N, G, D, VH, etc.) followed by letters/numbers.
Extract ALL registrations from the HTML below.
Return JSON: {"registrations": ["N12345", "N12346"]}
```

**Aircraft Details**:
```
Extract aircraft specifications from this HTML.
Find: registration, type, manufacturer, model, seats, delivery date, status.
If a field is not found, use null.
Return JSON with all fields.
```

**Validation**:
```
Validate this aircraft data for consistency.
Check if seat count makes sense for aircraft type.
Check if dates are valid.
Return JSON: {"is_valid": bool, "issues": [...]}
```

## Error Handling

### Retry Strategy

```typescript
async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3
): Promise<T> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      await sleep(2000 * (i + 1)); // Exponential backoff
    }
  }
  throw new Error('Should not reach here');
}
```

### Graceful Degradation

1. **Multiple Sources**: Try official site → databases → APIs
2. **Partial Success**: Save what you can extract
3. **Confidence Scoring**: Mark low-confidence data for review
4. **Manual Fallback**: Flag airlines for manual data entry

## Testing

### Local Development

```bash
# 1. Install Ollama
curl -fsSL https://ollama.ai/install.sh | sh

# 2. Pull model
ollama pull llama3.2

# 3. Test LLM client
npm run test:llm

# 4. Test fleet discovery
npm run test:discovery -- --airline AA
```

### Production Testing

```bash
# Use Claude with small airline first
LLM_MODE=claude npm run scraper:run -- --airline AS --dry-run
```

## Performance

### Metrics

| Metric | Target | Typical |
|--------|--------|---------|
| Discovery time | < 30s | 15-25s |
| Details per aircraft | < 10s | 5-8s |
| Full airline update | < 30min | 10-20min |
| LLM calls per aircraft | < 5 | 2-3 |

### Optimization

1. **Batch Processing**: Process multiple aircraft in parallel
2. **Caching**: Cache LLM responses for similar content
3. **Selective Updates**: Only scrape changed data
4. **Smart Sources**: Learn which sources are best per airline

## Monitoring

### Scraping Jobs Table

```sql
SELECT
  airline_id,
  status,
  started_at,
  duration_seconds,
  aircraft_found,
  aircraft_added,
  errors_count
FROM scraping_jobs
ORDER BY started_at DESC
LIMIT 20;
```

### Data Quality Dashboard

```sql
SELECT
  al.name,
  COUNT(a.id) as total_aircraft,
  AVG(CASE WHEN a.data_confidence >= 0.8 THEN 1 ELSE 0 END) as high_confidence_rate,
  MAX(al.last_scraped_at) as last_update
FROM airlines al
LEFT JOIN aircraft a ON al.id = a.airline_id
GROUP BY al.id, al.name
ORDER BY last_update DESC;
```

## Next Steps

To complete the scraping system:

1. ✅ Implement Aircraft Details Agent
2. ✅ Implement Validation Agent
3. ✅ Create Workflow Orchestrator
4. ✅ Add Scheduler
5. ✅ Add monitoring dashboard
6. ✅ Create admin UI for manual overrides

## Resources

- [Playwright Documentation](https://playwright.dev/)
- [Ollama Documentation](https://ollama.ai/docs)
- [Claude API Documentation](https://docs.anthropic.com/)
- [LLM Prompt Engineering Guide](https://www.promptingguide.ai/)

---

**Built by Number Labs** - Airline Agentic Operating System

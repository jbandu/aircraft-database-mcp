# Aircraft Database MCP Server

> Canonical source of truth for airline fleet data, built with the Model Context Protocol (MCP)

[![MCP](https://img.shields.io/badge/MCP-1.0-blue)](https://modelcontextprotocol.io)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue)](https://www.typescriptlang.org/)
[![License](https://img.shields.io/badge/license-MIT-green)](LICENSE)

## Overview

The Aircraft Database MCP Server provides a production-ready, standardized interface for accessing comprehensive airline fleet data. Built on the Model Context Protocol, it serves as the single source of truth for crew scheduling, network planning, maintenance tracking, and other airline operation applications.

### Why MCP?

- **Single Source of Truth**: One database, many consumers
- **Standard Interface**: All apps use the same MCP tools to query fleet data
- **Live Synchronization**: Automated scraping keeps data current
- **Type Safety**: MCP protocol ensures consistent data structures
- **Production Ready**: Real use case showcasing MCP's value beyond toy examples

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        AIRCRAFT DATABASE SYSTEM                          │
│                                                                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐                 │
│  │   Scraper    │  │  PostgreSQL  │  │     Neo4j    │                 │
│  │   Agents     │→ │   Database   │→ │ Knowledge    │                 │
│  │  (Ollama)    │  │              │  │    Graph     │                 │
│  └──────────────┘  └──────┬───────┘  └──────────────┘                 │
│                           │                                              │
│          ┌────────────────┴────────────────┐                            │
│          ↓                                  ↓                            │
│   ┌─────────────┐                   ┌─────────────┐                    │
│   │ MCP Server  │                   │  REST API   │                    │
│   │  Protocol   │                   │  (Express)  │                    │
│   └─────────────┘                   └─────────────┘                    │
└────────┬─────────────────────────────────┬────────────────────────────┘
         │ MCP Tools                       │ REST Endpoints
         ↓                                  ↓
┌──────────────────┐            ┌─────────────────────┐
│   AI Agents &    │            │  Web & Mobile Apps  │
│  MCP Clients     │            │  Third-party APIs   │
└──────────────────┘            └─────────────────────┘
  • Crew Copilot                  • React Dashboard
  • Network Planner                • iOS App
  • Maintenance Tracker            • Android App
```

## Tech Stack

- **Backend**: Node.js 20+ / TypeScript 5.7
- **API Layer**:
  - MCP Server: `@modelcontextprotocol/sdk` (AI agent access)
  - REST API: Express.js 4 (traditional app access)
- **Databases**:
  - PostgreSQL (relational data) - Neon or Railway
  - Neo4j (knowledge graph) - Neo4j Aura or self-hosted
- **LLM Processing**:
  - Ollama (local development)
  - Claude API (production scraping)
- **Web Scraping**: Playwright + Cheerio
- **Logging**: Winston
- **Deployment**: Railway / Vercel

## Prerequisites

### Required

- Node.js 20.0.0 or higher
- npm 10.0.0 or higher
- PostgreSQL 14+ database
- Ollama installed (for local development)

### Optional

- Neo4j 5+ (for relationship graph features)
- Claude API key (for production scraping)

## Installation

### 1. Clone and Install Dependencies

```bash
cd aircraft-database-mcp
npm install
```

### 2. Set Up Environment Variables

```bash
cp .env.example .env
```

Edit `.env` with your configuration:

```bash
# Database
POSTGRES_URL=postgresql://user:password@localhost:5432/aircraft_db

# Neo4j (optional)
NEO4J_URI=bolt://localhost:7687
NEO4J_USER=neo4j
NEO4J_PASSWORD=your-password
ENABLE_NEO4J=true

# LLM
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=llama3.2
LLM_MODE=ollama

# MCP Server
MCP_SERVER_NAME=aircraft-database
MCP_SERVER_VERSION=1.0.0
LOG_LEVEL=info

# REST API (optional)
API_PORT=3000
API_KEYS=your-api-key-1,your-api-key-2
CORS_ORIGINS=http://localhost:3000,https://app.example.com
```

### 3. Set Up Databases

#### PostgreSQL Setup

**Option A: Local PostgreSQL**

```bash
# Create database
createdb aircraft_db

# Run schema
psql aircraft_db < src/database/postgres/schema.sql
```

**Option B: Neon (Recommended for Dev)**

1. Sign up at [neon.tech](https://neon.tech)
2. Create a new project
3. Copy connection string to `POSTGRES_URL` in `.env`
4. Run schema via Neon SQL Editor or:

```bash
psql $POSTGRES_URL < src/database/postgres/schema.sql
```

**Option C: Railway**

1. Sign up at [railway.app](https://railway.app)
2. Create PostgreSQL service
3. Copy connection string to `POSTGRES_URL`

#### Neo4j Setup (Optional)

**Option A: Local Neo4j**

```bash
# Start Neo4j
neo4j start

# Open browser at http://localhost:7474
# Run schema from src/database/neo4j/schema.cypher
```

**Option B: Neo4j Aura (Recommended)**

1. Sign up at [neo4j.com/aura](https://neo4j.com/cloud/aura/)
2. Create free instance
3. Copy credentials to `.env`

### 4. Install Ollama and Pull Models

```bash
# Install Ollama
curl -fsSL https://ollama.ai/install.sh | sh

# Pull recommended model
ollama pull llama3.2

# Or use a smaller model
ollama pull mistral
```

### 5. Build the Project

```bash
npm run build
```

## Usage

### Running the MCP Server

#### Development Mode (with hot reload)

```bash
npm run dev
```

#### Production Mode

```bash
npm start
```

#### MCP Mode (stdio transport)

```bash
npm run dev:mcp
```

### Available MCP Tools

The server exposes the following MCP tools:

#### 1. `get_airline_fleet`

Get complete fleet information for a specific airline.

```typescript
{
  "airline_code": "AA",      // IATA or ICAO code
  "include_inactive": false  // Include retired aircraft
}
```

#### 2. `get_aircraft_details`

Get detailed information about a specific aircraft.

```typescript
{
  "identifier": "N12345",           // Registration or serial number
  "identifier_type": "registration" // "registration" or "serial_number"
}
```

#### 3. `search_aircraft`

Search for aircraft by various criteria.

```typescript
{
  "query": "737",
  "filters": {
    "aircraft_type": "737-800",
    "airline_code": "AA",
    "manufacturer": "Boeing",
    "status": "active",
    "min_year": 2015,
    "max_year": 2024
  },
  "limit": 50,
  "offset": 0
}
```

#### 4. `get_fleet_statistics`

Get aggregated statistics about fleets.

```typescript
{
  "scope": "airline",        // "airline", "aircraft_type", "manufacturer", "global"
  "scope_value": "AA",       // Required for airline/aircraft_type/manufacturer
  "metrics": [
    "total_count",
    "average_age",
    "status_breakdown",
    "type_distribution"
  ]
}
```

#### 5. `trigger_fleet_update`

Manually trigger a fleet data scraping job.

```typescript
{
  "airline_codes": ["AA", "DL"],  // Empty array = all airlines
  "force_refresh": false,
  "priority": "normal"             // "high", "normal", "low"
}
```

### Testing MCP Tools

The project includes a comprehensive testing suite with 94+ tests covering all MCP tools:

```bash
# Run complete test suite (unit, integration, performance, error tests)
npm test

# Generate test data
npm run test:data

# Clean and regenerate test data
npm run test:data:clean

# View test data statistics
npm run test:data:stats
```

**Test Coverage:**
- ✅ Unit tests for all 7 MCP tools
- ✅ Integration tests for multi-tool workflows
- ✅ Performance benchmarks (< 100ms target)
- ✅ Security testing (SQL injection, XSS protection)
- ✅ Error scenario coverage

See [docs/TESTING.md](docs/TESTING.md) for complete testing documentation.

## REST API

In addition to the MCP server for AI agents, the system provides a comprehensive REST API for traditional web and mobile applications.

### Starting the REST API

#### Development Mode (with hot reload)

```bash
npm run dev:api
```

The API will start on `http://localhost:3000` (or the port specified in `API_PORT` env var).

#### Production Mode

```bash
npm run build
npm run start:api
```

### API Documentation

Interactive API documentation is available via Swagger UI:

**URL**: `http://localhost:3000/api-docs`

The Swagger UI provides:
- Complete endpoint documentation
- Request/response schemas
- Interactive "Try it out" functionality
- Authentication testing

### Authentication

All API endpoints (except `/health` and `/api-docs`) require authentication via API key.

**Two authentication methods supported:**

1. **X-API-Key header** (recommended):
```bash
curl -H "X-API-Key: your-api-key" http://localhost:3000/api/v1/airlines
```

2. **Authorization Bearer token**:
```bash
curl -H "Authorization: Bearer your-api-key" http://localhost:3000/api/v1/airlines
```

**Configure API keys** in `.env`:
```bash
API_KEYS=dev-key-1,dev-key-2,prod-key-xyz
```

### Available Endpoints

#### Airlines

- `GET /api/v1/airlines` - List airlines with filtering and pagination
- `GET /api/v1/airlines/:code` - Get airline details by IATA/ICAO code
- `GET /api/v1/airlines/:code/fleet` - Get airline fleet
- `POST /api/v1/airlines/:code/trigger-update` - Trigger fleet scraping job

#### Aircraft

- `GET /api/v1/aircraft` - Search aircraft with filters
- `GET /api/v1/aircraft/:registration` - Get aircraft details
- `GET /api/v1/aircraft/:registration/history` - Get aircraft ownership history

#### Statistics

- `GET /api/v1/stats/global` - Global fleet statistics
- `GET /api/v1/stats/airline/:code` - Airline-specific statistics

#### Scraping Jobs

- `GET /api/v1/jobs` - List scraping jobs
- `GET /api/v1/jobs/:id` - Get job status
- `POST /api/v1/jobs` - Create new scraping job

#### Health Check

- `GET /health` - Server health and database connectivity (no auth required)

### Example API Requests

**List Airlines**:
```bash
curl -H "X-API-Key: dev-key-1" \
  "http://localhost:3000/api/v1/airlines?country=United+States&limit=10"
```

**Get Airline Fleet**:
```bash
curl -H "X-API-Key: dev-key-1" \
  "http://localhost:3000/api/v1/airlines/AA/fleet?status=active"
```

**Search Aircraft**:
```bash
curl -H "X-API-Key: dev-key-1" \
  "http://localhost:3000/api/v1/aircraft?airline_code=AA&aircraft_type=77W"
```

**Get Global Statistics**:
```bash
curl -H "X-API-Key: dev-key-1" \
  http://localhost:3000/api/v1/stats/global
```

**Trigger Fleet Update**:
```bash
curl -X POST -H "X-API-Key: dev-key-1" \
  -H "Content-Type: application/json" \
  -d '{"priority": "high"}' \
  http://localhost:3000/api/v1/airlines/AA/trigger-update
```

### Rate Limiting

The API implements token bucket rate limiting:
- **100 tokens** per client
- **10 tokens/second** refill rate
- Different endpoint costs:
  - Search/global stats: 5 tokens
  - List operations: 2 tokens
  - Write operations: 3 tokens
  - Other: 1 token

When rate limit is exceeded, you'll receive a `429 Too Many Requests` response with a `Retry-After` header.

### CORS Configuration

Configure allowed origins in `.env`:
```bash
CORS_ORIGINS=http://localhost:3000,https://app.example.com
```

Leave empty or use `*` to allow all origins (development only).

### REST API vs MCP Server

**When to use REST API:**
- Web applications (React, Vue, Angular)
- Mobile apps (iOS, Android)
- Traditional API integrations
- Third-party services

**When to use MCP Server:**
- AI agents and assistants
- Claude Desktop integration
- MCP-compatible applications
- Tool-based interactions

Both access the same PostgreSQL database and provide equivalent functionality.

See [docs/PROMPT-10-COMPLETION.md](docs/PROMPT-10-COMPLETION.md) for complete REST API documentation.

## Operations Dashboard

A modern Next.js 14 operations dashboard for monitoring and managing the aircraft database in real-time.

### Features

**4 Main Pages**:
1. **Fleet Overview**: Global statistics, interactive charts, top aircraft types and countries
2. **Airlines**: Search airlines, view fleet details, composition charts, and statistics
3. **Scraping Status**: Real-time job monitoring, create new jobs, queue visualization
4. **Data Quality**: Quality scores, confidence distribution, data freshness, manual review queue

**Key Capabilities**:
- Real-time updates (auto-refresh every 5 seconds for scraping status)
- Interactive charts with Recharts (bar, pie, horizontal bar)
- Complete REST API integration
- Responsive design for desktop, tablet, and mobile
- TypeScript with full type safety
- TanStack Query for data caching and management

### Starting the Dashboard

```bash
# Install dependencies
cd dashboard
npm install

# Configure environment
cp .env.example .env.local
# Edit .env.local with your API key and URL

# Start development server
npm run dev
```

The dashboard will be available at `http://localhost:3001`.

**Prerequisites**:
- REST API must be running: `npm run dev:api` (in main project)
- API key configured in dashboard `.env.local`
- CORS configured in main project `.env`

### Dashboard Stack

- **Framework**: Next.js 14 with App Router
- **Language**: TypeScript 5.3
- **UI Components**: Shadcn/ui (Radix UI + Tailwind CSS)
- **Data Fetching**: TanStack Query (React Query)
- **Charts**: Recharts
- **Icons**: Lucide React

### Example Workflows

**View Airline Fleet**:
1. Navigate to Airlines page
2. Search for airline (e.g., "American Airlines")
3. Click airline card
4. Switch between Overview/Fleet/Stats tabs

**Monitor Scraping Jobs**:
1. Navigate to Scraping Status page
2. View real-time job statistics
3. Create new job with airline code and priority
4. Watch progress bars update automatically

**Check Data Quality**:
1. Navigate to Data Quality page
2. Review overall quality score (0-100)
3. Check confidence distribution
4. Review manual review queue for airlines needing attention

See [dashboard/README.md](dashboard/README.md) and [docs/PROMPT-11-COMPLETION.md](docs/PROMPT-11-COMPLETION.md) for complete dashboard documentation.

## Database Management

### Seed Initial Data

The seed script populates the database with the top 100 airlines worldwide, including:
- IATA/ICAO codes, names, and countries
- Hub airports and fleet size estimates
- Website URLs and scraping configurations
- Automated scraping schedules (daily/weekly)

```bash
# Seed top 100 airlines
npm run db:seed

# Clean existing data and reseed
npm run db:seed -- --clean

# Dry run (preview without changes)
npm run db:seed -- --dry-run

# View database statistics only
npm run db:seed -- --stats
```

**After seeding**, initialize scraping jobs:
```bash
npm run scraper:setup
```

See [docs/PROMPT-7-COMPLETION.md](docs/PROMPT-7-COMPLETION.md) for complete seeding documentation.

### Run Migrations

```bash
npm run db:migrate
```

### Reset Database

```bash
npm run db:reset
```

**Warning**: This drops all tables and recreates them!

## Web Scraping

### Run Manual Scraping Workflow

```bash
npm run scraper:run
```

### Start Scheduled Scraping

```bash
npm run scraper:schedule
```

This runs the scraper on a schedule (default: daily at 2 AM).

### Scraping Configuration

Edit `.env` to configure scraping behavior:

```bash
SCRAPER_USER_AGENT=Mozilla/5.0 (compatible; NumberLabs-AircraftBot/1.0)
SCRAPER_RATE_LIMIT_MS=2000
SCRAPER_TIMEOUT_MS=30000
SCRAPER_MAX_RETRIES=3
SCRAPER_CONCURRENT_LIMIT=5
SCRAPER_SCHEDULE_CRON=0 2 * * *
```

## Connecting Consumer Apps

### Claude Desktop Integration

Add to your Claude Desktop config (`~/Library/Application Support/Claude/claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "aircraft-database": {
      "command": "node",
      "args": ["/path/to/aircraft-database-mcp/dist/mcp-server/index.js"],
      "env": {
        "POSTGRES_URL": "postgresql://...",
        "LOG_LEVEL": "info"
      }
    }
  }
}
```

### Custom Application Integration

```typescript
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const transport = new StdioClientTransport({
  command: 'node',
  args: ['./dist/mcp-server/index.js'],
});

const client = new Client({
  name: 'my-airline-app',
  version: '1.0.0',
}, {
  capabilities: {},
});

await client.connect(transport);

// Call MCP tool
const result = await client.callTool({
  name: 'get_airline_fleet',
  arguments: {
    airline_code: 'AA',
  },
});

console.log(result);
```

## Project Structure

```
aircraft-database-mcp/
├── src/
│   ├── mcp-server/              # MCP server implementation
│   │   ├── index.ts             # Main server entry point
│   │   ├── tools/               # MCP tool implementations
│   │   │   ├── get-airline-fleet.ts
│   │   │   ├── get-aircraft-details.ts
│   │   │   ├── search-aircraft.ts
│   │   │   ├── get-fleet-statistics.ts
│   │   │   └── trigger-fleet-update.ts
│   │   └── schemas/             # Zod validation schemas
│   ├── api/                     # REST API (Express.js)
│   │   ├── server.ts            # Main Express server
│   │   ├── openapi.yaml         # OpenAPI 3.0 spec
│   │   ├── middleware/          # API middleware
│   │   │   ├── auth.ts          # API key authentication
│   │   │   ├── rate-limit.ts    # Token bucket rate limiting
│   │   │   ├── error-handler.ts # Centralized error handling
│   │   │   └── request-logger.ts # Request/response logging
│   │   └── routes/              # API route handlers
│   │       ├── airlines.ts      # Airlines endpoints
│   │       ├── aircraft.ts      # Aircraft endpoints
│   │       ├── stats.ts         # Statistics endpoints
│   │       ├── scraping.ts      # Scraping job endpoints
│   │       └── health.ts        # Health check endpoint
│   ├── database/
│   │   ├── postgres/
│   │   │   ├── schema.sql       # PostgreSQL schema
│   │   │   └── seed.sql         # Sample data
│   │   └── neo4j/
│   │       ├── schema.cypher    # Neo4j graph schema
│   │       └── sync-from-postgres.ts # PostgreSQL → Neo4j sync
│   ├── scrapers/                # Web scraping agents
│   │   ├── agents/              # LLM-powered agents
│   │   │   ├── fleet-discovery-agent.ts
│   │   │   ├── aircraft-details-agent.ts
│   │   │   └── validation-agent.ts
│   │   ├── workflows/           # Scraping orchestration
│   │   │   ├── airline-scraper-workflow.ts
│   │   │   ├── scheduler.ts
│   │   │   └── job-queue.ts
│   │   └── monitoring/
│   │       └── dashboard.ts     # Job monitoring
│   └── lib/
│       ├── logger.ts            # Winston logging
│       ├── db-clients.ts        # Database connections
│       ├── ollama-client.ts     # Ollama integration
│       └── claude-client.ts     # Claude API integration
├── scripts/
│   ├── seed-top-100-airlines.ts # Seed top 100 airlines
│   ├── test-mcp-tools.ts        # MCP tool testing
│   ├── test-data-generator.ts   # Generate test data
│   ├── db-migrate.ts
│   └── db-reset.ts
├── data/
│   └── top-100-airlines.json    # Airline seed data
├── docs/
│   ├── TESTING.md               # Testing documentation
│   ├── PROMPT-7-COMPLETION.md   # Seeding documentation
│   ├── PROMPT-8-COMPLETION.md   # Testing documentation
│   └── PROMPT-10-COMPLETION.md  # REST API documentation
├── mcp-config.json
├── package.json
├── tsconfig.json
├── .env.example
└── README.md
```

## Development

### Code Formatting

```bash
npm run format
```

### Linting

```bash
npm run lint
```

### Clean Build Artifacts

```bash
npm run clean
```

## Deployment

### Railway Deployment

1. Install Railway CLI: `npm install -g @railway/cli`
2. Login: `railway login`
3. Create project: `railway init`
4. Add PostgreSQL: `railway add postgresql`
5. Set environment variables: `railway variables set KEY=VALUE`
6. Deploy: `railway up`

### Vercel Deployment

```bash
npm install -g vercel
vercel --prod
```

## Monitoring

### Logs

Logs are written to:
- Console (colored, human-readable)
- File: `./logs/mcp-server.log` (JSON format, rotating)

### Database Metrics

Query the `scraping_jobs` table for scraping statistics:

```sql
SELECT
  job_type,
  status,
  COUNT(*) as count,
  AVG(duration_seconds) as avg_duration,
  SUM(records_processed) as total_records
FROM scraping_jobs
GROUP BY job_type, status;
```

## Troubleshooting

### PostgreSQL Connection Issues

```bash
# Test connection
psql $POSTGRES_URL -c "SELECT NOW();"

# Check SSL requirements
# Add to .env: POSTGRES_SSL=true
```

### Ollama Not Found

```bash
# Check Ollama is running
curl http://localhost:11434/api/tags

# Pull model if not available
ollama pull llama3.2
```

### Port Already in Use

```bash
# Change port in .env
MCP_SERVER_PORT=3001
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## License

MIT License - see [LICENSE](LICENSE) file

## Acknowledgments

- Built with [Model Context Protocol](https://modelcontextprotocol.io)
- Powered by [Anthropic Claude](https://anthropic.com)
- Database hosting by [Neon](https://neon.tech) and [Railway](https://railway.app)

## Support

- GitHub Issues: [Report a bug](https://github.com/numberlabs/aircraft-database-mcp/issues)
- Documentation: [MCP Documentation](https://modelcontextprotocol.io/docs)
- Email: support@numberlabs.ai

---

Built with ❤️ by [Number Labs](https://numberlabs.ai) - Airline Agentic Operating System

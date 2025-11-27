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
┌─────────────────────────────────────────────────────────────┐
│                    AIRCRAFT DATABASE                        │
│                       MCP SERVER                             │
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │   Scraper    │  │  PostgreSQL  │  │     Neo4j    │     │
│  │   Agents     │→ │   Database   │→ │ Knowledge    │     │
│  │  (Ollama)    │  │              │  │    Graph     │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
│                           ↓                                  │
│                    ┌─────────────┐                          │
│                    │ MCP Server  │                          │
│                    │  Protocol   │                          │
│                    └─────────────┘                          │
└────────────────────────────┬────────────────────────────────┘
                             │ MCP Tools
            ┌────────────────┼────────────────┐
            ↓                ↓                ↓
    ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
    │ Crew Copilot │ │   Network    │ │ Maintenance  │
    │     App      │ │  Planner App │ │  Tracker App │
    └──────────────┘ └──────────────┘ └──────────────┘
```

## Tech Stack

- **Backend**: Node.js 20+ / TypeScript 5.7
- **MCP SDK**: `@modelcontextprotocol/sdk`
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

```bash
npm test
```

This runs the test script that exercises all MCP tools with sample queries.

## Database Management

### Seed Initial Data

```bash
npm run db:seed
```

This populates the database with top 100 airlines worldwide.

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
│   ├── database/
│   │   ├── postgres/
│   │   │   ├── schema.sql       # PostgreSQL schema
│   │   │   └── seed.sql         # Sample data
│   │   └── neo4j/
│   │       └── schema.cypher    # Neo4j graph schema
│   ├── scrapers/                # Web scraping agents
│   │   ├── agents/              # LLM-powered agents
│   │   │   ├── fleet-discovery-agent.ts
│   │   │   ├── aircraft-details-agent.ts
│   │   │   └── validation-agent.ts
│   │   └── workflows/           # Scraping orchestration
│   │       ├── airline-scraper-workflow.ts
│   │       └── scheduler.ts
│   ├── api/                     # Optional REST API
│   │   └── routes/
│   └── lib/
│       ├── logger.ts            # Winston logging
│       ├── db-clients.ts        # Database connections
│       ├── ollama-client.ts     # Ollama integration
│       └── claude-client.ts     # Claude API integration
├── scripts/
│   ├── seed-top-100-airlines.ts
│   ├── test-mcp-tools.ts
│   ├── db-migrate.ts
│   └── db-reset.ts
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

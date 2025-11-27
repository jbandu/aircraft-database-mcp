# Architecture Documentation

## System Overview

The Aircraft Database MCP Server is a multi-layered system providing AI agents and applications with comprehensive aircraft fleet data through standardized protocols.

## High-Level Architecture

```
┌───────────────────────────────────────────────────────────────────────┐
│                     PRESENTATION LAYER                                 │
│  ┌──────────────────────┐    ┌──────────────────────┐                │
│  │   MCP Protocol       │    │     REST API         │                │
│  │   (AI Agents)        │    │   (Web/Mobile)       │                │
│  └──────────┬───────────┘    └──────────┬───────────┘                │
└─────────────┼───────────────────────────┼────────────────────────────┘
              │                           │
┌─────────────┼───────────────────────────┼────────────────────────────┐
│             │      APPLICATION LAYER    │                            │
│  ┌──────────▼───────────┐    ┌─────────▼────────────┐               │
│  │  MCP Server          │    │   Express API        │               │
│  │  - 7 Tools           │    │   - REST Endpoints   │               │
│  │  - Type Safety       │    │   - Authentication   │               │
│  │  - Rate Limiting     │    │   - Rate Limiting    │               │
│  └──────────┬───────────┘    └─────────┬────────────┘               │
└─────────────┼───────────────────────────┼────────────────────────────┘
              │                           │
┌─────────────┼───────────────────────────┼────────────────────────────┐
│             │      BUSINESS LOGIC       │                            │
│  ┌──────────▼───────────────────────────▼────────────┐              │
│  │              Query Processors                      │              │
│  │  - Fleet Management  - Statistics                 │              │
│  │  - Aircraft Search   - Data Quality               │              │
│  └──────────────────────┬──────────────────────────── ┘              │
│  ┌──────────────────────▼────────────────────────────┐              │
│  │           Scraping Orchestration                   │              │
│  │  - LLM-Powered Agents - Job Queue                 │              │
│  │  - Validation         - Scheduler                 │              │
│  └──────────────────────┬────────────────────────────┘              │
└─────────────────────────┼────────────────────────────────────────────┘
                          │
┌─────────────────────────┼────────────────────────────────────────────┐
│             │      DATA LAYER           │                            │
│  ┌──────────▼───────────┐  ┌──────────▼────────────┐               │
│  │     PostgreSQL       │  │       Neo4j           │               │
│  │   - Transactional    │  │   - Knowledge Graph   │               │
│  │   - ACID             │  │   - Relationships     │               │
│  └──────────────────────┘  └───────────────────────┘               │
└───────────────────────────────────────────────────────────────────────┘
```

## Core Components

### 1. MCP Server

**Purpose**: Standardized tool interface for AI agents

**Technologies**:
- @modelcontextprotocol/sdk
- Node.js 20+
- TypeScript 5.7

**Tools Provided**:
1. `get-airline-fleet` - Complete fleet data
2. `get-aircraft-details` - Specific aircraft info
3. `search-aircraft` - Multi-criteria search
4. `get-fleet-statistics` - Aggregated analytics
5. `trigger-fleet-update` - Manual scraping
6. `get-aircraft-type-specs` - Type specifications
7. `get-fleet-availability` - Availability data

**Key Features**:
- Type-safe schemas with Zod
- Automatic validation
- Error handling
- Rate limiting
- Logging

### 2. REST API

**Purpose**: Traditional HTTP access for web/mobile apps

**Technologies**:
- Express.js 4
- OpenAPI 3.0
- Swagger UI

**Endpoints**: 13 endpoints across 4 domains
- Airlines (4 endpoints)
- Aircraft (3 endpoints)
- Statistics (2 endpoints)
- Scraping Jobs (3 endpoints)
- Health (1 endpoint)

**Middleware Stack**:
1. Helmet (security headers)
2. CORS (cross-origin)
3. Compression (gzip)
4. Request logging
5. Rate limiting
6. Authentication
7. Error handling

### 3. Data Layer

#### PostgreSQL
**Purpose**: Primary transactional database

**Schema**:
- `airlines` (100+ airlines)
- `aircraft` (50,000+ aircraft)
- `aircraft_types` (500+ types)
- `fleet_changes` (historical data)
- `scraping_jobs` (job queue)
- `api_keys` (authentication)

**Features**:
- ACID transactions
- Foreign key constraints
- Indexes for performance
- Triggers for updates
- Full-text search

#### Neo4j (Optional)
**Purpose**: Relationship-focused queries

**Graph Model**:
- Nodes: Airlines, Aircraft, AircraftTypes, Airports
- Relationships: OPERATES, HAS_TYPE, BASED_AT, TRANSFERRED_TO

**Use Cases**:
- Fleet transfer history
- Airline network analysis
- Aircraft lifecycle tracking
- Type commonality analysis

#### Redis (Optional)
**Purpose**: Caching and rate limiting

**Usage**:
- Token bucket rate limiting
- Query result caching
- Session storage
- Job queue locking

### 4. Scraping System

**Purpose**: Automated data collection from airline sources

**Architecture**:
```
┌──────────────────────────────────────────────────┐
│            Scraping Workflow                     │
│                                                   │
│  ┌────────────┐     ┌──────────────┐            │
│  │  Scheduler │────▶│  Job Queue   │            │
│  │  (cron)    │     │ (PostgreSQL) │            │
│  └────────────┘     └──────┬───────┘            │
│                            │                     │
│  ┌─────────────────────────▼──────────────────┐ │
│  │         Orchestrator                       │ │
│  │  - Selects job from queue                 │ │
│  │  - Manages agent lifecycle                │ │
│  │  - Handles retries and errors             │ │
│  └──┬──────────────┬────────────────┬─────────┘ │
│     │              │                │           │
│  ┌──▼──────┐  ┌───▼────────┐  ┌───▼──────┐    │
│  │  Fleet  │  │  Aircraft  │  │Validation│    │
│  │Discovery│  │  Details   │  │  Agent   │    │
│  │  Agent  │  │   Agent    │  │          │    │
│  └──┬──────┘  └───┬────────┘  └───┬──────┘    │
│     │             │               │            │
│  ┌──▼─────────────▼───────────────▼─────────┐ │
│  │        Data Persistence Layer           │ │
│  │        (PostgreSQL + Neo4j)              │ │
│  └──────────────────────────────────────────┘ │
└──────────────────────────────────────────────────┘
```

**Components**:

1. **Fleet Discovery Agent**:
   - Playwright browser automation
   - LLM-powered content extraction
   - Rate limiting and retry logic
   - Returns list of aircraft registrations

2. **Aircraft Details Agent**:
   - Batch processing of aircraft
   - Structured data extraction
   - Validation and confidence scoring
   - Parallel execution with limits

3. **Validation Agent**:
   - Cross-reference data sources
   - Consistency checking
   - Confidence scoring
   - Data quality metrics

4. **Job Queue**:
   - Priority-based scheduling
   - Automatic retries (3x)
   - Failure tracking
   - Status monitoring

5. **Scheduler**:
   - Cron-based triggers
   - Priority airlines (daily)
   - Normal airlines (weekly)
   - Manual trigger support

### 5. Operations Dashboard

**Purpose**: Real-time monitoring and management

**Technologies**:
- Next.js 14 (App Router)
- TanStack Query
- Recharts
- Shadcn/ui

**Pages**:
1. Fleet Overview - Global statistics and charts
2. Airlines - Search, view details, fleet composition
3. Scraping Status - Real-time job monitoring
4. Data Quality - Quality scores and review queue

**Features**:
- Real-time updates (5-second polling)
- Interactive charts
- Search and filtering
- Responsive design
- Type-safe API client

## Data Flow

### Query Flow (Read Operations)

```
User/Agent Request
      │
      ▼
┌─────────────┐
│ MCP/REST    │  Authentication & Rate Limiting
│ Interface   │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│  Query      │  Validation & Processing
│ Processor   │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│  Database   │  PostgreSQL Query
│   Layer     │  (with optional Neo4j)
└──────┬──────┘
       │
       ▼
┌─────────────┐
│  Response   │  Format & Return
│  Builder    │
└─────────────┘
```

### Scraping Flow (Write Operations)

```
Scheduled Trigger / Manual Request
      │
      ▼
┌──────────────┐
│  Job Queue   │  Create job with priority
└──────┬───────┘
       │
       ▼
┌──────────────┐
│ Orchestrator │  Pick next job
└──────┬───────┘
       │
       ▼
┌──────────────┐
│Fleet Discovery│ Playwright + LLM
│    Agent      │ Extract aircraft list
└──────┬───────┘
       │
       ▼
┌──────────────┐
│Aircraft Details│ Batch processing
│    Agent      │  Structured extraction
└──────┬───────┘
       │
       ▼
┌──────────────┐
│ Validation   │  Cross-check & score
│   Agent      │
└──────┬───────┘
       │
       ▼
┌──────────────┐
│  Database    │  Upsert aircraft
│   Update     │  Update confidence
└──────────────┘
```

## Security Architecture

### Authentication

**API Key-based**:
```
Request → Extract API Key → Validate → Process
              │                │
              ▼                ▼
       X-API-Key or      Environment
       Authorization     + Database
```

**Future: JWT Tokens**:
```
Login → Generate JWT → Include in requests → Verify & Decode
```

### Authorization

**Current**: All-or-nothing (valid key = full access)

**Future**: Role-based access control (RBAC)
- Admin: Full access
- Read-Only: Query tools only
- Operator: Query + trigger updates

### Rate Limiting

**Token Bucket Algorithm**:
```
Client ID (API Key or IP)
      │
      ▼
┌──────────────────┐
│   Token Bucket   │
│  Capacity: 100   │
│  Refill: 10/sec  │
└────────┬─────────┘
         │
         ▼
  Consume tokens based on endpoint cost:
  - Search: 5 tokens
  - List: 2 tokens
  - Write: 3 tokens
  - Read: 1 token
```

### Data Protection

**In Transit**:
- HTTPS/TLS 1.3
- Certificate validation
- Secure WebSockets (wss://)

**At Rest**:
- Encrypted PostgreSQL backups
- Secure environment variables
- Secrets management (Railway/Vercel)

**Application**:
- Parameterized queries (SQL injection prevention)
- Input validation (XSS prevention)
- Helmet security headers
- CORS whitelisting

## Scalability

### Horizontal Scaling

**API Servers**:
```
Load Balancer
      │
      ├──▶ API Instance 1
      ├──▶ API Instance 2
      └──▶ API Instance N
            │
            ▼
      Shared Database
```

**Benefits**:
- Handle more requests
- Zero-downtime deployments
- Fault tolerance

**Considerations**:
- Stateless design (no in-memory sessions)
- Distributed rate limiting (Redis)
- Connection pool limits

### Vertical Scaling

**Database**:
- Increase CPU/RAM
- Faster storage (NVMe)
- Read replicas

**Application**:
- Increase Node.js heap size
- More worker threads
- Larger connection pools

### Caching Strategy

**Layers**:
1. **Application Cache** (Redis):
   - Query results (5 min TTL)
   - Statistics (1 min TTL)
   - Aircraft types (24 hour TTL)

2. **CDN Cache** (Vercel Edge):
   - Static assets
   - Dashboard pages
   - API responses (short TTL)

3. **Browser Cache**:
   - Dashboard assets
   - API responses with ETag

### Database Optimization

**Indexes**:
```sql
CREATE INDEX idx_aircraft_airline ON aircraft(airline_id);
CREATE INDEX idx_aircraft_registration ON aircraft(registration);
CREATE INDEX idx_fleet_changes_date ON fleet_changes(change_date DESC);
```

**Query Optimization**:
- Use EXPLAIN ANALYZE
- Avoid N+1 queries
- Batch operations
- Connection pooling

**Partitioning** (Future):
```sql
-- Partition by airline
CREATE TABLE aircraft_aa PARTITION OF aircraft
  FOR VALUES IN ('AA');
```

## Monitoring & Observability

### Logging

**Structured Logging**:
```typescript
logger.info('fleet_update_completed', {
  airline: 'AA',
  duration_ms: 15000,
  aircraft_count: 850,
  confidence: 'high',
  timestamp: Date.now()
});
```

**Log Levels**:
- ERROR: Application errors, exceptions
- WARN: Deprecations, missing data
- INFO: Important events, completions
- DEBUG: Detailed debugging (dev only)

### Metrics

**Application Metrics**:
- Request rate (req/s)
- Response time (p50, p95, p99)
- Error rate (%)
- Active connections

**Business Metrics**:
- Total aircraft tracked
- Scraping success rate
- Data freshness
- Quality scores

**Infrastructure Metrics**:
- CPU usage (%)
- Memory usage (%)
- Disk I/O
- Network throughput

### Tracing

**Distributed Tracing**:
```
User Request
  │
  ├─ API Endpoint (5ms)
  │   ├─ Authentication (1ms)
  │   ├─ Rate Limiting (1ms)
  │   └─ Query Processing (3ms)
  │       ├─ Database Query (100ms)
  │       └─ Response Formatting (5ms)
  │
  └─ Total: 115ms
```

**Tools**:
- OpenTelemetry
- Jaeger
- Datadog APM

### Alerting

**Critical Alerts** (PagerDuty):
- API down > 1 minute
- Database connection failure
- Error rate > 10%

**Warning Alerts** (Email/Slack):
- Response time > 1s (p95)
- Error rate > 1%
- Scraping jobs failing
- Disk space > 80%

## Deployment Architecture

### Production (Railway + Vercel)

```
┌─────────────────────────────────────────────────┐
│                 Internet                        │
└─────────────┬───────────────────────────────────┘
              │
         ┌────┴────┐
         │         │
    ┌────▼────┐   ┌▼──────────┐
    │ Vercel  │   │  Railway  │
    │  Edge   │   │   Load    │
    │ Network │   │  Balancer │
    └────┬────┘   └┬──────────┘
         │         │
    ┌────▼────┐   ┌▼──────────────────────┐
    │Dashboard│   │   API Instances       │
    │ (Next.js│   │   ┌────┐ ┌────┐      │
    └─────────┘   │   │API1│ │API2│      │
                  │   └─┬──┘ └─┬──┘      │
                  │     └──────┬┘         │
                  │            │          │
                  │   ┌────────▼────────┐ │
                  │   │   PostgreSQL    │ │
                  │   └─────────────────┘ │
                  │   ┌─────────────────┐ │
                  │   │     Neo4j       │ │
                  │   └─────────────────┘ │
                  │   ┌─────────────────┐ │
                  │   │     Redis       │ │
                  │   └─────────────────┘ │
                  └───────────────────────┘
```

### Docker (Self-Hosted)

```
┌────────────────────────────────────┐
│         Docker Host                │
│                                    │
│  ┌──────────────────────────────┐ │
│  │     Docker Compose Stack     │ │
│  │                              │ │
│  │  ┌──────┐  ┌──────┐         │ │
│  │  │Nginx │  │ API  │         │ │
│  │  │Proxy │→ │      │         │ │
│  │  └──┬───┘  └──┬───┘         │ │
│  │     │         │              │ │
│  │     │    ┌────▼─────┐       │ │
│  │     │    │Dashboard │       │ │
│  │     │    └──────────┘       │ │
│  │     │                       │ │
│  │  ┌──▼───┐ ┌──────┐ ┌─────┐│ │
│  │  │Postgres Neo4j│ │Redis││ │
│  │  └──────┘ └──────┘ └─────┘│ │
│  └──────────────────────────────┘ │
└────────────────────────────────────┘
```

## Technology Stack Summary

### Backend
- Node.js 20+ (LTS)
- TypeScript 5.7
- Express.js 4
- MCP SDK 1.0

### Databases
- PostgreSQL 15
- Neo4j 5.15 (optional)
- Redis 7 (optional)

### LLM Integration
- Claude API (Anthropic)
- Ollama (local development)

### Frontend
- Next.js 14
- React 18
- TanStack Query 5
- Recharts 2

### DevOps
- Docker & Docker Compose
- GitHub Actions
- Railway (PaaS)
- Vercel (Dashboard)

### Monitoring
- Winston (logging)
- Sentry (errors)
- Datadog (APM)

## Future Enhancements

### Phase 1 (Q1 2025)
- [ ] WebSocket support for real-time updates
- [ ] Advanced caching with Redis
- [ ] User authentication (JWT)
- [ ] Role-based access control
- [ ] Enhanced monitoring dashboards

### Phase 2 (Q2 2025)
- [ ] GraphQL API
- [ ] ML-based anomaly detection
- [ ] Predictive analytics
- [ ] Mobile app (React Native)
- [ ] Elasticsearch integration

### Phase 3 (Q3 2025)
- [ ] Multi-tenancy support
- [ ] Advanced AI agents
- [ ] Real-time collaboration
- [ ] Data marketplace
- [ ] API versioning

## Best Practices

### Development
- Write tests for all new features
- Use TypeScript strictly (no `any`)
- Document complex logic
- Keep functions small and focused
- Follow SOLID principles

### Deployment
- Always test in staging first
- Run migrations before deployment
- Monitor error rates post-deploy
- Keep rollback plan ready
- Document all changes

### Operations
- Monitor key metrics 24/7
- Set up meaningful alerts
- Regular database backups
- Security updates promptly
- Document incidents

---

**Version**: 1.0.0
**Last Updated**: January 2025
**Maintained by**: Number Labs

# Local Development Setup

Complete guide for running the Aircraft Database MCP Server locally and connecting other applications to it.

## Quick Start

```bash
# 1. Start PostgreSQL (if not already running)
brew services start postgresql

# 2. Verify database
psql aircraft_db -c "SELECT COUNT(*) FROM airlines;"

# 3. Start MCP Inspector (Test Tool)
npm run mcp:inspector

# 4. Start REST API (for other apps)
npm run dev:api
```

---

## What's Running

| Service | Port | URL | Purpose |
|---------|------|-----|---------|
| **MCP Inspector** | 6274 | http://localhost:6274 | Test MCP tools visually |
| **REST API** | 3000 | http://localhost:3000 | API for web/mobile apps |
| **API Docs** | 3000 | http://localhost:3000/api-docs | Swagger documentation |
| **PostgreSQL** | 5432 | localhost:5432 | Database |

---

## Database

### Connection Details

```bash
Host:     localhost
Port:     5432
Database: aircraft_db
User:     srihaanbandu
Password: (none)

# Connection String
postgresql://srihaanbandu@localhost:5432/aircraft_db
```

### Current Data

- **10 Airlines**: AA (American), DL (Delta), UA (United), WN (Southwest), BA (British Airways), LH (Lufthansa), AF (Air France), EK (Emirates), QR (Qatar), SQ (Singapore)
- **240 Aircraft**: Distributed across airlines with realistic ages
- **6 Aircraft Types**: Boeing 737-800, 737 MAX 8, 777-300ER, 787-9, Airbus A320-200, A321-200

### Database Schema

```sql
-- 8 main tables
airlines                    -- 10 rows
aircraft_types              -- 6 rows
aircraft                    -- 240 rows
aircraft_configurations     -- 0 rows
aircraft_operators_history  -- 0 rows
scraping_jobs              -- 0 rows
data_sources               -- 0 rows
audit_log                  -- 0 rows
```

---

## MCP Tools (AI Agent Access)

### Available Tools

1. **get_airline_fleet** - Get all aircraft for an airline
2. **get_aircraft_details** - Get details for specific aircraft
3. **search_aircraft** - Search aircraft by criteria
4. **get_fleet_statistics** - Get fleet statistics
5. **trigger_fleet_update** - Trigger scraping job
6. **get_aircraft_type_specs** - Get aircraft type specifications
7. **get_fleet_availability** - Check fleet availability

### Using MCP Inspector

**URL:** http://localhost:6274

**How to test:**
1. Click a tool in the left sidebar
2. Enter parameters (e.g., `{"airline_code": "AA"}`)
3. Click "Call Tool"
4. See JSON response

**Example Requests:**
```json
// Get American Airlines fleet
{"airline_code": "AA"}

// Search for 737s
{"aircraft_type": "737"}

// Get global statistics
{} // No parameters needed
```

### Connecting Claude Desktop

**Config file:** `~/Library/Application Support/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "aircraft-database": {
      "command": "npm",
      "args": ["run", "dev:mcp"],
      "cwd": "/Users/srihaanbandu/jbandu/aircraft-database-mcp"
    }
  }
}
```

After editing, restart Claude Desktop.

---

## REST API (Web/Mobile Access)

### Base URL

```
http://localhost:3000
```

### Authentication

**For local development, auth is disabled.** For production, use:

```bash
curl -H "X-API-Key: your-api-key" \
  http://localhost:3000/api/v1/airlines
```

### Endpoints

#### Airlines

```bash
# List all airlines
GET /api/v1/airlines

# Get airline by code
GET /api/v1/airlines/:code

# Get airline fleet
GET /api/v1/airlines/:code/fleet
```

#### Aircraft

```bash
# Search aircraft
GET /api/v1/aircraft/search?aircraft_type=737

# Get aircraft details
GET /api/v1/aircraft/:registration
```

#### Statistics

```bash
# Global statistics
GET /api/v1/stats/global

# Airline statistics
GET /api/v1/stats/airlines/:code
```

#### Health & Docs

```bash
# Health check
GET /health

# API documentation
GET /api-docs
```

### Example Requests

**cURL:**
```bash
# Get all airlines
curl http://localhost:3000/api/v1/airlines

# Get American Airlines
curl http://localhost:3000/api/v1/airlines/AA

# Search for 737s
curl "http://localhost:3000/api/v1/aircraft/search?aircraft_type=737"

# Get global stats
curl http://localhost:3000/api/v1/stats/global
```

**JavaScript (fetch):**
```javascript
// Get airlines
const response = await fetch('http://localhost:3000/api/v1/airlines');
const airlines = await response.json();

// Get specific airline
const aa = await fetch('http://localhost:3000/api/v1/airlines/AA');
const american = await aa.json();

// Get fleet
const fleet = await fetch('http://localhost:3000/api/v1/airlines/AA/fleet');
const aircraft = await fleet.json();
```

**Python:**
```python
import requests

# Get airlines
response = requests.get('http://localhost:3000/api/v1/airlines')
airlines = response.json()

# Get specific airline
response = requests.get('http://localhost:3000/api/v1/airlines/AA')
american = response.json()

# Search aircraft
response = requests.get('http://localhost:3000/api/v1/aircraft/search',
                       params={'aircraft_type': '737'})
aircraft = response.json()
```

---

## Connecting Other Apps

### React/Next.js App

**1. Create API client:**

```typescript
// lib/aircraft-api.ts
const API_BASE = 'http://localhost:3000';

export const aircraftAPI = {
  getAirlines: () =>
    fetch(`${API_BASE}/api/v1/airlines`).then(r => r.json()),

  getAirline: (code: string) =>
    fetch(`${API_BASE}/api/v1/airlines/${code}`).then(r => r.json()),

  getFleet: (code: string) =>
    fetch(`${API_BASE}/api/v1/airlines/${code}/fleet`).then(r => r.json()),

  searchAircraft: (query: Record<string, string>) => {
    const params = new URLSearchParams(query);
    return fetch(`${API_BASE}/api/v1/aircraft/search?${params}`)
      .then(r => r.json());
  },

  getStats: () =>
    fetch(`${API_BASE}/api/v1/stats/global`).then(r => r.json()),
};
```

**2. Use in components:**

```typescript
// app/airlines/page.tsx
'use client';
import { useEffect, useState } from 'react';
import { aircraftAPI } from '@/lib/aircraft-api';

export default function AirlinesPage() {
  const [airlines, setAirlines] = useState([]);

  useEffect(() => {
    aircraftAPI.getAirlines().then(setAirlines);
  }, []);

  return (
    <div>
      {airlines.map(airline => (
        <div key={airline.iata_code}>
          {airline.name} ({airline.iata_code})
        </div>
      ))}
    </div>
  );
}
```

### Python App

```python
# aircraft_client.py
import requests
from typing import Dict, List, Optional

class AircraftDatabaseClient:
    def __init__(self, base_url: str = "http://localhost:3000"):
        self.base_url = base_url

    def get_airlines(self) -> List[Dict]:
        response = requests.get(f"{self.base_url}/api/v1/airlines")
        response.raise_for_status()
        return response.json()

    def get_airline(self, code: str) -> Dict:
        response = requests.get(f"{self.base_url}/api/v1/airlines/{code}")
        response.raise_for_status()
        return response.json()

    def get_fleet(self, code: str) -> Dict:
        response = requests.get(f"{self.base_url}/api/v1/airlines/{code}/fleet")
        response.raise_for_status()
        return response.json()

    def search_aircraft(self, **kwargs) -> List[Dict]:
        response = requests.get(
            f"{self.base_url}/api/v1/aircraft/search",
            params=kwargs
        )
        response.raise_for_status()
        return response.json()

    def get_stats(self) -> Dict:
        response = requests.get(f"{self.base_url}/api/v1/stats/global")
        response.raise_for_status()
        return response.json()

# Usage
client = AircraftDatabaseClient()

# Get all airlines
airlines = client.get_airlines()

# Get American Airlines
aa = client.get_airline('AA')

# Search for 737s
boeing737s = client.search_aircraft(aircraft_type='737')

# Get statistics
stats = client.get_stats()
print(f"Total aircraft: {stats['totalAircraft']}")
```

### Mobile App (React Native)

```typescript
// services/aircraftAPI.ts
const API_BASE = 'http://localhost:3000';

export const aircraftAPI = {
  async getAirlines() {
    const response = await fetch(`${API_BASE}/api/v1/airlines`);
    return response.json();
  },

  async getFleet(airlineCode: string) {
    const response = await fetch(`${API_BASE}/api/v1/airlines/${airlineCode}/fleet`);
    return response.json();
  },

  async searchAircraft(filters: Record<string, string>) {
    const params = new URLSearchParams(filters);
    const response = await fetch(`${API_BASE}/api/v1/aircraft/search?${params}`);
    return response.json();
  },
};

// Usage in component
import { useEffect, useState } from 'react';
import { View, Text, FlatList } from 'react-native';
import { aircraftAPI } from './services/aircraftAPI';

export function AirlinesScreen() {
  const [airlines, setAirlines] = useState([]);

  useEffect(() => {
    aircraftAPI.getAirlines().then(setAirlines);
  }, []);

  return (
    <FlatList
      data={airlines}
      keyExtractor={item => item.iata_code}
      renderItem={({ item }) => (
        <View>
          <Text>{item.name} ({item.iata_code})</Text>
          <Text>{item.country}</Text>
        </View>
      )}
    />
  );
}
```

---

## Direct Database Access

### Using psql

```bash
# Connect
psql aircraft_db

# Example queries
SELECT * FROM airlines LIMIT 10;

SELECT
  at.manufacturer,
  at.model,
  COUNT(*) as count
FROM aircraft a
JOIN aircraft_types at ON a.aircraft_type_id = at.id
GROUP BY at.manufacturer, at.model
ORDER BY count DESC;
```

### Using Python (psycopg2)

```python
import psycopg2
from psycopg2.extras import RealDictCursor

conn = psycopg2.connect(
    host="localhost",
    port=5432,
    database="aircraft_db",
    user="srihaanbandu"
)

# Query with dictionary cursor
cursor = conn.cursor(cursor_factory=RealDictCursor)
cursor.execute("SELECT * FROM airlines")
airlines = cursor.fetchall()

for airline in airlines:
    print(f"{airline['name']} ({airline['iata_code']})")

cursor.close()
conn.close()
```

### Using Node.js (pg)

```javascript
import pg from 'pg';

const pool = new pg.Pool({
  host: 'localhost',
  port: 5432,
  database: 'aircraft_db',
  user: 'srihaanbandu',
});

// Query airlines
const { rows } = await pool.query('SELECT * FROM airlines');
console.log(rows);

// Get fleet for American Airlines
const fleet = await pool.query(`
  SELECT a.registration, at.manufacturer, at.model
  FROM aircraft a
  JOIN aircraft_types at ON a.aircraft_type_id = at.id
  JOIN airlines al ON a.current_airline_id = al.id
  WHERE al.iata_code = $1
`, ['AA']);

console.log(fleet.rows);
```

---

## Troubleshooting

### Server won't start

```bash
# Check if port 3000 is in use
lsof -i :3000

# Kill process if needed
kill -9 <PID>

# Start server
npm run dev:api
```

### Database connection issues

```bash
# Check PostgreSQL is running
brew services list | grep postgresql

# Start PostgreSQL
brew services start postgresql

# Verify you can connect
psql aircraft_db -c "SELECT 1"
```

### No data in database

```bash
# Seed airlines
npm run db:seed

# Or manually add test data (see scripts/seed-top-100-airlines.ts)
```

---

## Environment Variables

**`.env` file:**

```bash
# Database
POSTGRES_URL=postgresql://srihaanbandu@localhost:5432/aircraft_db

# Optional
ENABLE_NEO4J=false
LLM_MODE=ollama
NODE_ENV=development
```

---

## Scripts

```bash
# Start services
npm run dev:mcp        # MCP server (stdio)
npm run dev:api        # REST API server
npm run mcp:inspector  # MCP Inspector UI

# Database
npm run db:migrate     # Run migrations
npm run db:seed        # Seed airlines

# Build
npm run build          # Compile TypeScript

# Testing
npm run test           # Run tests
```

---

## Support

- **GitHub Issues:** https://github.com/jbandu/aircraft-database-mcp/issues
- **Documentation:** `/docs` directory
- **API Docs:** http://localhost:3000/api-docs (when running)

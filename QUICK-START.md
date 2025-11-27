# Quick Start Guide

## 🚀 Start Everything

```bash
# Terminal 1: Start MCP Inspector
npm run mcp:inspector
# → http://localhost:6274

# Terminal 2: Start REST API
npm run dev:api
# → http://localhost:3000
```

---

## 📊 What's Running

| Service | URL | Use For |
|---------|-----|---------|
| **MCP Inspector** | http://localhost:6274 | Test MCP tools visually |
| **REST API** | http://localhost:3000 | Connect apps |
| **API Docs** | http://localhost:3000/api-docs | Browse endpoints |

---

## 🔌 Connect Your App

### JavaScript/TypeScript

```typescript
const API = 'http://localhost:3000';

// Get airlines
const airlines = await fetch(`${API}/api/v1/airlines`).then(r => r.json());

// Get American Airlines fleet
const fleet = await fetch(`${API}/api/v1/airlines/AA/fleet`).then(r => r.json());

// Search for 737s
const aircraft = await fetch(`${API}/api/v1/aircraft/search?aircraft_type=737`)
  .then(r => r.json());
```

### Python

```python
import requests

API = 'http://localhost:3000'

# Get airlines
airlines = requests.get(f'{API}/api/v1/airlines').json()

# Get American Airlines fleet
fleet = requests.get(f'{API}/api/v1/airlines/AA/fleet').json()

# Search for 737s
aircraft = requests.get(f'{API}/api/v1/aircraft/search',
                       params={'aircraft_type': '737'}).json()
```

### cURL

```bash
# Get all airlines
curl http://localhost:3000/api/v1/airlines

# Get American Airlines
curl http://localhost:3000/api/v1/airlines/AA

# Get AA's fleet
curl http://localhost:3000/api/v1/airlines/AA/fleet

# Search for 737s
curl "http://localhost:3000/api/v1/aircraft/search?aircraft_type=737"

# Get global stats
curl http://localhost:3000/api/v1/stats/global
```

---

## 📦 Database

```bash
Host:     localhost
Port:     5432
Database: aircraft_db
User:     srihaanbandu

# Connection String
postgresql://srihaanbandu@localhost:5432/aircraft_db
```

**Current Data:**
- 10 airlines (AA, DL, UA, WN, BA, LH, AF, EK, QR, SQ)
- 240 aircraft
- 6 aircraft types

---

## 🎯 API Endpoints

```
GET  /api/v1/airlines              # List airlines
GET  /api/v1/airlines/:code        # Get airline
GET  /api/v1/airlines/:code/fleet  # Get fleet
GET  /api/v1/aircraft/search       # Search aircraft
GET  /api/v1/aircraft/:registration # Get aircraft
GET  /api/v1/stats/global          # Global stats
GET  /api/v1/stats/airlines/:code  # Airline stats
GET  /health                        # Health check
GET  /api-docs                      # Swagger docs
```

---

## 🧪 Test with MCP Inspector

1. Open http://localhost:6274
2. Click a tool (e.g., `get_airline_fleet`)
3. Enter params: `{"airline_code": "AA"}`
4. Click "Call Tool"
5. See results!

---

## 📚 Full Documentation

- **Local Setup:** `docs/LOCAL-SETUP.md`
- **Architecture:** `docs/ARCHITECTURE.md`
- **Deployment:** `docs/DEPLOYMENT.md`

---

## ❓ Need Help?

```bash
# Check if services are running
lsof -i :3000  # REST API
lsof -i :6274  # MCP Inspector

# View logs
tail -f logs/mcp-server.log

# Restart database
brew services restart postgresql
```

---

**🎉 You're all set! Start building!**

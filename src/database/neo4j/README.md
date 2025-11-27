# Neo4j Knowledge Graph

This directory contains the Neo4j knowledge graph schema and synchronization logic for the Aircraft Database MCP Server.

## Overview

The Neo4j knowledge graph complements the PostgreSQL relational database by providing:

- **Fleet Relationships**: Track aircraft ownership, leasing, and operational history
- **Network Analysis**: Discover airline partnerships, alliances, and fleet similarities
- **Lineage Tracking**: Follow aircraft through re-registrations and operators
- **Pattern Recognition**: Identify fleet modernization trends and replacement patterns

## Architecture

```
PostgreSQL (Source of Truth)
       ↓
   Sync Script
       ↓
Neo4j Knowledge Graph
       ↓
  Graph Queries & Analytics
```

## Files

- `001_knowledge_graph_schema.cypher` - Complete Neo4j schema with constraints and indexes
- `sync-from-postgres.ts` - Bidirectional sync script (PostgreSQL → Neo4j)
- `README.md` - This file

## Setup

### 1. Install Neo4j

**Option A: Docker (Recommended for Development)**

```bash
docker run \
    --name neo4j \
    -p 7474:7474 -p 7687:7687 \
    -e NEO4J_AUTH=neo4j/your-password \
    -v $HOME/neo4j/data:/data \
    -d neo4j:latest
```

**Option B: Neo4j Desktop**

1. Download from [neo4j.com/download](https://neo4j.com/download/)
2. Create a new project and database
3. Set password

**Option C: Neo4j Aura (Cloud - Free Tier Available)**

1. Sign up at [neo4j.com/aura](https://neo4j.com/cloud/aura/)
2. Create free instance
3. Copy connection credentials

### 2. Configure Environment

Edit `.env`:

```bash
# Neo4j Connection
NEO4J_URI=bolt://localhost:7687
NEO4J_USER=neo4j
NEO4J_PASSWORD=your-password
NEO4J_DATABASE=neo4j
ENABLE_NEO4J=true
```

### 3. Initialize Schema

```bash
npm run neo4j:init
```

This will:
- Create all constraints (uniqueness, node keys)
- Create performance indexes
- Set up sample data (alliances, manufacturers)

To force reinitialize (⚠️ **destroys existing data**):

```bash
npm run neo4j:init -- --force
```

### 4. Sync Data from PostgreSQL

**Dry run (preview changes):**

```bash
npm run neo4j:sync:dry-run
```

**Full sync:**

```bash
npm run neo4j:sync:full
```

**Incremental sync (only changed data):**

```bash
npm run neo4j:sync
```

**Clear and resync:**

```bash
npm run neo4j:clear
npm run neo4j:sync:full
```

## Schema

### Node Types

- **`:Airline`** - Airlines worldwide
- **`:Aircraft`** - Individual aircraft registrations
- **`:AircraftType`** - Aircraft models and variants
- **`:Airport`** - Airports (for home base, current location)
- **`:Manufacturer`** - Aircraft manufacturers (Boeing, Airbus, etc.)
- **`:Alliance`** - Airline alliances (oneworld, Star Alliance, SkyTeam)

### Relationship Types

- **`(:Airline)-[:OPERATES]->(:Aircraft)`** - Current and historical operations
- **`(:Aircraft)-[:IS_TYPE]->(:AircraftType)`** - Aircraft type classification
- **`(:Aircraft)-[:MANUFACTURED_BY]->(:Manufacturer)`** - Manufacturing lineage
- **`(:Aircraft)-[:BASED_AT]->(:Airport)`** - Home base assignment
- **`(:Aircraft)-[:CURRENTLY_AT]->(:Airport)`** - Current location
- **`(:Airline)-[:MEMBER_OF]->(:Alliance)`** - Alliance membership
- **`(:Aircraft)-[:REPLACED_BY]->(:Aircraft)`** - Fleet replacement tracking
- **`(:Airline)-[:CODESHARE_PARTNER]->(:Airline)`** - Codeshare agreements
- **`(:Aircraft)-[:SISTER_AIRCRAFT]->(:Aircraft)`** - Same production batch
- **`(:Manufacturer)-[:PRODUCES]->(:AircraftType)`** - Manufacturing relationships

## Usage Examples

### Using TypeScript Helper Functions

```typescript
import { Neo4jQuery } from '../../lib/neo4j-queries.js';

// Get airline fleet composition
const composition = await Neo4jQuery.getAirlineFleetComposition('AA');
console.log(composition);

// Find similar airlines by fleet
const similar = await Neo4jQuery.findSimilarAirlines('AA', 5);
console.log(similar);

// Get fleet modernization stats
const modernization = await Neo4jQuery.getFleetModernizationStats('DL');
console.log(modernization);
```

### Direct Cypher Queries

Open Neo4j Browser at [http://localhost:7474](http://localhost:7474)

**Get airline fleet composition:**

```cypher
MATCH (al:Airline {iata_code: 'AA'})-[:OPERATES]->(ac:Aircraft)-[:IS_TYPE]->(at:AircraftType)
RETURN at.manufacturer, at.model, count(ac) as count
ORDER BY count DESC
```

**Find aircraft lineage:**

```cypher
MATCH path = (ac:Aircraft {registration: 'N12345'})<-[:OPERATES*]-(al:Airline)
RETURN path
```

**Alliance network visualization:**

```cypher
MATCH (al:Airline)-[:MEMBER_OF]->(alliance:Alliance {name: 'oneworld'})
OPTIONAL MATCH (al)-[:OPERATES]->(ac:Aircraft)
RETURN al, alliance, count(ac) as fleet_size
```

## Sync Strategy

### Full Sync

- Runs all entity syncs (airlines, aircraft, aircraft_types, etc.)
- Creates all relationships
- Use for initial setup or after major changes

### Incremental Sync

- Only syncs entities modified since last sync
- Uses `updated_at` timestamps from PostgreSQL
- Faster for regular updates

### Scheduled Sync

Add to cron or systemd timer:

```bash
# Every 6 hours
0 */6 * * * cd /path/to/project && npm run neo4j:sync
```

## Query Performance

### Indexed Properties

All frequently queried properties are indexed:

- `Airline.iata_code`, `Airline.icao_code`
- `Aircraft.registration`, `Aircraft.msn`
- `AircraftType.full_name`
- `Airport.iata_code`, `Airport.icao_code`

### Query Tips

1. **Always filter on indexed properties first**
   ```cypher
   MATCH (al:Airline {iata_code: 'AA'})-[:OPERATES]->(ac:Aircraft)
   ```

2. **Limit relationship traversal depth**
   ```cypher
   MATCH path = (ac1)-[:REPLACED_BY*..5]->(ac2)
   ```

3. **Use `PROFILE` to analyze query performance**
   ```cypher
   PROFILE MATCH (al:Airline)-[:OPERATES]->(ac:Aircraft)
   RETURN count(ac)
   ```

## Monitoring

### Check Sync Status

```typescript
import { Neo4jSyncService } from './sync-from-postgres.js';

const syncService = new Neo4jSyncService();
const stats = await syncService.getSyncStats();
console.log(stats);
```

### Graph Statistics

```cypher
// Node counts
MATCH (n)
RETURN labels(n) as label, count(n) as count
ORDER BY count DESC

// Relationship counts
MATCH ()-[r]->()
RETURN type(r) as type, count(r) as count
ORDER BY count DESC
```

### Orphaned Nodes

```cypher
// Aircraft without airline
MATCH (ac:Aircraft)
WHERE NOT (ac)<-[:OPERATES]-(:Airline)
RETURN ac.registration, ac.status
```

## Troubleshooting

### Connection Refused

```bash
# Check Neo4j is running
docker ps | grep neo4j

# Check connection
curl http://localhost:7474

# Verify credentials
echo $NEO4J_PASSWORD
```

### Constraint Violations

```bash
# Drop and recreate
npm run neo4j:init -- --force
```

### Sync Failures

```bash
# Check logs
tail -f logs/mcp-server.log | grep neo4j

# Dry run to preview
npm run neo4j:sync:dry-run

# Clear and resync
npm run neo4j:clear
npm run neo4j:sync:full
```

### Memory Issues (Large Datasets)

Adjust batch size in sync script:

```typescript
const syncService = new Neo4jSyncService(1000); // Increase batch size
```

Or increase Neo4j memory:

```bash
# Docker
docker run ... -e NEO4J_dbms_memory_heap_max__size=4G

# neo4j.conf
dbms.memory.heap.max_size=4G
```

## Advanced Features

### Graph Data Science (GDS)

Install the GDS plugin for advanced analytics:

```cypher
// Community detection
CALL gds.louvain.stream({
    nodeProjection: 'Airline',
    relationshipProjection: 'CODESHARE_PARTNER'
})

// PageRank - Most influential airlines
CALL gds.pageRank.stream({
    nodeProjection: 'Airline',
    relationshipProjection: 'CODESHARE_PARTNER'
})
```

### APOC Procedures

Install APOC for utility functions:

```cypher
// Export to JSON
CALL apoc.export.json.all("fleet-data.json")

// Periodic iteration
CALL apoc.periodic.iterate(
  "MATCH (ac:Aircraft) WHERE ac.age_years IS NULL RETURN ac",
  "SET ac.age_years = duration.between(ac.manufactured_date, date()).years",
  {batchSize:100}
)
```

## Best Practices

1. **Run incremental syncs regularly** (every 6-12 hours)
2. **Use dry-run before full sync** to verify changes
3. **Monitor graph size** - clear old data if needed
4. **Create backups** before major operations
5. **Use EXPLAIN/PROFILE** to optimize complex queries
6. **Batch large operations** to avoid memory issues

## Resources

- [Neo4j Documentation](https://neo4j.com/docs/)
- [Cypher Query Language](https://neo4j.com/docs/cypher-manual/current/)
- [Graph Data Science Library](https://neo4j.com/docs/graph-data-science/current/)
- [Neo4j Browser Guide](https://neo4j.com/docs/browser-manual/current/)

## Support

For issues specific to this implementation:
- Check logs: `tail -f logs/mcp-server.log`
- GitHub Issues: [Report a bug](https://github.com/numberlabs/aircraft-database-mcp/issues)
- Documentation: [Main README](../../../README.md)

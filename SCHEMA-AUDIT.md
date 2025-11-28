# Database Schema Audit - Scraping Agents

## Overview

Complete audit of all SQL queries in scraping agents to ensure they match the actual PostgreSQL schema.

## Schema Reference

### airlines table
```sql
- id (uuid, PK)
- iata_code (varchar(2), unique)
- icao_code (varchar(3), unique)
- name (varchar(255))
- website (varchar(500))          ← NOT website_url
- metadata (jsonb)                 ← Store scrape_source_urls here
- last_scraped_at (timestamp)
```

### aircraft table
```sql
- id (uuid, PK)
- registration (varchar(10), unique)
- manufacturer_serial_number (varchar(50))  ← NOT msn
- aircraft_type_id (uuid, FK)
- current_airline_id (uuid, FK)             ← NOT airline_id
- delivery_date (date)
- age_years (numeric)
- status (varchar(50))
- last_seen_date (date)                     ← NOT last_flight_date
- metadata (jsonb)
```

**NOT in aircraft table**:
- ❌ seat_configuration → Use aircraft_configurations table
- ❌ current_location → Not stored
- ❌ data_confidence → Not stored
- ❌ data_sources → Not stored

### aircraft_configurations table
```sql
- id (uuid, PK)
- aircraft_id (uuid, FK)
- class_first (integer)            ← NOT first_class_seats
- class_business (integer)         ← NOT business_class_seats
- class_premium_economy (integer)  ← NOT premium_economy_seats
- class_economy (integer)          ← NOT economy_class_seats
- total_seats (integer)
- is_current (boolean)
```

### aircraft_types table
```sql
- id (uuid, PK)
- iata_code (varchar(3))
- icao_code (varchar(4))
- manufacturer (varchar(100))
- model (varchar(100))
- engine_type (varchar(50))        ← NOT engines
```

## Issues Found

### 1. ❌ fleet-discovery-agent.ts (FIXED)
**Line 117**: ✅ Fixed
```typescript
// Before:
SELECT id, iata_code, icao_code, name, website_url, scrape_source_urls

// After:
SELECT id, iata_code, icao_code, name, website, metadata
```

### 2. ❌ aircraft-details-agent.ts
**Line 128-131**: Column name mismatch in aircraft_configurations JOIN

**Issue**:
```typescript
ac.first_class_seats,
ac.business_class_seats,
ac.premium_economy_seats,
ac.economy_class_seats,
```

**Should be**:
```typescript
ac.class_first,
ac.class_business,
ac.class_premium_economy,
ac.class_economy,
```

**Line 159-162**: Variable name mismatch
```typescript
first: row.first_class_seats || undefined,  // ❌ Wrong column name
```

**Should be**:
```typescript
first: row.class_first || undefined,  // ✅ Correct
```

### 3. ❌ airline-scraper-workflow.ts
**Line 375-381**: Multiple column mismatches in getExistingAircraft()

**Issues**:
```typescript
a.msn,                // ❌ Should be: a.manufacturer_serial_number
a.seat_configuration, // ❌ Doesn't exist (need to JOIN aircraft_configurations)
a.current_location,   // ❌ Doesn't exist (not stored in schema)
a.last_flight_date,   // ❌ Should be: a.last_seen_date
a.data_confidence     // ❌ Doesn't exist (not stored)
```

**Line 400-406**: Result mapping uses wrong field names
```typescript
msn: row.msn,                          // ❌ Wrong
seat_configuration: row.seat_configuration || {},  // ❌ Wrong
current_location: row.current_location,  // ❌ Wrong
last_flight_date: row.last_flight_date,  // ❌ Wrong
```

**Line 436-447**: INSERT statement references non-existent columns
```typescript
INSERT INTO aircraft (
  airline_id,           // ❌ Should be: current_airline_id
  msn,                  // ❌ Should be: manufacturer_serial_number
  seat_configuration,   // ❌ Doesn't exist
  current_location,     // ❌ Doesn't exist
  last_flight_date,     // ❌ Should be: last_seen_date
  data_confidence,      // ❌ Doesn't exist
  data_sources,         // ❌ Doesn't exist
  ...
)
```

**Line 485-513**: UPDATE statement has same issues

### 4. ❌ validation-agent.ts
**No schema issues** - Uses interface types from aircraft-details-agent, so will work once that's fixed.

## Impact Analysis

| Issue | Files Affected | Severity | Impact |
|-------|----------------|----------|--------|
| Column name: `first_class_seats` → `class_first` | aircraft-details-agent.ts | HIGH | Extraction fails |
| Column name: `msn` → `manufacturer_serial_number` | airline-scraper-workflow.ts | HIGH | Insert/update fails |
| Non-existent: `seat_configuration` | airline-scraper-workflow.ts | HIGH | Insert/update fails |
| Non-existent: `current_location` | airline-scraper-workflow.ts | MEDIUM | Can be removed |
| Column name: `last_flight_date` → `last_seen_date` | airline-scraper-workflow.ts | MEDIUM | Wrong data stored |
| Non-existent: `data_confidence` | airline-scraper-workflow.ts | LOW | Can store in metadata |
| Non-existent: `data_sources` | airline-scraper-workflow.ts | LOW | Can store in metadata |
| FK name: `airline_id` → `current_airline_id` | airline-scraper-workflow.ts | HIGH | Insert fails |

## Fixes Required

### Priority 1 (Blocking - Prevents execution)

1. **aircraft-details-agent.ts**:
   - Fix column names in SELECT query (line 128-131)
   - Fix variable names in result mapping (line 159-162)

2. **airline-scraper-workflow.ts**:
   - Fix getExistingAircraft() query (line 375-381)
   - Fix insertAircraft() query (line 436-447)
   - Fix updateAircraft() query (line 485-513)
   - Change `airline_id` → `current_airline_id` everywhere
   - Change `msn` → `manufacturer_serial_number` everywhere
   - Remove `seat_configuration` from aircraft table queries
   - Remove `current_location` (not in schema)
   - Change `last_flight_date` → `last_seen_date`
   - Remove `data_confidence` and `data_sources`

### Priority 2 (Feature gap - Missing functionality)

1. **Seat configurations** need separate handling:
   - After inserting/updating aircraft, insert into `aircraft_configurations` table
   - When reading, LEFT JOIN `aircraft_configurations` table
   - Mark new config as `is_current = true`

2. **Data confidence/sources** should use metadata:
   - Store in aircraft.metadata JSONB column
   - Use keys: `confidence_score`, `data_sources`, etc.

## Fix Strategy

### Step 1: Create Correct Column Mapping

```typescript
// Column name mapping (actual schema → interface)
const COLUMN_MAP = {
  // aircraft table
  'manufacturer_serial_number': 'msn',
  'current_airline_id': 'airline_id',
  'last_seen_date': 'last_flight_date',

  // aircraft_configurations table
  'class_first': 'first',
  'class_business': 'business',
  'class_premium_economy': 'premium_economy',
  'class_economy': 'economy',
};
```

### Step 2: Handle Seat Configurations Separately

```typescript
// After inserting aircraft, insert configuration:
async insertAircraftConfiguration(
  aircraftId: string,
  seatConfig: SeatConfiguration
): Promise<void> {
  await queryPostgres(`
    INSERT INTO aircraft_configurations (
      aircraft_id,
      class_first,
      class_business,
      class_premium_economy,
      class_economy,
      total_seats,
      is_current
    ) VALUES ($1, $2, $3, $4, $5, $6, true)
  `, [
    aircraftId,
    seatConfig.first || 0,
    seatConfig.business || 0,
    seatConfig.premium_economy || 0,
    seatConfig.economy || 0,
    seatConfig.total || 0
  ]);
}
```

### Step 3: Store Metadata in JSONB

```typescript
// Store confidence and sources in metadata
const metadata = {
  confidence_score: aircraft.confidence_score,
  data_sources: aircraft.data_sources,
  extracted_at: new Date().toISOString(),
  ...aircraft.metadata
};

await queryPostgres(`
  INSERT INTO aircraft (... metadata)
  VALUES (..., $N)
`, [..., JSON.stringify(metadata)]);
```

## Testing Checklist

After fixes:

- [ ] Fleet discovery completes without errors
- [ ] Aircraft details extraction completes
- [ ] Validation runs successfully
- [ ] Aircraft INSERT works (new aircraft)
- [ ] Aircraft UPDATE works (existing aircraft)
- [ ] Aircraft configurations are stored
- [ ] Metadata is populated correctly
- [ ] All queries return expected data
- [ ] No "column does not exist" errors
- [ ] End-to-end job completes successfully

## Validation SQL

```sql
-- Check for orphaned data
SELECT COUNT(*) FROM aircraft WHERE current_airline_id IS NULL;
SELECT COUNT(*) FROM aircraft WHERE manufacturer_serial_number IS NULL;

-- Check configurations
SELECT
  a.registration,
  ac.class_first,
  ac.class_business,
  ac.class_economy,
  ac.total_seats
FROM aircraft a
LEFT JOIN aircraft_configurations ac ON a.id = ac.aircraft_id AND ac.is_current = true
WHERE a.current_airline_id = (SELECT id FROM airlines WHERE iata_code = 'UA')
LIMIT 10;

-- Check metadata
SELECT
  registration,
  metadata->>'confidence_score' as confidence,
  metadata->>'data_sources' as sources
FROM aircraft
WHERE metadata IS NOT NULL
LIMIT 10;
```

## Summary

**Total Issues**: 15
**Critical (Blocking)**: 8
**Medium**: 4
**Low**: 3

**Estimated Fix Time**: 2-3 hours
**Testing Time**: 1 hour
**Total**: 3-4 hours to full production-ready

All schema mismatches must be fixed before scraping can work end-to-end.

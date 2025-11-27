// =============================================================================
// AIRCRAFT DATABASE - NEO4J KNOWLEDGE GRAPH SCHEMA
// =============================================================================
// Version: 001
// Description: Fleet relationships, lineage, and operational networks
// Date: 2025-11-27
// =============================================================================

// =============================================================================
// CONSTRAINTS - Ensure Data Integrity
// =============================================================================

// Airline Constraints
CREATE CONSTRAINT airline_iata IF NOT EXISTS
FOR (a:Airline) REQUIRE a.iata_code IS UNIQUE;

CREATE CONSTRAINT airline_id IF NOT EXISTS
FOR (a:Airline) REQUIRE a.id IS UNIQUE;

CREATE CONSTRAINT airline_icao IF NOT EXISTS
FOR (a:Airline) REQUIRE a.icao_code IS UNIQUE;

// Aircraft Constraints
CREATE CONSTRAINT aircraft_registration IF NOT EXISTS
FOR (ac:Aircraft) REQUIRE ac.registration IS UNIQUE;

CREATE CONSTRAINT aircraft_id IF NOT EXISTS
FOR (ac:Aircraft) REQUIRE ac.id IS UNIQUE;

// AircraftType Constraints
CREATE CONSTRAINT aircraft_type_name IF NOT EXISTS
FOR (t:AircraftType) REQUIRE t.full_name IS UNIQUE;

CREATE CONSTRAINT aircraft_type_id IF NOT EXISTS
FOR (t:AircraftType) REQUIRE t.id IS UNIQUE;

// Airport Constraints
CREATE CONSTRAINT airport_iata IF NOT EXISTS
FOR (ap:Airport) REQUIRE ap.iata_code IS UNIQUE;

CREATE CONSTRAINT airport_icao IF NOT EXISTS
FOR (ap:Airport) REQUIRE ap.icao_code IS UNIQUE;

// Manufacturer Constraints
CREATE CONSTRAINT manufacturer_name IF NOT EXISTS
FOR (m:Manufacturer) REQUIRE m.name IS UNIQUE;

// Alliance Constraints
CREATE CONSTRAINT alliance_name IF NOT EXISTS
FOR (al:Alliance) REQUIRE al.name IS UNIQUE;

// =============================================================================
// INDEXES - Improve Query Performance
// =============================================================================

// Airline Indexes
CREATE INDEX airline_name_idx IF NOT EXISTS
FOR (a:Airline) ON (a.name);

CREATE INDEX airline_country_idx IF NOT EXISTS
FOR (a:Airline) ON (a.country);

// Aircraft Indexes
CREATE INDEX aircraft_status_idx IF NOT EXISTS
FOR (ac:Aircraft) ON (ac.status);

CREATE INDEX aircraft_type_idx IF NOT EXISTS
FOR (ac:Aircraft) ON (ac.aircraft_type);

CREATE INDEX aircraft_manufacturer_idx IF NOT EXISTS
FOR (ac:Aircraft) ON (ac.manufacturer);

CREATE INDEX aircraft_msn_idx IF NOT EXISTS
FOR (ac:Aircraft) ON (ac.msn);

CREATE INDEX aircraft_manufacture_date_idx IF NOT EXISTS
FOR (ac:Aircraft) ON (ac.manufactured_date);

// AircraftType Indexes
CREATE INDEX aircraft_type_manufacturer_idx IF NOT EXISTS
FOR (t:AircraftType) ON (t.manufacturer);

CREATE INDEX aircraft_type_model_idx IF NOT EXISTS
FOR (t:AircraftType) ON (t.model);

// Airport Indexes
CREATE INDEX airport_country_idx IF NOT EXISTS
FOR (ap:Airport) ON (ap.country);

CREATE INDEX airport_name_idx IF NOT EXISTS
FOR (ap:Airport) ON (ap.name);

// =============================================================================
// NODE LABEL DESCRIPTIONS & PROPERTIES
// =============================================================================

// (:Airline)
// Properties:
//   - id: INTEGER (PostgreSQL ID)
//   - iata_code: STRING (2-3 chars)
//   - icao_code: STRING (4 chars)
//   - name: STRING
//   - country: STRING (ISO code)
//   - alliance: STRING
//   - business_model: STRING
//   - headquarters: STRING
//   - fleet_size: INTEGER
//   - founded_year: INTEGER
//   - created_at: DATETIME
//   - updated_at: DATETIME

// (:Aircraft)
// Properties:
//   - id: INTEGER (PostgreSQL ID)
//   - registration: STRING (unique tail number)
//   - aircraft_type: STRING
//   - manufacturer: STRING
//   - model: STRING
//   - msn: STRING (manufacturer serial number)
//   - status: STRING (active, stored, retired, etc.)
//   - manufactured_date: DATE
//   - delivery_date: DATE
//   - total_seats: INTEGER
//   - age_years: FLOAT
//   - created_at: DATETIME
//   - updated_at: DATETIME

// (:AircraftType)
// Properties:
//   - id: INTEGER (PostgreSQL ID)
//   - manufacturer: STRING
//   - model: STRING
//   - series: STRING
//   - full_name: STRING
//   - max_range_km: INTEGER
//   - max_seats: INTEGER
//   - engine_count: INTEGER
//   - created_at: DATETIME

// (:Airport)
// Properties:
//   - iata_code: STRING (3 chars)
//   - icao_code: STRING (4 chars)
//   - name: STRING
//   - city: STRING
//   - country: STRING
//   - latitude: FLOAT
//   - longitude: FLOAT

// (:Manufacturer)
// Properties:
//   - name: STRING
//   - country: STRING
//   - founded_year: INTEGER
//   - headquarters: STRING

// (:Alliance)
// Properties:
//   - name: STRING (oneworld, Star Alliance, SkyTeam)
//   - founded_year: INTEGER
//   - headquarters: STRING
//   - member_count: INTEGER

// =============================================================================
// RELATIONSHIP TYPE DEFINITIONS
// =============================================================================

// (:Airline)-[:OPERATES]->(:Aircraft)
// Properties:
//   - since_date: DATE
//   - status: STRING (active, leased, stored)
//   - operational_role: STRING (passenger, cargo, training)
//   - is_current: BOOLEAN

// (:Aircraft)-[:IS_TYPE]->(:AircraftType)
// Properties:
//   - configuration_variant: STRING

// (:Aircraft)-[:MANUFACTURED_BY]->(:Manufacturer)
// Properties:
//   - production_date: DATE
//   - msn: STRING
//   - line_number: INTEGER

// (:Aircraft)-[:BASED_AT]->(:Airport)
// Properties:
//   - assigned_date: DATE
//   - primary_routes: [STRING]

// (:Aircraft)-[:CURRENTLY_AT]->(:Airport)
// Properties:
//   - arrival_time: DATETIME
//   - departure_time: DATETIME
//   - purpose: STRING (maintenance, operations, storage)

// (:Airline)-[:MEMBER_OF]->(:Alliance)
// Properties:
//   - joined_date: DATE
//   - membership_type: STRING (full, associate, future)

// (:Aircraft)-[:REPLACED_BY]->(:Aircraft)
// Properties:
//   - retirement_date: DATE
//   - reason: STRING

// (:Aircraft)-[:REPLACES]->(:Aircraft)
// Properties:
//   - replacement_date: DATE
//   - reason: STRING

// (:Airline)-[:CODESHARE_PARTNER]->(:Airline)
// Properties:
//   - agreement_start: DATE
//   - agreement_end: DATE
//   - shared_routes: [STRING]

// (:Aircraft)-[:SISTER_AIRCRAFT]->(:Aircraft)
// Properties:
//   - production_sequence: INTEGER
//   - same_batch: BOOLEAN

// (:Manufacturer)-[:PRODUCES]->(:AircraftType)
// Properties:
//   - production_start: DATE
//   - production_end: DATE
//   - total_produced: INTEGER

// (:Airline)-[:SUBSIDIARY_OF]->(:Airline)
// Properties:
//   - ownership_percentage: FLOAT
//   - established_date: DATE

// (:AircraftType)-[:FAMILY_MEMBER]->(:AircraftType)
// Properties:
//   - family_name: STRING
//   - generation: INTEGER

// =============================================================================
// SAMPLE DATA CREATION PATTERNS
// =============================================================================

// Create an Airline node
// MERGE (a:Airline {
//     id: 1,
//     iata_code: 'AA',
//     icao_code: 'AAL',
//     name: 'American Airlines',
//     country: 'US',
//     alliance: 'oneworld',
//     business_model: 'full-service',
//     fleet_size: 950,
//     founded_year: 1926,
//     created_at: datetime(),
//     updated_at: datetime()
// })

// Create an Aircraft node
// MERGE (ac:Aircraft {
//     id: 1001,
//     registration: 'N12345',
//     aircraft_type: 'Boeing 737-800',
//     manufacturer: 'Boeing',
//     model: '737-800',
//     msn: '12345',
//     status: 'active',
//     manufactured_date: date('2015-06-15'),
//     total_seats: 160,
//     created_at: datetime()
// })

// Create an AircraftType node
// MERGE (at:AircraftType {
//     id: 10,
//     manufacturer: 'Boeing',
//     model: '737-800',
//     full_name: 'Boeing 737-800',
//     max_range_km: 5436,
//     max_seats: 189,
//     engine_count: 2,
//     created_at: datetime()
// })

// Create relationships
// MATCH (a:Airline {iata_code: 'AA'})
// MATCH (ac:Aircraft {registration: 'N12345'})
// MERGE (a)-[:OPERATES {
//     since_date: date('2015-07-01'),
//     status: 'active',
//     is_current: true
// }]->(ac)

// MATCH (ac:Aircraft {registration: 'N12345'})
// MATCH (at:AircraftType {full_name: 'Boeing 737-800'})
// MERGE (ac)-[:IS_TYPE]->(at)

// =============================================================================
// UTILITY QUERIES
// =============================================================================

// Query 1: Get complete fleet for an airline
// MATCH (al:Airline {iata_code: 'AA'})-[op:OPERATES]->(ac:Aircraft)-[:IS_TYPE]->(at:AircraftType)
// WHERE op.is_current = true
// RETURN ac.registration, at.full_name, ac.status, ac.age_years
// ORDER BY ac.registration

// Query 2: Get aircraft history (all operators)
// MATCH (ac:Aircraft {registration: 'N12345'})<-[op:OPERATES]-(al:Airline)
// RETURN al.name, op.since_date, op.is_current, op.status
// ORDER BY op.since_date DESC

// Query 3: Fleet composition by type
// MATCH (al:Airline {iata_code: 'AA'})-[op:OPERATES]->(ac:Aircraft)-[:IS_TYPE]->(at:AircraftType)
// WHERE op.is_current = true
// RETURN at.manufacturer, at.model,
//        count(ac) as count,
//        round(avg(ac.age_years), 1) as avg_age
// ORDER BY count DESC

// Query 4: Find aircraft with same serial number (re-registrations)
// MATCH path = (ac1:Aircraft {msn: '12345'})-[:REPLACED_BY*]->(ac2:Aircraft)
// RETURN path

// Query 5: Get airline fleet statistics
// MATCH (al:Airline {iata_code: 'AA'})-[op:OPERATES]->(ac:Aircraft)
// WHERE op.is_current = true
// RETURN al.name,
//        count(ac) as total_aircraft,
//        round(avg(ac.age_years), 1) as average_age,
//        count(CASE WHEN ac.status = 'active' THEN 1 END) as active_count,
//        count(CASE WHEN ac.status = 'stored' THEN 1 END) as stored_count

// Query 6: Find sister airlines (same alliance)
// MATCH (al1:Airline {iata_code: 'AA'})-[:MEMBER_OF]->(alliance:Alliance)<-[:MEMBER_OF]-(al2:Airline)
// WHERE al1 <> al2
// RETURN al2.name, al2.iata_code, alliance.name

// Query 7: Get aircraft type family tree
// MATCH (at:AircraftType)-[:FAMILY_MEMBER]->(family:AircraftType)
// WHERE family.model = '737'
// RETURN at.full_name, at.production_start, at.production_end
// ORDER BY at.production_start

// Query 8: Find aircraft replacements in fleet
// MATCH (old:Aircraft)-[:REPLACED_BY]->(new:Aircraft)
// MATCH (old)<-[:OPERATES]-(al:Airline {iata_code: 'AA'})
// MATCH (new)<-[:OPERATES]-(al)
// MATCH (old)-[:IS_TYPE]->(old_type:AircraftType)
// MATCH (new)-[:IS_TYPE]->(new_type:AircraftType)
// RETURN old.registration, old_type.model as old_model,
//        new.registration, new_type.model as new_model

// Query 9: Calculate fleet modernization rate
// MATCH (al:Airline {iata_code: 'AA'})-[op:OPERATES]->(ac:Aircraft)
// WHERE op.is_current = true
// WITH al,
//      count(ac) as total,
//      count(CASE WHEN ac.age_years <= 5 THEN 1 END) as modern,
//      count(CASE WHEN ac.age_years > 15 THEN 1 END) as aging
// RETURN al.name,
//        total,
//        modern,
//        aging,
//        round(100.0 * modern / total, 1) as modern_percentage

// Query 10: Find airlines operating similar fleets
// MATCH (al1:Airline {iata_code: 'AA'})-[:OPERATES]->(:Aircraft)-[:IS_TYPE]->(at:AircraftType)
// MATCH (al2:Airline)-[:OPERATES]->(:Aircraft)-[:IS_TYPE]->(at)
// WHERE al1 <> al2
// WITH al1, al2, count(DISTINCT at) as common_types
// WHERE common_types > 3
// RETURN al2.name, al2.iata_code, common_types
// ORDER BY common_types DESC
// LIMIT 10

// Query 11: Track aircraft lineage (previous registrations)
// MATCH path = (current:Aircraft {registration: 'N12345'})-[:REPLACED_BY*0..10]-(previous:Aircraft)
// RETURN path

// Query 12: Get all aircraft currently at an airport
// MATCH (ac:Aircraft)-[r:CURRENTLY_AT]->(ap:Airport {iata_code: 'JFK'})
// MATCH (ac)<-[op:OPERATES]-(al:Airline)
// WHERE op.is_current = true
// RETURN ac.registration, al.name, r.arrival_time, r.purpose

// Query 13: Find codeshare partnerships
// MATCH (al1:Airline)-[cs:CODESHARE_PARTNER]->(al2:Airline)
// RETURN al1.name, al2.name, cs.shared_routes

// Query 14: Manufacturer fleet distribution
// MATCH (m:Manufacturer)<-[:MANUFACTURED_BY]-(ac:Aircraft)<-[op:OPERATES]-(al:Airline)
// WHERE op.is_current = true
// RETURN m.name,
//        count(DISTINCT al) as airlines,
//        count(ac) as total_aircraft
// ORDER BY total_aircraft DESC

// Query 15: Find aircraft nearing retirement age
// MATCH (al:Airline {iata_code: 'AA'})-[op:OPERATES]->(ac:Aircraft)
// WHERE op.is_current = true AND ac.age_years > 20
// RETURN ac.registration, ac.aircraft_type, ac.age_years, ac.manufactured_date
// ORDER BY ac.age_years DESC

// =============================================================================
// GRAPH DATA SCIENCE QUERIES
// =============================================================================

// Query 16: Shortest path between two airlines (through codeshares)
// MATCH path = shortestPath(
//     (al1:Airline {iata_code: 'AA'})-[:CODESHARE_PARTNER*]-(al2:Airline {iata_code: 'BA'})
// )
// RETURN path

// Query 17: Community detection - Find airline clusters
// CALL gds.louvain.stream({
//     nodeProjection: 'Airline',
//     relationshipProjection: 'CODESHARE_PARTNER'
// })
// YIELD nodeId, communityId
// RETURN gds.util.asNode(nodeId).name as airline, communityId
// ORDER BY communityId

// Query 18: PageRank - Most influential airlines
// CALL gds.pageRank.stream({
//     nodeProjection: 'Airline',
//     relationshipProjection: 'CODESHARE_PARTNER'
// })
// YIELD nodeId, score
// RETURN gds.util.asNode(nodeId).name as airline, score
// ORDER BY score DESC
// LIMIT 10

// =============================================================================
// MAINTENANCE & ADMIN QUERIES
// =============================================================================

// Delete all nodes and relationships (DANGEROUS!)
// MATCH (n) DETACH DELETE n

// Count nodes by label
// MATCH (n)
// RETURN labels(n) as label, count(n) as count
// ORDER BY count DESC

// Count relationships by type
// MATCH ()-[r]->()
// RETURN type(r) as relationship_type, count(r) as count
// ORDER BY count DESC

// Find orphaned aircraft (no airline relationship)
// MATCH (ac:Aircraft)
// WHERE NOT (ac)<-[:OPERATES]-(:Airline)
// RETURN ac.registration, ac.status

// Update all aircraft ages
// MATCH (ac:Aircraft)
// WHERE ac.manufactured_date IS NOT NULL
// SET ac.age_years = duration.between(ac.manufactured_date, date()).years,
//     ac.updated_at = datetime()
// RETURN count(ac) as updated_count

// Find duplicate nodes
// MATCH (ac1:Aircraft), (ac2:Aircraft)
// WHERE ac1.registration = ac2.registration AND id(ac1) < id(ac2)
// RETURN ac1.registration, count(*) as duplicates

// =============================================================================
// SAMPLE ALLIANCE DATA
// =============================================================================

// Create major airline alliances
MERGE (ow:Alliance {
    name: 'oneworld',
    founded_year: 1999,
    headquarters: 'New York, NY'
})

MERGE (sa:Alliance {
    name: 'Star Alliance',
    founded_year: 1997,
    headquarters: 'Frankfurt, Germany'
})

MERGE (st:Alliance {
    name: 'SkyTeam',
    founded_year: 2000,
    headquarters: 'Amsterdam, Netherlands'
});

// =============================================================================
// SAMPLE MANUFACTURER DATA
// =============================================================================

// Create major aircraft manufacturers
MERGE (boeing:Manufacturer {
    name: 'Boeing',
    country: 'US',
    founded_year: 1916,
    headquarters: 'Chicago, IL'
})

MERGE (airbus:Manufacturer {
    name: 'Airbus',
    country: 'EU',
    founded_year: 1970,
    headquarters: 'Toulouse, France'
})

MERGE (embraer:Manufacturer {
    name: 'Embraer',
    country: 'BR',
    founded_year: 1969,
    headquarters: 'São Paulo, Brazil'
})

MERGE (bombardier:Manufacturer {
    name: 'Bombardier',
    country: 'CA',
    founded_year: 1942,
    headquarters: 'Montreal, Canada'
});

// =============================================================================
// COMPLETION MESSAGE
// =============================================================================

// Schema creation complete!
// Next steps:
// 1. Run sync script: npm run db:sync-neo4j
// 2. Verify data: MATCH (n) RETURN labels(n), count(n)
// 3. Test queries above to explore the graph

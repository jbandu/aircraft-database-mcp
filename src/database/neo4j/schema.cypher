// =============================================================================
// AIRCRAFT DATABASE - Neo4j Graph Schema
// =============================================================================
// Version: 1.0.0
// Purpose: Aircraft lineage, relationships, and operational networks
// =============================================================================

// =============================================================================
// CONSTRAINTS AND INDEXES
// =============================================================================

// Airline Constraints
CREATE CONSTRAINT airline_icao_unique IF NOT EXISTS
FOR (a:Airline) REQUIRE a.icao_code IS UNIQUE;

CREATE CONSTRAINT airline_id_unique IF NOT EXISTS
FOR (a:Airline) REQUIRE a.id IS UNIQUE;

// Aircraft Constraints
CREATE CONSTRAINT aircraft_registration_unique IF NOT EXISTS
FOR (ac:Aircraft) REQUIRE ac.registration IS UNIQUE;

CREATE CONSTRAINT aircraft_id_unique IF NOT EXISTS
FOR (ac:Aircraft) REQUIRE ac.id IS UNIQUE;

// Aircraft Type Constraints
CREATE CONSTRAINT aircraft_type_id_unique IF NOT EXISTS
FOR (at:AircraftType) REQUIRE at.id IS UNIQUE;

// Indexes for Performance
CREATE INDEX airline_name_idx IF NOT EXISTS
FOR (a:Airline) ON (a.name);

CREATE INDEX airline_country_idx IF NOT EXISTS
FOR (a:Airline) ON (a.country);

CREATE INDEX aircraft_status_idx IF NOT EXISTS
FOR (ac:Aircraft) ON (ac.status);

CREATE INDEX aircraft_type_idx IF NOT EXISTS
FOR (ac:Aircraft) ON (ac.type);

CREATE INDEX aircraft_manufacture_date_idx IF NOT EXISTS
FOR (ac:Aircraft) ON (ac.manufacture_date);

// =============================================================================
// NODE LABEL DESCRIPTIONS
// =============================================================================

// (:Airline) - Airlines operating aircraft
// Properties: id, icao_code, iata_code, name, country, founded_year, alliance

// (:Aircraft) - Individual aircraft registrations
// Properties: id, registration, serial_number, manufacture_date, status, age_years

// (:AircraftType) - Aircraft models and variants
// Properties: id, manufacturer, model, variant, family, category

// (:Airport) - Airports (for future route network analysis)
// Properties: id, icao_code, iata_code, name, city, country

// (:Configuration) - Aircraft seating configurations
// Properties: id, total_seats, classes, layout

// =============================================================================
// RELATIONSHIP TYPE DESCRIPTIONS
// =============================================================================

// (:Aircraft)-[:OPERATED_BY {start_date, end_date, is_current}]->(:Airline)
// Tracks which airline currently operates or previously operated an aircraft

// (:Aircraft)-[:IS_TYPE]->(:AircraftType)
// Links aircraft to its type/model

// (:Aircraft)-[:HAS_CONFIGURATION {effective_date, end_date}]->(:Configuration)
// Links aircraft to its seating configuration over time

// (:Aircraft)-[:PREVIOUS_REGISTRATION {registration, start_date, end_date}]->(:Aircraft)
// Links aircraft with same physical airframe but different registrations

// (:Aircraft)-[:MANUFACTURED_AS]->(:AircraftType)
// Original manufacturing specification

// (:Airline)-[:OPERATES_TYPE {count, average_age}]->(:AircraftType)
// Summary relationship of airline fleet composition

// (:Airline)-[:MEMBER_OF]->(:Alliance)
// Airline alliance membership (oneworld, Star Alliance, SkyTeam)

// (:Airline)-[:SUBSIDIARY_OF]->(:Airline)
// Parent-subsidiary airline relationships

// (:AircraftType)-[:MANUFACTURED_BY]->(:Manufacturer)
// Links aircraft types to manufacturers

// (:AircraftType)-[:FAMILY_MEMBER]->(:AircraftFamily)
// Links variants to their family (e.g., 737-800 -> 737 Family)

// (:Aircraft)-[:REPLACED_BY]->(:Aircraft)
// Tracks aircraft that replaced others in fleet

// =============================================================================
// SAMPLE DATA CREATION QUERIES
// =============================================================================

// Example: Create an airline
/*
CREATE (a:Airline {
    id: 'uuid-here',
    icao_code: 'AAL',
    iata_code: 'AA',
    name: 'American Airlines',
    country: 'US',
    founded_year: 1926,
    alliance: 'oneworld',
    headquarters: 'Fort Worth, TX',
    is_active: true,
    created_at: datetime(),
    updated_at: datetime()
})
*/

// Example: Create an aircraft type
/*
CREATE (at:AircraftType {
    id: 'uuid-here',
    manufacturer: 'Boeing',
    model: '737',
    variant: '800',
    family: '737 Family',
    icao_code: 'B738',
    iata_code: '738',
    category: 'narrowbody',
    engine_type: 'jet',
    max_range: 3115,
    typical_seats: 160,
    created_at: datetime()
})
*/

// Example: Create an aircraft and relationships
/*
CREATE (ac:Aircraft {
    id: 'uuid-here',
    registration: 'N12345',
    serial_number: '12345',
    manufacture_date: date('2015-06-15'),
    status: 'active',
    age_years: 9.5,
    created_at: datetime()
})

// Link to airline
MATCH (ac:Aircraft {registration: 'N12345'})
MATCH (al:Airline {icao_code: 'AAL'})
CREATE (ac)-[:OPERATED_BY {
    start_date: date('2015-07-01'),
    is_current: true,
    operator_type: 'owner'
}]->(al)

// Link to aircraft type
MATCH (ac:Aircraft {registration: 'N12345'})
MATCH (at:AircraftType {icao_code: 'B738'})
CREATE (ac)-[:IS_TYPE]->(at)
*/

// =============================================================================
// USEFUL QUERY PATTERNS
// =============================================================================

// Get complete fleet for an airline
/*
MATCH (ac:Aircraft)-[op:OPERATED_BY]->(al:Airline {icao_code: 'AAL'})
WHERE op.is_current = true
MATCH (ac)-[:IS_TYPE]->(at:AircraftType)
RETURN ac.registration, at.manufacturer, at.model, at.variant, ac.age_years, ac.status
ORDER BY ac.registration
*/

// Get aircraft history (all operators)
/*
MATCH (ac:Aircraft {registration: 'N12345'})-[op:OPERATED_BY]->(al:Airline)
RETURN al.name, op.start_date, op.end_date, op.is_current
ORDER BY op.start_date DESC
*/

// Get fleet composition by type
/*
MATCH (ac:Aircraft)-[op:OPERATED_BY]->(al:Airline {icao_code: 'AAL'})
WHERE op.is_current = true
MATCH (ac)-[:IS_TYPE]->(at:AircraftType)
RETURN at.manufacturer, at.model, at.variant,
       count(ac) as count,
       round(avg(ac.age_years), 1) as avg_age
ORDER BY count DESC
*/

// Find aircraft with same serial number (re-registrations)
/*
MATCH path = (ac1:Aircraft {serial_number: '12345'})-[:PREVIOUS_REGISTRATION*]->(ac2:Aircraft)
RETURN path
*/

// Get airline fleet statistics
/*
MATCH (ac:Aircraft)-[op:OPERATED_BY]->(al:Airline {icao_code: 'AAL'})
WHERE op.is_current = true
RETURN al.name,
       count(ac) as total_aircraft,
       round(avg(ac.age_years), 1) as average_age,
       count(CASE WHEN ac.status = 'active' THEN 1 END) as active_count,
       count(CASE WHEN ac.status = 'stored' THEN 1 END) as stored_count
*/

// Find sister airlines (same parent or alliance)
/*
MATCH (al1:Airline {icao_code: 'AAL'})-[:MEMBER_OF]->(alliance)
MATCH (al2:Airline)-[:MEMBER_OF]->(alliance)
WHERE al1 <> al2
RETURN al2.name, al2.icao_code, alliance.name
*/

// Get aircraft type family tree
/*
MATCH (at:AircraftType)-[:FAMILY_MEMBER]->(af:AircraftFamily)
WHERE af.name = '737 Family'
RETURN at.variant, at.production_start_year, at.production_end_year, at.is_in_production
ORDER BY at.production_start_year
*/

// Find aircraft replacements in fleet
/*
MATCH (old:Aircraft)-[:REPLACED_BY]->(new:Aircraft)
MATCH (old)-[:OPERATED_BY]->(al:Airline {icao_code: 'AAL'})
MATCH (new)-[:OPERATED_BY]->(al)
MATCH (old)-[:IS_TYPE]->(old_type:AircraftType)
MATCH (new)-[:IS_TYPE]->(new_type:AircraftType)
RETURN old.registration, old_type.model as old_model,
       new.registration, new_type.model as new_model,
       old.status, new.status
*/

// =============================================================================
// GRAPH DATA SCIENCE QUERIES
// =============================================================================

// Calculate fleet modernization rate
/*
MATCH (ac:Aircraft)-[op:OPERATED_BY]->(al:Airline {icao_code: 'AAL'})
WHERE op.is_current = true
WITH al,
     count(ac) as total,
     count(CASE WHEN ac.age_years <= 5 THEN 1 END) as modern,
     count(CASE WHEN ac.age_years > 15 THEN 1 END) as aging
RETURN al.name,
       total,
       modern,
       aging,
       round(100.0 * modern / total, 1) as modern_percentage,
       round(100.0 * aging / total, 1) as aging_percentage
*/

// Find airlines operating similar fleets
/*
MATCH (ac1:Aircraft)-[:OPERATED_BY]->(al1:Airline {icao_code: 'AAL'})
MATCH (ac1)-[:IS_TYPE]->(at:AircraftType)
MATCH (ac2:Aircraft)-[:OPERATED_BY]->(al2:Airline)
MATCH (ac2)-[:IS_TYPE]->(at)
WHERE al1 <> al2
WITH al1, al2, count(DISTINCT at) as common_types
WHERE common_types > 3
RETURN al2.name, al2.icao_code, common_types
ORDER BY common_types DESC
LIMIT 10
*/

// =============================================================================
// MAINTENANCE QUERIES
// =============================================================================

// Delete all nodes and relationships (DANGEROUS - use with caution)
/*
MATCH (n) DETACH DELETE n
*/

// Count nodes by label
/*
MATCH (n)
RETURN labels(n) as label, count(n) as count
ORDER BY count DESC
*/

// Count relationships by type
/*
MATCH ()-[r]->()
RETURN type(r) as relationship_type, count(r) as count
ORDER BY count DESC
*/

// Find orphaned aircraft (no airline relationship)
/*
MATCH (ac:Aircraft)
WHERE NOT (ac)-[:OPERATED_BY]->(:Airline)
RETURN ac.registration, ac.status
*/

// Update all aircraft ages (run periodically)
/*
MATCH (ac:Aircraft)
WHERE ac.manufacture_date IS NOT NULL
SET ac.age_years = duration.between(ac.manufacture_date, date()).years
SET ac.updated_at = datetime()
RETURN count(ac) as updated_count
*/

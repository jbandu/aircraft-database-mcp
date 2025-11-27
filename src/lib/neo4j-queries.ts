/**
 * Neo4j Query Helpers
 *
 * Pre-built Cypher queries for common operations
 */

import { queryNeo4j } from './db-clients.js';
import neo4j from 'neo4j-driver';

/**
 * Get airline fleet composition from Neo4j
 */
export async function getAirlineFleetComposition(airlineCode: string) {
  const cypher = `
    MATCH (al:Airline)-[op:OPERATES]->(ac:Aircraft)-[:IS_TYPE]->(at:AircraftType)
    WHERE (al.iata_code = $code OR al.icao_code = $code) AND op.is_current = true
    RETURN at.manufacturer as manufacturer,
           at.model as model,
           count(ac) as count,
           round(avg(ac.age_years), 1) as avg_age,
           collect(ac.registration)[..5] as sample_registrations
    ORDER BY count DESC
  `;

  const result = await queryNeo4j(cypher, { code: airlineCode });

  return result.records.map(record => ({
    manufacturer: record.get('manufacturer'),
    model: record.get('model'),
    count: record.get('count').toNumber(),
    avgAge: record.get('avg_age'),
    sampleRegistrations: record.get('sample_registrations'),
  }));
}

/**
 * Find aircraft by type across all airlines
 */
export async function findAircraftByType(aircraftType: string) {
  const cypher = `
    MATCH (ac:Aircraft)-[:IS_TYPE]->(at:AircraftType)
    WHERE at.full_name CONTAINS $type OR at.model CONTAINS $type
    MATCH (ac)<-[op:OPERATES]-(al:Airline)
    WHERE op.is_current = true
    RETURN ac.registration as registration,
           at.full_name as aircraft_type,
           al.name as airline,
           al.iata_code as airline_code,
           ac.status as status,
           ac.age_years as age_years
    ORDER BY al.name, ac.registration
    LIMIT 100
  `;

  const result = await queryNeo4j(cypher, { type: aircraftType });

  return result.records.map(record => ({
    registration: record.get('registration'),
    aircraftType: record.get('aircraft_type'),
    airline: record.get('airline'),
    airlineCode: record.get('airline_code'),
    status: record.get('status'),
    ageYears: record.get('age_years'),
  }));
}

/**
 * Track aircraft lineage and ownership history
 */
export async function getAircraftHistory(registration: string) {
  const cypher = `
    MATCH (ac:Aircraft {registration: $registration})<-[op:OPERATES]-(al:Airline)
    RETURN al.name as airline,
           al.iata_code as airline_code,
           op.since_date as since_date,
           op.is_current as is_current,
           op.status as status
    ORDER BY op.since_date DESC
  `;

  const result = await queryNeo4j(cypher, { registration });

  return result.records.map(record => ({
    airline: record.get('airline'),
    airlineCode: record.get('airline_code'),
    sinceDate: record.get('since_date'),
    isCurrent: record.get('is_current'),
    status: record.get('status'),
  }));
}

/**
 * Find similar airlines by fleet composition
 */
export async function findSimilarAirlines(airlineCode: string, minCommonTypes: number = 3) {
  const cypher = `
    MATCH (al1:Airline)-[:OPERATES]->(:Aircraft)-[:IS_TYPE]->(at:AircraftType)
    WHERE al1.iata_code = $code OR al1.icao_code = $code
    MATCH (al2:Airline)-[:OPERATES]->(:Aircraft)-[:IS_TYPE]->(at)
    WHERE al1 <> al2
    WITH al1, al2, count(DISTINCT at) as common_types
    WHERE common_types >= $minCommonTypes
    RETURN al2.name as airline,
           al2.iata_code as airline_code,
           al2.country as country,
           common_types
    ORDER BY common_types DESC
    LIMIT 10
  `;

  const result = await queryNeo4j(cypher, { code: airlineCode, minCommonTypes });

  return result.records.map(record => ({
    airline: record.get('airline'),
    airlineCode: record.get('airline_code'),
    country: record.get('country'),
    commonTypes: record.get('common_types').toNumber(),
  }));
}

/**
 * Identify fleet modernization patterns
 */
export async function getFleetModernizationStats(airlineCode: string) {
  const cypher = `
    MATCH (al:Airline)-[op:OPERATES]->(ac:Aircraft)
    WHERE (al.iata_code = $code OR al.icao_code = $code) AND op.is_current = true
    WITH al,
         count(ac) as total,
         count(CASE WHEN ac.age_years <= 5 THEN 1 END) as modern,
         count(CASE WHEN ac.age_years > 5 AND ac.age_years <= 15 THEN 1 END) as mid_age,
         count(CASE WHEN ac.age_years > 15 THEN 1 END) as aging,
         round(avg(ac.age_years), 1) as avg_age
    RETURN al.name as airline,
           total,
           modern,
           mid_age,
           aging,
           avg_age,
           round(100.0 * modern / total, 1) as modern_percentage,
           round(100.0 * aging / total, 1) as aging_percentage
  `;

  const result = await queryNeo4j(cypher, { code: airlineCode });

  if (result.records.length === 0) {
    return null;
  }

  const record = result.records[0]!;
  return {
    airline: record.get('airline'),
    total: record.get('total').toNumber(),
    modern: record.get('modern').toNumber(),
    midAge: record.get('mid_age').toNumber(),
    aging: record.get('aging').toNumber(),
    avgAge: record.get('avg_age'),
    modernPercentage: record.get('modern_percentage'),
    agingPercentage: record.get('aging_percentage'),
  };
}

/**
 * Get alliance network
 */
export async function getAllianceNetwork(allianceName: string) {
  const cypher = `
    MATCH (al:Airline)-[:MEMBER_OF]->(alliance:Alliance {name: $alliance})
    OPTIONAL MATCH (al)-[:OPERATES]->(ac:Aircraft)
    WITH al, alliance, count(ac) as fleet_size
    RETURN al.name as airline,
           al.iata_code as airline_code,
           al.country as country,
           fleet_size
    ORDER BY fleet_size DESC
  `;

  const result = await queryNeo4j(cypher, { alliance: allianceName });

  return result.records.map(record => ({
    airline: record.get('airline'),
    airlineCode: record.get('airline_code'),
    country: record.get('country'),
    fleetSize: record.get('fleet_size').toNumber(),
  }));
}

/**
 * Get manufacturer market share
 */
export async function getManufacturerMarketShare() {
  const cypher = `
    MATCH (m:Manufacturer)<-[:MANUFACTURED_BY]-(ac:Aircraft)<-[op:OPERATES]-(al:Airline)
    WHERE op.is_current = true AND ac.status = 'active'
    WITH m.name as manufacturer, count(ac) as aircraft_count
    WITH manufacturer, aircraft_count, sum(aircraft_count) as total
    RETURN manufacturer,
           aircraft_count,
           round(100.0 * aircraft_count / total, 2) as market_share_percentage
    ORDER BY aircraft_count DESC
  `;

  const result = await queryNeo4j(cypher);

  return result.records.map(record => ({
    manufacturer: record.get('manufacturer'),
    aircraftCount: record.get('aircraft_count').toNumber(),
    marketSharePercentage: record.get('market_share_percentage'),
  }));
}

/**
 * Find aircraft nearing retirement (> 20 years)
 */
export async function findAircraftNearingRetirement(airlineCode?: string) {
  let cypher = `
    MATCH (ac:Aircraft)<-[op:OPERATES]-(al:Airline)
    WHERE op.is_current = true AND ac.age_years > 20
  `;

  const params: any = {};

  if (airlineCode) {
    cypher += ` AND (al.iata_code = $code OR al.icao_code = $code)`;
    params.code = airlineCode;
  }

  cypher += `
    MATCH (ac)-[:IS_TYPE]->(at:AircraftType)
    RETURN ac.registration as registration,
           at.full_name as aircraft_type,
           al.name as airline,
           ac.age_years as age_years,
           ac.manufactured_date as manufactured_date
    ORDER BY ac.age_years DESC
    LIMIT 50
  `;

  const result = await queryNeo4j(cypher, params);

  return result.records.map(record => ({
    registration: record.get('registration'),
    aircraftType: record.get('aircraft_type'),
    airline: record.get('airline'),
    ageYears: record.get('age_years'),
    manufacturedDate: record.get('manufactured_date'),
  }));
}

/**
 * Get codeshare network for an airline
 */
export async function getCodesharePartners(airlineCode: string) {
  const cypher = `
    MATCH (al1:Airline)-[cs:CODESHARE_PARTNER]-(al2:Airline)
    WHERE al1.iata_code = $code OR al1.icao_code = $code
    RETURN al2.name as partner_airline,
           al2.iata_code as partner_code,
           al2.country as partner_country,
           cs.shared_routes as shared_routes,
           cs.agreement_start as agreement_start
    ORDER BY al2.name
  `;

  const result = await queryNeo4j(cypher, { code: airlineCode });

  return result.records.map(record => ({
    partnerAirline: record.get('partner_airline'),
    partnerCode: record.get('partner_code'),
    partnerCountry: record.get('partner_country'),
    sharedRoutes: record.get('shared_routes'),
    agreementStart: record.get('agreement_start'),
  }));
}

/**
 * Get aircraft type popularity ranking
 */
export async function getAircraftTypePopularity(limit: number = 20) {
  const cypher = `
    MATCH (ac:Aircraft)-[:IS_TYPE]->(at:AircraftType)
    MATCH (ac)<-[op:OPERATES]-(al:Airline)
    WHERE op.is_current = true AND ac.status = 'active'
    RETURN at.full_name as aircraft_type,
           at.manufacturer as manufacturer,
           count(DISTINCT ac) as total_aircraft,
           count(DISTINCT al) as operators_count,
           round(avg(ac.age_years), 1) as avg_age
    ORDER BY total_aircraft DESC
    LIMIT $limit
  `;

  const result = await queryNeo4j(cypher, { limit: neo4j.int(limit) });

  return result.records.map(record => ({
    aircraftType: record.get('aircraft_type'),
    manufacturer: record.get('manufacturer'),
    totalAircraft: record.get('total_aircraft').toNumber(),
    operatorsCount: record.get('operators_count').toNumber(),
    avgAge: record.get('avg_age'),
  }));
}

/**
 * Graph statistics summary
 */
export async function getGraphStatistics() {
  const nodeCountCypher = `
    MATCH (n)
    RETURN labels(n)[0] as label, count(n) as count
    ORDER BY count DESC
  `;

  const relCountCypher = `
    MATCH ()-[r]->()
    RETURN type(r) as type, count(r) as count
    ORDER BY count DESC
  `;

  const nodeResult = await queryNeo4j(nodeCountCypher);
  const relResult = await queryNeo4j(relCountCypher);

  return {
    nodes: nodeResult.records.map(r => ({
      label: r.get('label'),
      count: r.get('count').toNumber(),
    })),
    relationships: relResult.records.map(r => ({
      type: r.get('type'),
      count: r.get('count').toNumber(),
    })),
  };
}

/**
 * Export all query functions
 */
export const Neo4jQuery = {
  getAirlineFleetComposition,
  findAircraftByType,
  getAircraftHistory,
  findSimilarAirlines,
  getFleetModernizationStats,
  getAllianceNetwork,
  getManufacturerMarketShare,
  findAircraftNearingRetirement,
  getCodesharePartners,
  getAircraftTypePopularity,
  getGraphStatistics,
};

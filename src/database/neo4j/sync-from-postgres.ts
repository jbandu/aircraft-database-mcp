/**
 * PostgreSQL to Neo4j Synchronization Script
 *
 * Reads data from PostgreSQL and syncs to Neo4j knowledge graph
 * Maintains graph consistency and handles incremental updates
 */

import { queryPostgres, queryNeo4j, withNeo4jTransaction } from '../../lib/db-clients.js';
import { createLogger } from '../../lib/logger.js';
import neo4j from 'neo4j-driver';

const logger = createLogger('neo4j-sync');

interface SyncOptions {
  full?: boolean;          // Full sync or incremental
  entities?: string[];     // Specific entities to sync
  since?: Date;            // Sync changes since this date
  dryRun?: boolean;        // Preview changes without applying
  batchSize?: number;      // Number of records per batch
}

interface SyncResult {
  success: boolean;
  entitiesProcessed: Record<string, number>;
  relationshipsCreated: Record<string, number>;
  errors: string[];
  duration: number;
}

/**
 * Main sync orchestrator
 */
export class Neo4jSyncService {
  private batchSize: number;

  constructor(batchSize: number = 500) {
    this.batchSize = batchSize;
  }

  /**
   * Sync all data from PostgreSQL to Neo4j
   */
  async syncAll(options: SyncOptions = {}): Promise<SyncResult> {
    const startTime = Date.now();
    const result: SyncResult = {
      success: true,
      entitiesProcessed: {},
      relationshipsCreated: {},
      errors: [],
      duration: 0,
    };

    logger.info('Starting Neo4j sync', options);

    try {
      // Determine what to sync
      const entities = options.entities || [
        'airlines',
        'aircraft_types',
        'aircraft',
        'airports',
        'manufacturers',
        'alliances',
      ];

      // Sync nodes first
      for (const entity of entities) {
        try {
          const count = await this.syncEntity(entity, options);
          result.entitiesProcessed[entity] = count;
          logger.info(`Synced ${count} ${entity} nodes`);
        } catch (error) {
          const errorMsg = `Failed to sync ${entity}: ${error instanceof Error ? error.message : String(error)}`;
          logger.error(errorMsg);
          result.errors.push(errorMsg);
          result.success = false;
        }
      }

      // Sync relationships
      if (result.success || options.full) {
        const relationships = [
          'operates',
          'is_type',
          'manufactured_by',
          'member_of',
          'based_at',
          'replaced_by',
        ];

        for (const rel of relationships) {
          try {
            const count = await this.syncRelationship(rel, options);
            result.relationshipsCreated[rel] = count;
            logger.info(`Created ${count} ${rel} relationships`);
          } catch (error) {
            const errorMsg = `Failed to sync ${rel} relationships: ${error instanceof Error ? error.message : String(error)}`;
            logger.error(errorMsg);
            result.errors.push(errorMsg);
          }
        }
      }

      result.duration = Date.now() - startTime;
      logger.info('Neo4j sync completed', {
        duration: result.duration,
        entitiesProcessed: result.entitiesProcessed,
        relationshipsCreated: result.relationshipsCreated,
      });

      return result;
    } catch (error) {
      logger.error('Neo4j sync failed:', error);
      result.success = false;
      result.errors.push(error instanceof Error ? error.message : String(error));
      result.duration = Date.now() - startTime;
      return result;
    }
  }

  /**
   * Sync a specific entity type
   */
  private async syncEntity(entity: string, options: SyncOptions): Promise<number> {
    switch (entity) {
      case 'airlines':
        return await this.syncAirlines(options);
      case 'aircraft_types':
        return await this.syncAircraftTypes(options);
      case 'aircraft':
        return await this.syncAircraft(options);
      case 'airports':
        return await this.syncAirports(options);
      case 'manufacturers':
        return await this.syncManufacturers(options);
      case 'alliances':
        return await this.syncAlliances(options);
      default:
        throw new Error(`Unknown entity type: ${entity}`);
    }
  }

  /**
   * Sync airlines from PostgreSQL to Neo4j
   */
  private async syncAirlines(options: SyncOptions): Promise<number> {
    let query = `
      SELECT id, iata_code, icao_code, name, country, alliance, business_model,
             headquarters, fleet_size, founded_year, created_at, updated_at
      FROM airlines
      WHERE 1=1
    `;

    const params: any[] = [];

    if (options.since) {
      query += ' AND updated_at > $1';
      params.push(options.since);
    }

    const result = await queryPostgres(query, params);
    const airlines = result.rows;

    if (options.dryRun) {
      logger.info(`[DRY RUN] Would sync ${airlines.length} airlines`);
      return airlines.length;
    }

    // Batch process airlines
    for (let i = 0; i < airlines.length; i += this.batchSize) {
      const batch = airlines.slice(i, i + this.batchSize);

      const cypher = `
        UNWIND $airlines AS airline
        MERGE (a:Airline {id: airline.id})
        SET a.iata_code = airline.iata_code,
            a.icao_code = airline.icao_code,
            a.name = airline.name,
            a.country = airline.country,
            a.alliance = airline.alliance,
            a.business_model = airline.business_model,
            a.headquarters = airline.headquarters,
            a.fleet_size = airline.fleet_size,
            a.founded_year = airline.founded_year,
            a.created_at = datetime(airline.created_at),
            a.updated_at = datetime(airline.updated_at)
      `;

      await queryNeo4j(cypher, { airlines: batch });
    }

    return airlines.length;
  }

  /**
   * Sync aircraft types from PostgreSQL to Neo4j
   */
  private async syncAircraftTypes(options: SyncOptions): Promise<number> {
    let query = `
      SELECT id, manufacturer, model, series, full_name, max_range_km,
             max_seats, engine_count, created_at, updated_at
      FROM aircraft_types
      WHERE 1=1
    `;

    const params: any[] = [];

    if (options.since) {
      query += ' AND updated_at > $1';
      params.push(options.since);
    }

    const result = await queryPostgres(query, params);
    const types = result.rows;

    if (options.dryRun) {
      logger.info(`[DRY RUN] Would sync ${types.length} aircraft types`);
      return types.length;
    }

    for (let i = 0; i < types.length; i += this.batchSize) {
      const batch = types.slice(i, i + this.batchSize);

      const cypher = `
        UNWIND $types AS type
        MERGE (at:AircraftType {id: type.id})
        SET at.manufacturer = type.manufacturer,
            at.model = type.model,
            at.series = type.series,
            at.full_name = type.full_name,
            at.max_range_km = type.max_range_km,
            at.max_seats = type.max_seats,
            at.engine_count = type.engine_count,
            at.created_at = datetime(type.created_at),
            at.updated_at = datetime(type.updated_at)
      `;

      await queryNeo4j(cypher, { types: batch });
    }

    return types.length;
  }

  /**
   * Sync aircraft from PostgreSQL to Neo4j
   */
  private async syncAircraft(options: SyncOptions): Promise<number> {
    let query = `
      SELECT id, registration, aircraft_type, manufacturer, model, msn,
             status, manufactured_date, delivery_date, total_seats,
             EXTRACT(YEAR FROM AGE(CURRENT_DATE, manufactured_date))::FLOAT as age_years,
             created_at, updated_at
      FROM aircraft
      WHERE 1=1
    `;

    const params: any[] = [];

    if (options.since) {
      query += ' AND updated_at > $1';
      params.push(options.since);
    }

    const result = await queryPostgres(query, params);
    const aircraft = result.rows;

    if (options.dryRun) {
      logger.info(`[DRY RUN] Would sync ${aircraft.length} aircraft`);
      return aircraft.length;
    }

    for (let i = 0; i < aircraft.length; i += this.batchSize) {
      const batch = aircraft.slice(i, i + this.batchSize);

      const cypher = `
        UNWIND $aircraft AS ac
        MERGE (a:Aircraft {id: ac.id})
        SET a.registration = ac.registration,
            a.aircraft_type = ac.aircraft_type,
            a.manufacturer = ac.manufacturer,
            a.model = ac.model,
            a.msn = ac.msn,
            a.status = ac.status,
            a.manufactured_date = date(ac.manufactured_date),
            a.delivery_date = date(ac.delivery_date),
            a.total_seats = ac.total_seats,
            a.age_years = ac.age_years,
            a.created_at = datetime(ac.created_at),
            a.updated_at = datetime(ac.updated_at)
      `;

      await queryNeo4j(cypher, { aircraft: batch });
    }

    return aircraft.length;
  }

  /**
   * Sync airports (placeholder - would need airport data source)
   */
  private async syncAirports(options: SyncOptions): Promise<number> {
    // TODO: Implement when airport data is available
    logger.info('Airport sync not yet implemented');
    return 0;
  }

  /**
   * Sync manufacturers (extracted from aircraft_types)
   */
  private async syncManufacturers(options: SyncOptions): Promise<number> {
    const query = `
      SELECT DISTINCT manufacturer as name
      FROM aircraft_types
      WHERE manufacturer IS NOT NULL
    `;

    const result = await queryPostgres(query);
    const manufacturers = result.rows;

    if (options.dryRun) {
      logger.info(`[DRY RUN] Would sync ${manufacturers.length} manufacturers`);
      return manufacturers.length;
    }

    const cypher = `
      UNWIND $manufacturers AS mfr
      MERGE (m:Manufacturer {name: mfr.name})
    `;

    await queryNeo4j(cypher, { manufacturers });

    return manufacturers.length;
  }

  /**
   * Sync alliances (extracted from airlines)
   */
  private async syncAlliances(options: SyncOptions): Promise<number> {
    const query = `
      SELECT DISTINCT alliance as name
      FROM airlines
      WHERE alliance IS NOT NULL
    `;

    const result = await queryPostgres(query);
    const alliances = result.rows;

    if (options.dryRun) {
      logger.info(`[DRY RUN] Would sync ${alliances.length} alliances`);
      return alliances.length;
    }

    const cypher = `
      UNWIND $alliances AS al
      MERGE (a:Alliance {name: al.name})
    `;

    await queryNeo4j(cypher, { alliances });

    return alliances.length;
  }

  /**
   * Sync a specific relationship type
   */
  private async syncRelationship(relType: string, options: SyncOptions): Promise<number> {
    switch (relType) {
      case 'operates':
        return await this.syncOperatesRelationships(options);
      case 'is_type':
        return await this.syncIsTypeRelationships(options);
      case 'manufactured_by':
        return await this.syncManufacturedByRelationships(options);
      case 'member_of':
        return await this.syncMemberOfRelationships(options);
      case 'based_at':
        return await this.syncBasedAtRelationships(options);
      case 'replaced_by':
        return await this.syncReplacedByRelationships(options);
      default:
        throw new Error(`Unknown relationship type: ${relType}`);
    }
  }

  /**
   * Create OPERATES relationships (Airline -> Aircraft)
   */
  private async syncOperatesRelationships(options: SyncOptions): Promise<number> {
    const query = `
      SELECT a.airline_id, a.id as aircraft_id, a.in_service_date, a.status
      FROM aircraft a
      WHERE a.airline_id IS NOT NULL
    `;

    const result = await queryPostgres(query);
    const relationships = result.rows;

    if (options.dryRun) {
      logger.info(`[DRY RUN] Would create ${relationships.length} OPERATES relationships`);
      return relationships.length;
    }

    for (let i = 0; i < relationships.length; i += this.batchSize) {
      const batch = relationships.slice(i, i + this.batchSize);

      const cypher = `
        UNWIND $rels AS rel
        MATCH (al:Airline {id: rel.airline_id})
        MATCH (ac:Aircraft {id: rel.aircraft_id})
        MERGE (al)-[op:OPERATES]->(ac)
        SET op.since_date = date(rel.in_service_date),
            op.status = rel.status,
            op.is_current = true
      `;

      await queryNeo4j(cypher, { rels: batch });
    }

    return relationships.length;
  }

  /**
   * Create IS_TYPE relationships (Aircraft -> AircraftType)
   */
  private async syncIsTypeRelationships(options: SyncOptions): Promise<number> {
    const query = `
      SELECT a.id as aircraft_id, a.aircraft_type_id
      FROM aircraft a
      WHERE a.aircraft_type_id IS NOT NULL
    `;

    const result = await queryPostgres(query);
    const relationships = result.rows;

    if (options.dryRun) {
      logger.info(`[DRY RUN] Would create ${relationships.length} IS_TYPE relationships`);
      return relationships.length;
    }

    for (let i = 0; i < relationships.length; i += this.batchSize) {
      const batch = relationships.slice(i, i + this.batchSize);

      const cypher = `
        UNWIND $rels AS rel
        MATCH (ac:Aircraft {id: rel.aircraft_id})
        MATCH (at:AircraftType {id: rel.aircraft_type_id})
        MERGE (ac)-[:IS_TYPE]->(at)
      `;

      await queryNeo4j(cypher, { rels: batch });
    }

    return relationships.length;
  }

  /**
   * Create MANUFACTURED_BY relationships (Aircraft -> Manufacturer)
   */
  private async syncManufacturedByRelationships(options: SyncOptions): Promise<number> {
    const query = `
      SELECT a.id as aircraft_id, a.manufacturer, a.manufactured_date, a.msn
      FROM aircraft a
      WHERE a.manufacturer IS NOT NULL
    `;

    const result = await queryPostgres(query);
    const relationships = result.rows;

    if (options.dryRun) {
      logger.info(`[DRY RUN] Would create ${relationships.length} MANUFACTURED_BY relationships`);
      return relationships.length;
    }

    for (let i = 0; i < relationships.length; i += this.batchSize) {
      const batch = relationships.slice(i, i + this.batchSize);

      const cypher = `
        UNWIND $rels AS rel
        MATCH (ac:Aircraft {id: rel.aircraft_id})
        MATCH (m:Manufacturer {name: rel.manufacturer})
        MERGE (ac)-[mb:MANUFACTURED_BY]->(m)
        SET mb.production_date = date(rel.manufactured_date),
            mb.msn = rel.msn
      `;

      await queryNeo4j(cypher, { rels: batch });
    }

    return relationships.length;
  }

  /**
   * Create MEMBER_OF relationships (Airline -> Alliance)
   */
  private async syncMemberOfRelationships(options: SyncOptions): Promise<number> {
    const query = `
      SELECT id as airline_id, alliance
      FROM airlines
      WHERE alliance IS NOT NULL
    `;

    const result = await queryPostgres(query);
    const relationships = result.rows;

    if (options.dryRun) {
      logger.info(`[DRY RUN] Would create ${relationships.length} MEMBER_OF relationships`);
      return relationships.length;
    }

    for (let i = 0; i < relationships.length; i += this.batchSize) {
      const batch = relationships.slice(i, i + this.batchSize);

      const cypher = `
        UNWIND $rels AS rel
        MATCH (al:Airline {id: rel.airline_id})
        MATCH (alliance:Alliance {name: rel.alliance})
        MERGE (al)-[:MEMBER_OF]->(alliance)
      `;

      await queryNeo4j(cypher, { rels: batch });
    }

    return relationships.length;
  }

  /**
   * Create BASED_AT relationships (Aircraft -> Airport)
   */
  private async syncBasedAtRelationships(options: SyncOptions): Promise<number> {
    // TODO: Implement when airport data and home_base field are populated
    logger.info('BASED_AT relationships not yet implemented');
    return 0;
  }

  /**
   * Create REPLACED_BY relationships (Aircraft -> Aircraft)
   */
  private async syncReplacedByRelationships(options: SyncOptions): Promise<number> {
    const query = `
      SELECT fc.aircraft_id as old_aircraft_id,
             fc.registration as new_registration,
             fc.change_date as retirement_date,
             fc.reason
      FROM fleet_changes fc
      WHERE fc.change_type = 'retirement'
        AND fc.aircraft_id IS NOT NULL
    `;

    const result = await queryPostgres(query);
    const relationships = result.rows;

    if (options.dryRun) {
      logger.info(`[DRY RUN] Would create ${relationships.length} REPLACED_BY relationships`);
      return relationships.length;
    }

    // This is more complex as we need to find the replacement aircraft
    // For now, just log that it would be created
    logger.info('REPLACED_BY relationships require more complex matching logic');
    return 0;
  }

  /**
   * Clear all Neo4j data (DANGEROUS!)
   */
  async clearGraph(): Promise<void> {
    logger.warn('Clearing entire Neo4j graph!');
    await queryNeo4j('MATCH (n) DETACH DELETE n');
    logger.info('Neo4j graph cleared');
  }

  /**
   * Get sync statistics
   */
  async getSyncStats(): Promise<any> {
    const nodeCountsQuery = `
      MATCH (n)
      RETURN labels(n) as label, count(n) as count
      ORDER BY count DESC
    `;

    const relCountsQuery = `
      MATCH ()-[r]->()
      RETURN type(r) as type, count(r) as count
      ORDER BY count DESC
    `;

    const nodeResult = await queryNeo4j(nodeCountsQuery);
    const relResult = await queryNeo4j(relCountsQuery);

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
}

/**
 * CLI entry point
 */
export async function main() {
  const args = process.argv.slice(2);
  const options: SyncOptions = {
    full: args.includes('--full'),
    dryRun: args.includes('--dry-run'),
  };

  logger.info('Starting Neo4j sync from CLI');

  const syncService = new Neo4jSyncService();

  try {
    // Clear graph if requested
    if (args.includes('--clear')) {
      await syncService.clearGraph();
    }

    // Run sync
    const result = await syncService.syncAll(options);

    // Print results
    logger.info('Sync complete:', result);

    // Show statistics
    const stats = await syncService.getSyncStats();
    logger.info('Graph statistics:', stats);

    process.exit(result.success ? 0 : 1);
  } catch (error) {
    logger.error('Sync failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

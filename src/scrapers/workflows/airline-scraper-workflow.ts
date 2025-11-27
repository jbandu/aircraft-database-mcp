/**
 * Airline Scraper Workflow
 *
 * Orchestrates the complete scraping process for an airline:
 * 1. Fleet Discovery - Find all aircraft
 * 2. Details Extraction - Get specs for each aircraft (parallel)
 * 3. Validation - Validate and merge data
 * 4. Database Update - Save to PostgreSQL and Neo4j
 * 5. Report Generation - Create summary report
 */

import { createLogger } from '../../lib/logger.js';
import { queryPostgres } from '../../lib/db-clients.js';
import { FleetDiscoveryAgent } from '../agents/fleet-discovery-agent.js';
import { AircraftDetailsAgent } from '../agents/aircraft-details-agent.js';
import { ValidationAgent } from '../agents/validation-agent.js';
import type { AircraftDetails } from '../agents/aircraft-details-agent.js';
import type { ValidationResult } from '../agents/validation-agent.js';

const logger = createLogger('workflow');

export interface WorkflowResult {
  airline_code: string;
  aircraft_found: number;
  aircraft_added: number;
  aircraft_updated: number;
  aircraft_skipped: number;
  errors: number;
  duration_ms: number;
  confidence_avg: number;
  details: {
    discovery: any;
    processing: ProcessingDetail[];
    errors: ErrorDetail[];
  };
}

export interface ProcessingDetail {
  registration: string;
  action: 'added' | 'updated' | 'skipped';
  confidence: number;
  issues: number;
}

export interface ErrorDetail {
  registration?: string;
  stage: 'discovery' | 'details' | 'validation' | 'database';
  error: string;
}

export class AirlineScraperWorkflow {
  private discoveryAgent = new FleetDiscoveryAgent();
  private detailsAgent = new AircraftDetailsAgent();
  private validationAgent = new ValidationAgent();
  private concurrencyLimit: number;

  constructor(options?: { concurrencyLimit?: number }) {
    this.concurrencyLimit = options?.concurrencyLimit || 5;
  }

  /**
   * Run full fleet update for an airline
   */
  async runFullUpdate(
    airlineCode: string,
    options?: {
      forceFullScrape?: boolean;
      dryRun?: boolean;
    }
  ): Promise<WorkflowResult> {
    const startTime = Date.now();
    logger.info(`Starting full fleet update for ${airlineCode}`);

    const result: WorkflowResult = {
      airline_code: airlineCode,
      aircraft_found: 0,
      aircraft_added: 0,
      aircraft_updated: 0,
      aircraft_skipped: 0,
      errors: 0,
      duration_ms: 0,
      confidence_avg: 0,
      details: {
        discovery: null,
        processing: [],
        errors: [],
      },
    };

    try {
      // Phase 1: Fleet Discovery
      logger.info('Phase 1: Fleet Discovery');
      const discovered = await this.discoveryAgent.discoverFleet(airlineCode, {
        forceFullScrape: options?.forceFullScrape,
      });

      result.aircraft_found = discovered.aircraft_found.length;
      result.details.discovery = {
        count: discovered.aircraft_found,
        confidence: discovered.confidence,
        sources: discovered.source_urls,
        method: discovered.method,
      };

      logger.info(
        `Discovered ${discovered.aircraft_found.length} aircraft (confidence: ${discovered.confidence})`
      );

      if (discovered.aircraft_found.length === 0) {
        logger.warn('No aircraft found during discovery');
        result.duration_ms = Date.now() - startTime;
        return result;
      }

      // Phase 2: Details Extraction (parallel with concurrency limit)
      logger.info('Phase 2: Details Extraction');
      const aircraftDetails = await this.extractDetailsInBatches(
        discovered.aircraft_found,
        airlineCode
      );

      // Phase 3: Validation (parallel)
      logger.info('Phase 3: Validation');
      const validated = await this.validateInBatches(aircraftDetails);

      // Phase 4: Database Update
      logger.info('Phase 4: Database Update');
      if (!options?.dryRun) {
        const dbResults = await this.updateDatabase(airlineCode, validated);
        result.aircraft_added = dbResults.added;
        result.aircraft_updated = dbResults.updated;
        result.aircraft_skipped = dbResults.skipped;
        result.errors = dbResults.errors;
        result.details.processing = dbResults.details;
        result.details.errors.push(...dbResults.errorDetails);
      } else {
        logger.info('DRY RUN - Skipping database updates');
        result.aircraft_skipped = validated.length;
      }

      // Calculate average confidence
      const confidenceScores = validated.map((v) => v.aircraft.confidence_score);
      result.confidence_avg =
        confidenceScores.reduce((a, b) => a + b, 0) / confidenceScores.length;

      // Update airline's last_scraped_at
      if (!options?.dryRun) {
        await this.updateAirlineTimestamp(airlineCode);
      }

      result.duration_ms = Date.now() - startTime;

      logger.info(
        `Workflow complete: ${result.aircraft_added} added, ${result.aircraft_updated} updated, ${result.errors} errors (${(result.duration_ms / 1000).toFixed(1)}s)`
      );

      return result;
    } catch (error) {
      logger.error('Workflow failed:', error);
      result.errors++;
      result.details.errors.push({
        stage: 'discovery',
        error: error instanceof Error ? error.message : String(error),
      });
      result.duration_ms = Date.now() - startTime;
      throw error;
    }
  }

  /**
   * Extract details for aircraft in batches with concurrency control
   */
  private async extractDetailsInBatches(
    registrations: string[],
    airlineCode: string
  ): Promise<AircraftDetails[]> {
    const results: AircraftDetails[] = [];
    const batches = this.createBatches(registrations, this.concurrencyLimit);

    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i]!;
      logger.info(
        `Processing batch ${i + 1}/${batches.length} (${batch.length} aircraft)`
      );

      const batchResults = await Promise.allSettled(
        batch!.map((registration) =>
          this.detailsAgent.extractDetails(registration, { airlineCode })
        )
      );

      for (let j = 0; j < batchResults.length; j++) {
        const result = batchResults[j]!;
        if (result.status === 'fulfilled') {
          results.push(result.value);
        } else {
          logger.error(
            `Failed to extract details for ${batch![j]}:`,
            result.reason
          );
        }
      }

      // Rate limiting between batches
      if (i < batches.length - 1) {
        await this.sleep(2000);
      }
    }

    logger.info(`Successfully extracted details for ${results.length} aircraft`);
    return results;
  }

  /**
   * Validate aircraft in batches
   */
  private async validateInBatches(
    aircraftList: AircraftDetails[]
  ): Promise<Array<{ aircraft: AircraftDetails; validation: ValidationResult }>> {
    const results: Array<{
      aircraft: AircraftDetails;
      validation: ValidationResult;
    }> = [];

    const batches = this.createBatches(aircraftList, this.concurrencyLimit);

    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i]!;
      logger.info(
        `Validating batch ${i + 1}/${batches.length} (${batch.length} aircraft)`
      );

      const batchResults = await Promise.allSettled(
        batch!.map(async (aircraft) => {
          // Get existing data for cross-reference
          const existing = await this.getExistingAircraft(aircraft.registration);
          const validation = await this.validationAgent.validate(
            aircraft,
            existing
          );

          // Apply recommendations
          const merged = {
            ...aircraft,
            ...validation.recommended_values,
            confidence_score: validation.confidence_score,
          };

          return { aircraft: merged, validation };
        })
      );

      for (const result of batchResults) {
        if (result.status === 'fulfilled') {
          results.push(result.value);
        } else {
          logger.error('Validation failed:', result.reason);
        }
      }
    }

    logger.info(`Successfully validated ${results.length} aircraft`);
    return results;
  }

  /**
   * Update database with validated aircraft data
   */
  private async updateDatabase(
    airlineCode: string,
    validated: Array<{ aircraft: AircraftDetails; validation: ValidationResult }>
  ): Promise<{
    added: number;
    updated: number;
    skipped: number;
    errors: number;
    details: ProcessingDetail[];
    errorDetails: ErrorDetail[];
  }> {
    let added = 0;
    let updated = 0;
    let skipped = 0;
    let errors = 0;
    const details: ProcessingDetail[] = [];
    const errorDetails: ErrorDetail[] = [];

    // Get airline ID
    const airlineResult = await queryPostgres(
      `SELECT id FROM airlines WHERE UPPER(iata_code) = UPPER($1) OR UPPER(icao_code) = UPPER($1) LIMIT 1`,
      [airlineCode]
    );

    if (airlineResult.rows.length === 0) {
      throw new Error(`Airline not found: ${airlineCode}`);
    }

    const airlineId = airlineResult.rows[0].id;

    // Process each aircraft
    for (const { aircraft, validation } of validated) {
      try {
        // Skip if validation failed with errors
        if (!validation.is_valid) {
          logger.warn(
            `Skipping ${aircraft.registration}: ${validation.validation_summary}`
          );
          skipped++;
          details.push({
            registration: aircraft.registration,
            action: 'skipped',
            confidence: validation.confidence_score,
            issues: validation.issues.length,
          });
          continue;
        }

        // Check if aircraft exists
        const existing = await this.getExistingAircraft(aircraft.registration);

        if (existing) {
          // Update existing
          await this.updateAircraft(airlineId, aircraft, validation);
          updated++;
          details.push({
            registration: aircraft.registration,
            action: 'updated',
            confidence: validation.confidence_score,
            issues: validation.issues.length,
          });
        } else {
          // Insert new
          await this.insertAircraft(airlineId, aircraft, validation);
          added++;
          details.push({
            registration: aircraft.registration,
            action: 'added',
            confidence: validation.confidence_score,
            issues: validation.issues.length,
          });
        }
      } catch (error) {
        logger.error(
          `Failed to save ${aircraft.registration}:`,
          error instanceof Error ? error.message : error
        );
        errors++;
        errorDetails.push({
          registration: aircraft.registration,
          stage: 'database',
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    logger.info(
      `Database update complete: ${added} added, ${updated} updated, ${skipped} skipped, ${errors} errors`
    );

    return { added, updated, skipped, errors, details, errorDetails };
  }

  /**
   * Get existing aircraft from database
   */
  private async getExistingAircraft(
    registration: string
  ): Promise<AircraftDetails | null> {
    const query = `
      SELECT
        a.id,
        a.registration,
        at.iata_code as aircraft_type,
        at.manufacturer,
        at.model,
        a.msn,
        a.seat_configuration,
        a.delivery_date,
        a.status,
        a.current_location,
        a.last_flight_date,
        a.data_confidence
      FROM aircraft a
      JOIN aircraft_types at ON a.aircraft_type_id = at.id
      WHERE UPPER(a.registration) = UPPER($1)
      LIMIT 1
    `;

    const result = await queryPostgres(query, [registration]);

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    return {
      registration: row.registration,
      aircraft_type: row.aircraft_type,
      manufacturer: row.manufacturer,
      model: row.model,
      msn: row.msn,
      seat_configuration: row.seat_configuration || {},
      delivery_date: row.delivery_date,
      age_years: null,
      status: row.status,
      current_location: row.current_location,
      last_flight_date: row.last_flight_date,
      engines: null,
      confidence_score: row.data_confidence || 0,
      data_sources: ['database'],
      extracted_at: new Date(),
    };
  }

  /**
   * Insert new aircraft
   */
  private async insertAircraft(
    airlineId: number,
    aircraft: AircraftDetails,
    validation: ValidationResult
  ): Promise<void> {
    // Get aircraft type ID
    const typeResult = await queryPostgres(
      `SELECT id FROM aircraft_types WHERE iata_code = $1 OR icao_code = $1 LIMIT 1`,
      [aircraft.aircraft_type]
    );

    if (typeResult.rows.length === 0) {
      throw new Error(`Aircraft type not found: ${aircraft.aircraft_type}`);
    }

    const typeId = typeResult.rows[0].id;

    const insertQuery = `
      INSERT INTO aircraft (
        airline_id,
        aircraft_type_id,
        registration,
        msn,
        seat_configuration,
        delivery_date,
        status,
        current_location,
        last_flight_date,
        data_confidence,
        data_sources,
        last_scraped_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())
    `;

    await queryPostgres(insertQuery, [
      airlineId,
      typeId,
      aircraft.registration,
      aircraft.msn,
      JSON.stringify(aircraft.seat_configuration),
      aircraft.delivery_date,
      aircraft.status,
      aircraft.current_location,
      aircraft.last_flight_date,
      validation.confidence_score,
      JSON.stringify(aircraft.data_sources),
    ]);

    logger.info(`Inserted new aircraft: ${aircraft.registration}`);
  }

  /**
   * Update existing aircraft
   */
  private async updateAircraft(
    _airlineId: number,
    aircraft: AircraftDetails,
    validation: ValidationResult
  ): Promise<void> {
    // Get aircraft type ID
    const typeResult = await queryPostgres(
      `SELECT id FROM aircraft_types WHERE iata_code = $1 OR icao_code = $1 LIMIT 1`,
      [aircraft.aircraft_type]
    );

    if (typeResult.rows.length === 0) {
      throw new Error(`Aircraft type not found: ${aircraft.aircraft_type}`);
    }

    const typeId = typeResult.rows[0].id;

    const updateQuery = `
      UPDATE aircraft
      SET
        aircraft_type_id = $2,
        msn = COALESCE($3, msn),
        seat_configuration = COALESCE($4, seat_configuration),
        delivery_date = COALESCE($5, delivery_date),
        status = $6,
        current_location = COALESCE($7, current_location),
        last_flight_date = COALESCE($8, last_flight_date),
        data_confidence = $9,
        data_sources = $10,
        last_scraped_at = NOW(),
        updated_at = NOW()
      WHERE UPPER(registration) = UPPER($1)
    `;

    await queryPostgres(updateQuery, [
      aircraft.registration,
      typeId,
      aircraft.msn,
      JSON.stringify(aircraft.seat_configuration),
      aircraft.delivery_date,
      aircraft.status,
      aircraft.current_location,
      aircraft.last_flight_date,
      validation.confidence_score,
      JSON.stringify(aircraft.data_sources),
    ]);

    logger.info(`Updated aircraft: ${aircraft.registration}`);
  }

  /**
   * Update airline's last_scraped_at timestamp
   */
  private async updateAirlineTimestamp(airlineCode: string): Promise<void> {
    const query = `
      UPDATE airlines
      SET last_scraped_at = NOW()
      WHERE UPPER(iata_code) = UPPER($1) OR UPPER(icao_code) = UPPER($1)
    `;

    await queryPostgres(query, [airlineCode]);
    logger.info(`Updated last_scraped_at for ${airlineCode}`);
  }

  /**
   * Create batches from array
   */
  private createBatches<T>(items: T[], batchSize: number): T[][] {
    const batches: T[][] = [];
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize));
    }
    return batches;
  }

  /**
   * Sleep helper
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// CLI support for running workflow directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  const airlineCode = args.find((arg) => arg.startsWith('--airline='))?.split('=')[1];
  const forceFullScrape = args.includes('--force');
  const dryRun = args.includes('--dry-run');

  if (!airlineCode) {
    console.error('Usage: npm run scraper:run -- --airline=AA [--force] [--dry-run]');
    process.exit(1);
  }

  const workflow = new AirlineScraperWorkflow();
  workflow
    .runFullUpdate(airlineCode, { forceFullScrape, dryRun })
    .then((result) => {
      console.log('\n=== Workflow Result ===');
      console.log(JSON.stringify(result, null, 2));
      process.exit(result.errors > 0 ? 1 : 0);
    })
    .catch((error) => {
      console.error('Workflow failed:', error);
      process.exit(1);
    });
}

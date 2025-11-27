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
import { queryPostgres, initializeDatabases, closeDatabases } from '../../lib/db-clients.js';
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
        // Only skip if registration is empty/null (truly invalid data)
        if (!aircraft.registration || aircraft.registration.trim() === '') {
          logger.warn(
            `Skipping invalid aircraft: empty registration`
          );
          skipped++;
          details.push({
            registration: aircraft.registration || 'UNKNOWN',
            action: 'skipped',
            confidence: validation.confidence_score,
            issues: validation.issues.length,
          });
          continue;
        }

        // Always proceed with aircraft that have a registration, regardless of validation issues
        if (!validation.is_valid) {
          logger.info(
            `Processing ${aircraft.registration} with validation issues: ${validation.validation_summary} (confidence: ${validation.confidence_score.toFixed(2)})`
          );
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
        a.manufacturer_serial_number as msn,
        ac.class_first,
        ac.class_business,
        ac.class_premium_economy,
        ac.class_economy,
        ac.total_seats,
        a.delivery_date,
        a.age_years,
        a.status,
        a.last_seen_date,
        at.engine_type as engines,
        a.metadata
      FROM aircraft a
      JOIN aircraft_types at ON a.aircraft_type_id = at.id
      LEFT JOIN aircraft_configurations ac ON a.id = ac.aircraft_id AND ac.is_current = true
      WHERE UPPER(a.registration) = UPPER($1)
      LIMIT 1
    `;

    const result = await queryPostgres(query, [registration]);

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    const metadata = row.metadata || {};

    return {
      registration: row.registration,
      aircraft_type: row.aircraft_type,
      manufacturer: row.manufacturer,
      model: row.model,
      msn: row.msn,
      seat_configuration: {
        first: row.class_first || undefined,
        business: row.class_business || undefined,
        premium_economy: row.class_premium_economy || undefined,
        economy: row.class_economy || undefined,
        total: row.total_seats || undefined,
      },
      delivery_date: row.delivery_date,
      age_years: row.age_years,
      status: row.status,
      current_location: null, // Not stored in schema
      last_flight_date: row.last_seen_date,
      engines: row.engines,
      confidence_score: metadata.confidence_score || 0.9,
      data_sources: metadata.data_sources || ['database'],
      extracted_at: new Date(),
    };
  }

  /**
   * Insert new aircraft
   */
  private async insertAircraft(
    airlineId: string,
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

    // Prepare metadata with confidence and sources
    const metadata = {
      confidence_score: validation.confidence_score,
      data_sources: aircraft.data_sources,
      extracted_at: aircraft.extracted_at.toISOString(),
    };

    // Calculate age if we have delivery date
    let ageYears = aircraft.age_years;
    if (aircraft.delivery_date && !ageYears) {
      const deliveryYear = new Date(aircraft.delivery_date).getFullYear();
      const currentYear = new Date().getFullYear();
      ageYears = currentYear - deliveryYear;
    }

    const insertQuery = `
      INSERT INTO aircraft (
        current_airline_id,
        aircraft_type_id,
        registration,
        manufacturer_serial_number,
        delivery_date,
        age_years,
        status,
        last_seen_date,
        metadata,
        last_scraped_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
      RETURNING id
    `;

    const result = await queryPostgres(insertQuery, [
      airlineId,
      typeId,
      aircraft.registration,
      aircraft.msn,
      aircraft.delivery_date,
      ageYears,
      aircraft.status || 'Unknown',
      aircraft.last_flight_date, // Maps to last_seen_date in DB
      JSON.stringify(metadata),
    ]);

    const aircraftId = result.rows[0].id;

    // Insert seat configuration if available
    if (
      aircraft.seat_configuration &&
      Object.keys(aircraft.seat_configuration).length > 0
    ) {
      await this.insertAircraftConfiguration(aircraftId, aircraft.seat_configuration);
    }

    logger.info(`Inserted new aircraft: ${aircraft.registration}`);
  }

  /**
   * Insert aircraft configuration (seat layout)
   */
  private async insertAircraftConfiguration(
    aircraftId: string,
    seatConfig: {
      first?: number;
      business?: number;
      premium_economy?: number;
      economy?: number;
      total?: number;
    }
  ): Promise<void> {
    const insertQuery = `
      INSERT INTO aircraft_configurations (
        aircraft_id,
        class_first,
        class_business,
        class_premium_economy,
        class_economy,
        total_seats,
        is_current
      ) VALUES ($1, $2, $3, $4, $5, $6, true)
    `;

    await queryPostgres(insertQuery, [
      aircraftId,
      seatConfig.first || null,
      seatConfig.business || null,
      seatConfig.premium_economy || null,
      seatConfig.economy || null,
      seatConfig.total || null,
    ]);
  }

  /**
   * Update existing aircraft
   */
  private async updateAircraft(
    _airlineId: string,
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

    // Prepare metadata with confidence and sources
    const metadata = {
      confidence_score: validation.confidence_score,
      data_sources: aircraft.data_sources,
      extracted_at: aircraft.extracted_at.toISOString(),
    };

    // Calculate age if we have delivery date
    let ageYears = aircraft.age_years;
    if (aircraft.delivery_date && !ageYears) {
      const deliveryYear = new Date(aircraft.delivery_date).getFullYear();
      const currentYear = new Date().getFullYear();
      ageYears = currentYear - deliveryYear;
    }

    const updateQuery = `
      UPDATE aircraft
      SET
        aircraft_type_id = $2,
        manufacturer_serial_number = COALESCE($3, manufacturer_serial_number),
        delivery_date = COALESCE($4, delivery_date),
        age_years = COALESCE($5, age_years),
        status = $6,
        last_seen_date = COALESCE($7, last_seen_date),
        metadata = $8,
        last_scraped_at = NOW(),
        updated_at = NOW()
      WHERE UPPER(registration) = UPPER($1)
      RETURNING id
    `;

    const result = await queryPostgres(updateQuery, [
      aircraft.registration,
      typeId,
      aircraft.msn,
      aircraft.delivery_date,
      ageYears,
      aircraft.status || 'Unknown',
      aircraft.last_flight_date, // Maps to last_seen_date in DB
      JSON.stringify(metadata),
    ]);

    const aircraftId = result.rows[0].id;

    // Update seat configuration if available
    if (
      aircraft.seat_configuration &&
      Object.keys(aircraft.seat_configuration).length > 0
    ) {
      await this.updateAircraftConfiguration(aircraftId, aircraft.seat_configuration);
    }

    logger.info(`Updated aircraft: ${aircraft.registration}`);
  }

  /**
   * Update aircraft configuration (seat layout)
   * First marks old configs as not current, then inserts new one
   */
  private async updateAircraftConfiguration(
    aircraftId: string,
    seatConfig: {
      first?: number;
      business?: number;
      premium_economy?: number;
      economy?: number;
      total?: number;
    }
  ): Promise<void> {
    // Mark existing configurations as not current
    await queryPostgres(
      `UPDATE aircraft_configurations SET is_current = false WHERE aircraft_id = $1`,
      [aircraftId]
    );

    // Insert new configuration
    await this.insertAircraftConfiguration(aircraftId, seatConfig);
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

  // Initialize databases first
  initializeDatabases()
    .then(async () => {
      const workflow = new AirlineScraperWorkflow();
      return workflow.runFullUpdate(airlineCode, { forceFullScrape, dryRun });
    })
    .then(async (result) => {
      console.log('\n=== Workflow Result ===');
      console.log(JSON.stringify(result, null, 2));
      await closeDatabases();
      process.exit(result.errors > 0 ? 1 : 0);
    })
    .catch(async (error) => {
      console.error('Workflow failed:', error);
      await closeDatabases();
      process.exit(1);
    });
}

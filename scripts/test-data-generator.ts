/**
 * Test Data Generator
 *
 * Generates realistic mock data for testing MCP tools:
 * - Mock airlines
 * - Mock aircraft
 * - Mock fleet data
 * - Mock scraping jobs
 */

import { createLogger } from '../src/lib/logger.js';
import { queryPostgres } from '../src/lib/db-clients.js';

const logger = createLogger('test-data-generator');

export class TestDataGenerator {
  /**
   * Generate complete test dataset
   */
  async generateTestData(options?: { clean?: boolean }): Promise<void> {
    logger.info('Generating test data...');

    if (options?.clean) {
      await this.cleanTestData();
    }

    await this.generateTestAirlines();
    await this.generateTestAircraft();
    await this.generateTestJobs();

    logger.info('Test data generation complete');
  }

  /**
   * Clean existing test data
   */
  async cleanTestData(): Promise<void> {
    logger.info('Cleaning existing test data...');

    // Delete test aircraft
    await queryPostgres(`
      DELETE FROM aircraft
      WHERE airline_id IN (
        SELECT id FROM airlines WHERE iata_code LIKE 'T%'
      )
    `);

    // Delete test jobs
    await queryPostgres(`
      DELETE FROM scraping_jobs
      WHERE airline_id IN (
        SELECT id FROM airlines WHERE iata_code LIKE 'T%'
      )
    `);

    // Delete test airlines
    await queryPostgres(`
      DELETE FROM airlines WHERE iata_code LIKE 'T%'
    `);

    logger.info('Test data cleaned');
  }

  /**
   * Generate test airlines
   */
  private async generateTestAirlines(): Promise<void> {
    logger.info('Generating test airlines...');

    const airlines = [
      {
        iata: 'TS',
        icao: 'TST',
        name: 'Test Airlines',
        country: 'United States',
        hub: 'KORD',
      },
      {
        iata: 'TA',
        icao: 'TAS',
        name: 'Test Airways',
        country: 'United Kingdom',
        hub: 'EGLL',
      },
      {
        iata: 'TB',
        icao: 'TBS',
        name: 'Test Budget Air',
        country: 'Ireland',
        hub: 'EIDW',
      },
    ];

    for (const airline of airlines) {
      const query = `
        INSERT INTO airlines (
          iata_code, icao_code, name, country, hub_airport,
          website_url, scrape_enabled, scrape_source_urls
        )
        VALUES ($1, $2, $3, $4, $5, $6, true, $7)
        ON CONFLICT (iata_code) DO UPDATE
        SET name = EXCLUDED.name,
            country = EXCLUDED.country,
            hub_airport = EXCLUDED.hub_airport
        RETURNING id
      `;

      await queryPostgres(query, [
        airline.iata,
        airline.icao,
        airline.name,
        airline.country,
        airline.hub,
        `https://test-${airline.iata.toLowerCase()}.airline`,
        JSON.stringify({ urls: [`https://test.com/${airline.iata}`] }),
      ]);

      logger.info(`Created test airline: ${airline.iata} - ${airline.name}`);
    }
  }

  /**
   * Generate test aircraft
   */
  private async generateTestAircraft(): Promise<void> {
    logger.info('Generating test aircraft...');

    // Get test airline IDs
    const airlinesQuery = `SELECT id, iata_code FROM airlines WHERE iata_code LIKE 'T%'`;
    const airlines = await queryPostgres(airlinesQuery);

    // Get aircraft types
    const typesQuery = `SELECT id, iata_code, manufacturer, model FROM aircraft_types LIMIT 10`;
    const types = await queryPostgres(typesQuery);

    if (airlines.rows.length === 0 || types.rows.length === 0) {
      logger.warn('No airlines or aircraft types found for test data generation');
      return;
    }

    const registrationPrefixes = ['N', 'G-', 'EI-'];
    const statuses = ['Active', 'Active', 'Active', 'Stored', 'Maintenance'];
    let count = 0;

    for (const airline of airlines.rows) {
      const aircraftCount = Math.floor(Math.random() * 15) + 10; // 10-25 aircraft

      for (let i = 0; i < aircraftCount; i++) {
        const type = types.rows[Math.floor(Math.random() * types.rows.length)];
        const prefix =
          registrationPrefixes[
            Math.floor(Math.random() * registrationPrefixes.length)
          ];
        const registration = this.generateRegistration(prefix);
        const status = statuses[Math.floor(Math.random() * statuses.length)];

        const query = `
          INSERT INTO aircraft (
            airline_id,
            aircraft_type_id,
            registration,
            msn,
            seat_configuration,
            delivery_date,
            status,
            current_location,
            home_base,
            data_confidence,
            data_sources,
            last_scraped_at
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())
          ON CONFLICT (registration) DO NOTHING
        `;

        const deliveryDate = this.generateDeliveryDate();
        const seatConfig = this.generateSeatConfiguration(type.model);

        await queryPostgres(query, [
          airline.id,
          type.id,
          registration,
          this.generateMSN(),
          JSON.stringify(seatConfig),
          deliveryDate,
          status,
          this.generateLocation(),
          this.generateHomeBase(),
          Math.random() * 0.3 + 0.7, // 0.7-1.0
          JSON.stringify(['test-source']),
        ]);

        count++;
      }

      logger.info(
        `Created ${aircraftCount} test aircraft for ${airline.iata_code}`
      );
    }

    logger.info(`Generated ${count} test aircraft total`);
  }

  /**
   * Generate test scraping jobs
   */
  private async generateTestJobs(): Promise<void> {
    logger.info('Generating test scraping jobs...');

    const airlinesQuery = `SELECT id, iata_code FROM airlines WHERE iata_code LIKE 'T%'`;
    const airlines = await queryPostgres(airlinesQuery);

    if (airlines.rows.length === 0) {
      return;
    }

    const statuses = ['pending', 'running', 'completed', 'failed'];
    const priorities = ['low', 'normal', 'high'];

    for (const airline of airlines.rows) {
      // Create 2-4 jobs per airline
      const jobCount = Math.floor(Math.random() * 3) + 2;

      for (let i = 0; i < jobCount; i++) {
        const status = statuses[Math.floor(Math.random() * statuses.length)];
        const priority = priorities[Math.floor(Math.random() * priorities.length)];

        const query = `
          INSERT INTO scraping_jobs (
            airline_id,
            job_type,
            status,
            priority,
            started_at,
            completed_at,
            duration_seconds,
            aircraft_found,
            aircraft_added,
            aircraft_updated,
            errors_count,
            metadata
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        `;

        const startedAt =
          status !== 'pending'
            ? new Date(Date.now() - Math.random() * 86400000 * 7)
            : null;
        const completedAt =
          status === 'completed' || status === 'failed' ? new Date() : null;
        const duration =
          completedAt && startedAt
            ? Math.floor((completedAt.getTime() - startedAt.getTime()) / 1000)
            : null;

        await queryPostgres(query, [
          airline.id,
          'full_fleet_update',
          status,
          priority,
          startedAt,
          completedAt,
          duration,
          Math.floor(Math.random() * 50) + 10,
          Math.floor(Math.random() * 5),
          Math.floor(Math.random() * 10) + 5,
          Math.floor(Math.random() * 3),
          JSON.stringify({
            test_data: true,
            max_retries: 3,
            retry_count: 0,
          }),
        ]);
      }

      logger.info(`Created ${jobCount} test jobs for ${airline.iata_code}`);
    }
  }

  /**
   * Generate registration number
   */
  private generateRegistration(prefix: string): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const nums = '0123456789';

    if (prefix.startsWith('N')) {
      // US format: N + 1-5 digits + 0-2 letters
      const digits = Math.floor(Math.random() * 4) + 2; // 2-5 digits
      let reg = prefix;
      for (let i = 0; i < digits; i++) {
        reg += nums[Math.floor(Math.random() * nums.length)];
      }
      if (Math.random() > 0.5) {
        reg += chars[Math.floor(Math.random() * chars.length)];
      }
      return reg;
    } else {
      // European format: XX-XXX
      let reg = prefix;
      for (let i = 0; i < 3; i++) {
        reg += chars[Math.floor(Math.random() * chars.length)];
      }
      return reg;
    }
  }

  /**
   * Generate MSN (Manufacturer Serial Number)
   */
  private generateMSN(): string {
    return String(Math.floor(Math.random() * 90000) + 10000);
  }

  /**
   * Generate seat configuration
   */
  private generateSeatConfiguration(model: string): any {
    const configs: Record<string, any> = {
      '737': { first: 12, economy: 138, total: 150 },
      'A320': { business: 12, economy: 138, total: 150 },
      '777': { first: 8, business: 52, premium_economy: 24, economy: 216, total: 300 },
      'A350': { business: 48, premium_economy: 21, economy: 224, total: 293 },
      'A380': { first: 14, business: 76, premium_economy: 44, economy: 371, total: 505 },
    };

    // Find matching config
    for (const [key, config] of Object.entries(configs)) {
      if (model.includes(key)) {
        return config;
      }
    }

    // Default
    return { economy: 150, total: 150 };
  }

  /**
   * Generate delivery date
   */
  private generateDeliveryDate(): string {
    const start = new Date(2010, 0, 1);
    const end = new Date();
    const date = new Date(
      start.getTime() + Math.random() * (end.getTime() - start.getTime())
    );
    return date.toISOString().split('T')[0];
  }

  /**
   * Generate location
   */
  private generateLocation(): string {
    const locations = ['KJFK', 'KLAX', 'KORD', 'KDFW', 'KATL', 'KSFO', 'KDEN'];
    return locations[Math.floor(Math.random() * locations.length)];
  }

  /**
   * Generate home base
   */
  private generateHomeBase(): string {
    const bases = ['KJFK', 'KLAX', 'KORD', 'KDFW', 'KATL'];
    return bases[Math.floor(Math.random() * bases.length)];
  }

  /**
   * Get test data statistics
   */
  async getStatistics(): Promise<void> {
    console.log('\n╔═══════════════════════════════════════════════════════════════════╗');
    console.log('║                     Test Data Statistics                          ║');
    console.log('╚═══════════════════════════════════════════════════════════════════╝\n');

    // Airlines
    const airlinesQuery = `
      SELECT COUNT(*) as count
      FROM airlines
      WHERE iata_code LIKE 'T%'
    `;
    const airlines = await queryPostgres(airlinesQuery);
    console.log(`  Test Airlines:     ${airlines.rows[0].count}`);

    // Aircraft
    const aircraftQuery = `
      SELECT COUNT(*) as count
      FROM aircraft
      WHERE airline_id IN (SELECT id FROM airlines WHERE iata_code LIKE 'T%')
    `;
    const aircraft = await queryPostgres(aircraftQuery);
    console.log(`  Test Aircraft:     ${aircraft.rows[0].count}`);

    // Jobs
    const jobsQuery = `
      SELECT COUNT(*) as count
      FROM scraping_jobs
      WHERE airline_id IN (SELECT id FROM airlines WHERE iata_code LIKE 'T%')
    `;
    const jobs = await queryPostgres(jobsQuery);
    console.log(`  Test Jobs:         ${jobs.rows[0].count}`);

    console.log('\n═══════════════════════════════════════════════════════════════════\n');
  }
}

// CLI support
if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  const clean = args.includes('--clean');
  const stats = args.includes('--stats');

  const generator = new TestDataGenerator();

  if (stats) {
    generator
      .getStatistics()
      .then(() => process.exit(0))
      .catch((error) => {
        console.error('Failed to get statistics:', error);
        process.exit(1);
      });
  } else {
    generator
      .generateTestData({ clean })
      .then(() => {
        console.log('\n✅ Test data generated successfully\n');
        return generator.getStatistics();
      })
      .then(() => process.exit(0))
      .catch((error) => {
        console.error('Failed to generate test data:', error);
        process.exit(1);
      });
  }
}

/**
 * Seed Top 100 Airlines Script
 *
 * Loads the top 100 airlines worldwide into the database:
 * - Reads from data/top-100-airlines.json
 * - Validates data before insertion
 * - Handles existing records (upsert)
 * - Configures scraping schedules
 * - Outputs summary statistics
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { createLogger } from '../src/lib/logger.js';
import { queryPostgres } from '../src/lib/db-clients.js';

const logger = createLogger('seed-airlines');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface AirlineData {
  rank: number;
  iata: string;
  icao: string;
  name: string;
  country: string;
  hub: string;
  fleet_size: number;
  website: string;
  scrape_urls: string[];
  priority: 'high' | 'normal' | 'low';
  schedule: string;
}

interface SeedResult {
  total: number;
  inserted: number;
  updated: number;
  skipped: number;
  errors: number;
  byPriority: {
    high: number;
    normal: number;
    low: number;
  };
  byCountry: Record<string, number>;
}

class AirlineSeeder {
  private result: SeedResult = {
    total: 0,
    inserted: 0,
    updated: 0,
    skipped: 0,
    errors: 0,
    byPriority: { high: 0, normal: 0, low: 0 },
    byCountry: {},
  };

  /**
   * Run the seeding process
   */
  async seed(options?: { clean?: boolean; dryRun?: boolean }): Promise<void> {
    console.log('\n╔═══════════════════════════════════════════════════════════════════╗');
    console.log('║            Top 100 Airlines - Database Seeding                    ║');
    console.log('╚═══════════════════════════════════════════════════════════════════╝\n');

    if (options?.dryRun) {
      console.log('⚠️  DRY RUN MODE - No changes will be made\n');
    }

    if (options?.clean) {
      await this.cleanExistingData(options.dryRun);
    }

    // Load airline data
    const airlines = await this.loadAirlineData();
    logger.info(`Loaded ${airlines.length} airlines from data file`);

    // Validate all data first
    console.log('🔍 Validating airline data...\n');
    const validAirlines = this.validateAllData(airlines);
    console.log(`✓ Validated ${validAirlines.length} airlines\n`);

    // Seed airlines
    console.log('💾 Seeding airlines...\n');
    for (const airline of validAirlines) {
      await this.seedAirline(airline, options?.dryRun);
    }

    // Print summary
    this.printSummary();
  }

  /**
   * Clean existing airline data
   */
  private async cleanExistingData(dryRun?: boolean): Promise<void> {
    console.log('🧹 Cleaning existing airline data...\n');

    if (dryRun) {
      console.log('  [DRY RUN] Would delete all airlines and related data\n');
      return;
    }

    try {
      // Delete in correct order due to foreign keys
      await queryPostgres('DELETE FROM scraping_jobs');
      await queryPostgres('DELETE FROM fleet_changes');
      await queryPostgres('DELETE FROM aircraft');
      await queryPostgres('DELETE FROM airlines');

      console.log('  ✓ Deleted all existing airline data\n');
    } catch (error) {
      logger.error('Failed to clean existing data:', error);
      throw error;
    }
  }

  /**
   * Load airline data from JSON file
   */
  private async loadAirlineData(): Promise<AirlineData[]> {
    const dataPath = path.join(__dirname, '../data/top-100-airlines.json');

    if (!fs.existsSync(dataPath)) {
      throw new Error(`Data file not found: ${dataPath}`);
    }

    const data = fs.readFileSync(dataPath, 'utf-8');
    return JSON.parse(data);
  }

  /**
   * Validate all airline data
   */
  private validateAllData(airlines: AirlineData[]): AirlineData[] {
    const valid: AirlineData[] = [];
    const seen = new Set<string>();

    for (const airline of airlines) {
      try {
        this.validateAirline(airline);

        // Check for duplicates
        if (seen.has(airline.iata)) {
          logger.warn(`Duplicate IATA code found: ${airline.iata}, skipping`);
          continue;
        }
        seen.add(airline.iata);

        valid.push(airline);
      } catch (error) {
        logger.error(
          `Validation failed for ${airline.name}:`,
          error instanceof Error ? error.message : error
        );
        this.result.errors++;
      }
    }

    return valid;
  }

  /**
   * Validate individual airline data
   */
  private validateAirline(airline: AirlineData): void {
    // Required fields
    if (!airline.iata || airline.iata.length < 2 || airline.iata.length > 3) {
      throw new Error('Invalid IATA code');
    }

    if (!airline.icao || airline.icao.length !== 3) {
      throw new Error('Invalid ICAO code');
    }

    if (!airline.name || airline.name.length < 2) {
      throw new Error('Invalid airline name');
    }

    if (!airline.country) {
      throw new Error('Missing country');
    }

    if (!airline.website || !airline.website.startsWith('http')) {
      throw new Error('Invalid website URL');
    }

    // Validate priority
    if (!['high', 'normal', 'low'].includes(airline.priority)) {
      throw new Error('Invalid priority');
    }

    // Validate cron expression (basic check)
    if (!airline.schedule || airline.schedule.split(' ').length !== 5) {
      throw new Error('Invalid cron schedule');
    }

    // Validate fleet size
    if (typeof airline.fleet_size !== 'number' || airline.fleet_size < 0) {
      throw new Error('Invalid fleet size');
    }
  }

  /**
   * Seed a single airline
   */
  private async seedAirline(
    airline: AirlineData,
    dryRun?: boolean
  ): Promise<void> {
    this.result.total++;

    try {
      if (dryRun) {
        console.log(
          `  [DRY RUN] Would seed: ${airline.iata} - ${airline.name} (${airline.country})`
        );
        this.result.inserted++;
        this.updateStatistics(airline);
        return;
      }

      // Check if airline exists
      const existsQuery = `
        SELECT id FROM airlines WHERE iata_code = $1 OR icao_code = $2 LIMIT 1
      `;
      const existsResult = await queryPostgres(existsQuery, [
        airline.iata,
        airline.icao,
      ]);

      const exists = existsResult.rows.length > 0;

      if (exists) {
        // Update existing airline
        await this.updateAirline(airline);
        this.result.updated++;
        console.log(
          `  ✓ Updated: ${airline.iata} - ${airline.name} (${airline.country})`
        );
      } else {
        // Insert new airline
        await this.insertAirline(airline);
        this.result.inserted++;
        console.log(
          `  ✓ Inserted: ${airline.iata} - ${airline.name} (${airline.country})`
        );
      }

      this.updateStatistics(airline);
    } catch (error) {
      logger.error(
        `Failed to seed ${airline.name}:`,
        error instanceof Error ? error.message : error
      );
      this.result.errors++;
      console.log(`  ✗ Error: ${airline.iata} - ${airline.name}`);
    }
  }

  /**
   * Insert new airline
   */
  private async insertAirline(airline: AirlineData): Promise<void> {
    const query = `
      INSERT INTO airlines (
        iata_code,
        icao_code,
        name,
        country,
        hub_airport,
        website_url,
        scrape_enabled,
        scrape_source_urls,
        scrape_schedule_cron,
        fleet_size_estimate
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    `;

    const scrapeUrls = {
      urls: airline.scrape_urls || [],
      priority: airline.priority,
    };

    await queryPostgres(query, [
      airline.iata,
      airline.icao,
      airline.name,
      airline.country,
      airline.hub || null,
      airline.website,
      true, // scrape_enabled
      JSON.stringify(scrapeUrls),
      airline.schedule,
      airline.fleet_size,
    ]);
  }

  /**
   * Update existing airline
   */
  private async updateAirline(airline: AirlineData): Promise<void> {
    const query = `
      UPDATE airlines
      SET
        name = $3,
        country = $4,
        hub_airport = $5,
        website_url = $6,
        scrape_enabled = $7,
        scrape_source_urls = $8,
        scrape_schedule_cron = $9,
        fleet_size_estimate = $10,
        updated_at = NOW()
      WHERE iata_code = $1 OR icao_code = $2
    `;

    const scrapeUrls = {
      urls: airline.scrape_urls || [],
      priority: airline.priority,
    };

    await queryPostgres(query, [
      airline.iata,
      airline.icao,
      airline.name,
      airline.country,
      airline.hub || null,
      airline.website,
      true, // scrape_enabled
      JSON.stringify(scrapeUrls),
      airline.schedule,
      airline.fleet_size,
    ]);
  }

  /**
   * Update statistics
   */
  private updateStatistics(airline: AirlineData): void {
    // By priority
    this.result.byPriority[airline.priority]++;

    // By country
    if (!this.result.byCountry[airline.country]) {
      this.result.byCountry[airline.country] = 0;
    }
    this.result.byCountry[airline.country]++;
  }

  /**
   * Print summary statistics
   */
  private printSummary(): void {
    console.log('\n═══════════════════════════════════════════════════════════════════');
    console.log('  SEEDING SUMMARY');
    console.log('═══════════════════════════════════════════════════════════════════\n');

    console.log(`  Total Airlines:     ${this.result.total}`);
    console.log(`  Inserted:           ${this.result.inserted} ✓`);
    console.log(`  Updated:            ${this.result.updated} ↻`);
    console.log(`  Errors:             ${this.result.errors} ✗\n`);

    console.log('  By Priority:');
    console.log(`    High:             ${this.result.byPriority.high}`);
    console.log(`    Normal:           ${this.result.byPriority.normal}`);
    console.log(`    Low:              ${this.result.byPriority.low}\n`);

    console.log('  Top 10 Countries:');
    const sortedCountries = Object.entries(this.result.byCountry)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);

    for (const [country, count] of sortedCountries) {
      console.log(`    ${country.padEnd(25)} ${count}`);
    }

    console.log('\n═══════════════════════════════════════════════════════════════════\n');

    if (this.result.errors === 0) {
      console.log('✅ All airlines seeded successfully!\n');
    } else {
      console.log(
        `⚠️  Seeding completed with ${this.result.errors} error(s)\n`
      );
    }
  }

  /**
   * Get seeding statistics
   */
  async getStatistics(): Promise<void> {
    console.log('\n╔═══════════════════════════════════════════════════════════════════╗');
    console.log('║                    Database Statistics                            ║');
    console.log('╚═══════════════════════════════════════════════════════════════════╝\n');

    // Total airlines
    const totalQuery = `SELECT COUNT(*) as count FROM airlines`;
    const totalResult = await queryPostgres(totalQuery);
    console.log(`  Total Airlines:     ${totalResult.rows[0].count}`);

    // By scraping status
    const scrapeQuery = `
      SELECT
        COUNT(*) FILTER (WHERE scrape_enabled = true) as enabled,
        COUNT(*) FILTER (WHERE scrape_enabled = false) as disabled,
        COUNT(*) FILTER (WHERE last_scraped_at IS NOT NULL) as scraped,
        COUNT(*) FILTER (WHERE last_scraped_at IS NULL) as never_scraped
      FROM airlines
    `;
    const scrapeResult = await queryPostgres(scrapeQuery);
    const scrape = scrapeResult.rows[0];

    console.log(`  Scrape Enabled:     ${scrape.enabled}`);
    console.log(`  Scrape Disabled:    ${scrape.disabled}`);
    console.log(`  Scraped:            ${scrape.scraped}`);
    console.log(`  Never Scraped:      ${scrape.never_scraped}\n`);

    // By country
    const countryQuery = `
      SELECT country, COUNT(*) as count
      FROM airlines
      GROUP BY country
      ORDER BY count DESC
      LIMIT 10
    `;
    const countryResult = await queryPostgres(countryQuery);

    console.log('  Top 10 Countries:');
    for (const row of countryResult.rows) {
      console.log(`    ${row.country.padEnd(25)} ${row.count}`);
    }

    console.log('\n═══════════════════════════════════════════════════════════════════\n');
  }
}

// CLI support
if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  const clean = args.includes('--clean');
  const dryRun = args.includes('--dry-run');
  const stats = args.includes('--stats');

  const seeder = new AirlineSeeder();

  if (stats) {
    // Just show statistics
    seeder
      .getStatistics()
      .then(() => process.exit(0))
      .catch((error) => {
        console.error('Failed to get statistics:', error);
        process.exit(1);
      });
  } else {
    // Run seeding
    seeder
      .seed({ clean, dryRun })
      .then(() => {
        if (!dryRun) {
          console.log('📊 Getting database statistics...\n');
          return seeder.getStatistics();
        }
      })
      .then(() => process.exit(0))
      .catch((error) => {
        console.error('Seeding failed:', error);
        process.exit(1);
      });
  }
}

/**
 * Schedule Top 100 Airlines Script
 *
 * Initializes scraping jobs for the top 100 airlines by passenger traffic.
 * Sets up priorities and schedules based on airline size and importance.
 *
 * Usage:
 *   npm run scraper:setup
 *   npm run scraper:setup -- --dry-run
 *   npm run scraper:setup -- --force
 */

import { createLogger } from '../src/lib/logger.js';
import { queryPostgres } from '../src/lib/db-clients.js';
import { getJobQueue, type JobPriority } from '../src/scrapers/workflows/job-queue.js';

const logger = createLogger('setup-scheduler');

interface AirlineSetup {
  iata_code: string;
  name: string;
  priority: JobPriority;
  scheduledDelay: number; // minutes from now
  maxRetries: number;
  retryDelayMinutes: number;
}

/**
 * Top 100 airlines with their priorities
 * High priority: Major global carriers (top 30)
 * Normal priority: Regional and mid-size carriers (31-70)
 * Low priority: Smaller carriers (71-100)
 */
const TOP_100_AIRLINES = [
  // Top 30 - High Priority (Major Global Carriers)
  { code: 'AA', priority: 'high' as JobPriority },
  { code: 'DL', priority: 'high' as JobPriority },
  { code: 'UA', priority: 'high' as JobPriority },
  { code: 'WN', priority: 'high' as JobPriority },
  { code: 'BA', priority: 'high' as JobPriority },
  { code: 'LH', priority: 'high' as JobPriority },
  { code: 'AF', priority: 'high' as JobPriority },
  { code: 'KL', priority: 'high' as JobPriority },
  { code: 'EK', priority: 'high' as JobPriority },
  { code: 'QR', priority: 'high' as JobPriority },
  { code: 'SQ', priority: 'high' as JobPriority },
  { code: 'CZ', priority: 'high' as JobPriority },
  { code: 'CA', priority: 'high' as JobPriority },
  { code: 'MU', priority: 'high' as JobPriority },
  { code: 'NH', priority: 'high' as JobPriority },
  { code: 'JL', priority: 'high' as JobPriority },
  { code: 'QF', priority: 'high' as JobPriority },
  { code: 'AC', priority: 'high' as JobPriority },
  { code: 'TK', priority: 'high' as JobPriority },
  { code: 'AY', priority: 'high' as JobPriority },
  { code: 'IB', priority: 'high' as JobPriority },
  { code: 'AZ', priority: 'high' as JobPriority },
  { code: 'SU', priority: 'high' as JobPriority },
  { code: 'EY', priority: 'high' as JobPriority },
  { code: 'VS', priority: 'high' as JobPriority },
  { code: 'AS', priority: 'high' as JobPriority },
  { code: 'B6', priority: 'high' as JobPriority },
  { code: 'NK', priority: 'high' as JobPriority },
  { code: 'F9', priority: 'high' as JobPriority },
  { code: 'G4', priority: 'high' as JobPriority },

  // 31-70 - Normal Priority (Regional & Mid-Size Carriers)
  { code: 'LA', priority: 'normal' as JobPriority },
  { code: 'AM', priority: 'normal' as JobPriority },
  { code: 'CM', priority: 'normal' as JobPriority },
  { code: 'AR', priority: 'normal' as JobPriority },
  { code: 'AV', priority: 'normal' as JobPriority },
  { code: 'OS', priority: 'normal' as JobPriority },
  { code: 'SN', priority: 'normal' as JobPriority },
  { code: 'LX', priority: 'normal' as JobPriority },
  { code: 'SK', priority: 'normal' as JobPriority },
  { code: 'LO', priority: 'normal' as JobPriority },
  { code: 'OK', priority: 'normal' as JobPriority },
  { code: 'TP', priority: 'normal' as JobPriority },
  { code: 'UX', priority: 'normal' as JobPriority },
  { code: 'FR', priority: 'normal' as JobPriority },
  { code: 'U2', priority: 'normal' as JobPriority },
  { code: 'W6', priority: 'normal' as JobPriority },
  { code: 'VY', priority: 'normal' as JobPriority },
  { code: 'TP', priority: 'normal' as JobPriority },
  { code: 'EI', priority: 'normal' as JobPriority },
  { code: 'WS', priority: 'normal' as JobPriority },
  { code: 'TS', priority: 'normal' as JobPriority },
  { code: 'PD', priority: 'normal' as JobPriority },
  { code: 'AK', priority: 'normal' as JobPriority },
  { code: 'TR', priority: 'normal' as JobPriority },
  { code: 'GA', priority: 'normal' as JobPriority },
  { code: 'TG', priority: 'normal' as JobPriority },
  { code: 'VN', priority: 'normal' as JobPriority },
  { code: 'MH', priority: 'normal' as JobPriority },
  { code: 'PR', priority: 'normal' as JobPriority },
  { code: 'CI', priority: 'normal' as JobPriority },
  { code: 'BR', priority: 'normal' as JobPriority },
  { code: 'OZ', priority: 'normal' as JobPriority },
  { code: 'KE', priority: 'normal' as JobPriority },
  { code: 'HA', priority: 'normal' as JobPriority },
  { code: 'VA', priority: 'normal' as JobPriority },
  { code: 'JQ', priority: 'normal' as JobPriority },
  { code: 'NZ', priority: 'normal' as JobPriority },
  { code: 'SA', priority: 'normal' as JobPriority },
  { code: 'ET', priority: 'normal' as JobPriority },
  { code: 'MS', priority: 'normal' as JobPriority },

  // 71-100 - Low Priority (Smaller Carriers)
  { code: 'AT', priority: 'low' as JobPriority },
  { code: 'RO', priority: 'low' as JobPriority },
  { code: 'FB', priority: 'low' as JobPriority },
  { code: 'PC', priority: 'low' as JobPriority },
  { code: 'TU', priority: 'low' as JobPriority },
  { code: 'RJ', priority: 'low' as JobPriority },
  { code: 'GF', priority: 'low' as JobPriority },
  { code: 'WY', priority: 'low' as JobPriority },
  { code: 'SV', priority: 'low' as JobPriority },
  { code: 'FZ', priority: 'low' as JobPriority },
  { code: '6E', priority: 'low' as JobPriority },
  { code: 'AI', priority: 'low' as JobPriority },
  { code: 'SG', priority: 'low' as JobPriority },
  { code: 'UK', priority: 'low' as JobPriority },
  { code: 'QZ', priority: 'low' as JobPriority },
  { code: 'FD', priority: 'low' as JobPriority },
  { code: 'BI', priority: 'low' as JobPriority },
  { code: 'DD', priority: 'low' as JobPriority },
  { code: 'SL', priority: 'low' as JobPriority },
  { code: 'UL', priority: 'low' as JobPriority },
  { code: 'BG', priority: 'low' as JobPriority },
  { code: 'KC', priority: 'low' as JobPriority },
  { code: 'HU', priority: 'low' as JobPriority },
  { code: 'SC', priority: 'low' as JobPriority },
  { code: 'FM', priority: 'low' as JobPriority },
  { code: 'ZH', priority: 'low' as JobPriority },
  { code: 'MF', priority: 'low' as JobPriority },
  { code: '3U', priority: 'low' as JobPriority },
  { code: 'GS', priority: 'low' as JobPriority },
  { code: 'HO', priority: 'low' as JobPriority },
];

export class AirlineSchedulerSetup {
  private jobQueue = getJobQueue();

  /**
   * Set up scraping jobs for top 100 airlines
   */
  async setup(options?: { dryRun?: boolean; force?: boolean }): Promise<void> {
    logger.info('Setting up scraping jobs for top 100 airlines', options);

    let created = 0;
    let skipped = 0;
    let failed = 0;

    for (let i = 0; i < TOP_100_AIRLINES.length; i++) {
      const airline = TOP_100_AIRLINES[i];

      try {
        // Check if airline exists in database
        const airlineData = await this.getAirlineInfo(airline.code);

        if (!airlineData) {
          logger.warn(`Airline not found in database: ${airline.code}`);
          skipped++;
          continue;
        }

        // Check if job already exists (unless force)
        if (!options?.force) {
          const existingJob = await this.hasRecentJob(airline.code);
          if (existingJob) {
            logger.debug(`Job already exists for ${airline.code}, skipping`);
            skipped++;
            continue;
          }
        }

        // Calculate scheduled delay (spread out jobs over time)
        const scheduledDelay = this.calculateScheduledDelay(i, airline.priority);

        const setup: AirlineSetup = {
          iata_code: airline.code,
          name: airlineData.name,
          priority: airline.priority,
          scheduledDelay,
          maxRetries: airline.priority === 'high' ? 5 : 3,
          retryDelayMinutes: 30,
        };

        if (options?.dryRun) {
          logger.info(
            `[DRY RUN] Would create job for ${setup.iata_code} (${setup.name}) - Priority: ${setup.priority}, Delay: ${setup.scheduledDelay}min`
          );
          created++;
        } else {
          const jobId = await this.createJob(setup);
          logger.info(
            `Created job ${jobId} for ${setup.iata_code} (${setup.name}) - Priority: ${setup.priority}, Scheduled in ${setup.scheduledDelay}min`
          );
          created++;
        }

        // Small delay between creations
        await this.sleep(100);
      } catch (error) {
        logger.error(`Failed to create job for ${airline.code}:`, error);
        failed++;
      }
    }

    logger.info(
      `Setup complete: ${created} jobs created, ${skipped} skipped, ${failed} failed`
    );
  }

  /**
   * Get airline information from database
   */
  private async getAirlineInfo(
    airlineCode: string
  ): Promise<{ id: number; name: string } | null> {
    const query = `
      SELECT id, name
      FROM airlines
      WHERE UPPER(iata_code) = UPPER($1) OR UPPER(icao_code) = UPPER($1)
      LIMIT 1
    `;

    const result = await queryPostgres(query, [airlineCode]);
    return result.rows[0] || null;
  }

  /**
   * Check if airline has a recent job
   */
  private async hasRecentJob(airlineCode: string): Promise<boolean> {
    const query = `
      SELECT id
      FROM scraping_jobs sj
      JOIN airlines al ON sj.airline_id = al.id
      WHERE (UPPER(al.iata_code) = UPPER($1) OR UPPER(al.icao_code) = UPPER($1))
        AND sj.status IN ('pending', 'running')
      LIMIT 1
    `;

    const result = await queryPostgres(query, [airlineCode]);
    return result.rows.length > 0;
  }

  /**
   * Calculate scheduled delay for job
   * Spreads jobs over time to avoid overload
   */
  private calculateScheduledDelay(
    index: number,
    priority: JobPriority
  ): number {
    // High priority: start immediately or within 1 hour
    // Normal priority: spread over 2-6 hours
    // Low priority: spread over 6-12 hours

    let baseDelay: number;
    let spread: number;

    switch (priority) {
      case 'high':
        baseDelay = 0;
        spread = 60; // 1 hour
        break;
      case 'normal':
        baseDelay = 120;
        spread = 240; // 4 hours
        break;
      case 'low':
        baseDelay = 360;
        spread = 360; // 6 hours
        break;
    }

    // Calculate delay based on index within priority group
    const delay = baseDelay + (index * spread) / TOP_100_AIRLINES.length;
    return Math.floor(delay);
  }

  /**
   * Create a scraping job
   */
  private async createJob(setup: AirlineSetup): Promise<string> {
    const scheduledAt = new Date(Date.now() + setup.scheduledDelay * 60 * 1000);

    return await this.jobQueue.createJob(setup.iata_code, {
      jobType: 'full_fleet_update',
      priority: setup.priority,
      maxRetries: setup.maxRetries,
      retryDelayMinutes: setup.retryDelayMinutes,
      scheduledAt,
      metadata: {
        initial_setup: true,
        airline_name: setup.name,
      },
    });
  }

  /**
   * Sleep helper
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Update airline scrape settings
   */
  async updateAirlineSettings(
    airlineCode: string,
    settings: {
      scrapeEnabled?: boolean;
      scrapeScheduleCron?: string;
    }
  ): Promise<void> {
    const updates: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (settings.scrapeEnabled !== undefined) {
      updates.push(`scrape_enabled = $${paramIndex++}`);
      params.push(settings.scrapeEnabled);
    }

    if (settings.scrapeScheduleCron) {
      updates.push(`scrape_schedule_cron = $${paramIndex++}`);
      params.push(settings.scrapeScheduleCron);
    }

    if (updates.length === 0) {
      return;
    }

    params.push(airlineCode);

    const query = `
      UPDATE airlines
      SET ${updates.join(', ')}
      WHERE UPPER(iata_code) = UPPER($${paramIndex}) OR UPPER(icao_code) = UPPER($${paramIndex})
    `;

    await queryPostgres(query, params);
    logger.info(`Updated settings for ${airlineCode}`);
  }
}

// CLI support
if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const force = args.includes('--force');

  logger.info('Aircraft Database Scraper - Setup Script');
  logger.info(`Mode: ${dryRun ? 'DRY RUN' : 'LIVE'}`);
  logger.info(`Force: ${force ? 'YES' : 'NO'}\n`);

  const setup = new AirlineSchedulerSetup();

  setup
    .setup({ dryRun, force })
    .then(() => {
      logger.info('\n✅ Setup completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      logger.error('Setup failed:', error);
      process.exit(1);
    });
}

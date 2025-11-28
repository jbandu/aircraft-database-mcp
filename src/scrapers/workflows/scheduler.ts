/**
 * Scraping Scheduler
 *
 * Manages scheduled and on-demand scraping jobs for airlines.
 * - Polls job queue for pending jobs
 * - Executes jobs using workflow orchestrator
 * - Handles concurrent execution with limits
 * - Monitors queue status and performance
 * - Graceful shutdown handling
 */

import cron from 'node-cron';
import { createLogger } from '../../lib/logger.js';
import { getJobQueue, type ScrapeJob } from './job-queue.js';
import { AirlineScraperWorkflow } from './airline-scraper-workflow.js';

const logger = createLogger('scheduler');

export interface SchedulerConfig {
  /** Maximum number of concurrent jobs */
  maxConcurrentJobs: number;
  /** Poll interval in milliseconds when queue is empty */
  pollInterval: number;
  /** Enable cron-based automatic scheduling */
  cronEnabled: boolean;
  /** Cron expression for automatic job creation (default: daily at 2 AM) */
  cronExpression: string;
  /** Concurrency limit per workflow */
  workflowConcurrency: number;
}

export class ScraperScheduler {
  private jobQueue = getJobQueue();
  private config: SchedulerConfig;
  private isRunning = false;
  private activeJobs = new Map<string, Promise<void>>();
  private cronTask: cron.ScheduledTask | null = null;
  private pollTimer: NodeJS.Timeout | null = null;
  private shutdownRequested = false;

  constructor(config?: Partial<SchedulerConfig>) {
    this.config = {
      maxConcurrentJobs: parseInt(
        process.env['SCRAPER_CONCURRENT_LIMIT'] || '3',
        10
      ),
      pollInterval: parseInt(process.env['SCRAPER_POLL_INTERVAL_MS'] || '5000', 10),
      cronEnabled:
        process.env['SCRAPER_SCHEDULE_ENABLED'] === 'true' ||
        process.env['SCRAPER_SCHEDULE_ENABLED'] === '1',
      cronExpression:
        process.env['SCRAPER_SCHEDULE_CRON'] || '0 2 * * *', // Daily at 2 AM
      workflowConcurrency: parseInt(
        process.env['SCRAPER_WORKFLOW_CONCURRENCY'] || '5',
        10
      ),
      ...config,
    };
  }

  /**
   * Start the scheduler
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      logger.warn('Scheduler is already running');
      return;
    }

    this.isRunning = true;
    this.shutdownRequested = false;
    logger.info('Starting scraper scheduler', this.config);

    // Set up graceful shutdown
    this.setupShutdownHandlers();

    // Start cron-based scheduling if enabled
    if (this.config.cronEnabled) {
      this.startCronScheduling();
    }

    // Start polling for jobs
    await this.startJobPolling();
  }

  /**
   * Stop the scheduler gracefully
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    logger.info('Stopping scheduler...');
    this.shutdownRequested = true;
    this.isRunning = false;

    // Stop cron tasks
    if (this.cronTask) {
      this.cronTask.stop();
      this.cronTask = null;
    }

    // Stop polling
    if (this.pollTimer) {
      clearTimeout(this.pollTimer);
      this.pollTimer = null;
    }

    // Wait for active jobs to complete
    if (this.activeJobs.size > 0) {
      logger.info(`Waiting for ${this.activeJobs.size} active jobs to complete...`);
      await Promise.allSettled(Array.from(this.activeJobs.values()));
    }

    logger.info('Scheduler stopped');
  }

  /**
   * Start cron-based automatic scheduling
   */
  private startCronScheduling(): void {
    logger.info(`Starting cron scheduling: ${this.config.cronExpression}`);

    this.cronTask = cron.schedule(
      this.config.cronExpression,
      async () => {
        logger.info('Cron trigger: Creating jobs for airlines needing updates');
        try {
          await this.createJobsForAirlinesNeedingUpdate();
        } catch (error) {
          logger.error('Failed to create cron jobs:', error);
        }
      },
      {
        timezone: process.env['SCRAPER_TIMEZONE'] || 'UTC',
      }
    );

    logger.info('Cron scheduling started');
  }

  /**
   * Start polling for pending jobs
   */
  private async startJobPolling(): Promise<void> {
    while (this.isRunning && !this.shutdownRequested) {
      try {
        // Check if we can accept more jobs
        if (this.activeJobs.size < this.config.maxConcurrentJobs) {
          const job = await this.jobQueue.getNextJob();

          if (job) {
            logger.info(
              `Found pending job: ${job.job_id} for ${job.airline_code} (${this.activeJobs.size + 1}/${this.config.maxConcurrentJobs})`
            );
            await this.executeJob(job);
          } else {
            // No jobs available, log queue stats
            await this.logQueueStats();
          }
        }

        // Wait before next poll
        await this.sleep(this.config.pollInterval);
      } catch (error) {
        logger.error('Error in job polling loop:', error);
        await this.sleep(this.config.pollInterval * 2); // Back off on error
      }
    }

    logger.info('Job polling stopped');
  }

  /**
   * Execute a job
   */
  private async executeJob(job: ScrapeJob): Promise<void> {
    const jobPromise = (async () => {
      try {
        // Mark job as running
        await this.jobQueue.startJob(job.job_id);

        // Create workflow with configured concurrency
        const workflow = new AirlineScraperWorkflow({
          concurrencyLimit: this.config.workflowConcurrency,
        });

        logger.info(`Executing job ${job.job_id} for ${job.airline_code}`);

        // Run the workflow
        const result = await workflow.runFullUpdate(job.airline_code);

        // Mark job as completed
        await this.jobQueue.completeJob(job.job_id, {
          job_id: job.job_id,
          success: result.errors === 0,
          aircraft_found: result.aircraft_found,
          aircraft_added: result.aircraft_added,
          aircraft_updated: result.aircraft_updated,
          errors_count: result.errors,
          duration_seconds: Math.floor(result.duration_ms / 1000),
        });

        logger.info(
          `Job ${job.job_id} completed successfully: ${result.aircraft_found} found, ${result.aircraft_added} added, ${result.aircraft_updated} updated`
        );
      } catch (error) {
        logger.error(`Job ${job.job_id} failed:`, error);

        // Mark job as failed (with retry if appropriate)
        const shouldRetry = this.shouldRetryJob(error);
        await this.jobQueue.failJob(
          job.job_id,
          error instanceof Error ? error : new Error(String(error)),
          shouldRetry
        );
      } finally {
        // Remove from active jobs
        this.activeJobs.delete(job.job_id);
      }
    })();

    // Track active job
    this.activeJobs.set(job.job_id, jobPromise);
  }

  /**
   * Determine if a job should be retried based on error
   */
  private shouldRetryJob(error: unknown): boolean {
    if (!(error instanceof Error)) {
      return true;
    }

    // Don't retry on validation errors or permanent failures
    const nonRetryableErrors = [
      'Airline not found',
      'Aircraft type not found',
      'Invalid registration',
    ];

    return !nonRetryableErrors.some((msg) =>
      error.message.includes(msg)
    );
  }

  /**
   * Create jobs for airlines that need updating
   */
  private async createJobsForAirlinesNeedingUpdate(): Promise<void> {
    const query = `
      SELECT
        iata_code,
        last_scraped_at,
        scrape_schedule_cron
      FROM airlines
      WHERE scrape_enabled = true
        AND (
          last_scraped_at IS NULL
          OR last_scraped_at < NOW() - INTERVAL '7 days'
        )
      ORDER BY
        CASE
          WHEN last_scraped_at IS NULL THEN 0
          ELSE 1
        END,
        last_scraped_at ASC NULLS FIRST
      LIMIT 100
    `;

    const { queryPostgres } = await import('../../lib/db-clients.js');
    const result = await queryPostgres(query);

    logger.info(`Found ${result.rows.length} airlines needing updates`);

    let created = 0;
    for (const row of result.rows) {
      try {
        // Check if job already exists
        const existingQuery = `
          SELECT id FROM scrape_jobs
          WHERE airline_id = (SELECT id FROM airlines WHERE iata_code = $1)
            AND status IN ('pending', 'running')
          LIMIT 1
        `;
        const existingResult = await queryPostgres(existingQuery, [row.iata_code]);

        if (existingResult.rows.length > 0) {
          logger.debug(`Job already exists for ${row.iata_code}, skipping`);
          continue;
        }

        // Create job
        const jobId = await this.jobQueue.createJob(row.iata_code, {
          jobType: 'full_fleet_update',
          priority: row.last_scraped_at ? 'normal' : 'high', // High priority for never-scraped
          maxRetries: 3,
          retryDelayMinutes: 30,
          scheduledAt: new Date(),
        });

        logger.info(`Created job ${jobId} for ${row.iata_code}`);
        created++;
      } catch (error) {
        logger.error(`Failed to create job for ${row.iata_code}:`, error);
      }
    }

    logger.info(`Created ${created} new jobs`);
  }

  /**
   * Log queue statistics
   */
  private async logQueueStats(): Promise<void> {
    try {
      const stats = await this.jobQueue.getQueueStats();
      logger.debug(
        `Queue stats: ${stats.pending} pending, ${stats.running} running, ${stats.completed} completed, ${stats.failed} failed (${stats.total} total)`
      );
    } catch (error) {
      logger.error('Failed to get queue stats:', error);
    }
  }

  /**
   * Set up graceful shutdown handlers
   */
  private setupShutdownHandlers(): void {
    const shutdown = async (signal: string) => {
      logger.info(`Received ${signal}, shutting down gracefully...`);
      await this.stop();
      process.exit(0);
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
  }

  /**
   * Sleep helper
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => {
      this.pollTimer = setTimeout(resolve, ms);
    });
  }

  /**
   * Get current status
   */
  getStatus(): {
    isRunning: boolean;
    activeJobs: number;
    config: SchedulerConfig;
  } {
    return {
      isRunning: this.isRunning,
      activeJobs: this.activeJobs.size,
      config: this.config,
    };
  }
}

// CLI support for running scheduler
if (import.meta.url === `file://${process.argv[1]}`) {
  logger.info('Starting Aircraft Database Scraper Scheduler');

  const scheduler = new ScraperScheduler();

  scheduler
    .start()
    .then(() => {
      logger.info('Scheduler started successfully');
      logger.info('Press Ctrl+C to stop');
    })
    .catch((error) => {
      logger.error('Failed to start scheduler:', error);
      process.exit(1);
    });
}

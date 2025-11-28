/**
 * Job Queue Management
 *
 * Database-backed job queue for scraping jobs
 * Uses PostgreSQL for state management (no Redis needed)
 */

import { queryPostgres } from '../../lib/db-clients.js';
import { createLogger } from '../../lib/logger.js';

const logger = createLogger('job-queue');

export type JobStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
export type JobPriority = 'low' | 'normal' | 'high';
export type JobType = 'full_fleet_update' | 'aircraft_details' | 'validation';

export interface ScrapeJob {
  id: number;
  job_id: string;
  airline_code: string;
  job_type: JobType;
  status: JobStatus;
  priority: JobPriority;
  max_retries: number;
  retry_count: number;
  retry_delay_minutes: number;
  scheduled_at: Date;
  started_at: Date | null;
  completed_at: Date | null;
  error_message: string | null;
  metadata: Record<string, any>;
}

export interface JobResult {
  job_id: string;
  success: boolean;
  aircraft_found: number;
  aircraft_added: number;
  aircraft_updated: number;
  errors_count: number;
  duration_seconds: number;
}

export class JobQueue {
  /**
   * Create a new scraping job
   */
  async createJob(
    airlineCode: string,
    options: {
      jobType?: JobType;
      priority?: JobPriority;
      maxRetries?: number;
      retryDelayMinutes?: number;
      scheduledAt?: Date;
      metadata?: Record<string, any>;
    } = {}
  ): Promise<string> {
    const {
      jobType = 'full_fleet_update',
      priority = 'normal',
      maxRetries = 3,
      retryDelayMinutes = 30,
      scheduledAt = new Date(),
      metadata = {},
    } = options;

    logger.info(`Creating job for airline ${airlineCode}`, {
      jobType,
      priority,
      scheduledAt,
    });

    // Verify airline exists
    const airlineQuery = `
      SELECT iata_code, name FROM airlines
      WHERE UPPER(iata_code) = UPPER($1) OR UPPER(icao_code) = UPPER($1)
      LIMIT 1
    `;
    const airlineResult = await queryPostgres(airlineQuery, [airlineCode]);

    if (airlineResult.rows.length === 0) {
      throw new Error(`Airline not found: ${airlineCode}`);
    }

    const airline = airlineResult.rows[0];

    // Generate job ID
    const jobId = `job_${airline.iata_code}_${Date.now()}`;

    // Create job metadata
    const jobMetadata = {
      ...metadata,
      max_retries: maxRetries,
      retry_delay_minutes: retryDelayMinutes,
      retry_count: 0,
      scheduled_at: scheduledAt.toISOString(),
    };

    // Create job
    const insertQuery = `
      INSERT INTO scraping_jobs (
        job_id,
        airline_code,
        airline_name,
        job_type,
        status,
        priority,
        started_at,
        result_summary
      )
      VALUES ($1, $2, $3, $4, 'pending', $5, $6, $7)
      RETURNING job_id
    `;

    const result = await queryPostgres(insertQuery, [
      jobId,
      airline.iata_code,
      airline.name,
      jobType,
      priority,
      scheduledAt,
      JSON.stringify(jobMetadata),
    ]);

    logger.info(`Job created: ${result.rows[0].job_id} for airline ${airlineCode}`);

    return result.rows[0].job_id;
  }

  /**
   * Get next pending job to process
   */
  async getNextJob(): Promise<ScrapeJob | null> {
    const query = `
      SELECT
        id,
        job_id,
        airline_code,
        job_type,
        status,
        priority,
        started_at,
        completed_at,
        error_message,
        result_summary,
        created_at
      FROM scraping_jobs
      WHERE status = 'pending'
      ORDER BY
        CASE priority
          WHEN 'high' THEN 1
          WHEN 'normal' THEN 2
          WHEN 'low' THEN 3
        END,
        created_at ASC
      LIMIT 1
      FOR UPDATE SKIP LOCKED
    `;

    const result = await queryPostgres(query);

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    const metadata = row.result_summary || {};

    return {
      id: row.id,
      job_id: row.job_id,
      airline_code: row.airline_code,
      job_type: row.job_type,
      status: row.status,
      priority: row.priority || 'normal',
      max_retries: metadata.max_retries || 3,
      retry_count: metadata.retry_count || 0,
      retry_delay_minutes: metadata.retry_delay_minutes || 30,
      scheduled_at: metadata.scheduled_at ? new Date(metadata.scheduled_at) : new Date(row.created_at),
      started_at: row.started_at ? new Date(row.started_at) : null,
      completed_at: row.completed_at ? new Date(row.completed_at) : null,
      error_message: row.error_message || null,
      metadata,
    };
  }

  /**
   * Mark job as running
   */
  async startJob(jobId: string): Promise<void> {
    logger.info(`Starting job ${jobId}`);

    const query = `
      UPDATE scraping_jobs
      SET status = 'running',
          started_at = NOW(),
          updated_at = NOW()
      WHERE job_id = $1
    `;

    await queryPostgres(query, [jobId]);
  }

  /**
   * Complete job successfully
   */
  async completeJob(jobId: string, result: Partial<JobResult>): Promise<void> {
    logger.info(`Completing job ${jobId}`, result);

    const query = `
      UPDATE scraping_jobs
      SET status = 'completed',
          completed_at = NOW(),
          duration_seconds = EXTRACT(EPOCH FROM (NOW() - started_at))::INTEGER,
          discovered_count = $2,
          new_count = $3,
          updated_count = $4,
          error_count = $5,
          progress = 100,
          updated_at = NOW()
      WHERE job_id = $1
    `;

    await queryPostgres(query, [
      jobId,
      result.aircraft_found || 0,
      result.aircraft_added || 0,
      result.aircraft_updated || 0,
      result.errors_count || 0,
    ]);
  }

  /**
   * Fail job with error
   */
  async failJob(
    jobId: string,
    error: Error,
    shouldRetry: boolean = true
  ): Promise<void> {
    logger.error(`Job ${jobId} failed:`, error);

    // Get current job metadata
    const getQuery = `SELECT result_summary FROM scraping_jobs WHERE job_id = $1`;
    const result = await queryPostgres(getQuery, [jobId]);

    if (result.rows.length === 0) {
      throw new Error(`Job not found: ${jobId}`);
    }

    const metadata = result.rows[0].result_summary || {};
    const retryCount = (metadata.retry_count || 0) + 1;
    const maxRetries = metadata.max_retries || 3;
    const retryDelayMinutes = metadata.retry_delay_minutes || 30;

    if (shouldRetry && retryCount < maxRetries) {
      // Schedule retry
      const nextRetryAt = new Date(Date.now() + retryDelayMinutes * 60 * 1000);

      logger.info(`Scheduling retry ${retryCount}/${maxRetries} for job ${jobId} at ${nextRetryAt}`);

      const updateQuery = `
        UPDATE scraping_jobs
        SET status = 'pending',
            result_summary = $2,
            error_message = $3,
            updated_at = NOW()
        WHERE job_id = $1
      `;

      const updatedMetadata = {
        ...metadata,
        retry_count: retryCount,
        scheduled_at: nextRetryAt.toISOString(),
        last_error: error.message,
      };

      await queryPostgres(updateQuery, [
        jobId,
        JSON.stringify(updatedMetadata),
        error.message,
      ]);
    } else {
      // Mark as failed
      logger.error(`Job ${jobId} failed permanently after ${retryCount} retries`);

      const updateQuery = `
        UPDATE scraping_jobs
        SET status = 'failed',
            completed_at = NOW(),
            duration_seconds = EXTRACT(EPOCH FROM (NOW() - started_at))::INTEGER,
            error_message = $2,
            error_count = error_count + 1,
            updated_at = NOW()
        WHERE job_id = $1
      `;

      await queryPostgres(updateQuery, [
        jobId,
        error.message,
      ]);
    }
  }

  /**
   * Cancel a job
   */
  async cancelJob(jobId: string): Promise<void> {
    logger.info(`Cancelling job ${jobId}`);

    const query = `
      UPDATE scraping_jobs
      SET status = 'cancelled',
          completed_at = NOW(),
          updated_at = NOW()
      WHERE job_id = $1 AND status IN ('pending', 'running')
    `;

    await queryPostgres(query, [jobId]);
  }

  /**
   * Get job status
   */
  async getJobStatus(jobId: string): Promise<ScrapeJob | null> {
    const query = `
      SELECT
        id,
        job_id,
        airline_code,
        job_type,
        status,
        priority,
        started_at,
        completed_at,
        duration_seconds,
        discovered_count,
        new_count,
        updated_count,
        error_count,
        error_message,
        result_summary,
        created_at
      FROM scraping_jobs
      WHERE job_id = $1
    `;

    const result = await queryPostgres(query, [jobId]);

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    const metadata = row.result_summary || {};

    return {
      id: row.id,
      job_id: row.job_id,
      airline_code: row.airline_code,
      job_type: row.job_type,
      status: row.status,
      priority: row.priority || 'normal',
      max_retries: metadata.max_retries || 3,
      retry_count: metadata.retry_count || 0,
      retry_delay_minutes: metadata.retry_delay_minutes || 30,
      scheduled_at: metadata.scheduled_at ? new Date(metadata.scheduled_at) : new Date(row.created_at),
      started_at: row.started_at ? new Date(row.started_at) : null,
      completed_at: row.completed_at ? new Date(row.completed_at) : null,
      error_message: row.error_message || null,
      metadata,
    };
  }

  /**
   * Get queue statistics
   */
  async getQueueStats(): Promise<{
    pending: number;
    running: number;
    completed: number;
    failed: number;
    total: number;
  }> {
    const query = `
      SELECT
        COUNT(*) FILTER (WHERE status = 'pending') as pending,
        COUNT(*) FILTER (WHERE status = 'running') as running,
        COUNT(*) FILTER (WHERE status = 'completed') as completed,
        COUNT(*) FILTER (WHERE status = 'failed') as failed,
        COUNT(*) as total
      FROM scraping_jobs
      WHERE created_at > NOW() - INTERVAL '7 days'
    `;

    const result = await queryPostgres(query);
    const row = result.rows[0];

    return {
      pending: parseInt(row.pending) || 0,
      running: parseInt(row.running) || 0,
      completed: parseInt(row.completed) || 0,
      failed: parseInt(row.failed) || 0,
      total: parseInt(row.total) || 0,
    };
  }

  /**
   * Clean up old completed jobs
   */
  async cleanupOldJobs(daysToKeep: number = 30): Promise<number> {
    logger.info(`Cleaning up jobs older than ${daysToKeep} days`);

    const query = `
      DELETE FROM scraping_jobs
      WHERE status IN ('completed', 'failed', 'cancelled')
        AND completed_at < NOW() - INTERVAL '${daysToKeep} days'
    `;

    const result = await queryPostgres(query);
    const deletedCount = result.rowCount || 0;

    logger.info(`Deleted ${deletedCount} old jobs`);
    return deletedCount;
  }
}

// Export singleton
let jobQueueInstance: JobQueue | null = null;

export function getJobQueue(): JobQueue {
  if (!jobQueueInstance) {
    jobQueueInstance = new JobQueue();
  }
  return jobQueueInstance;
}

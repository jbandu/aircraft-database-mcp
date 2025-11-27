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
  id: string;
  airline_id: number;
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

    // Get airline ID
    const airlineQuery = `
      SELECT id FROM airlines
      WHERE UPPER(iata_code) = UPPER($1) OR UPPER(icao_code) = UPPER($1)
      LIMIT 1
    `;
    const airlineResult = await queryPostgres(airlineQuery, [airlineCode]);

    if (airlineResult.rows.length === 0) {
      throw new Error(`Airline not found: ${airlineCode}`);
    }

    const airlineId = airlineResult.rows[0].id;

    // Create job
    const insertQuery = `
      INSERT INTO scraping_jobs (
        airline_id,
        job_type,
        status,
        priority,
        started_at,
        metadata
      )
      VALUES ($1, $2, 'pending', $3, $4, $5)
      RETURNING id
    `;

    const jobMetadata = {
      ...metadata,
      max_retries: maxRetries,
      retry_delay_minutes: retryDelayMinutes,
      retry_count: 0,
      scheduled_at: scheduledAt.toISOString(),
    };

    const result = await queryPostgres(insertQuery, [
      airlineId,
      jobType,
      priority,
      scheduledAt,
      JSON.stringify(jobMetadata),
    ]);

    const jobId = result.rows[0].id;
    logger.info(`Job created: ${jobId} for airline ${airlineCode}`);

    return jobId;
  }

  /**
   * Get next pending job to process
   */
  async getNextJob(): Promise<ScrapeJob | null> {
    const query = `
      SELECT
        sj.id,
        sj.airline_id,
        al.iata_code as airline_code,
        sj.job_type,
        sj.status,
        sj.started_at,
        sj.completed_at,
        sj.error_details,
        sj.metadata
      FROM scraping_jobs sj
      JOIN airlines al ON sj.airline_id = al.id
      WHERE sj.status = 'pending'
        AND (sj.metadata->>'scheduled_at')::timestamptz <= NOW()
      ORDER BY
        CASE sj.priority
          WHEN 'high' THEN 1
          WHEN 'normal' THEN 2
          WHEN 'low' THEN 3
        END,
        sj.created_at ASC
      LIMIT 1
      FOR UPDATE SKIP LOCKED
    `;

    const result = await queryPostgres(query);

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    const metadata = row.metadata || {};

    return {
      id: row.id,
      airline_id: row.airline_id,
      airline_code: row.airline_code,
      job_type: row.job_type,
      status: row.status,
      priority: metadata.priority || 'normal',
      max_retries: metadata.max_retries || 3,
      retry_count: metadata.retry_count || 0,
      retry_delay_minutes: metadata.retry_delay_minutes || 30,
      scheduled_at: new Date(metadata.scheduled_at),
      started_at: row.started_at ? new Date(row.started_at) : null,
      completed_at: row.completed_at ? new Date(row.completed_at) : null,
      error_message: row.error_details?.message || null,
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
          started_at = NOW()
      WHERE id = $1
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
          aircraft_found = $2,
          aircraft_added = $3,
          aircraft_updated = $4,
          errors_count = $5
      WHERE id = $1
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
    const getQuery = `SELECT metadata FROM scraping_jobs WHERE id = $1`;
    const result = await queryPostgres(getQuery, [jobId]);

    if (result.rows.length === 0) {
      throw new Error(`Job not found: ${jobId}`);
    }

    const metadata = result.rows[0].metadata || {};
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
            metadata = $2,
            error_details = $3
        WHERE id = $1
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
        JSON.stringify({ message: error.message, stack: error.stack }),
      ]);
    } else {
      // Mark as failed
      logger.error(`Job ${jobId} failed permanently after ${retryCount} retries`);

      const updateQuery = `
        UPDATE scraping_jobs
        SET status = 'failed',
            completed_at = NOW(),
            duration_seconds = EXTRACT(EPOCH FROM (NOW() - started_at))::INTEGER,
            error_details = $2,
            errors_count = errors_count + 1
        WHERE id = $1
      `;

      await queryPostgres(updateQuery, [
        jobId,
        JSON.stringify({ message: error.message, stack: error.stack }),
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
          completed_at = NOW()
      WHERE id = $1 AND status IN ('pending', 'running')
    `;

    await queryPostgres(query, [jobId]);
  }

  /**
   * Get job status
   */
  async getJobStatus(jobId: string): Promise<ScrapeJob | null> {
    const query = `
      SELECT
        sj.id,
        sj.airline_id,
        al.iata_code as airline_code,
        sj.job_type,
        sj.status,
        sj.started_at,
        sj.completed_at,
        sj.duration_seconds,
        sj.aircraft_found,
        sj.aircraft_added,
        sj.aircraft_updated,
        sj.errors_count,
        sj.error_details,
        sj.metadata
      FROM scraping_jobs sj
      JOIN airlines al ON sj.airline_id = al.id
      WHERE sj.id = $1
    `;

    const result = await queryPostgres(query, [jobId]);

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    const metadata = row.metadata || {};

    return {
      id: row.id,
      airline_id: row.airline_id,
      airline_code: row.airline_code,
      job_type: row.job_type,
      status: row.status,
      priority: metadata.priority || 'normal',
      max_retries: metadata.max_retries || 3,
      retry_count: metadata.retry_count || 0,
      retry_delay_minutes: metadata.retry_delay_minutes || 30,
      scheduled_at: new Date(metadata.scheduled_at),
      started_at: row.started_at ? new Date(row.started_at) : null,
      completed_at: row.completed_at ? new Date(row.completed_at) : null,
      error_message: row.error_details?.message || null,
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

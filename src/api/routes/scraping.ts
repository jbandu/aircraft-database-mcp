/**
 * Scraping Routes
 *
 * REST API endpoints for scraping job management:
 * - GET /jobs - List scraping jobs
 * - GET /jobs/:id - Get job status
 * - POST /jobs - Create scraping job
 */

import express, { Request, Response } from 'express';
import { getJobQueue } from '../../scrapers/workflows/job-queue.js';
import { asyncHandler, notFoundError, validationError } from '../middleware/error-handler.js';

const router = express.Router();
const jobQueue = getJobQueue();

/**
 * GET /jobs
 * List scraping jobs
 */
router.get(
  '/',
  asyncHandler(async (_req: Request, res: Response) => {
    const stats = await jobQueue.getQueueStats();

    res.json({
      stats,
      message: 'Use job queue methods for detailed job listing',
    });
  })
);

/**
 * GET /jobs/:id
 * Get job status
 */
router.get(
  '/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;

    const job = await jobQueue.getJobStatus(id!);

    if (!job) {
      throw notFoundError('Job');
    }

    res.json(job);
  })
);

/**
 * POST /jobs
 * Create a new scraping job
 */
router.post(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    const {
      airline_code,
      job_type = 'full_fleet_update',
      priority = 'normal',
      scheduled_at,
    } = req.body;

    if (!airline_code) {
      throw validationError('airline_code is required');
    }

    if (!['low', 'normal', 'high'].includes(priority)) {
      throw validationError('Invalid priority');
    }

    const jobId = await jobQueue.createJob(airline_code, {
      jobType: job_type,
      priority,
      scheduledAt: scheduled_at ? new Date(scheduled_at) : new Date(),
      maxRetries: 3,
      retryDelayMinutes: 30,
    });

    res.status(201).json({
      job_id: jobId,
      airline_code,
      status: 'pending',
      message: 'Scraping job created successfully',
    });
  })
);

export default router;

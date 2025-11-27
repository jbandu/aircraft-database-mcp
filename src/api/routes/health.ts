/**
 * Health Check Route
 *
 * Health check endpoint for monitoring and load balancers.
 */

import express, { Request, Response } from 'express';
import { queryPostgres } from '../../lib/db-clients.js';
import { asyncHandler } from '../middleware/error-handler.js';

const router = express.Router();

/**
 * GET /health
 * Health check endpoint
 */
router.get(
  '/',
  asyncHandler(async (_req: Request, res: Response) => {
    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      database: 'unknown',
    };

    try {
      // Check database connection
      await queryPostgres('SELECT 1');
      health.database = 'connected';
    } catch (error) {
      health.status = 'unhealthy';
      health.database = 'disconnected';
    }

    const statusCode = health.status === 'healthy' ? 200 : 503;
    res.status(statusCode).json(health);
  })
);

export default router;

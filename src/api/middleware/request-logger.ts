/**
 * Request Logger Middleware
 *
 * Logs all incoming requests with timing information.
 */

import { Request, Response, NextFunction } from 'express';
import { createLogger } from '../../lib/logger.js';

const logger = createLogger('api-request');

/**
 * Request logger middleware
 */
export function requestLogger(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const startTime = Date.now();

  // Log request
  logger.info(`${req.method} ${req.path}`, {
    method: req.method,
    path: req.path,
    query: req.query,
    ip: req.ip,
    userAgent: req.headers['user-agent'],
  });

  // Log response when finished
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    const level = res.statusCode >= 400 ? 'error' : 'info';

    logger[level](`${req.method} ${req.path} ${res.statusCode}`, {
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
    });
  });

  next();
}

/**
 * Error Handler Middleware
 *
 * Centralized error handling for API endpoints.
 * Formats errors consistently and logs them.
 */

import { Request, Response, NextFunction } from 'express';
import { createLogger } from '../../lib/logger.js';

const logger = createLogger('error-handler');

export interface APIError extends Error {
  statusCode?: number;
  code?: string;
  details?: any;
}

/**
 * Error handler middleware
 */
export function errorHandler(
  err: APIError,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  // Log error
  logger.error('API error:', {
    path: req.path,
    method: req.method,
    error: err.message,
    stack: err.stack,
  });

  // Determine status code
  const statusCode = err.statusCode || 500;

  // Determine error type
  const errorType = getErrorType(statusCode);

  // Send error response
  res.status(statusCode).json({
    error: errorType,
    message: err.message || 'An unexpected error occurred',
    code: err.code,
    ...(process.env['NODE_ENV'] === 'development' && {
      stack: err.stack,
      details: err.details,
    }),
  });
}

/**
 * Get error type from status code
 */
function getErrorType(statusCode: number): string {
  switch (statusCode) {
    case 400:
      return 'Bad Request';
    case 401:
      return 'Unauthorized';
    case 403:
      return 'Forbidden';
    case 404:
      return 'Not Found';
    case 409:
      return 'Conflict';
    case 422:
      return 'Unprocessable Entity';
    case 429:
      return 'Too Many Requests';
    case 500:
      return 'Internal Server Error';
    case 503:
      return 'Service Unavailable';
    default:
      return 'Error';
  }
}

/**
 * Create API error
 */
export function createAPIError(
  message: string,
  statusCode: number = 500,
  code?: string,
  details?: any
): APIError {
  const error = new Error(message) as APIError;
  error.statusCode = statusCode;
  error.code = code;
  error.details = details;
  return error;
}

/**
 * Not found error
 */
export function notFoundError(resource: string): APIError {
  return createAPIError(`${resource} not found`, 404, 'NOT_FOUND');
}

/**
 * Validation error
 */
export function validationError(message: string, details?: any): APIError {
  return createAPIError(message, 400, 'VALIDATION_ERROR', details);
}

/**
 * Async handler wrapper
 */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<any>
) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

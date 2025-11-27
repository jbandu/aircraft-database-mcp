/**
 * Rate Limiting Middleware
 *
 * Implements rate limiting for API endpoints using token bucket algorithm.
 * Different limits for different endpoint types.
 */

import { Request, Response, NextFunction } from 'express';
import { RateLimiter } from '../../lib/rate-limiter.js';

const globalLimiter = new RateLimiter(
  parseInt(process.env['API_RATE_LIMIT_TOKENS'] || '100', 10),
  parseInt(process.env['API_RATE_LIMIT_REFILL'] || '10', 10)
);

/**
 * Rate limiting middleware
 */
export function rateLimitMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const clientId = getClientIdentifier(req);
  const cost = getRequestCost(req);

  if (!globalLimiter.allow(clientId, cost)) {
    res.status(429).json({
      error: 'Too Many Requests',
      message: 'Rate limit exceeded. Please try again later.',
      retryAfter: 60, // seconds
    });
    return;
  }

  // Add rate limit headers
  res.setHeader('X-RateLimit-Limit', '100');
  res.setHeader('X-RateLimit-Remaining', '90'); // Approximate
  res.setHeader('X-RateLimit-Reset', Date.now() + 60000);

  next();
}

/**
 * Get client identifier for rate limiting
 */
function getClientIdentifier(req: Request): string {
  // Use API key if available
  const apiKey = req.headers['x-api-key'] as string;
  if (apiKey) {
    return `api_key:${apiKey}`;
  }

  // Fall back to IP address
  const ip =
    (req.headers['x-forwarded-for'] as string)?.split(',')[0] ||
    req.socket.remoteAddress ||
    'unknown';

  return `ip:${ip}`;
}

/**
 * Get request cost based on endpoint
 */
function getRequestCost(req: Request): number {
  const path = req.path;

  // Higher cost for expensive operations
  if (path.includes('/search') || path.includes('/stats/global')) {
    return 5;
  }

  // Medium cost for list operations
  if (req.method === 'GET' && path.match(/\/(airlines|aircraft)$/)) {
    return 2;
  }

  // Higher cost for write operations
  if (req.method === 'POST' || req.method === 'PUT') {
    return 3;
  }

  // Default cost
  return 1;
}

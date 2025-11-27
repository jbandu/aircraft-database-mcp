/**
 * Authentication Middleware
 *
 * API key-based authentication for REST API access.
 * Validates API keys from X-API-Key header or Authorization header.
 */

import { Request, Response, NextFunction } from 'express';
import { createLogger } from '../../lib/logger.js';
import { queryPostgres } from '../../lib/db-clients.js';

const logger = createLogger('auth-middleware');

export interface AuthRequest extends Request {
  apiKey?: string;
  userId?: string;
}

/**
 * Authentication middleware
 */
export async function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    // Extract API key from headers
    const apiKey =
      req.headers['x-api-key'] ||
      (req.headers.authorization?.startsWith('Bearer ')
        ? req.headers.authorization.substring(7)
        : null);

    if (!apiKey) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'API key required. Provide via X-API-Key header or Authorization: Bearer <key>',
      });
      return;
    }

    // Validate API key
    const isValid = await validateAPIKey(apiKey as string);

    if (!isValid) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid API key',
      });
      return;
    }

    // Attach API key to request
    (req as AuthRequest).apiKey = apiKey as string;

    next();
  } catch (error) {
    logger.error('Authentication error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Authentication failed',
    });
  }
}

/**
 * Validate API key
 */
async function validateAPIKey(apiKey: string): Promise<boolean> {
  // In production, check against database table
  // For now, check against environment variable
  const validKeys = (process.env['API_KEYS'] || '').split(',').map((k) => k.trim());

  if (validKeys.includes(apiKey)) {
    return true;
  }

  // Also check database (if api_keys table exists)
  try {
    const query = `
      SELECT id, key_name, is_active
      FROM api_keys
      WHERE key_hash = crypt($1, key_hash)
        AND is_active = true
        AND (expires_at IS NULL OR expires_at > NOW())
      LIMIT 1
    `;

    const result = await queryPostgres(query, [apiKey]);
    return result.rows.length > 0;
  } catch (error) {
    // Table might not exist yet
    return false;
  }
}

/**
 * Create API key (admin function)
 */
export async function createAPIKey(
  name: string,
  expiresAt?: Date
): Promise<string> {
  const crypto = await import('crypto');
  const apiKey = crypto.randomBytes(32).toString('hex');

  try {
    const query = `
      INSERT INTO api_keys (key_name, key_hash, expires_at)
      VALUES ($1, crypt($2, gen_salt('bf')), $3)
      RETURNING id
    `;

    await queryPostgres(query, [name, apiKey, expiresAt || null]);

    logger.info(`Created API key: ${name}`);
    return apiKey;
  } catch (error) {
    logger.error('Failed to create API key:', error);
    throw error;
  }
}

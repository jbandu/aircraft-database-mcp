/**
 * Input Validation Middleware
 *
 * Validates and sanitizes all user inputs using Zod schemas.
 * Prevents injection attacks, XSS, and malformed data.
 */

import { Request, Response, NextFunction } from 'express';
import { z, ZodError, ZodSchema } from 'zod';
import { createLogger } from '../../lib/logger.js';

const logger = createLogger('validation-middleware');

/**
 * Validation target: query, body, or params
 */
export type ValidationTarget = 'query' | 'body' | 'params';

/**
 * Create validation middleware for a Zod schema
 */
export function validateRequest(
  schema: ZodSchema,
  target: ValidationTarget = 'body'
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      // Validate the specified target
      const data = req[target];
      const validated = schema.parse(data);

      // Replace with validated data (sanitized)
      (req as any)[target] = validated;

      next();
    } catch (error) {
      if (error instanceof ZodError) {
        logger.warn('Validation error:', {
          path: req.path,
          errors: error.errors,
        });

        res.status(400).json({
          error: 'Validation Error',
          message: 'Invalid request data',
          details: error.errors.map((err) => ({
            path: err.path.join('.'),
            message: err.message,
            code: err.code,
          })),
        });
        return;
      }

      // Unknown error
      logger.error('Validation middleware error:', error);
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Validation failed',
      });
    }
  };
}

// Common Zod schemas for reuse

/**
 * Airline code (IATA or ICAO)
 */
export const airlineCodeSchema = z
  .string()
  .min(2)
  .max(3)
  .toUpperCase()
  .regex(/^[A-Z0-9]+$/, 'Must contain only letters and numbers');

/**
 * Aircraft registration
 */
export const aircraftRegistrationSchema = z
  .string()
  .min(2)
  .max(10)
  .toUpperCase()
  .regex(/^[A-Z0-9-]+$/, 'Invalid registration format');

/**
 * Pagination parameters
 */
export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

/**
 * Date range
 */
export const dateRangeSchema = z.object({
  start_date: z.coerce.date().optional(),
  end_date: z.coerce.date().optional(),
});

/**
 * Search aircraft schema
 */
export const searchAircraftSchema = z
  .object({
    aircraft_type: z.string().max(50).optional(),
    manufacturer: z.string().max(50).optional(),
    model: z.string().max(50).optional(),
    airline_code: airlineCodeSchema.optional(),
    status: z.enum(['active', 'stored', 'retired', 'scrapped']).optional(),
    min_age: z.coerce.number().int().min(0).max(100).optional(),
    max_age: z.coerce.number().int().min(0).max(100).optional(),
    ...paginationSchema.shape,
  })
  .refine(
    (data) => {
      // If both min_age and max_age provided, min must be <= max
      if (data.min_age !== undefined && data.max_age !== undefined) {
        return data.min_age <= data.max_age;
      }
      return true;
    },
    {
      message: 'min_age must be less than or equal to max_age',
    }
  );

/**
 * Get airline fleet schema
 */
export const getAirlineFleetSchema = z.object({
  airline_code: airlineCodeSchema,
  include_inactive: z.coerce.boolean().default(false),
});

/**
 * Create scraping job schema
 */
export const createScrapingJobSchema = z.object({
  airline_code: airlineCodeSchema,
  priority: z.enum(['high', 'normal', 'low']).default('normal'),
  include_aircraft_details: z.boolean().default(true),
  force_update: z.boolean().default(false),
});

/**
 * Get airline stats schema
 */
export const getAirlineStatsSchema = z.object({
  airline_code: airlineCodeSchema,
});

/**
 * Create API key schema
 */
export const createAPIKeySchema = z.object({
  key_name: z.string().min(3).max(255),
  description: z.string().max(500).optional(),
  permissions: z
    .object({
      read: z.boolean().default(true),
      write: z.boolean().default(false),
      admin: z.boolean().default(false),
    })
    .default({ read: true, write: false, admin: false }),
  rate_limit_tier: z.enum(['free', 'standard', 'premium', 'unlimited']).default('standard'),
  expires_at: z.coerce.date().optional(),
});

/**
 * Sanitize string input (prevent XSS)
 */
export function sanitizeString(input: string): string {
  if (!input) return input;

  // Remove HTML tags
  let sanitized = input.replace(/<[^>]*>/g, '');

  // Encode special characters
  sanitized = sanitized
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');

  return sanitized.trim();
}

/**
 * Validate UUID
 */
export function isValidUUID(uuid: string): boolean {
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}

/**
 * Validate email
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validate URL
 */
export function isValidURL(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * Validate IP address (IPv4 or IPv6)
 */
export function isValidIP(ip: string): boolean {
  // IPv4
  const ipv4Regex =
    /^(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;

  // IPv6 (simplified)
  const ipv6Regex = /^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/;

  return ipv4Regex.test(ip) || ipv6Regex.test(ip);
}

/**
 * SQL injection detection (defense in depth - parameterized queries are primary defense)
 */
export function containsSQLInjection(input: string): boolean {
  const sqlPatterns = [
    /(\bor\b|\band\b).*=.*['"]/i, // OR/AND with equals
    /union.*select/i, // UNION SELECT
    /;\s*drop\s+table/i, // DROP TABLE
    /;\s*delete\s+from/i, // DELETE FROM
    /;\s*update\s+\w+\s+set/i, // UPDATE SET
    /--/, // SQL comment
    /\/\*.*\*\//, // Block comment
    /xp_cmdshell/i, // SQL Server command execution
  ];

  return sqlPatterns.some((pattern) => pattern.test(input));
}

/**
 * XSS detection
 */
export function containsXSS(input: string): boolean {
  const xssPatterns = [
    /<script[^>]*>.*?<\/script>/is,
    /on\w+\s*=\s*["'][^"']*["']/i, // Event handlers
    /javascript:/i,
    /<iframe/i,
    /<object/i,
    /<embed/i,
  ];

  return xssPatterns.some((pattern) => pattern.test(input));
}

/**
 * Validate and sanitize middleware (aggressive)
 */
export function aggressiveValidation(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  try {
    // Check all string inputs for SQL injection and XSS
    const checkObject = (obj: any, path: string = ''): void => {
      if (!obj || typeof obj !== 'object') return;

      for (const [key, value] of Object.entries(obj)) {
        const currentPath = path ? `${path}.${key}` : key;

        if (typeof value === 'string') {
          if (containsSQLInjection(value)) {
            logger.warn('Potential SQL injection detected:', {
              path: currentPath,
              value: value.substring(0, 100),
            });
            throw new Error('Invalid input detected');
          }

          if (containsXSS(value)) {
            logger.warn('Potential XSS detected:', {
              path: currentPath,
              value: value.substring(0, 100),
            });
            throw new Error('Invalid input detected');
          }
        } else if (typeof value === 'object') {
          checkObject(value, currentPath);
        }
      }
    };

    checkObject(req.query, 'query');
    checkObject(req.body, 'body');
    checkObject(req.params, 'params');

    next();
  } catch (error) {
    res.status(400).json({
      error: 'Bad Request',
      message: 'Invalid or malicious input detected',
    });
  }
}

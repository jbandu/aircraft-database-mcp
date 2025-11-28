/**
 * Audit Logging Middleware
 *
 * Logs all API requests to audit trail for security and compliance.
 * Tracks who accessed what, when, and from where.
 */

import { Request, Response, NextFunction } from 'express';
import { createLogger } from '../../lib/logger.js';
import { queryPostgres } from '../../lib/db-clients.js';
import { AuthRequest } from './auth.js';

const logger = createLogger('audit-logger');

export interface AuditLogEntry {
  userId?: string;
  apiKeyId?: string;
  ipAddress: string;
  userAgent?: string;
  action: string;
  resourceType?: string;
  resourceId?: string;
  details?: Record<string, any>;
  httpMethod: string;
  httpPath: string;
  httpStatus: number;
  success: boolean;
  errorMessage?: string;
}

/**
 * Audit logging middleware
 */
export function auditLoggerMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const startTime = Date.now();

  // Capture the original res.json to intercept response
  const originalJson = res.json.bind(res);

  res.json = function (body: any) {
    // Log after response is sent
    setImmediate(async () => {
      try {
        await logAuditEntry({
          req,
          res,
          responseBody: body,
          duration: Date.now() - startTime,
        });
      } catch (error) {
        logger.error('Failed to write audit log:', error);
      }
    });

    return originalJson(body);
  };

  next();
}

/**
 * Log audit entry to database
 */
async function logAuditEntry(params: {
  req: Request;
  res: Response;
  responseBody: any;
  duration: number;
}): Promise<void> {
  const { req, res, responseBody, duration } = params;

  // Extract API key ID if authenticated
  const authReq = req as AuthRequest;
  let apiKeyId: string | null = null;

  if (authReq.apiKey) {
    // Look up API key ID
    try {
      const result = await queryPostgres(
        `SELECT id FROM api_keys WHERE key_hash = crypt($1, key_hash) LIMIT 1`,
        [authReq.apiKey]
      );
      if (result.rows.length > 0) {
        apiKeyId = result.rows[0].id;

        // Update last_used_at
        await queryPostgres(
          `UPDATE api_keys SET last_used_at = NOW() WHERE id = $1`,
          [apiKeyId]
        );
      }
    } catch (error) {
      logger.error('Failed to look up API key:', error);
    }
  }

  // Determine action from route
  const action = determineAction(req);

  // Extract resource info from path
  const { resourceType, resourceId } = extractResourceInfo(req);

  // Get client IP
  const ipAddress = getClientIP(req);

  // Check if request was successful
  const success = res.statusCode < 400;
  const errorMessage = !success && responseBody?.error ? responseBody.error : null;

  // Build details object
  const details: Record<string, any> = {
    duration_ms: duration,
    query_params: req.query,
  };

  // Only log body for write operations (not sensitive reads)
  if (['POST', 'PUT', 'PATCH'].includes(req.method) && req.body) {
    details['request_body'] = sanitizeRequestBody(req.body);
  }

  // Insert audit log entry
  try {
    await queryPostgres(
      `
      INSERT INTO api_audit_log (
        user_id,
        api_key_id,
        ip_address,
        user_agent,
        action,
        resource_type,
        resource_id,
        details,
        http_method,
        http_path,
        http_status,
        success,
        error_message
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      `,
      [
        authReq.userId || null,
        apiKeyId,
        ipAddress,
        req.get('user-agent') || null,
        action,
        resourceType,
        resourceId,
        JSON.stringify(details),
        req.method,
        req.path,
        res.statusCode,
        success,
        errorMessage,
      ]
    );
  } catch (error) {
    logger.error('Failed to insert audit log:', error);
  }
}

/**
 * Determine action from request
 */
function determineAction(req: Request): string {
  const { method, path } = req;

  // API key management
  if (path.includes('/api-keys')) {
    if (method === 'POST') return 'api_key.create';
    if (method === 'DELETE') return 'api_key.revoke';
    if (method === 'GET') return 'api_key.read';
  }

  // Airlines
  if (path.includes('/airlines')) {
    if (method === 'GET' && path.match(/\/fleet$/)) return 'airline.fleet.read';
    if (method === 'GET') return 'airline.read';
    if (method === 'POST') return 'airline.create';
    if (method === 'PUT' || method === 'PATCH') return 'airline.update';
    if (method === 'DELETE') return 'airline.delete';
  }

  // Aircraft
  if (path.includes('/aircraft')) {
    if (path.includes('/search')) return 'aircraft.search';
    if (method === 'GET') return 'aircraft.read';
    if (method === 'POST') return 'aircraft.create';
    if (method === 'PUT' || method === 'PATCH') return 'aircraft.update';
    if (method === 'DELETE') return 'aircraft.delete';
  }

  // Scraping jobs
  if (path.includes('/jobs')) {
    if (method === 'POST') return 'scraping_job.create';
    if (method === 'GET') return 'scraping_job.read';
  }

  // Stats
  if (path.includes('/stats')) {
    return 'stats.read';
  }

  // Default
  return `${method.toLowerCase()}.${path.replace(/^\/api\/v\d+\//, '')}`;
}

/**
 * Extract resource type and ID from path
 */
function extractResourceInfo(req: Request): {
  resourceType?: string;
  resourceId?: string;
} {
  const { path } = req;

  // Airlines
  const airlineMatch = path.match(/\/airlines\/([A-Z0-9]+)/);
  if (airlineMatch) {
    return { resourceType: 'airline', resourceId: airlineMatch[1] };
  }

  // Aircraft
  const aircraftMatch = path.match(/\/aircraft\/([A-Z0-9-]+)/);
  if (aircraftMatch) {
    return { resourceType: 'aircraft', resourceId: aircraftMatch[1] };
  }

  // Jobs
  const jobMatch = path.match(/\/jobs\/([a-z0-9-]+)/);
  if (jobMatch) {
    return { resourceType: 'scraping_job', resourceId: jobMatch[1] };
  }

  return {};
}

/**
 * Get client IP address
 */
function getClientIP(req: Request): string {
  // Check X-Forwarded-For header (set by proxies/load balancers)
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    // Take first IP if multiple
    const forwardedStr = Array.isArray(forwarded) ? forwarded[0] : forwarded;
    return forwardedStr?.split(',')[0]?.trim() || 'unknown';
  }

  // Check X-Real-IP header
  const realIP = req.headers['x-real-ip'];
  if (realIP) {
    return Array.isArray(realIP) ? realIP[0] || 'unknown' : realIP;
  }

  // Fall back to socket address
  return req.socket.remoteAddress || 'unknown';
}

/**
 * Sanitize request body (remove sensitive fields)
 */
function sanitizeRequestBody(body: any): any {
  if (!body || typeof body !== 'object') {
    return body;
  }

  const sanitized = { ...body };
  const sensitiveFields = ['password', 'api_key', 'token', 'secret', 'apiKey'];

  for (const field of sensitiveFields) {
    if (field in sanitized) {
      sanitized[field] = '[REDACTED]';
    }
  }

  return sanitized;
}

/**
 * Get audit log entries (admin function)
 */
export async function getAuditLogs(params: {
  limit?: number;
  offset?: number;
  action?: string;
  userId?: string;
  apiKeyId?: string;
  startDate?: Date;
  endDate?: Date;
}): Promise<any[]> {
  const {
    limit = 100,
    offset = 0,
    action,
    userId,
    apiKeyId,
    startDate,
    endDate,
  } = params;

  let query = `
    SELECT
      al.*,
      ak.key_name
    FROM api_audit_log al
    LEFT JOIN api_keys ak ON al.api_key_id = ak.id
    WHERE 1=1
  `;

  const queryParams: any[] = [];
  let paramIndex = 1;

  if (action) {
    query += ` AND al.action = $${paramIndex}`;
    queryParams.push(action);
    paramIndex++;
  }

  if (userId) {
    query += ` AND al.user_id = $${paramIndex}`;
    queryParams.push(userId);
    paramIndex++;
  }

  if (apiKeyId) {
    query += ` AND al.api_key_id = $${paramIndex}`;
    queryParams.push(apiKeyId);
    paramIndex++;
  }

  if (startDate) {
    query += ` AND al.timestamp >= $${paramIndex}`;
    queryParams.push(startDate);
    paramIndex++;
  }

  if (endDate) {
    query += ` AND al.timestamp <= $${paramIndex}`;
    queryParams.push(endDate);
    paramIndex++;
  }

  query += ` ORDER BY al.timestamp DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
  queryParams.push(limit, offset);

  const result = await queryPostgres(query, queryParams);
  return result.rows;
}

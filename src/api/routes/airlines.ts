/**
 * Airlines Routes
 *
 * REST API endpoints for airline operations:
 * - GET /airlines - List all airlines
 * - GET /airlines/:code - Get airline details
 * - GET /airlines/:code/fleet - Get airline fleet
 * - POST /airlines/:code/trigger-update - Trigger fleet update
 */

import express, { Request, Response } from 'express';
import { queryPostgres } from '../../lib/db-clients.js';
import { getJobQueue } from '../../scrapers/workflows/job-queue.js';
import {
  asyncHandler,
  notFoundError,
  validationError,
} from '../middleware/error-handler.js';

const router = express.Router();
const jobQueue = getJobQueue();

/**
 * GET /airlines/status
 * Get status for all airlines (for Fleet Management Dashboard)
 */
router.get(
  '/status',
  asyncHandler(async (req: Request, res: Response) => {
    const query = `
      SELECT
        a.iata_code as code,
        a.name,
        a.fleet_size as "fleetSize",
        COALESCE((
          SELECT COUNT(*) FROM aircraft ac
          WHERE ac.airline_id = a.id AND ac.status = 'active'
        ), 0) as "activeAircraft",
        COALESCE((
          SELECT COUNT(*) FROM aircraft ac
          WHERE ac.airline_id = a.id AND ac.status = 'stored'
        ), 0) as "storedAircraft",
        a.last_scraped_at as "lastUpdated",
        NULL as "lastScrapeJobId",
        COALESCE(a.data_completeness_score, 0.5) as "averageConfidence",
        a.fleet_size as "completeRecords",
        0 as "incompleteRecords",
        0 as "needsReviewCount",
        CASE
          WHEN a.last_scraped_at IS NULL THEN 'empty'
          WHEN a.last_scraped_at < NOW() - INTERVAL '30 days' THEN 'critical'
          WHEN a.last_scraped_at < NOW() - INTERVAL '7 days' THEN 'stale'
          ELSE 'good'
        END as "dataStatus",
        EXTRACT(DAY FROM (NOW() - a.last_scraped_at)) as "daysSinceUpdate",
        (a.last_scraped_at IS NULL OR a.last_scraped_at < NOW() - INTERVAL '7 days') as "needsUpdate",
        false as "autoUpdateEnabled",
        NULL as "autoUpdateFrequency",
        NULL as "nextScheduledUpdate"
      FROM airlines a
      WHERE a.iata_code IS NOT NULL
      ORDER BY a.name
    `;

    const result = await queryPostgres(query, []);
    res.json(result.rows);
  })
);

/**
 * GET /airlines
 * List all airlines with optional filtering
 */
router.get(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    const {
      country,
      limit = '50',
      offset = '0',
      sortBy = 'name',
      order = 'asc',
    } = req.query;

    // Build query
    let query = `
      SELECT
        id,
        iata_code,
        icao_code,
        name,
        country,
        hub_airport,
        website_url as website,
        fleet_size as fleet_size_estimate,
        scrape_status as scrape_enabled,
        last_scraped_at,
        created_at
      FROM airlines
      WHERE 1=1
    `;
    const params: any[] = [];

    // Country filter
    if (country) {
      params.push(country);
      query += ` AND UPPER(country) = UPPER($${params.length})`;
    }

    // Sorting
    const validSortFields = ['name', 'country', 'fleet_size_estimate', 'created_at'];
    const sortField = validSortFields.includes(sortBy as string)
      ? sortBy
      : 'name';
    const sortOrder = order === 'desc' ? 'DESC' : 'ASC';
    query += ` ORDER BY ${sortField} ${sortOrder}`;

    // Pagination
    params.push(parseInt(limit as string, 10));
    query += ` LIMIT $${params.length}`;
    params.push(parseInt(offset as string, 10));
    query += ` OFFSET $${params.length}`;

    const result = await queryPostgres(query, params);

    // Get total count
    let countQuery = 'SELECT COUNT(*) as total FROM airlines WHERE 1=1';
    const countParams: any[] = [];
    if (country) {
      countParams.push(country);
      countQuery += ` AND UPPER(country) = UPPER($${countParams.length})`;
    }
    const countResult = await queryPostgres(countQuery, countParams);

    res.json({
      airlines: result.rows,
      pagination: {
        total: parseInt(countResult.rows[0].total),
        limit: parseInt(limit as string),
        offset: parseInt(offset as string),
      },
    });
  })
);

/**
 * GET /airlines/:code
 * Get airline details by IATA or ICAO code
 */
router.get(
  '/:code',
  asyncHandler(async (req: Request, res: Response) => {
    const { code } = req.params;

    const query = `
      SELECT
        id,
        iata_code,
        icao_code,
        name,
        country,
        hub_airport,
        website_url as website,
        fleet_size as fleet_size_estimate,
        scrape_status as scrape_enabled,
        scrape_source_urls,
        scrape_frequency,
        last_scraped_at,
        created_at,
        updated_at
      FROM airlines
      WHERE UPPER(iata_code) = UPPER($1) OR UPPER(icao_code) = UPPER($1)
      LIMIT 1
    `;

    const result = await queryPostgres(query, [code]);

    if (result.rows.length === 0) {
      throw notFoundError('Airline');
    }

    res.json(result.rows[0]);
  })
);

/**
 * GET /airlines/:code/fleet
 * Get airline's complete fleet
 */
router.get(
  '/:code/fleet',
  asyncHandler(async (req: Request, res: Response) => {
    const { code } = req.params;
    const { status, includeDetails = 'false' } = req.query;

    // Get airline ID
    const airlineQuery = `
      SELECT id FROM airlines
      WHERE UPPER(iata_code) = UPPER($1) OR UPPER(icao_code) = UPPER($1)
      LIMIT 1
    `;
    const airlineResult = await queryPostgres(airlineQuery, [code]);

    if (airlineResult.rows.length === 0) {
      throw notFoundError('Airline');
    }

    const airlineId = airlineResult.rows[0].id;

    // Build fleet query
    let fleetQuery = `
      SELECT
        a.id,
        a.registration,
        at.iata_code as aircraft_type,
        at.manufacturer,
        at.model,
        a.msn,
        a.seat_configuration,
        a.delivery_date,
        a.status,
        a.current_location,
        a.home_base,
        a.last_flight_date,
        a.data_confidence,
        a.last_scraped_at
      FROM aircraft a
      JOIN aircraft_types at ON a.aircraft_type_id = at.id
      WHERE a.airline_id = $1
    `;
    const params: any[] = [airlineId];

    // Status filter
    if (status && status !== 'all') {
      params.push(status);
      fleetQuery += ` AND UPPER(a.status) = UPPER($${params.length})`;
    }

    fleetQuery += ' ORDER BY a.registration';

    const fleetResult = await queryPostgres(fleetQuery, params);

    // Include additional details if requested
    const aircraft = fleetResult.rows.map((row) => {
      const base = {
        id: row.id,
        registration: row.registration,
        aircraft_type: row.aircraft_type,
        status: row.status,
        current_location: row.current_location,
      };

      if (includeDetails === 'true') {
        return {
          ...base,
          manufacturer: row.manufacturer,
          model: row.model,
          msn: row.msn,
          seat_configuration: row.seat_configuration,
          delivery_date: row.delivery_date,
          home_base: row.home_base,
          last_flight_date: row.last_flight_date,
          data_confidence: row.data_confidence,
          last_scraped_at: row.last_scraped_at,
        };
      }

      return base;
    });

    res.json({
      airline_code: code,
      total_aircraft: aircraft.length,
      aircraft,
    });
  })
);

/**
 * POST /airlines/:code/trigger-update
 * Trigger a fleet update for an airline
 */
router.post(
  '/:code/trigger-update',
  asyncHandler(async (req: Request, res: Response) => {
    const { code } = req.params;
    const { force = false, priority = 'normal' } = req.body;

    // Validate priority
    if (!['low', 'normal', 'high'].includes(priority)) {
      throw validationError('Invalid priority. Must be: low, normal, or high');
    }

    // Check if airline exists
    const airlineQuery = `
      SELECT id, name FROM airlines
      WHERE UPPER(iata_code) = UPPER($1) OR UPPER(icao_code) = UPPER($1)
      LIMIT 1
    `;
    const airlineResult = await queryPostgres(airlineQuery, [code]);

    if (airlineResult.rows.length === 0) {
      throw notFoundError('Airline');
    }

    const airline = airlineResult.rows[0];

    // Create scraping job
    const jobId = await jobQueue.createJob(code!.toUpperCase(), {
      jobType: 'full_fleet_update',
      priority,
      maxRetries: 3,
      retryDelayMinutes: 30,
      scheduledAt: new Date(),
      metadata: {
        triggered_via: 'api',
        force_update: force,
      },
    });

    res.status(202).json({
      message: `Fleet update triggered for ${airline.name}`,
      job_id: jobId,
      airline_code: code,
      priority,
      status: 'pending',
    });
  })
);

export default router;

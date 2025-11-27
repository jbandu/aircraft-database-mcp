/**
 * Statistics Routes
 *
 * REST API endpoints for statistics:
 * - GET /stats/global - Global fleet statistics
 * - GET /stats/airline/:code - Airline-specific statistics
 */

import express, { Request, Response } from 'express';
import { queryPostgres } from '../../lib/db-clients.js';
import { asyncHandler, notFoundError } from '../middleware/error-handler.js';

const router = express.Router();

/**
 * GET /stats/global
 * Get global fleet statistics
 */
router.get(
  '/global',
  asyncHandler(async (_req: Request, res: Response) => {
    // Total statistics
    const totalQuery = `
      SELECT
        COUNT(DISTINCT al.id) as total_airlines,
        COUNT(DISTINCT a.id) as total_aircraft,
        COUNT(DISTINCT at.id) as total_aircraft_types,
        COUNT(DISTINCT a.id) FILTER (WHERE a.status = 'Active') as active_aircraft
      FROM airlines al
      LEFT JOIN aircraft a ON al.id = a.airline_id
      LEFT JOIN aircraft_types at ON a.aircraft_type_id = at.id
    `;

    const totalResult = await queryPostgres(totalQuery);

    // By aircraft type
    const byTypeQuery = `
      SELECT
        at.iata_code,
        at.manufacturer,
        at.model,
        COUNT(a.id) as count
      FROM aircraft_types at
      LEFT JOIN aircraft a ON at.id = a.aircraft_type_id
      GROUP BY at.id, at.iata_code, at.manufacturer, at.model
      HAVING COUNT(a.id) > 0
      ORDER BY COUNT(a.id) DESC
      LIMIT 10
    `;

    const byTypeResult = await queryPostgres(byTypeQuery);

    // By country
    const byCountryQuery = `
      SELECT
        al.country,
        COUNT(DISTINCT al.id) as airline_count,
        COUNT(a.id) as aircraft_count
      FROM airlines al
      LEFT JOIN aircraft a ON al.id = a.airline_id
      GROUP BY al.country
      ORDER BY COUNT(a.id) DESC
      LIMIT 10
    `;

    const byCountryResult = await queryPostgres(byCountryQuery);

    res.json({
      total: totalResult.rows[0],
      by_aircraft_type: byTypeResult.rows,
      by_country: byCountryResult.rows,
    });
  })
);

/**
 * GET /stats/airline/:code
 * Get airline-specific statistics
 */
router.get(
  '/airline/:code',
  asyncHandler(async (req: Request, res: Response) => {
    const { code } = req.params;

    // Get airline
    const airlineQuery = `
      SELECT id, iata_code, name FROM airlines
      WHERE UPPER(iata_code) = UPPER($1) OR UPPER(icao_code) = UPPER($1)
      LIMIT 1
    `;
    const airlineResult = await queryPostgres(airlineQuery, [code]);

    if (airlineResult.rows.length === 0) {
      throw notFoundError('Airline');
    }

    const airline = airlineResult.rows[0];
    const airlineId = airline.id;

    // Fleet statistics
    const fleetQuery = `
      SELECT
        COUNT(*) as total_aircraft,
        COUNT(*) FILTER (WHERE status = 'Active') as active,
        COUNT(*) FILTER (WHERE status = 'Stored') as stored,
        COUNT(*) FILTER (WHERE status = 'Maintenance') as maintenance,
        AVG(EXTRACT(YEAR FROM AGE(CURRENT_DATE, delivery_date)))::INTEGER as avg_age_years,
        MIN(delivery_date) as oldest_delivery,
        MAX(delivery_date) as newest_delivery
      FROM aircraft
      WHERE airline_id = $1
    `;

    const fleetResult = await queryPostgres(fleetQuery, [airlineId]);

    // By aircraft type
    const byTypeQuery = `
      SELECT
        at.iata_code,
        at.manufacturer,
        at.model,
        COUNT(a.id) as count,
        COUNT(a.id) FILTER (WHERE a.status = 'Active') as active_count
      FROM aircraft a
      JOIN aircraft_types at ON a.aircraft_type_id = at.id
      WHERE a.airline_id = $1
      GROUP BY at.id, at.iata_code, at.manufacturer, at.model
      ORDER BY COUNT(a.id) DESC
    `;

    const byTypeResult = await queryPostgres(byTypeQuery, [airlineId]);

    res.json({
      airline: {
        code: airline.iata_code,
        name: airline.name,
      },
      fleet: fleetResult.rows[0],
      by_aircraft_type: byTypeResult.rows,
    });
  })
);

export default router;

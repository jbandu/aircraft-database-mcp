/**
 * Aircraft Routes
 *
 * REST API endpoints for aircraft operations:
 * - GET /aircraft - Search aircraft
 * - GET /aircraft/:registration - Get aircraft details
 * - GET /aircraft/:registration/history - Get aircraft history
 */

import express, { Request, Response } from 'express';
import { queryPostgres } from '../../lib/db-clients.js';
import { asyncHandler, notFoundError } from '../middleware/error-handler.js';

const router = express.Router();

/**
 * GET /aircraft
 * Search aircraft with filters
 */
router.get(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    const {
      airline_code,
      aircraft_type,
      status,
      registration,
      limit = '50',
      offset = '0',
    } = req.query;

    let query = `
      SELECT
        a.id,
        a.registration,
        al.iata_code as airline_code,
        al.name as airline_name,
        at.iata_code as aircraft_type,
        at.manufacturer,
        at.model,
        a.status,
        a.current_location,
        a.delivery_date,
        a.data_confidence
      FROM aircraft a
      JOIN airlines al ON a.airline_id = al.id
      JOIN aircraft_types at ON a.aircraft_type_id = at.id
      WHERE 1=1
    `;
    const params: any[] = [];

    // Filters
    if (airline_code) {
      params.push(airline_code);
      query += ` AND (UPPER(al.iata_code) = UPPER($${params.length}) OR UPPER(al.icao_code) = UPPER($${params.length}))`;
    }

    if (aircraft_type) {
      params.push(`%${aircraft_type}%`);
      query += ` AND (at.iata_code ILIKE $${params.length} OR at.icao_code ILIKE $${params.length} OR at.model ILIKE $${params.length})`;
    }

    if (status) {
      params.push(status);
      query += ` AND UPPER(a.status) = UPPER($${params.length})`;
    }

    if (registration) {
      params.push(`%${registration}%`);
      query += ` AND a.registration ILIKE $${params.length}`;
    }

    query += ' ORDER BY a.registration';

    // Pagination
    params.push(parseInt(limit as string, 10));
    query += ` LIMIT $${params.length}`;
    params.push(parseInt(offset as string, 10));
    query += ` OFFSET $${params.length}`;

    const result = await queryPostgres(query, params);

    res.json({
      aircraft: result.rows,
      count: result.rows.length,
    });
  })
);

/**
 * GET /aircraft/:registration
 * Get aircraft details
 */
router.get(
  '/:registration',
  asyncHandler(async (req: Request, res: Response) => {
    const { registration } = req.params;

    const query = `
      SELECT
        a.*,
        al.iata_code as airline_code,
        al.name as airline_name,
        at.iata_code as aircraft_type_code,
        at.manufacturer,
        at.model,
        at.typical_seats,
        at.max_seats,
        at.range_km
      FROM aircraft a
      JOIN airlines al ON a.airline_id = al.id
      JOIN aircraft_types at ON a.aircraft_type_id = at.id
      WHERE UPPER(a.registration) = UPPER($1)
      LIMIT 1
    `;

    const result = await queryPostgres(query, [registration]);

    if (result.rows.length === 0) {
      throw notFoundError('Aircraft');
    }

    res.json(result.rows[0]);
  })
);

/**
 * GET /aircraft/:registration/history
 * Get aircraft history
 */
router.get(
  '/:registration/history',
  asyncHandler(async (req: Request, res: Response) => {
    const { registration } = req.params;

    // Check if aircraft exists
    const aircraftQuery = `
      SELECT id FROM aircraft WHERE UPPER(registration) = UPPER($1) LIMIT 1
    `;
    const aircraftResult = await queryPostgres(aircraftQuery, [registration]);

    if (aircraftResult.rows.length === 0) {
      throw notFoundError('Aircraft');
    }

    const aircraftId = aircraftResult.rows[0].id;

    // Get history
    const historyQuery = `
      SELECT
        fc.*,
        al_from.iata_code as from_airline_code,
        al_from.name as from_airline_name,
        al_to.iata_code as to_airline_code,
        al_to.name as to_airline_name
      FROM fleet_changes fc
      LEFT JOIN airlines al_from ON fc.from_airline_id = al_from.id
      LEFT JOIN airlines al_to ON fc.to_airline_id = al_to.id
      WHERE fc.aircraft_id = $1
      ORDER BY fc.change_date DESC, fc.created_at DESC
    `;

    const historyResult = await queryPostgres(historyQuery, [aircraftId]);

    res.json({
      registration,
      history: historyResult.rows,
    });
  })
);

export default router;

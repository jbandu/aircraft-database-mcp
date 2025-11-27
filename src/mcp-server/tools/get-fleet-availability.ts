/**
 * MCP Tool: get_fleet_availability
 * Get aircraft availability information for operational planning
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { queryPostgres } from '../../lib/db-clients.js';
import { createLogger } from '../../lib/logger.js';
import { GetFleetAvailabilitySchema, safeValidateInput } from '../schemas/tool-schemas.js';
import { Cache, globalCache } from '../../lib/cache.js';
import { checkRateLimit } from '../../lib/rate-limiter.js';

const logger = createLogger('tool:get-fleet-availability');

export const getFleetAvailabilityTool: Tool = {
  name: 'get_fleet_availability',
  description: 'Get aircraft availability information for operational planning',
  inputSchema: {
    type: 'object',
    properties: {
      airline_code: {
        type: 'string',
        description: 'IATA/ICAO airline code',
      },
      aircraft_types: {
        type: 'array',
        items: {
          type: 'string',
        },
        description: 'Filter by specific aircraft types',
      },
      home_base: {
        type: 'string',
        description: 'Filter by home base airport',
      },
      exclude_maintenance: {
        type: 'boolean',
        description: 'Exclude aircraft in maintenance',
        default: true,
      },
    },
    required: ['airline_code'],
  },
};

export async function handleGetFleetAvailability(args: any) {
  const startTime = Date.now();

  // Rate limiting
  if (!checkRateLimit('get_fleet_availability', 1)) {
    return {
      content: [
        {
          type: 'text',
          text: 'Error: Rate limit exceeded. Please try again later.',
        },
      ],
      isError: true,
    };
  }

  // Validate input
  const validation = safeValidateInput(GetFleetAvailabilitySchema, args);
  if (!validation.success) {
    return {
      content: [
        {
          type: 'text',
          text: `Validation error: ${validation.error}`,
        },
      ],
      isError: true,
    };
  }

  const { airline_code, aircraft_types, home_base, exclude_maintenance } = validation.data;

  logger.info(`Getting fleet availability for ${airline_code}`, {
    aircraft_types,
    home_base,
    exclude_maintenance,
  });

  try {
    // Check cache (shorter TTL for availability - 5 minutes)
    const cacheKey = Cache.generateKey('fleet_availability', {
      airline_code,
      aircraft_types,
      home_base,
      exclude_maintenance,
    });
    const cached = globalCache.get(cacheKey);

    if (cached) {
      return cached;
    }

    // Find airline
    const airlineQuery = `
      SELECT id, iata_code, icao_code, name
      FROM airlines
      WHERE UPPER(iata_code) = UPPER($1) OR UPPER(icao_code) = UPPER($1)
      LIMIT 1
    `;

    const airlineResult = await queryPostgres(airlineQuery, [airline_code]);

    if (airlineResult.rows.length === 0) {
      return {
        content: [
          {
            type: 'text',
            text: `Airline not found: ${airline_code}`,
          },
        ],
        isError: true,
      };
    }

    const airline = airlineResult.rows[0];

    // Build availability query
    let query = `
      SELECT
        a.id,
        a.registration,
        a.aircraft_type,
        a.manufacturer,
        a.model,
        a.status,
        a.maintenance_status,
        a.home_base,
        a.current_location,
        a.total_seats,
        a.last_flight_date,
        a.next_maintenance_date,
        ac.total_seats as configured_seats,
        ac.configuration_name,
        CASE
          WHEN a.status = 'active' AND (a.maintenance_status IS NULL OR a.maintenance_status NOT IN ('in_maintenance', 'grounded'))
          THEN true
          ELSE false
        END as is_available
      FROM aircraft a
      LEFT JOIN aircraft_configurations ac ON a.id = ac.aircraft_id AND ac.is_current = true
      WHERE a.airline_id = $1
    `;

    const params: any[] = [airline.id];
    let paramCount = 1;

    // Apply filters
    if (exclude_maintenance) {
      query += ` AND a.status = 'active' AND (a.maintenance_status IS NULL OR a.maintenance_status NOT IN ('in_maintenance', 'grounded'))`;
    }

    if (aircraft_types && aircraft_types.length > 0) {
      paramCount++;
      query += ` AND a.aircraft_type = ANY($${paramCount})`;
      params.push(aircraft_types);
    }

    if (home_base) {
      paramCount++;
      query += ` AND UPPER(a.home_base) = UPPER($${paramCount})`;
      params.push(home_base);
    }

    query += ' ORDER BY a.aircraft_type, a.registration';

    const result = await queryPostgres(query, params);

    // Calculate statistics
    const totalAircraft = result.rows.length;
    const availableAircraft = result.rows.filter((r) => r.is_available).length;
    const unavailableAircraft = totalAircraft - availableAircraft;

    // Group by type
    const byType = result.rows.reduce(
      (acc, row) => {
        const type = row.aircraft_type;
        if (!acc[type]) {
          acc[type] = {
            total: 0,
            available: 0,
            unavailable: 0,
            aircraft: [],
          };
        }
        acc[type].total++;
        if (row.is_available) {
          acc[type].available++;
        } else {
          acc[type].unavailable++;
        }
        acc[type].aircraft.push({
          registration: row.registration,
          status: row.status,
          maintenanceStatus: row.maintenance_status,
          homeBase: row.home_base,
          currentLocation: row.current_location,
          seats: row.configured_seats || row.total_seats,
          configName: row.configuration_name,
          isAvailable: row.is_available,
        });
        return acc;
      },
      {} as Record<string, any>
    );

    // Format response
    const summary = `
**Fleet Availability for ${airline.name} (${airline.iata_code}/${airline.icao_code})**

**Overall Summary:**
- Total Aircraft: ${totalAircraft}
- Available: ${availableAircraft} (${((availableAircraft / totalAircraft) * 100).toFixed(1)}%)
- Unavailable: ${unavailableAircraft}

**By Aircraft Type:**
${Object.entries(byType)
  .map(([type, data]: [string, any]) => {
    return `
**${type}**
- Total: ${data.total}
- Available: ${data.available}
- Unavailable: ${data.unavailable}
- Availability Rate: ${((data.available / data.total) * 100).toFixed(1)}%

Available Aircraft:
${data.aircraft
  .filter((ac: any) => ac.isAvailable)
  .map(
    (ac: any) =>
      `  - ${ac.registration} | ${ac.seats} seats | Base: ${ac.homeBase || 'N/A'} | Location: ${ac.currentLocation || 'N/A'}`
  )
  .join('\n') || '  None'}

${
  !exclude_maintenance && data.aircraft.filter((ac: any) => !ac.isAvailable).length > 0
    ? `Unavailable Aircraft:
${data.aircraft
  .filter((ac: any) => !ac.isAvailable)
  .map((ac: any) => `  - ${ac.registration} | Status: ${ac.status} | Maintenance: ${ac.maintenanceStatus || 'N/A'}`)
  .join('\n')}`
    : ''
}
    `.trim();
  })
  .join('\n\n')}

**Filters Applied:**
- Exclude Maintenance: ${exclude_maintenance ? 'Yes' : 'No'}
- Aircraft Types: ${aircraft_types && aircraft_types.length > 0 ? aircraft_types.join(', ') : 'All'}
- Home Base: ${home_base || 'All'}

**Notes:**
- Available = Active status and not in maintenance
- Data is cached for 5 minutes
- Use for crew scheduling and operational planning
    `.trim();

    const response = {
      content: [
        {
          type: 'text',
          text: summary,
        },
      ],
    };

    // Cache for 5 minutes (availability changes frequently)
    globalCache.set(cacheKey, response, 300000);

    const duration = Date.now() - startTime;
    logger.info(`Fleet availability retrieved in ${duration}ms`);

    return response;
  } catch (error) {
    logger.error('Error getting fleet availability:', error);
    return {
      content: [
        {
          type: 'text',
          text: `Error: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
      isError: true,
    };
  }
}

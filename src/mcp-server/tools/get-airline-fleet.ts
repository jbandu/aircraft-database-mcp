/**
 * MCP Tool: get_airline_fleet
 * Get complete fleet information for a specific airline
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { queryPostgres } from '../../lib/db-clients.js';
import { createLogger } from '../../lib/logger.js';
import { GetAirlineFleetSchema, safeValidateInput } from '../schemas/tool-schemas.js';
import { Cache, globalCache } from '../../lib/cache.js';
import { checkRateLimit } from '../../lib/rate-limiter.js';

const logger = createLogger('tool:get-airline-fleet');

export const getAirlineFleetTool: Tool = {
  name: 'get_airline_fleet',
  description: 'Retrieve complete aircraft fleet for a specific airline',
  inputSchema: {
    type: 'object',
    properties: {
      airline_code: {
        type: 'string',
        description: "IATA or ICAO airline code (e.g., 'UA', 'AAL')",
      },
      include_details: {
        type: 'boolean',
        description: 'Include detailed aircraft specifications',
        default: false,
      },
      status_filter: {
        type: 'string',
        enum: ['active', 'stored', 'maintenance', 'retired', 'all'],
        description: 'Filter by aircraft status',
        default: 'active',
      },
    },
    required: ['airline_code'],
  },
};

interface FleetAircraft {
  registration: string;
  manufacturer: string;
  model: string;
  variant: string | null;
  type_category: string;
  status: string;
  age_years: number | null;
  manufacture_date: string | null;
  total_seats: number | null;
  configuration_name: string | null;
  // Detailed specs (when include_details = true)
  msn?: string;
  engines?: string;
  ownership_type?: string;
  home_base?: string;
  total_flight_hours?: number;
  last_flight_date?: string;
}

export async function handleGetAirlineFleet(args: any) {
  const startTime = Date.now();

  // Rate limiting
  if (!checkRateLimit('get_airline_fleet', 1)) {
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
  const validation = safeValidateInput(GetAirlineFleetSchema, args);
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

  const { airline_code, include_details, status_filter } = validation.data;

  logger.info(`Getting fleet for airline: ${airline_code}`, { include_details, status_filter });

  try {
    // Check cache
    const cacheKey = Cache.generateKey('airline_fleet', { airline_code, include_details, status_filter });
    const cached = globalCache.get(cacheKey);

    if (cached) {
      return cached;
    }

    // First, find the airline by IATA or ICAO code
    const airlineQuery = `
      SELECT id, iata_code, icao_code, name, country
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

    // Get fleet information
    let fleetQuery = `
      SELECT
        a.registration,
        at.manufacturer,
        at.model,
        at.variant,
        at.type_category,
        a.status,
        EXTRACT(YEAR FROM AGE(CURRENT_DATE, a.manufacture_date))::FLOAT as age_years,
        a.manufacture_date,
        ac.total_seats,
        ac.configuration_name
        ${
          include_details
            ? `, a.manufacturer_serial_number as msn, a.engines,
           a.last_seen_date as last_flight_date`
            : ''
        }
      FROM aircraft a
      LEFT JOIN aircraft_types at ON a.aircraft_type_id = at.id
      LEFT JOIN aircraft_configurations ac ON a.id = ac.aircraft_id AND ac.is_current = true
      WHERE a.current_airline_id = $1
    `;

    // Apply status filter
    if (status_filter !== 'all') {
      fleetQuery += ` AND a.status = '${status_filter}'`;
    }

    fleetQuery += ' ORDER BY at.manufacturer, at.model, a.registration';

    const fleetResult = await queryPostgres<FleetAircraft>(fleetQuery, [airline.id]);

    // Calculate statistics
    const totalAircraft = fleetResult.rows.length;
    const activeAircraft = fleetResult.rows.filter((ac) => ac.status === 'active').length;
    const averageAge =
      fleetResult.rows.reduce((sum, ac) => sum + (ac.age_years || 0), 0) / totalAircraft || 0;

    // Group by type
    const byType = fleetResult.rows.reduce(
      (acc, ac) => {
        const key = `${ac.manufacturer} ${ac.model}${ac.variant ? '-' + ac.variant : ''}`;
        if (!acc[key]) {
          acc[key] = [];
        }
        acc[key].push(ac);
        return acc;
      },
      {} as Record<string, FleetAircraft[]>
    );

    // Format response
    let summary = `
**${airline.name}** (${airline.iata_code}/${airline.icao_code})
Country: ${airline.country}

**Fleet Summary:**
- Total Aircraft: ${totalAircraft}
- Active: ${activeAircraft}
- Average Age: ${averageAge.toFixed(1)} years
- Status Filter: ${status_filter}

**Fleet Composition by Type:**
${Object.entries(byType)
  .map(([type, aircraft]) => `- ${type}: ${aircraft.length} aircraft`)
  .join('\n')}

**Detailed Fleet List:**
`;

    // Add aircraft list
    for (const ac of fleetResult.rows) {
      summary += `\n${ac.registration} | ${ac.manufacturer} ${ac.model}${ac.variant ? '-' + ac.variant : ''} | Age: ${ac.age_years?.toFixed(1) || 'N/A'} yrs | Seats: ${ac.total_seats || 'N/A'} | Status: ${ac.status}`;

      if (include_details) {
        summary += `\n  └─ MSN: ${ac.msn || 'N/A'} | Engines: ${ac.engines || 'N/A'} | Ownership: ${ac.ownership_type || 'N/A'} | Base: ${ac.home_base || 'N/A'}`;
        if (ac.total_flight_hours) {
          summary += ` | Flight Hours: ${ac.total_flight_hours.toLocaleString()}`;
        }
      }
    }

    const response = {
      content: [
        {
          type: 'text',
          text: summary.trim(),
        },
      ],
    };

    // Cache for 10 minutes
    globalCache.set(cacheKey, response, 600000);

    const duration = Date.now() - startTime;
    logger.info(`Airline fleet retrieved in ${duration}ms`);

    return response;
  } catch (error) {
    logger.error('Error getting airline fleet:', error);
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

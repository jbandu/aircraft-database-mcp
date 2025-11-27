/**
 * MCP Tool: search_aircraft
 * Search for aircraft by various criteria
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { queryPostgres } from '../../lib/db-clients.js';
import { createLogger } from '../../lib/logger.js';

const logger = createLogger('tool:search-aircraft');

export const searchAircraftTool: Tool = {
  name: 'search_aircraft',
  description: 'Search for aircraft by various criteria including type, airline, registration',
  inputSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'Search query (aircraft type, airline, registration, etc.)',
      },
      filters: {
        type: 'object',
        properties: {
          aircraft_type: {
            type: 'string',
            description: "Aircraft type/model (e.g., 'A320', 'B737-800')",
          },
          airline_code: {
            type: 'string',
            description: 'Filter by airline IATA/ICAO code',
          },
          manufacturer: {
            type: 'string',
            description: "Aircraft manufacturer (e.g., 'Boeing', 'Airbus')",
          },
          status: {
            type: 'string',
            enum: ['active', 'stored', 'retired', 'on_order'],
            description: 'Aircraft operational status',
          },
          min_year: {
            type: 'integer',
            description: 'Minimum manufacturing year',
          },
          max_year: {
            type: 'integer',
            description: 'Maximum manufacturing year',
          },
        },
      },
      limit: {
        type: 'integer',
        description: 'Maximum number of results',
        default: 50,
      },
      offset: {
        type: 'integer',
        description: 'Pagination offset',
        default: 0,
      },
    },
    required: ['query'],
  },
};

interface SearchAircraftArgs {
  query: string;
  filters?: {
    aircraft_type?: string;
    airline_code?: string;
    manufacturer?: string;
    status?: string;
    min_year?: number;
    max_year?: number;
  };
  limit?: number;
  offset?: number;
}

export async function handleSearchAircraft(args: any) {
  const { query, filters = {}, limit = 50, offset = 0 } = args as SearchAircraftArgs;

  logger.info(`Searching aircraft: "${query}"`, { filters, limit, offset });

  try {
    // Build WHERE clause
    const conditions: string[] = [];
    const params: any[] = [];
    let paramCount = 0;

    // Full text search on registration, type, airline
    conditions.push(`(
      UPPER(a.registration) LIKE UPPER($${++paramCount})
      OR UPPER(at.model) LIKE UPPER($${paramCount})
      OR UPPER(at.manufacturer) LIKE UPPER($${paramCount})
      OR UPPER(al.name) LIKE UPPER($${paramCount})
    )`);
    params.push(`%${query}%`);

    // Apply filters
    if (filters.aircraft_type) {
      conditions.push(`UPPER(at.model) LIKE UPPER($${++paramCount})`);
      params.push(`%${filters.aircraft_type}%`);
    }

    if (filters.airline_code) {
      conditions.push(`(UPPER(al.iata_code) = UPPER($${++paramCount}) OR UPPER(al.icao_code) = UPPER($${paramCount}))`);
      params.push(filters.airline_code);
    }

    if (filters.manufacturer) {
      conditions.push(`UPPER(at.manufacturer) = UPPER($${++paramCount})`);
      params.push(filters.manufacturer);
    }

    if (filters.status) {
      conditions.push(`a.status = $${++paramCount}`);
      params.push(filters.status);
    }

    if (filters.min_year) {
      conditions.push(`EXTRACT(YEAR FROM a.manufacture_date) >= $${++paramCount}`);
      params.push(filters.min_year);
    }

    if (filters.max_year) {
      conditions.push(`EXTRACT(YEAR FROM a.manufacture_date) <= $${++paramCount}`);
      params.push(filters.max_year);
    }

    // Add limit and offset
    params.push(limit, offset);

    const searchQuery = `
      SELECT
        a.registration,
        a.manufacturer_serial_number,
        a.status,
        a.age_years,
        a.manufacture_date,
        at.manufacturer,
        at.model,
        at.variant,
        at.type_category,
        al.iata_code as airline_iata,
        al.name as airline_name,
        ac.total_seats
      FROM aircraft a
      JOIN aircraft_types at ON a.aircraft_type_id = at.id
      LEFT JOIN airlines al ON a.current_airline_id = al.id
      LEFT JOIN aircraft_configurations ac ON a.id = ac.aircraft_id AND ac.is_current = true
      WHERE ${conditions.join(' AND ')}
      ORDER BY a.registration
      LIMIT $${++paramCount} OFFSET $${++paramCount}
    `;

    const result = await queryPostgres(searchQuery, params);

    const formattedResults = `
**Search Results for "${query}"**
Found ${result.rows.length} aircraft (showing up to ${limit} results)

${
  result.rows.length > 0
    ? result.rows
        .map(
          (ac) =>
            `- ${ac.registration} | ${ac.manufacturer} ${ac.model}${ac.variant ? '-' + ac.variant : ''} | ${ac.airline_name || 'No operator'} | Age: ${ac.age_years?.toFixed(1) || 'N/A'} yrs | ${ac.status}`
        )
        .join('\n')
    : 'No aircraft found matching your criteria.'
}
    `.trim();

    return {
      content: [
        {
          type: 'text',
          text: formattedResults,
        },
      ],
    };
  } catch (error) {
    logger.error('Error searching aircraft:', error);
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

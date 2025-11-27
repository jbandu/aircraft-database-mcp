/**
 * MCP Tool: get_aircraft_type_specs
 * Get technical specifications for aircraft types
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { queryPostgres } from '../../lib/db-clients.js';
import { createLogger } from '../../lib/logger.js';
import { GetAircraftTypeSpecsSchema, safeValidateInput } from '../schemas/tool-schemas.js';
import { Cache, globalCache } from '../../lib/cache.js';
import { checkRateLimit, RateLimitError } from '../../lib/rate-limiter.js';

const logger = createLogger('tool:get-aircraft-type-specs');

export const getAircraftTypeSpecsTool: Tool = {
  name: 'get_aircraft_type_specs',
  description: 'Get technical specifications for aircraft types including performance, capacity, and dimensions',
  inputSchema: {
    type: 'object',
    properties: {
      aircraft_type: {
        type: 'string',
        description: 'Aircraft type (e.g., "737-800", "A320neo")',
      },
      manufacturer: {
        type: 'string',
        description: 'Optional manufacturer filter',
      },
    },
    required: ['aircraft_type'],
  },
};

export async function handleGetAircraftTypeSpecs(args: any) {
  const startTime = Date.now();

  // Rate limiting
  if (!checkRateLimit('get_aircraft_type_specs', 1)) {
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
  const validation = safeValidateInput(GetAircraftTypeSpecsSchema, args);
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

  const { aircraft_type, manufacturer } = validation.data;

  logger.info(`Getting aircraft type specs: ${aircraft_type}`, { manufacturer });

  try {
    // Check cache
    const cacheKey = Cache.generateKey('aircraft_type_specs', { aircraft_type, manufacturer });
    const cached = globalCache.get(cacheKey);

    if (cached) {
      return cached;
    }

    // Build query
    let query = `
      SELECT
        at.id,
        at.manufacturer,
        at.model,
        at.series,
        at.full_name,
        -- Performance
        at.typical_range_km,
        at.max_range_km,
        at.cruising_speed_kmh,
        at.max_speed_kmh,
        at.service_ceiling_m,
        -- Capacity
        at.typical_seat_config,
        at.max_seats,
        at.min_seats,
        at.cargo_capacity_kg,
        -- Dimensions
        at.length_m,
        at.wingspan_m,
        at.height_m,
        -- Weight
        at.max_takeoff_weight_kg,
        at.max_landing_weight_kg,
        at.empty_weight_kg,
        -- Fuel & Engines
        at.fuel_capacity_liters,
        at.engine_type,
        at.engine_count,
        at.typical_fuel_burn_liters_per_hour,
        -- Runway Requirements
        at.min_runway_length_m,
        -- Operational Info
        at.first_flight_date,
        at.production_start_date,
        at.production_end_date,
        at.total_produced,
        at.units_in_service,
        -- Certification
        at.etops_rating,
        at.noise_chapter,
        -- Economics
        at.typical_purchase_price_usd,
        -- Usage stats
        (SELECT COUNT(*) FROM aircraft a WHERE a.aircraft_type_id = at.id AND a.status = 'active') as in_service_count,
        (SELECT COUNT(DISTINCT a.airline_id) FROM aircraft a WHERE a.aircraft_type_id = at.id) as operators_count
      FROM aircraft_types at
      WHERE (
        UPPER(at.model) LIKE UPPER($1)
        OR UPPER(at.full_name) LIKE UPPER($1)
        OR UPPER(at.series) LIKE UPPER($1)
      )
    `;

    const params: any[] = [`%${aircraft_type}%`];

    if (manufacturer) {
      query += ' AND UPPER(at.manufacturer) = UPPER($2)';
      params.push(manufacturer);
    }

    query += ' ORDER BY at.manufacturer, at.model, at.series LIMIT 10';

    const result = await queryPostgres(query, params);

    if (result.rows.length === 0) {
      return {
        content: [
          {
            type: 'text',
            text: `No aircraft type found matching "${aircraft_type}"${manufacturer ? ` from ${manufacturer}` : ''}`,
          },
        ],
      };
    }

    // Format results
    const specs = result.rows.map((row) => {
      const spec = `
**${row.full_name}**

**Basic Information:**
- Manufacturer: ${row.manufacturer}
- Model: ${row.model}${row.series ? `-${row.series}` : ''}
- Engine Type: ${row.engine_type || 'N/A'}
- Engine Count: ${row.engine_count || 'N/A'}

**Performance:**
- Typical Range: ${row.typical_range_km ? `${row.typical_range_km} km` : 'N/A'}
- Maximum Range: ${row.max_range_km ? `${row.max_range_km} km` : 'N/A'}
- Cruising Speed: ${row.cruising_speed_kmh ? `${row.cruising_speed_kmh} km/h` : 'N/A'}
- Max Speed: ${row.max_speed_kmh ? `${row.max_speed_kmh} km/h` : 'N/A'}
- Service Ceiling: ${row.service_ceiling_m ? `${row.service_ceiling_m} m` : 'N/A'}

**Capacity:**
- Typical Seating: ${row.typical_seat_config ? JSON.stringify(row.typical_seat_config) : 'N/A'}
- Max Seats: ${row.max_seats || 'N/A'}
- Min Seats: ${row.min_seats || 'N/A'}
- Cargo Capacity: ${row.cargo_capacity_kg ? `${row.cargo_capacity_kg} kg` : 'N/A'}

**Dimensions:**
- Length: ${row.length_m ? `${row.length_m} m` : 'N/A'}
- Wingspan: ${row.wingspan_m ? `${row.wingspan_m} m` : 'N/A'}
- Height: ${row.height_m ? `${row.height_m} m` : 'N/A'}

**Weight:**
- Max Takeoff: ${row.max_takeoff_weight_kg ? `${row.max_takeoff_weight_kg} kg` : 'N/A'}
- Max Landing: ${row.max_landing_weight_kg ? `${row.max_landing_weight_kg} kg` : 'N/A'}
- Empty Weight: ${row.empty_weight_kg ? `${row.empty_weight_kg} kg` : 'N/A'}

**Fuel & Efficiency:**
- Fuel Capacity: ${row.fuel_capacity_liters ? `${row.fuel_capacity_liters} L` : 'N/A'}
- Typical Fuel Burn: ${row.typical_fuel_burn_liters_per_hour ? `${row.typical_fuel_burn_liters_per_hour} L/h` : 'N/A'}

**Runway Requirements:**
- Minimum Runway Length: ${row.min_runway_length_m ? `${row.min_runway_length_m} m` : 'N/A'}

**Production & Certification:**
- First Flight: ${row.first_flight_date || 'N/A'}
- Production: ${row.production_start_date || 'N/A'} to ${row.production_end_date || 'Ongoing'}
- Total Produced: ${row.total_produced || 'N/A'}
- Currently in Service: ${row.units_in_service || 'N/A'}
- ETOPS Rating: ${row.etops_rating ? `${row.etops_rating} minutes` : 'N/A'}
- Noise Chapter: ${row.noise_chapter || 'N/A'}

**Economics:**
- Typical Purchase Price: ${row.typical_purchase_price_usd ? `$${(row.typical_purchase_price_usd / 1000000).toFixed(1)}M` : 'N/A'}

**Current Usage:**
- Active Aircraft: ${row.in_service_count}
- Number of Operators: ${row.operators_count}
      `.trim();

      return spec;
    });

    const response = {
      content: [
        {
          type: 'text',
          text: `Found ${result.rows.length} matching aircraft type(s):\n\n${specs.join('\n\n---\n\n')}`,
        },
      ],
    };

    // Cache for 1 hour (aircraft type specs rarely change)
    globalCache.set(cacheKey, response, 3600000);

    const duration = Date.now() - startTime;
    logger.info(`Aircraft type specs retrieved in ${duration}ms`);

    return response;
  } catch (error) {
    logger.error('Error getting aircraft type specs:', error);
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

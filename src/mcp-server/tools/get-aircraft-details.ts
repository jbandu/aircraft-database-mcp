/**
 * MCP Tool: get_aircraft_details
 * Get detailed information about a specific aircraft
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { queryPostgres } from '../../lib/db-clients.js';
import { createLogger } from '../../lib/logger.js';

const logger = createLogger('tool:get-aircraft-details');

export const getAircraftDetailsTool: Tool = {
  name: 'get_aircraft_details',
  description: 'Get detailed information about a specific aircraft by registration or serial number',
  inputSchema: {
    type: 'object',
    properties: {
      identifier: {
        type: 'string',
        description: "Aircraft registration (e.g., 'N12345') or manufacturer serial number",
      },
      identifier_type: {
        type: 'string',
        enum: ['registration', 'serial_number'],
        description: 'Type of identifier provided',
      },
    },
    required: ['identifier'],
  },
};

interface GetAircraftDetailsArgs {
  identifier: string;
  identifier_type?: 'registration' | 'serial_number';
}

export async function handleGetAircraftDetails(args: any) {
  const { identifier, identifier_type = 'registration' } = args as GetAircraftDetailsArgs;

  logger.info(`Getting aircraft details: ${identifier} (type: ${identifier_type})`);

  try {
    const query = `
      SELECT
        a.id,
        a.registration,
        a.manufacturer_serial_number,
        a.manufacture_date,
        a.delivery_date,
        a.first_flight_date,
        a.age_years,
        a.status,
        a.engines,
        a.notes,
        at.manufacturer,
        at.model,
        at.variant,
        at.family,
        at.type_category,
        at.engine_type,
        at.engine_count,
        at.max_range,
        al.iata_code as airline_iata,
        al.icao_code as airline_icao,
        al.name as airline_name,
        ac.total_seats,
        ac.class_first,
        ac.class_business,
        ac.class_premium_economy,
        ac.class_economy,
        ac.configuration_name,
        ac.has_wifi,
        ac.has_power_outlets,
        ac.has_entertainment
      FROM aircraft a
      JOIN aircraft_types at ON a.aircraft_type_id = at.id
      LEFT JOIN airlines al ON a.current_airline_id = al.id
      LEFT JOIN aircraft_configurations ac ON a.id = ac.aircraft_id AND ac.is_current = true
      WHERE ${identifier_type === 'registration' ? 'UPPER(a.registration) = UPPER($1)' : 'a.manufacturer_serial_number = $1'}
      LIMIT 1
    `;

    const result = await queryPostgres(query, [identifier]);

    if (result.rows.length === 0) {
      return {
        content: [
          {
            type: 'text',
            text: `Aircraft not found: ${identifier}`,
          },
        ],
        isError: true,
      };
    }

    const aircraft = result.rows[0];

    const details = `
**Aircraft Details: ${aircraft.registration}**

**Basic Information:**
- Registration: ${aircraft.registration}
- Serial Number: ${aircraft.manufacturer_serial_number || 'N/A'}
- Status: ${aircraft.status}
- Age: ${aircraft.age_years?.toFixed(1) || 'N/A'} years

**Aircraft Type:**
- Manufacturer: ${aircraft.manufacturer}
- Model: ${aircraft.model}${aircraft.variant ? '-' + aircraft.variant : ''}
- Family: ${aircraft.family || 'N/A'}
- Category: ${aircraft.type_category}
- Engine Type: ${aircraft.engine_type}
- Engine Count: ${aircraft.engine_count || 'N/A'}

**Current Operator:**
- Airline: ${aircraft.airline_name || 'None'}
- Code: ${aircraft.airline_iata || ''}/${aircraft.airline_icao || ''}

**Dates:**
- Manufactured: ${aircraft.manufacture_date || 'N/A'}
- First Flight: ${aircraft.first_flight_date || 'N/A'}
- Delivered: ${aircraft.delivery_date || 'N/A'}

**Configuration:**
- Total Seats: ${aircraft.total_seats || 'N/A'}
- First Class: ${aircraft.class_first || 0}
- Business: ${aircraft.class_business || 0}
- Premium Economy: ${aircraft.class_premium_economy || 0}
- Economy: ${aircraft.class_economy || 0}
- Configuration: ${aircraft.configuration_name || 'N/A'}

**Amenities:**
- WiFi: ${aircraft.has_wifi ? 'Yes' : 'No'}
- Power Outlets: ${aircraft.has_power_outlets ? 'Yes' : 'No'}
- IFE: ${aircraft.has_entertainment ? 'Yes' : 'No'}

**Performance:**
- Max Range: ${aircraft.max_range ? `${aircraft.max_range} nm` : 'N/A'}

${aircraft.notes ? `\n**Notes:**\n${aircraft.notes}` : ''}
    `.trim();

    return {
      content: [
        {
          type: 'text',
          text: details,
        },
      ],
    };
  } catch (error) {
    logger.error('Error getting aircraft details:', error);
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

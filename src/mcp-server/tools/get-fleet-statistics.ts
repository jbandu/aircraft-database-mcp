/**
 * MCP Tool: get_fleet_statistics
 * Get aggregated statistics about airline fleet or specific aircraft types
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { queryPostgres } from '../../lib/db-clients.js';
import { createLogger } from '../../lib/logger.js';

const logger = createLogger('tool:get-fleet-statistics');

export const getFleetStatisticsTool: Tool = {
  name: 'get_fleet_statistics',
  description: 'Get aggregated statistics about airline fleet, aircraft types, or manufacturers',
  inputSchema: {
    type: 'object',
    properties: {
      scope: {
        type: 'string',
        enum: ['airline', 'aircraft_type', 'manufacturer', 'global'],
        description: 'Scope of statistics to retrieve',
      },
      scope_value: {
        type: 'string',
        description: 'Value for the scope (airline code, aircraft type, or manufacturer name)',
      },
      metrics: {
        type: 'array',
        items: {
          type: 'string',
          enum: [
            'total_count',
            'average_age',
            'status_breakdown',
            'type_distribution',
            'configuration_summary',
            'utilization_stats',
          ],
        },
        description: 'Specific metrics to include in the statistics',
      },
    },
    required: ['scope'],
  },
};

interface GetFleetStatisticsArgs {
  scope: 'airline' | 'aircraft_type' | 'manufacturer' | 'global';
  scope_value?: string;
  metrics?: string[];
}

export async function handleGetFleetStatistics(args: any) {
  const { scope, scope_value, metrics = [] } = args as GetFleetStatisticsArgs;

  logger.info(`Getting fleet statistics: ${scope}`, { scope_value, metrics });

  try {
    let query = '';
    let params: any[] = [];

    switch (scope) {
      case 'airline':
        if (!scope_value) {
          return {
            content: [
              {
                type: 'text',
                text: 'Error: scope_value required for airline scope',
              },
            ],
            isError: true,
          };
        }

        query = `
          SELECT
            al.name as airline_name,
            al.iata_code,
            al.icao_code,
            COUNT(a.id) as total_aircraft,
            COUNT(CASE WHEN a.status = 'active' THEN 1 END) as active_count,
            COUNT(CASE WHEN a.status = 'stored' THEN 1 END) as stored_count,
            COUNT(CASE WHEN a.status = 'retired' THEN 1 END) as retired_count,
            ROUND(AVG(a.age_years), 1) as average_age,
            MIN(a.manufacture_date) as oldest_aircraft,
            MAX(a.manufacture_date) as newest_aircraft,
            SUM(ac.total_seats) as total_seats_capacity
          FROM airlines al
          LEFT JOIN aircraft a ON al.id = a.current_airline_id
          LEFT JOIN aircraft_configurations ac ON a.id = ac.aircraft_id AND ac.is_current = true
          WHERE UPPER(al.iata_code) = UPPER($1) OR UPPER(al.icao_code) = UPPER($1)
          GROUP BY al.id, al.name, al.iata_code, al.icao_code
        `;
        params = [scope_value];
        break;

      case 'aircraft_type':
        if (!scope_value) {
          return {
            content: [
              {
                type: 'text',
                text: 'Error: scope_value required for aircraft_type scope',
              },
            ],
            isError: true,
          };
        }

        query = `
          SELECT
            at.manufacturer,
            at.model,
            at.variant,
            at.type_category,
            COUNT(a.id) as total_aircraft,
            COUNT(CASE WHEN a.status = 'active' THEN 1 END) as active_count,
            ROUND(AVG(a.age_years), 1) as average_age,
            COUNT(DISTINCT a.current_airline_id) as operators_count
          FROM aircraft_types at
          LEFT JOIN aircraft a ON at.id = a.aircraft_type_id
          WHERE UPPER(at.model) LIKE UPPER($1)
          GROUP BY at.id, at.manufacturer, at.model, at.variant, at.type_category
        `;
        params = [`%${scope_value}%`];
        break;

      case 'manufacturer':
        if (!scope_value) {
          return {
            content: [
              {
                type: 'text',
                text: 'Error: scope_value required for manufacturer scope',
              },
            ],
            isError: true,
          };
        }

        query = `
          SELECT
            at.manufacturer,
            at.family,
            COUNT(DISTINCT at.id) as aircraft_types_count,
            COUNT(a.id) as total_aircraft,
            COUNT(CASE WHEN a.status = 'active' THEN 1 END) as active_count,
            ROUND(AVG(a.age_years), 1) as average_age
          FROM aircraft_types at
          LEFT JOIN aircraft a ON at.id = a.aircraft_type_id
          WHERE UPPER(at.manufacturer) = UPPER($1)
          GROUP BY at.manufacturer, at.family
        `;
        params = [scope_value];
        break;

      case 'global':
        query = `
          SELECT
            COUNT(DISTINCT al.id) as total_airlines,
            COUNT(DISTINCT at.id) as total_aircraft_types,
            COUNT(a.id) as total_aircraft,
            COUNT(CASE WHEN a.status = 'active' THEN 1 END) as active_aircraft,
            COUNT(CASE WHEN a.status = 'stored' THEN 1 END) as stored_aircraft,
            COUNT(CASE WHEN a.status = 'retired' THEN 1 END) as retired_aircraft,
            ROUND(AVG(a.age_years), 1) as global_average_age
          FROM airlines al
          CROSS JOIN aircraft_types at
          LEFT JOIN aircraft a ON true
        `;
        break;
    }

    const result = await queryPostgres(query, params);

    if (result.rows.length === 0) {
      return {
        content: [
          {
            type: 'text',
            text: `No statistics found for ${scope}: ${scope_value || 'global'}`,
          },
        ],
      };
    }

    const stats = result.rows[0];
    let formattedStats = `**Fleet Statistics - ${scope.toUpperCase()}**\n\n`;

    if (scope === 'airline') {
      formattedStats += `
**Airline:** ${stats.airline_name} (${stats.iata_code}/${stats.icao_code})

**Fleet Overview:**
- Total Aircraft: ${stats.total_aircraft}
- Active: ${stats.active_count}
- Stored: ${stats.stored_count}
- Retired: ${stats.retired_count}

**Fleet Age:**
- Average Age: ${stats.average_age} years
- Oldest Aircraft: ${stats.oldest_aircraft || 'N/A'}
- Newest Aircraft: ${stats.newest_aircraft || 'N/A'}

**Capacity:**
- Total Seating Capacity: ${stats.total_seats_capacity || 'N/A'} seats
      `.trim();
    } else if (scope === 'aircraft_type') {
      formattedStats += `
**Aircraft Type:** ${stats.manufacturer} ${stats.model}${stats.variant ? '-' + stats.variant : ''}

**Fleet Statistics:**
- Total in Service: ${stats.total_aircraft}
- Active: ${stats.active_count}
- Average Age: ${stats.average_age} years
- Number of Operators: ${stats.operators_count}
      `.trim();
    } else if (scope === 'manufacturer') {
      formattedStats += result.rows
        .map(
          (row) => `
**${row.manufacturer}** - ${row.family || 'Various Models'}
- Aircraft Types: ${row.aircraft_types_count}
- Total Aircraft: ${row.total_aircraft}
- Active: ${row.active_count}
- Average Age: ${row.average_age} years
      `.trim()
        )
        .join('\n\n');
    } else {
      formattedStats += `
**Global Fleet Statistics:**
- Total Airlines: ${stats.total_airlines}
- Aircraft Types: ${stats.total_aircraft_types}
- Total Aircraft: ${stats.total_aircraft}
- Active: ${stats.active_aircraft}
- Stored: ${stats.stored_aircraft}
- Retired: ${stats.retired_aircraft}
- Global Average Age: ${stats.global_average_age} years
      `.trim();
    }

    return {
      content: [
        {
          type: 'text',
          text: formattedStats,
        },
      ],
    };
  } catch (error) {
    logger.error('Error getting fleet statistics:', error);
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

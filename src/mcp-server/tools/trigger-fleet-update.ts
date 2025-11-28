/**
 * MCP Tool: trigger_fleet_update
 * Manually trigger a fleet data update for specific airlines or all airlines
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { queryPostgres } from '../../lib/db-clients.js';
import { createLogger } from '../../lib/logger.js';

const logger = createLogger('tool:trigger-fleet-update');

export const triggerFleetUpdateTool: Tool = {
  name: 'trigger_fleet_update',
  description: 'Manually trigger a fleet data update for specific airlines or all airlines',
  inputSchema: {
    type: 'object',
    properties: {
      airline_codes: {
        type: 'array',
        items: {
          type: 'string',
        },
        description: 'Array of airline codes to update. If empty, updates all airlines',
      },
      force_refresh: {
        type: 'boolean',
        description: 'Force refresh even if recently updated',
        default: false,
      },
      priority: {
        type: 'string',
        enum: ['high', 'normal', 'low'],
        description: 'Priority level for the update job',
        default: 'normal',
      },
    },
  },
};

interface TriggerFleetUpdateArgs {
  airline_codes?: string[];
  force_refresh?: boolean;
  priority?: 'high' | 'normal' | 'low';
}

export async function handleTriggerFleetUpdate(args: any) {
  const { airline_codes = [], force_refresh = false, priority = 'normal' } = args as TriggerFleetUpdateArgs;

  logger.info('Triggering fleet update', { airline_codes, force_refresh, priority });

  try {
    // If no airline codes provided, get all airlines
    let airlinesToUpdate: any[] = [];

    if (airline_codes.length === 0) {
      const allAirlinesQuery = `
        SELECT id, iata_code, icao_code, name, last_scraped_at
        FROM airlines
        WHERE is_active = true
        ORDER BY last_scraped_at ASC NULLS FIRST
        LIMIT 100
      `;
      const result = await queryPostgres(allAirlinesQuery, []);
      airlinesToUpdate = result.rows;
    } else {
      // Get specific airlines
      const placeholders = airline_codes.map((_, i) => `$${i + 1}`).join(',');
      const specificAirlinesQuery = `
        SELECT id, iata_code, icao_code, name, last_scraped_at
        FROM airlines
        WHERE is_active = true
          AND (UPPER(iata_code) IN (${placeholders.split(',').map((p) => `UPPER(${p})`).join(',')})
               OR UPPER(icao_code) IN (${placeholders.split(',').map((p) => `UPPER(${p})`).join(',')}))
      `;
      const result = await queryPostgres(specificAirlinesQuery, airline_codes);
      airlinesToUpdate = result.rows;
    }

    if (airlinesToUpdate.length === 0) {
      return {
        content: [
          {
            type: 'text',
            text: 'No airlines found to update',
          },
        ],
      };
    }

    // Create scraping jobs for each airline
    const jobIds: string[] = [];

    for (const airline of airlinesToUpdate) {
      // Check if should skip based on last scraped time
      if (!force_refresh && airline.last_scraped_at) {
        const hoursSinceLastScrape =
          (Date.now() - new Date(airline.last_scraped_at).getTime()) / (1000 * 60 * 60);

        if (hoursSinceLastScrape < 24) {
          logger.info(`Skipping ${airline.name} - updated ${hoursSinceLastScrape.toFixed(1)} hours ago`);
          continue;
        }
      }

      // Create scraping job
      const createJobQuery = `
        INSERT INTO scrape_jobs (
          airline_id,
          job_type,
          status,
          priority,
          metadata
        )
        VALUES ($1, 'fleet_discovery', 'pending', $2, $3)
        RETURNING id
      `;

      const jobResult = await queryPostgres(createJobQuery, [
        airline.id,
        priority,
        JSON.stringify({
          triggered_manually: true,
          force_refresh,
          triggered_at: new Date().toISOString(),
        }),
      ]);

      jobIds.push(jobResult.rows[0]?.id);
      logger.info(`Created scraping job for ${airline.name}`, { job_id: jobResult.rows[0]?.id });
    }

    const summary = `
**Fleet Update Triggered**

**Summary:**
- Airlines Queued: ${jobIds.length}
- Priority: ${priority}
- Force Refresh: ${force_refresh ? 'Yes' : 'No'}

**Airlines:**
${airlinesToUpdate
  .slice(0, 20)
  .map((al) => `- ${al.name} (${al.iata_code || al.icao_code})`)
  .join('\n')}
${airlinesToUpdate.length > 20 ? `\n... and ${airlinesToUpdate.length - 20} more` : ''}

**Job IDs:**
${jobIds.slice(0, 10).join('\n')}
${jobIds.length > 10 ? `\n... and ${jobIds.length - 10} more` : ''}

**Status:**
Jobs have been queued and will be processed by the scraping workflow.
You can check the status using the scrape_jobs table.

**Note:** The actual scraping process runs asynchronously via the workflow scheduler.
    `.trim();

    return {
      content: [
        {
          type: 'text',
          text: summary,
        },
      ],
    };
  } catch (error) {
    logger.error('Error triggering fleet update:', error);
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

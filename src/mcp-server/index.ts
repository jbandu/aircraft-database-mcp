#!/usr/bin/env node

/**
 * Aircraft Database MCP Server
 *
 * Canonical source of truth for airline fleet data.
 * Exposes MCP tools for querying aircraft and fleet information.
 *
 * @version 1.0.0
 * @author Number Labs
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';
import dotenv from 'dotenv';
import { createLogger } from '../lib/logger.js';
import { initializeDatabases, closeDatabases } from '../lib/db-clients.js';
import { globalCache } from '../lib/cache.js';
import { globalRateLimiter } from '../lib/rate-limiter.js';

// Import MCP tools
import { getAirlineFleetTool, handleGetAirlineFleet } from './tools/get-airline-fleet.js';
import { getAircraftDetailsTool, handleGetAircraftDetails } from './tools/get-aircraft-details.js';
import { searchAircraftTool, handleSearchAircraft } from './tools/search-aircraft.js';
import { getFleetStatisticsTool, handleGetFleetStatistics } from './tools/get-fleet-statistics.js';
import { triggerFleetUpdateTool, handleTriggerFleetUpdate } from './tools/trigger-fleet-update.js';
import { getAircraftTypeSpecsTool, handleGetAircraftTypeSpecs } from './tools/get-aircraft-type-specs.js';
import { getFleetAvailabilityTool, handleGetFleetAvailability } from './tools/get-fleet-availability.js';

// Load environment variables
dotenv.config();

// Initialize logger
const logger = createLogger('mcp-server');

// MCP Server configuration
const SERVER_NAME = process.env['MCP_SERVER_NAME'] || 'aircraft-database';
const SERVER_VERSION = process.env['MCP_SERVER_VERSION'] || '1.0.0';

/**
 * Main MCP Server class
 */
class AircraftDatabaseMCPServer {
  private server: Server;
  private tools: Tool[];

  constructor() {
    // Initialize MCP Server
    this.server = new Server(
      {
        name: SERVER_NAME,
        version: SERVER_VERSION,
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    // Register all tools
    this.tools = [
      getAirlineFleetTool,
      getAircraftDetailsTool,
      searchAircraftTool,
      getFleetStatisticsTool,
      triggerFleetUpdateTool,
      getAircraftTypeSpecsTool,
      getFleetAvailabilityTool,
    ];

    // Set up request handlers
    this.setupHandlers();

    // Error handling
    this.server.onerror = (error) => {
      logger.error('MCP Server error:', error);
    };

    process.on('SIGINT', async () => {
      logger.info('Received SIGINT, shutting down gracefully...');
      await this.shutdown();
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      logger.info('Received SIGTERM, shutting down gracefully...');
      await this.shutdown();
      process.exit(0);
    });
  }

  /**
   * Set up MCP request handlers
   */
  private setupHandlers(): void {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      logger.debug('Received list_tools request');
      return {
        tools: this.tools,
      };
    });

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;
      logger.info(`Received tool call: ${name}`, { args });

      try {
        switch (name) {
          case 'get_airline_fleet':
            return await handleGetAirlineFleet(args);

          case 'get_aircraft_details':
            return await handleGetAircraftDetails(args);

          case 'search_aircraft':
            return await handleSearchAircraft(args);

          case 'get_fleet_statistics':
            return await handleGetFleetStatistics(args);

          case 'trigger_fleet_update':
            return await handleTriggerFleetUpdate(args);

          case 'get_aircraft_type_specs':
            return await handleGetAircraftTypeSpecs(args);

          case 'get_fleet_availability':
            return await handleGetFleetAvailability(args);

          default:
            logger.error(`Unknown tool: ${name}`);
            return {
              content: [
                {
                  type: 'text',
                  text: `Error: Unknown tool '${name}'`,
                },
              ],
              isError: true,
            };
        }
      } catch (error) {
        logger.error(`Error executing tool ${name}:`, error);
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
    });
  }

  /**
   * Initialize the server and connect to databases
   */
  async initialize(): Promise<void> {
    logger.info(`Initializing ${SERVER_NAME} v${SERVER_VERSION}...`);

    try {
      // Initialize database connections
      await initializeDatabases();
      logger.info('Database connections established');

      // Log cache and rate limiter status
      logger.info(`Cache initialized (size: ${globalCache.size()})`);
      logger.info(`Rate limiter initialized (${JSON.stringify(globalRateLimiter.getStats())})`);

      logger.info('MCP Server initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize MCP Server:', error);
      throw error;
    }
  }

  /**
   * Start the MCP server
   */
  async start(): Promise<void> {
    await this.initialize();

    logger.info('Starting MCP Server with stdio transport...');

    // Create stdio transport
    const transport = new StdioServerTransport();

    // Connect server to transport
    await this.server.connect(transport);

    logger.info(`${SERVER_NAME} v${SERVER_VERSION} is running`);
    logger.info(`Available tools: ${this.tools.map(t => t.name).join(', ')}`);
    logger.info('Waiting for tool requests...');
  }

  /**
   * Gracefully shutdown the server
   */
  async shutdown(): Promise<void> {
    logger.info('Shutting down MCP Server...');

    try {
      // Clear cache
      globalCache.clear();

      // Clear rate limiter
      globalRateLimiter.clear();

      // Close database connections
      await closeDatabases();

      // Close MCP server
      await this.server.close();

      logger.info('MCP Server shut down successfully');
    } catch (error) {
      logger.error('Error during shutdown:', error);
      throw error;
    }
  }
}

/**
 * Main entry point
 */
async function main(): Promise<void> {
  try {
    const server = new AircraftDatabaseMCPServer();
    await server.start();
  } catch (error) {
    logger.error('Fatal error:', error);
    process.exit(1);
  }
}

// Start the server
main();

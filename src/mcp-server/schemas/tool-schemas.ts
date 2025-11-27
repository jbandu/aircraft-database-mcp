/**
 * Zod Schemas for MCP Tool Input Validation
 */

import { z } from 'zod';

/**
 * get-airline-fleet schema
 */
export const GetAirlineFleetSchema = z.object({
  airline_code: z.string().min(2).max(4).describe('IATA or ICAO airline code (e.g., "UA", "AAL")'),
  include_details: z.boolean().default(false).describe('Include detailed aircraft specifications'),
  status_filter: z
    .enum(['active', 'stored', 'maintenance', 'retired', 'all'])
    .default('active')
    .describe('Filter by aircraft status'),
});

export type GetAirlineFleetInput = z.infer<typeof GetAirlineFleetSchema>;

/**
 * get-aircraft-details schema
 */
export const GetAircraftDetailsSchema = z.object({
  registration: z.string().min(3).max(20).describe('Aircraft registration/tail number (e.g., "N12345")'),
  include_history: z
    .boolean()
    .default(false)
    .describe('Include ownership and operational history'),
});

export type GetAircraftDetailsInput = z.infer<typeof GetAircraftDetailsSchema>;

/**
 * search-aircraft schema
 */
export const SearchAircraftSchema = z.object({
  manufacturer: z.string().optional().describe('Filter by manufacturer (Boeing, Airbus, etc.)'),
  aircraft_type: z.string().optional().describe('Filter by aircraft type (737-800, A320neo, etc.)'),
  airline_code: z.string().optional().describe('Filter by airline IATA/ICAO code'),
  status: z
    .enum(['active', 'stored', 'maintenance', 'retired'])
    .optional()
    .describe('Filter by operational status'),
  min_seats: z.number().int().positive().optional().describe('Minimum seat count'),
  max_seats: z.number().int().positive().optional().describe('Maximum seat count'),
  home_base: z.string().optional().describe('Filter by home base airport code'),
  limit: z.number().int().positive().max(500).default(50).describe('Maximum results to return'),
});

export type SearchAircraftInput = z.infer<typeof SearchAircraftSchema>;

/**
 * get-fleet-statistics schema
 */
export const GetFleetStatisticsSchema = z.object({
  airline_code: z.string().optional().describe('IATA/ICAO code (omit for global statistics)'),
  group_by: z
    .enum(['manufacturer', 'aircraft_type', 'status', 'age_bracket'])
    .default('aircraft_type')
    .describe('How to group statistics'),
});

export type GetFleetStatisticsInput = z.infer<typeof GetFleetStatisticsSchema>;

/**
 * trigger-fleet-update schema
 */
export const TriggerFleetUpdateSchema = z.object({
  airline_code: z.string().min(2).max(4).describe('IATA/ICAO airline code to update'),
  priority: z.enum(['low', 'normal', 'high']).default('normal').describe('Update priority'),
  force_full_scrape: z
    .boolean()
    .default(false)
    .describe('Force complete re-scrape even if recently updated'),
});

export type TriggerFleetUpdateInput = z.infer<typeof TriggerFleetUpdateSchema>;

/**
 * get-aircraft-type-specs schema
 */
export const GetAircraftTypeSpecsSchema = z.object({
  aircraft_type: z.string().describe('Aircraft type (e.g., "737-800", "A320neo")'),
  manufacturer: z.string().optional().describe('Optional manufacturer filter'),
});

export type GetAircraftTypeSpecsInput = z.infer<typeof GetAircraftTypeSpecsSchema>;

/**
 * get-fleet-availability schema
 */
export const GetFleetAvailabilitySchema = z.object({
  airline_code: z.string().min(2).max(4).describe('IATA/ICAO airline code'),
  aircraft_types: z.array(z.string()).optional().describe('Filter by specific aircraft types'),
  home_base: z.string().optional().describe('Filter by home base airport'),
  exclude_maintenance: z
    .boolean()
    .default(true)
    .describe('Exclude aircraft in maintenance'),
});

export type GetFleetAvailabilityInput = z.infer<typeof GetFleetAvailabilitySchema>;

/**
 * Validation helper function
 */
export function validateInput<T>(schema: z.ZodSchema<T>, input: unknown): T {
  return schema.parse(input);
}

/**
 * Safe validation with error handling
 */
export function safeValidateInput<T>(
  schema: z.ZodSchema<T>,
  input: unknown
): { success: true; data: T } | { success: false; error: string } {
  const result = schema.safeParse(input);

  if (result.success) {
    return { success: true, data: result.data };
  } else {
    const errors = result.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join(', ');
    return { success: false, error: errors };
  }
}

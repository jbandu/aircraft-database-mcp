/**
 * Test Utilities
 *
 * Helper functions for testing MCP tools:
 * - Assertions
 * - Mock data helpers
 * - Test fixtures
 * - Database helpers
 */

import { queryPostgres } from '../src/lib/db-clients.js';

/**
 * Test assertion error
 */
export class AssertionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AssertionError';
  }
}

/**
 * Assert that a condition is true
 */
export function assert(condition: any, message: string): void {
  if (!condition) {
    throw new AssertionError(message);
  }
}

/**
 * Assert equality
 */
export function assertEqual<T>(actual: T, expected: T, message?: string): void {
  if (actual !== expected) {
    throw new AssertionError(
      message || `Expected ${expected}, but got ${actual}`
    );
  }
}

/**
 * Assert deep equality
 */
export function assertDeepEqual(actual: any, expected: any, message?: string): void {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new AssertionError(
      message ||
        `Expected ${JSON.stringify(expected)}, but got ${JSON.stringify(actual)}`
    );
  }
}

/**
 * Assert that value is truthy
 */
export function assertTruthy(value: any, message?: string): void {
  if (!value) {
    throw new AssertionError(message || `Expected truthy value, but got ${value}`);
  }
}

/**
 * Assert that value is falsy
 */
export function assertFalsy(value: any, message?: string): void {
  if (value) {
    throw new AssertionError(message || `Expected falsy value, but got ${value}`);
  }
}

/**
 * Assert that array includes value
 */
export function assertIncludes<T>(array: T[], value: T, message?: string): void {
  if (!array.includes(value)) {
    throw new AssertionError(
      message || `Expected array to include ${value}`
    );
  }
}

/**
 * Assert that string contains substring
 */
export function assertContains(str: string, substr: string, message?: string): void {
  if (!str.includes(substr)) {
    throw new AssertionError(
      message || `Expected string to contain "${substr}"`
    );
  }
}

/**
 * Assert that function throws error
 */
export async function assertThrows(
  fn: () => Promise<any>,
  message?: string
): Promise<void> {
  try {
    await fn();
    throw new AssertionError(message || 'Expected function to throw error');
  } catch (error) {
    // Expected to throw
    if (error instanceof AssertionError) {
      throw error;
    }
  }
}

/**
 * Assert that value is within range
 */
export function assertRange(
  value: number,
  min: number,
  max: number,
  message?: string
): void {
  if (value < min || value > max) {
    throw new AssertionError(
      message || `Expected ${value} to be between ${min} and ${max}`
    );
  }
}

/**
 * Mock MCP tool response
 */
export interface MockToolResponse {
  content: Array<{ type: string; text: string }>;
  isError?: boolean;
}

/**
 * Create mock success response
 */
export function mockSuccess(data: any): MockToolResponse {
  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(data, null, 2),
      },
    ],
  };
}

/**
 * Create mock error response
 */
export function mockError(message: string): MockToolResponse {
  return {
    content: [
      {
        type: 'text',
        text: `Error: ${message}`,
      },
    ],
    isError: true,
  };
}

/**
 * Parse MCP tool response
 */
export function parseToolResponse(response: MockToolResponse): any {
  if (response.isError) {
    throw new Error(response.content[0].text);
  }

  try {
    return JSON.parse(response.content[0].text);
  } catch {
    return response.content[0].text;
  }
}

/**
 * Database test helpers
 */
export class DatabaseTestHelper {
  /**
   * Check if airline exists
   */
  static async airlineExists(code: string): Promise<boolean> {
    const query = `
      SELECT id FROM airlines
      WHERE UPPER(iata_code) = UPPER($1) OR UPPER(icao_code) = UPPER($1)
      LIMIT 1
    `;
    const result = await queryPostgres(query, [code]);
    return result.rows.length > 0;
  }

  /**
   * Check if aircraft exists
   */
  static async aircraftExists(registration: string): Promise<boolean> {
    const query = `
      SELECT id FROM aircraft
      WHERE UPPER(registration) = UPPER($1)
      LIMIT 1
    `;
    const result = await queryPostgres(query, [registration]);
    return result.rows.length > 0;
  }

  /**
   * Get airline fleet count
   */
  static async getFleetCount(airlineCode: string): Promise<number> {
    const query = `
      SELECT COUNT(*) as count
      FROM aircraft a
      JOIN airlines al ON a.airline_id = al.id
      WHERE UPPER(al.iata_code) = UPPER($1) OR UPPER(al.icao_code) = UPPER($1)
    `;
    const result = await queryPostgres(query, [airlineCode]);
    return parseInt(result.rows[0].count) || 0;
  }

  /**
   * Get aircraft type count
   */
  static async getAircraftTypeCount(aircraftType: string): Promise<number> {
    const query = `
      SELECT COUNT(*) as count
      FROM aircraft a
      JOIN aircraft_types at ON a.aircraft_type_id = at.id
      WHERE at.iata_code = $1 OR at.icao_code = $1
    `;
    const result = await queryPostgres(query, [aircraftType]);
    return parseInt(result.rows[0].count) || 0;
  }

  /**
   * Get pending job count
   */
  static async getPendingJobCount(): Promise<number> {
    const query = `SELECT COUNT(*) as count FROM scraping_jobs WHERE status = 'pending'`;
    const result = await queryPostgres(query);
    return parseInt(result.rows[0].count) || 0;
  }

  /**
   * Get latest job for airline
   */
  static async getLatestJob(airlineCode: string): Promise<any | null> {
    const query = `
      SELECT sj.*
      FROM scraping_jobs sj
      JOIN airlines al ON sj.airline_id = al.id
      WHERE UPPER(al.iata_code) = UPPER($1) OR UPPER(al.icao_code) = UPPER($1)
      ORDER BY sj.created_at DESC
      LIMIT 1
    `;
    const result = await queryPostgres(query, [airlineCode]);
    return result.rows[0] || null;
  }

  /**
   * Clear test jobs
   */
  static async clearTestJobs(): Promise<void> {
    const query = `
      DELETE FROM scraping_jobs
      WHERE airline_id IN (
        SELECT id FROM airlines WHERE iata_code LIKE 'T%'
      )
    `;
    await queryPostgres(query);
  }
}

/**
 * Performance test helper
 */
export class PerformanceTimer {
  private startTime: number = 0;
  private endTime: number = 0;

  start(): void {
    this.startTime = Date.now();
  }

  stop(): number {
    this.endTime = Date.now();
    return this.duration();
  }

  duration(): number {
    return this.endTime - this.startTime;
  }

  static async measure(fn: () => Promise<void>): Promise<number> {
    const timer = new PerformanceTimer();
    timer.start();
    await fn();
    return timer.stop();
  }
}

/**
 * Test data fixtures
 */
export const TestFixtures = {
  /**
   * Valid airline codes
   */
  validAirlineCodes: ['AA', 'DL', 'UA', 'WN', 'BA', 'LH', 'AF', 'QF'],

  /**
   * Invalid airline codes
   */
  invalidAirlineCodes: [
    'INVALID',
    'XXX',
    '!!!',
    '',
    'A'.repeat(100),
    '<script>',
    "'; DROP TABLE airlines; --",
  ],

  /**
   * Valid aircraft types
   */
  validAircraftTypes: ['737', '777', '787', 'A320', 'A350', 'A380'],

  /**
   * Invalid aircraft types
   */
  invalidAircraftTypes: ['INVALID999', 'XXX', '!!!', ''],

  /**
   * Valid registrations
   */
  validRegistrations: ['N12345', 'G-ABCD', 'D-ABCD', 'VH-ABC'],

  /**
   * Invalid registrations
   */
  invalidRegistrations: ['INVALID', '!!!', '', '123', 'TOOLONG123456789'],

  /**
   * Valid status filters
   */
  validStatuses: ['active', 'stored', 'maintenance', 'retired', 'all'],

  /**
   * Valid priorities
   */
  validPriorities: ['low', 'normal', 'high'],
};

/**
 * Retry helper for flaky tests
 */
export async function retry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  delay: number = 1000
): Promise<T> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === maxRetries - 1) {
        throw error;
      }
      await sleep(delay);
    }
  }
  throw new Error('Should not reach here');
}

/**
 * Sleep helper
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Generate random test data
 */
export const RandomData = {
  /**
   * Generate random airline code
   */
  airlineCode(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    return chars[Math.floor(Math.random() * chars.length)] +
           chars[Math.floor(Math.random() * chars.length)];
  },

  /**
   * Generate random registration
   */
  registration(): string {
    const nums = '0123456789';
    let reg = 'N';
    for (let i = 0; i < 5; i++) {
      reg += nums[Math.floor(Math.random() * nums.length)];
    }
    return reg;
  },

  /**
   * Generate random integer
   */
  integer(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  },

  /**
   * Generate random boolean
   */
  boolean(): boolean {
    return Math.random() > 0.5;
  },
};

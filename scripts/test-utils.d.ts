/**
 * Test Utilities
 *
 * Helper functions for testing MCP tools:
 * - Assertions
 * - Mock data helpers
 * - Test fixtures
 * - Database helpers
 */
/**
 * Test assertion error
 */
export declare class AssertionError extends Error {
    constructor(message: string);
}
/**
 * Assert that a condition is true
 */
export declare function assert(condition: any, message: string): void;
/**
 * Assert equality
 */
export declare function assertEqual<T>(actual: T, expected: T, message?: string): void;
/**
 * Assert deep equality
 */
export declare function assertDeepEqual(actual: any, expected: any, message?: string): void;
/**
 * Assert that value is truthy
 */
export declare function assertTruthy(value: any, message?: string): void;
/**
 * Assert that value is falsy
 */
export declare function assertFalsy(value: any, message?: string): void;
/**
 * Assert that array includes value
 */
export declare function assertIncludes<T>(array: T[], value: T, message?: string): void;
/**
 * Assert that string contains substring
 */
export declare function assertContains(str: string, substr: string, message?: string): void;
/**
 * Assert that function throws error
 */
export declare function assertThrows(fn: () => Promise<any>, message?: string): Promise<void>;
/**
 * Assert that value is within range
 */
export declare function assertRange(value: number, min: number, max: number, message?: string): void;
/**
 * Mock MCP tool response
 */
export interface MockToolResponse {
    content: Array<{
        type: string;
        text: string;
    }>;
    isError?: boolean;
}
/**
 * Create mock success response
 */
export declare function mockSuccess(data: any): MockToolResponse;
/**
 * Create mock error response
 */
export declare function mockError(message: string): MockToolResponse;
/**
 * Parse MCP tool response
 */
export declare function parseToolResponse(response: MockToolResponse): any;
/**
 * Database test helpers
 */
export declare class DatabaseTestHelper {
    /**
     * Check if airline exists
     */
    static airlineExists(code: string): Promise<boolean>;
    /**
     * Check if aircraft exists
     */
    static aircraftExists(registration: string): Promise<boolean>;
    /**
     * Get airline fleet count
     */
    static getFleetCount(airlineCode: string): Promise<number>;
    /**
     * Get aircraft type count
     */
    static getAircraftTypeCount(aircraftType: string): Promise<number>;
    /**
     * Get pending job count
     */
    static getPendingJobCount(): Promise<number>;
    /**
     * Get latest job for airline
     */
    static getLatestJob(airlineCode: string): Promise<any | null>;
    /**
     * Clear test jobs
     */
    static clearTestJobs(): Promise<void>;
}
/**
 * Performance test helper
 */
export declare class PerformanceTimer {
    private startTime;
    private endTime;
    start(): void;
    stop(): number;
    duration(): number;
    static measure(fn: () => Promise<void>): Promise<number>;
}
/**
 * Test data fixtures
 */
export declare const TestFixtures: {
    /**
     * Valid airline codes
     */
    validAirlineCodes: string[];
    /**
     * Invalid airline codes
     */
    invalidAirlineCodes: string[];
    /**
     * Valid aircraft types
     */
    validAircraftTypes: string[];
    /**
     * Invalid aircraft types
     */
    invalidAircraftTypes: string[];
    /**
     * Valid registrations
     */
    validRegistrations: string[];
    /**
     * Invalid registrations
     */
    invalidRegistrations: string[];
    /**
     * Valid status filters
     */
    validStatuses: string[];
    /**
     * Valid priorities
     */
    validPriorities: string[];
};
/**
 * Retry helper for flaky tests
 */
export declare function retry<T>(fn: () => Promise<T>, maxRetries?: number, delay?: number): Promise<T>;
/**
 * Sleep helper
 */
export declare function sleep(ms: number): Promise<void>;
/**
 * Generate random test data
 */
export declare const RandomData: {
    /**
     * Generate random airline code
     */
    airlineCode(): string;
    /**
     * Generate random registration
     */
    registration(): string;
    /**
     * Generate random integer
     */
    integer(min: number, max: number): number;
    /**
     * Generate random boolean
     */
    boolean(): boolean;
};
//# sourceMappingURL=test-utils.d.ts.map
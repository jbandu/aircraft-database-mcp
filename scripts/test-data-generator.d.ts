/**
 * Test Data Generator
 *
 * Generates realistic mock data for testing MCP tools:
 * - Mock airlines
 * - Mock aircraft
 * - Mock fleet data
 * - Mock scraping jobs
 */
export declare class TestDataGenerator {
    /**
     * Generate complete test dataset
     */
    generateTestData(options?: {
        clean?: boolean;
    }): Promise<void>;
    /**
     * Clean existing test data
     */
    cleanTestData(): Promise<void>;
    /**
     * Generate test airlines
     */
    private generateTestAirlines;
    /**
     * Generate test aircraft
     */
    private generateTestAircraft;
    /**
     * Generate test scraping jobs
     */
    private generateTestJobs;
    /**
     * Generate registration number
     */
    private generateRegistration;
    /**
     * Generate MSN (Manufacturer Serial Number)
     */
    private generateMSN;
    /**
     * Generate seat configuration
     */
    private generateSeatConfiguration;
    /**
     * Generate delivery date
     */
    private generateDeliveryDate;
    /**
     * Generate location
     */
    private generateLocation;
    /**
     * Generate home base
     */
    private generateHomeBase;
    /**
     * Get test data statistics
     */
    getStatistics(): Promise<void>;
}
//# sourceMappingURL=test-data-generator.d.ts.map
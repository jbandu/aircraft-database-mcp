/**
 * MCP Tool Testing Suite
 *
 * Comprehensive tests for all MCP tools:
 * - Unit tests for each tool
 * - Integration tests for workflows
 * - Performance benchmarks
 * - Error scenario coverage
 * - Edge case handling
 */
import { createLogger } from '../src/lib/logger.js';
import { queryPostgres } from '../src/lib/db-clients.js';
import { handleGetAirlineFleet } from '../src/mcp-server/tools/get-airline-fleet.js';
import { handleGetAircraftDetails } from '../src/mcp-server/tools/get-aircraft-details.js';
import { handleSearchAircraft } from '../src/mcp-server/tools/search-aircraft.js';
import { handleGetFleetStatistics } from '../src/mcp-server/tools/get-fleet-statistics.js';
import { handleTriggerFleetUpdate } from '../src/mcp-server/tools/trigger-fleet-update.js';
import { handleGetAircraftTypeSpecs } from '../src/mcp-server/tools/get-aircraft-type-specs.js';
import { handleGetFleetAvailability } from '../src/mcp-server/tools/get-fleet-availability.js';
const logger = createLogger('mcp-test');
class TestSuite {
    results = [];
    startTime = 0;
    async run() {
        console.log('\n╔═══════════════════════════════════════════════════════════════════╗');
        console.log('║              MCP Tool Testing Suite - Starting Tests              ║');
        console.log('╚═══════════════════════════════════════════════════════════════════╝\n');
        // Ensure test data exists
        await this.setupTestData();
        // Run all test suites
        await this.runUnitTests();
        await this.runIntegrationTests();
        await this.runPerformanceTests();
        await this.runErrorScenarioTests();
        // Print summary
        this.printSummary();
    }
    /**
     * Set up test data in database
     */
    async setupTestData() {
        console.log('🔧 Setting up test data...\n');
        try {
            // Check if test airline exists
            const checkQuery = `SELECT id FROM airlines WHERE iata_code = 'TS' LIMIT 1`;
            const result = await queryPostgres(checkQuery);
            if (result.rows.length === 0) {
                // Insert test airline
                const insertQuery = `
          INSERT INTO airlines (iata_code, icao_code, name, country, website_url, scrape_enabled)
          VALUES ('TS', 'TST', 'Test Airlines', 'United States', 'https://test.airline', true)
          ON CONFLICT (iata_code) DO NOTHING
        `;
                await queryPostgres(insertQuery);
                console.log('✓ Test airline created\n');
            }
            else {
                console.log('✓ Test airline already exists\n');
            }
        }
        catch (error) {
            console.error('Failed to set up test data:', error);
        }
    }
    /**
     * Run unit tests for each MCP tool
     */
    async runUnitTests() {
        console.log('═══════════════════════════════════════════════════════════════════');
        console.log('  UNIT TESTS');
        console.log('═══════════════════════════════════════════════════════════════════\n');
        await this.testGetAirlineFleet();
        await this.testGetAircraftDetails();
        await this.testSearchAircraft();
        await this.testGetFleetStatistics();
        await this.testTriggerFleetUpdate();
        await this.testGetAircraftTypeSpecs();
        await this.testGetFleetAvailability();
    }
    /**
     * Test get-airline-fleet tool
     */
    async testGetAirlineFleet() {
        console.log('📋 Testing get-airline-fleet\n');
        // Test 1: Basic retrieval
        await this.runTest('get-airline-fleet: Basic retrieval', async () => {
            const result = await handleGetAirlineFleet({ airline_code: 'AA' });
            this.assert(result.content, 'Should return content');
            this.assert(!result.isError, 'Should not be an error');
        });
        // Test 2: With include_details flag
        await this.runTest('get-airline-fleet: With details', async () => {
            const result = await handleGetAirlineFleet({
                airline_code: 'DL',
                include_details: true,
            });
            this.assert(result.content, 'Should return content with details');
        });
        // Test 3: Status filter - active
        await this.runTest('get-airline-fleet: Status filter (active)', async () => {
            const result = await handleGetAirlineFleet({
                airline_code: 'UA',
                status_filter: 'active',
            });
            this.assert(result.content, 'Should return active aircraft');
        });
        // Test 4: Status filter - all
        await this.runTest('get-airline-fleet: Status filter (all)', async () => {
            const result = await handleGetAirlineFleet({
                airline_code: 'UA',
                status_filter: 'all',
            });
            this.assert(result.content, 'Should return all aircraft');
        });
        // Test 5: Invalid airline code
        await this.runTest('get-airline-fleet: Invalid airline', async () => {
            const result = await handleGetAirlineFleet({ airline_code: 'INVALID' });
            this.assert(result.isError, 'Should return error for invalid airline');
        });
        // Test 6: Missing airline_code
        await this.runTest('get-airline-fleet: Missing airline_code', async () => {
            const result = await handleGetAirlineFleet({});
            this.assert(result.isError, 'Should return error for missing airline_code');
        });
        console.log();
    }
    /**
     * Test get-aircraft-details tool
     */
    async testGetAircraftDetails() {
        console.log('✈️  Testing get-aircraft-details\n');
        // Test 1: Valid registration
        await this.runTest('get-aircraft-details: Valid registration', async () => {
            // First get a real registration from database
            const airQuery = `SELECT registration FROM aircraft LIMIT 1`;
            const airResult = await queryPostgres(airQuery);
            if (airResult.rows.length > 0) {
                const registration = airResult.rows[0].registration;
                const result = await handleGetAircraftDetails({ registration });
                this.assert(result.content, 'Should return aircraft details');
                this.assert(!result.isError, 'Should not be an error');
            }
            else {
                console.log('  ⚠ Skipped: No aircraft in database');
            }
        });
        // Test 2: Invalid registration
        await this.runTest('get-aircraft-details: Invalid registration', async () => {
            const result = await handleGetAircraftDetails({ registration: 'INVALID123' });
            this.assert(result.isError, 'Should return error for invalid registration');
        });
        // Test 3: Missing registration
        await this.runTest('get-aircraft-details: Missing registration', async () => {
            const result = await handleGetAircraftDetails({});
            this.assert(result.isError, 'Should return error for missing registration');
        });
        console.log();
    }
    /**
     * Test search-aircraft tool
     */
    async testSearchAircraft() {
        console.log('🔍 Testing search-aircraft\n');
        // Test 1: Search by aircraft type
        await this.runTest('search-aircraft: By aircraft type', async () => {
            const result = await handleSearchAircraft({
                filters: { aircraft_type: '737' },
            });
            this.assert(result.content, 'Should return search results');
            this.assert(!result.isError, 'Should not be an error');
        });
        // Test 2: Search by airline
        await this.runTest('search-aircraft: By airline', async () => {
            const result = await handleSearchAircraft({
                filters: { airline_code: 'AA' },
            });
            this.assert(result.content, 'Should return airline aircraft');
        });
        // Test 3: Search with multiple filters
        await this.runTest('search-aircraft: Multiple filters', async () => {
            const result = await handleSearchAircraft({
                filters: {
                    airline_code: 'DL',
                    aircraft_type: '777',
                    status: 'active',
                },
            });
            this.assert(result.content, 'Should return filtered results');
        });
        // Test 4: Search with pagination
        await this.runTest('search-aircraft: With pagination', async () => {
            const result = await handleSearchAircraft({
                filters: { aircraft_type: '737' },
                limit: 10,
                offset: 0,
            });
            this.assert(result.content, 'Should return paginated results');
        });
        // Test 5: Empty filters
        await this.runTest('search-aircraft: Empty filters', async () => {
            const result = await handleSearchAircraft({ filters: {} });
            this.assert(result.content, 'Should return all aircraft (with default limit)');
        });
        console.log();
    }
    /**
     * Test get-fleet-statistics tool
     */
    async testGetFleetStatistics() {
        console.log('📊 Testing get-fleet-statistics\n');
        // Test 1: Single airline statistics
        await this.runTest('get-fleet-statistics: Single airline', async () => {
            const result = await handleGetFleetStatistics({ airline_code: 'UA' });
            this.assert(result.content, 'Should return statistics');
            this.assert(!result.isError, 'Should not be an error');
        });
        // Test 2: Global statistics
        await this.runTest('get-fleet-statistics: Global stats', async () => {
            const result = await handleGetFleetStatistics({});
            this.assert(result.content, 'Should return global statistics');
            this.assert(!result.isError, 'Should not be an error');
        });
        // Test 3: Invalid airline
        await this.runTest('get-fleet-statistics: Invalid airline', async () => {
            const result = await handleGetFleetStatistics({ airline_code: 'INVALID' });
            this.assert(result.isError, 'Should return error for invalid airline');
        });
        console.log();
    }
    /**
     * Test trigger-fleet-update tool
     */
    async testTriggerFleetUpdate() {
        console.log('🔄 Testing trigger-fleet-update\n');
        // Test 1: Trigger update for valid airline
        await this.runTest('trigger-fleet-update: Valid airline', async () => {
            const result = await handleTriggerFleetUpdate({ airline_code: 'TS' });
            this.assert(result.content, 'Should trigger update');
            this.assert(!result.isError, 'Should not be an error');
        });
        // Test 2: Force update
        await this.runTest('trigger-fleet-update: Force update', async () => {
            const result = await handleTriggerFleetUpdate({
                airline_code: 'TS',
                force: true,
            });
            this.assert(result.content, 'Should force update');
        });
        // Test 3: High priority
        await this.runTest('trigger-fleet-update: High priority', async () => {
            const result = await handleTriggerFleetUpdate({
                airline_code: 'TS',
                priority: 'high',
            });
            this.assert(result.content, 'Should create high priority job');
        });
        // Test 4: Invalid airline
        await this.runTest('trigger-fleet-update: Invalid airline', async () => {
            const result = await handleTriggerFleetUpdate({ airline_code: 'INVALID' });
            this.assert(result.isError, 'Should return error for invalid airline');
        });
        console.log();
    }
    /**
     * Test get-aircraft-type-specs tool
     */
    async testGetAircraftTypeSpecs() {
        console.log('📐 Testing get-aircraft-type-specs\n');
        // Test 1: Valid aircraft type
        await this.runTest('get-aircraft-type-specs: Valid type (737)', async () => {
            const result = await handleGetAircraftTypeSpecs({ aircraft_type: '737' });
            this.assert(result.content, 'Should return specifications');
            this.assert(!result.isError, 'Should not be an error');
        });
        // Test 2: Another valid type
        await this.runTest('get-aircraft-type-specs: Valid type (A320)', async () => {
            const result = await handleGetAircraftTypeSpecs({ aircraft_type: 'A320' });
            this.assert(result.content, 'Should return A320 specifications');
        });
        // Test 3: All types (no filter)
        await this.runTest('get-aircraft-type-specs: All types', async () => {
            const result = await handleGetAircraftTypeSpecs({});
            this.assert(result.content, 'Should return all aircraft types');
        });
        // Test 4: Invalid type
        await this.runTest('get-aircraft-type-specs: Invalid type', async () => {
            const result = await handleGetAircraftTypeSpecs({
                aircraft_type: 'INVALID999',
            });
            this.assert(result.isError, 'Should return error for invalid type');
        });
        console.log();
    }
    /**
     * Test get-fleet-availability tool
     */
    async testGetFleetAvailability() {
        console.log('🛫 Testing get-fleet-availability\n');
        // Test 1: Airline availability
        await this.runTest('get-fleet-availability: By airline', async () => {
            const result = await handleGetFleetAvailability({ airline_code: 'UA' });
            this.assert(result.content, 'Should return availability data');
            this.assert(!result.isError, 'Should not be an error');
        });
        // Test 2: Aircraft type filter
        await this.runTest('get-fleet-availability: By aircraft type', async () => {
            const result = await handleGetFleetAvailability({
                airline_code: 'DL',
                aircraft_type: '737',
            });
            this.assert(result.content, 'Should return filtered availability');
        });
        // Test 3: Home base filter
        await this.runTest('get-fleet-availability: By home base', async () => {
            const result = await handleGetFleetAvailability({
                airline_code: 'AA',
                home_base: 'KDFW',
            });
            this.assert(result.content, 'Should return base-specific availability');
        });
        // Test 4: Invalid airline
        await this.runTest('get-fleet-availability: Invalid airline', async () => {
            const result = await handleGetFleetAvailability({ airline_code: 'INVALID' });
            this.assert(result.isError, 'Should return error for invalid airline');
        });
        console.log();
    }
    /**
     * Run integration tests
     */
    async runIntegrationTests() {
        console.log('═══════════════════════════════════════════════════════════════════');
        console.log('  INTEGRATION TESTS');
        console.log('═══════════════════════════════════════════════════════════════════\n');
        // Test 1: Fleet workflow
        await this.runTest('Integration: Complete fleet workflow', async () => {
            // Step 1: Get fleet
            const fleet = await handleGetAirlineFleet({ airline_code: 'UA' });
            this.assert(!fleet.isError, 'Should get fleet successfully');
            // Step 2: Get statistics
            const stats = await handleGetFleetStatistics({ airline_code: 'UA' });
            this.assert(!stats.isError, 'Should get statistics successfully');
            // Step 3: Check availability
            const avail = await handleGetFleetAvailability({ airline_code: 'UA' });
            this.assert(!avail.isError, 'Should get availability successfully');
        });
        // Test 2: Aircraft lookup workflow
        await this.runTest('Integration: Aircraft lookup workflow', async () => {
            // Step 1: Search for aircraft
            const search = await handleSearchAircraft({
                filters: { aircraft_type: '737', airline_code: 'AA' },
                limit: 1,
            });
            this.assert(!search.isError, 'Should search successfully');
            // Step 2: Get type specs
            const specs = await handleGetAircraftTypeSpecs({ aircraft_type: '737' });
            this.assert(!specs.isError, 'Should get specs successfully');
        });
        // Test 3: Update trigger workflow
        await this.runTest('Integration: Update trigger workflow', async () => {
            // Step 1: Trigger update
            const trigger = await handleTriggerFleetUpdate({
                airline_code: 'TS',
                priority: 'low',
            });
            this.assert(!trigger.isError, 'Should trigger update successfully');
            // Step 2: Check if job was created
            const jobQuery = `
        SELECT id FROM scraping_jobs
        WHERE airline_id = (SELECT id FROM airlines WHERE iata_code = 'TS')
        ORDER BY created_at DESC
        LIMIT 1
      `;
            const result = await queryPostgres(jobQuery);
            this.assert(result.rows.length > 0, 'Job should be created in database');
        });
        console.log();
    }
    /**
     * Run performance tests
     */
    async runPerformanceTests() {
        console.log('═══════════════════════════════════════════════════════════════════');
        console.log('  PERFORMANCE BENCHMARKS');
        console.log('═══════════════════════════════════════════════════════════════════\n');
        // Benchmark 1: get-airline-fleet
        await this.benchmark('get-airline-fleet (basic)', async () => {
            await handleGetAirlineFleet({ airline_code: 'UA' });
        }, 100); // Target: < 100ms
        // Benchmark 2: get-airline-fleet with details
        await this.benchmark('get-airline-fleet (with details)', async () => {
            await handleGetAirlineFleet({
                airline_code: 'DL',
                include_details: true,
            });
        }, 200); // Target: < 200ms
        // Benchmark 3: search-aircraft
        await this.benchmark('search-aircraft', async () => {
            await handleSearchAircraft({
                filters: { aircraft_type: '737' },
                limit: 50,
            });
        }, 150); // Target: < 150ms
        // Benchmark 4: get-fleet-statistics
        await this.benchmark('get-fleet-statistics', async () => {
            await handleGetFleetStatistics({ airline_code: 'AA' });
        }, 100); // Target: < 100ms
        // Benchmark 5: get-aircraft-type-specs
        await this.benchmark('get-aircraft-type-specs', async () => {
            await handleGetAircraftTypeSpecs({ aircraft_type: '737' });
        }, 50); // Target: < 50ms (cached)
        // Benchmark 6: get-fleet-availability
        await this.benchmark('get-fleet-availability', async () => {
            await handleGetFleetAvailability({ airline_code: 'UA' });
        }, 100); // Target: < 100ms
        console.log();
    }
    /**
     * Run error scenario tests
     */
    async runErrorScenarioTests() {
        console.log('═══════════════════════════════════════════════════════════════════');
        console.log('  ERROR SCENARIO TESTS');
        console.log('═══════════════════════════════════════════════════════════════════\n');
        // Test 1: Malformed input
        await this.runTest('Error: Malformed airline code', async () => {
            const result = await handleGetAirlineFleet({ airline_code: '!!INVALID!!' });
            this.assert(result.isError, 'Should handle malformed input');
        });
        // Test 2: SQL injection attempt
        await this.runTest('Error: SQL injection attempt', async () => {
            const result = await handleGetAirlineFleet({
                airline_code: "'; DROP TABLE aircraft; --",
            });
            this.assert(result.isError, 'Should safely handle SQL injection attempt');
        });
        // Test 3: Empty string inputs
        await this.runTest('Error: Empty string input', async () => {
            const result = await handleGetAirlineFleet({ airline_code: '' });
            this.assert(result.isError, 'Should reject empty strings');
        });
        // Test 4: Very long strings
        await this.runTest('Error: Very long string', async () => {
            const result = await handleGetAirlineFleet({
                airline_code: 'A'.repeat(1000),
            });
            this.assert(result.isError, 'Should reject very long strings');
        });
        // Test 5: Null/undefined values
        await this.runTest('Error: Null values', async () => {
            const result = await handleGetAirlineFleet({ airline_code: null });
            this.assert(result.isError, 'Should handle null values');
        });
        // Test 6: Wrong data types
        await this.runTest('Error: Wrong data type', async () => {
            const result = await handleGetAirlineFleet({ airline_code: 123 });
            this.assert(result.isError, 'Should reject wrong data types');
        });
        // Test 7: Special characters
        await this.runTest('Error: Special characters', async () => {
            const result = await handleGetAirlineFleet({
                airline_code: '<script>alert("xss")</script>',
            });
            this.assert(result.isError, 'Should handle special characters safely');
        });
        // Test 8: Unicode characters
        await this.runTest('Error: Unicode characters', async () => {
            const result = await handleGetAirlineFleet({ airline_code: '中文测试' });
            this.assert(result.isError, 'Should handle unicode characters');
        });
        console.log();
    }
    /**
     * Run a single test
     */
    async runTest(name, testFn) {
        const startTime = Date.now();
        try {
            await testFn();
            const duration = Date.now() - startTime;
            this.results.push({ name, passed: true, duration });
            console.log(`  ✓ ${name} (${duration}ms)`);
        }
        catch (error) {
            const duration = Date.now() - startTime;
            const errorMsg = error instanceof Error ? error.message : String(error);
            this.results.push({ name, passed: false, duration, error: errorMsg });
            console.log(`  ✗ ${name} (${duration}ms)`);
            console.log(`    Error: ${errorMsg}`);
        }
    }
    /**
     * Run a performance benchmark
     */
    async benchmark(name, fn, targetMs) {
        const iterations = 5;
        const times = [];
        // Warm up
        await fn();
        // Run benchmark
        for (let i = 0; i < iterations; i++) {
            const start = Date.now();
            await fn();
            times.push(Date.now() - start);
        }
        const avg = times.reduce((a, b) => a + b, 0) / times.length;
        const min = Math.min(...times);
        const max = Math.max(...times);
        const status = avg < targetMs ? '✓' : '⚠';
        const result = avg < targetMs ? 'PASS' : 'SLOW';
        console.log(`  ${status} ${name}: avg=${avg.toFixed(1)}ms, min=${min}ms, max=${max}ms, target=${targetMs}ms [${result}]`);
        this.results.push({
            name: `Benchmark: ${name}`,
            passed: avg < targetMs,
            duration: avg,
        });
    }
    /**
     * Assert helper
     */
    assert(condition, message) {
        if (!condition) {
            throw new Error(message);
        }
    }
    /**
     * Print test summary
     */
    printSummary() {
        console.log('═══════════════════════════════════════════════════════════════════');
        console.log('  TEST SUMMARY');
        console.log('═══════════════════════════════════════════════════════════════════\n');
        const total = this.results.length;
        const passed = this.results.filter((r) => r.passed).length;
        const failed = total - passed;
        const passRate = ((passed / total) * 100).toFixed(1);
        console.log(`  Total Tests:  ${total}`);
        console.log(`  Passed:       ${passed} ✓`);
        console.log(`  Failed:       ${failed} ✗`);
        console.log(`  Pass Rate:    ${passRate}%`);
        console.log();
        if (failed > 0) {
            console.log('  Failed Tests:');
            this.results
                .filter((r) => !r.passed)
                .forEach((r) => {
                console.log(`    ✗ ${r.name}`);
                if (r.error) {
                    console.log(`      ${r.error}`);
                }
            });
            console.log();
        }
        const avgDuration = (this.results.reduce((sum, r) => sum + r.duration, 0) / total).toFixed(1);
        console.log(`  Average Test Duration: ${avgDuration}ms`);
        console.log('\n═══════════════════════════════════════════════════════════════════\n');
        if (failed === 0) {
            console.log('🎉 All tests passed!\n');
            process.exit(0);
        }
        else {
            console.log('❌ Some tests failed. Please review the errors above.\n');
            process.exit(1);
        }
    }
}
// Run tests
const suite = new TestSuite();
suite.run().catch((error) => {
    console.error('Test suite failed:', error);
    process.exit(1);
});
//# sourceMappingURL=test-mcp-tools.js.map
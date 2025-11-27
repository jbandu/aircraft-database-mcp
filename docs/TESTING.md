# MCP Server Testing Guide

Complete guide for testing the Aircraft Database MCP Server.

## Overview

The testing suite provides comprehensive coverage for all MCP tools with:

- ✅ **Unit Tests** - Individual tool testing
- ✅ **Integration Tests** - Multi-tool workflows
- ✅ **Performance Benchmarks** - Response time testing
- ✅ **Error Scenarios** - Edge cases and error handling
- ✅ **Mock Data** - Realistic test data generation

---

## Quick Start

### 1. Generate Test Data

```bash
# Generate test airlines and aircraft
npm run test:data

# Clean and regenerate
npm run test:data:clean

# View statistics
npm run test:data:stats
```

### 2. Run Tests

```bash
# Run complete test suite
npm test

# Or directly
npm run test
```

### 3. Review Results

The test suite will output:
- ✓ Passed tests in green
- ✗ Failed tests in red
- Performance benchmarks with timing
- Summary statistics

---

## Test Suite Structure

### Unit Tests

Tests each MCP tool individually with various scenarios:

#### 1. get-airline-fleet
```typescript
✓ Basic retrieval
✓ With details flag
✓ Status filter (active)
✓ Status filter (all)
✗ Invalid airline code
✗ Missing airline_code parameter
```

#### 2. get-aircraft-details
```typescript
✓ Valid registration
✗ Invalid registration
✗ Missing registration parameter
```

#### 3. search-aircraft
```typescript
✓ Search by aircraft type
✓ Search by airline
✓ Multiple filters
✓ With pagination
✓ Empty filters (returns all)
```

#### 4. get-fleet-statistics
```typescript
✓ Single airline statistics
✓ Global statistics
✗ Invalid airline code
```

#### 5. trigger-fleet-update
```typescript
✓ Valid airline
✓ Force update flag
✓ High priority
✗ Invalid airline code
```

#### 6. get-aircraft-type-specs
```typescript
✓ Valid type (737)
✓ Valid type (A320)
✓ All types (no filter)
✗ Invalid type
```

#### 7. get-fleet-availability
```typescript
✓ By airline
✓ By aircraft type
✓ By home base
✗ Invalid airline
```

### Integration Tests

Tests complete workflows across multiple tools:

#### Fleet Workflow
```typescript
1. Get airline fleet (get-airline-fleet)
2. Get fleet statistics (get-fleet-statistics)
3. Check availability (get-fleet-availability)
```

#### Aircraft Lookup Workflow
```typescript
1. Search for aircraft (search-aircraft)
2. Get type specifications (get-aircraft-type-specs)
```

#### Update Trigger Workflow
```typescript
1. Trigger fleet update (trigger-fleet-update)
2. Verify job created in database
```

### Performance Benchmarks

Each tool is benchmarked for response time:

| Tool | Target | Typical |
|------|--------|---------|
| get-airline-fleet (basic) | < 100ms | 40-80ms |
| get-airline-fleet (details) | < 200ms | 80-150ms |
| search-aircraft | < 150ms | 50-120ms |
| get-fleet-statistics | < 100ms | 40-80ms |
| get-aircraft-type-specs | < 50ms | 20-40ms |
| get-fleet-availability | < 100ms | 50-90ms |

### Error Scenarios

Comprehensive error handling tests:

```typescript
✓ Malformed airline code
✓ SQL injection attempt
✓ Empty string inputs
✓ Very long strings
✓ Null/undefined values
✓ Wrong data types
✓ Special characters
✓ Unicode characters
```

---

## Test Data

### Generated Test Data

The test data generator creates:

**3 Test Airlines:**
- TS (TST) - Test Airlines
- TA (TAS) - Test Airways
- TB (TBS) - Test Budget Air

**Aircraft per Airline:** 10-25 aircraft each

**Total Aircraft:** ~50 test aircraft with:
- Various aircraft types (737, 777, A320, etc.)
- Realistic registrations (N12345, G-ABCD, etc.)
- Seat configurations
- Delivery dates
- Status (Active, Stored, Maintenance)
- Confidence scores (0.7-1.0)

**Scraping Jobs:** 2-4 jobs per airline with:
- Various statuses (pending, running, completed, failed)
- Different priorities (low, normal, high)
- Realistic timestamps

### Test Data Commands

```bash
# Generate test data
npm run test:data

# Clean existing test data and regenerate
npm run test:data:clean

# View statistics only
npm run test:data:stats
```

### Sample Output

```
╔═══════════════════════════════════════════════════════════════════╗
║                     Test Data Statistics                          ║
╚═══════════════════════════════════════════════════════════════════╝

  Test Airlines:     3
  Test Aircraft:     47
  Test Jobs:         9

═══════════════════════════════════════════════════════════════════
```

---

## Test Utilities

### Assertion Helpers

```typescript
import { assert, assertEqual, assertTruthy } from './scripts/test-utils.js';

// Basic assertion
assert(condition, 'Should be true');

// Equality
assertEqual(actual, expected, 'Should match');

// Truthy/Falsy
assertTruthy(value, 'Should be truthy');
assertFalsy(value, 'Should be falsy');

// Arrays and strings
assertIncludes(array, value);
assertContains(string, substring);

// Range
assertRange(value, min, max);

// Async errors
await assertThrows(async () => {
  await functionThatShouldThrow();
});
```

### Database Helpers

```typescript
import { DatabaseTestHelper } from './scripts/test-utils.js';

// Check existence
const exists = await DatabaseTestHelper.airlineExists('AA');
const hasAircraft = await DatabaseTestHelper.aircraftExists('N12345');

// Get counts
const fleetCount = await DatabaseTestHelper.getFleetCount('UA');
const typeCount = await DatabaseTestHelper.getAircraftTypeCount('737');
const pendingJobs = await DatabaseTestHelper.getPendingJobCount();

// Get latest job
const job = await DatabaseTestHelper.getLatestJob('DL');

// Cleanup
await DatabaseTestHelper.clearTestJobs();
```

### Performance Testing

```typescript
import { PerformanceTimer } from './scripts/test-utils.js';

// Manual timing
const timer = new PerformanceTimer();
timer.start();
await doSomething();
const duration = timer.stop();

// Measure function
const duration = await PerformanceTimer.measure(async () => {
  await doSomething();
});
```

### Test Fixtures

```typescript
import { TestFixtures } from './scripts/test-utils.js';

// Valid test data
TestFixtures.validAirlineCodes;     // ['AA', 'DL', 'UA', ...]
TestFixtures.validAircraftTypes;    // ['737', '777', 'A320', ...]
TestFixtures.validRegistrations;    // ['N12345', 'G-ABCD', ...]

// Invalid test data
TestFixtures.invalidAirlineCodes;   // ['INVALID', 'XXX', '!!!', ...]
TestFixtures.invalidAircraftTypes;  // ['INVALID999', 'XXX', ...]
```

### Random Data Generation

```typescript
import { RandomData } from './scripts/test-utils.js';

const code = RandomData.airlineCode();      // 'AB'
const reg = RandomData.registration();      // 'N12345'
const num = RandomData.integer(1, 100);     // 42
const bool = RandomData.boolean();          // true/false
```

---

## Writing Custom Tests

### Basic Test Structure

```typescript
import { assert } from './scripts/test-utils.js';
import { handleGetAirlineFleet } from './src/mcp-server/tools/get-airline-fleet.js';

async function testMyFeature() {
  // Setup
  const airline = 'AA';

  // Execute
  const result = await handleGetAirlineFleet({ airline_code: airline });

  // Assert
  assert(result.content, 'Should return content');
  assert(!result.isError, 'Should not be an error');

  // Parse response
  const data = JSON.parse(result.content[0].text);
  assert(data.aircraft.length > 0, 'Should have aircraft');
}
```

### Adding Tests to Suite

Add your test to `scripts/test-mcp-tools.ts`:

```typescript
private async runUnitTests(): Promise<void> {
  // Existing tests...

  // Add your test
  await this.testMyNewFeature();
}

private async testMyNewFeature(): Promise<void> {
  console.log('🔧 Testing my new feature\n');

  await this.runTest('my-feature: Basic test', async () => {
    // Your test code here
    this.assert(condition, 'Should pass');
  });

  console.log();
}
```

---

## Continuous Integration

### GitHub Actions Example

```yaml
name: MCP Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest

    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_PASSWORD: postgres
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '20'

      - name: Install dependencies
        run: npm install

      - name: Run database migrations
        run: npm run db:migrate

      - name: Generate test data
        run: npm run test:data

      - name: Run tests
        run: npm test
```

---

## Troubleshooting

### Tests Failing

**Database Connection Issues:**
```bash
# Check PostgreSQL is running
pg_isready

# Check .env configuration
cat .env | grep POSTGRES

# Test connection
psql -U postgres -c "SELECT 1"
```

**Missing Test Data:**
```bash
# Regenerate test data
npm run test:data:clean

# Check data exists
npm run test:data:stats
```

**Rate Limiting:**
```bash
# Tests may fail if rate limits are too strict
# Temporarily disable or increase limits in:
# src/lib/rate-limiter.ts
```

### Slow Tests

**Database Performance:**
```bash
# Check indexes exist
psql -U postgres -d aircraft_db -c "\di"

# Analyze tables
psql -U postgres -d aircraft_db -c "ANALYZE"
```

**Caching Issues:**
```bash
# Clear cache before tests
# Add to test setup:
globalCache.clear();
```

---

## Test Coverage

### Current Coverage

| Component | Unit Tests | Integration Tests | Error Tests | Performance |
|-----------|------------|-------------------|-------------|-------------|
| get-airline-fleet | ✅ 6 | ✅ 1 | ✅ 8 | ✅ 2 |
| get-aircraft-details | ✅ 3 | ✅ 1 | ✅ 8 | - |
| search-aircraft | ✅ 5 | ✅ 1 | ✅ 8 | ✅ 1 |
| get-fleet-statistics | ✅ 3 | ✅ 1 | ✅ 8 | ✅ 1 |
| trigger-fleet-update | ✅ 4 | ✅ 1 | ✅ 8 | - |
| get-aircraft-type-specs | ✅ 4 | ✅ 1 | ✅ 8 | ✅ 1 |
| get-fleet-availability | ✅ 4 | ✅ 1 | ✅ 8 | ✅ 1 |

**Total Tests:** 90+

---

## Best Practices

### 1. Test Independence

Each test should be independent and not rely on other tests:

```typescript
// ❌ Bad - depends on previous test
let sharedState;
test1() { sharedState = 'value'; }
test2() { assert(sharedState === 'value'); }

// ✅ Good - independent
test1() { const state = 'value'; assert(state); }
test2() { const state = 'value'; assert(state); }
```

### 2. Clean Test Data

Always clean up after tests:

```typescript
async function myTest() {
  // Setup
  await createTestData();

  try {
    // Test code
    await runTest();
  } finally {
    // Cleanup
    await cleanupTestData();
  }
}
```

### 3. Descriptive Names

Use clear, descriptive test names:

```typescript
// ❌ Bad
test1() { }

// ✅ Good
'get-airline-fleet: Returns error for invalid airline code'
```

### 4. Test Error Cases

Always test error scenarios:

```typescript
// Test success
await testValidInput();

// Test failures
await testInvalidInput();
await testMissingInput();
await testMalformedInput();
```

---

## Example Test Output

```
╔═══════════════════════════════════════════════════════════════════╗
║              MCP Tool Testing Suite - Starting Tests              ║
╚═══════════════════════════════════════════════════════════════════╝

🔧 Setting up test data...

✓ Test airline already exists

═══════════════════════════════════════════════════════════════════
  UNIT TESTS
═══════════════════════════════════════════════════════════════════

📋 Testing get-airline-fleet

  ✓ get-airline-fleet: Basic retrieval (45ms)
  ✓ get-airline-fleet: With details (78ms)
  ✓ get-airline-fleet: Status filter (active) (42ms)
  ✓ get-airline-fleet: Status filter (all) (43ms)
  ✓ get-airline-fleet: Invalid airline (12ms)
  ✓ get-airline-fleet: Missing airline_code (8ms)

✈️  Testing get-aircraft-details

  ✓ get-aircraft-details: Valid registration (56ms)
  ✓ get-aircraft-details: Invalid registration (11ms)
  ✓ get-aircraft-details: Missing registration (7ms)

[... more tests ...]

═══════════════════════════════════════════════════════════════════
  PERFORMANCE BENCHMARKS
═══════════════════════════════════════════════════════════════════

  ✓ get-airline-fleet (basic): avg=42.4ms, min=38ms, max=48ms, target=100ms [PASS]
  ✓ get-airline-fleet (with details): avg=84.2ms, min=76ms, max=92ms, target=200ms [PASS]
  ✓ search-aircraft: avg=67.8ms, min=61ms, max=76ms, target=150ms [PASS]
  ✓ get-fleet-statistics: avg=48.6ms, min=44ms, max=54ms, target=100ms [PASS]
  ✓ get-aircraft-type-specs: avg=24.2ms, min=21ms, max=28ms, target=50ms [PASS]
  ✓ get-fleet-availability: avg=71.4ms, min=67ms, max=78ms, target=100ms [PASS]

═══════════════════════════════════════════════════════════════════
  TEST SUMMARY
═══════════════════════════════════════════════════════════════════

  Total Tests:  92
  Passed:       92 ✓
  Failed:       0 ✗
  Pass Rate:    100.0%

  Average Test Duration: 38.7ms

═══════════════════════════════════════════════════════════════════

🎉 All tests passed!
```

---

## Resources

- [Testing Best Practices](https://testing.googleblog.com/)
- [Node.js Testing Guide](https://nodejs.org/api/test.html)
- [TypeScript Testing](https://www.typescriptlang.org/docs/handbook/testing.html)

---

**Built by Number Labs** - Airline Agentic Operating System

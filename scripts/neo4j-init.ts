#!/usr/bin/env tsx

/**
 * Neo4j Schema Initialization Script
 *
 * Initializes Neo4j database with constraints, indexes, and sample data
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { initializeDatabases, queryNeo4j, closeDatabases } from '../src/lib/db-clients.js';
import { createLogger } from '../src/lib/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const logger = createLogger('neo4j-init');

/**
 * Parse Cypher file into individual statements
 */
function parseCypherFile(content: string): string[] {
  // Split by semicolon, but preserve statements
  const statements = content
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0)
    .filter(s => !s.startsWith('//')) // Remove comments
    .map(s => s + ';'); // Add semicolon back

  return statements;
}

/**
 * Execute Cypher statements from schema file
 */
async function executeCypherFile(filePath: string): Promise<void> {
  logger.info(`Reading Cypher file: ${filePath}`);

  const content = readFileSync(filePath, 'utf-8');

  // Split into individual statements
  const lines = content.split('\n');
  const statements: string[] = [];
  let currentStatement = '';
  let inMultiLineComment = false;

  for (const line of lines) {
    const trimmedLine = line.trim();

    // Skip empty lines
    if (trimmedLine.length === 0) continue;

    // Handle multi-line comments
    if (trimmedLine.startsWith('/*')) {
      inMultiLineComment = true;
    }
    if (trimmedLine.endsWith('*/')) {
      inMultiLineComment = false;
      continue;
    }
    if (inMultiLineComment) continue;

    // Skip single-line comments
    if (trimmedLine.startsWith('//')) continue;

    // Accumulate statement
    currentStatement += line + '\n';

    // If line ends with semicolon, it's end of statement
    if (trimmedLine.endsWith(';')) {
      statements.push(currentStatement.trim());
      currentStatement = '';
    }
  }

  logger.info(`Found ${statements.length} Cypher statements to execute`);

  // Execute each statement
  let successCount = 0;
  let errorCount = 0;

  for (const [index, statement] of statements.entries()) {
    // Skip comment-only statements
    if (statement.startsWith('//') || statement.trim().length === 0) {
      continue;
    }

    try {
      logger.debug(`Executing statement ${index + 1}/${statements.length}`);
      await queryNeo4j(statement);
      successCount++;
    } catch (error) {
      // Some constraints may already exist, that's okay
      const errorMsg = error instanceof Error ? error.message : String(error);

      if (errorMsg.includes('already exists') || errorMsg.includes('equivalent')) {
        logger.warn(`Skipping existing constraint/index: ${errorMsg.split('\n')[0]}`);
        successCount++;
      } else {
        logger.error(`Failed to execute statement: ${errorMsg}`);
        logger.error(`Statement was: ${statement.substring(0, 200)}...`);
        errorCount++;
      }
    }
  }

  logger.info(`Cypher execution complete: ${successCount} successful, ${errorCount} failed`);
}

/**
 * Verify Neo4j schema
 */
async function verifySchema(): Promise<void> {
  logger.info('Verifying Neo4j schema...');

  // Check constraints
  const constraintsQuery = 'SHOW CONSTRAINTS';
  const constraintsResult = await queryNeo4j(constraintsQuery);
  logger.info(`Constraints found: ${constraintsResult.records.length}`);

  // Check indexes
  const indexesQuery = 'SHOW INDEXES';
  const indexesResult = await queryNeo4j(indexesQuery);
  logger.info(`Indexes found: ${indexesResult.records.length}`);

  // Check sample data
  const alliancesQuery = 'MATCH (a:Alliance) RETURN count(a) as count';
  const alliancesResult = await queryNeo4j(alliancesQuery);
  const allianceCount = alliancesResult.records[0]?.get('count').toNumber() || 0;
  logger.info(`Alliances created: ${allianceCount}`);

  const manufacturersQuery = 'MATCH (m:Manufacturer) RETURN count(m) as count';
  const manufacturersResult = await queryNeo4j(manufacturersQuery);
  const manufacturerCount = manufacturersResult.records[0]?.get('count').toNumber() || 0;
  logger.info(`Manufacturers created: ${manufacturerCount}`);

  // Overall statistics
  const statsQuery = `
    MATCH (n)
    RETURN labels(n)[0] as label, count(n) as count
    ORDER BY count DESC
  `;
  const statsResult = await queryNeo4j(statsQuery);

  logger.info('Current graph statistics:');
  for (const record of statsResult.records) {
    const label = record.get('label') || 'Unknown';
    const count = record.get('count').toNumber();
    logger.info(`  ${label}: ${count}`);
  }
}

/**
 * Main execution
 */
async function main() {
  const args = process.argv.slice(2);
  const forceReinit = args.includes('--force');

  logger.info('Initializing Neo4j database...');

  try {
    // Initialize database connections
    await initializeDatabases();
    logger.info('Connected to Neo4j');

    // Check if Neo4j is enabled
    if (process.env.ENABLE_NEO4J !== 'true') {
      logger.warn('Neo4j is disabled in .env (ENABLE_NEO4J=false)');
      logger.warn('Enable it to proceed with initialization');
      process.exit(1);
    }

    // Clear existing data if force flag is set
    if (forceReinit) {
      logger.warn('Force flag detected - clearing existing graph data');
      await queryNeo4j('MATCH (n) DETACH DELETE n');
      logger.info('Graph cleared');

      // Also drop constraints and indexes
      try {
        const constraints = await queryNeo4j('SHOW CONSTRAINTS');
        for (const record of constraints.records) {
          const name = record.get('name');
          await queryNeo4j(`DROP CONSTRAINT ${name} IF EXISTS`);
        }
        logger.info('Constraints dropped');
      } catch (error) {
        logger.warn('Could not drop constraints:', error);
      }
    }

    // Execute schema file
    const schemaPath = join(__dirname, '../src/database/neo4j/001_knowledge_graph_schema.cypher');
    await executeCypherFile(schemaPath);

    // Verify schema
    await verifySchema();

    logger.info('Neo4j initialization complete!');
    logger.info('');
    logger.info('Next steps:');
    logger.info('1. Run: npm run neo4j:sync -- to sync data from PostgreSQL');
    logger.info('2. Or: npm run neo4j:sync:dry-run -- to preview sync');
    logger.info('3. Check status: Open Neo4j Browser at http://localhost:7474');

    await closeDatabases();
    process.exit(0);
  } catch (error) {
    logger.error('Neo4j initialization failed:', error);
    await closeDatabases();
    process.exit(1);
  }
}

// Run script
main();

/**
 * Database client connections for PostgreSQL and Neo4j
 */

import pg from 'pg';
import neo4j from 'neo4j-driver';
import dotenv from 'dotenv';
import { createLogger } from './logger.js';

dotenv.config();

const logger = createLogger('db-clients');

// PostgreSQL Client
let pgPool: pg.Pool | null = null;

// Neo4j Driver
let neo4jDriver: neo4j.Driver | null = null;

/**
 * Initialize PostgreSQL connection pool
 */
export function initializePostgres(): pg.Pool {
  if (pgPool) {
    return pgPool;
  }

  const config: pg.PoolConfig = {
    connectionString: process.env.POSTGRES_URL,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
  };

  // Handle SSL for production databases (Neon, Railway, etc.)
  if (process.env.POSTGRES_SSL === 'true') {
    config.ssl = {
      rejectUnauthorized: false,
    };
  }

  pgPool = new pg.Pool(config);

  pgPool.on('error', (err) => {
    logger.error('Unexpected PostgreSQL client error:', err);
  });

  logger.info('PostgreSQL connection pool initialized');

  return pgPool;
}

/**
 * Initialize Neo4j driver
 */
export function initializeNeo4j(): neo4j.Driver {
  if (neo4jDriver) {
    return neo4jDriver;
  }

  const uri = process.env.NEO4J_URI || 'bolt://localhost:7687';
  const user = process.env.NEO4J_USER || 'neo4j';
  const password = process.env.NEO4J_PASSWORD || 'password';

  neo4jDriver = neo4j.driver(uri, neo4j.auth.basic(user, password), {
    maxConnectionLifetime: 3 * 60 * 60 * 1000, // 3 hours
    maxConnectionPoolSize: 50,
    connectionAcquisitionTimeout: 2 * 60 * 1000, // 2 minutes
  });

  logger.info('Neo4j driver initialized');

  return neo4jDriver;
}

/**
 * Initialize all database connections
 */
export async function initializeDatabases(): Promise<void> {
  try {
    // Initialize PostgreSQL
    const pool = initializePostgres();

    // Test PostgreSQL connection
    const client = await pool.connect();
    await client.query('SELECT NOW()');
    client.release();
    logger.info('PostgreSQL connection verified');

    // Initialize Neo4j if enabled
    if (process.env.ENABLE_NEO4J === 'true') {
      const driver = initializeNeo4j();

      // Test Neo4j connection
      const session = driver.session();
      try {
        await session.run('RETURN 1');
        logger.info('Neo4j connection verified');
      } finally {
        await session.close();
      }
    } else {
      logger.info('Neo4j is disabled, skipping initialization');
    }
  } catch (error) {
    logger.error('Failed to initialize databases:', error);
    throw error;
  }
}

/**
 * Get PostgreSQL pool (must be initialized first)
 */
export function getPostgresPool(): pg.Pool {
  if (!pgPool) {
    throw new Error('PostgreSQL pool not initialized. Call initializeDatabases() first.');
  }
  return pgPool;
}

/**
 * Get Neo4j driver (must be initialized first)
 */
export function getNeo4jDriver(): neo4j.Driver {
  if (!neo4jDriver) {
    throw new Error('Neo4j driver not initialized. Call initializeDatabases() first.');
  }
  return neo4jDriver;
}

/**
 * Execute a PostgreSQL query
 */
export async function queryPostgres<T = any>(
  query: string,
  params?: any[]
): Promise<pg.QueryResult<T>> {
  const pool = getPostgresPool();
  return await pool.query<T>(query, params);
}

/**
 * Execute a Neo4j query
 */
export async function queryNeo4j<T = any>(
  cypher: string,
  params?: Record<string, any>
): Promise<neo4j.QueryResult<T>> {
  const driver = getNeo4jDriver();
  const session = driver.session();

  try {
    return await session.run(cypher, params);
  } finally {
    await session.close();
  }
}

/**
 * Close all database connections
 */
export async function closeDatabases(): Promise<void> {
  const promises: Promise<void>[] = [];

  if (pgPool) {
    promises.push(
      pgPool.end().then(() => {
        logger.info('PostgreSQL pool closed');
        pgPool = null;
      })
    );
  }

  if (neo4jDriver) {
    promises.push(
      neo4jDriver.close().then(() => {
        logger.info('Neo4j driver closed');
        neo4jDriver = null;
      })
    );
  }

  await Promise.all(promises);
}

/**
 * Transaction helper for PostgreSQL
 */
export async function withTransaction<T>(
  callback: (client: pg.PoolClient) => Promise<T>
): Promise<T> {
  const pool = getPostgresPool();
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Transaction helper for Neo4j
 */
export async function withNeo4jTransaction<T>(
  callback: (tx: neo4j.Transaction) => Promise<T>
): Promise<T> {
  const driver = getNeo4jDriver();
  const session = driver.session();

  try {
    return await session.executeWrite(callback);
  } finally {
    await session.close();
  }
}

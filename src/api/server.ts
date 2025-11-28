/**
 * REST API Server
 *
 * Express.js API alongside MCP server for traditional web/mobile app access.
 * Provides the same data access as MCP tools through standard REST endpoints.
 */

import express, { Express, Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import swaggerUi from 'swagger-ui-express';
import { readFileSync } from 'fs';
import { parse as parseYaml } from 'yaml';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { createLogger } from '../lib/logger.js';
import { authMiddleware } from './middleware/auth.js';
import { rateLimitMiddleware } from './middleware/rate-limit.js';
import { errorHandler } from './middleware/error-handler.js';
import { requestLogger } from './middleware/request-logger.js';
import { auditLoggerMiddleware } from './middleware/audit-logger.js';
import { aggressiveValidation } from './middleware/validation.js';
import { initializeDatabases, closeDatabases } from '../lib/db-clients.js';
import { ScraperScheduler } from '../scrapers/workflows/scheduler.js';

// Route imports
import airlinesRouter from './routes/airlines.js';
import aircraftRouter from './routes/aircraft.js';
import statsRouter from './routes/stats.js';
import scrapingRouter from './routes/scraping.js';
import healthRouter from './routes/health.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const logger = createLogger('api-server');

export class APIServer {
  private app: Express;
  private port: number;
  private scheduler: ScraperScheduler | null = null;
  private server: any = null;

  constructor() {
    this.app = express();
    // Railway provides PORT env var - use it first, fallback to API_PORT or 3000
    this.port = parseInt(process.env['PORT'] || process.env['API_PORT'] || '3000', 10);
    this.setupMiddleware();
    this.setupRoutes();
    this.setupErrorHandling();
    this.setupGracefulShutdown();
  }

  /**
   * Set up middleware
   */
  private setupMiddleware(): void {
    // Security
    this.app.use(helmet());

    // CORS
    this.app.use(
      cors({
        origin: this.getAllowedOrigins(),
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key'],
      })
    );

    // Compression
    this.app.use(compression());

    // Body parsing
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // Request logging
    this.app.use(requestLogger);

    // Input validation (aggressive XSS/SQLi detection)
    this.app.use(aggressiveValidation);

    // Rate limiting (global)
    this.app.use(rateLimitMiddleware);

    // Authentication (exclude health check and documentation)
    this.app.use((req, res, next) => {
      if (req.path === '/health' || req.path === '/' || req.path.startsWith('/api-docs')) {
        return next();
      }
      return authMiddleware(req, res, next);
    });

    // Audit logging (after authentication)
    this.app.use(auditLoggerMiddleware);
  }

  /**
   * Set up routes
   */
  private setupRoutes(): void {
    // Root endpoint
    this.app.get('/', (_req: Request, res: Response) => {
      res.json({
        name: 'Aircraft Database API',
        version: '1.0.0',
        description: 'REST API for airline fleet data',
        documentation: '/api-docs',
        endpoints: {
          airlines: '/api/v1/airlines',
          aircraft: '/api/v1/aircraft',
          stats: '/api/v1/stats',
          scraping: '/api/v1/jobs',
          health: '/health',
        },
      });
    });

    // API Documentation (Swagger UI)
    try {
      const openapiPath = join(__dirname, 'openapi.yaml');
      const openapiSpec = parseYaml(readFileSync(openapiPath, 'utf-8'));
      this.app.use(
        '/api-docs',
        swaggerUi.serve,
        swaggerUi.setup(openapiSpec, {
          customCss: '.swagger-ui .topbar { display: none }',
          customSiteTitle: 'Aircraft Database API Documentation',
        })
      );
      logger.info('API documentation loaded from openapi.yaml');
    } catch (error) {
      logger.warn('Failed to load OpenAPI spec:', error);
    }

    // Health check
    this.app.use('/health', healthRouter);

    // API routes
    const apiRouter = express.Router();
    apiRouter.use('/airlines', airlinesRouter);
    apiRouter.use('/aircraft', aircraftRouter);
    apiRouter.use('/stats', statsRouter);
    apiRouter.use('/jobs', scrapingRouter);

    this.app.use('/api/v1', apiRouter);

    // 404 handler
    this.app.use((req: Request, res: Response) => {
      res.status(404).json({
        error: 'Not Found',
        message: `Route ${req.method} ${req.path} not found`,
      });
    });
  }

  /**
   * Set up error handling
   */
  private setupErrorHandling(): void {
    this.app.use(errorHandler);
  }

  /**
   * Get allowed origins for CORS
   */
  private getAllowedOrigins(): string | string[] {
    const origins = process.env['CORS_ORIGINS'];

    if (!origins) {
      return '*'; // Allow all in development
    }

    return origins.split(',').map((origin) => origin.trim());
  }

  /**
   * Start the server
   */
  async start(): Promise<void> {
    // Initialize databases
    logger.info('Initializing databases...');
    await initializeDatabases();
    logger.info('Databases initialized successfully');

    // Start HTTP server
    await new Promise<void>((resolve) => {
      this.server = this.app.listen(this.port, () => {
        logger.info(`API server listening on port ${this.port}`);
        logger.info(`API documentation: http://localhost:${this.port}/api-docs`);
        logger.info(`Health check: http://localhost:${this.port}/health`);
        resolve();
      });
    });

    // Start scraper scheduler if enabled
    const schedulerEnabled = process.env['SCRAPER_SCHEDULER_ENABLED'] !== 'false';
    if (schedulerEnabled) {
      logger.info('Starting scraper scheduler...');
      this.scheduler = new ScraperScheduler();
      await this.scheduler.start();
      logger.info('Scraper scheduler started successfully');
    } else {
      logger.info('Scraper scheduler disabled (set SCRAPER_SCHEDULER_ENABLED=true to enable)');
    }
  }

  /**
   * Stop the server gracefully
   */
  async stop(): Promise<void> {
    logger.info('Stopping API server...');

    // Stop scheduler first
    if (this.scheduler) {
      logger.info('Stopping scraper scheduler...');
      await this.scheduler.stop();
      logger.info('Scraper scheduler stopped');
    }

    // Close HTTP server
    if (this.server) {
      await new Promise<void>((resolve, reject) => {
        this.server.close((err: Error | undefined) => {
          if (err) {
            reject(err);
          } else {
            resolve();
          }
        });
      });
      logger.info('HTTP server stopped');
    }

    // Close databases
    await closeDatabases();
    logger.info('Database connections closed');
    logger.info('API server stopped successfully');
  }

  /**
   * Setup graceful shutdown handlers
   */
  private setupGracefulShutdown(): void {
    const shutdown = async (signal: string) => {
      logger.info(`Received ${signal}, shutting down gracefully...`);
      try {
        await this.stop();
        process.exit(0);
      } catch (error) {
        logger.error('Error during shutdown:', error);
        process.exit(1);
      }
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
  }

  /**
   * Get Express app instance
   */
  getApp(): Express {
    return this.app;
  }
}

// Start server if run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const server = new APIServer();
  server.start().catch((error) => {
    logger.error('Failed to start API server:', error);
    process.exit(1);
  });
}

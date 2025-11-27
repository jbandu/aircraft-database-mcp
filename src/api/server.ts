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

  constructor() {
    this.app = express();
    this.port = parseInt(process.env['API_PORT'] || '3000', 10);
    this.setupMiddleware();
    this.setupRoutes();
    this.setupErrorHandling();
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

    // Rate limiting (global)
    this.app.use(rateLimitMiddleware);

    // Authentication (exclude health check and documentation)
    this.app.use((req, res, next) => {
      if (req.path === '/health' || req.path === '/' || req.path.startsWith('/api-docs')) {
        return next();
      }
      return authMiddleware(req, res, next);
    });
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
    return new Promise((resolve) => {
      this.app.listen(this.port, () => {
        logger.info(`API server listening on port ${this.port}`);
        logger.info(`API documentation: http://localhost:${this.port}/api-docs`);
        logger.info(`Health check: http://localhost:${this.port}/health`);
        resolve();
      });
    });
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

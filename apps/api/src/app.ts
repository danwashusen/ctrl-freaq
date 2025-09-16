import type { Database } from 'better-sqlite3';
import cors from 'cors';
import express, { type Express } from 'express';
import type { Logger } from 'pino';

// Core modules
import { createDefaultDatabaseConfig, DatabaseManager } from './core/database.js';
import { createErrorHandler, createNotFoundHandler } from './middleware/error-handler.js';
import {
  createLogger,
  createHttpLogger,
  createDefaultLoggingConfig,
  setupProcessErrorLogging,
} from './core/logging.js';
import { createServiceLocatorMiddleware } from './core/service-locator.js';
import { createFullCorrelationMiddleware } from './middleware/request-id.js';

/**
 * Express App Configuration and Middleware Setup
 *
 * Implements complete Express.js application with:
 * - Core infrastructure integration
 * - Middleware pipeline configuration
 * - Request/response lifecycle management
 * - Health check endpoints
 * - Security and CORS configuration
 *
 * Constitutional Compliance:
 * - Service Locator Pattern: Per-request dependency injection
 * - Structured Logging: Request/response tracking
 * - Error Handling: Comprehensive error management
 * - Observability Standards: Health checks and monitoring
 */

export interface AppConfig {
  port: number;
  cors: {
    origin: string | string[];
    credentials: boolean;
  };
  security: {
    trustProxy: boolean;
    rateLimiting: {
      windowMs: number;
      max: number;
    };
  };
  health: {
    endpoint: string;
    versionedEndpoint: string;
  };
}

/**
 * Application context containing core dependencies
 */
export interface AppContext {
  logger: Logger;
  database: Database;
  databaseManager: DatabaseManager;
  config: AppConfig;
}

/**
 * Create default application configuration
 */
export function createDefaultAppConfig(): AppConfig {
  return {
    port: parseInt(process.env.PORT || '5001', 10),
    cors: {
      origin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:5173'],
      credentials: true,
    },
    security: {
      trustProxy: process.env.TRUST_PROXY === 'true',
      rateLimiting: {
        windowMs: parseInt(process.env.RATE_LIMIT_WINDOW || '900000', 10), // 15 minutes
        max: parseInt(process.env.RATE_LIMIT_MAX || '100', 10), // 100 requests per window
      },
    },
    health: {
      endpoint: '/health',
      versionedEndpoint: '/api/v1/health',
    },
  };
}

/**
 * Create and configure Express application
 */
export async function createApp(config?: Partial<AppConfig>): Promise<Express> {
  const appConfig = { ...createDefaultAppConfig(), ...config };

  // Create core dependencies
  const loggingConfig = createDefaultLoggingConfig();
  const logger = createLogger(loggingConfig);
  const databaseConfig = createDefaultDatabaseConfig();
  const databaseManager = new DatabaseManager(databaseConfig, logger);

  // Initialize database
  await databaseManager.initialize();
  const database = databaseManager.getDatabase();

  // Setup process error logging
  setupProcessErrorLogging(logger);

  logger.info(
    {
      config: {
        port: appConfig.port,
        environment: process.env.NODE_ENV || 'development',
        cors: appConfig.cors,
      },
    },
    'Creating Express application'
  );

  // Create Express app
  const app = express();

  // Store context for access in routes and middleware
  const appContext: AppContext = {
    logger,
    database,
    databaseManager,
    config: appConfig,
  };

  app.locals.appContext = appContext;

  // Security middleware
  if (appConfig.security.trustProxy) {
    app.set('trust proxy', 1);
  }

  // Request correlation middleware (must be first)
  const correlationMiddleware = createFullCorrelationMiddleware();
  correlationMiddleware.forEach(middleware => app.use(middleware));

  // HTTP request logging middleware
  const httpLogger = createHttpLogger(logger, loggingConfig);
  app.use(httpLogger);

  // Service locator middleware (after correlation, before business logic)
  const serviceLocatorMiddleware = createServiceLocatorMiddleware(logger, database);
  app.use(serviceLocatorMiddleware);

  // Register repository factories in the per-request container
  const { createRepositoryRegistrationMiddleware } = await import('./services/container.js');
  app.use(createRepositoryRegistrationMiddleware());

  // CORS middleware with secure origin validation
  app.use(
    cors({
      origin: (
        origin: string | undefined,
        callback: (error: Error | null, allow?: boolean) => void
      ) => {
        // Allow requests with no origin (mobile apps, etc.)
        if (!origin) {
          return callback(null, true);
        }

        const allowedOrigins = Array.isArray(appConfig.cors.origin)
          ? appConfig.cors.origin
          : [appConfig.cors.origin];

        if (allowedOrigins.includes(origin)) {
          callback(null, true);
        } else {
          logger.warn({ origin, allowedOrigins }, 'CORS origin rejected');
          callback(new Error('Not allowed by CORS'), false);
        }
      },
      credentials: appConfig.cors.credentials,
      optionsSuccessStatus: 200,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: [
        'Origin',
        'X-Requested-With',
        'Content-Type',
        'Accept',
        'Authorization',
        'X-Request-ID',
        'X-Correlation-ID',
      ],
    })
  );

  // Body parsing middleware
  app.use(
    express.json({
      limit: '10mb',
      type: ['application/json'],
    })
  );

  app.use(
    express.urlencoded({
      extended: true,
      limit: '10mb',
    })
  );

  // Import route modules
  const { healthRouter } = await import('./routes/health.js');
  const { projectsRouter } = await import('./routes/projects.js');
  const { dashboardRouter } = await import('./routes/dashboard.js');
  const { activitiesRouter } = await import('./routes/activities.js');
  const { projectSelectionRouter } = await import('./routes/projects.select.js');
  const { templatesRouter } = await import('./routes/templates.js');
  const { documentsRouter } = await import('./routes/documents.js');
  const { clerkAuthMiddleware, requireAuth } = await import('./middleware/auth.js');
  const { testAuthShim } = await import('./middleware/test-auth.js');
  const { ensureTestUserMiddleware } = await import('./middleware/test-user-seed.js');
  const { testOnlyRouter } = await import('./routes/test-only.js');

  // Health check routes (no authentication required)
  app.use('/', healthRouter);

  // API v1 routes with authentication
  // In test, or when Clerk keys are not configured, avoid initializing Clerk middleware
  // and use a lightweight shim that only sets req.auth.userId when Authorization is present.
  const isTestEnv = process.env.NODE_ENV === 'test';
  const hasClerkConfig = Boolean(process.env.CLERK_SECRET_KEY || process.env.CLERK_PUBLISHABLE_KEY);
  if (!isTestEnv && hasClerkConfig) {
    app.use('/api/v1', clerkAuthMiddleware);
  } else {
    app.use('/api/v1', testAuthShim);
  }
  // In tests, ensure a user row exists for FK-free operations
  if (isTestEnv) {
    app.use('/api/v1', ensureTestUserMiddleware);
  }
  app.use('/api/v1', requireAuth);
  app.use('/api/v1', projectsRouter);
  app.use('/api/v1', dashboardRouter);
  app.use('/api/v1', activitiesRouter);
  app.use('/api/v1', projectSelectionRouter);
  app.use('/api/v1', templatesRouter);
  app.use('/api/v1', documentsRouter);
  if (isTestEnv) {
    app.use('/', testOnlyRouter);
  }

  // 404 handler for unmatched routes
  app.use(createNotFoundHandler());

  // Global error handler (must be last)
  app.use(createErrorHandler());

  logger.info('Express application created successfully');

  // In test mode, optionally register app for auto-reset between tests
  if (process.env.NODE_ENV === 'test' && process.env.API_TEST_AUTO_RESET === 'true') {
    const { registerTestApp } = await import('./testing/registry.js');
    registerTestApp(app);
  }

  return app;
}

/**
 * Start the Express application
 */
export async function startServer(
  app?: Express,
  config?: AppConfig
): Promise<{ app: Express; server: import('http').Server }> {
  const expressApp = app || (await createApp(config));
  const appConfig = config || createDefaultAppConfig();
  const logger = expressApp.locals.appContext.logger;

  return new Promise((resolve, reject) => {
    const server = expressApp.listen(appConfig.port, () => {
      logger.info(
        {
          port: appConfig.port,
          environment: process.env.NODE_ENV || 'development',
          pid: process.pid,
        },
        `Server started on port ${appConfig.port}`
      );

      resolve({ app: expressApp, server });
    });

    server.on('error', (error: Error) => {
      logger.error({ error, port: appConfig.port }, 'Failed to start server');
      reject(error);
    });
  });
}

/**
 * Graceful shutdown handler
 */
export async function gracefulShutdown(
  server: import('http').Server,
  appContext: AppContext,
  signal: string = 'SIGTERM'
): Promise<void> {
  const { logger, databaseManager } = appContext;

  logger.info({ signal }, 'Initiating graceful shutdown');

  return new Promise(resolve => {
    // Close HTTP server
    server.close(async (error: Error | undefined) => {
      if (error) {
        logger.error({ error }, 'Error closing HTTP server');
      } else {
        logger.info('HTTP server closed');
      }

      // Close database connections
      try {
        await databaseManager.close();
        logger.info('Database connections closed');
      } catch (dbError) {
        logger.error({ error: dbError }, 'Error closing database connections');
      }

      logger.info('Graceful shutdown completed');
      resolve();
    });
  });
}

/**
 * Setup process signal handlers for graceful shutdown
 */
export function setupGracefulShutdown(server: import('http').Server, appContext: AppContext): void {
  const shutdownHandler = async (signal: string) => {
    await gracefulShutdown(server, appContext, signal);
    process.exit(0);
  };

  process.on('SIGTERM', () => shutdownHandler('SIGTERM'));
  process.on('SIGINT', () => shutdownHandler('SIGINT'));

  // Handle uncaught exceptions and unhandled rejections
  process.on('uncaughtException', async error => {
    appContext.logger.fatal({ error }, 'Uncaught exception');
    await gracefulShutdown(server, appContext, 'UNCAUGHT_EXCEPTION');
    process.exit(1);
  });

  process.on('unhandledRejection', async (reason, promise) => {
    appContext.logger.error({ reason, promise: promise.toString() }, 'Unhandled promise rejection');
    await gracefulShutdown(server, appContext, 'UNHANDLED_REJECTION');
    process.exit(1);
  });
}

/**
 * Development server with hot reload support
 */
export async function createDevelopmentServer(
  config?: Partial<AppConfig>
): Promise<{ app: Express; server: import('http').Server }> {
  const app = await createApp({
    ...config,
    cors: {
      origin: ['http://localhost:5173', 'http://localhost:3000'],
      credentials: true,
    },
  });

  const { server } = await startServer(app);
  const appContext = app.locals.appContext;

  // Setup graceful shutdown
  setupGracefulShutdown(server, appContext);

  appContext.logger.info('Development server ready with hot reload support');

  return { app, server };
}

/**
 * Production server with optimizations
 */
export async function createProductionServer(
  config?: Partial<AppConfig>
): Promise<{ app: Express; server: import('http').Server }> {
  const app = await createApp({
    ...config,
    security: {
      trustProxy: true,
      rateLimiting: {
        windowMs: 900000, // 15 minutes
        max: 1000, // Higher limit for production
      },
    },
  });

  const { server } = await startServer(app);
  const appContext = app.locals.appContext;

  // Setup graceful shutdown
  setupGracefulShutdown(server, appContext);

  appContext.logger.info('Production server ready');

  return { app, server };
}

/**
 * Test server for integration tests
 */
export async function createTestServer(): Promise<Express> {
  const app = await createApp({
    port: 0, // Random available port
    cors: {
      origin: '*',
      credentials: false,
    },
    security: {
      trustProxy: false,
      rateLimiting: {
        windowMs: 60000,
        max: 1000,
      },
    },
  });

  // Use in-memory database for tests
  // This would be configured differently in a real test setup

  return app;
}

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import Database from 'better-sqlite3';

/**
 * Health check response schema
 */
const HealthResponseSchema = z.object({
  status: z.enum(['healthy', 'unhealthy']),
  timestamp: z.string().datetime(),
  version: z.string(),
  service: z.string(),
  uptime: z.number(),
  environment: z.string(),
  database: z.object({
    status: z.enum(['connected', 'disconnected']),
    type: z.string()
  })
});

const ErrorResponseSchema = z.object({
  status: z.enum(['unhealthy']),
  error: z.string(),
  timestamp: z.string().datetime()
});

type HealthResponse = z.infer<typeof HealthResponseSchema>;
type ErrorResponse = z.infer<typeof ErrorResponseSchema>;

/**
 * Server start time for uptime calculation
 */
const SERVER_START_TIME = Date.now();

/**
 * Health check router
 */
export const healthRouter = Router();

/**
 * GET /health
 * Basic health check endpoint
 */
healthRouter.get('/health', async (req: Request, res: Response<HealthResponse | ErrorResponse>) => {
  const logger = req.services?.get('logger');
  const db = req.services?.get('database') as Database.Database;

  try {
    // Check database connection
    const dbStatus = checkDatabaseConnection(db);

    const healthData: HealthResponse = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '0.1.0',
      service: 'ctrl-freaq-api',
      uptime: Math.floor((Date.now() - SERVER_START_TIME) / 1000),
      environment: process.env.NODE_ENV || 'development',
      database: dbStatus
    };

    // Validate response
    const validated = HealthResponseSchema.parse(healthData);

    logger?.info({
      requestId: req.requestId,
      action: 'health_check',
      status: 'success'
    }, 'Health check performed');

    res.status(200).json(validated);
  } catch (error) {
    const errorResponse: ErrorResponse = {
      status: 'unhealthy',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    };

    logger?.error({
      requestId: req.requestId,
      action: 'health_check',
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, 'Health check failed');

    res.status(503).json(errorResponse);
  }
});

/**
 * GET /api/v1/health
 * Versioned health check endpoint (same implementation)
 */
healthRouter.get('/api/v1/health', async (req: Request, res: Response<HealthResponse | ErrorResponse>) => {
  // Reuse the same logic by calling the /health endpoint handler
  const healthHandler = healthRouter.stack.find(layer =>
    layer.route?.path === '/health' && layer.route.methods.get
  );

  if (healthHandler && healthHandler.route?.stack[0]?.handle) {
    await healthHandler.route.stack[0].handle(req, res);
  } else {
    // Fallback implementation
    res.status(503).json({
      status: 'unhealthy',
      error: 'Health check endpoint not properly configured',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * Check database connection status
 */
function checkDatabaseConnection(db: Database.Database): { status: 'connected' | 'disconnected'; type: string } {
  try {
    if (!db) {
      return { status: 'disconnected', type: 'sqlite' };
    }

    // Test database connection with a simple query
    const result = db.prepare('SELECT 1 as test').get();

    if (result && (result as any).test === 1) {
      return { status: 'connected', type: 'sqlite' };
    } else {
      return { status: 'disconnected', type: 'sqlite' };
    }
  } catch (error) {
    return { status: 'disconnected', type: 'sqlite' };
  }
}

export default healthRouter;
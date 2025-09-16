import Database from 'better-sqlite3';
import { Router } from 'express';
import type { Request, Response, Router as ExpressRouter } from 'express';
import type { Logger } from 'pino';
import { z } from 'zod';

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
    type: z.string(),
  }),
});

const _ErrorResponseSchema = z.object({
  status: z.enum(['unhealthy']),
  error: z.string(),
  timestamp: z.string().datetime(),
});

type HealthResponse = z.infer<typeof HealthResponseSchema>;
type ErrorResponse = z.infer<typeof _ErrorResponseSchema>;

/**
 * Health check router
 */
export const healthRouter: ExpressRouter = Router();

function handleHealth(req: Request, res: Response<HealthResponse | ErrorResponse>): void {
  const logger = req.services?.get('logger') as Logger | undefined;
  const db = req.services?.get('database') as Database.Database;

  try {
    const dbStatus = checkDatabaseConnection(db);

    const healthData: HealthResponse = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '0.1.0',
      service: 'ctrl-freaq-api',
      uptime: Math.max(1, Math.floor(process.uptime())),
      environment: process.env.NODE_ENV || 'development',
      database: dbStatus,
    };

    const validated = HealthResponseSchema.parse(healthData);

    logger?.info(
      {
        requestId: req.requestId || 'unknown',
        action: 'health_check',
        status: 'success',
      },
      'Health check performed'
    );

    res.status(200).json(validated);
  } catch (error) {
    const errorResponse: ErrorResponse = {
      status: 'unhealthy',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    };

    logger?.error(
      {
        requestId: req.requestId || 'unknown',
        action: 'health_check',
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      'Health check failed'
    );

    res.status(503).json(errorResponse);
  }
}

/**
 * GET /health
 * Basic health check endpoint
 */
healthRouter.get('/health', async (req: Request, res: Response<HealthResponse | ErrorResponse>) => {
  handleHealth(req, res);
});

/**
 * GET /api/v1/health
 * Versioned health check endpoint (same implementation)
 */
healthRouter.get(
  '/api/v1/health',
  async (req: Request, res: Response<HealthResponse | ErrorResponse>) => {
    handleHealth(req, res);
  }
);

/**
 * Check database connection status
 */
function checkDatabaseConnection(db: Database.Database): {
  status: 'connected' | 'disconnected';
  type: string;
} {
  try {
    if (!db) {
      return { status: 'disconnected', type: 'sqlite' };
    }

    // Test database connection with a simple query
    const result = db.prepare('SELECT 1 as test').get() as { test?: number } | undefined;

    if (result && result.test === 1) {
      return { status: 'connected', type: 'sqlite' };
    } else {
      return { status: 'disconnected', type: 'sqlite' };
    }
  } catch {
    return { status: 'disconnected', type: 'sqlite' };
  }
}

export default healthRouter;

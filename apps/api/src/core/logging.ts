import { randomUUID } from 'crypto';
import type { IncomingMessage, ServerResponse, OutgoingHttpHeaders } from 'http';
import type { Request, Response, NextFunction } from 'express';

import pino from 'pino';
import type { Logger, LoggerOptions } from 'pino';
import pinoHttp from 'pino-http';

/**
 * Structured Logging Configuration with Pino
 *
 * Implements comprehensive logging system with:
 * - JSON format for structured logging
 * - Request correlation IDs
 * - Performance metrics
 * - Configurable log levels
 * - Sensitive data filtering
 *
 * Constitutional Compliance:
 * - Structured Logging: JSON format with consistent fields
 * - Observability Standards: Request tracking and performance metrics
 */

export interface LoggingConfig {
  level: 'debug' | 'info' | 'warn' | 'error';
  service: string;
  version: string;
  environment: 'development' | 'production' | 'test';
  enablePrettyPrint?: boolean;
  enablePerformanceLogging?: boolean;
  slowRequestThreshold?: number; // milliseconds
}

export interface LogContext {
  requestId?: string;
  userId?: string;
  action?: string;
  resource?: string;
  duration?: number;
  statusCode?: number;
  [key: string]: unknown;
}

/**
 * Sensitive data patterns to filter from logs
 */
const SENSITIVE_PATTERNS = [
  /password/i,
  /secret/i,
  /token/i,
  /authorization/i,
  /bearer/i,
  /api[_-]?key/i,
  /private[_-]?key/i,
  /credit[_-]?card/i,
  /ssn/i,
  /social[_-]?security/i,
];

/**
 * Redacts sensitive information from log data
 */
function redactSensitiveData(obj: unknown): unknown {
  if (typeof obj !== 'object' || obj === null) {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(redactSensitiveData);
  }

  const entries: [string, unknown][] = [];
  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    const keyLower = key.toLowerCase();

    // Check if key matches sensitive patterns
    const isSensitive = SENSITIVE_PATTERNS.some(pattern => pattern.test(keyLower));

    const redactedValue = isSensitive
      ? '[REDACTED]'
      : typeof value === 'object' && value !== null
        ? redactSensitiveData(value)
        : value;
    entries.push([key, redactedValue]);
  }

  return Object.fromEntries(entries);
}

/**
 * Custom serializers for different log contexts
 */
const customSerializers = {
  req: (req: IncomingMessage & { headers: NodeJS.Dict<string | string[] | undefined> }) => ({
    method: req.method,
    url: req.url,
    userAgent: req.headers['user-agent'],
    // Redact authorization header
    headers: redactSensitiveData(req.headers),
  }),

  res: (res: ServerResponse & { statusCode: number }) => ({
    statusCode: res.statusCode,
    headers: redactSensitiveData(res.getHeaders()),
  }),

  err: pino.stdSerializers.err,

  user: (u: unknown) => {
    const user = (u || {}) as { id?: unknown; email?: string };
    return {
      id: user?.id,
      email: user?.email ? `${user.email.split('@')[0]}@[REDACTED]` : undefined,
    };
  },

  database: (q: unknown) => {
    const query = (q || {}) as {
      operation?: string;
      table?: string;
      duration?: number;
      parameters?: Record<string, unknown>;
    };
    return {
      operation: query?.operation,
      table: query?.table,
      duration: query?.duration,
      // Log parameter keys (not values) for debugging
      parameterKeys: query?.parameters ? Object.keys(query.parameters) : [],
      hasParameters: !!(query?.parameters && Object.keys(query.parameters).length > 0),
    };
  },
};

/**
 * Creates base logger instance with configuration
 */
export function createLogger(config: LoggingConfig): Logger {
  const loggerOptions: LoggerOptions = {
    level: config.level,
    serializers: customSerializers,
    base: {
      service: config.service,
      version: config.version,
      environment: config.environment,
      pid: process.pid,
      hostname: process.env.HOSTNAME || 'unknown',
    },
    timestamp: pino.stdTimeFunctions.isoTime,
    formatters: {
      level: (label: string) => ({ level: label }),
      bindings: (bindings: Record<string, unknown>) => ({
        service: bindings.service,
        version: bindings.version,
        environment: bindings.environment,
        pid: bindings.pid,
        hostname: bindings.hostname,
      }),
    },
    redact: {
      paths: [
        'req.headers.authorization',
        'req.headers.cookie',
        'res.headers["set-cookie"]',
        'password',
        'token',
        'secret',
      ],
      censor: '[REDACTED]',
    },
  };

  // Enable pretty printing for development
  if (config.enablePrettyPrint && config.environment === 'development') {
    loggerOptions.transport = {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'SYS:standard',
        ignore: 'pid,hostname',
      },
    };
  }

  return pino(loggerOptions);
}

/**
 * Creates HTTP request logging middleware
 */
export function createHttpLogger(logger: Logger, _config: LoggingConfig) {
  return pinoHttp<IncomingMessage, ServerResponse, never>({
    logger: logger as Logger<never>,

    // Custom request ID generator (will be overridden by request-id middleware)
    genReqId: (req: IncomingMessage & { headers: NodeJS.Dict<string | string[] | undefined> }) =>
      (req.headers['x-request-id'] as string | undefined) || `req_${randomUUID()}`,

    // Custom log level based on status code
    customLogLevel: (
      _req: IncomingMessage,
      res: ServerResponse & { statusCode: number },
      error?: Error
    ) => {
      if (error || res.statusCode >= 500) {
        return 'error';
      }
      if (res.statusCode >= 400) {
        return 'warn';
      }
      if (res.statusCode >= 300) {
        return 'info';
      }
      return 'info';
    },

    // Custom success message
    customSuccessMessage: (
      req: IncomingMessage & { method?: string; url?: string },
      res: ServerResponse & { statusCode: number }
    ) => {
      return `${req.method} ${req.url} - ${res.statusCode}`;
    },

    // Custom error message
    customErrorMessage: (
      req: IncomingMessage & { method?: string; url?: string },
      res: ServerResponse & { statusCode: number },
      error: Error
    ) => {
      return `${req.method} ${req.url} - ${res.statusCode} - ${error.message}`;
    },

    // Custom attribute keys
    customAttributeKeys: {
      req: 'request',
      res: 'response',
      err: 'error',
      responseTime: 'duration',
    },

    // Auto-logging configuration
    autoLogging: {
      ignore: (req: IncomingMessage & { url?: string }) => {
        // Don't log health check requests to reduce noise
        return req.url === '/health' && process.env.NODE_ENV === 'production';
      },
    },

    // Custom request/response serializers
    serializers: {
      req: (req: Request) => ({
        method: req.method,
        url: req.url,
        userAgent: req.headers['user-agent'],
        ip: req.ip || req.connection?.remoteAddress,
        // Include user context if available
        userId: (req as unknown as { userId?: string }).userId,
        headers: redactSensitiveData(req.headers),
      }),

      res: (res: Response | (ServerResponse & { getHeaders: () => OutgoingHttpHeaders })) => ({
        statusCode: res.statusCode,
        headers: 'getHeaders' in res ? redactSensitiveData(res.getHeaders()) : {},
      }),
    },
  });
}

/**
 * Performance logging helper
 */
export class PerformanceLogger {
  constructor(
    private readonly logger: Logger,
    private readonly slowThreshold: number = 1000
  ) {}

  logDuration(operation: string, duration: number, context: LogContext = {}): void {
    const safeContext = redactSensitiveData(context) as Record<string, unknown>;
    const logData = {
      operation,
      duration,
      ...safeContext,
    };

    if (duration > this.slowThreshold) {
      this.logger.warn(logData, `Slow operation: ${operation} took ${duration}ms`);
    } else {
      this.logger.debug(logData, `Operation completed: ${operation} took ${duration}ms`);
    }
  }

  timeOperation<T>(
    operation: string,
    fn: () => T | Promise<T>,
    context: LogContext = {}
  ): T | Promise<T> {
    const start = Date.now();

    try {
      const result = fn();

      if (result instanceof Promise) {
        return result.then(
          value => {
            this.logDuration(operation, Date.now() - start, context);
            return value;
          },
          error => {
            const safeContext = redactSensitiveData(context) as Record<string, unknown>;
            this.logDuration(operation, Date.now() - start, {
              ...safeContext,
              error: error.message,
            });
            throw error;
          }
        ) as T;
      } else {
        this.logDuration(operation, Date.now() - start, context);
        return result;
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      const safeContext = redactSensitiveData(context) as Record<string, unknown>;
      this.logDuration(operation, Date.now() - start, {
        ...safeContext,
        error: message,
      });
      throw error as unknown as Error;
    }
  }
}

/**
 * Database operation logging
 */
export class DatabaseLogger {
  constructor(private readonly logger: Logger) {}

  logQuery(
    operation: string,
    table: string,
    duration: number,
    rowCount?: number,
    context: LogContext = {}
  ): void {
    const safeContext = redactSensitiveData(context) as Record<string, unknown>;
    const logData = {
      database: {
        operation,
        table,
        duration,
        rowCount,
      },
      ...safeContext,
    };

    if (duration > 100) {
      this.logger.warn(logData, `Slow database query: ${operation} on ${table} took ${duration}ms`);
    } else {
      this.logger.debug(logData, `Database query: ${operation} on ${table}`);
    }
  }
}

/**
 * Security event logging
 */
export class SecurityLogger {
  constructor(private readonly logger: Logger) {}

  logAuthenticationEvent(
    event: 'login' | 'logout' | 'failed_login' | 'token_refresh',
    userId?: string,
    context: LogContext = {}
  ): void {
    const safeContext = redactSensitiveData(context) as Record<string, unknown>;
    const logData = {
      security: {
        event,
        userId,
        timestamp: new Date().toISOString(),
      },
      ...safeContext,
    };

    if (event === 'failed_login') {
      this.logger.warn(logData, `Authentication failed for user ${userId || 'unknown'}`);
    } else {
      this.logger.info(logData, `Authentication event: ${event}`);
    }
  }

  logAuthorizationFailure(
    userId: string,
    resource: string,
    action: string,
    context: LogContext = {}
  ): void {
    const safeContext = redactSensitiveData(context) as Record<string, unknown>;
    const logData = {
      security: {
        event: 'authorization_failure',
        userId,
        resource,
        action,
        timestamp: new Date().toISOString(),
      },
      ...safeContext,
    };

    this.logger.warn(
      logData,
      `Authorization failed: user ${userId} attempted ${action} on ${resource}`
    );
  }
}

/**
 * Default logging configuration factory
 */
export function createDefaultLoggingConfig(): LoggingConfig {
  const environment = (process.env.NODE_ENV as LoggingConfig['environment']) || 'development';

  return {
    level:
      (process.env.LOG_LEVEL as LoggingConfig['level']) ||
      (environment === 'production' ? 'info' : 'debug'),
    service: 'ctrl-freaq-api',
    version: process.env.APP_VERSION || '0.1.0',
    environment,
    enablePrettyPrint: environment === 'development',
    enablePerformanceLogging: true,
    slowRequestThreshold: parseInt(process.env.SLOW_REQUEST_THRESHOLD || '1000', 10),
  };
}

/**
 * Graceful shutdown logging
 */
export function logShutdown(logger: Logger, signal: string): void {
  logger.info(
    {
      shutdown: {
        signal,
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
      },
    },
    `Graceful shutdown initiated by ${signal}`
  );
}

/**
 * Process error logging
 */
export function setupProcessErrorLogging(logger: Logger): void {
  process.on('uncaughtException', error => {
    logger.fatal({ error }, 'Uncaught exception occurred');
    process.exit(1);
  });

  process.on('unhandledRejection', (reason, promise) => {
    logger.error(
      {
        error: reason,
        promise: promise.toString(),
      },
      'Unhandled promise rejection'
    );
  });
}

/**
 * Express error logging middleware
 */
export function createErrorLoggingMiddleware(logger: Logger) {
  return (error: Error, req: Request, _res: Response, next: NextFunction): void => {
    const requestLogger = req.services?.get<Logger>('logger') || logger;

    requestLogger.error(
      {
        error: {
          message: error.message,
          stack: error.stack,
          name: error.name,
        },
        request: {
          method: req.method,
          url: req.url,
          userAgent: req.headers['user-agent'],
        },
      },
      `Request error: ${error.message}`
    );

    next(error);
  };
}

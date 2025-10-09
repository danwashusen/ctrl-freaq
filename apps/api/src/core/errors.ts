import type { Request, Response, NextFunction } from 'express';
import type { Logger } from 'pino';
import { ZodError } from 'zod';

/**
 * Error Handling Classes and Middleware
 *
 * Implements comprehensive error handling system with:
 * - Custom application error classes
 * - HTTP status code mapping
 * - Structured error responses
 * - Request correlation tracking
 * - Security-conscious error messages
 *
 * Constitutional Compliance:
 * - SOC 2 Implementation Rules: Safe error handling, no sensitive data exposure
 * - Structured Logging: All errors logged with context
 * - Observability Standards: Error tracking with correlation IDs
 */

export interface ErrorResponse {
  error: string;
  message: string;
  requestId: string;
  timestamp: string;
  details?: Record<string, unknown>;
}

export interface ValidationErrorDetail {
  field: string;
  message: string;
  value?: unknown;
}

/**
 * Base application error class
 */
export abstract class AppError extends Error {
  abstract readonly statusCode: number;
  abstract readonly errorCode: string;
  abstract readonly isOperational: boolean;

  constructor(
    message: string,
    public readonly context?: Record<string, unknown>
  ) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }

  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      message: this.message,
      statusCode: this.statusCode,
      errorCode: this.errorCode,
      context: this.context,
      stack: this.stack,
    };
  }

  getSafeDetails(): Record<string, unknown> | undefined {
    return undefined;
  }
}

/**
 * 400 Bad Request - Client sent invalid data
 */
export class ValidationError extends AppError {
  readonly statusCode = 400;
  readonly errorCode = 'VALIDATION_ERROR';
  readonly isOperational = true;

  constructor(
    message: string,
    public readonly validationErrors: ValidationErrorDetail[] = [],
    context?: Record<string, unknown>
  ) {
    super(message, context);
  }

  static fromZodError(error: ZodError): ValidationError {
    const validationErrors: ValidationErrorDetail[] = error.issues.map(err => ({
      field: err.path.join('.'),
      message: err.message,
      // omitting input value to avoid leaking sensitive data and because ZodIssue has no 'input' field
    }));

    return new ValidationError('Request validation failed', validationErrors, {
      zodIssues: error.issues,
    });
  }
}

/**
 * 401 Unauthorized - Authentication required or failed
 */
export class AuthenticationError extends AppError {
  readonly statusCode = 401;
  readonly errorCode = 'UNAUTHORIZED';
  readonly isOperational = true;

  constructor(message: string = 'Authentication required', context?: Record<string, unknown>) {
    super(message, context);
  }
}

/**
 * 403 Forbidden - Authenticated but insufficient permissions
 */
export class AuthorizationError extends AppError {
  readonly statusCode = 403;
  readonly errorCode = 'FORBIDDEN';
  readonly isOperational = true;

  constructor(message: string = 'Insufficient permissions', context?: Record<string, unknown>) {
    super(message, context);
  }
}

/**
 * 404 Not Found - Requested resource doesn't exist
 */
export class NotFoundError extends AppError {
  readonly statusCode = 404;
  readonly errorCode = 'NOT_FOUND';
  readonly isOperational = true;

  constructor(
    message: string = 'Resource not found',
    public readonly resourceType?: string,
    public readonly resourceId?: string,
    context?: Record<string, unknown>
  ) {
    super(message, { ...context, resourceType, resourceId });
  }
}

/**
 * 409 Conflict - Resource already exists or conflicts with current state
 */
export class ConflictError extends AppError {
  readonly statusCode = 409;
  readonly errorCode = 'CONFLICT';
  readonly isOperational = true;

  constructor(message: string, context?: Record<string, unknown>) {
    super(message, context);
  }
}

/**
 * 422 Unprocessable Entity - Valid syntax but semantically incorrect
 */
export class BusinessLogicError extends AppError {
  readonly statusCode = 422;
  readonly errorCode = 'BUSINESS_LOGIC_ERROR';
  readonly isOperational = true;

  constructor(message: string, context?: Record<string, unknown>) {
    super(message, context);
  }
}

/**
 * 429 Too Many Requests - Rate limit exceeded
 */
export class RateLimitError extends AppError {
  readonly statusCode = 429;
  readonly errorCode = 'RATE_LIMIT_EXCEEDED';
  readonly isOperational = true;

  constructor(
    message: string = 'Rate limit exceeded',
    public readonly retryAfter?: number,
    context?: Record<string, unknown>
  ) {
    super(message, { ...context, retryAfter });
  }
}

/**
 * 500 Internal Server Error - Unexpected server errors
 */
export class InternalServerError extends AppError {
  readonly statusCode = 500;
  readonly errorCode = 'INTERNAL_ERROR';
  readonly isOperational = false;

  constructor(message: string = 'An unexpected error occurred', context?: Record<string, unknown>) {
    super(message, context);
  }
}

/**
 * 503 Service Unavailable - External dependency failure
 */
export class ServiceUnavailableError extends AppError {
  readonly statusCode = 503;
  readonly errorCode = 'SERVICE_UNAVAILABLE';
  readonly isOperational = true;

  constructor(
    message: string,
    public readonly serviceName?: string,
    context?: Record<string, unknown>
  ) {
    super(message, { ...context, serviceName });
  }
}

/**
 * Database-specific errors
 */
export class DatabaseError extends AppError {
  readonly statusCode = 500;
  readonly errorCode = 'DATABASE_ERROR';
  readonly isOperational = false;

  constructor(
    message: string,
    public readonly operation?: string,
    public readonly table?: string,
    context?: Record<string, unknown>
  ) {
    super(message, { ...context, operation, table });
  }
}

/**
 * External service errors
 */
export class ExternalServiceError extends AppError {
  readonly statusCode: number;
  readonly errorCode = 'EXTERNAL_SERVICE_ERROR';
  readonly isOperational = true;

  constructor(
    message: string,
    public readonly serviceName: string,
    statusCode: number = 502,
    context?: Record<string, unknown>
  ) {
    super(message, { ...context, serviceName });
    this.statusCode = statusCode;
  }
}

/**
 * Error response formatter
 */
export class ErrorFormatter {
  static formatErrorResponse(
    error: Error,
    requestId: string,
    includeStack: boolean = false
  ): ErrorResponse {
    const timestamp = new Date().toISOString();

    if (error instanceof AppError) {
      const response: ErrorResponse = {
        error: error.errorCode,
        message: error.message,
        requestId,
        timestamp,
      };

      // Add validation errors for ValidationError
      if (error instanceof ValidationError && error.validationErrors.length > 0) {
        response.details = {
          validationErrors: error.validationErrors,
        };
      }

      // Add retry information for RateLimitError
      if (error instanceof RateLimitError && error.retryAfter) {
        response.details = {
          retryAfter: error.retryAfter,
        };
      }

      const safeDetails = error.getSafeDetails();
      if (safeDetails && Object.keys(safeDetails).length > 0) {
        response.details = {
          ...(response.details ?? {}),
          ...safeDetails,
        };
      }

      // Add stack trace if requested (development only)
      if (includeStack) {
        response.details = {
          ...response.details,
          stack: error.stack,
        };
      }

      return response;
    }

    // Handle Zod validation errors
    if (error instanceof ZodError) {
      const validationError = ValidationError.fromZodError(error);
      return this.formatErrorResponse(validationError, requestId, includeStack);
    }

    // Handle unknown errors
    return {
      error: 'INTERNAL_ERROR',
      message: includeStack ? error.message : 'An unexpected error occurred',
      requestId,
      timestamp,
      details: includeStack ? { stack: error.stack } : undefined,
    };
  }
}

/**
 * Error logging helper
 */
export class ErrorLogger {
  constructor(private readonly logger: Logger) {}

  logError(error: Error, context: Record<string, unknown> = {}): void {
    const logData: Record<string, unknown> = {
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack,
      },
      ...context,
    };

    if (error instanceof AppError) {
      const baseError = (logData.error || {}) as Record<string, unknown>;
      logData.error = {
        ...baseError,
        statusCode: error.statusCode,
        errorCode: error.errorCode,
        isOperational: error.isOperational,
        context: error.context,
      };

      // Log operational errors as warnings, non-operational as errors
      if (error.isOperational) {
        this.logger.warn(logData, `Operational error: ${error.message}`);
      } else {
        this.logger.error(logData, `System error: ${error.message}`);
      }
    } else {
      this.logger.error(logData, `Unexpected error: ${error.message}`);
    }
  }
}

/**
 * Express error handling middleware
 */
export function createErrorHandler() {
  return (error: Error, req: Request, res: Response, _next: NextFunction): void => {
    // Get request ID and logger from service container
    const requestId = (req.headers['x-request-id'] as string) || 'unknown';
    const logger = req.services?.get<Logger>('logger');

    // Log the error
    if (logger) {
      const errorLogger = new ErrorLogger(logger);
      errorLogger.logError(error, {
        requestId,
        method: req.method,
        url: req.url,
        userAgent: req.headers['user-agent'],
        ip: req.ip,
        userId: (req as unknown as { userId?: string }).userId,
        // SOC 2 audit fields
        created_at: new Date().toISOString(),
        created_by: (req as unknown as { userId?: string }).userId || 'anonymous',
        updated_at: new Date().toISOString(),
        updated_by: (req as unknown as { userId?: string }).userId || 'anonymous',
      });
    }

    // Determine if we should include stack traces
    const includeStack = process.env.NODE_ENV === 'development';

    // Format error response
    const errorResponse = ErrorFormatter.formatErrorResponse(error, requestId, includeStack);

    // Set status code
    let statusCode = 500;
    if (error instanceof AppError) {
      statusCode = error.statusCode;
    } else if (error instanceof ZodError) {
      statusCode = 400;
    }

    // Send error response
    res.status(statusCode).json(errorResponse);
  };
}

/**
 * 404 handler for unmatched routes
 */
export function createNotFoundHandler() {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const error = new NotFoundError(`Route ${req.method} ${req.path} not found`);
    next(error);
  };
}

/**
 * Async error wrapper for route handlers
 */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    void Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/**
 * Error boundary for critical sections
 */
export async function withErrorHandling<T>(
  operation: () => Promise<T>,
  context: Record<string, unknown> = {}
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    // Transform known error types
    if (error instanceof Error) {
      // Wrap non-operational errors with additional context rather than mutating
      if (error instanceof AppError) {
        // Rethrow as-is; upstream can include context separately
        throw error;
      }

      // Unknown Error subtype: wrap to include context
      throw new InternalServerError(error.message, context);
    }

    // Handle non-Error objects
    throw new InternalServerError('Unknown error occurred', { originalError: error, ...context });
  }
}

/**
 * Validation helper with error transformation
 */
export function validateRequest<T>(data: unknown, schema: { parse: (data: unknown) => T }): T {
  try {
    return schema.parse(data);
  } catch (error) {
    if (error instanceof ZodError) {
      throw ValidationError.fromZodError(error);
    }
    throw new ValidationError('Invalid request data');
  }
}

/**
 * Resource existence checker
 */
export function ensureResourceExists<T>(
  resource: T | null | undefined,
  resourceType: string,
  resourceId?: string
): T {
  if (!resource) {
    throw new NotFoundError(`${resourceType} not found`, resourceType, resourceId);
  }
  return resource;
}

/**
 * Authorization checker
 */
export function ensureAuthorized(
  condition: boolean,
  message: string = 'Access denied',
  context?: Record<string, unknown>
): void {
  if (!condition) {
    throw new AuthorizationError(message, context);
  }
}

/**
 * Business logic assertion
 */
export function assertBusinessRule(
  condition: boolean,
  message: string,
  context?: Record<string, unknown>
): void {
  if (!condition) {
    throw new BusinessLogicError(message, context);
  }
}

/**
 * Database operation wrapper
 */
export async function withDatabaseErrorHandling<T>(
  operation: () => Promise<T>,
  operationName: string,
  tableName?: string
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (error instanceof Error) {
      // Check for common database constraint violations
      if (error.message.includes('UNIQUE constraint failed')) {
        throw new ConflictError('Resource already exists');
      }

      if (error.message.includes('FOREIGN KEY constraint failed')) {
        throw new ValidationError('Invalid reference to related resource');
      }

      if (error.message.includes('NOT NULL constraint failed')) {
        throw new ValidationError('Required field is missing');
      }

      // Generic database error
      throw new DatabaseError(
        `Database operation failed: ${error.message}`,
        operationName,
        tableName
      );
    }

    throw new DatabaseError('Unknown database error', operationName, tableName);
  }
}

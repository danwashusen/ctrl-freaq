import { randomBytes } from 'crypto';

import type { Request, Response as ExpressResponse, NextFunction } from 'express';
import type { Logger } from 'pino';

/**
 * Request ID Middleware and Correlation Tracking
 *
 * Implements request correlation tracking with:
 * - Unique request ID generation
 * - Request ID propagation to downstream services
 * - HTTP header management
 * - Correlation across service boundaries
 *
 * Constitutional Compliance:
 * - Observability Standards: Request traceability
 * - SOC 2 Implementation Rules: Request tracking for audit trails
 */

export interface RequestIdConfig {
  headerName: string;
  generateId: () => string;
  setResponseHeader: boolean;
  logRequestId: boolean;
}

/**
 * Default request ID generator
 * Format: req_<timestamp>_<random>
 * Example: req_1694595600000_a7b9c3d2e1
 */
export function generateRequestId(): string {
  // Generate compact hex ID to satisfy /^req_[a-zA-Z0-9]+$/
  const random = randomBytes(10).toString('hex');
  return `req_${random}`;
}

/**
 * Cryptographically secure request ID generator
 * Format: req_<random_bytes>
 * Example: req_f47ac10b58cc4372a5670e02b2c3d479
 */
export function generateSecureRequestId(): string {
  const randomId = randomBytes(16).toString('hex');
  return `req_${randomId}`;
}

/**
 * Short request ID generator for high-volume environments
 * Format: req_<base62_encoded>
 * Example: req_Xp7A9c
 */
export function generateShortRequestId(): string {
  const random = randomBytes(4).readUInt32BE(0);
  const base62 = random.toString(36).toUpperCase();
  return `req_${base62}`;
}

/**
 * Request ID validation
 */
export function isValidRequestId(id: string): boolean {
  // Must start with req_ and contain only alphanumeric characters
  return /^req_[a-zA-Z0-9]+$/.test(id);
}

/**
 * Default configuration for request ID middleware
 */
export const DEFAULT_REQUEST_ID_CONFIG: RequestIdConfig = {
  headerName: 'x-request-id',
  generateId: generateRequestId,
  setResponseHeader: true,
  logRequestId: true,
};

/**
 * Creates request ID middleware with custom configuration
 */
export function createRequestIdMiddleware(
  config: Partial<RequestIdConfig> = {}
): (req: Request, res: ExpressResponse, next: NextFunction) => void {
  const fullConfig = { ...DEFAULT_REQUEST_ID_CONFIG, ...config };

  return (req: Request, res: ExpressResponse, next: NextFunction): void => {
    // Check if request already has an ID (from upstream service or load balancer)
    let requestId = req.headers[fullConfig.headerName] as string;

    // Validate existing request ID
    if (requestId && !isValidRequestId(requestId)) {
      // Invalid format, generate new one
      requestId = '';
    }

    // Generate new ID if none exists or invalid
    if (!requestId) {
      requestId = fullConfig.generateId();
    }

    // Set request ID in header for consistency
    req.headers[fullConfig.headerName] = requestId;

    // Set response header if configured
    if (fullConfig.setResponseHeader) {
      res.setHeader(fullConfig.headerName, requestId);
    }

    // Make request ID easily accessible
    (req as unknown as { requestId?: string }).requestId = requestId;

    // Log request ID if configured
    if (fullConfig.logRequestId && req.services) {
      try {
        const logger = req.services.get('logger') as Logger;
        logger?.debug({ requestId }, 'Request ID assigned');
      } catch {
        // Logger not available yet, ignore
      }
    }

    next();
  };
}

/**
 * Standard request ID middleware with default configuration
 */
export const requestIdMiddleware = createRequestIdMiddleware();

/**
 * Request correlation helper for downstream services
 */
export class RequestCorrelationHelper {
  constructor(private readonly requestId: string) {}

  /**
   * Creates headers object for downstream HTTP requests
   */
  getCorrelationHeaders(): Record<string, string> {
    return {
      'x-request-id': this.requestId,
      'x-correlation-id': this.requestId, // Alternative header name for some services
      'x-trace-id': this.requestId, // OpenTelemetry compatible
    };
  }

  /**
   * Propagates request ID to fetch requests
   */
  async fetchWithCorrelation(url: string, options: RequestInit = {}): Promise<globalThis.Response> {
    const headers = {
      ...this.getCorrelationHeaders(),
      ...options.headers,
    };

    return fetch(url, {
      ...options,
      headers,
    });
  }

  /**
   * Creates child request ID for sub-operations
   */
  createChildRequestId(operation: string): string {
    const childSuffix = randomBytes(3).toString('hex');
    return `${this.requestId}_${operation}_${childSuffix}`;
  }
}

/**
 * Express middleware to add correlation helper to request
 */
export function createCorrelationMiddleware() {
  return (req: Request, _res: ExpressResponse, next: NextFunction): void => {
    const requestId = req.headers['x-request-id'] as string;

    if (requestId) {
      (req as unknown as { correlation?: RequestCorrelationHelper }).correlation =
        new RequestCorrelationHelper(requestId);
    }

    next();
  };
}

/**
 * Request context for maintaining correlation across async operations
 */
export class RequestContext {
  private static contexts = new Map<string, RequestContext>();

  constructor(
    public readonly requestId: string,
    public readonly userId?: string,
    public readonly userAgent?: string,
    public readonly ip?: string
  ) {}

  static create(
    requestId: string,
    userId?: string,
    userAgent?: string,
    ip?: string
  ): RequestContext {
    const context = new RequestContext(requestId, userId, userAgent, ip);
    this.contexts.set(requestId, context);
    return context;
  }

  static get(requestId: string): RequestContext | undefined {
    return this.contexts.get(requestId);
  }

  static dispose(requestId: string): void {
    this.contexts.delete(requestId);
  }

  /**
   * Execute operation with request context
   */
  async withContext<T>(operation: () => Promise<T>): Promise<T> {
    // Store current context
    const currentContext = RequestContext.contexts.get(this.requestId);

    try {
      // Set this context as active
      RequestContext.contexts.set(this.requestId, this);

      // Execute operation
      return await operation();
    } finally {
      // Restore previous context or remove if none existed
      if (currentContext) {
        RequestContext.contexts.set(this.requestId, currentContext);
      } else {
        RequestContext.contexts.delete(this.requestId);
      }
    }
  }

  /**
   * Get correlation metadata
   */
  getMetadata(): Record<string, unknown> {
    return {
      requestId: this.requestId,
      userId: this.userId,
      userAgent: this.userAgent,
      ip: this.ip,
      timestamp: new Date().toISOString(),
    };
  }
}

/**
 * Express middleware to create request context
 */
export function createRequestContextMiddleware() {
  return (req: Request, res: ExpressResponse, next: NextFunction): void => {
    const requestId = req.headers['x-request-id'] as string;
    const userId = (req as unknown as { userId?: string }).userId;
    const userAgent = req.headers['user-agent'] as string | undefined;
    const ip = req.ip || req.socket.remoteAddress;

    if (requestId) {
      const context = RequestContext.create(requestId, userId, userAgent, ip);
      (req as unknown as { context?: RequestContext }).context = context;

      // Clean up context when request finishes
      res.on('finish', () => {
        RequestContext.dispose(requestId);
      });

      res.on('close', () => {
        RequestContext.dispose(requestId);
      });
    }

    next();
  };
}

/**
 * Distributed tracing integration helpers
 */
export interface TraceContext {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  baggage?: Record<string, string>;
}

/**
 * Extract trace context from request headers
 */
export function extractTraceContext(req: Request): TraceContext | null {
  // Support multiple trace header formats
  const traceParent = req.headers['traceparent'] as string;
  const traceState = req.headers['tracestate'] as string;
  const xTraceId = req.headers['x-trace-id'] as string;
  const xSpanId = req.headers['x-span-id'] as string;

  // W3C Trace Context format
  if (traceParent) {
    const parts = traceParent.split('-');
    if (parts.length >= 4) {
      const [, traceId, spanId] = parts;
      return {
        traceId: traceId as string,
        spanId: spanId as string,
        parentSpanId: spanId as string,
        baggage: traceState ? parseTraceState(traceState) : undefined,
      };
    }
  }

  // Custom header format
  if (xTraceId) {
    return {
      traceId: xTraceId,
      spanId: xSpanId || generateSpanId(),
      baggage: {},
    };
  }

  // Use request ID as trace ID if no trace context
  const requestId = req.headers['x-request-id'] as string;
  if (requestId) {
    return {
      traceId: requestId,
      spanId: generateSpanId(),
      baggage: {},
    };
  }

  return null;
}

/**
 * Generate span ID for distributed tracing
 */
function generateSpanId(): string {
  return randomBytes(8).toString('hex');
}

/**
 * Parse W3C trace state header
 */
function parseTraceState(traceState: string): Record<string, string> {
  const entries: Array<[string, string]> = [];

  traceState.split(',').forEach(entry => {
    const [key, value] = entry.trim().split('=');
    if (key && value) {
      // Only allow safe token-like keys
      if (/^[a-zA-Z0-9_.-]+$/.test(key)) {
        entries.push([key, value]);
      }
    }
  });

  return Object.fromEntries(entries);
}

/**
 * Middleware to extract and propagate trace context
 */
export function createTraceContextMiddleware() {
  return (req: Request, res: ExpressResponse, next: NextFunction): void => {
    const traceContext = extractTraceContext(req);

    if (traceContext) {
      (req as unknown as { traceContext?: TraceContext }).traceContext = traceContext;

      // Set response headers for trace propagation
      res.setHeader('x-trace-id', traceContext.traceId || '');
      res.setHeader('x-span-id', traceContext.spanId || '');
    }

    next();
  };
}

/**
 * Combined middleware for complete request correlation
 */
export function createFullCorrelationMiddleware(requestIdConfig?: Partial<RequestIdConfig>) {
  const requestIdMw = createRequestIdMiddleware(requestIdConfig);
  const correlationMw = createCorrelationMiddleware();
  const contextMw = createRequestContextMiddleware();
  const traceMw = createTraceContextMiddleware();

  return [requestIdMw, correlationMw, contextMw, traceMw];
}

/**
 * Utility to get request ID from current request
 */
export function getCurrentRequestId(req?: Request): string | undefined {
  if (req) {
    return req.headers['x-request-id'] as string;
  }

  // Try to extract from async context if available
  // This would require async_hooks implementation for full context tracking
  return undefined;
}

/**
 * Log correlation helper
 */
export function withRequestCorrelation<T>(_requestId: string, operation: () => T): T {
  // This would integrate with async context tracking in a full implementation
  // For now, just execute the operation
  return operation();
}

import type { Database } from 'better-sqlite3';
import type { Request, Response, NextFunction } from 'express';
import type { Logger } from 'pino';

/**
 * Service Locator Pattern Implementation
 *
 * Provides per-request dependency injection container to avoid singleton pattern.
 * Services are scoped to individual HTTP requests for isolation and testability.
 *
 * Key Features:
 * - Per-request service containers
 * - Type-safe service resolution
 * - Factory function support
 * - Circular dependency detection
 * - Graceful error handling
 *
 * Constitutional Compliance:
 * - No Singletons: Each request gets isolated service container
 * - Service Locator Pattern: Dependency injection without tight coupling
 */

export interface ServiceContainer {
  get<T>(serviceName: string): T;
  register<T>(serviceName: string, service: T | ServiceFactory<T>): void;
  has(serviceName: string): boolean;
  dispose(): Promise<void>;
}

export type ServiceFactory<T> = (container: ServiceContainer) => T;

export interface DisposableService {
  dispose(): Promise<void> | void;
}

export class ServiceLocatorError extends Error {
  constructor(
    message: string,
    public readonly serviceName?: string
  ) {
    super(message);
    this.name = 'ServiceLocatorError';
  }
}

export class CircularDependencyError extends ServiceLocatorError {
  constructor(serviceName: string, dependencyChain: string[]) {
    super(
      `Circular dependency detected for service '${serviceName}'. ` +
        `Dependency chain: ${dependencyChain.join(' -> ')} -> ${serviceName}`,
      serviceName
    );
    this.name = 'CircularDependencyError';
  }
}

/**
 * Per-request service container implementation
 */
export class RequestServiceContainer implements ServiceContainer {
  private readonly services = new Map<string, unknown>();
  private readonly factories = new Map<string, ServiceFactory<unknown>>();
  private readonly resolutionStack: string[] = [];
  private disposed = false;

  get<T>(serviceName: string): T {
    this.checkDisposed();

    // Check for circular dependencies
    if (this.resolutionStack.includes(serviceName)) {
      throw new CircularDependencyError(serviceName, [...this.resolutionStack]);
    }

    // Return existing instance if available
    if (this.services.has(serviceName)) {
      return this.services.get(serviceName) as T;
    }

    // Try to create from factory
    if (this.factories.has(serviceName)) {
      this.resolutionStack.push(serviceName);

      try {
        const factory = this.factories.get(serviceName);
        if (!factory) {
          throw new ServiceLocatorError(`Factory not found for '${serviceName}'`, serviceName);
        }
        const service = factory(this);
        this.services.set(serviceName, service);
        return service as T;
      } finally {
        this.resolutionStack.pop();
      }
    }

    throw new ServiceLocatorError(`Service '${serviceName}' is not registered`, serviceName);
  }

  register<T>(serviceName: string, service: T | ServiceFactory<T>): void {
    this.checkDisposed();

    if (typeof service === 'function') {
      this.factories.set(serviceName, service as ServiceFactory<T>);
    } else {
      this.services.set(serviceName, service);
    }
  }

  has(serviceName: string): boolean {
    this.checkDisposed();
    return this.services.has(serviceName) || this.factories.has(serviceName);
  }

  async dispose(): Promise<void> {
    if (this.disposed) {
      return;
    }

    this.disposed = true;

    // Dispose all services that implement DisposableService
    const disposalPromises: Promise<void>[] = [];

    for (const [serviceName, service] of this.services.entries()) {
      const maybeDisposable = service as { dispose?: unknown };
      if (service && typeof maybeDisposable.dispose === 'function') {
        try {
          const result = (service as DisposableService).dispose();
          if (result instanceof Promise) {
            disposalPromises.push(result);
          }
        } catch (error) {
          const line = `Error disposing service '${serviceName}': ${
            error instanceof Error ? error.message : String(error)
          }\n`;
          process.stderr.write(line);
        }
      }
    }

    if (disposalPromises.length > 0) {
      await Promise.all(disposalPromises);
    }

    this.services.clear();
    this.factories.clear();
    this.resolutionStack.length = 0;
  }

  private checkDisposed(): void {
    if (this.disposed) {
      throw new ServiceLocatorError('Service container has been disposed');
    }
  }
}

/**
 * Core service types for type safety
 */
export interface CoreServices {
  logger: Logger;
  database: Database;
  requestId: string;
  userId?: string;
}

/**
 * Factory functions for core services
 */
export const createLoggerFactory = (
  baseLogger: Logger,
  requestId: string,
  userId?: string
): ServiceFactory<Logger> => {
  return () => {
    return baseLogger.child({
      requestId,
      userId,
      component: 'api',
    });
  };
};

export const createDatabaseFactory = (database: Database): ServiceFactory<Database> => {
  return () => {
    // Create transaction wrapper for database operations
    const transactionWrapper = {
      ...database,
      transaction: (callback: (db: typeof database) => Promise<unknown> | unknown) => {
        return database.transaction(callback);
      },
      exec: database.exec,
      prepare: database.prepare,
      close: database.close,
    };

    return transactionWrapper;
  };
};

/**
 * Service registration helpers
 */
export class ServiceRegistrar {
  static registerCoreServices(
    container: ServiceContainer,
    baseLogger: Logger,
    database: Database,
    requestId: string,
    userId?: string
  ): void {
    // Register logger with request context
    container.register('logger', createLoggerFactory(baseLogger, requestId, userId));

    // Register database connection
    container.register('database', createDatabaseFactory(database));

    // Register request context
    container.register('requestId', requestId);

    if (userId) {
      container.register('userId', userId);
    }
  }

  static registerCustomService<T>(
    container: ServiceContainer,
    serviceName: string,
    serviceOrFactory: T | ServiceFactory<T>
  ): void {
    container.register(serviceName, serviceOrFactory);
  }
}

/**
 * Express.js integration types
 */
declare global {
  namespace Express {
    interface Request {
      services: ServiceContainer;
      requestId?: string;
      userId?: string;
    }
  }
}

/**
 * Middleware factory for Express.js integration
 */
export function createServiceLocatorMiddleware(baseLogger: Logger, database: Database) {
  return (req: Request, res: Response, next: NextFunction): void => {
    // Create per-request service container
    const container = new RequestServiceContainer();

    // Get request ID (should be set by request-id middleware)
    const requestId = (req.headers['x-request-id'] as string) || 'unknown';

    // Extract user ID from JWT (will be set by auth middleware)
    const userId = (req as unknown as { userId?: string }).userId;

    // Register core services
    ServiceRegistrar.registerCoreServices(container, baseLogger, database, requestId, userId);

    // Attach container to request
    req.services = container;

    // Track disposal to prevent double disposal
    let disposed = false;
    const safeDispose = () => {
      if (!disposed) {
        disposed = true;
        container.dispose().catch(error => {
          const line = `Error disposing service container: ${
            error instanceof Error ? error.message : String(error)
          }\n`;
          process.stderr.write(line);
        });
      }
    };

    // Clean up on response finish
    res.on('finish', safeDispose);

    // Clean up on connection close (backup cleanup)
    res.on('close', safeDispose);

    next();
  };
}

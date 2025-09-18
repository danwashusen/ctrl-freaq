import { clerkMiddleware } from '@clerk/express';
import type { Request, Response, NextFunction } from 'express';
import type { Logger } from 'pino';
import { setInterval, clearInterval } from 'node:timers';

/**
 * Extended Request interface with Clerk authentication
 */
export interface AuthenticatedRequest extends Request {
  user?: {
    userId: string;
    email?: string;
    name?: string;
    imageUrl?: string;
  };
  requestId?: string;
  auth?: {
    userId?: string;
    sessionId?: string;
    orgId?: string;
    orgRole?: string;
    orgPermissions?: string[];
  };
}

/**
 * Error response for authentication failures
 */
interface AuthErrorResponse {
  error: string;
  message: string;
  requestId: string;
  timestamp: string;
}

/**
 * Clerk authentication middleware
 * Uses Clerk's Express SDK to validate JWT tokens
 */
export const clerkAuthMiddleware: (req: Request, res: Response, next: NextFunction) => void =
  clerkMiddleware();

/**
 * Middleware to require authentication
 * Call this after clerkAuthMiddleware to enforce authentication
 */
export const requireAuth = (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
  const logger = req.services?.get('logger') as Logger | undefined;
  const requestId = req.requestId || 'unknown';

  try {
    // Check if user is authenticated via Clerk
    if (!req.auth?.userId) {
      logger?.warn(
        {
          requestId,
          path: req.path,
          method: req.method,
          reason: 'missing_user_id',
        },
        'Authentication required but user ID not found'
      );

      const errorResponse: AuthErrorResponse = {
        error: 'UNAUTHORIZED',
        message: 'Authentication required',
        requestId,
        timestamp: new Date().toISOString(),
      };

      res.status(401).json(errorResponse);
      return;
    }

    // Populate user information for easier access
    req.user = {
      userId: req.auth.userId,
      // Note: In MVP, we don't store additional user info locally
      // It would come from Clerk API calls if needed
    };

    logger?.debug(
      {
        requestId,
        userId: req.auth.userId,
        sessionId: req.auth.sessionId,
        path: req.path,
        method: req.method,
      },
      'User authenticated successfully'
    );

    next();
  } catch (error) {
    logger?.error(
      {
        requestId,
        error: error instanceof Error ? error.message : 'Unknown error',
        path: req.path,
        method: req.method,
      },
      'Error in authentication middleware'
    );

    const errorResponse: AuthErrorResponse = {
      error: 'INTERNAL_ERROR',
      message: 'Authentication check failed',
      requestId,
      timestamp: new Date().toISOString(),
    };

    res.status(500).json(errorResponse);
  }
};

/**
 * Optional authentication middleware
 * Populates user info if token is present, but doesn't require it
 */
export const optionalAuth = (
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction
): void => {
  try {
    if (req.auth?.userId) {
      req.user = {
        userId: req.auth.userId,
      };
    }

    next();
  } catch {
    // Don't fail if optional auth has issues
    next();
  }
};

/**
 * Middleware to log authentication events
 */
export const logAuthEvent = (event: 'login' | 'logout' | 'access') => {
  return (req: AuthenticatedRequest, _res: Response, next: NextFunction): void => {
    const logger = req.services?.get('logger') as Logger | undefined;
    const requestId = req.requestId || 'unknown';

    if (req.auth?.userId) {
      logger?.info(
        {
          requestId,
          userId: req.auth.userId,
          sessionId: req.auth.sessionId,
          event,
          path: req.path,
          method: req.method,
          ip: req.ip,
          userAgent: req.get('User-Agent'),
        },
        `Authentication event: ${event}`
      );
    }

    next();
  };
};

/**
 * Extract user information from Clerk token claims
 * This would typically call Clerk API for full user details
 */
export const enrichUserInfo = async (
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  const logger = req.services?.get('logger') as Logger | undefined;

  try {
    if (req.user?.userId) {
      // In a full implementation, this would fetch user details from Clerk
      // For MVP, we'll just use the basic info we have
      logger?.debug(
        {
          requestId: req.requestId,
          userId: req.user.userId,
        },
        'User info enriched (MVP: basic info only)'
      );
    }

    next();
  } catch (error) {
    logger?.warn(
      {
        requestId: req.requestId,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      'Failed to enrich user info, continuing with basic auth'
    );

    // Don't fail the request if enrichment fails
    next();
  }
};

/**
 * Helper function to extract user ID from request
 */
export const getUserId = (req: AuthenticatedRequest): string | null => {
  return req.user?.userId || req.auth?.userId || null;
};

/**
 * Helper function to check if user is authenticated
 */
export const isAuthenticated = (req: AuthenticatedRequest): boolean => {
  return !!(req.user?.userId || req.auth?.userId);
};

/**
 * Rate limiting by user ID for authenticated endpoints
 */
export const createUserRateLimit = (windowMs: number, maxRequests: number) => {
  const userRequestCounts = new Map<string, { count: number; resetTime: number }>();

  // Cleanup old entries every 5 minutes to prevent memory leaks
  const cleanupInterval = setInterval(
    () => {
      const now = Date.now();
      for (const [userId, info] of userRequestCounts.entries()) {
        if (now > info.resetTime) {
          userRequestCounts.delete(userId);
        }
      }
    },
    5 * 60 * 1000
  ); // 5 minutes

  // Clean up interval on process exit
  process.on('exit', () => clearInterval(cleanupInterval));

  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    const userId = getUserId(req);
    const logger = req.services?.get('logger') as Logger | undefined;

    if (!userId) {
      // If no user ID, skip rate limiting (let other auth middleware handle)
      return next();
    }

    const now = Date.now();
    const userKey = userId;
    let userInfo = userRequestCounts.get(userKey);

    if (!userInfo || now > userInfo.resetTime) {
      userInfo = {
        count: 0,
        resetTime: now + windowMs,
      };
      userRequestCounts.set(userKey, userInfo);
    }

    if (userInfo.count >= maxRequests) {
      const retryAfterSeconds = Math.max(1, Math.ceil((userInfo.resetTime - now) / 1000));
      const resetEpochSeconds = Math.ceil(userInfo.resetTime / 1000);

      logger?.warn(
        {
          requestId: req.requestId,
          userId,
          rateLimitWindow: windowMs,
          maxRequests,
          currentCount: userInfo.count,
        },
        'Rate limit exceeded for user'
      );

      res.setHeader('Retry-After', retryAfterSeconds.toString());
      res.setHeader('X-RateLimit-Limit', String(maxRequests));
      res.setHeader('X-RateLimit-Remaining', '0');
      res.setHeader('X-RateLimit-Reset', resetEpochSeconds.toString());

      const errorResponse: AuthErrorResponse = {
        error: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many requests. Please try again later.',
        requestId: req.requestId || 'unknown',
        timestamp: new Date().toISOString(),
      };

      res.status(429).json(errorResponse);
      return;
    }

    // Increment counter
    userInfo.count++;

    const remaining = Math.max(0, maxRequests - userInfo.count);
    const resetEpochSeconds = Math.ceil(userInfo.resetTime / 1000);
    res.setHeader('X-RateLimit-Limit', String(maxRequests));
    res.setHeader('X-RateLimit-Remaining', remaining.toString());
    res.setHeader('X-RateLimit-Reset', resetEpochSeconds.toString());
    next();
  };
};

/**
 * Cleanup function for rate limit maps (call periodically)
 */
export const cleanupRateLimitCache = (): void => {
  // This would clean up expired entries from rate limit maps
  // Implementation would depend on how you want to manage memory
};

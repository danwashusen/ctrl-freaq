import type { NextFunction, Response } from 'express';
import type { AuthenticatedRequest } from './auth.js';

/**
 * Test-only auth shim to ease contract/integration testing without Clerk.
 * If NODE_ENV === 'test' and an Authorization header is present, populate req.auth.userId.
 */
export function testAuthShim(req: AuthenticatedRequest, _res: Response, next: NextFunction): void {
  if (process.env.NODE_ENV === 'test') {
    const auth = req.headers.authorization || req.headers.Authorization;
    if (auth && typeof auth === 'string' && auth.toLowerCase().startsWith('bearer')) {
      const token = auth.slice('bearer'.length).trim();
      // Only accept specific mock token; otherwise treat as unauthenticated
      if (token === 'mock-jwt-token') {
        req.auth = req.auth || {};
        // Use deterministic mock user ID expected by tests when present
        req.auth.userId = req.auth.userId || 'user_2abc123def456';
      }
    }
  }
  next();
}

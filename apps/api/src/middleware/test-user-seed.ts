import type { NextFunction, Response } from 'express';
import type { AuthenticatedRequest } from './auth.js';
import type { Database } from 'better-sqlite3';

/**
 * Test-only middleware to ensure a user row exists for the authenticated user.
 * Avoids FK issues in tests that insert rows referencing users.
 */
export function ensureTestUserMiddleware(
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction
): void {
  try {
    if (process.env.NODE_ENV === 'test' && req.auth?.userId && req.services) {
      const db = req.services.get<Database>('database');
      const id = req.auth.userId;
      const email = `${id}@test.local`;
      // Minimal insert; fields with defaults will be populated automatically
      db.prepare(
        'INSERT OR IGNORE INTO users (id, email, first_name, last_name, created_by, updated_by) VALUES (?, ?, NULL, NULL, ?, ?)'
      ).run(id, email, id, id);
    }
  } catch {
    // ignore in tests
  }
  next();
}

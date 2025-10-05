import type { NextFunction, Response } from 'express';
import type { Database } from 'better-sqlite3';
import type { AuthenticatedRequest } from './auth.js';
import { isTestRuntime } from '../utils/runtime-env.js';

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
    if (isTestRuntime() && req.auth?.userId && req.services) {
      const db = req.services.get<Database>('database');
      const id = req.auth.userId;
      const email = `${id}@test.local`;
      db.prepare(
        'INSERT OR IGNORE INTO users (id, email, first_name, last_name, created_by, updated_by) VALUES (?, ?, ?, ?, ?, ?)'
      ).run('system', 'system@ctrl-freaq.local', 'System', 'User', 'system', 'system');
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

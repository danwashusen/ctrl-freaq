import type { NextFunction, Response } from 'express';
import type { Database } from 'better-sqlite3';
import type { Logger } from 'pino';

import type { AuthenticatedRequest } from './auth.js';
import {
  SimpleAuthService,
  SimpleAuthServiceError,
  type SimpleAuthUser,
} from '../services/simple-auth.service.js';
import { isTestRuntime } from '../utils/runtime-env.js';

const upsertUsers = (db: Database, users: SimpleAuthUser[]) => {
  const ensureSystemUser = db.prepare(
    'INSERT OR IGNORE INTO users (id, email, first_name, last_name, created_by, updated_by) VALUES (?, ?, ?, ?, ?, ?)'
  );
  ensureSystemUser.run('system', 'system@ctrl-freaq.local', 'System', 'User', 'system', 'system');

  const upsertStatement = db.prepare(`
    INSERT INTO users (id, email, first_name, last_name, created_by, updated_by)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      email = excluded.email,
      first_name = excluded.first_name,
      last_name = excluded.last_name,
      updated_at = datetime('now'),
      updated_by = excluded.updated_by
  `);

  const apply = db.transaction((records: SimpleAuthUser[]) => {
    for (const user of records) {
      upsertStatement.run(
        user.id,
        user.email,
        user.first_name ?? null,
        user.last_name ?? null,
        'system',
        'system'
      );
    }
  });

  apply(users);
};

const resolveLogger = (req: AuthenticatedRequest): Logger | undefined => {
  try {
    return req.services?.get<Logger>('logger');
  } catch {
    return undefined;
  }
};

/**
 * Middleware to ensure user rows exist for authenticated requests in test or simple auth mode.
 */
export async function ensureTestUserMiddleware(
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction
): Promise<void> {
  const logger = resolveLogger(req);

  try {
    if (!req.services) {
      next();
      return;
    }

    const db = req.services.get<Database>('database');

    const simpleAuthService = req.services.has('simpleAuthService')
      ? req.services.get<SimpleAuthService>('simpleAuthService')
      : null;

    const userRegistry = new Map<string, SimpleAuthUser>();

    if (isTestRuntime() && req.auth?.userId) {
      userRegistry.set(req.auth.userId, {
        id: req.auth.userId,
        email: `${req.auth.userId}@test.local`,
      });
    }

    if (simpleAuthService) {
      const simpleUsers = await simpleAuthService.listUsers();
      for (const simpleUser of simpleUsers) {
        userRegistry.set(simpleUser.id, simpleUser);
      }
    }

    const usersToEnsure = Array.from(userRegistry.values());
    if (usersToEnsure.length > 0) {
      upsertUsers(db, usersToEnsure);
    }
  } catch (error) {
    if (error instanceof SimpleAuthServiceError) {
      logger?.error(
        {
          error: error.message,
          requestId: req.requestId ?? 'unknown',
        },
        'Failed to seed simple auth users into SQLite'
      );
      next(error);
      return;
    }

    if (!isTestRuntime()) {
      const normalizedError =
        error instanceof Error
          ? error
          : new Error(typeof error === 'string' ? error : 'Unknown error');
      logger?.error(
        {
          error: normalizedError.message,
          requestId: req.requestId ?? 'unknown',
        },
        'Unexpected error while ensuring test users exist'
      );
      next(normalizedError);
      return;
    }
  }

  next();
}

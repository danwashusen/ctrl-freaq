import type { Request, Response, NextFunction } from 'express';
import type Database from 'better-sqlite3';

import {
  ProjectRepositoryImpl,
  ConfigurationRepositoryImpl,
  ActivityLogRepositoryImpl,
} from '@ctrl-freaq/shared-data';

/**
 * Registers repository factories into the per-request service container.
 * Routes can then resolve via `req.services.get('<name>')` instead of `new`.
 */
export function createRepositoryRegistrationMiddleware() {
  return (req: Request, _res: Response, next: NextFunction) => {
    const container = req.services;
    if (!container) return next();

    // Database is provided by core service-locator
    const getDb = () => container.get<Database.Database>('database');

    // Register repositories as factories to ensure fresh instances per request
    container.register('projectRepository', () => new ProjectRepositoryImpl(getDb()));
    container.register('configurationRepository', () => new ConfigurationRepositoryImpl(getDb()));
    container.register('activityLogRepository', () => new ActivityLogRepositoryImpl(getDb()));

    next();
  };
}

import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

import Database from 'better-sqlite3';

import { loadSharedDataMigrations } from './index.js';

export interface RunSharedDataMigrationsOptions {
  databasePath: string;
  logger?: Pick<Console, 'info' | 'warn' | 'error'>;
}

export interface RunSharedDataMigrationsResult {
  applied: number;
}

export function runSharedDataMigrations(
  options: RunSharedDataMigrationsOptions
): RunSharedDataMigrationsResult {
  const logger = options.logger ?? console;
  const { databasePath } = options;

  mkdirSync(dirname(databasePath), { recursive: true });

  const migrations = loadSharedDataMigrations();
  if (migrations.length === 0) {
    logger.info({ databasePath, applied: 0 }, 'No shared-data migrations to apply');
    return { applied: 0 };
  }

  const database = new Database(databasePath);
  try {
    database.exec('BEGIN');
    for (const migration of migrations) {
      logger.info(
        { version: migration.version, name: migration.name, databasePath },
        'Applying shared-data migration'
      );
      database.exec(migration.sql);
    }
    database.exec('COMMIT');
  } catch (error) {
    database.exec('ROLLBACK');
    logger.error({ error, databasePath }, 'Failed to apply shared-data migrations');
    throw error;
  } finally {
    database.close();
  }

  logger.info({ databasePath, applied: migrations.length }, 'Shared-data migrations applied');
  return { applied: migrations.length };
}

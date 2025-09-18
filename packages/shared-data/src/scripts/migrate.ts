#!/usr/bin/env node

import { resolveWorkspaceDatabasePath } from '../utils/database-path.js';
import { runSharedDataMigrations } from '../migrations/run-migrations.js';

async function main(): Promise<void> {
  const databasePath = resolveWorkspaceDatabasePath();
  const logger = console;

  logger.info({ databasePath }, 'Starting shared-data migrations');
  runSharedDataMigrations({ databasePath, logger });
  logger.info({ databasePath }, 'Shared-data migrations complete');
}

void main().catch(error => {
  console.error({ error }, 'Shared-data migrations failed');
  process.exitCode = 1;
});

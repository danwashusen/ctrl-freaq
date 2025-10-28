import { createHash } from 'crypto';
import { existsSync, readdirSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

/**
 * Shared data migrations loader.
 *
 * Provides structured metadata for SQL migrations stored in
 * `packages/shared-data/migrations`. Consumers (API, CLI, tests) can merge
 * these statements into their migration pipelines to ensure template catalog
 * tables stay in sync.
 */
export interface SharedDataMigration {
  version: number;
  name: string;
  sql: string;
  checksum: string;
}

const MIGRATIONS_DIR = (() => {
  const __dirname = dirname(fileURLToPath(import.meta.url));
  return join(__dirname, '..', '..', 'migrations');
})();

/**
 * Load all SQL migrations for the shared data package.
 */
export function loadSharedDataMigrations(): SharedDataMigration[] {
  if (!existsSync(MIGRATIONS_DIR)) {
    return [];
  }

  return readdirSync(MIGRATIONS_DIR)
    .filter(file => file.endsWith('.sql'))
    .map(file => {
      const [versionString, ...rest] = file.split('_');
      if (!versionString) {
        throw new Error(`Invalid migration filename: ${file}`);
      }

      const version = Number.parseInt(versionString, 10);
      if (Number.isNaN(version)) {
        throw new Error(`Invalid migration filename: ${file}`);
      }
      const name = rest.join('_').replace(/\.sql$/u, '');
      const sql = readFileSync(join(MIGRATIONS_DIR, file), 'utf-8');
      const checksum = createHash('sha256').update(sql).digest('hex');

      return { version, name, sql, checksum } satisfies SharedDataMigration;
    })
    .sort((a, b) => a.version - b.version);
}

/**
 * Utility to expose the absolute migrations directory for tooling that prefers
 * to stream files itself (e.g., Turbo tasks or external CLIs).
 */
export function getSharedDataMigrationsDir(): string {
  return MIGRATIONS_DIR;
}

export {
  PROJECT_LIFECYCLE_MIGRATION_VERSION,
  PROJECT_LIFECYCLE_MIGRATION_NAME,
  loadProjectLifecycleMigrationSql,
  getProjectLifecycleMigrationPath,
} from './20251025_project_lifecycle.js';

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const PROJECT_LIFECYCLE_MIGRATION_VERSION = 20251025;
export const PROJECT_LIFECYCLE_MIGRATION_NAME = 'project_lifecycle';

const __dirname = dirname(fileURLToPath(import.meta.url));
const MIGRATION_FILE = join(__dirname, '..', '..', 'migrations', '20251025_project_lifecycle.sql');

export function loadProjectLifecycleMigrationSql(): string {
  return readFileSync(MIGRATION_FILE, 'utf-8');
}

export function getProjectLifecycleMigrationPath(): string {
  return MIGRATION_FILE;
}

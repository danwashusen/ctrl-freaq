import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const QUALITY_GATES_MIGRATION_VERSION = 20251013;
export const QUALITY_GATES_MIGRATION_NAME = 'quality_gates';

const __dirname = dirname(fileURLToPath(import.meta.url));
const MIGRATION_FILE = join(__dirname, '..', '..', 'migrations', '20251013_quality_gates.sql');

export function loadQualityGatesMigrationSql(): string {
  return readFileSync(MIGRATION_FILE, 'utf-8');
}

export function getQualityGatesMigrationPath(): string {
  return MIGRATION_FILE;
}

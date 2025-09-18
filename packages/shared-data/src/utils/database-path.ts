import { mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { resolveWorkspaceRoot } from './workspace-path.js';

export interface ResolveDatabasePathOptions {
  databasePath?: string | null;
  workspaceRoot?: string;
  ensureDirectory?: boolean;
}

function ensureDirectory(path: string, enabled: boolean): void {
  if (!enabled) {
    return;
  }
  mkdirSync(path, { recursive: true });
}

function determineWorkspaceRoot(provided?: string): string {
  if (provided) {
    return provided;
  }

  const currentModuleDir = dirname(fileURLToPath(import.meta.url));
  return resolveWorkspaceRoot(currentModuleDir);
}

export function resolveWorkspaceDatabasePath(options?: ResolveDatabasePathOptions): string {
  const ensureDir = options?.ensureDirectory ?? true;

  if (options?.databasePath) {
    const explicitPath = resolve(options.databasePath);
    ensureDirectory(dirname(explicitPath), ensureDir);
    return explicitPath;
  }

  const envPath = process.env.DATABASE_PATH?.trim();
  if (envPath) {
    const absoluteEnvPath = resolve(envPath);
    ensureDirectory(dirname(absoluteEnvPath), ensureDir);
    return absoluteEnvPath;
  }

  const workspaceRoot = determineWorkspaceRoot(options?.workspaceRoot);
  const dataDir = join(workspaceRoot, 'data');
  ensureDirectory(dataDir, ensureDir);
  return join(dataDir, 'ctrl-freaq.db');
}

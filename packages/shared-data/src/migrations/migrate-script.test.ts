import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { promisify } from 'node:util';
import { execFile } from 'node:child_process';

import Database from 'better-sqlite3';
import { afterEach, describe, expect, it } from 'vitest';

const execFileAsync = promisify(execFile);

interface ExecResult {
  stdout: string;
  stderr: string;
}

describe.sequential('shared-data migrate script', () => {
  const workspaceRoot = resolve(process.cwd(), '..', '..');
  let databaseDir: string | null = null;

  afterEach(() => {
    if (!databaseDir) {
      return;
    }
    rmSync(databaseDir, { recursive: true, force: true });
    databaseDir = null;
  });

  it('applies template catalog migrations to the configured database path', async () => {
    databaseDir = mkdtempSync(join(tmpdir(), 'shared-data-migrate-'));
    const databasePath = join(databaseDir, 'ctrl-freaq.db');

    const env = {
      ...process.env,
      DATABASE_PATH: databasePath,
      NODE_ENV: 'test',
    } satisfies NodeJS.ProcessEnv;

    let commandResult: ExecResult;
    try {
      commandResult = await execFileAsync(
        'pnpm',
        ['--filter', '@ctrl-freaq/shared-data', 'exec', 'node', 'dist/scripts/migrate.js'],
        {
          cwd: workspaceRoot,
          env,
        }
      );
    } catch (error) {
      throw new Error(
        `shared-data migrate command failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }

    expect(commandResult.stderr.trim()).toBe('');

    const database = new Database(databasePath, { readonly: true });
    try {
      const tables = database
        .prepare("SELECT name FROM sqlite_master WHERE type = 'table'")
        .all()
        .map(row => row.name as string);

      expect(tables).toEqual(
        expect.arrayContaining([
          'documents',
          'document_templates',
          'template_versions',
          'document_template_migrations',
        ])
      );
    } finally {
      database.close();
    }
  }, 60_000);
});

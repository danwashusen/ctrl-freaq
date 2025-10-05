import { execFile } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { promisify } from 'node:util';

import { afterEach, describe, expect, it } from 'vitest';

const execFileAsync = promisify(execFile);

interface CommandResult {
  stdout: string;
  stderr: string;
}

async function runPnpm(args: string[], env: NodeJS.ProcessEnv): Promise<CommandResult> {
  return execFileAsync('pnpm', args, {
    cwd: resolve(process.cwd(), '..', '..'),
    env,
  });
}

async function runCli(args: string[], env: NodeJS.ProcessEnv): Promise<CommandResult> {
  return execFileAsync(
    'pnpm',
    ['--filter', '@ctrl-freaq/templates', 'exec', 'tsx', 'src/cli.ts', ...args],
    {
      cwd: resolve(process.cwd(), '..', '..'),
      env,
    }
  );
}

describe.sequential('template CLI smoke test', () => {
  const workspaceRoot = resolve(process.cwd(), '..', '..');
  const fixtureFile = resolve(
    workspaceRoot,
    'packages/templates/tests/fixtures/architecture.valid.yaml'
  );
  let databaseDir: string | null = null;

  afterEach(() => {
    if (!databaseDir) {
      return;
    }
    rmSync(databaseDir, { recursive: true, force: true });
    databaseDir = null;
  });

  it('publishes and lists templates using the workspace database path', async () => {
    databaseDir = mkdtempSync(join(tmpdir(), 'template-cli-db-'));
    const databasePath = join(databaseDir, 'ctrl-freaq.db');

    const env = {
      ...process.env,
      DATABASE_PATH: databasePath,
      TEMPLATE_CLI_LOG_LEVEL: 'error',
      NODE_ENV: 'test',
    } satisfies NodeJS.ProcessEnv;

    await runPnpm(
      ['--filter', '@ctrl-freaq/shared-data', 'exec', 'tsx', 'src/scripts/migrate.ts'],
      env
    );

    await runCli(['publish', '--file', fixtureFile, '--version', '1.0.0', '--activate'], env);

    const listResult = await runCli(['list', '--json'], env);

    const trimmed = listResult.stdout.trim();
    const jsonStart = trimmed.indexOf('[');
    expect(jsonStart).toBeGreaterThan(-1);

    const summary = JSON.parse(trimmed.slice(jsonStart)) as Array<{
      id: string;
      activeVersion: string | null;
      schemaHash: string | null;
    }>;

    expect(summary).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'architecture',
          activeVersion: '1.0.0',
          schemaHash: expect.any(String),
        }),
      ])
    );
  }, 90_000);
});

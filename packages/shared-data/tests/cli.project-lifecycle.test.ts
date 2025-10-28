import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { promisify } from 'node:util';
import { execFile } from 'node:child_process';

import Database from 'better-sqlite3';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { runSharedDataMigrations } from '../src/migrations/run-migrations';
import {
  ProjectRepositoryImpl,
  ProjectUtils,
  validateCreateProject,
  type CreateProjectInput,
} from '../src/models/project';

const execFileAsync = promisify(execFile);
const packageRoot = resolve(process.cwd());
const cliEntryPoint = join(packageRoot, 'src', 'cli.ts');
const tsxBinary = join(
  packageRoot,
  'node_modules',
  '.bin',
  process.platform === 'win32' ? 'tsx.cmd' : 'tsx'
);

interface CliResult {
  stdout: string;
  stderr: string;
}

async function runCli(args: string[], env?: NodeJS.ProcessEnv): Promise<CliResult> {
  if (!existsSync(tsxBinary)) {
    throw new Error(`tsx binary not found at ${tsxBinary}`);
  }

  try {
    return await execFileAsync(tsxBinary, [cliEntryPoint, ...args], {
      cwd: packageRoot,
      env: {
        ...process.env,
        NODE_ENV: 'test',
        NODE_OPTIONS: appendNodeCondition(process.env.NODE_OPTIONS),
        ...env,
      },
    });
  } catch (error) {
    if (error && typeof error === 'object' && 'stdout' in error && 'stderr' in error) {
      return {
        stdout: String((error as CliResult).stdout ?? ''),
        stderr: String((error as CliResult).stderr ?? ''),
      };
    }
    throw error;
  }
}

function appendNodeCondition(nodeOptions: string | undefined): string {
  const flag = '--conditions=development';
  if (!nodeOptions || nodeOptions.length === 0) {
    return flag;
  }
  return nodeOptions.includes(flag) ? nodeOptions : `${nodeOptions} ${flag}`.trim();
}

describe.sequential('@ctrl-freaq/shared-data CLI project lifecycle commands', () => {
  let tempDir: string;
  let databasePath: string;
  const actorId = 'user_cli';
  let createdProjectId: string;

  beforeEach(async () => {
    tempDir = mkdtempSync(join(tmpdir(), 'shared-data-cli-project-'));
    databasePath = join(tempDir, 'ctrl-freaq.db');

    const bootstrapDb = new Database(databasePath);
    bootstrapDb.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT NOT NULL,
        first_name TEXT,
        last_name TEXT,
        created_at TEXT,
        created_by TEXT,
        updated_at TEXT,
        updated_by TEXT,
        deleted_at TEXT,
        deleted_by TEXT
      );
    `);
    bootstrapDb.close();

    runSharedDataMigrations({ databasePath, logger: console });

    const database = new Database(databasePath);
    try {
      database.exec(`
        INSERT OR IGNORE INTO users (
          id,
          email,
          first_name,
          last_name,
          created_at,
          created_by,
          updated_at,
          updated_by
        ) VALUES (
          '${actorId}',
          'cli-user@example.com',
          'CLI',
          'User',
          datetime('now'),
          'system',
          datetime('now'),
          'system'
        );
      `);

      const repository = new ProjectRepositoryImpl(database);
      const projectInput = validateCreateProject({
        ownerUserId: actorId,
        name: 'CLI Lifecycle Project',
        slug: ProjectUtils.generateSlug('CLI Lifecycle Project'),
        description: 'Project to exercise CLI lifecycle commands',
        createdBy: actorId,
        updatedBy: actorId,
      }) as CreateProjectInput;

      const project = await repository.create(projectInput);
      createdProjectId = project.id;
    } finally {
      database.close();
    }
  });

  afterEach(() => {
    if (tempDir) {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('lists, archives, and restores projects via CLI commands', async () => {
    const listBefore = await runCli(['project', 'list', '--db-path', databasePath, '--json']);
    expect(listBefore.stderr.trim()).toBe('');

    const parsedListBefore = JSON.parse(listBefore.stdout) as {
      projects: Array<{ id: string; status: string }>;
    };
    expect(parsedListBefore.projects).toHaveLength(1);
    expect(parsedListBefore.projects[0]).toMatchObject({
      id: createdProjectId,
      status: 'draft',
    });

    const archiveResult = await runCli([
      'project',
      'archive',
      createdProjectId,
      '--db-path',
      databasePath,
      '--actor',
      actorId,
      '--json',
    ]);
    expect(archiveResult.stderr.trim()).toBe('');
    const parsedArchive = JSON.parse(archiveResult.stdout) as {
      project: { status: string; deletedAt: string | null; deletedBy: string | null };
    };
    expect(parsedArchive.project.status).toBe('archived');
    expect(parsedArchive.project.deletedBy).toBe(actorId);
    expect(parsedArchive.project.deletedAt).not.toBeNull();

    const listArchived = await runCli([
      'project',
      'list',
      '--db-path',
      databasePath,
      '--include-archived',
      '--json',
    ]);
    const parsedListArchived = JSON.parse(listArchived.stdout) as {
      projects: Array<{ id: string; status: string }>;
    };
    expect(parsedListArchived.projects).toHaveLength(1);
    expect(parsedListArchived.projects[0]).toMatchObject({
      id: createdProjectId,
      status: 'archived',
    });

    const restoreResult = await runCli([
      'project',
      'restore',
      createdProjectId,
      '--db-path',
      databasePath,
      '--actor',
      actorId,
      '--json',
    ]);
    expect(restoreResult.stderr.trim()).toBe('');
    const parsedRestore = JSON.parse(restoreResult.stdout) as {
      project: { status: string; deletedAt: string | null; deletedBy: string | null };
    };
    expect(parsedRestore.project.status).toBe('draft');
    expect(parsedRestore.project.deletedAt).toBeNull();
    expect(parsedRestore.project.deletedBy).toBeNull();

    const listAfter = await runCli(['project', 'list', '--db-path', databasePath, '--json']);
    const parsedListAfter = JSON.parse(listAfter.stdout) as {
      projects: Array<{ id: string; status: string }>;
    };
    expect(parsedListAfter.projects).toHaveLength(1);
    expect(parsedListAfter.projects[0]).toMatchObject({
      id: createdProjectId,
      status: 'draft',
    });
  });
});

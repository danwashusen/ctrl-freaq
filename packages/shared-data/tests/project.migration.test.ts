import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import Database from 'better-sqlite3';
import { afterEach, describe, expect, it } from 'vitest';

import { runSharedDataMigrations } from '../src/migrations/run-migrations';
import { PROJECT_CONSTANTS } from '../src/models/project';

describe('20251025 project lifecycle migration', () => {
  let tempDir: string | null = null;
  let databasePath: string | null = null;

  afterEach(() => {
    if (tempDir) {
      rmSync(tempDir, { recursive: true, force: true });
      tempDir = null;
      databasePath = null;
    }
  });

  it('adds lifecycle columns and removes single-project constraint', () => {
    tempDir = mkdtempSync(join(tmpdir(), 'shared-data-project-migration-'));
    databasePath = join(tempDir, 'ctrl-freaq.db');

    const setupDb = new Database(databasePath);
    setupDb.exec(`
      PRAGMA foreign_keys = ON;

      CREATE TABLE users (
        id TEXT PRIMARY KEY,
        email TEXT NOT NULL
      );

      INSERT INTO users (id, email) VALUES ('system', 'system@ctrl-freaq.local');
      INSERT INTO users (id, email) VALUES ('user_legacy', 'legacy@example.com');

      CREATE TABLE projects (
        id TEXT PRIMARY KEY,
        owner_user_id TEXT NOT NULL,
        name TEXT NOT NULL,
        slug TEXT NOT NULL UNIQUE,
        description TEXT,
        created_at TEXT NOT NULL,
        created_by TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        updated_by TEXT NOT NULL,
        deleted_at TEXT,
        deleted_by TEXT
      );

      CREATE UNIQUE INDEX idx_projects_owner ON projects(owner_user_id);

      INSERT INTO projects (id, owner_user_id, name, slug, description, created_at, created_by, updated_at, updated_by)
      VALUES (
        'proj_legacy',
        'user_legacy',
        'Legacy Project',
        'legacy-project',
        NULL,
        '2025-10-20T00:00:00.000Z',
        'system',
        '2025-10-20T00:00:00.000Z',
        'system'
      );
    `);
    setupDb.close();

    runSharedDataMigrations({ databasePath });

    const verifyDb = new Database(databasePath, { readonly: false });
    const columns = verifyDb.prepare(`PRAGMA table_info('projects')`).all() as Array<{
      name: string;
      notnull: number;
      dflt_value: string | null;
    }>;

    const columnNames = columns.map(column => column.name);
    expect(columnNames).toEqual(
      expect.arrayContaining(['visibility', 'status', 'goal_target_date', 'goal_summary'])
    );

    const visibilityColumn = columns.find(column => column.name === 'visibility');
    expect(visibilityColumn?.notnull).toBe(1);
    expect(visibilityColumn?.dflt_value?.replace(/'/g, '')).toBe('workspace');

    const statusColumn = columns.find(column => column.name === 'status');
    expect(statusColumn?.notnull).toBe(1);
    expect(statusColumn?.dflt_value?.replace(/'/g, '')).toBe('draft');

    const legacyRow = verifyDb
      .prepare(
        `SELECT status, visibility, goal_target_date as goalTargetDate, goal_summary as goalSummary
         FROM projects
         WHERE id = 'proj_legacy'`
      )
      .get() as {
      status: string;
      visibility: string;
      goalTargetDate: string | null;
      goalSummary: string | null;
    } | null;

    expect(legacyRow).not.toBeNull();
    expect(legacyRow?.status).toBe('draft');
    expect(legacyRow?.visibility).toBe('workspace');
    expect(legacyRow?.goalTargetDate).toBeNull();
    expect(legacyRow?.goalSummary).toBeNull();

    expect(() =>
      verifyDb.exec(`
        INSERT INTO projects (
          id,
          owner_user_id,
          name,
          slug,
          description,
          visibility,
          status,
          created_at,
          created_by,
          updated_at,
          updated_by,
          goal_target_date,
          goal_summary
        )
        VALUES (
          'proj_second',
          'user_legacy',
          'Second Project',
          'second-project',
          'Lifecycle follow-up',
          'private',
          'active',
          '2025-10-22T00:00:00.000Z',
          'system',
          '2025-10-22T00:00:00.000Z',
          'system',
          NULL,
          NULL
        );
      `)
    ).not.toThrow();

    const indexes = verifyDb.prepare(`PRAGMA index_list('projects')`).all() as Array<{
      name: string;
      unique: number;
    }>;
    const ownerDeletedIndex = indexes.find(index => index.name === 'idx_projects_owner_deleted');
    expect(ownerDeletedIndex?.unique).toBe(0);

    verifyDb.close();
  });

  it('backfills archived status snapshot for legacy archived projects', () => {
    tempDir = mkdtempSync(join(tmpdir(), 'shared-data-project-migration-legacy-'));
    databasePath = join(tempDir, 'ctrl-freaq.db');

    const setupDb = new Database(databasePath);
    setupDb.exec(`
      PRAGMA foreign_keys = ON;

      CREATE TABLE users (
        id TEXT PRIMARY KEY,
        email TEXT NOT NULL
      );

      INSERT INTO users (id, email) VALUES ('system', 'system@ctrl-freaq.local');
      INSERT INTO users (id, email) VALUES ('user_archived', 'archived@example.com');

      CREATE TABLE projects (
        id TEXT PRIMARY KEY,
        owner_user_id TEXT NOT NULL,
        name TEXT NOT NULL,
        slug TEXT NOT NULL UNIQUE,
        description TEXT,
        created_at TEXT NOT NULL,
        created_by TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        updated_by TEXT NOT NULL,
        deleted_at TEXT,
        deleted_by TEXT
      );

      INSERT INTO projects (
        id,
        owner_user_id,
        name,
        slug,
        description,
        created_at,
        created_by,
        updated_at,
        updated_by,
        deleted_at,
        deleted_by
      )
      VALUES (
        'proj_archived_legacy',
        'user_archived',
        'Archived Legacy Project',
        'archived-legacy-project',
        'Project archived before lifecycle migration captured prior status',
        '2024-09-01T00:00:00.000Z',
        'system',
        '2024-10-01T00:00:00.000Z',
        'system',
        '2024-10-01T00:00:00.000Z',
        NULL
      );
    `);
    setupDb.close();

    runSharedDataMigrations({ databasePath });

    const verifyDb = new Database(databasePath, { readonly: false });
    const archivedRow = verifyDb
      .prepare(
        `SELECT status, archived_status_before as archivedStatusBefore, deleted_at as deletedAt
         FROM projects
         WHERE id = 'proj_archived_legacy'`
      )
      .get() as {
      status: string;
      archivedStatusBefore: string | null;
      deletedAt: string | null;
    } | null;

    expect(archivedRow).not.toBeNull();
    expect(archivedRow?.status).toBe(PROJECT_CONSTANTS.ARCHIVED_STATUS);
    expect(archivedRow?.archivedStatusBefore).toBe(PROJECT_CONSTANTS.RESTORED_STATUS);
    expect(archivedRow?.deletedAt).toBe('2024-10-01T00:00:00.000Z');

    verifyDb.close();
  });
});

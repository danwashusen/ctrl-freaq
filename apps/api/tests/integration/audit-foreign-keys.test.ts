import type { Express } from 'express';
import type { Database as SqliteDatabase } from 'better-sqlite3';
import { beforeAll, beforeEach, describe, expect, test } from 'vitest';

describe('Audit foreign key integrity', () => {
  let app: Express;
  let db: SqliteDatabase;
  let resetDatabaseForApp: (app: Express) => void;

  beforeAll(async () => {
    const [{ createApp }, resetModule] = await Promise.all([
      import('../../src/app'),
      import('../../src/testing/reset.js'),
    ]);

    app = await createApp();
    db = app.locals.appContext.database as SqliteDatabase;
    resetDatabaseForApp = resetModule.resetDatabaseForApp;
  });

  beforeEach(() => {
    resetDatabaseForApp(app);
  });

  const ensureUser = (id: string, auditId: string = 'system') => {
    db.prepare(
      `INSERT OR REPLACE INTO users (id, email, first_name, last_name, created_by, updated_by)
       VALUES (?, ?, NULL, NULL, ?, ?)`
    ).run(id, `${id}@test.local`, auditId, auditId);
  };

  test('rejects projects referencing unknown audit users', () => {
    ensureUser('system', 'system');
    ensureUser('user_fk_owner');

    expect(() => {
      db.prepare(
        `INSERT INTO projects (
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
           updated_by
         )
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        'project_fk_violation',
        'user_fk_owner',
        'Audit FK Violation',
        'audit-fk-violation',
        null,
        'workspace',
        'draft',
        '2025-01-01T00:00:00.000Z',
        'ghost_user',
        '2025-01-01T00:00:00.000Z',
        'ghost_user'
      );
    }).toThrow(/FOREIGN KEY/);
  });

  test('rejects configurations referencing unknown audit users', () => {
    ensureUser('system', 'system');
    ensureUser('user_fk_settings');

    expect(() => {
      db.prepare(
        `INSERT INTO configurations (id, user_id, key, value, created_by, updated_by)
         VALUES (?, ?, ?, ?, ?, ?)`
      ).run(
        'config_fk_violation',
        'user_fk_settings',
        'dashboard:view',
        'grid',
        'ghost_user',
        'ghost_user'
      );
    }).toThrow(/FOREIGN KEY/);
  });
});

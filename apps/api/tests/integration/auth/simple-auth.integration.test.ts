import path from 'node:path';

import type { Express } from 'express';
import request from 'supertest';
import type { Database } from 'better-sqlite3';
import { afterAll, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest';

const ORIGINAL_AUTH_PROVIDER = process.env.AUTH_PROVIDER;
const ORIGINAL_SIMPLE_FILE = process.env.SIMPLE_AUTH_USER_FILE;

const validFixture = path.resolve(
  __dirname,
  '../../contract/fixtures/simple-auth/users.valid.yaml'
);

describe('Simple auth middleware integration', () => {
  let app: Express;

  beforeAll(async () => {
    vi.resetModules();
    process.env.AUTH_PROVIDER = 'simple';
    process.env.SIMPLE_AUTH_USER_FILE = validFixture;

    const { createApp } = await import('../../../src/app.js');
    app = await createApp();
  });

  afterAll(() => {
    if (ORIGINAL_AUTH_PROVIDER === undefined) {
      delete process.env.AUTH_PROVIDER;
    } else {
      process.env.AUTH_PROVIDER = ORIGINAL_AUTH_PROVIDER;
    }

    if (ORIGINAL_SIMPLE_FILE === undefined) {
      delete process.env.SIMPLE_AUTH_USER_FILE;
    } else {
      process.env.SIMPLE_AUTH_USER_FILE = ORIGINAL_SIMPLE_FILE;
    }
  });

  beforeEach(() => {
    const db = app.locals.appContext.database as Database;
    db.prepare('DELETE FROM users WHERE id IN (?, ?)').run('user_alpha', 'user_beta');
  });

  test('allows access with valid simple token and seeds YAML users', async () => {
    const response = await request(app)
      .get('/api/v1/projects')
      .set('Authorization', 'Bearer simple:user_alpha')
      .expect(200);

    expect(response.body).toHaveProperty('projects');

    const db = app.locals.appContext.database as Database;
    const seededUsers = db
      .prepare('SELECT id, email FROM users WHERE id IN (?, ?) ORDER BY id ASC')
      .all('user_alpha', 'user_beta') as Array<{ id: string; email: string }>;

    expect(seededUsers).toHaveLength(2);
    expect(seededUsers[0]).toMatchObject({ id: 'user_alpha', email: 'alpha@example.com' });
    expect(seededUsers[1]).toMatchObject({ id: 'user_beta', email: 'beta@example.com' });
  });

  test('rejects tokens with missing simple prefix', async () => {
    const response = await request(app)
      .get('/api/v1/projects')
      .set('Authorization', 'Bearer user_alpha')
      .expect(401);

    expect(response.body).toMatchObject({
      error: 'UNAUTHORIZED',
    });
  });

  test('rejects tokens for users not present in YAML', async () => {
    const response = await request(app)
      .get('/api/v1/projects')
      .set('Authorization', 'Bearer simple:does_not_exist')
      .expect(401);

    expect(response.body).toMatchObject({
      error: 'UNAUTHORIZED',
    });
  });
});

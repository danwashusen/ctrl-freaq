import type { Express } from 'express';
import type Database from 'better-sqlite3';
import request from 'supertest';
import { beforeAll, describe, expect, test } from 'vitest';

import { createApp } from '../../src/app';
import { publishTemplateVersion, activateTemplateVersion } from '../contract/templates.helpers';
import { DEFAULT_TEST_USER_ID, MOCK_JWT_TOKEN } from '../../src/middleware/test-auth.js';

describe('Template removed version guard', () => {
  let app: Express;
  let db: Database.Database;

  beforeAll(async () => {
    app = await createApp();
    db = app.locals.appContext.database as Database.Database;
  });

  function insertDocument(id: string, templateVersion: string) {
    db.prepare(
      `INSERT INTO documents (
        id,
        project_id,
        title,
        content_json,
        template_id,
        template_version,
        template_schema_hash,
        created_at,
        created_by,
        updated_at,
        updated_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), ?, datetime('now'), ?)`
    ).run(
      id,
      'proj_removed_version',
      'Removed Version Doc',
      JSON.stringify({ introduction: 'Blocked doc' }),
      'architecture',
      templateVersion,
      'hash-stub',
      DEFAULT_TEST_USER_ID,
      DEFAULT_TEST_USER_ID
    );
  }

  test('blocks editing when referenced template version has been removed', async () => {
    const publishRes = await publishTemplateVersion(app, {
      templateId: 'architecture',
      version: '20.0.0',
    });
    expect(publishRes.status).toBe(201);
    await activateTemplateVersion(app, 'architecture', '20.0.0');

    insertDocument('doc-removed-version-1', '20.0.0');

    db.prepare('DELETE FROM template_versions WHERE template_id = ? AND version = ?').run(
      'architecture',
      '20.0.0'
    );

    const response = await request(app)
      .get('/api/v1/documents/doc-removed-version-1')
      .set('Authorization', `Bearer ${MOCK_JWT_TOKEN}`);

    expect(response.status).toBe(409);
    expect(response.body).toMatchObject({
      error: 'TEMPLATE_VERSION_REMOVED',
      templateId: 'architecture',
      missingVersion: '20.0.0',
    });
    expect(response.body).toHaveProperty('remediation');
  });
});

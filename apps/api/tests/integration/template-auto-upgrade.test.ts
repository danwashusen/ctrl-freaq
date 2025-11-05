import type { Express } from 'express';
import type Database from 'better-sqlite3';
import request from 'supertest';
import { beforeAll, describe, expect, test } from 'vitest';

import { createApp } from '../../src/app';
import { activateTemplateVersion, publishTemplateVersion } from '../contract/templates.helpers';
import { DEFAULT_TEST_USER_ID, MOCK_JWT_TOKEN } from '../../src/middleware/test-auth.js';

interface InsertDocumentOptions {
  id: string;
  templateId: string;
  templateVersion: string;
  templateSchemaHash: string;
  content: Record<string, unknown>;
}

describe('Template auto-upgrade integration', () => {
  let app: Express;
  let db: Database.Database;

  beforeAll(async () => {
    app = await createApp();
    db = app.locals.appContext.database as Database.Database;
  });

  function insertDocument({
    id,
    templateId,
    templateVersion,
    templateSchemaHash,
    content,
  }: InsertDocumentOptions) {
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
      'proj_auto_upgrade',
      'Auto Upgrade Doc',
      JSON.stringify(content),
      templateId,
      templateVersion,
      templateSchemaHash,
      DEFAULT_TEST_USER_ID,
      DEFAULT_TEST_USER_ID
    );
  }

  test('auto-upgrades documents on load and logs migration', async () => {
    const baseVersion = await publishTemplateVersion(app, {
      templateId: 'architecture',
      version: '10.0.0',
    });
    expect(baseVersion.status).toBe(201);
    await activateTemplateVersion(app, 'architecture', '10.0.0');

    insertDocument({
      id: 'doc-auto-upgrade-1',
      templateId: 'architecture',
      templateVersion: '10.0.0',
      templateSchemaHash: baseVersion.body.version.schemaHash,
      content: {
        introduction: 'Legacy summary',
        system_overview: {
          architecture_diagram: 'https://ctrl-freaq.dev/diagram.png',
          tech_stack: 'react',
        },
      },
    });

    const newVersion = await publishTemplateVersion(app, {
      templateId: 'architecture',
      version: '10.1.0',
    });
    expect(newVersion.status).toBe(201);
    await activateTemplateVersion(app, 'architecture', '10.1.0');

    const response = await request(app)
      .get('/api/v1/documents/doc-auto-upgrade-1')
      .set('Authorization', `Bearer ${MOCK_JWT_TOKEN}`);

    expect(response.status).toBe(200);
    expect(response.body.document).toMatchObject({
      id: 'doc-auto-upgrade-1',
      templateId: 'architecture',
      templateVersion: '10.1.0',
    });
    expect(response.body.migration).toMatchObject({
      status: 'succeeded',
      fromVersion: '10.0.0',
      toVersion: '10.1.0',
    });

    const migration = db
      .prepare(
        `SELECT status, from_version as fromVersion, to_version as toVersion FROM document_template_migrations WHERE document_id = ? ORDER BY initiated_at DESC LIMIT 1`
      )
      .get('doc-auto-upgrade-1') as
      | { status?: string; fromVersion?: string; toVersion?: string }
      | undefined;

    expect(migration).toBeDefined();
    expect(migration?.status).toBe('succeeded');
    expect(migration?.fromVersion).toBe('10.0.0');
    expect(migration?.toVersion).toBe('10.1.0');
  });
});

import type { Express } from 'express';
import type * as BetterSqlite3 from 'better-sqlite3';
import request from 'supertest';
import { beforeAll, describe, expect, test } from 'vitest';
import { z } from 'zod';

import { createApp, type AppContext } from '../../src/app';
import { DEFAULT_TEST_USER_ID, MOCK_JWT_TOKEN } from '../../src/middleware/test-auth.js';
import { demoProjectRetention } from './fixtures/project-retention';

const PROJECT_SLUG = demoProjectRetention.projectSlug;
const DOCUMENT_ID = 'doc-architecture-demo';
const AuthorizationHeader = { Authorization: `Bearer ${MOCK_JWT_TOKEN}` };

const ComplianceResponseSchema = z.object({
  status: z.literal('queued'),
  warningId: z.string(),
});

describe('Draft compliance logging API contract', () => {
  let app: Express;
  let db: BetterSqlite3.Database;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    app = await createApp();
    const appContext = app.locals.appContext as AppContext;
    db = appContext.database;

    // Ensure baseline document exists for association checks downstream.
    db.prepare(
      `INSERT OR IGNORE INTO documents (
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
         updated_by,
         deleted_at,
         deleted_by
       ) VALUES (?, ?, 'Compliance Demo Document', '{}', 'architecture', '1.0.0', 'hash-architecture-v1', datetime('now'), 'system', datetime('now'), 'system', NULL, NULL)`
    ).run(DOCUMENT_ID, PROJECT_SLUG);
  });

  test('POST /api/v1/projects/:projectSlug/documents/:documentId/draft-compliance queues retention warning', async () => {
    const detectedAt = new Date().toISOString();

    const response = await request(app)
      .post(`/api/v1/projects/${PROJECT_SLUG}/documents/${DOCUMENT_ID}/draft-compliance`)
      .set(AuthorizationHeader)
      .send({
        authorId: DEFAULT_TEST_USER_ID,
        policyId: demoProjectRetention.policyId,
        detectedAt,
        context: {
          retentionWindow: demoProjectRetention.retentionWindow,
          pendingDrafts: '3',
        },
      });

    expect(response.status).toBe(202);
    const payload = ComplianceResponseSchema.safeParse(response.body);
    expect(payload.success).toBe(true);
    if (payload.success) {
      expect(payload.data.status).toBe('queued');
      expect(payload.data.warningId).toMatch(/^draft-compliance-/i);
    }
  });

  test('rejects requests missing required retention metadata', async () => {
    const response = await request(app)
      .post(`/api/v1/projects/${PROJECT_SLUG}/documents/${DOCUMENT_ID}/draft-compliance`)
      .set(AuthorizationHeader)
      .send({
        authorId: DEFAULT_TEST_USER_ID,
        detectedAt: new Date().toISOString(),
      });

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({ code: 'BAD_REQUEST' });
  });

  test('rejects compliance warnings when authorId mismatches authenticated user', async () => {
    const detectedAt = new Date().toISOString();

    const response = await request(app)
      .post(`/api/v1/projects/${PROJECT_SLUG}/documents/${DOCUMENT_ID}/draft-compliance`)
      .set(AuthorizationHeader)
      .send({
        authorId: 'user_spoofed',
        policyId: demoProjectRetention.policyId,
        detectedAt,
        context: {
          retentionWindow: demoProjectRetention.retentionWindow,
        },
      });

    expect(response.status).toBe(403);
    expect(response.body).toMatchObject({ code: 'FORBIDDEN' });
  });
});

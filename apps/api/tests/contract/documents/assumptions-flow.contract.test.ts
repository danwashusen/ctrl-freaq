import { randomUUID } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { Express } from 'express';
import type * as BetterSqlite3 from 'better-sqlite3';
import request from 'supertest';
import { beforeAll, beforeEach, describe, expect, test } from 'vitest';
import { z } from 'zod';

import { createApp, type AppContext } from '../../../src/app';
import { MOCK_JWT_TOKEN } from '../../../src/middleware/test-auth';
import { seedAssumptionSessionFixtures } from '../../../src/testing/fixtures/assumption-session';

const AuthorizationHeader = { Authorization: `Bearer ${MOCK_JWT_TOKEN}` };
const __dirname = dirname(fileURLToPath(import.meta.url));
process.env.CTRL_FREAQ_TEMPLATE_ROOT = resolve(
  __dirname,
  '..',
  '..',
  '..',
  '..',
  '..',
  'templates'
);

const SessionResponseSchema = z.object({
  sessionId: z.string().min(1),
  sectionId: z.string().min(1),
  prompts: z.array(
    z.object({
      id: z.string().min(1),
      heading: z.string().min(1),
      responseType: z.string().min(1),
    })
  ),
  overridesOpen: z.number().nonnegative(),
  documentDecisionSnapshotId: z.string().length(64),
});

describe('Document assumption flow scoping', () => {
  let app: Express;
  let db: BetterSqlite3.Database;
  let documentId: string;
  let sectionId: string;

  beforeAll(async () => {
    app = await createApp();
    const context = app.locals.appContext as AppContext;
    db = context.database;
  });

  beforeEach(() => {
    const seeded = seedAssumptionSessionFixtures(db);
    documentId = seeded.documentId;
    sectionId = seeded.sectionId;
  });

  test('creates an assumption session when document and section identifiers align', async () => {
    const response = await request(app)
      .post(`/api/v1/documents/${documentId}/sections/${sectionId}/assumptions/session`)
      .set(AuthorizationHeader)
      .send({
        templateVersion: '2.1.0',
        decisionSnapshotId: 'a'.repeat(64),
      })
      .expect(201);

    const parsed = SessionResponseSchema.safeParse(response.body);
    expect(parsed.success).toBe(true);
    if (!parsed.success) {
      throw new Error(`Session response failed validation: ${response.text}`);
    }

    expect(parsed.data.sessionId).toMatch(/^sec-new-content-flow/);
    expect(parsed.data.sectionId).toBe(sectionId);
    expect(parsed.data.prompts.length).toBeGreaterThan(0);

    const mismatch = await request(app)
      .post(`/api/v1/documents/${randomUUID()}/sections/${sectionId}/assumptions/session`)
      .set(AuthorizationHeader)
      .send({ templateVersion: '2.1.0' })
      .expect(404);

    expect(mismatch.body).toMatchObject({ code: 'DOCUMENT_SECTION_MISMATCH' });
  });

  test('falls back to the stored template when the request references an unknown version', async () => {
    const response = await request(app)
      .post(`/api/v1/documents/${documentId}/sections/${sectionId}/assumptions/session`)
      .set(AuthorizationHeader)
      .send({ templateVersion: '0.0.0' })
      .expect(201);

    const parsed = SessionResponseSchema.safeParse(response.body);
    expect(parsed.success).toBe(true);
  });

  test('returns a conflict when the referenced template cannot be resolved', async () => {
    db.prepare(
      `UPDATE documents
          SET template_id = 'orphan-template',
              template_version = '9.9.9',
              template_schema_hash = 'hash-orphan'
        WHERE id = ?`
    ).run(documentId);

    const response = await request(app)
      .post(`/api/v1/documents/${documentId}/sections/${sectionId}/assumptions/session`)
      .set(AuthorizationHeader)
      .send({ templateVersion: '9.9.9' })
      .expect(409);

    expect(response.body).toMatchObject({
      code: 'CONFLICT',
      message: 'Template version unavailable for this document',
      details: expect.objectContaining({
        code: 'TEMPLATE_VERSION_MISSING',
        templateId: 'orphan-template',
      }),
    });
  });

  test('respond endpoint enforces document scoped identifiers', async () => {
    const start = await request(app)
      .post(`/api/v1/documents/${documentId}/sections/${sectionId}/assumptions/session`)
      .set(AuthorizationHeader)
      .send({ templateVersion: '2.1.0' })
      .expect(201);

    const sessionId = start.body.sessionId as string;
    const promptId = start.body.prompts?.[0]?.id as string;
    expect(sessionId).toBeTruthy();
    expect(promptId).toBeTruthy();

    const success = await request(app)
      .post(`/api/v1/documents/${documentId}/sections/${sectionId}/assumptions/${promptId}/respond`)
      .set(AuthorizationHeader)
      .send({ action: 'answer', answer: 'no-changes' })
      .expect(200);

    expect(success.body).toMatchObject({ id: promptId, status: expect.any(String) });

    const mismatch = await request(app)
      .post(
        `/api/v1/documents/${randomUUID()}/sections/${sectionId}/assumptions/${promptId}/respond`
      )
      .set(AuthorizationHeader)
      .send({ action: 'answer', answer: 'no-changes' })
      .expect(404);

    expect(mismatch.body).toMatchObject({ code: 'DOCUMENT_SECTION_MISMATCH' });
  });
});

import { randomUUID } from 'node:crypto';

import type { Express } from 'express';
import type * as BetterSqlite3 from 'better-sqlite3';
import request from 'supertest';
import { beforeAll, describe, expect, test } from 'vitest';
import { z } from 'zod';

import { createApp, type AppContext } from '../../../src/app';
import { MOCK_JWT_TOKEN } from '../../../src/middleware/test-auth';

const AuthorizationHeader = { Authorization: `Bearer ${MOCK_JWT_TOKEN}` };

const CreateDocumentResponseSchema = z.object({
  status: z.enum(['created', 'already_exists']),
  documentId: z.string().uuid(),
  projectId: z.string().uuid(),
  firstSectionId: z.string().uuid(),
  lifecycleStatus: z.enum(['draft', 'review', 'published']),
  title: z.string().min(1),
  template: z.object({
    templateId: z.string().min(1),
    templateVersion: z.string().min(1),
    templateSchemaHash: z.string().min(1),
  }),
  lastModifiedAt: z.string().min(1),
});

const PrimarySnapshotSchema = z.object({
  projectId: z.string().uuid(),
  status: z.enum(['missing', 'loading', 'ready', 'archived']),
  document: z
    .object({
      documentId: z.string().uuid(),
      firstSectionId: z.string().uuid(),
      title: z.string().min(1),
      lifecycleStatus: z.enum(['draft', 'review', 'published']),
      lastModifiedAt: z.string().min(1),
      template: z
        .object({
          templateId: z.string(),
          templateVersion: z.string(),
          templateSchemaHash: z.string(),
        })
        .optional(),
    })
    .nullable(),
  templateDecision: z.unknown().nullable(),
  lastUpdatedAt: z.string().min(1),
});

describe('POST /api/v1/projects/:projectId/documents', () => {
  let app: Express;
  let db: BetterSqlite3.Database;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    app = await createApp();
    const context = app.locals.appContext as AppContext;
    db = context.database;
  });

  test('requires authentication', async () => {
    const projectId = randomUUID();
    await request(app).post(`/api/v1/projects/${projectId}/documents`).expect(401);
  });

  test('provisions the first document and returns created response', async () => {
    const createProject = await request(app)
      .post('/api/v1/projects')
      .set(AuthorizationHeader)
      .send({
        name: 'Provisioned Architecture',
        visibility: 'workspace',
        goalSummary: 'Validate provisioning contract',
      });

    expect(createProject.status).toBe(201);
    const projectId = createProject.body.id as string;
    expect(projectId, 'project creation should return a UUID identifier').toMatch(
      /^[0-9a-fA-F-]{36}$/
    );

    const response = await request(app)
      .post(`/api/v1/projects/${projectId}/documents`)
      .set(AuthorizationHeader)
      .expect(201);

    const payload = CreateDocumentResponseSchema.safeParse(response.body);
    expect(payload.success).toBe(true);
    if (!payload.success) {
      throw new Error(`Provisioning response failed schema validation: ${response.text}`);
    }

    expect(payload.data.status).toBe('created');
    expect(payload.data.projectId).toBe(projectId);

    const documentCount = db
      .prepare('SELECT COUNT(*) AS total FROM documents WHERE project_id = ?')
      .get(projectId) as { total?: number };
    expect(documentCount?.total).toBe(1);

    const snapshot = await request(app)
      .get(`/api/v1/projects/${projectId}/documents/primary`)
      .set(AuthorizationHeader)
      .expect(200);

    const snapshotPayload = PrimarySnapshotSchema.safeParse(snapshot.body);
    expect(snapshotPayload.success).toBe(true);
    if (!snapshotPayload.success) {
      throw new Error(`Primary snapshot failed schema validation: ${snapshot.text}`);
    }

    expect(snapshotPayload.data.status).toBe('ready');
    expect(snapshotPayload.data.document?.documentId).toBe(payload.data.documentId);
    expect(snapshotPayload.data.document?.firstSectionId).toBe(payload.data.firstSectionId);

    const secondAttempt = await request(app)
      .post(`/api/v1/projects/${projectId}/documents`)
      .set(AuthorizationHeader)
      .expect(200);

    const idempotentPayload = CreateDocumentResponseSchema.safeParse(secondAttempt.body);
    expect(idempotentPayload.success).toBe(true);
    if (!idempotentPayload.success) {
      throw new Error(`Idempotent response failed schema validation: ${secondAttempt.text}`);
    }

    expect(idempotentPayload.data.status).toBe('already_exists');
    expect(idempotentPayload.data.documentId).toBe(payload.data.documentId);
  });

  test('honors template/title/seed strategy overrides', async () => {
    const createProject = await request(app)
      .post('/api/v1/projects')
      .set(AuthorizationHeader)
      .send({
        name: 'Override Provisioning Project',
        visibility: 'workspace',
        goalSummary: 'Validate override handling',
      });

    expect(createProject.status).toBe(201);
    const projectId = createProject.body.id as string;

    const overrideResponse = await request(app)
      .post(`/api/v1/projects/${projectId}/documents`)
      .set(AuthorizationHeader)
      .send({
        title: 'Custom Architecture Kickoff',
        templateId: 'architecture-minimal',
        templateVersion: '3.0.0',
        seedStrategy: 'empty',
      })
      .expect(201);

    const overridePayload = CreateDocumentResponseSchema.safeParse(overrideResponse.body);
    expect(overridePayload.success).toBe(true);
    if (!overridePayload.success) {
      throw new Error(`Override provisioning response invalid: ${overrideResponse.text}`);
    }

    expect(overridePayload.data.title).toBe('Custom Architecture Kickoff');
    expect(overridePayload.data.template.templateId).toBe('architecture-minimal');
    expect(overridePayload.data.template.templateVersion).toBe('3.0.0');

    const sectionTotals = db
      .prepare('SELECT COUNT(*) AS total FROM sections WHERE doc_id = ?')
      .get(overridePayload.data.documentId) as { total?: number };
    expect(sectionTotals?.total).toBe(1);

    const seededSection = db
      .prepare(
        `SELECT title, placeholder_text AS placeholderText, has_content AS hasContent
           FROM sections
          WHERE doc_id = ?
          LIMIT 1`
      )
      .get(overridePayload.data.documentId) as {
      title?: string;
      placeholderText?: string;
      hasContent?: number;
    };

    expect(seededSection?.title).toBe('Getting Started');
    expect(seededSection?.hasContent).toBe(0);
    expect(seededSection?.placeholderText).toContain('Document outline will be generated');
  });

  test('returns not found when project does not exist', async () => {
    const missingProjectId = randomUUID();
    const response = await request(app)
      .post(`/api/v1/projects/${missingProjectId}/documents`)
      .set(AuthorizationHeader)
      .expect(404);

    expect(response.body).toMatchObject({
      code: 'PROJECT_NOT_FOUND',
    });
  });
});

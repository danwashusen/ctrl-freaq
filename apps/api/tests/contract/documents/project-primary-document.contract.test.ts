import { randomUUID } from 'node:crypto';

import type { Express } from 'express';
import type * as BetterSqlite3 from 'better-sqlite3';
import request from 'supertest';
import { beforeAll, describe, expect, test } from 'vitest';
import { z } from 'zod';

import { createApp, type AppContext } from '../../../src/app';
import { MOCK_JWT_TOKEN } from '../../../src/middleware/test-auth';
import { seedSectionFixture, seedUserFixture } from '../../../src/testing/fixtures/section-editor';

const AuthorizationHeader = { Authorization: `Bearer ${MOCK_JWT_TOKEN}` };

const PrimaryDocumentSnapshotSchema = z.object({
  projectId: z.string(),
  status: z.enum(['missing', 'loading', 'ready', 'archived']),
  document: z
    .object({
      documentId: z.string(),
      firstSectionId: z.string(),
      title: z.string(),
      lifecycleStatus: z.enum(['draft', 'review', 'published']),
      lastModifiedAt: z.string(),
      template: z
        .object({
          templateId: z.string(),
          templateVersion: z.string(),
          templateSchemaHash: z.string(),
        })
        .optional(),
    })
    .nullable(),
  templateDecision: z
    .object({
      decisionId: z.string(),
      action: z.enum(['approved', 'pending', 'blocked']),
      templateId: z.string(),
      currentVersion: z.string(),
      requestedVersion: z.string(),
      submittedAt: z.string(),
      submittedBy: z.string().optional(),
      notes: z.string().nullable(),
    })
    .nullable(),
  lastUpdatedAt: z.string(),
});

describe('GET /api/v1/projects/:projectId/documents/primary', () => {
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
    await request(app).get(`/api/v1/projects/${projectId}/documents/primary`).expect(401);
  });

  test('returns primary document snapshot when project document exists', async () => {
    const createResponse = await request(app)
      .post('/api/v1/projects')
      .set(AuthorizationHeader)
      .send({
        name: 'Architecture Reference',
        visibility: 'workspace',
        goalSummary: 'Maintain architecture baseline',
      });

    expect(createResponse.status).toBe(201);
    const projectId = createResponse.body.id as string;
    expect(typeof projectId).toBe('string');

    const documentId = randomUUID();
    const sectionId = randomUUID();
    const authorId = 'user_arch_author';

    seedUserFixture(db, authorId);
    seedSectionFixture(db, {
      sectionId,
      documentId,
      userId: authorId,
      templateId: 'architecture-reference',
      templateVersion: '2.1.0',
      templateSchemaHash: 'tmpl-architecture-210',
    });

    db.prepare('UPDATE documents SET project_id = ? WHERE id = ?').run(projectId, documentId);

    const response = await request(app)
      .get(`/api/v1/projects/${projectId}/documents/primary`)
      .set(AuthorizationHeader)
      .expect(200);

    const payload = PrimaryDocumentSnapshotSchema.safeParse(response.body);
    expect(payload.success).toBe(true);
    if (!payload.success) {
      return;
    }

    expect(payload.data.projectId).toBe(projectId);
    expect(payload.data.status).toBe('ready');
    expect(payload.data.document).not.toBeNull();
    expect(payload.data.templateDecision).toBeNull();

    if (payload.data.document) {
      expect(payload.data.document.documentId).toBe(documentId);
      expect(payload.data.document.firstSectionId).toBe(sectionId);
      expect(payload.data.document.lifecycleStatus).toBe('published');
      expect(payload.data.document.template).toMatchObject({
        templateId: 'architecture-reference',
        templateVersion: '2.1.0',
        templateSchemaHash: 'tmpl-architecture-210',
      });
    }
  });

  test('returns missing snapshot when project has no documents', async () => {
    const createResponse = await request(app)
      .post('/api/v1/projects')
      .set(AuthorizationHeader)
      .send({
        name: 'Empty Project',
        visibility: 'workspace',
      });

    expect(createResponse.status).toBe(201);
    const projectId = createResponse.body.id as string;

    const response = await request(app)
      .get(`/api/v1/projects/${projectId}/documents/primary`)
      .set(AuthorizationHeader)
      .expect(200);

    const payload = PrimaryDocumentSnapshotSchema.safeParse(response.body);
    expect(payload.success).toBe(true);
    if (!payload.success) {
      return;
    }

    expect(payload.data.projectId).toBe(projectId);
    expect(payload.data.status).toBe('missing');
    expect(payload.data.document).toBeNull();
  });

  test('returns 404 when project does not exist', async () => {
    const unknownProjectId = randomUUID();

    const response = await request(app)
      .get(`/api/v1/projects/${unknownProjectId}/documents/primary`)
      .set(AuthorizationHeader)
      .expect(404);

    expect(response.body).toMatchObject({
      code: 'PROJECT_NOT_FOUND',
    });
  });
});

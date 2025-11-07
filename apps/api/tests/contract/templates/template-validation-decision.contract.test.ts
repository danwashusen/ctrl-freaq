import { randomUUID } from 'node:crypto';

import type { Express } from 'express';
import type * as BetterSqlite3 from 'better-sqlite3';
import request from 'supertest';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { createApp, type AppContext } from '../../../src/app';
import { MOCK_JWT_TOKEN } from '../../../src/middleware/test-auth';

vi.mock('@ctrl-freaq/exporter', () => ({
  DocumentExporter: class DocumentExporterStub {
    async generate() {
      return { artifactUrl: null };
    }
  },
}));

const AuthorizationHeader = { Authorization: `Bearer ${MOCK_JWT_TOKEN}` };

const TemplateDecisionSchema = z.object({
  decisionId: z.string().uuid(),
  action: z.enum(['approved', 'pending', 'blocked']),
  templateId: z.string().min(1),
  currentVersion: z.string().min(1),
  requestedVersion: z.string().min(1),
  submittedAt: z.string().min(1),
  submittedBy: z.string().optional(),
  notes: z.string().nullable(),
});

describe('POST /api/v1/projects/:projectId/templates/:templateId/decisions', () => {
  let app: Express;
  let db: BetterSqlite3.Database;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    app = await createApp();
    const context = app.locals.appContext as AppContext;
    db = context.database;
  });

  it('requires authentication', async () => {
    const projectId = randomUUID();
    await request(app)
      .post(`/api/v1/projects/${projectId}/templates/architecture-reference/decisions`)
      .send({})
      .expect(401);
  });

  it('persists template validation decisions and returns normalized payload', async () => {
    const createProject = await request(app)
      .post('/api/v1/projects')
      .set(AuthorizationHeader)
      .send({
        name: 'Template Decision Project',
        visibility: 'workspace',
        goalSummary: 'Capture template validation decision contract.',
      })
      .expect(201);

    const projectId = createProject.body.id as string;
    const provision = await request(app)
      .post(`/api/v1/projects/${projectId}/documents`)
      .set(AuthorizationHeader)
      .send({})
      .expect(201);

    const documentId = provision.body.documentId as string;
    const decisionResponse = await request(app)
      .post(
        `/api/v1/projects/${projectId}/templates/${provision.body.template.templateId}/decisions`
      )
      .set(AuthorizationHeader)
      .send({
        documentId,
        action: 'approved',
        currentVersion: provision.body.template.templateVersion,
        requestedVersion: provision.body.template.templateVersion,
        notes: 'Validated against architecture baseline.',
        payload: {
          introduction: 'Executive summary updated for review.',
        },
      })
      .expect(201);

    const payload = TemplateDecisionSchema.safeParse(decisionResponse.body);
    expect(payload.success).toBe(true);
    if (!payload.success) {
      throw new Error(`Unexpected template decision payload: ${decisionResponse.text}`);
    }

    expect(payload.data.templateId).toBe(provision.body.template.templateId);
    expect(payload.data.action).toBe('approved');
    expect(payload.data.notes).toBe('Validated against architecture baseline.');

    const persisted = db
      .prepare(
        'SELECT id, project_id, document_id, action, notes, payload_json FROM template_validation_decisions WHERE id = ? LIMIT 1'
      )
      .get(payload.data.decisionId) as {
      id?: string;
      project_id?: string;
      document_id?: string;
      action?: string;
      notes?: string | null;
      payload_json?: string | null;
    };

    expect(persisted?.id).toBe(payload.data.decisionId);
    expect(persisted?.project_id).toBe(projectId);
    expect(persisted?.document_id).toBe(documentId);
    expect(persisted?.action).toBe('approved');
    expect(persisted?.notes).toBe('Validated against architecture baseline.');
    expect(persisted?.payload_json).toContain('Executive summary updated');
  });

  it('rejects decisions for unknown projects', async () => {
    const missingProject = randomUUID();
    const response = await request(app)
      .post(`/api/v1/projects/${missingProject}/templates/architecture-reference/decisions`)
      .set(AuthorizationHeader)
      .send({
        documentId: randomUUID(),
        action: 'approved',
        currentVersion: '1.0.0',
        requestedVersion: '1.0.0',
      })
      .expect(404);

    expect(response.body).toMatchObject({ error: 'PROJECT_NOT_FOUND' });
  });
});

import { randomUUID } from 'node:crypto';

import type { Express } from 'express';
import type * as BetterSqlite3 from 'better-sqlite3';
import request from 'supertest';
import { beforeAll, describe, expect, test } from 'vitest';
import { z } from 'zod';

import { createApp, type AppContext } from '../../../src/app';
import { MOCK_JWT_TOKEN } from '../../../src/middleware/test-auth';

const AuthorizationHeader = { Authorization: `Bearer ${MOCK_JWT_TOKEN}` };

const ExportJobSchema = z.object({
  jobId: z.string().uuid(),
  projectId: z.string().uuid(),
  status: z.enum(['queued', 'running', 'completed', 'failed']),
  format: z.enum(['markdown', 'zip', 'pdf', 'bundle']),
  scope: z.enum(['primary_document', 'all_documents']).optional(),
  requestedBy: z.string().min(1),
  requestedAt: z.string().min(1),
  artifactUrl: z.string().url().nullable(),
  errorMessage: z.string().nullable(),
  completedAt: z.string().nullable(),
});

describe('POST /api/v1/projects/:projectId/export', () => {
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
    await request(app).post(`/api/v1/projects/${projectId}/export`).expect(401);
  });

  test('enqueues an export job and returns job metadata', async () => {
    const createProject = await request(app)
      .post('/api/v1/projects')
      .set(AuthorizationHeader)
      .send({
        name: 'Export Verification Project',
        visibility: 'workspace',
        goalSummary: 'Validate export contract transformations.',
      })
      .expect(201);

    const projectId = createProject.body.id as string;
    expect(projectId).toMatch(/^[0-9a-fA-F-]{36}$/);

    const provision = await request(app)
      .post(`/api/v1/projects/${projectId}/documents`)
      .set(AuthorizationHeader)
      .send({})
      .expect(201);

    expect(provision.body).toMatchObject({ status: 'created' });

    const exportResponse = await request(app)
      .post(`/api/v1/projects/${projectId}/export`)
      .set(AuthorizationHeader)
      .send({
        format: 'markdown',
        scope: 'primary_document',
        notifyEmail: 'qa@example.com',
      })
      .expect(202);

    const payload = ExportJobSchema.safeParse(exportResponse.body);
    expect(payload.success).toBe(true);
    if (!payload.success) {
      throw new Error(`Export job payload failed schema validation: ${exportResponse.text}`);
    }

    expect(payload.data.projectId).toBe(projectId);
    expect(payload.data.status).toBe('completed');
    expect(payload.data.artifactUrl).toMatch(/^data:text\/markdown;base64,/);
    expect(payload.data.errorMessage).toBeNull();
    expect(payload.data.completedAt).toMatch(/Z$/);

    const persisted = db
      .prepare(
        'SELECT project_id, format, status, artifact_url AS artifactUrl FROM document_export_jobs WHERE id = ? LIMIT 1'
      )
      .get(payload.data.jobId) as {
      project_id?: string;
      format?: string;
      status?: string;
      artifactUrl?: string;
    };

    expect(persisted?.project_id).toBe(projectId);
    expect(persisted?.format).toBe('markdown');
    expect(persisted?.status).toBe('completed');
    expect(persisted?.artifactUrl).toMatch(/^data:text\/markdown;base64,/);
  });

  test('allows repeated exports once the previous job completes', async () => {
    const createProject = await request(app)
      .post('/api/v1/projects')
      .set(AuthorizationHeader)
      .send({
        name: 'Export Concurrency Project',
        visibility: 'workspace',
        goalSummary: 'Ensure export route enforces single-flight.',
      })
      .expect(201);

    const projectId = createProject.body.id as string;

    await request(app)
      .post(`/api/v1/projects/${projectId}/documents`)
      .set(AuthorizationHeader)
      .send({})
      .expect(201);

    const firstJob = await request(app)
      .post(`/api/v1/projects/${projectId}/export`)
      .set(AuthorizationHeader)
      .send({ format: 'markdown' })
      .expect(202);

    const firstPayload = ExportJobSchema.safeParse(firstJob.body);
    expect(firstPayload.success).toBe(true);

    const secondJob = await request(app)
      .post(`/api/v1/projects/${projectId}/export`)
      .set(AuthorizationHeader)
      .send({ format: 'markdown' })
      .expect(202);

    const secondPayload = ExportJobSchema.safeParse(secondJob.body);
    expect(secondPayload.success).toBe(true);
    if (secondPayload.success && firstPayload.success) {
      expect(secondPayload.data.jobId).not.toBe(firstPayload.data.jobId);
      expect(secondPayload.data.status).toBe('completed');
    }
  });

  test('returns not found for unknown projects', async () => {
    const missingProject = randomUUID();
    const response = await request(app)
      .post(`/api/v1/projects/${missingProject}/export`)
      .set(AuthorizationHeader)
      .send({ format: 'markdown' })
      .expect(404);

    expect(response.body).toMatchObject({ code: 'PROJECT_NOT_FOUND' });
  });
});

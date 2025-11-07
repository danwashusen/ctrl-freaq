import { randomUUID } from 'node:crypto';

import type { Express } from 'express';
import type * as BetterSqlite3 from 'better-sqlite3';
import request from 'supertest';
import { beforeAll, describe, expect, test } from 'vitest';
import { z } from 'zod';

import { createApp, type AppContext } from '../../../src/app';
import { MOCK_JWT_TOKEN, TEMPLATE_MANAGER_JWT_TOKEN } from '../../../src/middleware/test-auth';

const AuthorizationHeader = { Authorization: `Bearer ${MOCK_JWT_TOKEN}` };
const SecondaryAuthorizationHeader = { Authorization: `Bearer ${TEMPLATE_MANAGER_JWT_TOKEN}` };

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

  const waitForExportJob = async (projectId: string, jobId: string) => {
    for (let attempt = 0; attempt < 10; attempt += 1) {
      const statusResponse = await request(app)
        .get(`/api/v1/projects/${projectId}/export/jobs/${jobId}`)
        .set(AuthorizationHeader)
        .expect(200);

      const parsed = ExportJobSchema.safeParse(statusResponse.body);
      if (!parsed.success) {
        throw new Error(`Invalid export job status payload: ${statusResponse.text}`);
      }

      if (parsed.data.status === 'completed' || parsed.data.status === 'failed') {
        return parsed.data;
      }

      await new Promise(resolve => setTimeout(resolve, 25));
    }

    throw new Error('Export job did not complete in time');
  };

  test('requires authentication', async () => {
    const projectId = randomUUID();
    await request(app).post(`/api/v1/projects/${projectId}/export`).expect(401);
  });

  test('denies export requests from non-owners', async () => {
    const createProject = await request(app)
      .post('/api/v1/projects')
      .set(AuthorizationHeader)
      .send({
        name: 'Forbidden Export Project',
        visibility: 'workspace',
      })
      .expect(201);

    const projectId = createProject.body.id as string;

    const response = await request(app)
      .post(`/api/v1/projects/${projectId}/export`)
      .set(SecondaryAuthorizationHeader)
      .send({ format: 'markdown' })
      .expect(403);

    expect(response.body).toMatchObject({ code: 'FORBIDDEN' });
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
    expect(payload.data.status).toBe('queued');
    expect(payload.data.artifactUrl).toBeNull();
    expect(payload.data.errorMessage).toBeNull();
    expect(payload.data.completedAt).toBeNull();

    const completedJob = await waitForExportJob(projectId, payload.data.jobId);
    expect(completedJob.status).toBe('completed');
    expect(completedJob.artifactUrl).toMatch(/^data:text\/markdown;base64,/);
    expect(completedJob.completedAt).toMatch(/Z$/);

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
    if (!firstPayload.success) {
      throw new Error(`First export payload invalid: ${firstJob.text}`);
    }

    await waitForExportJob(projectId, firstPayload.data.jobId);

    const secondJob = await request(app)
      .post(`/api/v1/projects/${projectId}/export`)
      .set(AuthorizationHeader)
      .send({ format: 'markdown' })
      .expect(202);

    const secondPayload = ExportJobSchema.safeParse(secondJob.body);
    expect(secondPayload.success).toBe(true);
    if (!secondPayload.success) {
      throw new Error(`Second export payload invalid: ${secondJob.text}`);
    }

    expect(secondPayload.data.jobId).not.toBe(firstPayload.data.jobId);
    await waitForExportJob(projectId, secondPayload.data.jobId);
  });

  test('rejects export job status lookups from other users', async () => {
    const createProject = await request(app)
      .post('/api/v1/projects')
      .set(AuthorizationHeader)
      .send({
        name: 'Export Job Privacy Project',
        visibility: 'workspace',
      })
      .expect(201);

    const projectId = createProject.body.id as string;

    await request(app)
      .post(`/api/v1/projects/${projectId}/documents`)
      .set(AuthorizationHeader)
      .send({})
      .expect(201);

    const exportResponse = await request(app)
      .post(`/api/v1/projects/${projectId}/export`)
      .set(AuthorizationHeader)
      .send({ format: 'markdown' })
      .expect(202);

    const payload = ExportJobSchema.safeParse(exportResponse.body);
    expect(payload.success).toBe(true);
    if (!payload.success) {
      throw new Error(`Export payload invalid: ${exportResponse.text}`);
    }

    await request(app)
      .get(`/api/v1/projects/${projectId}/export/jobs/${payload.data.jobId}`)
      .set(SecondaryAuthorizationHeader)
      .expect(403);
  });

  test('returns not found when export job id does not exist', async () => {
    const createProject = await request(app)
      .post('/api/v1/projects')
      .set(AuthorizationHeader)
      .send({
        name: 'Export Job Missing Project',
        visibility: 'workspace',
      })
      .expect(201);

    const projectId = createProject.body.id as string;

    await request(app)
      .get(`/api/v1/projects/${projectId}/export/jobs/${randomUUID()}`)
      .set(AuthorizationHeader)
      .expect(404);
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

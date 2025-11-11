import type { Express } from 'express';
import request from 'supertest';
import { beforeAll, describe, expect, test } from 'vitest';

import { createApp } from '../../../src/app';
import { MOCK_JWT_TOKEN, TEMPLATE_MANAGER_JWT_TOKEN } from '../../../src/middleware/test-auth';

const AuthorizationHeader = { Authorization: `Bearer ${MOCK_JWT_TOKEN}` };
const SecondaryAuthorizationHeader = { Authorization: `Bearer ${TEMPLATE_MANAGER_JWT_TOKEN}` };

describe('GET /api/v1/documents/:documentId', () => {
  let app: Express;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    app = await createApp();
  });

  async function createProjectDocument() {
    const projectResponse = await request(app)
      .post('/api/v1/projects')
      .set(AuthorizationHeader)
      .send({
        name: 'Document Detail Security',
        visibility: 'workspace',
      })
      .expect(201);

    const projectId = projectResponse.body.id as string;

    const documentResponse = await request(app)
      .post(`/api/v1/projects/${projectId}/documents`)
      .set(AuthorizationHeader)
      .send({
        title: 'Live Document Detail',
      })
      .expect(201);

    const documentId = documentResponse.body.documentId as string;
    return { projectId, documentId };
  }

  test('requires authentication', async () => {
    const { documentId } = await createProjectDocument();
    await request(app).get(`/api/v1/documents/${documentId}`).expect(401);
  });

  test('rejects access from users who do not own the project', async () => {
    const { documentId } = await createProjectDocument();

    const response = await request(app)
      .get(`/api/v1/documents/${documentId}`)
      .set(SecondaryAuthorizationHeader)
      .expect(403);

    expect(response.body).toMatchObject({ code: 'FORBIDDEN' });
  });

  test('returns document metadata for project owners', async () => {
    const { projectId, documentId } = await createProjectDocument();

    const response = await request(app)
      .get(`/api/v1/documents/${documentId}`)
      .set(AuthorizationHeader)
      .expect(200);

    expect(response.body.document).toBeDefined();
    expect(response.body.document.id).toBe(documentId);
    expect(response.body.document.projectId).toBe(projectId);
    expect(response.body.document.title).toBe('Live Document Detail');
    expect(typeof response.body.document.content).toBe('object');
    expect(
      response.body.templateDecision === null || typeof response.body.templateDecision === 'object'
    ).toBe(true);
  });
});

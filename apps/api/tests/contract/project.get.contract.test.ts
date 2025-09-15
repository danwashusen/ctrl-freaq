import type { Express } from 'express';
import request from 'supertest';
import { describe, test, expect, beforeAll, afterAll } from 'vitest';

/**
 * Contract test: GET /api/v1/projects/:projectId (by ID)
 *
 * Verifies:
 * - 401 without JWT
 * - 404 for non-existent ID
 * - 200 with JWT for owned project and expected shape
 */

describe('Project Get By ID API Contract', () => {
  let app: Express;

  beforeAll(async () => {
    const { createApp } = await import('../../src/app');
    app = await createApp();
  });

  afterAll(async () => {
    // No server to close when using supertest(app)
  });

  test('GET /api/v1/projects/:id requires authentication', async () => {
    await request(app).get('/api/v1/projects/11111111-1111-1111-1111-111111111111').expect(401);
  });

  test('GET /api/v1/projects/:id returns 404 for unknown ID', async () => {
    await request(app)
      .get('/api/v1/projects/11111111-1111-1111-1111-111111111111')
      .set('Authorization', 'Bearer mock-jwt-token')
      .expect(404);
  });

  test('GET /api/v1/projects/:id returns project when owned by user', async () => {
    // Create a project
    const createRes = await request(app)
      .post('/api/v1/projects')
      .set('Authorization', 'Bearer mock-jwt-token')
      .send({ name: 'ById Project', description: 'Lookup test' });

    if (createRes.status !== 201 && createRes.status !== 409) {
      expect(createRes.status).toBe(201);
    }

    // If conflict, we need to fetch the user project to get ID via list endpoint
    let projectId: string | undefined;
    if (createRes.status === 201) {
      projectId = createRes.body.id;
    } else {
      const listRes = await request(app)
        .get('/api/v1/projects')
        .set('Authorization', 'Bearer mock-jwt-token')
        .expect(200);
      const first = listRes.body.projects?.[0];
      projectId = first?.id;
    }

    expect(projectId).toBeTruthy();

    const res = await request(app)
      .get(`/api/v1/projects/${projectId}`)
      .set('Authorization', 'Bearer mock-jwt-token')
      .expect(200)
      .expect('Content-Type', /json/);

    // Basic shape checks
    expect(res.body).toHaveProperty('id');
    expect(res.body).toHaveProperty('ownerUserId');
    expect(res.body).toHaveProperty('name');
    expect(res.body).toHaveProperty('slug');
    expect(res.body).toHaveProperty('createdAt');
    expect(res.body).toHaveProperty('updatedAt');

    // Request-id header present
    const reqId = res.headers['x-request-id'];
    expect(reqId).toBeTruthy();
    expect(typeof reqId).toBe('string');
  });
});

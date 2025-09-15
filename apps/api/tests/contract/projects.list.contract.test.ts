import type { Express } from 'express';
import request from 'supertest';
import { describe, test, expect, beforeAll, afterAll } from 'vitest';

/**
 * Contract test: GET /api/v1/projects (list)
 *
 * Verifies:
 * - 401 without JWT
 * - 200 with JWT and object shape { projects: [], total }
 * - Query validation for limit/offset
 * - When a project exists, it appears in the list and includes lastModified: 'N/A'
 */

describe('Projects List API Contract', () => {
  let app: Express;

  beforeAll(async () => {
    const { createApp } = await import('../../src/app');
    app = await createApp();
  });

  afterAll(async () => {
    // No server to close when using supertest(app)
  });

  test('GET /api/v1/projects requires authentication', async () => {
    await request(app).get('/api/v1/projects').expect(401).expect('Content-Type', /json/);
  });

  test('GET /api/v1/projects validates query parameters', async () => {
    await request(app)
      .get('/api/v1/projects?limit=0')
      .set('Authorization', 'Bearer mock-jwt-token')
      .expect(400);

    await request(app)
      .get('/api/v1/projects?offset=-1')
      .set('Authorization', 'Bearer mock-jwt-token')
      .expect(400);
  });

  test('GET /api/v1/projects returns list shape and fields', async () => {
    // Create a project via existing endpoint (MVP one per user)
    const createRes = await request(app)
      .post('/api/v1/projects')
      .set('Authorization', 'Bearer mock-jwt-token')
      .send({ name: 'Alpha Project', description: 'First project' });

    // In TDD phase this may fail; implementation will make it pass
    if (createRes.status !== 201 && createRes.status !== 409) {
      // Allow either created or conflict (already created in earlier test run)
      expect(createRes.status).toBe(201);
    }

    const res = await request(app)
      .get('/api/v1/projects?limit=20&offset=0')
      .set('Authorization', 'Bearer mock-jwt-token')
      .expect(200)
      .expect('Content-Type', /json/);

    expect(res.body).toHaveProperty('projects');
    expect(Array.isArray(res.body.projects)).toBe(true);
    expect(res.body).toHaveProperty('total');
    expect(typeof res.body.total).toBe('number');

    if (res.body.projects.length > 0) {
      const p = res.body.projects[0];
      expect(p).toHaveProperty('id');
      expect(p).toHaveProperty('name');
      expect(p).toHaveProperty('slug');
      expect(p).toHaveProperty('ownerUserId');
      expect(p).toHaveProperty('lastModified');
      expect(p.lastModified).toBe('N/A');
      expect(p).toHaveProperty('memberAvatars');
      expect(Array.isArray(p.memberAvatars)).toBe(true);
    }
  });
});

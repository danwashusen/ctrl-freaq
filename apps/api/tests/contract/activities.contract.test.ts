import type { Express } from 'express';
import request from 'supertest';
import { describe, test, expect, beforeAll, afterAll } from 'vitest';

/**
 * Contract test: GET /api/v1/activities
 *
 * Verifies authenticated access and response shape per spec:
 * - 401 without JWT
 * - 200 with JWT and correct shape { activities: [], total }
 * - Query param validation for limit (1–50)
 */

describe('Activities API Contract', () => {
  let app: Express;

  beforeAll(async () => {
    const { createApp } = await import('../../src/app');
    app = await createApp();
  });

  afterAll(async () => {
    // No server to close when using supertest(app)
  });

  test('GET /api/v1/activities requires authentication', async () => {
    await request(app).get('/api/v1/activities').expect(401).expect('Content-Type', /json/);
  });

  test('GET /api/v1/activities returns empty list shape when authenticated', async () => {
    const res = await request(app)
      .get('/api/v1/activities')
      .set('Authorization', 'Bearer mock-jwt-token')
      .expect(200)
      .expect('Content-Type', /json/);

    expect(res.body).toHaveProperty('activities');
    expect(Array.isArray(res.body.activities)).toBe(true);
    expect(res.body).toHaveProperty('total');
    expect(typeof res.body.total).toBe('number');
  });

  test('GET /api/v1/activities validates limit bounds', async () => {
    await request(app)
      .get('/api/v1/activities?limit=0')
      .set('Authorization', 'Bearer mock-jwt-token')
      .expect(400);

    await request(app)
      .get('/api/v1/activities?limit=51')
      .set('Authorization', 'Bearer mock-jwt-token')
      .expect(400);

    await request(app)
      .get('/api/v1/activities?limit=10')
      .set('Authorization', 'Bearer mock-jwt-token')
      .expect(200);
  });
});

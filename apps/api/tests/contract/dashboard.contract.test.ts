import type { Express } from 'express';
import request from 'supertest';
import { describe, test, expect, beforeAll, afterAll } from 'vitest';

/**
 * Contract test: GET /api/v1/dashboard
 *
 * Verifies authenticated access and response shape per spec:
 * - 401 without JWT
 * - 200 with JWT and correct shape { projects: [], activities: [], stats: { totalProjects } }
 */

describe('Dashboard API Contract', () => {
  let app: Express;

  beforeAll(async () => {
    const { createApp } = await import('../../src/app');
    app = await createApp();
  });

  afterAll(async () => {
    // No server to close when using supertest(app)
  });

  test('GET /api/v1/dashboard requires authentication', async () => {
    await request(app).get('/api/v1/dashboard').expect(401).expect('Content-Type', /json/);
  });

  test('GET /api/v1/dashboard returns aggregated shape when authenticated', async () => {
    const res = await request(app)
      .get('/api/v1/dashboard')
      .set('Authorization', 'Bearer mock-jwt-token')
      .expect(200)
      .expect('Content-Type', /json/);

    expect(res.body).toHaveProperty('projects');
    expect(Array.isArray(res.body.projects)).toBe(true);
    expect(res.body).toHaveProperty('activities');
    expect(Array.isArray(res.body.activities)).toBe(true);
    expect(res.body).toHaveProperty('stats');
    expect(typeof res.body.stats).toBe('object');
    expect(res.body.stats).toHaveProperty('totalProjects');
    expect(typeof res.body.stats.totalProjects).toBe('number');
  });
});

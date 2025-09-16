import type { Express } from 'express';
import request from 'supertest';
import { describe, test, beforeAll, afterAll } from 'vitest';

/**
 * Contract test: POST /api/v1/projects/:projectId/select
 *
 * Verifies:
 * - 401 without JWT
 * - 400 for invalid UUID path param
 * - 204 on valid selection (MVP no-op)
 * Note: 403/404 cases depend on repository data and may be added once repos support them
 */

describe('Project Selection API Contract', () => {
  let app: Express;

  beforeAll(async () => {
    const { createApp } = await import('../../src/app');
    app = await createApp();
  });

  afterAll(async () => {
    // No server to close when using supertest(app)
  });

  test('POST /api/v1/projects/:projectId/select requires authentication', async () => {
    await request(app)
      .post('/api/v1/projects/550e8400-e29b-41d4-a716-446655440000/select')
      .expect(401)
      .expect('Content-Type', /json/);
  });

  test('POST /api/v1/projects/:projectId/select validates UUID', async () => {
    await request(app)
      .post('/api/v1/projects/not-a-uuid/select')
      .set('Authorization', 'Bearer mock-jwt-token')
      .expect(400);
  });

  test('POST /api/v1/projects/:projectId/select returns 204 for valid selection (MVP)', async () => {
    await request(app)
      .post('/api/v1/projects/550e8400-e29b-41d4-a716-446655440000/select')
      .set('Authorization', 'Bearer mock-jwt-token')
      .expect(204);
  });
});

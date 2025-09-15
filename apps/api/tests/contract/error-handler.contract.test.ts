import type { Express } from 'express';
import request from 'supertest';
import { describe, it, expect, beforeAll } from 'vitest';

describe('Standardized Error Responses', () => {
  let app: Express;

  beforeAll(async () => {
    const { createApp } = await import('../../src/app');
    app = await createApp();
  });

  it('returns 401 UNAUTHORIZED with standard shape when missing auth', async () => {
    const res = await request(app).get('/api/v1/projects').expect(401);
    expect(res.body).toHaveProperty('error', 'UNAUTHORIZED');
    expect(res.body).toHaveProperty('message');
    expect(res.body).toHaveProperty('requestId');
    expect(res.body).toHaveProperty('timestamp');
  });

  it('translates Zod validation errors into 400 VALIDATION_ERROR with details', async () => {
    const res = await request(app)
      .get('/api/v1/activities?limit=0')
      .set('Authorization', 'Bearer mock-jwt-token')
      .expect(400);

    expect(res.body).toHaveProperty('error', 'VALIDATION_ERROR');
    expect(res.body).toHaveProperty('message');
    expect(res.body).toHaveProperty('requestId');
    expect(res.body).toHaveProperty('timestamp');
    // details may include formatted Zod issues
    expect(res.body).toHaveProperty('details');
  });

  it('returns 400 on invalid UUID for project selection', async () => {
    const res = await request(app)
      .post('/api/v1/projects/not-a-uuid/select')
      .set('Authorization', 'Bearer mock-jwt-token')
      .expect(400);
    expect(res.body).toHaveProperty('error', 'VALIDATION_ERROR');
  });
});

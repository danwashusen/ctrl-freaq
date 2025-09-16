import type { Express } from 'express';
import request from 'supertest';
import { describe, it, expect, beforeAll } from 'vitest';

describe('Request ID Middleware', () => {
  let app: Express;

  beforeAll(async () => {
    const { createApp } = await import('../../src/app');
    app = await createApp();
  });

  it('includes x-request-id header on 200 responses (health)', async () => {
    const res = await request(app).get('/health').expect(200);
    const reqId = res.headers['x-request-id'];
    expect(reqId).toBeTruthy();
    expect(typeof reqId).toBe('string');
  });

  it('includes x-request-id header on 200 responses (dashboard)', async () => {
    const res = await request(app)
      .get('/api/v1/dashboard')
      .set('Authorization', 'Bearer mock-jwt-token')
      .expect(200);
    const reqId = res.headers['x-request-id'];
    expect(reqId).toBeTruthy();
    expect(typeof reqId).toBe('string');
  });
});

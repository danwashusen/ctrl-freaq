import type { Express } from 'express';
import request from 'supertest';
import { beforeAll, describe, expect, test } from 'vitest';

import { buildBrowserLogBatch } from '../../fixtures/browser-logs.js';

describe('POST /api/v1/logs contract – auth and rate limiting', () => {
  let app: Express;
  let throttledApp: Express;

  beforeAll(async () => {
    const { createApp } = await import('../../../src/app.js');
    app = await createApp();
    throttledApp = await createApp({
      security: {
        trustProxy: false,
        rateLimiting: {
          windowMs: 1_000,
          max: 1,
          mode: 'reject',
        },
      },
    });
  });

  test('returns 401 when Authorization header is missing', async () => {
    const response = await request(app).post('/api/v1/logs').send(buildBrowserLogBatch());

    expect(response.status).toBe(401);
    expect(response.body).toMatchObject({
      error: expect.stringMatching(/unauthorized/i),
    });
  });

  test('propagates 429 Too Many Requests when rate limit is exceeded', async () => {
    const authHeader = 'Bearer mock-jwt-token';
    const validPayload = buildBrowserLogBatch();

    await request(throttledApp)
      .post('/api/v1/logs')
      .set('Authorization', authHeader)
      .send(validPayload)
      .expect(202);

    const throttledResponse = await request(throttledApp)
      .post('/api/v1/logs')
      .set('Authorization', authHeader)
      .send(validPayload);

    expect(throttledResponse.status).toBe(429);
    expect(throttledResponse.headers['retry-after']).toBeDefined();
    expect(throttledResponse.body).toMatchObject({
      error: 'RATE_LIMIT_EXCEEDED',
    });
  });
});

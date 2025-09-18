import type { Express } from 'express';
import request from 'supertest';
import { beforeAll, describe, expect, test } from 'vitest';

import { createApp } from '../../src/app';
import { getManagerAuthHeader } from '../../src/testing/templates-test-helpers.js';

describe('Authenticated rate limiting', () => {
  let app: Express;

  beforeAll(async () => {
    app = await createApp({
      security: {
        trustProxy: false,
        rateLimiting: {
          windowMs: 1000,
          max: 2,
        },
      },
    });
  });

  test('enforces per-user quotas and surfaces retry headers', async () => {
    const authHeader = getManagerAuthHeader();

    const first = await request(app).get('/api/v1/templates').set('Authorization', authHeader);
    expect(first.status).toBe(200);

    const second = await request(app).get('/api/v1/templates').set('Authorization', authHeader);
    expect(second.status).toBe(200);

    const third = await request(app).get('/api/v1/templates').set('Authorization', authHeader);

    expect(third.status).toBe(429);
    expect(third.headers['retry-after']).toBeDefined();
    expect(third.headers['x-ratelimit-limit']).toBe('2');
    expect(third.headers['x-ratelimit-remaining']).toBeDefined();
  });
});

import type { Express } from 'express';
import request from 'supertest';
import { beforeAll, describe, expect, test } from 'vitest';

import { buildBrowserLogBatch } from '../../fixtures/browser-logs.js';

describe('POST /api/v1/logs contract – acceptance happy path', () => {
  let app: Express;

  beforeAll(async () => {
    const { createApp } = await import('../../../src/app.js');
    app = await createApp();
  });

  test('acknowledges valid browser log batches with HTTP 202', async () => {
    const payload = buildBrowserLogBatch({ logsCount: 3 });

    const response = await request(app)
      .post('/api/v1/logs')
      .set('Authorization', 'Bearer mock-jwt-token')
      .send(payload)
      .expect(202)
      .expect('Content-Type', /application\/json/);

    const headerRequestId = response.headers['x-request-id'];
    expect(typeof headerRequestId).toBe('string');
    expect(headerRequestId).toBeTruthy();

    expect(response.body).toMatchObject({
      status: 'accepted',
      receivedCount: payload.logs.length,
      requestId: headerRequestId,
    });
  });
});

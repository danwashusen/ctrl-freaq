import type { Express } from 'express';
import request from 'supertest';
import { beforeAll, beforeEach, describe, expect, test } from 'vitest';

import { buildBrowserLogBatch, serializeBatchAsText } from '../../fixtures/browser-logs.js';
import { resetDatabaseForApp } from '../../../src/testing/reset.js';

describe('Browser log ingestion – sendBeacon payloads', () => {
  let app: Express;

  beforeAll(async () => {
    const { createApp } = await import('../../../src/app.js');
    app = await createApp();
  });

  beforeEach(() => {
    resetDatabaseForApp(app);
  });

  test('accepts text/plain payloads that encode JSON batches', async () => {
    const payload = buildBrowserLogBatch({ logsCount: 2 });
    const serialized = serializeBatchAsText(payload);

    const response = await request(app)
      .post('/api/v1/logs')
      .set('Authorization', 'Bearer mock-jwt-token')
      .set('Content-Type', 'text/plain')
      .send(serialized)
      .expect(202)
      .expect('Content-Type', /application\/json/);

    expect(response.headers['x-request-id']).toBeDefined();
    expect(response.body).toMatchObject({
      status: 'accepted',
      requestId: response.headers['x-request-id'],
      receivedCount: payload.logs.length,
    });
  });
});

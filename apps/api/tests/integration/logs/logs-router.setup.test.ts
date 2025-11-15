import type { Express } from 'express';
import request from 'supertest';
import { beforeAll, beforeEach, describe, expect, test } from 'vitest';

import { resetDatabaseForApp } from '../../../src/testing/reset';

describe('Logs router scaffolding', () => {
  let app: Express;

  beforeAll(async () => {
    const { createApp } = await import('../../../src/app');
    app = await createApp();
  });

  beforeEach(() => {
    resetDatabaseForApp(app);
  });

  test('POST /api/v1/logs responds with acceptance payload', async () => {
    const response = await request(app)
      .post('/api/v1/logs')
      .set('Authorization', 'Bearer mock-jwt-token')
      .send({
        source: 'browser',
        sessionId: 'sess_placeholder',
        logs: [
          {
            timestamp: new Date().toISOString(),
            level: 'INFO',
            message: 'phase 2 scaffolding',
            requestId: 'req_placeholder',
          },
        ],
      })
      .expect(202);

    expect(response.headers['x-request-id']).toBeDefined();
    expect(response.body).toMatchObject({
      status: 'accepted',
      requestId: response.headers['x-request-id'],
      receivedCount: 1,
    });
  });
});

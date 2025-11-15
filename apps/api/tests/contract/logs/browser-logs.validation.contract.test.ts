import type { Express } from 'express';
import request from 'supertest';
import { beforeAll, describe, expect, test } from 'vitest';

import {
  buildBrowserLogBatch,
  buildMalformedBrowserLogBatch,
} from '../../fixtures/browser-logs.js';

describe('POST /api/v1/logs contract – validation failures', () => {
  let app: Express;

  beforeAll(async () => {
    const { createApp } = await import('../../../src/app.js');
    app = await createApp();
  });

  test('returns 400 INVALID_PAYLOAD when a log entry is missing requestId', async () => {
    const invalidPayload = buildMalformedBrowserLogBatch({
      scenario: 'missingRequestId',
    });

    const response = await request(app)
      .post('/api/v1/logs')
      .set('Authorization', 'Bearer mock-jwt-token')
      .send(invalidPayload)
      .expect(400);

    expect(response.body).toMatchObject({
      code: 'INVALID_PAYLOAD',
      requestId: expect.any(String),
      details: {
        path: 'logs[0].requestId',
      },
    });
    expect(typeof response.body.message).toBe('string');
  });

  test('returns 400 INVALID_PAYLOAD when log level is unsupported', async () => {
    const payload = buildBrowserLogBatch({
      entryOverrides: { level: 'TRACE' as never },
    });

    const response = await request(app)
      .post('/api/v1/logs')
      .set('Authorization', 'Bearer mock-jwt-token')
      .send(payload)
      .expect(400);

    expect(response.body.code).toBe('INVALID_PAYLOAD');
    expect(response.body.details).toMatchObject({
      path: 'logs[0].level',
    });
    expect(typeof response.body.message).toBe('string');
  });

  test('rejects non-browser sources with INVALID_PAYLOAD', async () => {
    const invalidSourcePayload = buildMalformedBrowserLogBatch({
      scenario: 'invalidSource',
    });

    const response = await request(app)
      .post('/api/v1/logs')
      .set('Authorization', 'Bearer mock-jwt-token')
      .send(invalidSourcePayload)
      .expect(400);

    expect(response.body.code).toBe('INVALID_PAYLOAD');
    expect(response.body.details).toMatchObject({
      path: 'source',
    });
    expect(typeof response.body.message).toBe('string');
  });
});

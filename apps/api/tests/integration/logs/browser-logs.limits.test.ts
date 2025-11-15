import type { Express } from 'express';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test } from 'vitest';

import {
  buildBrowserLogBatch,
  buildMalformedBrowserLogBatch,
  buildOversizeBrowserLogBatch,
} from '../../fixtures/browser-logs.js';
import { createBrowserLoggerSpy, type BrowserLoggerSpy } from '../../fixtures/logger-spy.js';
import { resetDatabaseForApp } from '../../../src/testing/reset.js';

describe('Browser log ingestion – limits and rejection paths', () => {
  let app: Express;
  let throttledApp: Express;
  let loggerSpy: BrowserLoggerSpy;
  let throttledLoggerSpy: BrowserLoggerSpy;

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
    loggerSpy = createBrowserLoggerSpy(app.locals.appContext.logger);
    throttledLoggerSpy = createBrowserLoggerSpy(throttledApp.locals.appContext.logger);
  });

  beforeEach(() => {
    resetDatabaseForApp(app);
    resetDatabaseForApp(throttledApp);
  });

  afterEach(() => {
    loggerSpy.clear();
    throttledLoggerSpy.clear();
  });

  afterAll(() => {
    loggerSpy.restore();
    throttledLoggerSpy.restore();
  });

  test('rejects payloads exceeding 1MB with 413 and no emitted logs', async () => {
    const oversizePayload = buildOversizeBrowserLogBatch();

    const response = await request(app)
      .post('/api/v1/logs')
      .set('Authorization', 'Bearer mock-jwt-token')
      .send(oversizePayload)
      .expect(413);

    expect(response.body).toMatchObject({
      code: 'PAYLOAD_TOO_LARGE',
      message: expect.stringMatching(/1 ?mb/i),
      requestId: expect.any(String),
    });
    expect(response.headers['retry-after']).toBeUndefined();
    expect(loggerSpy.getBrowserLogs()).toHaveLength(0);
  });

  test('rejects batches with more than 100 entries and emits no partial logs', async () => {
    const tooManyEntries = buildMalformedBrowserLogBatch({
      scenario: 'tooManyEntries',
    });

    const response = await request(app)
      .post('/api/v1/logs')
      .set('Authorization', 'Bearer mock-jwt-token')
      .send(tooManyEntries)
      .expect(413);

    expect(response.body.code).toBe('PAYLOAD_TOO_LARGE');
    expect(response.body.details).toMatchObject({
      path: 'logs',
    });
    expect(loggerSpy.getBrowserLogs()).toHaveLength(0);
  });

  test('propagates 429 Too Many Requests from rate limiting with Retry-After', async () => {
    const payload = buildBrowserLogBatch();

    await request(throttledApp)
      .post('/api/v1/logs')
      .set('Authorization', 'Bearer mock-jwt-token')
      .send(payload)
      .expect(202);

    const throttledResponse = await request(throttledApp)
      .post('/api/v1/logs')
      .set('Authorization', 'Bearer mock-jwt-token')
      .send(payload)
      .expect(429);

    expect(throttledResponse.headers['retry-after']).toBeDefined();
    expect(throttledResponse.body).toMatchObject({
      error: 'RATE_LIMIT_EXCEEDED',
      requestId: expect.any(String),
    });
    expect(throttledLoggerSpy.getBrowserLogs()).toHaveLength(1);
  });
});

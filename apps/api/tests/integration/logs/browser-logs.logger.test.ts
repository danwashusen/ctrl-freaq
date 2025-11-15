import type { Express } from 'express';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, describe, expect, test } from 'vitest';

import { buildBrowserLogBatch, buildBrowserLogEntry } from '../../fixtures/browser-logs.js';
import { createBrowserLoggerSpy, type BrowserLoggerSpy } from '../../fixtures/logger-spy.js';

describe('Browser log ingestion – structured logging', () => {
  let app: Express;
  let loggerSpy: BrowserLoggerSpy;

  beforeAll(async () => {
    const { createApp } = await import('../../../src/app.js');
    app = await createApp();
    loggerSpy = createBrowserLoggerSpy(app.locals.appContext.logger);
  });

  afterEach(() => {
    loggerSpy.clear();
  });

  afterAll(() => {
    loggerSpy.restore();
  });

  test('emits enriched browser.log entries for each payload entry', async () => {
    const entries = [
      buildBrowserLogEntry({
        level: 'DEBUG',
        requestId: 'req_entry_debug',
      }),
      buildBrowserLogEntry({
        level: 'INFO',
        requestId: 'req_entry_info',
      }),
      buildBrowserLogEntry({
        level: 'WARN',
        requestId: 'req_entry_warn',
      }),
      buildBrowserLogEntry({
        level: 'ERROR',
        requestId: 'req_entry_error',
        sessionId: 'sess_entry_override',
      }),
      buildBrowserLogEntry({
        level: 'FATAL',
        requestId: 'req_entry_fatal',
      }),
    ];
    const payload = buildBrowserLogBatch({
      sessionId: 'sess_batch_logger',
      entries,
    });

    const response = await request(app)
      .post('/api/v1/logs')
      .set('Authorization', 'Bearer mock-jwt-token')
      .set('User-Agent', 'VitestAgent/1.0 (+fixture)')
      .send(payload)
      .expect(202);

    expect(response.body).toMatchObject({
      receivedCount: entries.length,
    });

    const records = loggerSpy.getBrowserLogs();
    expect(records).toHaveLength(entries.length);

    expect(records.map(record => record.level)).toEqual([
      'debug',
      'info',
      'warn',
      'error',
      'fatal',
    ]);

    records.forEach((record, index) => {
      const entry = entries.at(index);
      if (!entry) {
        throw new Error(`Missing entry for index ${index}`);
      }
      const expectedSession = entry.sessionId ?? payload.sessionId;
      const logPayload = record.payload;

      expect(logPayload).toMatchObject({
        event: 'browser.log',
        apiRequestId: response.body.requestId,
        entryRequestId: entry.requestId,
        sessionId: expectedSession,
        userId: 'user-local-author',
        ip: expect.any(String),
        userAgent: 'VitestAgent/1.0 (+fixture)',
        level: entry.level,
      });

      expect(logPayload.payload).toMatchObject({
        requestId: entry.requestId,
        index,
        sessionId: expectedSession,
      });
    });
  });
});

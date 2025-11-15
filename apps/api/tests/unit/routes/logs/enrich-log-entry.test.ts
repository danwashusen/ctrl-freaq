import { beforeEach, afterEach, describe, expect, test, vi } from 'vitest';

import type { ServiceContainer } from '../../../../src/core/service-locator.js';
import type { BrowserLogsRequest } from '../../../../src/routes/logs/index.js';
import { enrichLogEntry } from '../../../../src/routes/logs/enrich-log-entry.js';
import type {
  BrowserLogBatch as SchemaBrowserLogBatch,
  BrowserLogEntryWithIndex,
} from '../../../../src/routes/logs/logs.schema.js';
import {
  buildBrowserLogBatch,
  buildBrowserLogEntry,
  type BrowserLogBatch as FixtureBrowserLogBatch,
  type BrowserLogEntry as FixtureBrowserLogEntry,
  type BuildBrowserLogBatchOptions,
} from '../../../fixtures/browser-logs.js';

function createSchemaBatch(options?: BuildBrowserLogBatchOptions): SchemaBrowserLogBatch {
  return adaptBatch(buildBrowserLogBatch(options));
}

function adaptBatch(batch: FixtureBrowserLogBatch): SchemaBrowserLogBatch {
  return {
    ...batch,
    logs: batch.logs.map((entry, index) => adaptEntry(entry, index)),
  };
}

function adaptEntry(entry: FixtureBrowserLogEntry, index: number): BrowserLogEntryWithIndex {
  return {
    ...entry,
    index,
  };
}

function createRequest(overrides: Partial<BrowserLogsRequest> = {}): BrowserLogsRequest {
  const base = {
    body: undefined,
    requestId: 'req_server_enrich',
    ip: '203.0.113.5',
    user: {
      userId: 'user_fixture',
    },
    get: (name: string) => (name.toLowerCase() === 'user-agent' ? 'FixtureAgent/1.0' : undefined),
  };

  const services: ServiceContainer = {
    get: vi.fn(),
    register: vi.fn(),
    has: vi.fn(),
    dispose: vi.fn(),
  };

  return {
    ...base,
    services,
    ...overrides,
  } as BrowserLogsRequest;
}

describe('enrichLogEntry', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-11-14T22:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test('merges entry data with request context and derived metadata', () => {
    const batch = createSchemaBatch({ logsCount: 1 });
    const originalEntry = batch.logs[0];
    if (!originalEntry) {
      throw new Error('expected batch to include an entry');
    }
    const entry = { ...originalEntry, sessionId: undefined };
    const request = createRequest();

    const result = enrichLogEntry({
      entry,
      batch,
      index: entry.index,
      request,
    });

    expect(result).toMatchObject({
      event: 'browser.log',
      apiRequestId: 'req_server_enrich',
      entryRequestId: entry.requestId,
      sessionId: batch.sessionId,
      userId: 'user_fixture',
      ip: '203.0.113.5',
      userAgent: 'FixtureAgent/1.0',
      ingestedAt: '2025-11-14T22:00:00.000Z',
      level: entry.level,
    });

    expect(result.payload).toMatchObject({
      ...entry,
      sessionId: batch.sessionId,
      index: entry.index,
    });
    expect(entry.index).toBe(0);
  });

  test('prefers entry session overrides and falls back to batch userId', () => {
    const batch = createSchemaBatch({
      sessionId: 'sess_batch',
      userId: 'user_batch_fallback',
      entries: [
        buildBrowserLogEntry({
          requestId: 'req_custom_entry',
          sessionId: 'sess_override',
          level: 'WARN',
        }),
      ],
    });

    const entry = batch.logs[0];
    if (!entry) {
      throw new Error('expected batch to include an entry');
    }
    const request = createRequest({
      user: undefined,
    });

    const result = enrichLogEntry({
      entry,
      batch,
      index: 99,
      request,
    });

    expect(result.sessionId).toBe('sess_override');
    expect(result.userId).toBe('user_batch_fallback');
    expect(result.payload).toMatchObject({
      sessionId: 'sess_override',
      index: entry.index,
    });
  });

  test('truncates verbose user agents to 512 characters', () => {
    const batch = createSchemaBatch({ logsCount: 1 });
    const entry = batch.logs[0];
    if (!entry) {
      throw new Error('expected batch to include an entry');
    }
    const verboseGetter = ((name: string) =>
      name.toLowerCase() === 'user-agent'
        ? 'x'.repeat(600)
        : undefined) as BrowserLogsRequest['get'];
    const request = createRequest({
      get: verboseGetter,
    });

    const result = enrichLogEntry({
      entry,
      batch,
      index: entry.index,
      request,
    });

    expect(result.userAgent).toHaveLength(512);
    expect(result.userAgent?.startsWith('x')).toBe(true);
  });
});

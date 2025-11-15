import { describe, expect, test } from 'vitest';

import {
  buildBrowserLogBatch,
  buildMalformedBrowserLogBatch,
  buildOversizeBrowserLogBatch,
  serializeBatchAsText,
} from './browser-logs.js';

describe('browser log fixtures', () => {
  test('buildBrowserLogBatch creates a valid payload with unique requestIds', () => {
    const payload = buildBrowserLogBatch({ logsCount: 2 });

    expect(payload).toMatchObject({
      source: 'browser',
      sessionId: expect.stringContaining('sess_'),
      logs: expect.any(Array),
    });
    expect(payload.logs).toHaveLength(2);
    const [first, second] = payload.logs as [
      (typeof payload.logs)[number],
      (typeof payload.logs)[number],
    ];
    expect(first.requestId).not.toEqual(second.requestId);
    expect(first).toMatchObject({
      timestamp: expect.stringMatching(/T/),
      level: 'INFO',
      message: expect.stringContaining('fixture'),
    });
  });

  test('buildOversizeBrowserLogBatch injects a >1MB entry payload', () => {
    const payload = buildOversizeBrowserLogBatch();
    expect(payload.logs).toHaveLength(1);

    const firstEntry = payload.logs[0]!;
    const entrySize = Buffer.byteLength(firstEntry.message, 'utf8');
    expect(entrySize).toBeGreaterThan(1024 * 1024);
  });

  test('buildMalformedBrowserLogBatch removes required fields in different scenarios', () => {
    const missingRequestId = buildMalformedBrowserLogBatch({
      scenario: 'missingRequestId',
    }) as { logs?: Array<{ requestId?: unknown }> };
    const missingLogEntry = missingRequestId.logs?.[0];
    expect(missingLogEntry?.requestId).toBeUndefined();

    const invalidSource = buildMalformedBrowserLogBatch({ scenario: 'invalidSource' }) as {
      source?: string;
    };
    expect(invalidSource.source).not.toBe('browser');

    const tooManyEntries = buildMalformedBrowserLogBatch({ scenario: 'tooManyEntries' }) as {
      logs?: unknown[];
    };
    expect(Array.isArray(tooManyEntries.logs) ? tooManyEntries.logs.length : 0).toBeGreaterThan(
      100
    );
  });

  test('serializeBatchAsText preserves JSON payload for sendBeacon flows', () => {
    const payload = buildBrowserLogBatch();
    const serialized = serializeBatchAsText(payload);

    expect(serialized).toEqual(JSON.stringify(payload));
  });
});

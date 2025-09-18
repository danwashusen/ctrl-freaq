import { beforeEach, describe, expect, it, vi } from 'vitest';

import { BrowserLogger } from './logger';

describe('BrowserLogger correlation', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it('reuses provided request correlation id for subsequent logs', () => {
    const logger = new BrowserLogger({
      enableRemoteLogging: true,
      batchSize: 10,
      flushInterval: 60000,
    });

    logger.setCorrelation({ requestId: 'req_from_api', sessionId: 'session-123' });
    logger.info('template.update.start', { templateId: 'architecture' });

    const queue = ((logger as unknown as { logQueue?: unknown[] }).logQueue ?? []) as Array<{
      requestId?: string;
      sessionId?: string;
      context?: Record<string, unknown>;
    }>;
    const firstEntry = queue[0];
    expect(firstEntry).toBeDefined();
    expect(firstEntry?.requestId).toBe('req_from_api');
    expect(firstEntry?.sessionId).toContain('session-123');
  });

  it('merges template context into log entries', () => {
    const logger = new BrowserLogger({
      enableRemoteLogging: true,
      batchSize: 10,
      flushInterval: 60000,
    });

    logger.setTemplateContext({
      templateId: 'architecture',
      templateVersion: '1.1.0',
      templateSchemaHash: 'hash-new',
    });

    logger.info('document.render', { documentId: 'doc-1' });

    const queue = ((logger as unknown as { logQueue?: unknown[] }).logQueue ?? []) as Array<{
      context?: Record<string, unknown>;
    }>;
    const firstEntry = queue[0];
    expect(firstEntry).toBeDefined();
    expect(firstEntry?.context).toMatchObject({
      templateId: 'architecture',
      templateVersion: '1.1.0',
      templateSchemaHash: 'hash-new',
      documentId: 'doc-1',
    });
  });
});

import type { AddressInfo } from 'node:net';

import type { Express } from 'express';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import type { EventEnvelope } from '../../../src/modules/event-stream/event-broker';
import { MOCK_JWT_TOKEN } from '../../../src/middleware/test-auth.js';
import { resetDatabaseForApp } from '../../../src/testing/reset.js';

const AUTH_HEADER = { Authorization: `Bearer ${MOCK_JWT_TOKEN}` };
const WORKSPACE_HEADER = { 'X-Workspace-Id': 'workspace-default' };

const DOCUMENT_ID = 'demo-architecture';
const SECTION_ID = 'sec-overview';

interface QualityGateProgressPayload {
  runId: string;
  documentId: string;
  sectionId?: string | null;
  status: string;
  stage: string;
  percentComplete: number;
}

interface QualityGateSummaryPayload {
  documentId: string;
  statusCounts: Record<string, number>;
  blockerSections: string[];
  warningSections: string[];
  triggeredBy: string;
  requestId: string;
}

interface EventSourceInitWithFetch extends EventSourceInit {
  fetch?: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
}

const waitForStreamOpen = (source: EventSource, timeoutMs: number = 1000): Promise<void> => {
  return new Promise((resolve, reject) => {
    const cleanup = () => {
      clearTimeout(timer);
      source.removeEventListener('stream.open', handleOpen as EventListener);
      source.removeEventListener('error', handleError as EventListener);
    };

    const timer = setTimeout(() => {
      cleanup();
      reject(new Error('Timed out waiting for SSE stream to open'));
    }, timeoutMs);

    const handleOpen = () => {
      cleanup();
      resolve();
    };

    const handleError = (event: unknown) => {
      cleanup();
      if (event instanceof Error) {
        reject(event);
        return;
      }
      reject(new Error('EventSource failed before opening'));
    };

    source.addEventListener('stream.open', handleOpen as EventListener);
    source.addEventListener('error', handleError as EventListener);
  });
};

interface RawMessageEvent {
  data: string;
  lastEventId?: string | null;
}

const waitForEvent = <Payload>(
  source: EventSource,
  eventName: string,
  match: (envelope: EventEnvelope<Payload>, raw: RawMessageEvent) => boolean,
  timeoutMs: number = 1500
): Promise<{ envelope: EventEnvelope<Payload>; raw: RawMessageEvent }> => {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error(`Timed out waiting for ${eventName} event`));
    }, timeoutMs);

    const cleanup = () => {
      clearTimeout(timer);
      source.removeEventListener(eventName, listener as EventListener);
      source.removeEventListener('error', errorListener as EventListener);
    };

    const listener = (event: MessageEvent<string>) => {
      try {
        const raw = { data: event.data, lastEventId: event.lastEventId };
        const envelope = JSON.parse(event.data) as EventEnvelope<Payload>;
        if (match(envelope, raw)) {
          cleanup();
          resolve({ envelope, raw });
          return;
        }
      } catch (error) {
        cleanup();
        reject(error instanceof Error ? error : new Error(String(error)));
      }
    };

    const errorListener = (event: unknown) => {
      cleanup();
      if (event instanceof Error) {
        reject(event);
        return;
      }
      reject(new Error(`EventSource reported an error while waiting for ${eventName}`));
    };

    source.addEventListener(eventName, listener as EventListener);
    source.addEventListener('error', errorListener as EventListener);
  });
};

describe('Quality gate SSE stream (integration)', () => {
  let app: Express;
  let server: import('http').Server;
  let baseUrl: string;

  beforeAll(async () => {
    vi.stubEnv('ENABLE_EVENT_STREAM', 'true');
    vi.stubEnv('EVENT_STREAM_HEARTBEAT_INTERVAL_MS', '1000');
    vi.stubEnv('LOG_LEVEL', 'warn');
    vi.resetModules();

    const { createApp } = await import('../../../src/app.js');
    app = await createApp();
    server = app.listen(0);
    const address = server.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterAll(async () => {
    try {
      if (server) {
        await new Promise<void>((resolve, reject) => {
          server.close(error => {
            if (error) {
              reject(error);
              return;
            }
            resolve();
          });
        });
      }
    } finally {
      vi.unstubAllEnvs();
    }
  });

  beforeEach(async () => {
    await resetDatabaseForApp(app);
  });

  const connectToStream = (options: {
    documentId?: string;
    sectionId?: string;
    lastEventId?: string;
  }) => {
    const params = new URLSearchParams();
    if (options.documentId) {
      params.set('documentId', options.documentId);
    }
    if (options.sectionId) {
      params.set('sectionId', options.sectionId);
    }

    const headers: Record<string, string> = {
      ...AUTH_HEADER,
      ...WORKSPACE_HEADER,
    };

    if (options.lastEventId) {
      headers['Last-Event-ID'] = options.lastEventId;
    }

    const url = `${baseUrl}/api/v1/events?${params.toString()}`;
    const init: EventSourceInitWithFetch = {
      fetch: async (input: RequestInfo | URL, initRequest?: RequestInit) => {
        const headerBag = new Headers(initRequest?.headers ?? {});
        for (const [key, value] of Object.entries(headers)) {
          headerBag.set(key, value);
        }
        return fetch(input, { ...initRequest, headers: headerBag });
      },
    };

    return new EventSource(url, init);
  };

  it('emits progress and summary events for document runs', async () => {
    const stream = connectToStream({ documentId: DOCUMENT_ID });
    await waitForStreamOpen(stream);

    const progressPromise = waitForEvent<QualityGateProgressPayload>(
      stream,
      'quality-gate.progress',
      envelope => envelope.resourceId === DOCUMENT_ID && envelope.payload.status === 'running'
    );
    const summaryPromise = waitForEvent<QualityGateSummaryPayload>(
      stream,
      'quality-gate.summary',
      envelope => envelope.resourceId === DOCUMENT_ID
    );

    await request(app)
      .post(`/api/v1/documents/${DOCUMENT_ID}/quality-gates/run`)
      .set(AUTH_HEADER)
      .set(WORKSPACE_HEADER)
      .send()
      .expect(202);

    const { envelope: progressEnvelope, raw: _progressRaw } = await progressPromise;

    expect(progressEnvelope.topic).toBe('quality-gate.progress');
    expect(progressEnvelope.resourceId).toBe(DOCUMENT_ID);
    expect(progressEnvelope.payload.documentId).toBe(DOCUMENT_ID);
    expect(progressEnvelope.payload.status).toBe('running');
    expect(progressEnvelope.payload.stage).toContain('document');
    expect(progressEnvelope.payload.percentComplete).toBeGreaterThanOrEqual(0);

    const { envelope: summaryEnvelope } = await summaryPromise;

    stream.close();

    expect(summaryEnvelope.topic).toBe('quality-gate.summary');
    expect(summaryEnvelope.payload.documentId).toBe(DOCUMENT_ID);
    expect(summaryEnvelope.payload.requestId).toBeTruthy();
    expect(summaryEnvelope.payload.statusCounts).toBeDefined();
  });

  it('emits section progress events when section validation completes', async () => {
    const stream = connectToStream({ documentId: DOCUMENT_ID, sectionId: SECTION_ID });
    await waitForStreamOpen(stream);

    const progressPromise = waitForEvent<QualityGateProgressPayload>(
      stream,
      'quality-gate.progress',
      envelope =>
        envelope.resourceId === DOCUMENT_ID &&
        envelope.payload.sectionId === SECTION_ID &&
        envelope.payload.status === 'completed'
    );

    await request(app)
      .post(`/api/v1/documents/${DOCUMENT_ID}/sections/${SECTION_ID}/quality-gates/run`)
      .set(AUTH_HEADER)
      .set(WORKSPACE_HEADER)
      .send()
      .expect(202);

    const { envelope } = await progressPromise;

    stream.close();

    expect(envelope.topic).toBe('quality-gate.progress');
    expect(envelope.payload.sectionId).toBe(SECTION_ID);
    expect(envelope.payload.documentId).toBe(DOCUMENT_ID);
    expect(envelope.payload.status).toBe('completed');
    expect(envelope.payload.stage).toContain('section');
    expect(envelope.payload.percentComplete).toBe(100);
  });
});

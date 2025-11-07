import type { AddressInfo } from 'node:net';

import type { Express } from 'express';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type * as BetterSqlite3 from 'better-sqlite3';

import type { EventEnvelope } from '../../../src/modules/event-stream/event-broker';
import type { AppContext } from '../../../src/app';
import { MOCK_JWT_TOKEN } from '../../../src/middleware/test-auth.js';
import { resetDatabaseForApp } from '../../../src/testing/reset.js';
import { seedSectionEditorFixtures } from '../../../src/testing/fixtures/section-editor.js';

const AUTH_HEADER = { Authorization: `Bearer ${MOCK_JWT_TOKEN}` };
const WORKSPACE_HEADER = { 'X-Workspace-Id': 'workspace-default' };

const DOCUMENT_ID = 'doc-collaboration-demo';
const SECTION_ID = 'sec-collaboration-overview';
const DRAFT_ID = 'draft-collaboration-overview';
const USER_ID = 'user-section-author';

interface SectionConflictPayload {
  sectionId: string;
  documentId: string;
  conflictState: string;
  conflictReason: string | null;
  latestApprovedVersion?: number;
  detectedAt?: string;
  detectedBy?: string | null;
  events?: Array<{
    detectedAt: string;
    detectedDuring?: string;
    previousApprovedVersion?: number;
    latestApprovedVersion?: number;
    resolvedBy?: string | null;
    resolutionNote?: string | null;
  }>;
}

interface SectionDiffPayload {
  sectionId: string;
  documentId: string;
  diff: unknown;
  draftVersion?: number | null;
  draftBaseVersion?: number | null;
  approvedVersion?: number | null;
  generatedAt?: string;
}

interface EventSourceInitWithFetch extends EventSourceInit {
  fetch?: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
}

interface RawMessageEvent {
  data: string;
  lastEventId?: string | null;
}

const waitForStreamOpen = (source: EventSource, timeoutMs: number = 1_000): Promise<void> => {
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

const waitForEvent = <Payload>(
  source: EventSource,
  eventName: string,
  match: (envelope: EventEnvelope<Payload>, raw: RawMessageEvent) => boolean,
  timeoutMs: number = 5_000
): Promise<{ envelope: EventEnvelope<Payload>; raw: RawMessageEvent }> => {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error(`Timed out waiting for ${eventName} event`));
    }, timeoutMs);

    const cleanup = () => {
      clearTimeout(timer);
      source.removeEventListener(eventName, listener as EventListener);
      source.removeEventListener('message', generalListener as EventListener);
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
        console.log(
          'Received event but did not match',
          eventName,
          envelope.topic,
          envelope.resourceId
        );
      } catch (error) {
        cleanup();
        reject(error instanceof Error ? error : new Error(String(error)));
      }
    };

    const generalListener = (event: MessageEvent<string>) => {
      try {
        const raw = { data: event.data, lastEventId: event.lastEventId };
        const envelope = JSON.parse(event.data) as EventEnvelope<Payload>;
        if (match(envelope, raw)) {
          cleanup();
          resolve({ envelope, raw });
          return;
        }
      } catch {
        // ignore parse errors for generic listener
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
    source.addEventListener('message', generalListener as EventListener);
    source.addEventListener('error', errorListener as EventListener);
  });
};

describe('Section draft SSE stream (integration)', () => {
  let app: Express;
  let server: import('http').Server;
  let baseUrl: string;
  let db: BetterSqlite3.Database;

  beforeAll(async () => {
    vi.stubEnv('ENABLE_EVENT_STREAM', 'true');
    vi.stubEnv('EVENT_STREAM_HEARTBEAT_INTERVAL_MS', '1000');
    vi.stubEnv('LOG_LEVEL', 'warn');
    vi.resetModules();

    const { createApp } = await import('../../../src/app.js');
    app = await createApp();
    const context = app.locals.appContext as AppContext;
    db = context.database;

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
    seedSectionEditorFixtures(db, {
      sectionId: SECTION_ID,
      documentId: DOCUMENT_ID,
      userId: USER_ID,
      draftId: DRAFT_ID,
      approvedVersion: 6,
      draftVersion: 6,
      draftBaseVersion: 4,
    });
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

  it('streams conflict and diff events with replay support', async () => {
    const stream = connectToStream({ documentId: DOCUMENT_ID, sectionId: SECTION_ID });
    await waitForStreamOpen(stream);

    try {
      const conflictPromise = waitForEvent<SectionConflictPayload>(
        stream,
        'section.conflict',
        envelope =>
          envelope.resourceId === SECTION_ID &&
          envelope.payload.sectionId === SECTION_ID &&
          envelope.payload.conflictState === 'rebase_required'
      );

      await request(app)
        .post(`/api/v1/sections/${SECTION_ID}/conflicts/check`)
        .set(AUTH_HEADER)
        .set(WORKSPACE_HEADER)
        .send({
          draftId: DRAFT_ID,
          documentId: DOCUMENT_ID,
          draftBaseVersion: 4,
          draftVersion: 6,
          approvedVersion: 6,
          triggeredBy: 'entry',
        })
        .expect(409);

      const { envelope: conflictEnvelope, raw: _conflictRaw } = await conflictPromise;

      expect(conflictEnvelope.topic).toBe('section.conflict');
      expect(conflictEnvelope.payload.sectionId).toBe(SECTION_ID);
      expect(conflictEnvelope.payload.conflictReason).toBeTruthy();
      expect(conflictEnvelope.sequence).toBeGreaterThan(0);

      await request(app)
        .post(`/api/v1/sections/${SECTION_ID}/drafts`)
        .set(AUTH_HEADER)
        .set(WORKSPACE_HEADER)
        .send({
          draftId: DRAFT_ID,
          documentId: DOCUMENT_ID,
          draftVersion: 7,
          draftBaseVersion: 6,
          contentMarkdown: '## Updated architecture overview',
          summaryNote: 'Autosave update',
        })
        .expect(202);

      const replayStream = connectToStream({
        documentId: DOCUMENT_ID,
        sectionId: SECTION_ID,
        lastEventId: `section.diff:${SECTION_ID}:0`,
      });
      await waitForStreamOpen(replayStream);

      try {
        const replayedDiff = await waitForEvent<SectionDiffPayload>(
          replayStream,
          'section.diff',
          envelope =>
            envelope.resourceId === SECTION_ID && envelope.payload.sectionId === SECTION_ID,
          10_000
        );

        expect(replayedDiff.envelope.payload.sectionId).toBe(SECTION_ID);
        expect(replayedDiff.envelope.payload.diff).toBeTruthy();
        expect(replayedDiff.raw.lastEventId || replayedDiff.envelope.id).toBeTruthy();
        expect(replayedDiff.envelope.payload.draftVersion ?? 0).toBeGreaterThan(0);
      } finally {
        replayStream.close();
      }
    } finally {
      stream.close();
    }
  });
});

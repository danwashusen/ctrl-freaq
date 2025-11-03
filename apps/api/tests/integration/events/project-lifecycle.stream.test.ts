import type { AddressInfo } from 'node:net';

import type { Express } from 'express';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import type { EventEnvelope } from '../../../src/modules/event-stream/event-broker';
import { resetDatabaseForApp } from '../../../src/testing/reset';

const AUTH_HEADER = { Authorization: 'Bearer mock-jwt-token' };
const WORKSPACE_HEADER = { 'X-Workspace-Id': 'workspace-default' };

interface EventSourceInitWithFetch extends EventSourceInit {
  fetch?: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
}

const waitForStreamOpen = (source: EventSource, timeoutMs: number = 1000): Promise<void> => {
  return new Promise((resolve, reject) => {
    const cleanup = () => {
      clearTimeout(timeout);
      source.removeEventListener('stream.open', onOpen as any);
      source.removeEventListener('error', onError as any);
    };

    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error('Timed out waiting for SSE stream to open'));
    }, timeoutMs);

    const onOpen = () => {
      cleanup();
      resolve();
    };

    const onError = (event: unknown) => {
      cleanup();
      if (event instanceof Error) {
        reject(event);
        return;
      }
      reject(new Error('EventSource failed before opening'));
    };

    source.addEventListener('stream.open', onOpen as any);
    source.addEventListener('error', onError as any);
  });
};

interface LifecycleMessageEvent {
  data: string;
  lastEventId?: string | null;
}

const waitForStreamEvents = <T>(
  source: EventSource,
  {
    timeoutMs,
    resolveOnEvent,
  }: {
    timeoutMs: number;
    resolveOnEvent: (event: LifecycleMessageEvent) => T | null;
  }
): Promise<T> => {
  return new Promise<T>((resolve, reject) => {
    const timeout = setTimeout(() => {
      source.close();
      reject(new Error('Timed out waiting for SSE events'));
    }, timeoutMs);

    source.addEventListener('error', (event: unknown) => {
      clearTimeout(timeout);
      source.close();

      if (event instanceof Error) {
        reject(event);
        return;
      }

      reject(new Error('EventSource reported an error'));
    });

    source.addEventListener('project.lifecycle', (event: unknown) => {
      try {
        const message = event as LifecycleMessageEvent;
        const result = resolveOnEvent(message);
        if (result) {
          clearTimeout(timeout);
          source.close();
          resolve(result);
        }
      } catch (error) {
        clearTimeout(timeout);
        source.close();
        reject(error instanceof Error ? error : new Error(String(error)));
      }
    });
  });
};

describe('Project lifecycle SSE stream (integration)', () => {
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

  beforeEach(() => {
    resetDatabaseForApp(app);
  });

  const createProject = async () => {
    const response = await request(app)
      .post('/api/v1/projects')
      .set(AUTH_HEADER)
      .set(WORKSPACE_HEADER)
      .send({ name: 'Realtime Lifecycle Project' })
      .expect(201);

    return response.body.id as string;
  };

  const connectToStream = (projectId: string, lastEventId?: string) => {
    const headers: Record<string, string> = {
      ...AUTH_HEADER,
      ...WORKSPACE_HEADER,
    };

    if (lastEventId) {
      headers['Last-Event-ID'] = lastEventId;
    }

    const url = `${baseUrl}/api/v1/events?projectId=${encodeURIComponent(projectId)}`;
    const options: EventSourceInitWithFetch = {
      fetch: async (input: RequestInfo | URL, init?: RequestInit) => {
        const requestHeaders = new Headers(init?.headers ?? {});
        for (const [key, value] of Object.entries(headers)) {
          requestHeaders.set(key, value);
        }
        return fetch(input, { ...init, headers: requestHeaders });
      },
    };

    return new EventSource(url, options);
  };

  it('streams archive/restore events and replays missed payloads after reconnect', async () => {
    const projectId = await createProject();
    const initialStream = connectToStream(projectId);
    await waitForStreamOpen(initialStream);

    const archivePromise = waitForStreamEvents(initialStream, {
      timeoutMs: 2000,
      resolveOnEvent: event => {
        const data = JSON.parse(event.data) as EventEnvelope<{
          projectId: string;
          status: string;
          previousStatus?: string | null;
        }>;

        if (data.payload.status !== 'archived') {
          return null;
        }

        return {
          envelope: data,
          rawEvent: event,
        };
      },
    });

    await request(app)
      .delete(`/api/v1/projects/${projectId}`)
      .set(AUTH_HEADER)
      .set(WORKSPACE_HEADER)
      .expect(204);

    const { envelope: archiveEnvelope, rawEvent: archiveEvent } = await archivePromise;

    expect(archiveEnvelope.topic).toBe('project.lifecycle');
    expect(archiveEnvelope.resourceId).toBe(projectId);
    expect(archiveEnvelope.payload.status).toBe('archived');
    expect(archiveEnvelope.payload.previousStatus).toBe('draft');

    const restoreStream = connectToStream(projectId);
    await waitForStreamOpen(restoreStream);

    const restorePromise = waitForStreamEvents(restoreStream, {
      timeoutMs: 2000,
      resolveOnEvent: event => {
        const data = JSON.parse(event.data) as EventEnvelope<{
          projectId: string;
          status: string;
          previousStatus?: string | null;
        }>;

        if (data.payload.status !== 'draft') {
          return null;
        }

        return data;
      },
    });

    await request(app)
      .post(`/api/v1/projects/${projectId}/restore`)
      .set(AUTH_HEADER)
      .set(WORKSPACE_HEADER)
      .expect(200);

    const restoreEnvelope = await restorePromise;

    expect(restoreEnvelope.topic).toBe('project.lifecycle');
    expect(restoreEnvelope.resourceId).toBe(projectId);
    expect(restoreEnvelope.payload.status).toBe('draft');
    expect(restoreEnvelope.payload.previousStatus).toBe('archived');

    const archiveEventId = archiveEnvelope.id ?? archiveEvent.lastEventId ?? undefined;
    expect(archiveEventId).toBeDefined();

    const replayStream = connectToStream(projectId, archiveEventId);

    const replayedEnvelope = await waitForStreamEvents(replayStream, {
      timeoutMs: 2000,
      resolveOnEvent: event => {
        const data = JSON.parse(event.data) as EventEnvelope<{
          projectId: string;
          status: string;
        }>;

        return data.sequence > archiveEnvelope.sequence ? data : null;
      },
    });

    expect(replayedEnvelope.payload.projectId).toBe(projectId);
    expect(replayedEnvelope.payload.status).toBe('draft');
    expect(replayedEnvelope.sequence).toBeGreaterThan(archiveEnvelope.sequence);
  });
});

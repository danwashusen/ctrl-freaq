import { EventEmitter } from 'node:events';
import type { IncomingMessage, ServerResponse } from 'node:http';

import { describe, expect, it } from 'vitest';

import { createFixtureRequestHandler } from './index';

function createRequest(url: string, method: 'GET' | 'POST' = 'GET'): IncomingMessage {
  const emitter = new EventEmitter();
  return Object.assign(emitter, {
    url,
    method,
    headers: {},
    on: emitter.on.bind(emitter),
  }) as unknown as IncomingMessage;
}

type FixtureResponse = {
  statusCode?: number;
  headers: Record<string, string>;
  body: unknown;
};

function createResponse(): [ServerResponse, Promise<FixtureResponse>] {
  const emitter = new EventEmitter();
  const response: FixtureResponse = { headers: {}, body: undefined };

  const promise = new Promise<FixtureResponse>(resolve => {
    Object.assign(emitter, {
      setHeader(name: string, value: string) {
        response.headers[name] = value;
      },
      end(payload?: unknown) {
        response.body = payload ? JSON.parse(String(payload)) : undefined;
        response.statusCode = (emitter as { statusCode?: number }).statusCode;
        resolve(response);
      },
      on: emitter.on.bind(emitter),
      once: emitter.once.bind(emitter),
      emit: emitter.emit.bind(emitter),
      statusCode: 200,
    });
  });

  return [emitter as unknown as ServerResponse, promise];
}

describe('project document fixture handler', () => {
  it('responds with deterministic primary document snapshot payload', async () => {
    const handler = createFixtureRequestHandler();
    const req = createRequest('/api/v1/projects/proj-architecture-demo/documents/primary', 'GET');
    const [res, resolved] = createResponse();

    await handler(req, res, () => {
      throw new Error('next should not be called for known primary document fixture');
    });

    const result = await resolved;

    expect(result.body).toMatchObject({
      projectId: 'proj-architecture-demo',
      status: 'ready',
      document: expect.objectContaining({
        documentId: 'demo-architecture',
        firstSectionId: expect.any(String),
        lifecycleStatus: expect.stringMatching(/draft|review|published/),
      }),
      templateDecision: null,
      lastUpdatedAt: expect.any(String),
    });
  });
});

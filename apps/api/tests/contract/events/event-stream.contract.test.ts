import { randomUUID } from 'node:crypto';
import type { AddressInfo } from 'node:net';
import type { Database } from 'better-sqlite3';

import type { Express } from 'express';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import type { EventBroker } from '../../../src/modules/event-stream/event-broker.js';
import { ProjectRepositoryImpl, DocumentRepositoryImpl } from '@ctrl-freaq/shared-data';
import type { AppContext } from '../../../src/app.js';
import { seedUserFixture } from '../../../src/testing/fixtures/section-editor';

const AUTH_HEADER = { Authorization: 'Bearer mock-jwt-token' };
const WORKSPACE_HEADER = { 'X-Workspace-Id': 'workspace-default' };

interface EventSourceInitWithFetch extends EventSourceInit {
  fetch?: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
}

describe('GET /api/v1/events', () => {
  let app: Express;
  let server: import('http').Server;
  let baseUrl: string;
  let db: Database;
  let previousEnableFlag: string | undefined;
  let previousHeartbeatInterval: string | undefined;

  beforeAll(async () => {
    previousEnableFlag = process.env.ENABLE_EVENT_STREAM;
    previousHeartbeatInterval = process.env.EVENT_STREAM_HEARTBEAT_INTERVAL_MS;
    process.env.ENABLE_EVENT_STREAM = 'true';
    process.env.EVENT_STREAM_HEARTBEAT_INTERVAL_MS = '1000';
    vi.resetModules();

    const { createApp } = await import('../../../src/app.js');
    app = await createApp();
    const appContext = app.locals.appContext as AppContext;
    db = appContext.database;
    server = app.listen(0);
    const address = server.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterAll(async () => {
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
    process.env.ENABLE_EVENT_STREAM = previousEnableFlag;
    process.env.EVENT_STREAM_HEARTBEAT_INTERVAL_MS = previousHeartbeatInterval;
  });

  it('requires authentication', async () => {
    await request(app).get('/api/v1/events').expect(401);
  });

  it('rejects unauthorized project scopes', async () => {
    const projectRepository = new ProjectRepositoryImpl(db);
    const forbiddenOwnerId = 'user_forbidden_project';
    seedUserFixture(db, forbiddenOwnerId);
    const forbiddenProject = await projectRepository.create({
      ownerUserId: forbiddenOwnerId,
      name: 'Forbidden Project',
      slug: `unauth-${randomUUID().slice(0, 8)}`,
      description: null,
      visibility: 'workspace',
      status: 'active',
      goalTargetDate: null,
      goalSummary: null,
      createdBy: 'system',
      updatedBy: 'system',
    });

    const response = await request(app)
      .get(`/api/v1/events?projectId=${forbiddenProject.id}`)
      .set(AUTH_HEADER)
      .set(WORKSPACE_HEADER)
      .expect(403);

    expect(response.body).toMatchObject({
      code: 'SCOPE_FORBIDDEN',
    });
  });

  it('rejects unauthorized document scopes', async () => {
    const projectRepository = new ProjectRepositoryImpl(db);
    const documentRepository = new DocumentRepositoryImpl(db);

    const forbiddenOwnerId = 'user_forbidden_document';
    seedUserFixture(db, forbiddenOwnerId);

    const forbiddenProject = await projectRepository.create({
      ownerUserId: forbiddenOwnerId,
      name: 'Forbidden Document Project',
      slug: `unauth-doc-${randomUUID().slice(0, 8)}`,
      description: null,
      visibility: 'workspace',
      status: 'active',
      goalTargetDate: null,
      goalSummary: null,
      createdBy: 'system',
      updatedBy: 'system',
    });

    const forbiddenDocumentId = `doc-${randomUUID().slice(0, 8)}`;
    await documentRepository.create({
      id: forbiddenDocumentId,
      projectId: forbiddenProject.id,
      title: 'Forbidden Document',
      content: {},
      templateId: 'template-forbidden',
      templateVersion: '1.0.0',
      templateSchemaHash: 'hash-forbidden',
      createdBy: 'system',
      updatedBy: 'system',
    });

    const response = await request(app)
      .get(`/api/v1/events?documentId=${forbiddenDocumentId}`)
      .set(AUTH_HEADER)
      .set(WORKSPACE_HEADER)
      .expect(403);

    expect(response.body).toMatchObject({
      code: 'SCOPE_FORBIDDEN',
    });
  });

  it('streams workspace events and emits heartbeats when no payloads are published', async () => {
    const broker = (app.locals as { eventBroker: EventBroker | undefined }).eventBroker;
    expect(broker).toBeDefined();

    const url = `${baseUrl}/api/v1/events`;
    const receivedTopics: string[] = [];
    let heartbeatCount = 0;

    await new Promise<void>((resolve, reject) => {
      const options: EventSourceInitWithFetch = {
        fetch: async (input: RequestInfo | URL, init?: RequestInit) => {
          const headers = new Headers(init?.headers ?? {});
          headers.set('Authorization', AUTH_HEADER.Authorization);
          headers.set('X-Workspace-Id', WORKSPACE_HEADER['X-Workspace-Id']);
          return fetch(input, { ...init, headers });
        },
      };

      const source = new EventSource(url, options);

      const timeout = setTimeout(() => {
        source.close();
        reject(new Error('Timed out waiting for stream events'));
      }, 1_500);

      source.addEventListener('project.lifecycle', event => {
        receivedTopics.push(event.type);
        try {
          const parsed = JSON.parse(event.data);
          expect(parsed.topic).toBe('project.lifecycle');
          expect(parsed.resourceId).toBe('proj-123');
          expect(parsed.sequence).toBeGreaterThan(0);
          expect(parsed.kind).toBe('event');
          expect(parsed.payload).toEqual({ status: 'archived' });
        } catch (error) {
          clearTimeout(timeout);
          source.close();
          reject(error instanceof Error ? error : new Error(String(error)));
          return;
        }

        if (receivedTopics.length >= 1 && heartbeatCount >= 1) {
          clearTimeout(timeout);
          source.close();
          resolve();
        }
      });

      source.addEventListener('heartbeat', () => {
        heartbeatCount += 1;
        if (receivedTopics.length >= 1 && heartbeatCount >= 1) {
          clearTimeout(timeout);
          source.close();
          resolve();
        }
      });

      source.onerror = event => {
        clearTimeout(timeout);
        source.close();
        reject(event instanceof Error ? event : new Error('EventSource reported an error'));
      };

      setTimeout(() => {
        broker?.publish({
          workspaceId: 'workspace-default',
          topic: 'project.lifecycle',
          resourceId: 'proj-123',
          payload: { status: 'archived' },
        });
      }, 25);
    });

    expect(receivedTopics).toContain('project.lifecycle');
    expect(heartbeatCount).toBeGreaterThanOrEqual(1);
  });
});

import type { Express } from 'express';
import request from 'supertest';
import { afterEach, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest';
import type { Logger } from 'pino';

import { resetDatabaseForApp } from '../../src/testing/reset';

interface LoggedEntry {
  level: 'info' | 'warn' | 'error';
  payload: Record<string, unknown>;
  message?: string;
}

describe('Project lifecycle logging', () => {
  let app: Express;
  const mockJwtToken = 'mock-jwt-token';
  let loggedEntries: LoggedEntry[];

  beforeAll(async () => {
    const { createApp } = await import('../../src/app');
    app = await createApp();
  });

  beforeEach(() => {
    resetDatabaseForApp(app);
    loggedEntries = [];
    const appContext = app.locals.appContext as { logger: Logger };
    const baseLogger = appContext.logger;

    const childLogger = {
      info: vi.fn((payload: Record<string, unknown>, message?: string) => {
        loggedEntries.push({ level: 'info', payload, message });
      }),
      warn: vi.fn((payload: Record<string, unknown>, message?: string) => {
        loggedEntries.push({ level: 'warn', payload, message });
      }),
      error: vi.fn((payload: Record<string, unknown>, message?: string) => {
        loggedEntries.push({ level: 'error', payload, message });
      }),
      debug: vi.fn(),
    } as unknown as ReturnType<typeof baseLogger.child>;

    vi.spyOn(baseLogger, 'child').mockReturnValue(childLogger);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const getLog = (message: string): LoggedEntry | undefined =>
    loggedEntries.find(entry => entry.message === message);

  const expectDuration = (entry: LoggedEntry | undefined) => {
    expect(entry).toBeDefined();
    expect(typeof entry?.payload.durationMs).toBe('number');
    expect(entry?.payload.durationMs).toBeGreaterThanOrEqual(0);
  };

  test('emits structured lifecycle logs with request tracing metadata', async () => {
    const createResponse = await request(app)
      .post('/api/v1/projects')
      .set('Authorization', `Bearer ${mockJwtToken}`)
      .send({ name: 'Logging Coverage Project' });

    expect(createResponse.status).toBe(201);

    const projectId = createResponse.body.id as string;

    await request(app)
      .delete(`/api/v1/projects/${projectId}`)
      .set('Authorization', `Bearer ${mockJwtToken}`)
      .expect(204);

    await request(app)
      .post(`/api/v1/projects/${projectId}/restore`)
      .set('Authorization', `Bearer ${mockJwtToken}`)
      .expect(200);

    const createLog = getLog('Project created');
    expect(createLog?.payload).toMatchObject({
      action: 'create_project',
      projectId,
      projectName: 'Logging Coverage Project',
      userId: expect.any(String),
      requestId: expect.any(String),
    });
    expectDuration(createLog);

    const archiveLog = getLog('Project archived');
    expect(archiveLog?.payload).toMatchObject({
      action: 'archive_project',
      projectId,
      archivedStatusBefore: 'draft',
      userId: expect.any(String),
      requestId: expect.any(String),
    });
    expectDuration(archiveLog);

    const restoreLog = getLog('Project restored');
    expect(restoreLog?.payload).toMatchObject({
      action: 'restore_project',
      projectId,
      restoredStatus: 'draft',
      userId: expect.any(String),
      requestId: expect.any(String),
    });
    expectDuration(restoreLog);
  });
});

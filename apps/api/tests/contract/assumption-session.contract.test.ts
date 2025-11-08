import type { Express } from 'express';
import request from 'supertest';
import { beforeAll, beforeEach, describe, expect, test } from 'vitest';
import type * as BetterSqlite3 from 'better-sqlite3';

import { createApp, type AppContext } from '../../src/app';
import { seedAssumptionSessionFixtures } from '../../src/testing/fixtures/assumption-session';

const AuthorizationHeader = { Authorization: 'Bearer mock-jwt-token' };

describe('Assumption Session API Contract', () => {
  let app: Express;
  let db: BetterSqlite3.Database;
  let sectionId: string;

  beforeAll(async () => {
    app = await createApp();
    const appContext = app.locals.appContext as AppContext;
    db = appContext.database;
  });

  beforeEach(() => {
    const seeded = seedAssumptionSessionFixtures(db);
    sectionId = seeded.sectionId;
  });

  const startSession = async (templateVersion = '1.0.0') => {
    const response = await request(app)
      .post(`/api/v1/sections/${sectionId}/assumptions/session`)
      .set(AuthorizationHeader)
      .send({ templateVersion });

    expect(response.status).toBe(201);
    expect(response.headers['x-request-id']).toBeTruthy();
    return response;
  };

  test('POST /api/v1/sections/:sectionId/assumptions/session creates a session with prioritized prompts', async () => {
    const response = await startSession('1.0.0');
    const { sessionId: createdSessionId, prompts, documentDecisionSnapshotId } = response.body;
    expect(typeof createdSessionId).toBe('string');
    expect(Array.isArray(prompts)).toBe(true);
    expect(prompts.length).toBeGreaterThan(0);
    expect(typeof documentDecisionSnapshotId).toBe('string');
    expect(documentDecisionSnapshotId).toHaveLength(64);

    expect(prompts[0]).toMatchObject({
      heading: 'Confirm security baseline',
      responseType: 'single_select',
    });
    const multiSelectPrompt = prompts.find(
      (prompt: { responseType: string }) => prompt.responseType === 'multi_select'
    );
    expect(multiSelectPrompt?.options).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'ai-service' }),
        expect.objectContaining({ id: 'persistence-layer' }),
      ])
    );

    const firstPromptId = prompts[0]?.id;
    expect(typeof firstPromptId).toBe('string');
  });

  test('POST /api/v1/sections/:sectionId/assumptions/:assumptionId/respond records answers and exposes override count', async () => {
    const response = await startSession('1.0.0');
    const sessionId = response.body.sessionId as string;
    const firstPromptId = response.body.prompts?.[0]?.id as string;
    expect(sessionId).toBeTruthy();
    expect(firstPromptId).toBeTruthy();

    const respond = await request(app)
      .post(`/api/v1/sections/${sectionId}/assumptions/${firstPromptId}/respond`)
      .set(AuthorizationHeader)
      .send({ action: 'answer', answer: 'no-changes' });

    expect(respond.status).toBe(200);
    expect(respond.body).toMatchObject({
      id: firstPromptId,
      status: 'answered',
    });
    expect(typeof respond.body.unresolvedOverrideCount).toBe('number');
    expect(respond.body.unresolvedOverrideCount).toBeGreaterThanOrEqual(0);
  });

  test('POST /api/v1/sections/:sectionId/assumptions/:assumptionId/respond blocks conflicting decisions', async () => {
    const response = await startSession('1.0.0');
    const firstPromptId = response.body.prompts?.[0]?.id as string;
    expect(firstPromptId).toBeTruthy();

    const conflict = await request(app)
      .post(`/api/v1/sections/${sectionId}/assumptions/${firstPromptId}/respond`)
      .set(AuthorizationHeader)
      .send({ action: 'answer', answer: 'requires-review' });

    expect(conflict.status).toBe(409);
    expect(conflict.body).toMatchObject({
      code: 'CONFLICT',
      details: expect.objectContaining({
        status: 'decision_conflict',
        decisionId: 'doc-security-baseline',
      }),
    });
  });

  test('POST /api/v1/sections/:sectionId/assumptions/session/:sessionId/proposals creates draft history entries', async () => {
    const response = await startSession('1.0.0');
    const sessionId = response.body.sessionId as string;

    const proposal = await request(app)
      .post(`/api/v1/sections/${sectionId}/assumptions/session/${sessionId}/proposals`)
      .set(AuthorizationHeader)
      .send({ source: 'ai_generate' });

    expect(proposal.status).toBe(201);
    expect(proposal.body).toMatchObject({
      proposalId: expect.any(String),
      proposalIndex: 0,
      overridesOpen: expect.any(Number),
    });
    expect(Array.isArray(proposal.body.rationale)).toBe(true);
  });

  test('GET /api/v1/sections/:sectionId/assumptions/session/:sessionId/proposals returns ordered history', async () => {
    const response = await startSession('1.0.0');
    const sessionId = response.body.sessionId as string;

    await request(app)
      .post(`/api/v1/sections/${sectionId}/assumptions/session/${sessionId}/proposals`)
      .set(AuthorizationHeader)
      .send({ source: 'ai_generate' })
      .expect(201);

    const list = await request(app)
      .get(`/api/v1/sections/${sectionId}/assumptions/session/${sessionId}/proposals`)
      .set(AuthorizationHeader)
      .expect('Content-Type', /json/);

    expect(list.status).toBe(200);
    expect(list.body).toMatchObject({
      sessionId,
    });
    expect(Array.isArray(list.body.proposals)).toBe(true);
    expect(list.body.proposals.length).toBeGreaterThanOrEqual(1);
    expect(list.body.proposals[0]).toHaveProperty('proposalId');
  });
});

import type { Express } from 'express';
import request from 'supertest';
import { beforeAll, describe, expect, test } from 'vitest';
import type * as BetterSqlite3 from 'better-sqlite3';

import { createApp, type AppContext } from '../../src/app';
import { seedAssumptionSessionFixtures } from '../../src/testing/fixtures/assumption-session';

const AuthorizationHeader = { Authorization: 'Bearer mock-jwt-token' };

describe('Assumption Session API Contract', () => {
  let app: Express;
  let db: BetterSqlite3.Database;
  let sectionId: string;
  let sessionId: string;
  let firstPromptId: string;

  beforeAll(async () => {
    app = await createApp();
    const appContext = app.locals.appContext as AppContext;
    db = appContext.database;

    const seeded = seedAssumptionSessionFixtures(db);
    sectionId = seeded.sectionId;
  });

  test('POST /api/v1/sections/:sectionId/assumptions/session creates a session with prioritized prompts', async () => {
    const response = await request(app)
      .post(`/api/v1/sections/${sectionId}/assumptions/session`)
      .set(AuthorizationHeader)
      .send({ templateVersion: '1.0.0' });

    expect(response.status).toBe(201);
    expect(response.headers['x-request-id']).toBeTruthy();

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

    sessionId = createdSessionId;
    firstPromptId = prompts[0]?.id;
    expect(typeof firstPromptId).toBe('string');
  });

  test('POST /api/v1/sections/:sectionId/assumptions/:assumptionId/respond records answers and exposes override count', async () => {
    expect(sessionId).toBeTruthy();
    expect(firstPromptId).toBeTruthy();

    const response = await request(app)
      .post(`/api/v1/sections/${sectionId}/assumptions/${firstPromptId}/respond`)
      .set(AuthorizationHeader)
      .send({ action: 'answer', answer: 'no-changes' });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      id: firstPromptId,
      status: 'answered',
    });
    expect(typeof response.body.unresolvedOverrideCount).toBe('number');
    expect(response.body.unresolvedOverrideCount).toBeGreaterThanOrEqual(0);
  });

  test('POST /api/v1/sections/:sectionId/assumptions/:assumptionId/respond blocks conflicting decisions', async () => {
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
    const response = await request(app)
      .post(`/api/v1/sections/${sectionId}/assumptions/session/${sessionId}/proposals`)
      .set(AuthorizationHeader)
      .send({ source: 'ai_generate' });

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({
      proposalId: expect.any(String),
      proposalIndex: 0,
      overridesOpen: expect.any(Number),
    });
    expect(Array.isArray(response.body.rationale)).toBe(true);
  });

  test('GET /api/v1/sections/:sectionId/assumptions/session/:sessionId/proposals returns ordered history', async () => {
    const response = await request(app)
      .get(`/api/v1/sections/${sectionId}/assumptions/session/${sessionId}/proposals`)
      .set(AuthorizationHeader)
      .expect('Content-Type', /json/);

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      sessionId,
    });
    expect(Array.isArray(response.body.proposals)).toBe(true);
    expect(response.body.proposals.length).toBeGreaterThanOrEqual(1);
    expect(response.body.proposals[0]).toHaveProperty('proposalId');
  });
});

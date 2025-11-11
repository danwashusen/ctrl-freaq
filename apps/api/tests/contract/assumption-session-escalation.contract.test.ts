import type { Express } from 'express';
import request from 'supertest';
import { beforeAll, beforeEach, describe, expect, test } from 'vitest';
import type * as BetterSqlite3 from 'better-sqlite3';

import { createApp, type AppContext } from '../../src/app';
import { seedAssumptionSessionFixtures } from '../../src/testing/fixtures/assumption-session';

const AuthorizationHeader = { Authorization: 'Bearer mock-jwt-token' };

const SECTION_ID = 'sec-new-content-flow';

describe('Assumption Session Escalation Contract', () => {
  let app: Express;
  let db: BetterSqlite3.Database;
  let sessionId: string;
  let promptId: string;

  beforeAll(async () => {
    app = await createApp();
    const appContext = app.locals.appContext as AppContext;
    db = appContext.database;
  });

  beforeEach(async () => {
    seedAssumptionSessionFixtures(db, { sectionId: SECTION_ID });

    const startResponse = await request(app)
      .post(`/api/v1/sections/${SECTION_ID}/assumptions/session`)
      .set(AuthorizationHeader)
      .send({ templateVersion: '1.0.0' });

    expect(startResponse.status).toBe(201);
    sessionId = startResponse.body.sessionId;
    promptId = startResponse.body.prompts[0]?.id;
    expect(promptId).toBeTruthy();
  });

  test('escalating a prompt returns escalation metadata and keeps session blocked', async () => {
    const response = await request(app)
      .post(`/api/v1/sections/${SECTION_ID}/assumptions/${promptId}/respond`)
      .set(AuthorizationHeader)
      .send({
        action: 'escalate',
        notes: 'Need stakeholder confirmation',
      });

    expect(response.status).toBe(202);
    expect(response.body).toMatchObject({
      id: promptId,
      status: 'escalated',
      escalation: {
        assignedTo: expect.any(String),
        status: 'pending',
      },
      unresolvedOverrideCount: expect.any(Number),
    });
    expect(response.body.unresolvedOverrideCount).toBeGreaterThan(0);

    const proposalResponse = await request(app)
      .post(`/api/v1/sections/${SECTION_ID}/assumptions/session/${sessionId}/proposals`)
      .set(AuthorizationHeader)
      .send({ source: 'ai_generate' });

    expect(proposalResponse.status).toBe(409);
    expect(proposalResponse.body).toMatchObject({
      code: 'CONFLICT',
      message: expect.stringContaining('Resolve overrides'),
      details: {
        status: 'overrides_block_submission',
        overridesOpen: expect.any(Number),
      },
    });
  });
});

import type { Express } from 'express';
import type * as BetterSqlite3 from 'better-sqlite3';
import request from 'supertest';
import { beforeAll, describe, expect, test } from 'vitest';

import { createApp, type AppContext } from '../../../src/app';
import { seedSectionFixture } from '../../../src/testing/fixtures/section-editor';
import { MOCK_JWT_TOKEN } from '../../../src/middleware/test-auth';

const AuthorizationHeader = { Authorization: `Bearer ${MOCK_JWT_TOKEN}` };

const DOCUMENT_ID = 'doc-quality-demo';
const SECTION_ID = 'sec-overview';
const RUN_ID = '11111111-2222-3333-4444-555555555555';
const TRIGGERED_BY = 'user-quality-runner';

describe('Quality gate section endpoints', () => {
  let app: Express;
  let db: BetterSqlite3.Database;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    app = await createApp();
    const appContext = app.locals.appContext as AppContext;
    db = appContext.database;
  });

  beforeEach(() => {
    db.prepare(`DELETE FROM section_quality_gate_results WHERE section_id = ?`).run(SECTION_ID);
    db.prepare(`DELETE FROM traceability_links WHERE section_id = ?`).run(SECTION_ID);
    db.prepare(
      `INSERT INTO section_quality_gate_results (
        id,
        section_id,
        document_id,
        run_id,
        status,
        rules,
        last_run_at,
        last_success_at,
        triggered_by,
        source,
        duration_ms,
        remediation_state,
        incident_id,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      RUN_ID,
      SECTION_ID,
      DOCUMENT_ID,
      RUN_ID,
      'Blocker',
      JSON.stringify([
        {
          ruleId: 'qa.overview.telemetry',
          title: 'Ensure telemetry copy references request IDs',
          severity: 'Blocker',
          guidance: ['Add requestId propagation note', 'Link to telemetry quickstart'],
          docLink: 'https://ctrl-freaq.dev/docs/telemetry',
        },
      ]),
      new Date('2025-01-17T16:45:00.000Z').toISOString(),
      null,
      TRIGGERED_BY,
      'manual',
      1485,
      'pending',
      null,
      new Date('2025-01-17T16:45:01.000Z').toISOString(),
      new Date('2025-01-17T16:45:01.000Z').toISOString()
    );
  });

  test('POST /api/v1/documents/:documentId/sections/:sectionId/quality-gates/run returns run acknowledgement payload', async () => {
    seedSectionFixture(db, {
      sectionId: SECTION_ID,
      documentId: DOCUMENT_ID,
      userId: TRIGGERED_BY,
      approvedContent: '## Architecture overview\n\nContent with Request ID reference.',
    });

    const response = await request(app)
      .post(`/api/v1/documents/${DOCUMENT_ID}/sections/${SECTION_ID}/quality-gates/run`)
      .set(AuthorizationHeader)
      .send({ reason: 'manual' });

    expect(response.status).toBe(202);
    expect(response.body).toMatchObject({
      requestId: expect.any(String),
      status: expect.stringMatching(/queued|running/),
      triggeredBy: expect.any(String),
    });
  });

  test('GET /api/v1/documents/:documentId/sections/:sectionId/quality-gates/result returns the latest quality gate result', async () => {
    const response = await request(app)
      .get(`/api/v1/documents/${DOCUMENT_ID}/sections/${SECTION_ID}/quality-gates/result`)
      .set(AuthorizationHeader);

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      sectionId: SECTION_ID,
      documentId: DOCUMENT_ID,
      runId: RUN_ID,
      status: 'Blocker',
      triggeredBy: TRIGGERED_BY,
      rules: [
        expect.objectContaining({
          ruleId: 'qa.overview.telemetry',
          guidance: ['Add requestId propagation note', 'Link to telemetry quickstart'],
        }),
      ],
      durationMs: 1485,
    });
  });

  test('run evaluates section content and persists rule severities', async () => {
    seedSectionFixture(db, {
      sectionId: SECTION_ID,
      documentId: DOCUMENT_ID,
      userId: TRIGGERED_BY,
      approvedContent: 'Content missing headings and telemetry details.',
    });

    await request(app)
      .post(`/api/v1/documents/${DOCUMENT_ID}/sections/${SECTION_ID}/quality-gates/run`)
      .set(AuthorizationHeader)
      .send({ reason: 'manual' });

    const response = await request(app)
      .get(`/api/v1/documents/${DOCUMENT_ID}/sections/${SECTION_ID}/quality-gates/result`)
      .set(AuthorizationHeader);

    expect(response.status).toBe(200);
    expect(response.body.status).toBe('Blocker');
    expect(response.body.rules).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          ruleId: 'qa.section.structure.heading',
          severity: 'Blocker',
        }),
        expect.objectContaining({
          ruleId: 'qa.section.telemetry.request-id',
          severity: 'Warning',
        }),
      ])
    );
  });
});

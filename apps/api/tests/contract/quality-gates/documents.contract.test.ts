import type { Express } from 'express';
import type * as BetterSqlite3 from 'better-sqlite3';
import request from 'supertest';
import { beforeAll, beforeEach, describe, expect, test } from 'vitest';

import { createApp, type AppContext } from '../../../src/app';
import { MOCK_JWT_TOKEN } from '../../../src/middleware/test-auth';

const AuthorizationHeader = { Authorization: `Bearer ${MOCK_JWT_TOKEN}` };

const DOCUMENT_ID = 'demo-architecture';
const REQUEST_ID = 'req-doc-quality-summary';
const TRIGGERED_BY = 'user-dashboard';

describe('Quality gate document endpoints', () => {
  let app: Express;
  let db: BetterSqlite3.Database;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    app = await createApp();
    const appContext = app.locals.appContext as AppContext;
    db = appContext.database;
  });

  beforeEach(() => {
    db.prepare(`DELETE FROM document_quality_gate_summaries WHERE document_id = ?`).run(
      DOCUMENT_ID
    );
  });

  test('POST /api/v1/documents/:documentId/quality-gates/run returns acknowledgement payload', async () => {
    const response = await request(app)
      .post(`/api/v1/documents/${DOCUMENT_ID}/quality-gates/run`)
      .set(AuthorizationHeader)
      .send();

    expect(response.status).toBe(202);
    expect(response.body).toMatchObject({
      documentId: DOCUMENT_ID,
      requestId: expect.any(String),
      status: expect.stringMatching(/queued|running/),
      triggeredBy: expect.any(String),
      queuedAt: expect.any(String),
    });
  });

  test('GET /api/v1/documents/:documentId/quality-gates/summary returns latest summary', async () => {
    // Seed a baseline summary by running the document gates endpoint once (creates neutral summary)
    await request(app)
      .post(`/api/v1/documents/${DOCUMENT_ID}/quality-gates/run`)
      .set(AuthorizationHeader)
      .send();

    const summaryRow = {
      status_counts: JSON.stringify({ pass: 8, warning: 3, blocker: 1, neutral: 2 }),
      blocker_sections: JSON.stringify(['sec-overview']),
      warning_sections: JSON.stringify(['sec-api']),
      last_run_at: '2025-01-17T16:45:00.000Z',
      triggered_by: TRIGGERED_BY,
      request_id: REQUEST_ID,
      publish_blocked: 1,
      coverage_gaps: JSON.stringify([
        {
          requirementId: 'req-coverage-gap',
          reason: 'blocker',
          linkedSections: ['sec-overview'],
        },
      ]),
      updated_at: new Date('2025-01-17T16:45:01.000Z').toISOString(),
    };

    db.prepare(
      `UPDATE document_quality_gate_summaries
       SET status_counts = :status_counts,
           blocker_sections = :blocker_sections,
           warning_sections = :warning_sections,
           last_run_at = :last_run_at,
           triggered_by = :triggered_by,
           request_id = :request_id,
           publish_blocked = :publish_blocked,
           coverage_gaps = :coverage_gaps,
           updated_at = :updated_at
       WHERE document_id = :document_id`
    ).run({
      document_id: DOCUMENT_ID,
      ...summaryRow,
    });

    const response = await request(app)
      .get(`/api/v1/documents/${DOCUMENT_ID}/quality-gates/summary`)
      .set(AuthorizationHeader);

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      documentId: DOCUMENT_ID,
      statusCounts: { pass: 8, warning: 3, blocker: 1, neutral: 2 },
      blockerSections: ['sec-overview'],
      warningSections: ['sec-api'],
      lastRunAt: '2025-01-17T16:45:00.000Z',
      triggeredBy: TRIGGERED_BY,
      requestId: REQUEST_ID,
      publishBlocked: true,
      coverageGaps: [
        {
          requirementId: 'req-coverage-gap',
          reason: 'blocker',
          linkedSections: ['sec-overview'],
        },
      ],
    });
  });

  test('document run aggregates coverage gaps from traceability links', async () => {
    db.prepare(`DELETE FROM section_quality_gate_results WHERE document_id = ?`).run(DOCUMENT_ID);
    db.prepare(`DELETE FROM traceability_links WHERE document_id = ?`).run(DOCUMENT_ID);

    const sectionId = 'sec-overview';
    const now = new Date('2025-01-18T09:30:00.000Z').toISOString();

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
      ) VALUES (
        :id,
        :section_id,
        :document_id,
        :run_id,
        :status,
        :rules,
        :last_run_at,
        :last_success_at,
        :triggered_by,
        :source,
        :duration_ms,
        :remediation_state,
        :incident_id,
        :created_at,
        :updated_at
      )`
    ).run({
      id: 'run-section-coverage-001',
      section_id: sectionId,
      document_id: DOCUMENT_ID,
      run_id: 'run-section-coverage-001',
      status: 'Blocker',
      rules: JSON.stringify([
        {
          ruleId: 'qa.section.structure.heading',
          title: 'Section missing required heading',
          severity: 'Blocker',
          guidance: ['Add a level-two heading describing the section scope.'],
          docLink: 'https://ctrl-freaq.dev/docs/quality-gates#headings',
        },
      ]),
      last_run_at: now,
      last_success_at: null,
      triggered_by: TRIGGERED_BY,
      source: 'manual',
      duration_ms: 1200,
      remediation_state: 'pending',
      incident_id: null,
      created_at: now,
      updated_at: now,
    });

    db.prepare(
      `INSERT INTO traceability_links (
        id,
        requirement_id,
        section_id,
        document_id,
        revision_id,
        gate_status,
        coverage_status,
        last_validated_at,
        validated_by,
        notes,
        audit_trail,
        created_at,
        updated_at
      ) VALUES (
        :id,
        :requirement_id,
        :section_id,
        :document_id,
        :revision_id,
        :gate_status,
        :coverage_status,
        :last_validated_at,
        :validated_by,
        :notes,
        :audit_trail,
        :created_at,
        :updated_at
      )`
    ).run({
      id: 'traceability-gap-001',
      requirement_id: 'req-governance-escalation',
      section_id: sectionId,
      document_id: DOCUMENT_ID,
      revision_id: 'rev-sec-overview-v7',
      gate_status: 'Blocker',
      coverage_status: 'blocker',
      last_validated_at: now,
      validated_by: 'user-quality-runner',
      notes: JSON.stringify(['Pending risk mitigation summary.']),
      audit_trail: JSON.stringify([]),
      created_at: now,
      updated_at: now,
    });

    const runResponse = await request(app)
      .post(`/api/v1/documents/${DOCUMENT_ID}/quality-gates/run`)
      .set(AuthorizationHeader)
      .send({ reason: 'dashboard' });

    expect(runResponse.status).toBe(202);
    expect(runResponse.body).toMatchObject({
      documentId: DOCUMENT_ID,
      requestId: expect.any(String),
    });

    const summaryResponse = await request(app)
      .get(`/api/v1/documents/${DOCUMENT_ID}/quality-gates/summary`)
      .set(AuthorizationHeader);

    expect(summaryResponse.status).toBe(200);
    expect(summaryResponse.body.publishBlocked).toBe(true);
    expect(summaryResponse.body.coverageGaps).toEqual(
      expect.arrayContaining([
        {
          requirementId: 'req-governance-escalation',
          reason: 'blocker',
          linkedSections: [sectionId],
        },
      ])
    );
  });
});

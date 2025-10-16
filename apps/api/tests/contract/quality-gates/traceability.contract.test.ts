import type { Express } from 'express';
import type * as BetterSqlite3 from 'better-sqlite3';
import request from 'supertest';
import { beforeAll, beforeEach, describe, expect, test } from 'vitest';

import { createApp, type AppContext } from '../../../src/app';
import { seedSectionFixture } from '../../../src/testing/fixtures/section-editor';
import { MOCK_JWT_TOKEN } from '../../../src/middleware/test-auth';

const AuthorizationHeader = { Authorization: `Bearer ${MOCK_JWT_TOKEN}` };

const DOCUMENT_ID = 'demo-architecture';
const REQUIREMENT_ID = 'req-governance-escalation';
const SECTION_ID = 'sec-overview';

describe('Traceability endpoints', () => {
  let app: Express;
  let db: BetterSqlite3.Database;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    app = await createApp();
    const appContext = app.locals.appContext as AppContext;
    db = appContext.database;
  });

  beforeEach(() => {
    db.prepare(`DELETE FROM traceability_links WHERE document_id = ?`).run(DOCUMENT_ID);
  });

  test('GET /api/v1/documents/:documentId/traceability returns traceability rows', async () => {
    const lastValidatedAt = '2025-10-13T11:30:00.000Z';

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
      id: '11111111-1111-4111-8111-111111111111',
      requirement_id: REQUIREMENT_ID,
      section_id: SECTION_ID,
      document_id: DOCUMENT_ID,
      revision_id: 'rev-001',
      gate_status: 'Warning',
      coverage_status: 'warning',
      last_validated_at: lastValidatedAt,
      validated_by: 'user-nova',
      notes: JSON.stringify(['Escalation policy missing mitigation summary.']),
      audit_trail: JSON.stringify([
        {
          eventId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
          type: 'link-created',
          timestamp: lastValidatedAt,
          actorId: 'user-nova',
          details: { reason: 'initial-sync' },
        },
      ]),
      created_at: lastValidatedAt,
      updated_at: lastValidatedAt,
    });

    const response = await request(app)
      .get(`/api/v1/documents/${DOCUMENT_ID}/traceability`)
      .set(AuthorizationHeader);

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      documentId: DOCUMENT_ID,
      requirements: [
        {
          requirementId: REQUIREMENT_ID,
          sectionId: SECTION_ID,
          revisionId: 'rev-001',
          gateStatus: 'Warning',
          coverageStatus: 'warning',
          lastValidatedAt,
          validatedBy: 'user-nova',
          notes: ['Escalation policy missing mitigation summary.'],
          auditTrail: [
            {
              type: 'link-created',
              actorId: 'user-nova',
              details: { reason: 'initial-sync' },
            },
          ],
        },
      ],
    });
  });

  test('POST /api/v1/documents/:documentId/traceability/orphans marks requirement as orphaned', async () => {
    const now = new Date('2025-10-14T08:30:00.000Z').toISOString();

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
      id: '22222222-2222-4222-8222-222222222222',
      requirement_id: REQUIREMENT_ID,
      section_id: SECTION_ID,
      document_id: DOCUMENT_ID,
      revision_id: 'rev-001',
      gate_status: 'Pass',
      coverage_status: 'covered',
      last_validated_at: now,
      validated_by: 'user-nova',
      notes: JSON.stringify([]),
      audit_trail: JSON.stringify([]),
      created_at: now,
      updated_at: now,
    });

    const response = await request(app)
      .post(`/api/v1/documents/${DOCUMENT_ID}/traceability/orphans`)
      .set(AuthorizationHeader)
      .send({
        requirementId: REQUIREMENT_ID,
        sectionId: SECTION_ID,
        reason: 'no-link',
      });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      requirementId: REQUIREMENT_ID,
      coverageStatus: 'orphaned',
      reason: 'no-link',
    });

    const row = db
      .prepare(
        `SELECT coverage_status, audit_trail FROM traceability_links WHERE requirement_id = ? AND section_id = ?`
      )
      .get(REQUIREMENT_ID, SECTION_ID) as { coverage_status: string; audit_trail: string };

    expect(row.coverage_status).toBe('orphaned');
    const auditTrail = JSON.parse(row.audit_trail) as Array<{ type: string; details?: unknown }>;
    expect(auditTrail.at(-1)).toMatchObject({
      type: 'link-orphaned',
      details: { reason: 'no-link' },
    });
  });

  test('section quality gate runs persist section revision identifiers in traceability links', async () => {
    seedSectionFixture(db, {
      sectionId: SECTION_ID,
      documentId: DOCUMENT_ID,
      userId: 'user-quality-runner',
      approvedVersion: 7,
      approvedContent: '## Executive overview\n\nRisk posture remains pending final review.',
    });

    const runResponse = await request(app)
      .post(`/api/v1/documents/${DOCUMENT_ID}/sections/${SECTION_ID}/quality-gates/run`)
      .set(AuthorizationHeader)
      .send({ reason: 'manual' });

    expect(runResponse.status).toBe(202);
    const runId = runResponse.body.runId as string | undefined;

    const linkRow = db
      .prepare(
        `SELECT revision_id FROM traceability_links WHERE requirement_id = ? AND section_id = ?`
      )
      .get(REQUIREMENT_ID, SECTION_ID) as { revision_id: string } | undefined;

    expect(linkRow).toBeDefined();
    if (!linkRow) {
      throw new Error('Expected traceability link to be created');
    }

    expect(linkRow.revision_id).toMatch(/^rev-sec-overview/);
    if (runId) {
      expect(linkRow.revision_id).not.toBe(runId);
    }
  });
});

import type { Express } from 'express';
import type * as BetterSqlite3 from 'better-sqlite3';
import request from 'supertest';
import { beforeAll, describe, expect, test } from 'vitest';

import { createApp, type AppContext } from '../../../src/app';
import { seedDraftFixture, seedSectionFixture } from '../../../src/testing/fixtures/section-editor';
import { DEFAULT_TEST_USER_ID, MOCK_JWT_TOKEN } from '../../../src/middleware/test-auth';

const AuthorizationHeader = { Authorization: `Bearer ${MOCK_JWT_TOKEN}` };

const DOCUMENT_ID = 'doc-architecture-demo';
const SECTION_ID = 'architecture-overview';
const AUTHOR_ID = 'user_staff_eng';
const DRAFT_ID = 'draft-coauthor-apply';
const PROJECT_FIXTURE = {
  projectId: '00000000-0000-4000-8000-000000000213',
  projectSlug: 'project-co-authoring-apply',
  projectOwnerId: DEFAULT_TEST_USER_ID,
};

const CANONICAL_DIFF_HASH =
  'sha256:4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945';

describe('Co-authoring apply endpoint contract', () => {
  let app: Express;
  let db: BetterSqlite3.Database;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    app = await createApp();
    const appContext = app.locals.appContext as AppContext;
    db = appContext.database;

    seedSectionFixture(db, {
      sectionId: SECTION_ID,
      documentId: DOCUMENT_ID,
      userId: AUTHOR_ID,
      approvedContent: '# Overview\nApproved content ready for apply testing',
      approvedVersion: 6,
      ...PROJECT_FIXTURE,
    });

    seedDraftFixture(db, {
      draftId: DRAFT_ID,
      sectionId: SECTION_ID,
      documentId: DOCUMENT_ID,
      userId: AUTHOR_ID,
      draftVersion: 7,
      draftBaseVersion: 6,
    });
  });

  test('POST /api/v1/documents/:documentId/sections/:sectionId/co-author/apply queues changelog update without transcript text', async () => {
    const response = await request(app)
      .post(`/api/v1/documents/${DOCUMENT_ID}/sections/${SECTION_ID}/co-author/apply`)
      .set(AuthorizationHeader)
      .send({
        sessionId: 'session-apply-001',
        proposalId: 'proposal-apply-001',
        draftPatch: 'diff --git a/section.md b/section.md\n@@\n-Old copy\n+Improved copy',
        diffHash: CANONICAL_DIFF_HASH,
        approvalNotes: 'Approved for clarity',
      });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      status: 'queued',
      changelog: {
        summary: expect.stringContaining('Approved for clarity'),
        proposalId: 'proposal-apply-001',
        confidence: expect.any(Number),
        citations: expect.any(Array),
      },
      queue: {
        draftVersion: 7,
        diffHash: CANONICAL_DIFF_HASH,
      },
    });
    expect(JSON.stringify(response.body)).not.toContain('transcript');
  });

  test('rejects apply requests when diff hash mismatches proposal snapshot', async () => {
    const response = await request(app)
      .post(`/api/v1/documents/${DOCUMENT_ID}/sections/${SECTION_ID}/co-author/apply`)
      .set(AuthorizationHeader)
      .send({
        sessionId: 'session-apply-002',
        proposalId: 'proposal-apply-002',
        draftPatch: 'diff --git a/section.md b/section.md\n@@\n-Old copy\n+Tampered copy',
        diffHash: 'sha256:tampered',
        approvalNotes: 'Attempted tamper',
      });

    expect(response.status).toBe(409);
    expect(response.body).toMatchObject({
      error: 'DIFF_HASH_MISMATCH',
      message: expect.stringMatching(/diff hash/i),
      requestId: expect.any(String),
      details: {
        expectedDiffHash: expect.stringMatching(/^sha256:/),
        receivedDiffHash: 'sha256:tampered',
        proposalId: 'proposal-apply-002',
      },
    });
  });
});

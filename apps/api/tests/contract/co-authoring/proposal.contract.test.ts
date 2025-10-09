import type { Express } from 'express';
import type * as BetterSqlite3 from 'better-sqlite3';
import request from 'supertest';
import { beforeAll, describe, expect, test } from 'vitest';

import { createApp, type AppContext } from '../../../src/app';
import { seedDraftFixture, seedSectionFixture } from '../../../src/testing/fixtures/section-editor';
import { MOCK_JWT_TOKEN } from '../../../src/middleware/test-auth';

const AuthorizationHeader = { Authorization: `Bearer ${MOCK_JWT_TOKEN}` };

const DOCUMENT_ID = 'doc-architecture-demo';
const SECTION_ID = 'architecture-overview';
const AUTHOR_ID = 'user_staff_eng';
const DRAFT_ID = 'draft-coauthor-proposal';

describe('Co-authoring proposal endpoint contract', () => {
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
      approvedContent: '# Overview\nApproved content ready for proposal testing',
      approvedVersion: 4,
    });

    seedDraftFixture(db, {
      draftId: DRAFT_ID,
      sectionId: SECTION_ID,
      documentId: DOCUMENT_ID,
      userId: AUTHOR_ID,
      draftVersion: 5,
      draftBaseVersion: 4,
    });
  });

  test('POST /api/v1/documents/:documentId/sections/:sectionId/co-author/proposal streams diff preview metadata', async () => {
    const response = await request(app)
      .post(`/api/v1/documents/${DOCUMENT_ID}/sections/${SECTION_ID}/co-author/proposal`)
      .set(AuthorizationHeader)
      .send({
        sessionId: 'session-proposal-001',
        promptId: 'prompt-improve-architecture',
        turnId: 'turn-improve-1',
        intent: 'improve',
        draftVersion: 5,
        baselineVersion: 'rev-4',
        prompt: 'Suggest accessibility improvements for the overview.',
        knowledgeItemIds: ['knowledge:wcag'],
        decisionIds: ['decision:telemetry'],
      });

    expect(response.status).toBe(202);
    expect(response.headers['hx-stream-location']).toMatch(
      /\/api\/v1\/co-authoring\/sessions\/session-proposal-001\/events$/
    );
    expect(response.body).toMatchObject({
      status: 'accepted',
      sessionId: 'session-proposal-001',
      audit: {
        documentId: DOCUMENT_ID,
        sectionId: SECTION_ID,
        intent: 'improve',
        promptId: 'prompt-improve-architecture',
      },
      diffPreview: {
        mode: expect.any(String),
        pendingProposalId: expect.any(String),
      },
    });
  });
});

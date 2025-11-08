import type { Express } from 'express';
import type * as BetterSqlite3 from 'better-sqlite3';
import request from 'supertest';
import { beforeAll, describe, expect, test } from 'vitest';

import { createApp, type AppContext } from '../../../src/app';
import { seedSectionFixture } from '../../../src/testing/fixtures/section-editor';
import { DEFAULT_TEST_USER_ID, MOCK_JWT_TOKEN } from '../../../src/middleware/test-auth';

const AuthorizationHeader = { Authorization: `Bearer ${MOCK_JWT_TOKEN}` };

const DOCUMENT_ID = 'doc-architecture-demo';
const SECTION_ID = 'architecture-overview';
const AUTHOR_ID = 'user_staff_eng';
const PROJECT_FIXTURE = {
  projectId: '00000000-0000-4000-8000-000000000212',
  projectSlug: 'project-co-authoring-analyze',
  projectOwnerId: DEFAULT_TEST_USER_ID,
};

describe('Co-authoring analyze endpoint contract', () => {
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
      approvedContent: '# Overview\nApproved content ready for context',
      ...PROJECT_FIXTURE,
    });
  });

  test('POST /api/v1/documents/:documentId/sections/:sectionId/co-author/analyze streams guidance', async () => {
    const response = await request(app)
      .post(`/api/v1/documents/${DOCUMENT_ID}/sections/${SECTION_ID}/co-author/analyze`)
      .set(AuthorizationHeader)
      .send({
        sessionId: 'session-analyze-001',
        intent: 'explain',
        prompt: 'Summarize the approved architecture decisions.',
        knowledgeItemIds: ['knowledge:wcag'],
        decisionIds: ['decision:telemetry'],
      });

    expect(response.status).toBe(202);
    expect(response.headers['hx-stream-location']).toMatch(
      /\/api\/v1\/co-authoring\/sessions\/session-analyze-001\/events$/
    );
    expect(response.body).toMatchObject({
      status: 'accepted',
      sessionId: 'session-analyze-001',
      audit: {
        documentId: DOCUMENT_ID,
        sectionId: SECTION_ID,
        intent: 'explain',
      },
      contextSummary: {
        completedSectionCount: expect.any(Number),
        knowledgeItemCount: 1,
        decisionCount: 1,
      },
    });
  });
});

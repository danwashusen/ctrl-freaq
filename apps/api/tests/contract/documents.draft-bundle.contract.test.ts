import type { Express } from 'express';
import type * as BetterSqlite3 from 'better-sqlite3';
import request from 'supertest';
import { beforeAll, describe, expect, test } from 'vitest';
import { z } from 'zod';

import { createApp, type AppContext } from '../../src/app';
import { seedSectionFixture, seedDraftFixture } from '../../src/testing/fixtures/section-editor';
import { MOCK_JWT_TOKEN } from '../../src/middleware/test-auth';

const AuthorizationHeader = { Authorization: `Bearer ${MOCK_JWT_TOKEN}` };
const PROJECT_SLUG = 'project-test';
const DOCUMENT_ID = 'doc-architecture-demo';
const SECTION_ALPHA = 'architecture-overview';
const AUTHOR_ID = 'user_2abc123def456';

const DraftBundleResponseSchema = z.object({
  documentId: z.string(),
  appliedSections: z.array(z.string()).nonempty(),
});

const DraftConflictResponseSchema = z.object({
  documentId: z.string(),
  conflicts: z
    .array(
      z.object({
        sectionPath: z.string(),
        message: z.string(),
        serverVersion: z.number().int().nonnegative(),
        serverContent: z.string(),
      })
    )
    .nonempty(),
});

describe('Draft bundle API contract', () => {
  let app: Express;
  let db: BetterSqlite3.Database;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    app = await createApp();
    const appContext = app.locals.appContext as AppContext;
    db = appContext.database;
  });

  test('PATCH /api/v1/projects/:projectSlug/documents/:documentId/draft-bundle applies validated drafts together', async () => {
    seedSectionFixture(db, {
      sectionId: SECTION_ALPHA,
      documentId: DOCUMENT_ID,
      userId: AUTHOR_ID,
      approvedVersion: 7,
    });
    seedDraftFixture(db, {
      draftId: 'draft-alpha',
      sectionId: SECTION_ALPHA,
      documentId: DOCUMENT_ID,
      userId: AUTHOR_ID,
      draftVersion: 8,
      draftBaseVersion: 7,
    });
    const response = await request(app)
      .patch(`/api/v1/projects/${PROJECT_SLUG}/documents/${DOCUMENT_ID}/draft-bundle`)
      .set(AuthorizationHeader)
      .send({
        submittedBy: AUTHOR_ID,
        sections: [
          {
            draftKey: 'project-test/doc-architecture-demo/Architecture Overview/user_2abc123def456',
            sectionPath: SECTION_ALPHA,
            patch: '## Updated architecture overview content',
            baselineVersion: 'rev-7',
            qualityGateReport: { status: 'pass', issues: [] },
          },
        ],
      });

    expect(response.status).toBe(200);
    const payload = DraftBundleResponseSchema.safeParse(response.body);
    expect(payload.success).toBe(true);
    if (payload.success) {
      expect(payload.data.documentId).toBe(DOCUMENT_ID);
      expect(payload.data.appliedSections).toEqual([SECTION_ALPHA]);
    }
  });

  test('rejects bundle when any section fails local validation', async () => {
    seedSectionFixture(db, {
      sectionId: SECTION_ALPHA,
      documentId: DOCUMENT_ID,
      userId: AUTHOR_ID,
      approvedVersion: 7,
    });

    const response = await request(app)
      .patch(`/api/v1/projects/${PROJECT_SLUG}/documents/${DOCUMENT_ID}/draft-bundle`)
      .set(AuthorizationHeader)
      .send({
        submittedBy: AUTHOR_ID,
        sections: [
          {
            draftKey: 'project-test/doc-architecture-demo/Architecture Overview/user_2abc123def456',
            sectionPath: SECTION_ALPHA,
            patch: '## Updated architecture overview content',
            baselineVersion: 'rev-7',
            qualityGateReport: {
              status: 'fail',
              issues: [
                {
                  gateId: 'architecture.lint',
                  severity: 'blocker',
                  message: 'Architecture guidance not satisfied',
                },
              ],
            },
          },
        ],
      });

    expect(response.status).toBe(409);
    const payload = DraftConflictResponseSchema.safeParse(response.body);
    expect(payload.success).toBe(true);
    if (payload.success) {
      expect(payload.data.documentId).toBe(DOCUMENT_ID);
      expect(payload.data.conflicts[0]?.sectionPath).toBe(SECTION_ALPHA);
      expect(payload.data.conflicts[0]?.serverVersion).toBe(7);
      expect(payload.data.conflicts[0]?.serverContent).toContain('Approved architecture overview');
    }
  });

  test('rejects bundle when submittedBy does not match authenticated user', async () => {
    const response = await request(app)
      .patch(`/api/v1/projects/${PROJECT_SLUG}/documents/${DOCUMENT_ID}/draft-bundle`)
      .set(AuthorizationHeader)
      .send({
        submittedBy: 'user_spoofed',
        sections: [
          {
            draftKey: 'project-test/doc-architecture-demo/Architecture Overview/user_spoofed',
            sectionPath: SECTION_ALPHA,
            patch: '## Unauthorized attempt at draft application',
            baselineVersion: 'rev-7',
            qualityGateReport: { status: 'pass', issues: [] },
          },
        ],
      });

    expect(response.status).toBe(403);
    expect(response.body).toMatchObject({ code: 'FORBIDDEN' });
  });
});

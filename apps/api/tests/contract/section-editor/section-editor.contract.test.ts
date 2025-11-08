import type { Express } from 'express';
import request from 'supertest';
import { beforeAll, beforeEach, describe, expect, test } from 'vitest';
import type * as BetterSqlite3 from 'better-sqlite3';

import { createApp, type AppContext } from '../../../src/app';
import {
  ConflictCheckResponseSchema,
  SectionDraftResponseSchema,
  DiffResponseSchema,
  ReviewSubmissionResponseSchema,
  ApprovalResponseSchema,
  ConflictLogResponseSchema,
} from '../../../src/modules/section-editor/validation/section-editor.schema';
import {
  seedConflictHistory,
  seedSectionEditorFixtures,
  seedSectionFixture,
} from '../../../src/testing/fixtures/section-editor';
import { TEMPLATE_MANAGER_USER_ID } from '../../../src/middleware/test-auth.js';

const SECTION_ID = 'sec-architecture-overview';
const DOCUMENT_ID = 'doc-architecture-demo';
const DRAFT_ID = 'draft-architecture-overview';
const USER_ID = 'user-local-author';

const AuthorizationHeader = { Authorization: 'Bearer mock-jwt-token' };
const PROJECT_ID = '00000000-0000-4000-8000-000000000121';
const PROJECT_SLUG = 'project-test';
const PROJECT_NAME = 'Architecture Reference Project';
const PROJECT_FIXTURE = {
  projectId: PROJECT_ID,
  projectSlug: PROJECT_SLUG,
  projectOwnerId: USER_ID,
};

let app: Express;
let db: BetterSqlite3.Database;

beforeAll(async () => {
  app = await createApp();
  const appContext = app.locals.appContext as AppContext;
  db = appContext.database;
});

beforeEach(() => {
  ensureProjectOwnedBy(db, USER_ID);
});

type SectionEditorFixtureOptions = {
  sectionId: string;
  documentId: string;
  userId: string;
  draftId: string;
  approvedVersion: number;
  approvedContent?: string;
  draftVersion: number;
  draftBaseVersion: number;
};

function seedSectionAndDraft(overrides: Partial<SectionEditorFixtureOptions> = {}) {
  const defaults: SectionEditorFixtureOptions = {
    sectionId: SECTION_ID,
    documentId: DOCUMENT_ID,
    userId: USER_ID,
    draftId: DRAFT_ID,
    approvedVersion: 6,
    draftVersion: 6,
    draftBaseVersion: 5,
  };

  const options: SectionEditorFixtureOptions = {
    ...defaults,
    ...overrides,
  };

  seedSectionEditorFixtures(db, {
    ...PROJECT_FIXTURE,
    ...options,
  });
}

function ensureProjectOwnedBy(db: BetterSqlite3.Database, ownerId: string) {
  const nowIso = new Date().toISOString();
  ensureUser(db, ownerId);
  db.prepare(
    `INSERT INTO projects (
       id,
       owner_user_id,
       name,
       slug,
       description,
       visibility,
       status,
       archived_status_before,
       goal_target_date,
       goal_summary,
       created_at,
       created_by,
       updated_at,
       updated_by,
       deleted_at,
       deleted_by
     ) VALUES (
       :id,
       :owner_user_id,
       :name,
       :slug,
       :description,
       'workspace',
       'active',
       NULL,
       NULL,
       NULL,
       :created_at,
       :created_by,
       :updated_at,
       :updated_by,
       NULL,
       NULL
     )
     ON CONFLICT(id) DO UPDATE SET
       owner_user_id = excluded.owner_user_id,
       updated_at = excluded.updated_at,
       updated_by = excluded.updated_by`
  ).run({
    id: PROJECT_ID,
    owner_user_id: ownerId,
    name: PROJECT_NAME,
    slug: PROJECT_SLUG,
    description: 'Seeded project for section editor fixtures',
    created_at: nowIso,
    created_by: ownerId,
    updated_at: nowIso,
    updated_by: ownerId,
  });

  db.prepare('UPDATE documents SET project_id = ? WHERE id = ?').run(PROJECT_ID, DOCUMENT_ID);
}

function ensureUser(db: BetterSqlite3.Database, userId: string) {
  db.prepare(
    `INSERT OR IGNORE INTO users (
       id,
       email,
       first_name,
       last_name,
       created_at,
       created_by,
       updated_at,
       updated_by,
       deleted_at,
       deleted_by
     ) VALUES (?, ?, NULL, NULL, datetime('now'), 'system', datetime('now'), 'system', NULL, NULL)`
  ).run(userId, `${userId}@test.local`);
}

describe('Section Editor API Contract', () => {
  describe('POST /api/v1/sections/:sectionId/conflicts/check', () => {
    test('requires authentication', async () => {
      await request(app)
        .post(`/api/v1/sections/${SECTION_ID}/conflicts/check`)
        .send({})
        .expect(401);
    });

    test('returns 404 when section does not exist', async () => {
      const response = await request(app)
        .post(`/api/v1/sections/missing-section/conflicts/check`)
        .set(AuthorizationHeader)
        .send({
          draftBaseVersion: 1,
          draftVersion: 1,
        });

      expect(response.status).toBe(404);
      expect(response.body).toMatchObject({ code: 'NOT_FOUND' });
    });

    test('reports rebase required when draft base version is stale', async () => {
      seedSectionAndDraft({ draftBaseVersion: 4 });

      const response = await request(app)
        .post(`/api/v1/sections/${SECTION_ID}/conflicts/check`)
        .set(AuthorizationHeader)
        .send({
          draftId: DRAFT_ID,
          documentId: DOCUMENT_ID,
          draftBaseVersion: 4,
          draftVersion: 6,
          approvedVersion: 6,
          triggeredBy: 'entry',
        });

      expect(response.status).toBe(409);
      const payload = ConflictCheckResponseSchema.parse(response.body);
      expect(payload.status).toBe('rebase_required');
      expect(payload.latestApprovedVersion).toBeGreaterThan(4);
    });
  });

  describe('POST /api/v1/sections/:sectionId/drafts', () => {
    test('requires authentication', async () => {
      await request(app).post(`/api/v1/sections/${SECTION_ID}/drafts`).send({}).expect(401);
    });

    test('persists manual draft and echoes formatting annotations', async () => {
      seedSectionFixture(db, {
        sectionId: SECTION_ID,
        documentId: DOCUMENT_ID,
        userId: USER_ID,
        approvedVersion: 5,
        ...PROJECT_FIXTURE,
      });

      const response = await request(app)
        .post(`/api/v1/sections/${SECTION_ID}/drafts`)
        .set(AuthorizationHeader)
        .send({
          draftId: DRAFT_ID,
          documentId: DOCUMENT_ID,
          draftBaseVersion: 5,
          draftVersion: 6,
          summaryNote: 'Manual save before review',
          contentMarkdown: '## Updated scope',
          formattingAnnotations: [
            {
              id: 'ann-01',
              startOffset: 10,
              endOffset: 24,
              markType: 'unsupported-color',
              message: 'Custom colors are not allowed',
              severity: 'warning',
            },
          ],
        });

      expect(response.status).toBe(202);
      const payload = SectionDraftResponseSchema.parse(response.body);
      expect(payload.sectionId).toBe(SECTION_ID);
      expect(response.body.documentId).toBe(DOCUMENT_ID);
      expect(response.body.draftBaseVersion).toBe(5);
      expect(payload.conflictState).toBeDefined();
    });

    test('returns 403 when the caller lacks access to the section project', async () => {
      seedSectionFixture(db, {
        sectionId: SECTION_ID,
        documentId: DOCUMENT_ID,
        userId: USER_ID,
        approvedVersion: 5,
      });
      ensureProjectOwnedBy(db, TEMPLATE_MANAGER_USER_ID);

      const response = await request(app)
        .post(`/api/v1/sections/${SECTION_ID}/drafts`)
        .set(AuthorizationHeader)
        .send({
          draftId: DRAFT_ID,
          documentId: DOCUMENT_ID,
          draftBaseVersion: 5,
          draftVersion: 6,
          contentMarkdown: '## Unauthorized draft payload',
        });

      expect(response.status).toBe(403);
      expect(response.body).toMatchObject({ code: 'FORBIDDEN' });
    });
  });

  describe('GET /api/v1/sections/:sectionId/diff', () => {
    test('requires authentication', async () => {
      await request(app).get(`/api/v1/sections/${SECTION_ID}/diff`).expect(401);
    });

    test('returns structured diff segments comparing draft to approved content', async () => {
      seedSectionAndDraft({
        approvedContent: '## Approved architecture overview',
        draftVersion: 7,
        draftBaseVersion: 6,
      });

      // Ensure draft content diverges from approved content
      db.prepare('UPDATE section_drafts SET content_markdown = ? WHERE id = ?').run(
        '## Updated architecture overview\n\n- Added async queues',
        DRAFT_ID
      );

      const response = await request(app)
        .get(`/api/v1/sections/${SECTION_ID}/diff`)
        .set(AuthorizationHeader)
        .query({ draftId: DRAFT_ID });

      expect(response.status).toBe(200);
      const diff = DiffResponseSchema.parse(response.body);
      expect(diff.mode).toBeDefined();
      expect(diff.segments.length).toBeGreaterThan(0);
      const mergedTypes = new Set(diff.segments.map(segment => segment.type));
      expect(mergedTypes.has('added') || mergedTypes.has('removed')).toBe(true);
    });
  });

  describe('POST /api/v1/sections/:sectionId/submit', () => {
    test('requires authentication', async () => {
      await request(app).post(`/api/v1/sections/${SECTION_ID}/submit`).send({}).expect(401);
    });

    test('creates review submission with summary note', async () => {
      seedSectionAndDraft();

      const response = await request(app)
        .post(`/api/v1/sections/${SECTION_ID}/submit`)
        .set(AuthorizationHeader)
        .send({
          draftId: DRAFT_ID,
          summaryNote: 'Ready for architect review.',
          reviewers: ['user-reviewer-001'],
        });

      expect(response.status).toBe(202);
      const submission = ReviewSubmissionResponseSchema.parse(response.body);
      expect(submission.sectionId).toBe(SECTION_ID);
      expect(submission.summaryNote).toBe('Ready for architect review.');
    });
  });

  describe('POST /api/v1/sections/:sectionId/approve', () => {
    test('requires authentication', async () => {
      await request(app).post(`/api/v1/sections/${SECTION_ID}/approve`).send({}).expect(401);
    });

    test('finalizes section and records approval metadata', async () => {
      seedSectionAndDraft();

      const response = await request(app)
        .post(`/api/v1/sections/${SECTION_ID}/approve`)
        .set(AuthorizationHeader)
        .send({
          draftId: DRAFT_ID,
          approvalNote: 'Reviewed and ready.',
        });

      expect(response.status).toBe(202);
      const approval = ApprovalResponseSchema.parse(response.body);
      expect(approval.sectionId).toBe(SECTION_ID);
      expect(approval.approvedBy).toBeTruthy();
    });
  });

  describe('GET /api/v1/sections/:sectionId/conflicts/logs', () => {
    test('requires authentication', async () => {
      await request(app).get(`/api/v1/sections/${SECTION_ID}/conflicts/logs`).expect(401);
    });

    test('lists conflict log entries for auditing', async () => {
      seedSectionAndDraft({ draftBaseVersion: 4, draftVersion: 6 });
      seedConflictHistory(db, {
        draftId: DRAFT_ID,
        sectionId: SECTION_ID,
        userId: USER_ID,
        previousVersion: 4,
        latestVersion: 6,
      });

      const response = await request(app)
        .get(`/api/v1/sections/${SECTION_ID}/conflicts/logs`)
        .set(AuthorizationHeader)
        .query({ draftId: DRAFT_ID });

      expect(response.status).toBe(200);
      const conflictLog = ConflictLogResponseSchema.parse(response.body);
      expect(conflictLog.sectionId).toBe(SECTION_ID);
      expect(conflictLog.draftId).toBe(DRAFT_ID);
    });
  });

  describe('GET /api/v1/documents/:documentId/sections', () => {
    test('returns sections and table of contents for authorized users', async () => {
      seedSectionFixture(db, {
        sectionId: SECTION_ID,
        documentId: DOCUMENT_ID,
        userId: USER_ID,
        ...PROJECT_FIXTURE,
      });

      const response = await request(app)
        .get(`/api/v1/documents/${DOCUMENT_ID}/sections`)
        .set(AuthorizationHeader);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('sections');
      expect(response.body).toHaveProperty('toc');
      expect(Array.isArray(response.body.sections)).toBe(true);
    });

    test('returns 403 when document belongs to another project', async () => {
      seedSectionFixture(db, {
        sectionId: SECTION_ID,
        documentId: DOCUMENT_ID,
        userId: USER_ID,
        ...PROJECT_FIXTURE,
      });
      ensureProjectOwnedBy(db, TEMPLATE_MANAGER_USER_ID);

      const response = await request(app)
        .get(`/api/v1/documents/${DOCUMENT_ID}/sections`)
        .set(AuthorizationHeader);

      expect(response.status).toBe(403);
      expect(response.body).toMatchObject({ code: 'FORBIDDEN' });
    });
  });
});

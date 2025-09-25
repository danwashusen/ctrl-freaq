import type { Express } from 'express';
import request from 'supertest';
import { beforeAll, describe, expect, test } from 'vitest';
import { z } from 'zod';

import { createApp } from '../../../src/app';

const SECTION_ID = 'sec-architecture-overview';
const DOCUMENT_ID = 'doc-architecture-demo';
const DRAFT_ID = 'draft-architecture-overview';

const ConflictCheckResponseSchema = z.object({
  sectionId: z.string(),
  status: z.enum(['clean', 'rebase_required', 'blocked']),
  latestApprovedVersion: z.number().int().nonnegative(),
  draftVersion: z.number().int().nonnegative().optional(),
  rebasedDraft: z
    .object({
      contentMarkdown: z.string(),
      draftVersion: z.number().int().nonnegative(),
      formattingAnnotations: z
        .array(
          z.object({
            id: z.string(),
            startOffset: z.number().int().nonnegative(),
            endOffset: z.number().int().nonnegative(),
            markType: z.string(),
            message: z.string(),
            severity: z.enum(['warning', 'error']),
          })
        )
        .default([]),
    })
    .optional(),
  events: z
    .array(
      z.object({
        detectedAt: z.string().datetime(),
        detectedDuring: z.enum(['entry', 'save']),
        resolvedBy: z.enum(['auto_rebase', 'manual_reapply', 'abandoned']).nullable(),
        resolutionNote: z.string().nullable().optional(),
      })
    )
    .default([]),
  requestId: z.string(),
});

const SectionDraftResponseSchema = z.object({
  draftId: z.string(),
  sectionId: z.string(),
  documentId: z.string(),
  draftVersion: z.number().int().nonnegative(),
  draftBaseVersion: z.number().int().nonnegative(),
  conflictState: z.enum(['clean', 'rebase_required', 'rebased', 'blocked']),
  summaryNote: z.string(),
  formattingAnnotations: z
    .array(
      z.object({
        id: z.string(),
        startOffset: z.number().int().nonnegative(),
        endOffset: z.number().int().nonnegative(),
        markType: z.string(),
        message: z.string(),
        severity: z.enum(['warning', 'error']),
      })
    )
    .default([]),
  savedAt: z.string().datetime(),
  savedBy: z.string(),
});

const DiffSegmentSchema = z.object({
  type: z.enum(['context', 'addition', 'deletion']),
  content: z.string(),
  lineNumber: z.number().int().nonnegative().optional(),
});

const DiffResponseSchema = z.object({
  sectionId: z.string(),
  draftId: z.string(),
  approvedVersion: z.number().int().nonnegative(),
  draftVersion: z.number().int().nonnegative(),
  generatedAt: z.string().datetime(),
  segments: z.array(DiffSegmentSchema),
});

const ReviewSubmissionResponseSchema = z.object({
  reviewId: z.string(),
  sectionId: z.string(),
  status: z.enum(['pending', 'approved', 'changes_requested']),
  submittedAt: z.string().datetime(),
  submittedBy: z.string(),
  summaryNote: z.string().max(500),
});

const ApprovalResponseSchema = z.object({
  sectionId: z.string(),
  approvedVersion: z.number().int().positive(),
  approvedContent: z.string(),
  approvedAt: z.string().datetime(),
  approvedBy: z.string(),
  requestId: z.string(),
});

const ConflictLogEntrySchema = z.object({
  detectedAt: z.string().datetime(),
  detectedDuring: z.enum(['entry', 'save']),
  previousApprovedVersion: z.number().int().nonnegative(),
  latestApprovedVersion: z.number().int().positive(),
  resolvedBy: z.enum(['auto_rebase', 'manual_reapply', 'abandoned']).nullable(),
  resolutionNote: z.string().nullable(),
});

const ConflictLogResponseSchema = z.object({
  sectionId: z.string(),
  draftId: z.string(),
  events: z.array(ConflictLogEntrySchema),
});

describe('Section Editor API Contract', () => {
  let app: Express;

  beforeAll(async () => {
    app = await createApp();
  });

  describe('POST /api/v1/sections/:sectionId/conflicts/check', () => {
    test('requires authentication', async () => {
      await request(app)
        .post(`/api/v1/sections/${SECTION_ID}/conflicts/check`)
        .send({})
        .expect(401);
    });

    test('returns conflict metadata when draft base version is stale', async () => {
      const response = await request(app)
        .post(`/api/v1/sections/${SECTION_ID}/conflicts/check`)
        .set('Authorization', 'Bearer mock-jwt-token')
        .send({
          draftId: DRAFT_ID,
          draftBaseVersion: 4,
          draftVersion: 5,
          approvedVersion: 6,
        });

      expect(response.status).toBe(409);
      expect(() => ConflictCheckResponseSchema.parse(response.body)).not.toThrow();
      expect(response.body.sectionId).toBe(SECTION_ID);
      expect(response.body.latestApprovedVersion).toBeGreaterThanOrEqual(6);
    });
  });

  describe('POST /api/v1/sections/:sectionId/drafts', () => {
    test('requires authentication', async () => {
      await request(app).post(`/api/v1/sections/${SECTION_ID}/drafts`).send({}).expect(401);
    });

    test('persists manual draft and echoes formatting annotations', async () => {
      const response = await request(app)
        .post(`/api/v1/sections/${SECTION_ID}/drafts`)
        .set('Authorization', 'Bearer mock-jwt-token')
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
      expect(payload.documentId).toBe(DOCUMENT_ID);
      expect(payload.conflictState).toBeDefined();
    });
  });

  describe('GET /api/v1/sections/:sectionId/diff', () => {
    test('requires authentication', async () => {
      await request(app).get(`/api/v1/sections/${SECTION_ID}/diff`).expect(401);
    });

    test('returns structured diff segments comparing draft to approved content', async () => {
      const response = await request(app)
        .get(`/api/v1/sections/${SECTION_ID}/diff`)
        .set('Authorization', 'Bearer mock-jwt-token');

      expect(response.status).toBe(200);
      const diff = DiffResponseSchema.parse(response.body);
      expect(diff.sectionId).toBe(SECTION_ID);
      expect(diff.segments.length).toBeGreaterThan(0);
    });
  });

  describe('POST /api/v1/sections/:sectionId/submit', () => {
    test('requires authentication', async () => {
      await request(app).post(`/api/v1/sections/${SECTION_ID}/submit`).send({}).expect(401);
    });

    test('creates review submission with summary note', async () => {
      const response = await request(app)
        .post(`/api/v1/sections/${SECTION_ID}/submit`)
        .set('Authorization', 'Bearer mock-jwt-token')
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
      const response = await request(app)
        .post(`/api/v1/sections/${SECTION_ID}/approve`)
        .set('Authorization', 'Bearer mock-jwt-token')
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
      const response = await request(app)
        .get(`/api/v1/sections/${SECTION_ID}/conflicts/logs`)
        .set('Authorization', 'Bearer mock-jwt-token')
        .query({ draftId: DRAFT_ID });

      expect(response.status).toBe(200);
      const conflictLog = ConflictLogResponseSchema.parse(response.body);
      expect(conflictLog.sectionId).toBe(SECTION_ID);
      expect(conflictLog.draftId).toBe(DRAFT_ID);
    });
  });
});

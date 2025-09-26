import { describe, expect, it, vi } from 'vitest';
import type { Logger } from 'pino';

import type {
  SectionDraft,
  SectionDraftRepositoryImpl,
  SectionRepositoryImpl,
  SectionReviewRepositoryImpl,
  SectionReviewSummary,
  SectionView,
} from '@ctrl-freaq/shared-data';

import { SectionApprovalService } from './section-approval.service';

const createLogger = () =>
  ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    child: vi.fn().mockReturnThis(),
  }) as unknown as Logger;

const baseSection = {
  id: 'section-1',
  docId: 'document-1',
  approvedVersion: 3,
  approvedContent: '# Approved content',
  approvedAt: new Date('2025-09-20T10:00:00Z'),
  approvedBy: 'approver-1',
  lastSummary: null,
} as unknown as SectionView;

const baseDraft = {
  id: 'draft-1',
  sectionId: baseSection.id,
  contentMarkdown: '# Updated content',
  draftVersion: 5,
  draftBaseVersion: 3,
  summaryNote: 'Refresh introduction',
  conflictState: 'clean',
  conflictReason: null,
  rebasedAt: null,
  savedAt: new Date('2025-09-21T09:00:00Z'),
  savedBy: 'user-1',
  createdAt: new Date('2025-09-21T08:00:00Z'),
  createdBy: 'user-1',
  updatedAt: new Date('2025-09-21T09:00:00Z'),
  updatedBy: 'user-1',
  documentId: baseSection.docId,
  userId: 'user-1',
  formattingAnnotations: [],
} as unknown as SectionDraft;

describe('SectionApprovalService', () => {
  it('finalizes approval and updates related records', async () => {
    const sections = {
      findById: vi.fn().mockResolvedValue(baseSection),
      finalizeApproval: vi.fn().mockResolvedValue({
        ...baseSection,
        approvedVersion: baseDraft.draftVersion,
        approvedContent: baseDraft.contentMarkdown,
      }),
    } as unknown as SectionRepositoryImpl;

    const drafts = {
      findById: vi.fn().mockResolvedValue(baseDraft),
      updateDraft: vi.fn().mockResolvedValue({ ...baseDraft, rebasedAt: new Date() }),
    } as unknown as SectionDraftRepositoryImpl;

    const pendingReview: SectionReviewSummary = {
      id: 'review-1',
      sectionId: baseSection.id,
      draftId: baseDraft.id,
      reviewerId: 'approver-2',
      reviewStatus: 'pending',
      reviewerNote: 'Looks good',
      submittedAt: new Date('2025-09-21T09:05:00Z'),
      decidedAt: null,
      createdAt: new Date('2025-09-21T09:05:00Z'),
      createdBy: 'approver-2',
      updatedAt: new Date('2025-09-21T09:05:00Z'),
      updatedBy: 'approver-2',
      deletedAt: null,
      deletedBy: null,
    };

    const completedReview: SectionReviewSummary = {
      ...pendingReview,
      id: 'review-2',
      reviewStatus: 'approved',
    };

    const reviews = {
      listBySection: vi.fn().mockResolvedValue([pendingReview, completedReview]),
      updateReviewStatus: vi.fn().mockResolvedValue({ ...pendingReview, reviewStatus: 'approved' }),
    } as unknown as SectionReviewRepositoryImpl;

    const logger = createLogger();
    const service = new SectionApprovalService(sections, drafts, reviews, logger);

    const response = await service.approve({
      sectionId: baseSection.id,
      userId: 'approver-2',
      draftId: baseDraft.id,
      approvalNote: 'Ship it',
      requestId: 'req-123',
    });

    expect(sections.finalizeApproval).toHaveBeenCalledWith(
      baseSection,
      expect.objectContaining({
        approvedContent: baseDraft.contentMarkdown,
        approvedVersion: baseDraft.draftVersion,
        approvedBy: 'approver-2',
      })
    );

    expect(drafts.updateDraft).toHaveBeenCalledWith(
      baseDraft.id,
      expect.objectContaining({
        draftBaseVersion: baseDraft.draftVersion,
        conflictState: 'clean',
        rebasedAt: expect.any(Date),
      }),
      expect.objectContaining({
        actorId: 'approver-2',
        savedBy: 'approver-2',
      })
    );

    expect(reviews.updateReviewStatus).toHaveBeenCalledWith(
      pendingReview.id,
      expect.objectContaining({ reviewStatus: 'approved' }),
      'approver-2'
    );

    expect(response).toEqual(
      expect.objectContaining({
        sectionId: baseSection.id,
        approvedVersion: baseDraft.draftVersion,
        approvedBy: 'approver-2',
        approvedContent: baseDraft.contentMarkdown,
      })
    );

    expect(logger.info).toHaveBeenCalledWith(
      expect.objectContaining({
        requestId: 'req-123',
        sectionId: baseSection.id,
        approvedVersion: baseDraft.draftVersion,
      }),
      'Section approval finalized'
    );
  });

  it('throws when section does not exist', async () => {
    const sections = {
      findById: vi.fn().mockResolvedValue(null),
    } as unknown as SectionRepositoryImpl;

    const drafts = {
      findById: vi.fn(),
      updateDraft: vi.fn(),
    } as unknown as SectionDraftRepositoryImpl;

    const reviews = {
      listBySection: vi.fn(),
      updateReviewStatus: vi.fn(),
    } as unknown as SectionReviewRepositoryImpl;

    const service = new SectionApprovalService(sections, drafts, reviews, createLogger());

    await expect(
      service.approve({
        sectionId: 'missing',
        userId: 'approver',
        draftId: baseDraft.id,
      })
    ).rejects.toThrow('Section missing not found');
  });

  it('throws when draft is not found', async () => {
    const sections = {
      findById: vi.fn().mockResolvedValue(baseSection),
    } as unknown as SectionRepositoryImpl;

    const drafts = {
      findById: vi.fn().mockResolvedValue(null),
      updateDraft: vi.fn(),
    } as unknown as SectionDraftRepositoryImpl;

    const reviews = {
      listBySection: vi.fn(),
      updateReviewStatus: vi.fn(),
    } as unknown as SectionReviewRepositoryImpl;

    const service = new SectionApprovalService(sections, drafts, reviews, createLogger());

    await expect(
      service.approve({
        sectionId: baseSection.id,
        userId: 'approver',
        draftId: 'missing-draft',
      })
    ).rejects.toThrow('Draft missing-draft not found');
  });

  it('rejects approving draft tied to different section', async () => {
    const sections = {
      findById: vi.fn().mockResolvedValue(baseSection),
    } as unknown as SectionRepositoryImpl;

    const drafts = {
      findById: vi.fn().mockResolvedValue({ ...baseDraft, sectionId: 'other-section' }),
      updateDraft: vi.fn(),
    } as unknown as SectionDraftRepositoryImpl;

    const reviews = {
      listBySection: vi.fn(),
      updateReviewStatus: vi.fn(),
    } as unknown as SectionReviewRepositoryImpl;

    const service = new SectionApprovalService(sections, drafts, reviews, createLogger());

    await expect(
      service.approve({
        sectionId: baseSection.id,
        userId: 'approver',
        draftId: baseDraft.id,
      })
    ).rejects.toThrow('Draft does not belong to target section');
  });
});

import { describe, expect, it, vi } from 'vitest';
import pino from 'pino';
import type { Logger } from 'pino';

import type {
  SectionDraft,
  SectionDraftRepositoryImpl,
  SectionRepositoryImpl,
  SectionReviewRepositoryImpl,
  SectionReviewSummary,
} from '@ctrl-freaq/shared-data';

import { SectionReviewService } from './section-review.service';

const createLogger = (): Logger => pino({ level: 'silent' });

describe('SectionReviewService', () => {
  it('queues review submission and updates section status', async () => {
    const section = {
      id: '22222222-3333-4444-5555-666666666666',
      docId: '77777777-8888-9999-aaaa-bbbbbbbbbbbb',
      approvedVersion: 2,
      approvedContent: '# Content',
    };

    const draft = {
      id: '11111111-2222-3333-4444-555555555555',
      sectionId: section.id,
      draftVersion: 3,
      contentMarkdown: '# Draft',
    } as unknown as SectionDraft;

    const reviewSummary = {
      id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
      sectionId: section.id,
      documentId: section.docId,
      draftId: draft.id,
      reviewerId: '22222222-3333-4444-5555-777777777777',
      reviewStatus: 'pending',
      reviewerNote: 'Summary note',
      submittedAt: new Date(),
      decidedAt: null,
      createdAt: new Date(),
      createdBy: '88888888-9999-aaaa-bbbb-cccccccccccc',
      updatedAt: new Date(),
      updatedBy: '88888888-9999-aaaa-bbbb-cccccccccccc',
      deletedAt: null,
      deletedBy: null,
    } as SectionReviewSummary;

    const sections = {
      findById: vi.fn().mockResolvedValue(section),
      update: vi.fn().mockResolvedValue(section),
    } as unknown as SectionRepositoryImpl;

    const drafts = {
      findById: vi.fn().mockResolvedValue(draft),
    } as unknown as SectionDraftRepositoryImpl;

    const reviews = {
      createReview: vi.fn().mockResolvedValue(reviewSummary),
    } as unknown as SectionReviewRepositoryImpl;

    const service = new SectionReviewService(sections, drafts, reviews, createLogger());

    const response = await service.submitDraft({
      sectionId: section.id,
      userId: 'user-1',
      draftId: draft.id,
      summaryNote: 'Summary note',
    });

    expect(reviews.createReview).toHaveBeenCalled();
    expect(sections.update).toHaveBeenCalledWith(
      section.id,
      expect.objectContaining({ status: 'review' })
    );
    expect(response.status).toBe('pending');
    expect(response.summaryNote).toBe('Summary note');
  });
});

import type { Logger } from 'pino';

import {
  SectionDraftRepositoryImpl,
  SectionRepositoryImpl,
  SectionReviewRepositoryImpl,
  type SectionDraft,
} from '@ctrl-freaq/shared-data';

import {
  ReviewSubmissionResponseSchema,
  SubmitDraftRequestSchema,
  type ReviewSubmissionResponse,
  type SubmitDraftRequest,
} from '../validation/section-editor.schema';
import { SectionEditorServiceError } from './section-editor.errors';

export interface SubmitReviewOptions extends SubmitDraftRequest {
  sectionId: string;
  userId: string;
  requestId?: string;
}

export class SectionReviewService {
  constructor(
    private readonly sections: SectionRepositoryImpl,
    private readonly drafts: SectionDraftRepositoryImpl,
    private readonly reviews: SectionReviewRepositoryImpl,
    private readonly logger: Logger
  ) {}

  async submitDraft(options: SubmitReviewOptions): Promise<ReviewSubmissionResponse> {
    const payload = SubmitDraftRequestSchema.parse({
      draftId: options.draftId,
      summaryNote: options.summaryNote,
      reviewers: options.reviewers,
    });

    const section = await this.sections.findById(options.sectionId);
    if (!section) {
      throw new SectionEditorServiceError(`Section ${options.sectionId} not found`, 404);
    }

    const draft = await this.ensureDraft(payload.draftId, section.id);

    const review = await this.reviews.createReview(
      {
        sectionId: section.id,
        documentId: section.docId,
        draftId: draft.id,
        reviewerId: payload.reviewers?.[0] ?? options.userId,
        reviewStatus: 'pending',
        reviewerNote: payload.summaryNote,
        submittedAt: new Date(),
        decidedAt: null,
      },
      options.userId
    );

    await this.sections.update(section.id, {
      status: 'review',
      lastSummary: payload.summaryNote,
    });

    const response = ReviewSubmissionResponseSchema.parse({
      reviewId: review.id,
      sectionId: review.sectionId,
      status: review.reviewStatus,
      submittedAt: review.submittedAt.toISOString(),
      submittedBy: options.userId,
      summaryNote: review.reviewerNote,
    });

    this.logger.info(
      {
        requestId: options.requestId,
        sectionId: options.sectionId,
        draftId: draft.id,
        reviewId: review.id,
        userId: options.userId,
      },
      'Section draft submitted for review'
    );

    return response;
  }

  private async ensureDraft(draftId: string, sectionId: string): Promise<SectionDraft> {
    const draft = await this.drafts.findById(draftId);
    if (!draft) {
      throw new SectionEditorServiceError(`Draft ${draftId} not found`, 404);
    }

    if (draft.sectionId !== sectionId) {
      throw new SectionEditorServiceError('Draft does not belong to target section', 400);
    }

    return draft;
  }
}

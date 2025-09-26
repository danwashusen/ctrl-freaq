import type { Logger } from 'pino';

import {
  SectionDraftRepositoryImpl,
  SectionRepositoryImpl,
  SectionReviewRepositoryImpl,
  type SectionDraft,
} from '@ctrl-freaq/shared-data';

import {
  ApproveSectionRequestSchema,
  ApprovalResponseSchema,
  type ApproveSectionRequest,
  type ApprovalResponse,
} from '../validation/section-editor.schema';
import { SectionEditorServiceError } from './section-editor.errors';

export interface ApproveSectionOptions extends ApproveSectionRequest {
  sectionId: string;
  userId: string;
  requestId?: string;
}

export class SectionApprovalService {
  constructor(
    private readonly sections: SectionRepositoryImpl,
    private readonly drafts: SectionDraftRepositoryImpl,
    private readonly reviews: SectionReviewRepositoryImpl,
    private readonly logger: Logger
  ) {}

  async approve(options: ApproveSectionOptions): Promise<ApprovalResponse> {
    const payload = ApproveSectionRequestSchema.parse({
      draftId: options.draftId,
      approvalNote: options.approvalNote,
    });

    const section = await this.sections.findById(options.sectionId);
    if (!section) {
      throw new SectionEditorServiceError(`Section ${options.sectionId} not found`, 404);
    }

    const draft = await this.ensureDraft(payload.draftId, section.id);

    const approvedAt = new Date();
    const approvedVersion = this.resolveApprovedVersion(
      section.approvedVersion ?? 0,
      draft.draftVersion
    );
    const lastSummary =
      payload.approvalNote ?? (draft.summaryNote?.trim() ? draft.summaryNote : null);

    const updatedSection = await this.sections.finalizeApproval(section, {
      approvedContent: draft.contentMarkdown,
      approvedVersion,
      approvedAt,
      approvedBy: options.userId,
      lastSummary,
    });

    await this.markDraftApproved(draft, approvedVersion, approvedAt, options.userId);
    await this.markReviewsApproved(section.id, draft.id, options.userId, approvedAt, lastSummary);

    const response = ApprovalResponseSchema.parse({
      sectionId: updatedSection.id,
      approvedVersion: updatedSection.approvedVersion,
      approvedContent: updatedSection.approvedContent,
      approvedAt: approvedAt.toISOString(),
      approvedBy: options.userId,
      requestId: options.requestId ?? 'unknown',
    });

    this.logger.info(
      {
        requestId: options.requestId,
        sectionId: section.id,
        draftId: draft.id,
        userId: options.userId,
        approvedVersion: response.approvedVersion,
      },
      'Section approval finalized'
    );

    return response;
  }

  private resolveApprovedVersion(currentVersion: number, draftVersion: number): number {
    if (draftVersion > currentVersion) {
      return draftVersion;
    }
    return currentVersion + 1;
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

  private async markDraftApproved(
    draft: SectionDraft,
    approvedVersion: number,
    approvedAt: Date,
    userId: string
  ): Promise<void> {
    await this.drafts.updateDraft(
      draft.id,
      {
        draftBaseVersion: approvedVersion,
        conflictState: 'clean',
        conflictReason: null,
        rebasedAt: approvedAt,
      },
      {
        actorId: userId,
        savedAt: approvedAt,
        savedBy: userId,
      }
    );
  }

  private async markReviewsApproved(
    sectionId: string,
    draftId: string,
    userId: string,
    approvedAt: Date,
    lastSummary: string | null
  ): Promise<void> {
    const reviews = await this.reviews.listBySection(sectionId);
    if (!reviews.length) {
      return;
    }

    const pendingForDraft = reviews.filter(
      review => review.draftId === draftId && review.reviewStatus === 'pending'
    );
    await Promise.all(
      pendingForDraft.map(review =>
        this.reviews.updateReviewStatus(
          review.id,
          {
            reviewStatus: 'approved',
            decidedAt: approvedAt,
            reviewerNote: lastSummary ?? review.reviewerNote,
          },
          userId
        )
      )
    );
  }
}

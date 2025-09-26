import type { Logger } from 'pino';

import {
  SectionDraftRepositoryImpl,
  SectionRepositoryImpl,
  type CreateSectionDraftInput,
  type SectionDraft,
} from '@ctrl-freaq/shared-data';

import {
  SaveDraftRequestSchema,
  type ConflictCheckResponse,
  type ConflictTrigger,
  type FormattingAnnotation,
  type SaveDraftRequest,
  type SectionDraftResponse,
} from '../validation/section-editor.schema';
import { SectionEditorServiceError } from './section-editor.errors';
import { SectionConflictService } from './section-conflict.service';

export interface SaveDraftOptions extends SaveDraftRequest {
  sectionId: string;
  documentId: string;
  userId: string;
  draftId?: string;
  requestId?: string;
  triggeredBy?: ConflictTrigger;
}

export class SectionDraftConflictError extends SectionEditorServiceError {
  constructor(public readonly conflict: ConflictCheckResponse) {
    super('Draft conflict detected', 409, conflict);
    this.name = 'SectionDraftConflictError';
  }
}

export class SectionDraftService {
  constructor(
    private readonly sections: SectionRepositoryImpl,
    private readonly drafts: SectionDraftRepositoryImpl,
    private readonly conflictService: SectionConflictService,
    private readonly logger: Logger
  ) {}

  async saveDraft(options: SaveDraftOptions): Promise<SectionDraftResponse> {
    const payload = SaveDraftRequestSchema.parse({
      contentMarkdown: options.contentMarkdown,
      draftVersion: options.draftVersion,
      draftBaseVersion: options.draftBaseVersion,
      summaryNote: options.summaryNote,
      formattingAnnotations: options.formattingAnnotations,
      clientTimestamp: options.clientTimestamp,
    });

    const section = await this.sections.findById(options.sectionId);
    if (!section) {
      throw new SectionEditorServiceError(`Section ${options.sectionId} not found`, 404);
    }

    if (section.approvedVersion > payload.draftBaseVersion) {
      const conflict = await this.conflictService.check({
        sectionId: options.sectionId,
        userId: options.userId,
        draftId: options.draftId,
        draftBaseVersion: payload.draftBaseVersion,
        draftVersion: payload.draftVersion,
        approvedVersion: section.approvedVersion,
        requestId: options.requestId,
        triggeredBy: options.triggeredBy ?? 'save',
      });
      throw new SectionDraftConflictError(conflict);
    }

    const savedAt = options.clientTimestamp ? new Date(options.clientTimestamp) : new Date();

    const formattingAnnotations = payload.formattingAnnotations ?? [];

    let draft: SectionDraft;
    if (options.draftId) {
      const existingDraft = await this.drafts.findById(options.draftId);
      if (existingDraft) {
        draft = await this.updateExistingDraft(
          options.draftId,
          {
            payload,
            options,
            savedAt,
            formattingAnnotations,
          },
          existingDraft
        );
      } else {
        draft = await this.createDraft({
          payload,
          sectionId: options.sectionId,
          documentId: options.documentId,
          userId: options.userId,
          savedAt,
          formattingAnnotations,
          draftId: options.draftId,
        });
      }
    } else {
      draft = await this.createDraft({
        payload,
        sectionId: options.sectionId,
        documentId: options.documentId,
        userId: options.userId,
        savedAt,
        formattingAnnotations,
      });
    }

    this.logger.info(
      {
        requestId: options.requestId,
        sectionId: options.sectionId,
        draftId: draft.id,
        userId: options.userId,
        draftVersion: draft.draftVersion,
      },
      'Section draft persisted'
    );

    return this.toResponse(draft);
  }

  private async updateExistingDraft(
    draftId: string,
    context: {
      payload: SaveDraftRequest;
      options: SaveDraftOptions;
      savedAt: Date;
      formattingAnnotations: FormattingAnnotation[];
    },
    existing?: SectionDraft
  ): Promise<SectionDraft> {
    const current = existing ?? (await this.drafts.findById(draftId));
    if (!current) {
      throw new SectionEditorServiceError(`Draft ${draftId} not found`, 404);
    }

    if (context.payload.draftVersion <= current.draftVersion) {
      throw new SectionEditorServiceError(
        `Draft version ${context.payload.draftVersion} must exceed existing version ${current.draftVersion}`,
        409
      );
    }

    const updated = await this.drafts.updateDraft(
      draftId,
      {
        contentMarkdown: context.payload.contentMarkdown,
        draftVersion: context.payload.draftVersion,
        draftBaseVersion: context.payload.draftBaseVersion,
        summaryNote: context.payload.summaryNote,
        conflictState: 'clean',
        conflictReason: null,
        savedAt: context.savedAt,
        savedBy: context.options.userId,
      },
      {
        actorId: context.options.userId,
        savedAt: context.savedAt,
        savedBy: context.options.userId,
        formattingAnnotations: context.formattingAnnotations?.map(annotation => ({
          startOffset: annotation.startOffset,
          endOffset: annotation.endOffset,
          markType: annotation.markType,
          message: annotation.message,
          severity: annotation.severity,
        })),
      }
    );

    return updated;
  }

  private async createDraft(context: {
    payload: SaveDraftRequest;
    sectionId: string;
    documentId: string;
    userId: string;
    savedAt: Date;
    formattingAnnotations: FormattingAnnotation[];
    draftId?: string;
  }): Promise<SectionDraft> {
    const draftVersion = Math.max(context.payload.draftVersion, 1);

    const input = {
      sectionId: context.sectionId,
      documentId: context.documentId,
      userId: context.userId,
      contentMarkdown: context.payload.contentMarkdown,
      draftVersion,
      draftBaseVersion: context.payload.draftBaseVersion,
      summaryNote: context.payload.summaryNote,
    } as CreateSectionDraftInput;

    const options = {
      actorId: context.userId,
      savedAt: context.savedAt,
      savedBy: context.userId,
      formattingAnnotations: context.formattingAnnotations.map(annotation => ({
        startOffset: annotation.startOffset,
        endOffset: annotation.endOffset,
        markType: annotation.markType,
        message: annotation.message,
        severity: annotation.severity,
      })),
    } as const;

    const draft = context.draftId
      ? await this.drafts.createDraftWithId(context.draftId, input, options)
      : await this.drafts.createDraft(input, options);

    return draft;
  }

  private toResponse(draft: SectionDraft): SectionDraftResponse {
    return {
      draftId: draft.id,
      sectionId: draft.sectionId,
      draftVersion: draft.draftVersion,
      conflictState: draft.conflictState,
      formattingAnnotations: draft.formattingAnnotations.map(annotation => ({
        id: annotation.id,
        startOffset: annotation.startOffset,
        endOffset: annotation.endOffset,
        markType: annotation.markType,
        message: annotation.message,
        severity: annotation.severity,
      })),
      savedAt: draft.savedAt.toISOString(),
      savedBy: draft.savedBy,
      summaryNote: draft.summaryNote || undefined,
    };
  }
}

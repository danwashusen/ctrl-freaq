import type { Logger } from 'pino';

import {
  DraftConflictLogRepositoryImpl,
  SectionDraftRepositoryImpl,
  SectionRepositoryImpl,
  type DraftConflictLog,
} from '@ctrl-freaq/shared-data';

import {
  ConflictLogEntrySchema,
  ConflictLogResponseSchema,
  type ConflictLogResponse,
} from '../validation/section-editor.schema';
import { SectionEditorServiceError } from './section-editor.errors';

export interface ListConflictLogOptions {
  sectionId: string;
  draftId: string;
  userId: string;
  requestId?: string;
}

export class SectionConflictLogService {
  constructor(
    private readonly sections: SectionRepositoryImpl,
    private readonly drafts: SectionDraftRepositoryImpl,
    private readonly conflictLogs: DraftConflictLogRepositoryImpl,
    private readonly logger: Logger
  ) {}

  async list(options: ListConflictLogOptions): Promise<ConflictLogResponse> {
    const section = await this.sections.findById(options.sectionId);
    if (!section) {
      throw new SectionEditorServiceError(`Section ${options.sectionId} not found`, 404);
    }

    const draft = await this.drafts.findById(options.draftId);
    if (!draft) {
      throw new SectionEditorServiceError(`Draft ${options.draftId} not found`, 404);
    }

    if (draft.sectionId !== section.id) {
      throw new SectionEditorServiceError('Draft does not belong to target section', 400);
    }

    const events = await this.conflictLogs.listByDraft(draft.id);
    const payload = ConflictLogResponseSchema.parse({
      sectionId: section.id,
      draftId: draft.id,
      events: events.map(event => this.mapConflictLog(event)),
    });

    this.logger.info(
      {
        requestId: options.requestId,
        sectionId: section.id,
        draftId: draft.id,
        userId: options.userId,
        eventCount: payload.events.length,
      },
      'Conflict log retrieved'
    );

    return payload;
  }

  private mapConflictLog(entry: DraftConflictLog) {
    return ConflictLogEntrySchema.parse({
      detectedAt: entry.detectedAt.toISOString(),
      detectedDuring: entry.detectedDuring,
      previousApprovedVersion: entry.previousApprovedVersion,
      latestApprovedVersion: entry.latestApprovedVersion,
      resolvedBy: entry.resolvedBy,
      resolutionNote: entry.resolutionNote,
    });
  }
}

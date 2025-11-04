import type { Logger } from 'pino';

import {
  DraftConflictLogRepositoryImpl,
  SectionDraftRepositoryImpl,
  SectionRepositoryImpl,
  type DraftConflictLog,
  type SectionDraft,
  type SectionView,
} from '@ctrl-freaq/shared-data';

import {
  ConflictCheckRequestSchema,
  ConflictCheckResponseSchema,
  type ConflictCheckRequest,
  type ConflictCheckResponse,
  type ConflictLogEntry,
  type ConflictStatus,
  type ConflictTrigger,
} from '../validation/section-editor.schema';
import { SectionEditorServiceError } from './section-editor.errors';
import type { ResolvedEventStream } from '../../quality-gates/event-stream-utils.js';

export interface ConflictCheckOptions extends ConflictCheckRequest {
  sectionId: string;
  userId: string;
  draftId?: string;
  requestId?: string;
  eventStream?: ResolvedEventStream | null;
}

export class SectionConflictService {
  constructor(
    private readonly sections: SectionRepositoryImpl,
    private readonly drafts: SectionDraftRepositoryImpl,
    private readonly conflictLogs: DraftConflictLogRepositoryImpl,
    private readonly logger: Logger
  ) {}

  async check(options: ConflictCheckOptions): Promise<ConflictCheckResponse> {
    const params = ConflictCheckRequestSchema.parse({
      draftBaseVersion: options.draftBaseVersion,
      draftVersion: options.draftVersion,
      approvedVersion: options.approvedVersion,
      requestId: options.requestId,
      triggeredBy: options.triggeredBy,
    });

    const section = await this.sections.findById(options.sectionId);
    if (!section) {
      throw new SectionEditorServiceError(`Section ${options.sectionId} not found`, 404);
    }

    const latestApprovedVersion = section.approvedVersion ?? 0;
    const draft = options.draftId ? await this.drafts.findById(options.draftId) : null;
    const status = this.resolveStatus(params, latestApprovedVersion, draft ?? undefined);

    let detectedAt: Date | null = null;
    if (status === 'rebase_required' && options.draftId) {
      detectedAt = await this.logConflict(options, section, draft ?? undefined);
    }

    const response = ConflictCheckResponseSchema.parse({
      status,
      latestApprovedVersion,
      conflictReason:
        status === 'clean'
          ? null
          : `Draft base version ${params.draftBaseVersion} is behind approved version ${latestApprovedVersion}`,
      rebasedDraft:
        status === 'rebase_required' ? this.buildRebasedDraft(section, draft, params) : undefined,
      events: options.draftId ? await this.fetchConflictLog(options.draftId) : undefined,
    });

    this.publishConflictEvent({
      eventStream: options.eventStream ?? null,
      section,
      draft,
      conflict: response,
      detectedAt,
      requestId: options.requestId,
      userId: options.userId,
      draftId: options.draftId,
      triggeredBy: options.triggeredBy ?? null,
    });

    this.logger.info(
      {
        requestId: options.requestId,
        sectionId: options.sectionId,
        draftId: options.draftId,
        userId: options.userId,
        status: response.status,
        latestApprovedVersion,
      },
      'Section conflict check completed'
    );

    return response;
  }

  private resolveStatus(
    payload: ConflictCheckRequest,
    latestApprovedVersion: number,
    draft?: SectionDraft
  ): ConflictStatus {
    if (draft?.conflictState === 'blocked') {
      return 'blocked';
    }

    if (latestApprovedVersion <= payload.draftBaseVersion) {
      return 'clean';
    }
    return 'rebase_required';
  }

  private async logConflict(
    options: ConflictCheckOptions,
    section: SectionView,
    draft?: SectionDraft
  ): Promise<Date | null> {
    const detectedAt = new Date();
    const detectionPoint: ConflictTrigger = options.triggeredBy ?? 'entry';

    if (draft) {
      await this.conflictLogs.createLogEntry(
        {
          sectionId: section.id,
          draftId: draft.id,
          detectedAt,
          detectedDuring: detectionPoint,
          previousApprovedVersion: options.draftBaseVersion,
          latestApprovedVersion: section.approvedVersion ?? 0,
          resolvedBy: null,
          resolutionNote: draft.conflictReason ?? null,
        },
        options.userId
      );

      await this.drafts.updateDraft(
        draft.id,
        {
          conflictState: 'rebase_required',
          conflictReason: `Rebase required: section approved version ${section.approvedVersion} exceeded draft base version ${options.draftBaseVersion}`,
        },
        { actorId: options.userId, savedAt: draft.savedAt, savedBy: options.userId }
      );
      return detectedAt;
    }

    this.logger.warn(
      {
        sectionId: section.id,
        draftId: options.draftId,
        userId: options.userId,
      },
      'Conflict detected but draft record was not found'
    );
    return null;
  }

  private buildRebasedDraft(
    section: SectionView,
    draft: SectionDraft | null,
    payload: ConflictCheckRequest
  ) {
    const baselineVersion = draft?.draftVersion ?? payload.draftVersion;
    return {
      draftVersion: baselineVersion + 1,
      contentMarkdown: section.approvedContent,
      formattingAnnotations:
        draft?.formattingAnnotations?.map(annotation => ({
          id: annotation.id,
          startOffset: annotation.startOffset,
          endOffset: annotation.endOffset,
          markType: annotation.markType,
          message: annotation.message,
          severity: annotation.severity,
        })) ?? [],
    };
  }

  private async fetchConflictLog(draftId: string): Promise<ConflictLogEntry[] | undefined> {
    const entries = await this.conflictLogs.listByDraft(draftId);
    if (!entries.length) {
      return undefined;
    }

    return entries.map(entry => this.mapConflictLog(entry));
  }

  private mapConflictLog(entry: DraftConflictLog): ConflictLogEntry {
    return {
      detectedAt: entry.detectedAt.toISOString(),
      detectedDuring: entry.detectedDuring,
      previousApprovedVersion: entry.previousApprovedVersion,
      latestApprovedVersion: entry.latestApprovedVersion,
      resolvedBy: entry.resolvedBy,
      resolutionNote: entry.resolutionNote,
    };
  }

  private publishConflictEvent(options: {
    eventStream: ResolvedEventStream | null;
    section: SectionView;
    draft: SectionDraft | null;
    conflict: ConflictCheckResponse;
    detectedAt: Date | null;
    requestId?: string;
    userId: string;
    draftId?: string;
    triggeredBy?: string | null;
  }): void {
    if (!options.eventStream) {
      this.logger.info(
        {
          sectionId: options.section.id,
          draftId: options.draft?.id ?? options.draftId ?? null,
        },
        'Skipping section conflict event publish; event stream unavailable'
      );
      return;
    }

    try {
      options.eventStream.broker.publish({
        workspaceId: options.eventStream.workspaceId,
        topic: 'section.conflict',
        resourceId: options.section.id,
        payload: {
          sectionId: options.section.id,
          documentId: options.section.docId,
          conflictState: options.conflict.status,
          conflictReason: options.conflict.conflictReason ?? null,
          latestApprovedVersion: options.conflict.latestApprovedVersion ?? null,
          detectedAt: (options.detectedAt ?? new Date()).toISOString(),
          detectedBy: options.userId,
          events: options.conflict.events ?? [],
          draftId: options.draft?.id ?? options.draftId ?? null,
          draftVersion: options.draft?.draftVersion ?? null,
          draftBaseVersion: options.draft?.draftBaseVersion ?? null,
        },
        metadata: {
          requestId: options.requestId ?? 'unknown',
          triggeredBy: options.triggeredBy ?? 'unknown',
          conflictState: options.conflict.status,
        },
      });
      this.logger.info(
        {
          requestId: options.requestId ?? 'unknown',
          sectionId: options.section.id,
          draftId: options.draft?.id ?? options.draftId ?? null,
        },
        'Published section conflict event'
      );
    } catch (error) {
      this.logger.warn(
        {
          requestId: options.requestId ?? 'unknown',
          sectionId: options.section.id,
          draftId: options.draft?.id ?? options.draftId ?? null,
          error: error instanceof Error ? error.message : String(error),
        },
        'Failed to publish section conflict event'
      );
    }
  }
}

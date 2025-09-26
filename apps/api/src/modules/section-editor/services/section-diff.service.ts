import type { Logger } from 'pino';

import {
  SectionDraftRepositoryImpl,
  SectionRepositoryImpl,
  type SectionDraft,
} from '@ctrl-freaq/shared-data';
import type { GenerateSectionDiffOptions, SectionDiffResult } from '@ctrl-freaq/editor-core';
import { DiffResponseSchema, type DiffResponse } from '../validation/section-editor.schema';
import { SectionEditorServiceError } from './section-editor.errors';

export interface BuildDiffOptions {
  sectionId: string;
  userId: string;
  draftId?: string;
  draftContent?: string;
  draftVersion?: number;
  requestId?: string;
}

export class SectionDiffService {
  constructor(
    private readonly sections: SectionRepositoryImpl,
    private readonly drafts: SectionDraftRepositoryImpl,
    private readonly diffGenerator: (
      originalContent: string,
      modifiedContent: string,
      options?: GenerateSectionDiffOptions
    ) => SectionDiffResult,
    private readonly logger: Logger
  ) {}

  async buildDiff(options: BuildDiffOptions): Promise<DiffResponse> {
    const section = await this.sections.findById(options.sectionId);
    if (!section) {
      throw new SectionEditorServiceError(`Section ${options.sectionId} not found`, 404);
    }

    const draft = options.draftId ? await this.drafts.findById(options.draftId) : null;

    const draftContent = this.resolveDraftContent(options, draft);
    const draftVersion = this.resolveDraftVersion(options, draft);

    const diff = this.diffGenerator(section.approvedContent, draftContent, {
      mode: 'split',
      approvedVersion: section.approvedVersion ?? 0,
      draftVersion,
      metadata: {
        sectionId: section.id,
        draftId: options.draftId ?? draft?.id,
      },
    });

    const response = DiffResponseSchema.parse(diff);

    this.logger.debug(
      {
        requestId: options.requestId,
        sectionId: options.sectionId,
        draftId: options.draftId ?? draft?.id,
        userId: options.userId,
        segmentCount: response.segments.length,
      },
      'Section diff generated'
    );

    return response;
  }

  private resolveDraftContent(options: BuildDiffOptions, draft: SectionDraft | null): string {
    if (options.draftContent) {
      return options.draftContent;
    }

    if (draft) {
      return draft.contentMarkdown;
    }

    throw new SectionEditorServiceError('Draft content is required to generate a diff', 400);
  }

  private resolveDraftVersion(options: BuildDiffOptions, draft: SectionDraft | null): number {
    if (typeof options.draftVersion === 'number') {
      return options.draftVersion;
    }

    if (draft) {
      return draft.draftVersion;
    }

    throw new SectionEditorServiceError('Draft version is required to generate a diff', 400);
  }
}

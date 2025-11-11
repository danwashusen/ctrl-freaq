import type { Logger } from 'pino';

import { createPatchEngine, type PatchDiff } from '@ctrl-freaq/editor-core';
import { DocumentRepositoryImpl, SectionRepositoryImpl } from '@ctrl-freaq/shared-data';
import type { Document, SectionView } from '@ctrl-freaq/shared-data';

import {
  DraftBundleValidationError,
  type DraftBundleConflict,
  type DraftBundleRepository,
  type DraftSectionSubmission,
} from './draft-bundle.service.js';

const BASELINE_VERSION_PATTERN = /rev-(\d+)/i;

const patchEngine = createPatchEngine();

function isPatchDiffArray(candidate: unknown): candidate is PatchDiff[] {
  if (!Array.isArray(candidate)) {
    return false;
  }

  return candidate.every(item => {
    if (!item || typeof item !== 'object') {
      return false;
    }

    const op = (item as { op?: unknown }).op;
    const path = (item as { path?: unknown }).path;
    return (
      typeof op === 'string' &&
      (op === 'add' || op === 'remove' || op === 'replace') &&
      typeof path === 'string'
    );
  });
}

function tryParsePatchOperations(rawPatch: string): PatchDiff[] | null {
  try {
    const parsed = JSON.parse(rawPatch);
    return isPatchDiffArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function extractBaselineVersion(baseline: string): number | null {
  const directNumber = Number.parseInt(baseline, 10);
  if (!Number.isNaN(directNumber)) {
    return directNumber;
  }

  const match = BASELINE_VERSION_PATTERN.exec(baseline);
  if (match && match[1]) {
    const parsed = Number.parseInt(match[1], 10);
    return Number.isNaN(parsed) ? null : parsed;
  }

  return null;
}

function buildConflict(
  sectionPath: string,
  message: string,
  extras: Partial<DraftBundleConflict> = {}
): DraftBundleConflict {
  return {
    sectionPath,
    message,
    ...extras,
  } satisfies DraftBundleConflict;
}

type ScopeKey = `${string}:${string}`;

interface DocumentScope {
  document: Document;
}

export class DraftBundleRepositoryImpl implements DraftBundleRepository {
  private readonly scopeCache = new Map<ScopeKey, DocumentScope>();

  constructor(
    private readonly sections: SectionRepositoryImpl,
    private readonly documents: DocumentRepositoryImpl,
    private readonly logger: Logger
  ) {}

  async applyBundleSectionsAtomically(
    sections: DraftSectionSubmission[],
    context: { documentId: string; projectId: string; authorId: string }
  ): Promise<string[]> {
    if (sections.length === 0) {
      return [];
    }

    const preparedSections = await Promise.all(
      sections.map(section => this.prepareSectionForApplication(section, context))
    );

    const db = this.sections.getConnection();
    db.exec('BEGIN IMMEDIATE TRANSACTION');

    try {
      for (const prepared of preparedSections) {
        await this.applyPreparedSection(prepared, context, { transactionDb: db });
      }

      db.exec('COMMIT');
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }

    return preparedSections.map(prepared => prepared.submission.sectionPath);
  }

  async validateBaseline(
    input: DraftSectionSubmission & { documentId: string; projectId: string; authorId: string }
  ): Promise<{ status: string }> {
    const { section } = await this.loadScopedSection(input.sectionPath, {
      documentId: input.documentId,
      projectId: input.projectId,
      authorId: input.authorId,
    });

    const expectedVersion = extractBaselineVersion(input.baselineVersion);
    if (expectedVersion !== null && expectedVersion !== section.approvedVersion) {
      const serverContent = section.approvedContent ?? section.contentMarkdown ?? '';
      throw new DraftBundleValidationError([
        buildConflict(
          input.sectionPath,
          `Baseline version ${input.baselineVersion} does not match server version ${section.approvedVersion}`,
          {
            serverVersion: section.approvedVersion ?? undefined,
            serverContent,
          }
        ),
      ]);
    }

    return { status: 'ok' };
  }

  async applySectionPatch(
    input: DraftSectionSubmission & {
      documentId: string;
      projectId: string;
      authorId: string;
    }
  ): Promise<{ applied: boolean }> {
    const context = {
      documentId: input.documentId,
      projectId: input.projectId,
      authorId: input.authorId,
    } satisfies ApplicationContext;

    const prepared = await this.prepareSectionForApplication(input, context);

    await this.applyPreparedSection(prepared, context);

    return { applied: true };
  }

  async retireDraft(draftKey: string): Promise<void> {
    this.logger.info({ draftKey }, 'Retiring client draft after bundle completion');
  }

  async getSectionSnapshot(input: {
    sectionPath: string;
    documentId: string;
    projectId: string;
  }): Promise<{ serverVersion: number; serverContent: string } | null> {
    try {
      const { section } = await this.loadScopedSection(input.sectionPath, {
        documentId: input.documentId,
        projectId: input.projectId,
        authorId: 'system',
      });

      const serverVersion = section.approvedVersion ?? 0;
      const serverContent = section.approvedContent ?? section.contentMarkdown ?? '';
      return {
        serverVersion,
        serverContent,
      };
    } catch (error) {
      if (error instanceof DraftBundleValidationError) {
        this.logger.warn(
          {
            sectionPath: input.sectionPath,
            documentId: input.documentId,
            projectId: input.projectId,
            reason: error.conflicts?.[0]?.message ?? error.message,
          },
          'Unable to load section snapshot for bundle conflict'
        );
        return null;
      }
      throw error;
    }
  }

  private async prepareSectionForApplication(
    submission: DraftSectionSubmission,
    context: ApplicationContext
  ): Promise<PreparedSectionApplication> {
    const { section } = await this.loadScopedSection(submission.sectionPath, context);
    const nextVersion = (section.approvedVersion ?? 0) + 1;

    const draftPatches = tryParsePatchOperations(submission.patch);
    let approvedContent = submission.patch;

    if (draftPatches) {
      const baselineContent = section.approvedContent ?? section.contentMarkdown;
      const patchResult = patchEngine.applyPatch(baselineContent, draftPatches);

      if (!patchResult.success || typeof patchResult.content !== 'string') {
        const reason = patchResult.error ?? 'Unable to apply draft patch';
        throw new DraftBundleValidationError([
          buildConflict(submission.sectionPath, `Draft patch could not be applied: ${reason}`, {
            serverVersion: section.approvedVersion ?? undefined,
            serverContent: section.approvedContent ?? section.contentMarkdown ?? '',
          }),
        ]);
      }

      approvedContent = patchResult.content;
    }

    return {
      submission,
      section,
      approvedContent,
      nextVersion,
    } satisfies PreparedSectionApplication;
  }

  private async applyPreparedSection(
    prepared: PreparedSectionApplication,
    context: ApplicationContext,
    options: Parameters<SectionRepositoryImpl['finalizeApproval']>[2] = {}
  ): Promise<void> {
    await this.sections.finalizeApproval(
      prepared.section,
      {
        approvedContent: prepared.approvedContent,
        approvedVersion: prepared.nextVersion,
        approvedAt: new Date(),
        approvedBy: context.authorId,
        status: 'ready',
        qualityGate: 'passed',
      },
      options
    );

    this.logger.info(
      {
        projectId: context.projectId,
        documentId: context.documentId,
        sectionId: prepared.section.id,
        draftKey: prepared.submission.draftKey,
        baselineVersion: prepared.submission.baselineVersion,
        appliedVersion: prepared.nextVersion,
      },
      'Bundled draft applied to section'
    );
  }

  private buildScopeKey(context: ApplicationContext): ScopeKey {
    return `${context.projectId}:${context.documentId}`;
  }

  private async ensureDocumentScope(
    context: ApplicationContext,
    sectionPath: string
  ): Promise<DocumentScope> {
    const scopeKey = this.buildScopeKey(context);
    const cached = this.scopeCache.get(scopeKey);
    if (cached) {
      return cached;
    }

    const document = await this.documents.findById(context.documentId);
    if (!document) {
      this.logger.warn(
        {
          projectId: context.projectId,
          documentId: context.documentId,
          sectionPath,
        },
        'Document not found while validating draft bundle scope'
      );
      throw new DraftBundleValidationError([
        buildConflict(
          sectionPath,
          `Document ${context.documentId} is not available in project ${context.projectId}`,
          { serverVersion: 0, serverContent: '' }
        ),
      ]);
    }

    if (document.projectId !== context.projectId) {
      this.logger.warn(
        {
          projectId: context.projectId,
          documentId: context.documentId,
          sectionPath,
          documentProjectId: document.projectId,
        },
        'Document/project scope mismatch encountered during draft bundle processing'
      );
      throw new DraftBundleValidationError([
        buildConflict(
          sectionPath,
          `Document ${context.documentId} is not part of project ${context.projectId}`,
          { serverVersion: 0, serverContent: '' }
        ),
      ]);
    }

    const scope: DocumentScope = { document };
    this.scopeCache.set(scopeKey, scope);
    return scope;
  }

  private async loadScopedSection(
    sectionPath: string,
    context: ApplicationContext
  ): Promise<{ section: SectionView; scope: DocumentScope }> {
    const scope = await this.ensureDocumentScope(context, sectionPath);
    const section = await this.sections.findById(sectionPath);
    if (!section) {
      throw new DraftBundleValidationError([
        buildConflict(sectionPath, 'Section not found for bundle application'),
      ]);
    }

    if (section.docId !== scope.document.id) {
      this.logger.warn(
        {
          projectId: context.projectId,
          documentId: context.documentId,
          sectionId: section.id,
          sectionDocumentId: section.docId,
        },
        'Section does not belong to requested document during draft bundle'
      );
      throw new DraftBundleValidationError([
        buildConflict(
          sectionPath,
          `Section ${sectionPath} is not part of document ${context.documentId}`,
          { serverVersion: section.approvedVersion ?? 0, serverContent: '' }
        ),
      ]);
    }

    return { section, scope };
  }
}

interface PreparedSectionApplication {
  submission: DraftSectionSubmission;
  section: SectionView;
  approvedContent: string;
  nextVersion: number;
}

type ApplicationContext = {
  documentId: string;
  projectId: string;
  authorId: string;
};

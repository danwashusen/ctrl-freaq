import type { Logger } from 'pino';

import { createPatchEngine, type PatchDiff } from '@ctrl-freaq/editor-core';
import { SectionRepositoryImpl } from '@ctrl-freaq/shared-data';

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

function buildConflict(sectionPath: string, message: string): DraftBundleConflict {
  return {
    sectionPath,
    message,
  };
}

export class DraftBundleRepositoryImpl implements DraftBundleRepository {
  constructor(
    private readonly sections: SectionRepositoryImpl,
    private readonly logger: Logger
  ) {}

  async validateBaseline(
    input: DraftSectionSubmission & { documentId: string; projectSlug: string; authorId: string }
  ): Promise<{ status: string }> {
    const section = await this.sections.findById(input.sectionPath);
    if (!section) {
      throw new DraftBundleValidationError([
        buildConflict(input.sectionPath, 'Section not found for bundled save'),
      ]);
    }

    const expectedVersion = extractBaselineVersion(input.baselineVersion);
    if (expectedVersion !== null && expectedVersion !== section.approvedVersion) {
      throw new DraftBundleValidationError([
        buildConflict(
          input.sectionPath,
          `Baseline version ${input.baselineVersion} does not match server version ${section.approvedVersion}`
        ),
      ]);
    }

    return { status: 'ok' };
  }

  async applySectionPatch(
    input: DraftSectionSubmission & {
      documentId: string;
      projectSlug: string;
      authorId: string;
    }
  ): Promise<{ applied: boolean }> {
    const section = await this.sections.findById(input.sectionPath);
    if (!section) {
      throw new DraftBundleValidationError([
        buildConflict(input.sectionPath, 'Section not found for bundle application'),
      ]);
    }

    const nextVersion = (section.approvedVersion ?? 0) + 1;

    const draftPatches = tryParsePatchOperations(input.patch);
    let approvedContent = input.patch;

    if (draftPatches) {
      const baselineContent = section.approvedContent ?? section.contentMarkdown;
      const patchResult = patchEngine.applyPatch(baselineContent, draftPatches);

      if (!patchResult.success || typeof patchResult.content !== 'string') {
        const reason = patchResult.error ?? 'Unable to apply draft patch';
        throw new DraftBundleValidationError([
          buildConflict(input.sectionPath, `Draft patch could not be applied: ${reason}`),
        ]);
      }

      approvedContent = patchResult.content;
    }

    await this.sections.finalizeApproval(section, {
      approvedContent,
      approvedVersion: nextVersion,
      approvedAt: new Date(),
      approvedBy: input.authorId,
      status: 'ready',
      qualityGate: 'passed',
    });

    this.logger.info(
      {
        projectSlug: input.projectSlug,
        documentId: input.documentId,
        sectionId: section.id,
        draftKey: input.draftKey,
        baselineVersion: input.baselineVersion,
        appliedVersion: nextVersion,
      },
      'Bundled draft applied to section'
    );

    return { applied: true };
  }

  async retireDraft(draftKey: string): Promise<void> {
    this.logger.info({ draftKey }, 'Retiring client draft after bundle completion');
  }
}

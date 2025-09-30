export interface DraftSectionSubmission {
  draftKey: string;
  sectionPath: string;
  patch: string;
  baselineVersion: string;
  qualityGateReport: {
    status: 'pass' | 'fail';
    issues: Array<{
      gateId: string;
      severity: 'blocker' | 'warning';
      message: string;
    }>;
  };
}

export interface DraftBundleRequest {
  projectSlug: string;
  documentId: string;
  submittedBy: string;
  sections: DraftSectionSubmission[];
}

export interface DraftBundleResult {
  documentId: string;
  appliedSections: string[];
}

export interface DraftBundleRepository {
  validateBaseline(
    input: DraftSectionSubmission & { documentId: string; projectSlug: string; authorId: string }
  ): Promise<{ status: string }>;
  applySectionPatch(
    input: DraftSectionSubmission & {
      documentId: string;
      projectSlug: string;
      authorId: string;
    }
  ): Promise<{ applied: boolean }>;
  retireDraft(draftKey: string): Promise<void>;
}

export interface DraftBundleAuditLogger {
  recordBundleApplied(context: {
    documentId: string;
    authorId: string;
    sectionCount: number;
  }): Promise<void>;
  recordBundleRejected(context: {
    documentId: string;
    authorId: string;
    conflicts: DraftBundleConflict[];
  }): Promise<void>;
}

export interface DraftConflictTelemetry {
  emitBundleAttempt(context: { documentId: string; sectionCount: number }): void;
  emitBundleSuccess(context: { documentId: string; durationMs: number }): void;
  emitBundleFailure(context: { documentId: string; reason: string }): void;
}

export interface DraftBundleDependencies {
  draftRepo: DraftBundleRepository;
  audit: DraftBundleAuditLogger;
  telemetry: DraftConflictTelemetry;
}

export interface DraftBundleConflict {
  sectionPath: string;
  message: string;
}

export class DraftBundleValidationError extends Error {
  constructor(public readonly conflicts: DraftBundleConflict[]) {
    super('Draft bundle validation failed');
    this.name = 'DraftBundleValidationError';
  }
}

export class DraftBundleService {
  constructor(private readonly deps: DraftBundleDependencies) {}

  async applyBundle(request: DraftBundleRequest): Promise<DraftBundleResult> {
    const start = Date.now();
    this.deps.telemetry.emitBundleAttempt({
      documentId: request.documentId,
      sectionCount: request.sections.length,
    });

    const conflicts: DraftBundleConflict[] = [];

    for (const section of request.sections) {
      if (section.qualityGateReport.status === 'fail') {
        const [issue] = section.qualityGateReport.issues;
        conflicts.push({
          sectionPath: section.sectionPath,
          message: issue?.message ?? 'Quality gate failed',
        });
      }
    }

    if (conflicts.length > 0) {
      const error = new DraftBundleValidationError(conflicts);
      await this.deps.audit.recordBundleRejected({
        documentId: request.documentId,
        authorId: request.submittedBy,
        conflicts,
      });
      this.deps.telemetry.emitBundleFailure({
        documentId: request.documentId,
        reason: 'quality-gate-failed',
      });
      throw error;
    }

    const appliedSections: string[] = [];

    for (const section of request.sections) {
      try {
        await this.deps.draftRepo.validateBaseline({
          ...section,
          documentId: request.documentId,
          projectSlug: request.projectSlug,
          authorId: request.submittedBy,
        });
      } catch (error) {
        if (error instanceof DraftBundleValidationError) {
          conflicts.push(...error.conflicts);
          continue;
        }
        throw error;
      }

      try {
        await this.deps.draftRepo.applySectionPatch({
          ...section,
          documentId: request.documentId,
          projectSlug: request.projectSlug,
          authorId: request.submittedBy,
        });
      } catch (error) {
        if (error instanceof DraftBundleValidationError) {
          conflicts.push(...error.conflicts);
          continue;
        }
        throw error;
      }

      await this.deps.draftRepo.retireDraft(section.draftKey);
      appliedSections.push(section.sectionPath);
    }

    if (conflicts.length > 0) {
      const error = new DraftBundleValidationError(conflicts);
      await this.deps.audit.recordBundleRejected({
        documentId: request.documentId,
        authorId: request.submittedBy,
        conflicts,
      });
      this.deps.telemetry.emitBundleFailure({
        documentId: request.documentId,
        reason: 'repository-conflict',
      });
      throw error;
    }

    await this.deps.audit.recordBundleApplied({
      documentId: request.documentId,
      authorId: request.submittedBy,
      sectionCount: appliedSections.length,
    });

    this.deps.telemetry.emitBundleSuccess({
      documentId: request.documentId,
      durationMs: Date.now() - start,
    });

    return {
      documentId: request.documentId,
      appliedSections,
    } satisfies DraftBundleResult;
  }
}

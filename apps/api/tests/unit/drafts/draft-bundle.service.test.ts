import { beforeEach, describe, expect, test, vi } from 'vitest';
import type { Mock } from 'vitest';

import {
  DraftBundleService,
  DraftBundleValidationError,
  type DraftBundleAuditLogger,
  type DraftBundleRepository,
  type DraftConflictTelemetry,
  type DraftSectionSubmission,
} from '../../../src/services/drafts/draft-bundle.service';

const baseRequest = {
  projectSlug: 'project-test',
  documentId: 'doc-architecture-demo',
  submittedBy: 'user-author',
  sections: [
    {
      draftKey: 'project-test/doc-architecture-demo/Architecture Overview/user-author',
      sectionPath: 'architecture-overview',
      patch: '## Updated architecture overview content',
      baselineVersion: 'rev-6',
      qualityGateReport: { status: 'pass' as const, issues: [] },
    },
  ],
};

describe('DraftBundleService', () => {
  let draftRepo: DraftBundleRepository;
  let audit: DraftBundleAuditLogger;
  let telemetry: DraftConflictTelemetry;
  let service: DraftBundleService;

  beforeEach(() => {
    draftRepo = {
      validateBaseline: vi.fn().mockResolvedValue({ status: 'ok' }),
      applySectionPatch: vi.fn().mockResolvedValue({ applied: true }),
      applyBundleSectionsAtomically: vi
        .fn()
        .mockImplementation(async (sections: DraftSectionSubmission[]) =>
          sections.map(section => section.sectionPath)
        ),
      retireDraft: vi.fn().mockResolvedValue(undefined),
      getSectionSnapshot: vi.fn().mockResolvedValue({
        serverVersion: 6,
        serverContent: '## Approved architecture overview',
      }),
    } satisfies DraftBundleRepository;

    audit = {
      recordBundleApplied: vi.fn().mockResolvedValue(undefined),
      recordBundleRejected: vi.fn().mockResolvedValue(undefined),
    } satisfies DraftBundleAuditLogger;

    telemetry = {
      emitBundleAttempt: vi.fn(),
      emitBundleSuccess: vi.fn(),
      emitBundleFailure: vi.fn(),
    } satisfies DraftConflictTelemetry;

    service = new DraftBundleService({ draftRepo, audit, telemetry });
  });

  test('applies bundle when every section passes validation gates', async () => {
    const result = await service.applyBundle(baseRequest);

    expect(result.documentId).toBe(baseRequest.documentId);
    expect(result.appliedSections).toEqual(['architecture-overview']);
    expect(draftRepo.applyBundleSectionsAtomically).toHaveBeenCalledWith(
      baseRequest.sections,
      expect.objectContaining({
        documentId: baseRequest.documentId,
        projectSlug: baseRequest.projectSlug,
        authorId: baseRequest.submittedBy,
      })
    );
    expect(draftRepo.applySectionPatch).not.toHaveBeenCalled();
    expect(draftRepo.retireDraft).toHaveBeenCalledWith(
      'project-test/doc-architecture-demo/Architecture Overview/user-author'
    );
    expect(audit.recordBundleApplied).toHaveBeenCalledWith(
      expect.objectContaining({
        documentId: baseRequest.documentId,
        authorId: baseRequest.submittedBy,
        sectionCount: 1,
      })
    );
    expect(telemetry.emitBundleSuccess).toHaveBeenCalled();
  });

  test('rejects bundle when a section fails quality gates', async () => {
    const failingRequest = {
      ...baseRequest,
      sections: [
        {
          draftKey: baseRequest.sections[0]!.draftKey,
          sectionPath: 'architecture-overview',
          patch: '## Updated architecture overview content',
          baselineVersion: 'rev-5',
          qualityGateReport: {
            status: 'fail' as const,
            issues: [
              {
                gateId: 'lint.architecture',
                severity: 'blocker' as const,
                message: 'Unresolved TODO blocks promotion',
              },
            ],
          },
        },
      ],
    };

    await expect(service.applyBundle(failingRequest)).rejects.toBeInstanceOf(
      DraftBundleValidationError
    );

    expect(audit.recordBundleRejected).toHaveBeenCalledWith(
      expect.objectContaining({
        documentId: baseRequest.documentId,
        authorId: baseRequest.submittedBy,
        conflicts: [
          expect.objectContaining({
            sectionPath: 'architecture-overview',
            message: 'Unresolved TODO blocks promotion',
            serverVersion: 6,
            serverContent: '## Approved architecture overview',
          }),
        ],
      })
    );
    expect(draftRepo.getSectionSnapshot).toHaveBeenCalledWith(
      expect.objectContaining({
        sectionPath: 'architecture-overview',
        documentId: baseRequest.documentId,
        projectSlug: baseRequest.projectSlug,
      })
    );
    expect(draftRepo.applySectionPatch).not.toHaveBeenCalled();
    expect(telemetry.emitBundleFailure).toHaveBeenCalled();
  });

  test('avoids applying any sections when validation conflicts are detected', async () => {
    const conflictError = new DraftBundleValidationError([
      {
        sectionPath: 'architecture-overview',
        message: 'Baseline mismatch',
        serverVersion: 9,
        serverContent: '## Server content v9',
      },
    ]);

    draftRepo.validateBaseline = vi.fn().mockImplementation(() => {
      throw conflictError;
    });

    const multiSectionRequest = {
      ...baseRequest,
      sections: [
        baseRequest.sections[0]!,
        {
          ...baseRequest.sections[0]!,
          sectionPath: 'deployment-strategy',
          draftKey: 'project-test/doc-architecture-demo/Deployment Strategy/user-author',
        },
      ],
    };

    await expect(service.applyBundle(multiSectionRequest)).rejects.toBeInstanceOf(
      DraftBundleValidationError
    );

    expect(draftRepo.validateBaseline).toHaveBeenCalledTimes(1);
    expect(draftRepo.applySectionPatch).not.toHaveBeenCalled();
    expect(draftRepo.retireDraft).not.toHaveBeenCalled();
    expect(audit.recordBundleApplied).not.toHaveBeenCalled();
    expect(audit.recordBundleRejected).toHaveBeenCalledWith(
      expect.objectContaining({
        documentId: multiSectionRequest.documentId,
        authorId: multiSectionRequest.submittedBy,
        conflicts: conflictError.conflicts,
      })
    );
    expect(telemetry.emitBundleFailure).toHaveBeenCalledWith(
      expect.objectContaining({ reason: 'repository-conflict' })
    );
  });

  test('stops processing remaining sections after a quality gate failure', async () => {
    const failingIssue = {
      gateId: 'lint.architecture',
      severity: 'blocker' as const,
      message: 'Unresolved TODO blocks promotion',
    };

    draftRepo.getSectionSnapshot = vi.fn().mockResolvedValue({
      serverVersion: 6,
      serverContent: '## Approved architecture overview',
    });

    draftRepo.validateBaseline = vi.fn().mockImplementation(() => {
      throw new Error('Should not validate additional sections');
    });

    const multiSectionRequest = {
      ...baseRequest,
      sections: [
        {
          ...baseRequest.sections[0]!,
          qualityGateReport: {
            status: 'fail' as const,
            issues: [failingIssue],
          },
        },
        {
          ...baseRequest.sections[0]!,
          sectionPath: 'deployment-strategy',
          draftKey: 'project-test/doc-architecture-demo/Deployment Strategy/user-author',
          qualityGateReport: { status: 'pass' as const, issues: [] },
        },
      ],
    };

    await expect(service.applyBundle(multiSectionRequest)).rejects.toBeInstanceOf(
      DraftBundleValidationError
    );

    expect(draftRepo.getSectionSnapshot).toHaveBeenCalledTimes(1);
    expect(draftRepo.validateBaseline).not.toHaveBeenCalled();
    expect(draftRepo.applyBundleSectionsAtomically).not.toHaveBeenCalled();
    expect(draftRepo.retireDraft).not.toHaveBeenCalled();
    expect(audit.recordBundleApplied).not.toHaveBeenCalled();
    expect(audit.recordBundleRejected).toHaveBeenCalledWith(
      expect.objectContaining({
        conflicts: [
          expect.objectContaining({
            sectionPath: 'architecture-overview',
            message: failingIssue.message,
          }),
        ],
      })
    );
    expect(telemetry.emitBundleFailure).toHaveBeenCalledWith(
      expect.objectContaining({ reason: 'quality-gate-failed' })
    );
  });

  test('runs bundle application inside atomic repository transaction when section mutation fails', async () => {
    const conflictError = new DraftBundleValidationError([
      {
        sectionPath: 'deployment-strategy',
        message: 'Patch could not be applied',
      },
    ]);

    const multiSectionRequest = {
      ...baseRequest,
      sections: [
        baseRequest.sections[0]!,
        {
          ...baseRequest.sections[0]!,
          sectionPath: 'deployment-strategy',
          draftKey: 'project-test/doc-architecture-demo/Deployment Strategy/user-author',
        },
      ],
    };

    const applyBundleSpy = draftRepo.applyBundleSectionsAtomically as Mock;
    applyBundleSpy.mockImplementationOnce(async () => {
      throw conflictError;
    });

    await expect(service.applyBundle(multiSectionRequest)).rejects.toBeInstanceOf(
      DraftBundleValidationError
    );

    expect(draftRepo.applyBundleSectionsAtomically).toHaveBeenCalledWith(
      multiSectionRequest.sections,
      expect.objectContaining({
        documentId: multiSectionRequest.documentId,
        projectSlug: multiSectionRequest.projectSlug,
        authorId: multiSectionRequest.submittedBy,
      })
    );
    expect(draftRepo.applySectionPatch).not.toHaveBeenCalled();
    expect(draftRepo.retireDraft).not.toHaveBeenCalled();
    expect(audit.recordBundleApplied).not.toHaveBeenCalled();
    expect(audit.recordBundleRejected).toHaveBeenCalledWith(
      expect.objectContaining({ conflicts: conflictError.conflicts })
    );
  });

  test('surfaces server snapshot metadata when repository raises version conflicts', async () => {
    const conflictError = new DraftBundleValidationError([
      {
        sectionPath: 'architecture-overview',
        message: 'Baseline mismatch',
        serverVersion: 8,
        serverContent: '## Server content v8',
      },
    ]);

    draftRepo.validateBaseline = vi.fn().mockRejectedValue(conflictError);

    await expect(service.applyBundle(baseRequest)).rejects.toBeInstanceOf(
      DraftBundleValidationError
    );

    expect(audit.recordBundleRejected).toHaveBeenCalledWith(
      expect.objectContaining({
        conflicts: [
          expect.objectContaining({
            sectionPath: 'architecture-overview',
            serverVersion: 8,
            serverContent: '## Server content v8',
          }),
        ],
      })
    );
  });
});

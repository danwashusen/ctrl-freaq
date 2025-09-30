import { beforeEach, describe, expect, test, vi } from 'vitest';

import {
  DraftBundleService,
  DraftBundleValidationError,
  type DraftBundleAuditLogger,
  type DraftBundleRepository,
  type DraftConflictTelemetry,
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
      retireDraft: vi.fn().mockResolvedValue(undefined),
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
    expect(draftRepo.applySectionPatch).toHaveBeenCalledWith(
      expect.objectContaining({
        documentId: baseRequest.documentId,
        projectSlug: baseRequest.projectSlug,
        sectionPath: 'architecture-overview',
        patch: '## Updated architecture overview content',
        baselineVersion: 'rev-6',
        authorId: baseRequest.submittedBy,
      })
    );
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
          }),
        ],
      })
    );
    expect(draftRepo.applySectionPatch).not.toHaveBeenCalled();
    expect(telemetry.emitBundleFailure).toHaveBeenCalled();
  });
});

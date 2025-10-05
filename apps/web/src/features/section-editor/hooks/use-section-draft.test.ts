import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, vi } from 'vitest';
import type { ProjectRetentionPolicy } from '@/features/document-editor/services/project-retention';

import { SectionEditorClientError, SectionEditorConflictError } from '../api/section-editor.client';
import { logger } from '@/lib/logger';
import type {
  ConflictCheckResponseDTO,
  SectionDraftResponseDTO,
} from '../api/section-editor.mappers';
import { useSectionDraft } from './use-section-draft';
import { useSectionDraftStore } from '../stores/section-draft-store';

const applyDraftBundleMock = vi.fn();

const fetchProjectRetentionPolicyMock = vi.hoisted(() =>
  vi.fn(async (_projectSlug: string): Promise<ProjectRetentionPolicy | null> => null)
);

vi.mock('@/features/document-editor/services/project-retention', () => ({
  fetchProjectRetentionPolicy: fetchProjectRetentionPolicyMock,
}));

vi.mock('@/features/document-editor/services/draft-client', () => ({
  DraftPersistenceClient: vi.fn().mockImplementation(() => ({
    applyDraftBundle: applyDraftBundleMock,
    logComplianceWarning: vi.fn(),
  })),
}));

const createDraftStoreMock = () => ({
  saveDraft: vi.fn().mockResolvedValue({
    record: {
      draftKey: 'demo-project/doc-1/Section Title/user-1',
      projectSlug: 'demo-project',
      documentSlug: 'doc-1',
      sectionTitle: 'Section Title',
      sectionPath: 'section-1',
      authorId: 'user-1',
      baselineVersion: 'rev-1',
      patch: '[]',
      status: 'draft',
      lastEditedAt: new Date('2025-09-30T12:00:00.000Z'),
      updatedAt: new Date('2025-09-30T12:00:00.000Z'),
      complianceWarning: false,
    },
    prunedDraftKeys: [],
  }),
  rehydrateDocumentState: vi.fn(),
  listDrafts: vi.fn(),
  clearAuthorDrafts: vi.fn(),
  removeDraft: vi.fn().mockResolvedValue(undefined),
});

let draftStoreMock = createDraftStoreMock();

vi.mock('@ctrl-freaq/editor-persistence', async () => {
  const actual = await vi.importActual<typeof import('@ctrl-freaq/editor-persistence')>(
    '@ctrl-freaq/editor-persistence'
  );

  return {
    ...actual,
    createDraftStore: vi.fn(() => draftStoreMock),
  };
});

vi.mock('@ctrl-freaq/editor-core', () => ({
  createPatchEngine: () => ({
    createPatch: (_baseline: string, modified: string) => [
      { op: 'replace', path: '/content', value: modified },
    ],
  }),
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

const withMockedCrypto = () => {
  const originalCrypto = globalThis.crypto;

  if (!originalCrypto || typeof originalCrypto.randomUUID !== 'function') {
    globalThis.crypto = {
      randomUUID: vi.fn().mockReturnValue('00000000-0000-4000-8000-000000000000'),
    } as unknown as Crypto;
  } else {
    vi.spyOn(originalCrypto, 'randomUUID').mockReturnValue('00000000-0000-4000-8000-000000000000');
  }
};

const createManualDraftStorageMock = () => ({
  saveDraft: vi.fn().mockResolvedValue(undefined),
  loadDraft: vi.fn().mockResolvedValue(null),
  deleteDraft: vi.fn().mockResolvedValue(undefined),
});

describe('useSectionDraft', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    draftStoreMock = createDraftStoreMock();
    useSectionDraftStore.getState().reset();
    withMockedCrypto();
    applyDraftBundleMock.mockReset();
    applyDraftBundleMock.mockResolvedValue({
      documentId: 'doc-1',
      appliedSections: ['section-1'],
    });
    fetchProjectRetentionPolicyMock.mockResolvedValue(null);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
    useSectionDraftStore.getState().reset();
  });

  it('marks drafts with compliance warnings when retention policy is active', async () => {
    fetchProjectRetentionPolicyMock.mockResolvedValueOnce({
      policyId: 'retention-client-only',
      retentionWindow: '30d',
      guidance: 'Client-only drafts must be reviewed or escalated.',
    });

    const { result } = renderHook(() =>
      useSectionDraft({
        api: {
          saveDraft: vi.fn().mockResolvedValue({
            draftId: 'draft-1',
            sectionId: 'section-1',
            draftVersion: 1,
            conflictState: 'clean',
            formattingAnnotations: [],
            savedAt: '2025-09-30T12:00:00.000Z',
            savedBy: 'user-1',
          }),
        },
        sectionId: 'section-1',
        initialContent: '# Intro',
        approvedVersion: 1,
        documentId: 'doc-1',
        userId: 'user-1',
        projectSlug: 'demo-project',
        documentSlug: 'doc-1',
        sectionTitle: 'Section Title',
        sectionPath: 'section-1',
        loadPersistedDraft: false,
        autoStartDiffPolling: false,
      })
    );

    await act(async () => {
      await Promise.resolve();
    });

    act(() => {
      result.current.updateDraft('# Intro\nUpdated content');
    });

    act(() => {
      vi.advanceTimersByTime(800);
    });

    await Promise.resolve();

    expect(draftStoreMock.saveDraft).toHaveBeenCalledWith(
      expect.objectContaining({ complianceWarning: true })
    );
  });

  it('reflags existing drafts when retention policy resolves after an initial save', async () => {
    let resolvePolicy: (policy: ProjectRetentionPolicy) => void = () => {};
    fetchProjectRetentionPolicyMock.mockImplementation(
      () =>
        new Promise<ProjectRetentionPolicy>(resolve => {
          resolvePolicy = resolve;
        })
    );

    const dispatchSpy = vi.spyOn(window, 'dispatchEvent');

    const { result } = renderHook(() =>
      useSectionDraft({
        api: {
          saveDraft: vi.fn().mockResolvedValue({
            draftId: 'draft-1',
            sectionId: 'section-1',
            draftVersion: 1,
            conflictState: 'clean',
            formattingAnnotations: [],
            savedAt: '2025-09-30T12:00:00.000Z',
            savedBy: 'user-1',
          }),
        },
        sectionId: 'section-1',
        initialContent: '# Intro',
        approvedVersion: 1,
        documentId: 'doc-1',
        userId: 'user-1',
        projectSlug: 'demo-project',
        documentSlug: 'doc-1',
        sectionTitle: 'Section Title',
        sectionPath: 'section-1',
        loadPersistedDraft: false,
        autoStartDiffPolling: false,
      })
    );

    await act(async () => {
      await Promise.resolve();
    });

    act(() => {
      result.current.updateDraft('# Intro\nUpdated content');
    });

    act(() => {
      vi.advanceTimersByTime(800);
    });

    await Promise.resolve();

    expect(draftStoreMock.saveDraft).toHaveBeenCalledWith(
      expect.objectContaining({ complianceWarning: false })
    );
    const initialSaveCalls = draftStoreMock.saveDraft.mock.calls.length;

    await act(async () => {
      resolvePolicy({
        policyId: 'retention-client-only',
        retentionWindow: '30d',
        guidance: 'Client-only drafts must be reviewed or escalated.',
      });
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(logger.debug).toHaveBeenCalledWith(
      'Reflagging persisted draft for compliance after retention policy load',
      expect.objectContaining({
        projectSlug: 'demo-project',
        documentSlug: 'doc-1',
        sectionId: 'section-1',
      })
    );
    expect(draftStoreMock.saveDraft.mock.calls.length).toBe(initialSaveCalls + 1);
    const latestSaveCall =
      draftStoreMock.saveDraft.mock.calls[draftStoreMock.saveDraft.mock.calls.length - 1];
    const latestCallInput = latestSaveCall?.[0];
    expect(latestCallInput?.complianceWarning).toBe(true);
    expect(dispatchSpy.mock.calls.some(([event]) => event?.type === 'draft-storage:updated')).toBe(
      true
    );

    dispatchSpy.mockRestore();
  });

  it('persists manual saves and updates formatting warnings', async () => {
    const saveDraftResponse: SectionDraftResponseDTO = {
      draftId: 'draft-123',
      sectionId: 'section-1',
      draftVersion: 1,
      conflictState: 'clean',
      formattingAnnotations: [
        {
          id: 'ann-1',
          startOffset: 0,
          endOffset: 5,
          markType: 'unsupported-color',
          message: 'Custom colors are not allowed',
          severity: 'warning',
        },
      ],
      savedAt: '2025-09-25T10:00:00.000Z',
      savedBy: 'user-1',
      summaryNote: 'Updated summary',
    };

    const api = {
      saveDraft: vi.fn().mockResolvedValue(saveDraftResponse),
    };
    const storage = createManualDraftStorageMock();

    const { result } = renderHook(() =>
      useSectionDraft({
        api,
        sectionId: 'section-1',
        initialContent: '# Intro',
        approvedVersion: 5,
        documentId: 'doc-1',
        userId: 'user-1',
        projectSlug: 'demo-project',
        documentSlug: 'doc-1',
        sectionTitle: 'Section Title',
        sectionPath: 'section-1',
        storage,
        loadPersistedDraft: false,
        autoStartDiffPolling: false,
      })
    );

    act(() => {
      result.current.updateDraft('# Intro\nNew content');
      result.current.setSummary('Updated summary');
    });

    act(() => {
      vi.advanceTimersByTime(800);
    });

    let manualSaveResult: SectionDraftResponseDTO | null | ConflictCheckResponseDTO = null;
    await act(async () => {
      manualSaveResult = await result.current.manualSave();
    });

    expect(api.saveDraft).toHaveBeenCalledWith(
      expect.objectContaining({
        sectionId: 'section-1',
        draftVersion: 1,
        draftBaseVersion: 5,
        summaryNote: 'Updated summary',
      })
    );

    expect(storage.saveDraft).not.toHaveBeenCalled();
    expect(storage.deleteDraft).toHaveBeenCalledWith('doc-1', 'section-1', 'user-1');

    expect(manualSaveResult).toEqual(saveDraftResponse);
    expect(result.current.state.formattingWarnings).toHaveLength(1);
    expect(result.current.state.summaryNote).toBe('Updated summary');
    expect(result.current.state.conflictState).toBe('clean');

    expect(applyDraftBundleMock).toHaveBeenCalledWith(
      'demo-project',
      'doc-1',
      expect.objectContaining({
        submittedBy: 'user-1',
        sections: [
          expect.objectContaining({
            draftKey: 'demo-project/doc-1/Section Title/user-1',
            sectionPath: 'section-1',
            baselineVersion: 'rev-5',
            patch: expect.stringContaining('# Intro\\nNew content'),
            qualityGateReport: {
              status: 'pass',
              issues: [],
            },
          }),
        ],
      })
    );
  });

  it('marks manual save bundles with compliance warnings once retention policy resolves', async () => {
    let resolvePolicy: (policy: ProjectRetentionPolicy) => void = () => {};
    fetchProjectRetentionPolicyMock.mockImplementation(
      () =>
        new Promise<ProjectRetentionPolicy>(resolve => {
          resolvePolicy = resolve;
        })
    );

    const api = {
      saveDraft: vi.fn().mockResolvedValue({
        draftId: 'draft-123',
        sectionId: 'section-1',
        draftVersion: 1,
        conflictState: 'clean',
        formattingAnnotations: [],
        savedAt: '2025-09-25T10:00:00.000Z',
        savedBy: 'user-1',
        summaryNote: null,
      } satisfies SectionDraftResponseDTO),
    };
    const storage = createManualDraftStorageMock();

    const { result } = renderHook(() =>
      useSectionDraft({
        api,
        sectionId: 'section-1',
        initialContent: '# Intro',
        approvedVersion: 5,
        documentId: 'doc-1',
        userId: 'user-1',
        projectSlug: 'demo-project',
        documentSlug: 'doc-1',
        sectionTitle: 'Section Title',
        sectionPath: 'section-1',
        storage,
        loadPersistedDraft: false,
        autoStartDiffPolling: false,
      })
    );

    act(() => {
      result.current.updateDraft('# Intro\nCompliance update');
    });

    act(() => {
      vi.advanceTimersByTime(800);
    });

    await act(async () => {
      resolvePolicy({
        policyId: 'retention-client-only',
        retentionWindow: '30d',
        guidance: 'Client-only drafts must be reviewed or escalated.',
      });

      await Promise.resolve();
      await Promise.resolve();
    });

    applyDraftBundleMock.mockClear();

    await act(async () => {
      await result.current.manualSave();
    });

    expect(applyDraftBundleMock).toHaveBeenCalledTimes(1);
    const latestCall = applyDraftBundleMock.mock.calls[0];
    const payload = latestCall?.[2];
    const firstSection = payload?.sections?.[0];

    expect(firstSection?.qualityGateReport.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ gateId: 'draft.compliance', severity: 'warning' }),
      ])
    );
  });

  it('removes DraftStore entries after a bundled save succeeds', async () => {
    const successfulResponse: SectionDraftResponseDTO = {
      draftId: 'draft-success',
      sectionId: 'section-1',
      draftVersion: 2,
      conflictState: 'clean',
      formattingAnnotations: [],
      savedAt: '2025-09-25T12:00:00.000Z',
      savedBy: 'user-1',
      summaryNote: null,
    };
    const api = {
      saveDraft: vi.fn().mockResolvedValue(successfulResponse),
    };
    const storage = createManualDraftStorageMock();
    draftStoreMock.listDrafts.mockResolvedValue([
      {
        draftKey: 'demo-project/doc-1/Section Title/user-1',
        projectSlug: 'demo-project',
        documentSlug: 'doc-1',
        sectionTitle: 'Section Title',
        sectionPath: 'section-1',
        authorId: 'user-1',
        baselineVersion: 'rev-1',
        patch: '[]',
        status: 'draft',
        lastEditedAt: new Date('2025-09-25T12:00:00.000Z'),
        updatedAt: new Date('2025-09-25T12:00:00.000Z'),
        complianceWarning: false,
      },
    ]);

    const { result } = renderHook(() =>
      useSectionDraft({
        api,
        sectionId: 'section-1',
        initialContent: '# Intro',
        approvedVersion: 5,
        documentId: 'doc-1',
        userId: 'user-1',
        projectSlug: 'demo-project',
        documentSlug: 'doc-1',
        sectionTitle: 'Section Title',
        sectionPath: 'section-1',
        storage,
        loadPersistedDraft: false,
        autoStartDiffPolling: false,
      })
    );

    act(() => {
      result.current.updateDraft('# Intro\nSaved content');
    });

    await act(async () => {
      await result.current.manualSave();
    });

    expect(api.saveDraft).toHaveBeenCalled();
    expect(draftStoreMock.removeDraft).toHaveBeenCalledWith(
      'demo-project/doc-1/Section Title/user-1'
    );
    expect(draftStoreMock.clearAuthorDrafts).not.toHaveBeenCalled();
  });

  it('surfaces guidance when bundled draft request fails', async () => {
    const successfulResponse: SectionDraftResponseDTO = {
      draftId: 'draft-success',
      sectionId: 'section-1',
      draftVersion: 2,
      conflictState: 'clean',
      formattingAnnotations: [],
      savedAt: '2025-09-25T12:00:00.000Z',
      savedBy: 'user-1',
      summaryNote: null,
    };
    const api = {
      saveDraft: vi.fn().mockResolvedValue(successfulResponse),
    };
    const storage = createManualDraftStorageMock();
    applyDraftBundleMock.mockRejectedValueOnce(new Error('bundle failed'));

    const { result } = renderHook(() =>
      useSectionDraft({
        api,
        sectionId: 'section-1',
        initialContent: '# Intro',
        approvedVersion: 5,
        documentId: 'doc-1',
        userId: 'user-1',
        projectSlug: 'demo-project',
        documentSlug: 'doc-1',
        sectionTitle: 'Section Title',
        sectionPath: 'section-1',
        storage,
        loadPersistedDraft: false,
        autoStartDiffPolling: false,
      })
    );

    act(() => {
      result.current.updateDraft('# Intro\nSaved content');
    });

    let capturedError: unknown;
    await act(async () => {
      try {
        await result.current.manualSave();
      } catch (error) {
        capturedError = error;
      }
    });

    expect(capturedError).toBeInstanceOf(SectionEditorClientError);
    expect((capturedError as SectionEditorClientError).message).toMatch(/bundled save failed/i);
    expect(draftStoreMock.removeDraft).not.toHaveBeenCalled();
    expect(draftStoreMock.clearAuthorDrafts).not.toHaveBeenCalled();
    expect(storage.saveDraft).toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalledWith(
      'Bundled save rejected; drafts retained locally',
      expect.objectContaining({
        sectionId: 'section-1',
        projectSlug: 'demo-project',
        documentId: 'doc-1',
        reason: 'bundle failed',
      })
    );

    const storeSnapshot = useSectionDraftStore.getState();
    expect(storeSnapshot.saveError).toBeInstanceOf(SectionEditorClientError);
  });

  it('bundles every pending section draft when manual save runs', async () => {
    const successfulResponse: SectionDraftResponseDTO = {
      draftId: 'draft-success',
      sectionId: 'section-1',
      draftVersion: 2,
      conflictState: 'clean',
      formattingAnnotations: [],
      savedAt: '2025-09-25T12:00:00.000Z',
      savedBy: 'user-1',
      summaryNote: null,
    };

    const api = {
      saveDraft: vi.fn().mockResolvedValue(successfulResponse),
    };

    applyDraftBundleMock.mockResolvedValueOnce({
      documentId: 'doc-1',
      appliedSections: ['section-1', 'section-2', 'section-3'],
    });

    draftStoreMock.listDrafts.mockResolvedValue([]);
    draftStoreMock.listDrafts.mockResolvedValueOnce([
      {
        draftKey: 'demo-project/doc-1/Section Two/user-1',
        projectSlug: 'demo-project',
        documentSlug: 'doc-1',
        sectionTitle: 'Section Two',
        sectionPath: 'section-2',
        authorId: 'user-1',
        baselineVersion: 'rev-3',
        patch: '[{"op":"replace","path":"/content","value":"Section two draft"}]',
        status: 'draft',
        lastEditedAt: new Date('2025-09-25T12:00:00.000Z'),
        updatedAt: new Date('2025-09-25T12:00:01.000Z'),
        complianceWarning: false,
      },
      {
        draftKey: 'demo-project/doc-1/Section Three/user-1',
        projectSlug: 'demo-project',
        documentSlug: 'doc-1',
        sectionTitle: 'Section Three',
        sectionPath: 'section-3',
        authorId: 'user-1',
        baselineVersion: 'rev-4',
        patch: '[{"op":"replace","path":"/content","value":"Section three draft"}]',
        status: 'conflict',
        lastEditedAt: new Date('2025-09-25T12:00:02.000Z'),
        updatedAt: new Date('2025-09-25T12:00:03.000Z'),
        complianceWarning: true,
      },
    ]);

    const storage = createManualDraftStorageMock();

    const { result } = renderHook(() =>
      useSectionDraft({
        api,
        sectionId: 'section-1',
        initialContent: '# Intro',
        approvedVersion: 5,
        documentId: 'doc-1',
        userId: 'user-1',
        projectSlug: 'demo-project',
        documentSlug: 'doc-1',
        sectionTitle: 'Section One',
        sectionPath: 'section-1',
        storage,
        loadPersistedDraft: false,
        autoStartDiffPolling: false,
      })
    );

    act(() => {
      result.current.updateDraft('# Intro\nUpdated content');
    });

    await act(async () => {
      await result.current.manualSave();
    });

    expect(applyDraftBundleMock).toHaveBeenCalledWith(
      'demo-project',
      'doc-1',
      expect.objectContaining({
        submittedBy: 'user-1',
        sections: expect.arrayContaining([
          expect.objectContaining({
            sectionPath: 'section-1',
            draftKey: 'demo-project/doc-1/Section One/user-1',
            qualityGateReport: expect.objectContaining({ status: 'pass' }),
          }),
          expect.objectContaining({
            sectionPath: 'section-2',
            draftKey: 'demo-project/doc-1/Section Two/user-1',
            patch: expect.stringContaining('Section two draft'),
            qualityGateReport: expect.objectContaining({ status: 'pass' }),
          }),
          expect.objectContaining({
            sectionPath: 'section-3',
            draftKey: 'demo-project/doc-1/Section Three/user-1',
            qualityGateReport: expect.objectContaining({
              status: 'fail',
              issues: expect.arrayContaining([
                expect.objectContaining({
                  gateId: 'draft.conflict',
                  severity: 'blocker',
                }),
                expect.objectContaining({
                  gateId: 'draft.compliance',
                  severity: 'warning',
                }),
              ]),
            }),
          }),
        ]),
      })
    );
  });

  it('refreshes draft base version after successful bundled save', async () => {
    const successfulResponse: SectionDraftResponseDTO = {
      draftId: 'draft-success',
      sectionId: 'section-1',
      draftVersion: 6,
      conflictState: 'clean',
      formattingAnnotations: [],
      savedAt: '2025-09-25T12:00:00.000Z',
      savedBy: 'user-1',
      summaryNote: null,
    };

    const api = {
      saveDraft: vi.fn().mockResolvedValue(successfulResponse),
    };

    draftStoreMock.listDrafts.mockResolvedValue([]);

    const storage = createManualDraftStorageMock();

    const { result } = renderHook(() =>
      useSectionDraft({
        api,
        sectionId: 'section-1',
        initialContent: '# Intro',
        approvedVersion: 5,
        documentId: 'doc-1',
        userId: 'user-1',
        projectSlug: 'demo-project',
        documentSlug: 'doc-1',
        sectionTitle: 'Section One',
        sectionPath: 'section-1',
        storage,
        loadPersistedDraft: false,
        autoStartDiffPolling: false,
      })
    );

    act(() => {
      result.current.updateDraft('# Intro\nInitial change');
    });

    await act(async () => {
      await result.current.manualSave();
    });

    const storeSnapshotAfterFirstSave = useSectionDraftStore.getState();
    expect(storeSnapshotAfterFirstSave.draftBaseVersion).toBe(6);

    act(() => {
      result.current.updateDraft('# Intro\nSecond change');
    });

    api.saveDraft.mockResolvedValueOnce({
      draftId: 'draft-success-2',
      sectionId: 'section-1',
      draftVersion: 7,
      conflictState: 'clean',
      formattingAnnotations: [],
      savedAt: '2025-09-25T12:05:00.000Z',
      savedBy: 'user-1',
      summaryNote: null,
    });

    await act(async () => {
      await result.current.manualSave();
    });

    const saveDraftCalls = api.saveDraft.mock.calls;
    expect(saveDraftCalls[1]?.[0]?.draftBaseVersion).toBe(6);
  });

  it('applies conflict responses when manual save detects a version mismatch', async () => {
    const conflictResponse: ConflictCheckResponseDTO = {
      status: 'rebase_required',
      latestApprovedVersion: 7,
      conflictReason: 'Draft base version 5 is behind approved version 7',
      rebasedDraft: {
        draftVersion: 3,
        contentMarkdown: '# Intro\nRebased content',
        formattingAnnotations: [],
      },
      events: [],
    };

    const api = {
      saveDraft: vi
        .fn()
        .mockRejectedValue(new SectionEditorConflictError(conflictResponse, 'req-1')),
    };
    const storage = createManualDraftStorageMock();

    const { result } = renderHook(() =>
      useSectionDraft({
        api,
        sectionId: 'section-1',
        initialContent: '# Intro',
        approvedVersion: 5,
        documentId: 'doc-1',
        userId: 'user-1',
        projectSlug: 'demo-project',
        documentSlug: 'doc-1',
        sectionTitle: 'Section Title',
        sectionPath: 'section-1',
        storage,
        loadPersistedDraft: false,
        autoStartDiffPolling: false,
      })
    );

    let manualSaveResult: SectionDraftResponseDTO | null | ConflictCheckResponseDTO = null;
    await act(async () => {
      manualSaveResult = await result.current.manualSave();
    });

    expect(manualSaveResult).toEqual(conflictResponse);
    expect(result.current.state.conflictState).toBe('rebase_required');
    expect(result.current.state.content).toBe('# Intro\nRebased content');
    expect(storage.saveDraft).toHaveBeenCalledWith(
      expect.objectContaining({
        conflictState: 'rebase_required',
        draftBaseVersion: 7,
        contentMarkdown: '# Intro\nRebased content',
      })
    );

    expect(draftStoreMock.saveDraft).toHaveBeenCalled();
  });
});

import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, vi } from 'vitest';

import { SectionEditorConflictError } from '../api/section-editor.client';
import { logger } from '@/lib/logger';
import type {
  ConflictCheckResponseDTO,
  SectionDraftResponseDTO,
} from '../api/section-editor.mappers';
import { useSectionDraft } from './use-section-draft';
import { useSectionDraftStore } from '../stores/section-draft-store';

const applyDraftBundleMock = vi.fn();

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
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
    useSectionDraftStore.getState().reset();
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

  it('continues manual save when bundled draft request fails', async () => {
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

    let manualSaveResult: SectionDraftResponseDTO | null = null;
    await act(async () => {
      manualSaveResult = (await result.current.manualSave()) as SectionDraftResponseDTO | null;
    });

    expect(manualSaveResult).toEqual(successfulResponse);
    expect(draftStoreMock.removeDraft).toHaveBeenCalledWith(
      'demo-project/doc-1/Section Title/user-1'
    );
    expect(draftStoreMock.clearAuthorDrafts).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalledWith(
      'Continuing after bundled save failure; manual draft persisted locally',
      expect.objectContaining({
        sectionId: 'section-1',
        projectSlug: 'demo-project',
        documentId: 'doc-1',
        reason: 'bundle failed',
      })
    );
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

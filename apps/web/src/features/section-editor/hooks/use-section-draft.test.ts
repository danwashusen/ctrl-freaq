import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, vi } from 'vitest';

import { SectionEditorConflictError } from '../api/section-editor.client';
import type {
  ConflictCheckResponseDTO,
  SectionDraftResponseDTO,
} from '../api/section-editor.mappers';
import { useSectionDraft } from './use-section-draft';
import { useSectionDraftStore } from '../stores/section-draft-store';

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
    useSectionDraftStore.getState().reset();
    withMockedCrypto();
  });

  afterEach(() => {
    vi.restoreAllMocks();
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
        storage,
        loadPersistedDraft: false,
        autoStartDiffPolling: false,
      })
    );

    act(() => {
      result.current.updateDraft('# Intro\nNew content');
      result.current.setSummary('Updated summary');
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

    expect(storage.saveDraft).toHaveBeenCalledWith(
      expect.objectContaining({
        draftId: 'draft-123',
        contentMarkdown: '# Intro\nNew content',
        conflictState: 'clean',
      })
    );

    expect(manualSaveResult).toEqual(saveDraftResponse);
    expect(result.current.state.formattingWarnings).toHaveLength(1);
    expect(result.current.state.summaryNote).toBe('Updated summary');
    expect(result.current.state.conflictState).toBe('clean');
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
  });
});

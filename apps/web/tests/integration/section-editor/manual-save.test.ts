import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';

import { useSectionDraft } from '@/features/section-editor/hooks/use-section-draft';

describe('useSectionDraft manual save workflow', () => {
  it('persists manual drafts and surfaces formatting warnings', async () => {
    const saveDraft = vi.fn().mockResolvedValue({
      sectionId: 'sec-1',
      draftId: 'draft-1',
      documentId: 'doc-1',
      draftVersion: 2,
      draftBaseVersion: 4,
      conflictState: 'clean',
      summaryNote: 'Clarified scope statement.',
      formattingAnnotations: [
        {
          id: 'ann-1',
          startOffset: 10,
          endOffset: 24,
          markType: 'unsupported-color',
          message: 'Custom colors are not allowed',
          severity: 'warning',
        },
      ],
      savedAt: new Date().toISOString(),
      savedBy: 'user-123',
    });

    const { result } = renderHook(() =>
      useSectionDraft({
        api: { saveDraft },
        sectionId: 'sec-1',
        initialContent: '## Scope',
        approvedVersion: 4,
      })
    );

    act(() => {
      result.current.updateDraft('# Scope\n<font color="red">Alert</font>');
      result.current.setSummary('Clarified scope statement.');
    });

    await act(async () => {
      await result.current.manualSave();
    });

    expect(saveDraft).toHaveBeenCalledWith(
      expect.objectContaining({
        sectionId: 'sec-1',
        draftBaseVersion: 4,
        summaryNote: 'Clarified scope statement.',
      })
    );
    expect(result.current.state.conflictState).toBe('clean');
    expect(result.current.state.formattingWarnings).toHaveLength(1);
  });

  it('flags conflict state when persistence returns rebase_required', async () => {
    const saveDraft = vi.fn().mockResolvedValue({
      sectionId: 'sec-1',
      draftId: 'draft-1',
      documentId: 'doc-1',
      draftVersion: 3,
      draftBaseVersion: 4,
      conflictState: 'rebase_required',
      summaryNote: 'Needs rebase.',
      formattingAnnotations: [],
      savedAt: new Date().toISOString(),
      savedBy: 'user-123',
    });

    const { result } = renderHook(() =>
      useSectionDraft({
        api: { saveDraft },
        sectionId: 'sec-1',
        initialContent: '## Scope',
        approvedVersion: 4,
      })
    );

    await act(async () => {
      await result.current.manualSave();
    });

    expect(result.current.state.conflictState).toBe('rebase_required');
  });
});

import { beforeEach, describe, it, expect, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

import { useSectionDraft } from '@/features/section-editor/hooks/use-section-draft';
import { useSectionDraftStore } from '@/features/section-editor/stores/section-draft-store';
import type { DraftPersistenceClient } from '@/features/document-editor/services/draft-client';

describe('useSectionDraft manual save workflow', () => {
  beforeEach(() => {
    useSectionDraftStore.getState().reset();
  });

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
    const draftClient = {
      applyDraftBundle: vi.fn().mockResolvedValue({
        documentId: 'doc-1',
        appliedSections: ['sec-1'],
      }),
      logComplianceWarning: vi.fn(),
    } as unknown as DraftPersistenceClient;

    const { result } = renderHook(() =>
      useSectionDraft({
        api: { saveDraft },
        sectionId: 'sec-1',
        initialContent: '## Scope',
        approvedVersion: 4,
        documentId: 'doc-1',
        userId: 'user-123',
        projectSlug: 'project-1',
        documentSlug: 'doc-1',
        sectionTitle: 'Scope',
        sectionPath: 'scope',
        draftClient,
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
    expect((draftClient as any).applyDraftBundle).toHaveBeenCalledWith(
      'project-1',
      'doc-1',
      expect.objectContaining({
        submittedBy: 'user-123',
        sections: expect.arrayContaining([
          expect.objectContaining({
            sectionPath: 'scope',
            baselineVersion: 'rev-4',
          }),
        ]),
      })
    );
    expect(result.current.state.conflictState).toBe('clean');
    expect(result.current.state.formattingWarnings).toHaveLength(1);
  });

  it('captures upstream rebase_required responses while keeping local state clean', async () => {
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
    const draftClient = {
      applyDraftBundle: vi.fn().mockResolvedValue({
        documentId: 'doc-1',
        appliedSections: [],
      }),
      logComplianceWarning: vi.fn(),
    } as unknown as DraftPersistenceClient;

    const { result } = renderHook(() =>
      useSectionDraft({
        api: { saveDraft },
        sectionId: 'sec-1',
        initialContent: '## Scope',
        approvedVersion: 4,
        documentId: 'doc-1',
        userId: 'user-123',
        projectSlug: 'project-1',
        documentSlug: 'doc-1',
        sectionTitle: 'Scope',
        sectionPath: 'scope',
        draftClient,
      })
    );

    await act(async () => {
      await result.current.manualSave();
    });

    const savedResponse = await saveDraft.mock.results[0]?.value;
    expect(savedResponse?.conflictState).toBe('rebase_required');

    await waitFor(() => {
      expect(savedResponse?.conflictState).toBe('rebase_required');
      expect((draftClient as any).applyDraftBundle).toHaveBeenCalled();
      expect(useSectionDraftStore.getState().conflictState).toBe('clean');
      expect(result.current.state.conflictState).toBe('clean');
    });
  });
});

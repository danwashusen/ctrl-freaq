import { afterEach, beforeAll, beforeEach, describe, it, expect, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

import type { ManualDraftStorage } from '@ctrl-freaq/editor-persistence';

import { useSectionDraft } from '@/features/section-editor/hooks/use-section-draft';
import { useSectionDraftStore } from '@/features/section-editor/stores/section-draft-store';
import { SectionEditorClientError } from '@/features/section-editor/api/section-editor.client';
import type { DraftPersistenceClient } from '@/features/document-editor/services/draft-client';
import type { EventHub, HubHealthState } from '@/lib/streaming/event-hub';

const createMockDraftStore = () => ({
  saveDraft: vi.fn().mockResolvedValue({
    record: {
      draftKey: 'project-1/doc-1/Scope/user-123',
      projectSlug: 'project-1',
      documentSlug: 'doc-1',
      sectionTitle: 'Scope',
      sectionPath: 'scope',
      authorId: 'user-123',
      baselineVersion: 'rev-4',
      patch: 'diff --git a b',
      status: 'draft' as const,
      lastEditedAt: new Date(),
      updatedAt: new Date(),
    },
    prunedDraftKeys: [],
  }),
  removeDraft: vi.fn().mockResolvedValue(undefined),
  clearAuthorDrafts: vi.fn().mockResolvedValue(undefined),
});

let mockDraftStore = createMockDraftStore();

vi.mock('@ctrl-freaq/editor-persistence', async () => {
  const actual = await vi.importActual<typeof import('@ctrl-freaq/editor-persistence')>(
    '@ctrl-freaq/editor-persistence'
  );

  return {
    ...actual,
    createDraftStore: vi.fn(() => mockDraftStore),
  };
});

let apiContextModule: typeof import('@/lib/api-context');
let useApiSpy: ReturnType<typeof vi.spyOn> | null = null;

beforeAll(async () => {
  apiContextModule = await import('@/lib/api-context');
});

afterEach(() => {
  useApiSpy?.mockRestore();
  useApiSpy = null;
});

describe('useSectionDraft manual save workflow', () => {
  beforeEach(() => {
    const noop = () => {};
    const mockHealth: HubHealthState = {
      status: 'healthy',
      lastEventAt: null,
      lastHeartbeatAt: null,
      retryAttempt: 0,
      fallbackActive: false,
    };
    const mockEventHub: EventHub = {
      subscribe: vi.fn(() => noop),
      onHealthChange: vi.fn(() => noop),
      onFallbackChange: vi.fn(() => noop),
      getHealthState: vi.fn(() => mockHealth),
      isEnabled: vi.fn(() => false),
      setEnabled: vi.fn(),
      forceReconnect: vi.fn(),
      shutdown: vi.fn(),
    };

    useApiSpy = vi.spyOn(apiContextModule, 'useApi').mockReturnValue({
      projects: {
        getAll: vi.fn(),
        getById: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
        archive: vi.fn(),
        restore: vi.fn(),
      },
      configuration: {
        get: vi.fn(),
        update: vi.fn(),
      },
      health: {
        check: vi.fn(),
      },
      client: {} as never,
      eventHub: mockEventHub,
      eventHubHealth: mockHealth,
      eventHubEnabled: false,
      setEventHubEnabled: vi.fn(),
    });
    vi.clearAllMocks();
    mockDraftStore = createMockDraftStore();
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
        appliedSections: ['scope'],
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

  it('retains local drafts and surfaces retry guidance when bundled save rejects', async () => {
    const saveDraft = vi.fn().mockResolvedValue({
      sectionId: 'sec-1',
      draftId: 'draft-1',
      documentId: 'doc-1',
      draftVersion: 2,
      draftBaseVersion: 4,
      conflictState: 'clean',
      summaryNote: 'Ready to apply.',
      formattingAnnotations: [],
      savedAt: new Date().toISOString(),
      savedBy: 'user-123',
    });

    const bundleError = new SectionEditorClientError('Conflict detected', {
      status: 409,
      requestId: 'section-draft-test',
      body: { conflicts: [{ sectionPath: 'scope', message: 'Baseline mismatch' }] },
    });

    const draftClient = {
      applyDraftBundle: vi.fn().mockRejectedValue(bundleError),
      logComplianceWarning: vi.fn(),
    } as unknown as DraftPersistenceClient;

    const storage: Pick<ManualDraftStorage, 'saveDraft' | 'loadDraft' | 'deleteDraft'> = {
      saveDraft: vi.fn().mockResolvedValue(undefined),
      loadDraft: vi.fn().mockResolvedValue(null),
      deleteDraft: vi.fn().mockResolvedValue(undefined),
    };

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
        storage,
        loadPersistedDraft: false,
      })
    );

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
    expect((draftClient as any).applyDraftBundle).toHaveBeenCalled();
    expect(mockDraftStore.removeDraft).not.toHaveBeenCalled();

    await waitFor(() => {
      expect(storage.saveDraft).toHaveBeenCalled();
    });

    await waitFor(() => {
      const storeSnapshot = useSectionDraftStore.getState();
      expect(storeSnapshot.saveError).toBeInstanceOf(SectionEditorClientError);
      expect(storeSnapshot.saveError?.message).toMatch(/retry/i);
    });
  });
});

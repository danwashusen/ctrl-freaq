import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import { useDraftPersistence } from './use-draft-persistence';

const logComplianceWarningMock = vi.fn();

vi.mock('@/features/document-editor/services/draft-client', () => ({
  DraftPersistenceClient: vi.fn().mockImplementation(() => ({
    applyDraftBundle: vi.fn(),
    logComplianceWarning: logComplianceWarningMock,
  })),
}));

const { markDraftRehydratedMock, resolveRehydratedDraftMock, clearRehydratedDraftMock } =
  vi.hoisted(() => ({
    markDraftRehydratedMock: vi.fn(),
    resolveRehydratedDraftMock: vi.fn(),
    clearRehydratedDraftMock: vi.fn(),
  }));

vi.mock('../stores/draft-state', () => {
  const storeState = {
    drafts: {},
    rehydratedDrafts: {},
    setDraftStatus: vi.fn(),
    setComplianceWarning: vi.fn(),
    clearDraft: vi.fn(),
    reset: vi.fn(),
    markDraftRehydrated: markDraftRehydratedMock,
    resolveRehydratedDraft: resolveRehydratedDraftMock,
    clearRehydratedDraft: clearRehydratedDraftMock,
  };

  const useDraftStateStore = (selector?: (state: typeof storeState) => unknown) =>
    selector ? selector(storeState) : storeState;

  (useDraftStateStore as any).getState = () => storeState;
  (useDraftStateStore as any).setState = (updater: unknown) => {
    if (typeof updater === 'function') {
      const result = (updater as (state: typeof storeState) => Partial<typeof storeState> | void)(
        storeState
      );
      if (result) {
        Object.assign(storeState, result);
      }
    } else if (updater && typeof updater === 'object') {
      Object.assign(storeState, updater as Record<string, unknown>);
    }
  };
  (useDraftStateStore as any).subscribe = () => () => {};

  return { useDraftStateStore };
});

const createMockDraftStore = () => ({
  saveDraft: vi.fn().mockResolvedValue({
    record: {
      draftKey: 'project-test/doc-architecture-demo/Architecture Overview/user-author',
      projectSlug: 'project-test',
      documentSlug: 'doc-architecture-demo',
      sectionTitle: 'Architecture Overview',
      sectionPath: 'architecture-overview',
      authorId: 'user-author',
      baselineVersion: 'rev-6',
      patch: 'diff --git a b',
      status: 'draft' as const,
      lastEditedAt: new Date('2025-09-30T12:00:00.000Z'),
      updatedAt: new Date('2025-09-30T12:00:00.000Z'),
    },
    prunedDraftKeys: [],
  }),
  rehydrateDocumentState: vi.fn().mockResolvedValue({
    projectSlug: 'project-test',
    documentSlug: 'doc-architecture-demo',
    authorId: 'user-author',
    sections: [
      {
        draftKey: 'project-test/doc-architecture-demo/Architecture Overview/user-author',
        projectSlug: 'project-test',
        documentSlug: 'doc-architecture-demo',
        sectionTitle: 'Architecture Overview',
        sectionPath: 'architecture-overview',
        authorId: 'user-author',
        baselineVersion: 'rev-6',
        patch: 'diff --git a b',
        status: 'draft' as const,
        lastEditedAt: new Date('2025-09-30T12:00:00.000Z'),
        updatedAt: new Date('2025-09-30T12:00:00.000Z'),
      },
    ],
    updatedAt: new Date('2025-09-30T12:00:00.000Z'),
    rehydratedAt: new Date('2025-09-30T12:00:01.000Z'),
    pendingComplianceWarning: false,
  }),
  clearAuthorDrafts: vi.fn().mockResolvedValue(undefined),
  removeDraft: vi.fn().mockResolvedValue(undefined),
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

function StatusHarness() {
  const {
    statusLabel,
    ariaAnnouncement,
    revertToPublished,
    handleLogout,
    draftKey,
    requiresConfirmation,
    confirmRecoveredDraft,
    discardRecoveredDraft,
  } = useDraftPersistence({
    projectSlug: 'project-test',
    documentSlug: 'doc-architecture-demo',
    sectionTitle: 'Architecture Overview',
    sectionPath: 'architecture-overview',
    authorId: 'user-author',
  });

  return (
    <div>
      <span data-testid="status-label">{statusLabel}</span>
      <button type="button" onClick={() => void revertToPublished()}>
        Revert to published
      </button>
      <button type="button" onClick={() => void handleLogout()}>
        Logout
      </button>
      <button type="button" onClick={() => void confirmRecoveredDraft()}>
        Apply recovered draft
      </button>
      <button type="button" onClick={() => void discardRecoveredDraft()}>
        Discard recovered draft
      </button>
      <span role="status" aria-live="polite">
        {ariaAnnouncement ?? ''}
      </span>
      <span data-testid="draft-key">{draftKey}</span>
      <span data-testid="rehydration-gate">{requiresConfirmation ? 'pending' : 'resolved'}</span>
    </div>
  );
}

describe('useDraftPersistence', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDraftStore = createMockDraftStore();
    markDraftRehydratedMock.mockReset();
    resolveRehydratedDraftMock.mockReset();
    clearRehydratedDraftMock.mockReset();
    logComplianceWarningMock.mockReset();
  });

  test('exposes accessible status label and revert-to-published control', async () => {
    const user = userEvent.setup();
    render(<StatusHarness />);

    expect(await screen.findByTestId('status-label')).toHaveTextContent('Review recovered draft');
    expect(markDraftRehydratedMock).toHaveBeenCalled();
    expect(screen.getByTestId('rehydration-gate')).toHaveTextContent('pending');

    const applyButton = screen.getByRole('button', { name: /apply recovered draft/i });
    await user.click(applyButton);

    expect(screen.getByTestId('status-label')).toHaveTextContent('Draft pending');
    expect(screen.getByTestId('rehydration-gate')).toHaveTextContent('resolved');
    expect(resolveRehydratedDraftMock).toHaveBeenCalled();

    const revertButton = screen.getByRole('button', { name: /revert to published/i });
    await user.click(revertButton);

    expect(mockDraftStore.removeDraft).toHaveBeenCalledWith(
      'project-test/doc-architecture-demo/Architecture Overview/user-author'
    );
    expect(screen.getByRole('status')).toHaveTextContent('Draft reverted to published content');
    expect(clearRehydratedDraftMock).toHaveBeenCalled();
  });

  test('purges drafts on logout and announces clearance', async () => {
    const user = userEvent.setup();
    render(<StatusHarness />);

    const logoutButton = screen.getByRole('button', { name: /logout/i });
    await user.click(logoutButton);

    expect(mockDraftStore.clearAuthorDrafts).toHaveBeenCalledWith('user-author');
    expect(screen.getByRole('status')).toHaveTextContent(
      'Drafts cleared after logout for security'
    );
    expect(screen.getByTestId('rehydration-gate')).toHaveTextContent('resolved');
    expect(clearRehydratedDraftMock).toHaveBeenCalled();
  });

  test('keeps sections without matching draft keys marked as synced', async () => {
    mockDraftStore.rehydrateDocumentState.mockResolvedValueOnce({
      projectSlug: 'project-test',
      documentSlug: 'doc-architecture-demo',
      authorId: 'user-author',
      sections: [
        {
          draftKey: 'project-test/doc-architecture-demo/Other Section/user-author',
          projectSlug: 'project-test',
          documentSlug: 'doc-architecture-demo',
          sectionTitle: 'Other Section',
          sectionPath: 'other-section',
          authorId: 'user-author',
          baselineVersion: 'rev-7',
          patch: 'diff --git c d',
          status: 'draft' as const,
          lastEditedAt: new Date('2025-09-30T13:00:00.000Z'),
          updatedAt: new Date('2025-09-30T13:00:00.000Z'),
        },
      ],
      updatedAt: new Date('2025-09-30T13:00:00.000Z'),
      rehydratedAt: new Date('2025-09-30T13:00:01.000Z'),
      pendingComplianceWarning: false,
    });

    render(<StatusHarness />);

    await waitFor(() => {
      expect(mockDraftStore.rehydrateDocumentState).toHaveBeenCalled();
    });

    expect(screen.getByTestId('status-label')).toHaveTextContent('Synced');
    expect(screen.getByTestId('rehydration-gate')).toHaveTextContent('resolved');
    expect(markDraftRehydratedMock).not.toHaveBeenCalled();
  });

  test('supports discarding recovered drafts through dedicated helper', async () => {
    const user = userEvent.setup();
    render(<StatusHarness />);

    expect(await screen.findByTestId('status-label')).toHaveTextContent('Review recovered draft');
    expect(screen.getByTestId('rehydration-gate')).toHaveTextContent('pending');

    const discardButton = screen.getByRole('button', { name: /discard recovered draft/i });
    await user.click(discardButton);

    expect(mockDraftStore.removeDraft).toHaveBeenCalledWith(
      'project-test/doc-architecture-demo/Architecture Overview/user-author'
    );
    expect(screen.getByTestId('status-label')).toHaveTextContent('Synced');
    expect(screen.getByRole('status')).toHaveTextContent('Draft reverted to published content');
    expect(screen.getByTestId('rehydration-gate')).toHaveTextContent('resolved');
  });

  test('logs compliance warnings when rehydrated draft requires escalation', async () => {
    mockDraftStore.rehydrateDocumentState.mockResolvedValueOnce({
      projectSlug: 'project-test',
      documentSlug: 'doc-architecture-demo',
      authorId: 'user-author',
      sections: [
        {
          draftKey: 'project-test/doc-architecture-demo/Architecture Overview/user-author',
          projectSlug: 'project-test',
          documentSlug: 'doc-architecture-demo',
          sectionTitle: 'Architecture Overview',
          sectionPath: 'architecture-overview',
          authorId: 'user-author',
          baselineVersion: 'rev-6',
          patch: 'diff --git a b',
          status: 'draft' as const,
          lastEditedAt: new Date('2025-09-30T12:00:00.000Z'),
          updatedAt: new Date('2025-09-30T12:00:00.000Z'),
        },
      ],
      updatedAt: new Date('2025-09-30T12:00:00.000Z'),
      rehydratedAt: new Date('2025-09-30T12:00:02.000Z'),
      pendingComplianceWarning: true,
    });

    render(<StatusHarness />);

    await waitFor(() => {
      expect(logComplianceWarningMock).toHaveBeenCalledWith(
        expect.objectContaining({
          projectSlug: 'project-test',
          documentId: 'doc-architecture-demo',
          payload: expect.objectContaining({
            authorId: 'user-author',
            policyId: 'retention-client-only',
            context: expect.objectContaining({
              draftKey: 'project-test/doc-architecture-demo/Architecture Overview/user-author',
              sectionPath: 'architecture-overview',
            }),
          }),
        })
      );
    });
  });
});

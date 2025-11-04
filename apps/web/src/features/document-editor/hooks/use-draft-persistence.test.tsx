import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import { useDraftPersistence } from './use-draft-persistence';
import { useSectionDraftStore } from '@/features/section-editor/stores/section-draft-store';

const logComplianceWarningMock = vi.fn();
const logDraftComplianceWarningMock = vi.hoisted(() => vi.fn());

const fetchProjectRetentionPolicyMock = vi.hoisted(() => vi.fn());

vi.mock('@ctrl-freaq/qa', () => ({
  logDraftComplianceWarning: logDraftComplianceWarningMock,
  formatDraftComplianceWarning: vi.fn((warning: Record<string, unknown>) => warning),
}));

vi.mock('@/features/document-editor/services/project-retention', () => ({
  fetchProjectRetentionPolicy: fetchProjectRetentionPolicyMock,
}));

vi.mock('@/features/document-editor/services/draft-client', () => {
  function DraftPersistenceClientMock(this: Record<string, unknown>) {
    Object.assign(this, {
      applyDraftBundle: vi.fn(),
      logComplianceWarning: logComplianceWarningMock,
    });
  }

  return {
    DraftPersistenceClient: DraftPersistenceClientMock,
  };
});

vi.mock('@ctrl-freaq/editor-core', () => ({
  createPatchEngine: () => ({
    createPatch: (_baseline: string, modified: string) => [
      { op: 'replace', path: '/content', value: modified },
    ],
  }),
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
      complianceWarning: false,
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
  listDrafts: vi.fn().mockResolvedValue([]),
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

const formatTimestamp = (isoTimestamp: string) =>
  new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(
    new Date(isoTimestamp)
  );

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
    lastUpdatedLabel,
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
      <span data-testid="last-updated">{lastUpdatedLabel ?? 'n/a'}</span>
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
    logDraftComplianceWarningMock.mockReset();
    fetchProjectRetentionPolicyMock.mockReset();
    useSectionDraftStore.getState().reset();
  });

  afterEach(() => {
    window.localStorage?.clear();
    window.sessionStorage?.clear();
  });

  test('exposes accessible status label and revert-to-published control', async () => {
    const user = userEvent.setup();
    render(<StatusHarness />);

    const statusLabel = await screen.findByTestId('status-label');
    expect(statusLabel).toHaveTextContent('Review recovered draft');
    expect(screen.getByTestId('last-updated')).toHaveTextContent(
      formatTimestamp('2025-09-30T12:00:00.000Z')
    );
    expect(markDraftRehydratedMock).toHaveBeenCalled();
    expect(screen.getByTestId('rehydration-gate')).toHaveTextContent('pending');

    const applyButton = screen.getByRole('button', { name: /apply recovered draft/i });
    await user.click(applyButton);

    expect(screen.getByTestId('status-label')).toHaveTextContent('Draft pending');
    expect(screen.getByTestId('last-updated')).toHaveTextContent(
      formatTimestamp('2025-09-30T12:00:00.000Z')
    );
    expect(screen.getByTestId('rehydration-gate')).toHaveTextContent('resolved');
    expect(resolveRehydratedDraftMock).toHaveBeenCalled();

    const revertButton = screen.getByRole('button', { name: /revert to published/i });
    await user.click(revertButton);

    expect(mockDraftStore.removeDraft).toHaveBeenCalledWith(
      'project-test/doc-architecture-demo/Architecture Overview/user-author'
    );
    expect(screen.getByRole('status')).toHaveTextContent('Draft reverted to published content');
    expect(clearRehydratedDraftMock).toHaveBeenCalled();
    expect(screen.getByTestId('last-updated')).toHaveTextContent('n/a');
  });

  test('logs compliance warnings through QA helper when retention policy is pending', async () => {
    const complianceState = {
      projectSlug: 'project-test',
      documentSlug: 'doc-architecture-demo',
      authorId: 'user-author',
      sectionPath: 'architecture-overview',
    };
    mockDraftStore.rehydrateDocumentState.mockResolvedValueOnce({
      projectSlug: complianceState.projectSlug,
      documentSlug: complianceState.documentSlug,
      authorId: complianceState.authorId,
      sections: [
        {
          draftKey: 'project-test/doc-architecture-demo/Architecture Overview/user-author',
          projectSlug: complianceState.projectSlug,
          documentSlug: complianceState.documentSlug,
          sectionTitle: 'Architecture Overview',
          sectionPath: complianceState.sectionPath,
          authorId: complianceState.authorId,
          baselineVersion: 'rev-6',
          patch: 'diff --git a b',
          status: 'draft' as const,
          lastEditedAt: new Date('2025-09-30T12:00:00.000Z'),
          updatedAt: new Date('2025-09-30T12:00:00.000Z'),
          complianceWarning: true,
        },
      ],
      updatedAt: new Date('2025-09-30T12:00:00.000Z'),
      rehydratedAt: new Date('2025-09-30T12:00:01.000Z'),
      pendingComplianceWarning: true,
    });

    render(<StatusHarness />);

    await waitFor(() => {
      expect(logComplianceWarningMock).toHaveBeenCalled();
    });

    expect(logDraftComplianceWarningMock).toHaveBeenCalledTimes(1);
    const [, warningPayload] = logDraftComplianceWarningMock.mock.calls[0] ?? [];
    expect(warningPayload).toMatchObject({
      projectSlug: complianceState.projectSlug,
      documentSlug: complianceState.documentSlug,
      authorId: complianceState.authorId,
      policyId: expect.any(String),
    });
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
    expect(screen.getByTestId('last-updated')).toHaveTextContent('n/a');
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
    expect(screen.getByTestId('last-updated')).toHaveTextContent('n/a');
  });

  test('does not auto discard new drafts when cleared markers predate latest edits', async () => {
    const draftKey = 'project-test/doc-architecture-demo/Architecture Overview/user-author';
    window.localStorage.setItem(`draft-store:cleared:${draftKey}`, '2025-09-29T12:00:00.000Z');

    render(<StatusHarness />);

    expect(await screen.findByTestId('status-label')).toHaveTextContent('Review recovered draft');
    expect(screen.getByTestId('rehydration-gate')).toHaveTextContent('pending');
    expect(clearRehydratedDraftMock).not.toHaveBeenCalled();
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
    expect(screen.getByTestId('last-updated')).toHaveTextContent('n/a');
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

    expect(screen.getByTestId('last-updated')).toHaveTextContent(
      formatTimestamp('2025-09-30T12:00:00.000Z')
    );
  });

  test('logs compliance warning when retention policy resolves after initial draft save', async () => {
    const complianceDraftKey =
      'project-test/doc-architecture-demo/Architecture Overview/user-author';

    mockDraftStore.rehydrateDocumentState
      .mockResolvedValueOnce({
        projectSlug: 'project-test',
        documentSlug: 'doc-architecture-demo',
        authorId: 'user-author',
        sections: [
          {
            draftKey: complianceDraftKey,
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
            complianceWarning: false,
          },
        ],
        updatedAt: new Date('2025-09-30T12:00:00.000Z'),
        rehydratedAt: new Date('2025-09-30T12:00:01.000Z'),
        pendingComplianceWarning: false,
      })
      .mockResolvedValueOnce({
        projectSlug: 'project-test',
        documentSlug: 'doc-architecture-demo',
        authorId: 'user-author',
        sections: [
          {
            draftKey: complianceDraftKey,
            projectSlug: 'project-test',
            documentSlug: 'doc-architecture-demo',
            sectionTitle: 'Architecture Overview',
            sectionPath: 'architecture-overview',
            authorId: 'user-author',
            baselineVersion: 'rev-6',
            patch: 'diff --git a b',
            status: 'draft' as const,
            lastEditedAt: new Date('2025-09-30T12:01:00.000Z'),
            updatedAt: new Date('2025-09-30T12:01:00.000Z'),
            complianceWarning: true,
          },
        ],
        updatedAt: new Date('2025-09-30T12:01:00.000Z'),
        rehydratedAt: new Date('2025-09-30T12:01:01.000Z'),
        pendingComplianceWarning: true,
      });

    render(<StatusHarness />);

    await waitFor(() => {
      expect(mockDraftStore.rehydrateDocumentState).toHaveBeenCalledTimes(1);
    });

    expect(logComplianceWarningMock).not.toHaveBeenCalled();

    mockDraftStore.rehydrateDocumentState.mockClear();

    act(() => {
      window.dispatchEvent(
        new CustomEvent('draft-storage:updated', {
          detail: { draftKey: complianceDraftKey },
        })
      );
    });

    await waitFor(() => {
      expect(mockDraftStore.rehydrateDocumentState).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(logComplianceWarningMock).toHaveBeenCalled();
    });
  });
});

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import { useDraftPersistence } from './use-draft-persistence';

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
  const { statusLabel, ariaAnnouncement, revertToPublished, handleLogout, draftKey } =
    useDraftPersistence({
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
      <span role="status" aria-live="polite">
        {ariaAnnouncement ?? ''}
      </span>
      <span data-testid="draft-key">{draftKey}</span>
    </div>
  );
}

describe('useDraftPersistence', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDraftStore = createMockDraftStore();
  });

  test('exposes accessible status label and revert-to-published control', async () => {
    const user = userEvent.setup();
    render(<StatusHarness />);

    expect(await screen.findByTestId('status-label')).toHaveTextContent('Draft pending');
    const revertButton = screen.getByRole('button', { name: /revert to published/i });
    await user.click(revertButton);

    expect(mockDraftStore.removeDraft).toHaveBeenCalledWith(
      'project-test/doc-architecture-demo/Architecture Overview/user-author'
    );
    expect(screen.getByRole('status')).toHaveTextContent('Draft reverted to published content');
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
  });
});

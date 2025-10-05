import { render, screen } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';

import { DraftStatusBadge } from './DraftStatusBadge';

vi.mock('../../hooks/use-draft-persistence', () => ({
  useDraftPersistence: vi.fn(() => ({
    statusLabel: 'Draft pending',
    ariaAnnouncement: 'Draft restored from recovery.',
    revertToPublished: vi.fn(),
    handleLogout: vi.fn(),
    draftKey: 'project/doc/section/author',
    requiresConfirmation: false,
    confirmRecoveredDraft: vi.fn(),
    discardRecoveredDraft: vi.fn(),
    lastUpdatedLabel: 'Oct 1, 2025, 12:34 PM',
    lastUpdatedIso: '2025-10-01T12:34:00.000Z',
  })),
}));

describe('DraftStatusBadge', () => {
  test('renders last updated timestamp with accessible announcement', () => {
    render(
      <DraftStatusBadge
        projectSlug="project-test"
        documentSlug="doc-architecture-demo"
        sectionTitle="Architecture Overview"
        sectionPath="architecture-overview"
        authorId="user-author"
      />
    );

    expect(screen.getByTestId('section-draft-status')).toHaveTextContent(
      'Last updated Oct 1, 2025, 12:34 PM'
    );

    const timestamp = screen.getByTestId('draft-last-updated');
    expect(timestamp.tagName).toBe('TIME');
    expect(timestamp).toHaveAttribute('dateTime', '2025-10-01T12:34:00.000Z');
    expect(timestamp).toHaveTextContent('Oct 1, 2025, 12:34 PM');

    expect(screen.getByRole('status')).toHaveTextContent('Last updated Oct 1, 2025, 12:34 PM');
  });
});

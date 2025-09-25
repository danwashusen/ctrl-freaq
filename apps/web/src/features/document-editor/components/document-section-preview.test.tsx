import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import DocumentSectionPreview from './document-section-preview';
import type { SectionView } from '@/features/document-editor/types/section-view';

vi.mock('@/features/document-editor/lib/utils', () => ({
  cn: (...classes: (string | boolean | undefined)[]) => classes.filter(Boolean).join(' '),
}));

vi.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, disabled, 'data-testid': testId, ...props }: any) => (
    <button type="button" onClick={onClick} disabled={disabled} data-testid={testId} {...props}>
      {children}
    </button>
  ),
}));

vi.mock('@/components/ui/card', () => ({
  Card: ({ children, className, ...props }: any) => (
    <div className={`card ${className ?? ''}`} {...props}>
      {children}
    </div>
  ),
  CardHeader: ({ children, className }: any) => (
    <div className={`card-header ${className ?? ''}`}>{children}</div>
  ),
  CardContent: ({ children, className }: any) => (
    <div className={`card-content ${className ?? ''}`}>{children}</div>
  ),
}));

describe('DocumentSectionPreview', () => {
  const baseSection: SectionView = {
    id: 'section-1',
    docId: 'doc-1',
    parentSectionId: null,
    key: 'overview',
    title: 'Architecture Overview',
    depth: 0,
    orderIndex: 0,
    contentMarkdown: 'Approved architecture summary.',
    placeholderText: 'Describe the approved architecture overview.',
    hasContent: true,
    viewState: 'read_mode',
    editingUser: null,
    lastModified: '2025-09-25T10:00:00Z',
    status: 'ready',
    assumptionsResolved: true,
    qualityGateStatus: 'passed',
    approvedVersion: 6,
    approvedAt: '2025-09-25T12:00:00Z',
    approvedBy: 'engineer@example.com',
    lastSummary: 'Approved by architecture council.',
    draftId: 'draft-1',
    draftVersion: 6,
    draftBaseVersion: 6,
    latestApprovedVersion: 6,
    conflictState: 'clean',
    conflictReason: null,
    summaryNote: 'Pending follow-up edits.',
    lastSavedAt: '2025-09-25T11:45:00Z',
    lastSavedBy: 'engineer@example.com',
    lastManualSaveAt: Date.now(),
  };

  it('renders approval metadata and edit CTA', async () => {
    const onEnterEdit = vi.fn();

    render(<DocumentSectionPreview section={baseSection} onEnterEdit={onEnterEdit} />);

    expect(screen.getByTestId('section-preview')).toBeInTheDocument();
    expect(screen.getByTestId('section-approval-status')).toHaveTextContent(/Approved/i);
    expect(screen.getByTestId('section-reviewer-summary')).toHaveTextContent(
      'Approved by architecture council.'
    );
    expect(screen.getByTestId('section-approved-timestamp')).toHaveTextContent(
      '2025-09-25T12:00:00.000Z'
    );

    const user = userEvent.setup();
    await user.click(screen.getByTestId('enter-edit'));
    expect(onEnterEdit).toHaveBeenCalledWith('section-1');
  });

  it('falls back to placeholder content when section is empty', () => {
    const emptySection = {
      ...baseSection,
      hasContent: false,
      contentMarkdown: '',
      placeholderText: 'No content provided.',
    };

    render(<DocumentSectionPreview section={emptySection} />);

    expect(screen.getByText('No content provided.')).toBeInTheDocument();
  });

  it('renders fallback summary when none is provided', () => {
    const sectionWithoutSummary = {
      ...baseSection,
      lastSummary: null,
    };

    render(
      <DocumentSectionPreview section={sectionWithoutSummary} approval={{ reviewerSummary: '' }} />
    );

    expect(screen.getByTestId('section-reviewer-summary')).toHaveTextContent(
      'Reviewer summary unavailable'
    );
  });
});

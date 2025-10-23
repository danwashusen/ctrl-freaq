import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

interface MockDraftStatusBadgeProps {
  projectSlug: string;
  documentSlug: string;
  sectionTitle: string;
  sectionPath: string;
  authorId: string;
}

const draftBadgeInvocations: MockDraftStatusBadgeProps[] = [];

vi.mock('./section-draft/DraftStatusBadge', () => ({
  DraftStatusBadge: (props: MockDraftStatusBadgeProps) => {
    draftBadgeInvocations.push(props);
    return <div data-testid="draft-status-badge">{props.projectSlug}</div>;
  },
}));

vi.mock('@/lib/auth-provider', () => ({
  useAuth: () => ({
    userId: 'test-user',
    isSignedIn: true,
    getToken: async () => 'test-token',
  }),
}));

vi.mock('@/features/document-editor/lib/utils', () => ({
  cn: (...classes: (string | boolean | undefined)[]) => classes.filter(Boolean).join(' '),
}));

const runSectionMock = vi.fn();
const useQualityGatesMock = vi.fn();

vi.mock('../quality-gates/hooks', () => ({
  useQualityGates: (...args: unknown[]) => useQualityGatesMock(...args),
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

import DocumentSectionPreview from './document-section-preview';
import type { SectionView } from '@/features/document-editor/types/section-view';

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

  beforeEach(() => {
    draftBadgeInvocations.length = 0;
    runSectionMock.mockReset();
    useQualityGatesMock.mockReset();
    useQualityGatesMock.mockReturnValue({
      runSection: runSectionMock,
      runDocument: vi.fn(),
      isRunning: false,
      status: 'completed' as const,
      statusMessage: 'Validation found blockers.',
      timeoutCopy: null,
      lastStatus: 'Blocker' as const,
      remediation: [],
      isSubmissionBlocked: false,
      blockerCount: 0,
      incidentId: null,
      documentStatus: 'completed' as const,
      documentStatusMessage: '',
      documentPublishCopy: null,
      documentSlaWarningCopy: null,
      documentSummary: null,
      documentLastRunAt: null,
      documentRequestId: null,
      documentTriggeredBy: null,
      documentDurationMs: null,
      isDocumentPublishBlocked: false,
      isDocumentRunning: false,
    });
  });

  it('renders approval metadata and edit CTA', async () => {
    const onEnterEdit = vi.fn();

    render(
      <DocumentSectionPreview
        section={baseSection}
        onEnterEdit={onEnterEdit}
        projectSlug="demo-project"
      />
    );

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

  it('auto-runs validation when prior results exist', () => {
    render(
      <DocumentSectionPreview section={baseSection} projectSlug="demo-project" documentId="doc-1" />
    );

    expect(runSectionMock).toHaveBeenCalledWith({ reason: 'auto' });
  });

  it('skips auto-run when last status is neutral', () => {
    useQualityGatesMock.mockReturnValueOnce({
      runSection: runSectionMock,
      runDocument: vi.fn(),
      isRunning: false,
      status: 'idle' as const,
      statusMessage: 'Validation not run yet.',
      timeoutCopy: null,
      lastStatus: 'Neutral' as const,
      remediation: [],
      isSubmissionBlocked: false,
      blockerCount: 0,
      incidentId: null,
      documentStatus: 'idle' as const,
      documentStatusMessage: '',
      documentPublishCopy: null,
      documentSlaWarningCopy: null,
      documentSummary: null,
      documentLastRunAt: null,
      documentRequestId: null,
      documentTriggeredBy: null,
      documentDurationMs: null,
      isDocumentPublishBlocked: false,
      isDocumentRunning: false,
    });

    render(
      <DocumentSectionPreview section={baseSection} projectSlug="demo-project" documentId="doc-1" />
    );

    expect(runSectionMock).not.toHaveBeenCalled();
  });

  it('falls back to placeholder content when section is empty', () => {
    const emptySection = {
      ...baseSection,
      hasContent: false,
      contentMarkdown: '',
      placeholderText: 'No content provided.',
    };

    render(<DocumentSectionPreview section={emptySection} projectSlug="demo-project" />);

    expect(screen.getByText('No content provided.')).toBeInTheDocument();
  });

  it('renders fallback summary when none is provided', () => {
    const sectionWithoutSummary = {
      ...baseSection,
      lastSummary: null,
    };

    render(
      <DocumentSectionPreview
        section={sectionWithoutSummary}
        approval={{ reviewerSummary: '' }}
        projectSlug="demo-project"
      />
    );

    expect(screen.getByTestId('section-reviewer-summary')).toHaveTextContent(
      'Reviewer summary unavailable'
    );
  });

  it('forwards project slug to draft status badge', () => {
    render(
      <DocumentSectionPreview
        section={baseSection}
        projectSlug="alpha-project"
        documentId="doc-1"
      />
    );

    expect(draftBadgeInvocations[0]?.projectSlug).toBe('alpha-project');
    expect(screen.getByTestId('draft-status-badge')).toHaveTextContent('alpha-project');
  });
});

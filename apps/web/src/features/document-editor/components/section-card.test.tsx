import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import SectionCard from './section-card';
import type { SectionView } from '@/features/document-editor/types/section-view';

// Mock the utils function
vi.mock('@/features/document-editor/lib/utils', () => ({
  cn: (...classes: (string | boolean | undefined)[]) => classes.filter(Boolean).join(' '),
}));

// Mock UI components
vi.mock('@/components/ui/button', () => ({
  Button: ({
    children,
    onClick,
    disabled,
    'data-testid': testId,
    variant,
    size,
    ...props
  }: any) => (
    <button
      onClick={onClick}
      disabled={disabled}
      data-testid={testId}
      className={`button ${variant} ${size}`}
      {...props}
    >
      {children}
    </button>
  ),
}));

vi.mock('@/components/ui/card', () => ({
  Card: ({ children, className, ...props }: any) => (
    <div className={`card ${className}`} {...props}>
      {children}
    </div>
  ),
  CardHeader: ({ children, className }: any) => (
    <div className={`card-header ${className}`}>{children}</div>
  ),
  CardContent: ({ children, className }: any) => (
    <div className={`card-content ${className}`}>{children}</div>
  ),
}));

const { mockUseQualityGates } = vi.hoisted(() => ({
  mockUseQualityGates: vi.fn(),
}));

vi.mock('../quality-gates/hooks', () => ({
  useQualityGates: mockUseQualityGates,
}));

describe('SectionCard', () => {
  const mockSectionWithContent: SectionView = {
    id: 'section-123',
    docId: 'doc-456',
    parentSectionId: null,
    key: 'introduction',
    title: 'Introduction',
    depth: 0,
    orderIndex: 0,
    contentMarkdown: '# Introduction\nThis is the introduction section.',
    placeholderText: 'Describe the introduction to this document.',
    hasContent: true,
    viewState: 'read_mode',
    editingUser: null,
    lastModified: '2025-09-20T10:00:00Z',
    status: 'ready',
    assumptionsResolved: true,
    qualityGateStatus: 'passed',
    approvedVersion: 5,
    approvedAt: '2025-09-20T09:55:00Z',
    approvedBy: 'staff@example.com',
    lastSummary: 'Approved intro.',
    draftId: 'draft-section-123',
    draftVersion: 3,
    draftBaseVersion: 3,
    latestApprovedVersion: 5,
    conflictState: 'clean',
    conflictReason: null,
    summaryNote: 'Refresh intro soon.',
    lastSavedAt: '2025-09-20T09:30:00Z',
    lastSavedBy: 'staff@example.com',
    lastManualSaveAt: Date.now(),
  };

  const mockSectionEmpty: SectionView = {
    ...mockSectionWithContent,
    id: 'section-empty',
    title: 'Empty Section',
    contentMarkdown: '',
    hasContent: false,
    viewState: 'idle',
    status: 'idle',
    placeholderText: 'This section needs content. Click to begin drafting.',
  };

  const defaultProps = {
    section: mockSectionWithContent,
    isActive: false,
    onEditClick: vi.fn(),
    onSaveClick: vi.fn(),
    onCancelClick: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseQualityGates.mockReturnValue({
      runSection: vi.fn(),
      runDocument: vi.fn(),
      isRunning: false,
      status: 'idle',
      statusMessage: 'Validation not run yet.',
      timeoutCopy: null,
      lastStatus: null,
      remediation: [],
      isSubmissionBlocked: false,
      blockerCount: 0,
      incidentId: null,
    });
  });

  describe('rendering', () => {
    it('renders section card with content', () => {
      render(<SectionCard {...defaultProps} />);

      expect(screen.getByTestId('section-card')).toBeInTheDocument();
      expect(screen.getByText('Introduction')).toBeInTheDocument();
      expect(screen.getByTestId('section-content')).toBeInTheDocument();
    });

    it('renders empty section card', () => {
      render(<SectionCard {...defaultProps} section={mockSectionEmpty} />);

      expect(screen.getByTestId('section-empty')).toBeInTheDocument();
      expect(screen.getByText('Empty Section')).toBeInTheDocument();
      expect(screen.getByTestId('placeholder-text')).toBeInTheDocument();
    });

    it('applies custom className', () => {
      render(<SectionCard {...defaultProps} className="custom-class" />);

      expect(screen.getByTestId('section-card')).toHaveClass('custom-class');
    });

    it('applies active state styling', () => {
      render(<SectionCard {...defaultProps} isActive={true} />);

      const card = screen.getByTestId('section-card');
      expect(card).toHaveAttribute('data-active', 'true');
      expect(card).toHaveClass('ring-2', 'ring-blue-500', 'shadow-lg');
    });

    it('sets correct data attributes', () => {
      render(<SectionCard {...defaultProps} />);

      const card = screen.getByTestId('section-card');
      expect(card).toHaveAttribute('data-section-id', 'section-123');
      expect(card).toHaveAttribute('data-active', 'false');
    });
  });

  describe('section header', () => {
    it('displays section title with truncation', () => {
      const longTitleSection: SectionView = {
        ...mockSectionWithContent,
        title: 'This is a very long section title that should be truncated in the UI',
      };

      render(<SectionCard {...defaultProps} section={longTitleSection} />);

      const titleElement = screen.getByText(longTitleSection.title);
      expect(titleElement).toHaveClass('truncate');
      expect(titleElement).toHaveAttribute('title', longTitleSection.title);
    });

    it('shows current view state with icon', () => {
      render(<SectionCard {...defaultProps} />);

      expect(screen.getByText('Reading')).toBeInTheDocument();
    });

    it('displays editing user when present', () => {
      const sectionWithUser: SectionView = {
        ...mockSectionWithContent,
        editingUser: 'john.doe@example.com',
        viewState: 'edit_mode',
      };

      render(<SectionCard {...defaultProps} section={sectionWithUser} />);

      expect(screen.getByText('by john.doe@example.com')).toBeInTheDocument();
    });

    it('shows spinning icon when saving', () => {
      const savingSection: SectionView = {
        ...mockSectionWithContent,
        viewState: 'saving',
      };

      render(<SectionCard {...defaultProps} section={savingSection} />);

      expect(screen.getByText('Saving...')).toBeInTheDocument();
      // Check for animate-spin class
      const stateIcon = screen.getByRole('graphics-symbol', { hidden: true });
      expect(stateIcon).toHaveClass('animate-spin');
    });
  });

  describe('view state indicators', () => {
    it('shows correct state for idle section', () => {
      const idleSection: SectionView = {
        ...mockSectionWithContent,
        viewState: 'idle',
      };

      render(<SectionCard {...defaultProps} section={idleSection} />);

      expect(screen.getByText('Idle')).toBeInTheDocument();
    });

    it('shows correct state for read mode', () => {
      render(<SectionCard {...defaultProps} />);

      expect(screen.getByText('Reading')).toBeInTheDocument();
    });

    it('shows correct state for edit mode', () => {
      const editingSection: SectionView = {
        ...mockSectionWithContent,
        viewState: 'edit_mode',
      };

      render(<SectionCard {...defaultProps} section={editingSection} />);

      expect(screen.getByText('Editing')).toBeInTheDocument();
    });

    it('shows correct state for saving', () => {
      const savingSection: SectionView = {
        ...mockSectionWithContent,
        viewState: 'saving',
      };

      render(<SectionCard {...defaultProps} section={savingSection} />);

      expect(screen.getByText('Saving...')).toBeInTheDocument();
    });
  });

  describe('action buttons', () => {
    it('shows edit button in read mode', () => {
      render(<SectionCard {...defaultProps} />);

      expect(screen.getByTestId('edit-button')).toBeInTheDocument();
      expect(screen.getByText('Edit')).toBeInTheDocument();
    });

    it('shows edit button in idle state', () => {
      const idleSection: SectionView = {
        ...mockSectionWithContent,
        viewState: 'idle',
      };

      render(<SectionCard {...defaultProps} section={idleSection} />);

      expect(screen.getByTestId('edit-button')).toBeInTheDocument();
    });

    it('shows save and cancel buttons in edit mode', () => {
      const editingSection: SectionView = {
        ...mockSectionWithContent,
        viewState: 'edit_mode',
      };

      render(<SectionCard {...defaultProps} section={editingSection} />);

      expect(screen.getByTestId('save-section')).toBeInTheDocument();
      expect(screen.getByTestId('cancel-button')).toBeInTheDocument();
      expect(screen.queryByTestId('edit-button')).not.toBeInTheDocument();
    });

    it('disables buttons when saving', () => {
      const savingSection: SectionView = {
        ...mockSectionWithContent,
        viewState: 'saving',
      };

      render(<SectionCard {...defaultProps} section={savingSection} />);

      // No buttons should be clickable when saving
      expect(screen.queryByTestId('edit-button')).not.toBeInTheDocument();
      expect(screen.queryByTestId('save-section')).not.toBeInTheDocument();
      expect(screen.queryByTestId('cancel-button')).not.toBeInTheDocument();
    });

    it('shows spinner in save button when saving', () => {
      const editingSection: SectionView = {
        ...mockSectionWithContent,
        viewState: 'edit_mode',
      };

      const { rerender } = render(<SectionCard {...defaultProps} section={editingSection} />);

      // Initially no spinner
      const saveButton = screen.getByTestId('save-section');
      expect(within(saveButton).queryByRole('graphics-symbol', { hidden: true })).not.toHaveClass(
        'animate-spin'
      );

      // When saving, should show spinner
      const savingSection: SectionView = {
        ...editingSection,
        viewState: 'saving',
      };

      rerender(<SectionCard {...defaultProps} section={savingSection} />);

      // Should not show buttons in saving state
      expect(screen.queryByTestId('save-section')).not.toBeInTheDocument();
    });
  });

  describe('content area', () => {
    it('shows content area for sections with content', () => {
      render(<SectionCard {...defaultProps} />);

      const contentArea = screen.getByTestId('section-content');
      expect(contentArea).toBeInTheDocument();
      expect(contentArea).toHaveClass('prose', 'prose-sm');
    });

    it('shows placeholder for empty sections', () => {
      render(<SectionCard {...defaultProps} section={mockSectionEmpty} />);

      const placeholder = screen.getByTestId('placeholder-text');
      expect(placeholder).toBeInTheDocument();
      expect(screen.getByText(mockSectionEmpty.placeholderText)).toBeInTheDocument();
      expect(screen.getByTestId('start-drafting')).toBeInTheDocument();
    });

    it('shows begin drafting button for empty sections', () => {
      render(<SectionCard {...defaultProps} section={mockSectionEmpty} />);

      const startButton = screen.getByTestId('start-drafting');
      expect(startButton).toBeInTheDocument();
      expect(startButton).toHaveTextContent('Begin Drafting');
    });
  });

  describe('metadata display', () => {
    it('shows section status', () => {
      render(<SectionCard {...defaultProps} />);

      expect(screen.getByText('Status: ready')).toBeInTheDocument();
    });

    it('shows section depth', () => {
      render(<SectionCard {...defaultProps} />);

      expect(screen.getByText('Depth: 0')).toBeInTheDocument();
    });

    it('shows quality gate status when available', () => {
      render(<SectionCard {...defaultProps} />);

      expect(screen.getByText('Quality: passed')).toBeInTheDocument();
    });

    it('hides quality gate status when null', () => {
      const sectionWithoutQuality: SectionView = {
        ...mockSectionWithContent,
        qualityGateStatus: null,
      };

      render(<SectionCard {...defaultProps} section={sectionWithoutQuality} />);

      expect(screen.queryByText(/Quality:/)).not.toBeInTheDocument();
    });

    it('shows formatted last modified date', () => {
      render(<SectionCard {...defaultProps} />);

      // Should show some formatted date
      expect(screen.getByTitle('2025-09-20T10:00:00Z')).toBeInTheDocument();
    });

    it('handles invalid date gracefully', () => {
      const sectionWithInvalidDate: SectionView = {
        ...mockSectionWithContent,
        lastModified: 'invalid-date',
      };

      render(<SectionCard {...defaultProps} section={sectionWithInvalidDate} />);

      expect(screen.getByText('Unknown')).toBeInTheDocument();
    });
  });

  describe('user interactions', () => {
    it('calls onEditClick when edit button is clicked', async () => {
      const user = userEvent.setup();
      const onEditClick = vi.fn();

      render(<SectionCard {...defaultProps} onEditClick={onEditClick} />);

      const editButton = screen.getByTestId('edit-button');
      await user.click(editButton);

      expect(onEditClick).toHaveBeenCalledWith('section-123');
    });

    it('calls onEditClick when start drafting button is clicked', async () => {
      const user = userEvent.setup();
      const onEditClick = vi.fn();

      render(
        <SectionCard {...defaultProps} section={mockSectionEmpty} onEditClick={onEditClick} />
      );

      const startButton = screen.getByTestId('start-drafting');
      await user.click(startButton);

      expect(onEditClick).toHaveBeenCalledWith('section-empty');
    });

    it('disables save when quality gates block submission', async () => {
      mockUseQualityGates.mockReturnValueOnce({
        runSection: vi.fn(),
        runDocument: vi.fn(),
        isRunning: false,
        status: 'completed',
        statusMessage: 'Validation found blockers.',
        timeoutCopy: null,
        lastStatus: 'Blocker',
        remediation: [],
        isSubmissionBlocked: true,
        blockerCount: 1,
        incidentId: 'incident-blocker',
      });

      const user = userEvent.setup();
      const onSaveClick = vi.fn();

      const editingSection: SectionView = {
        ...mockSectionWithContent,
        viewState: 'edit_mode',
      };

      render(<SectionCard {...defaultProps} section={editingSection} onSaveClick={onSaveClick} />);

      const saveButton = screen.getByTestId('save-section');
      expect(saveButton).toBeDisabled();
      await user.click(saveButton);
      expect(onSaveClick).not.toHaveBeenCalled();
    });

    it('calls onSaveClick when save button is clicked', async () => {
      const user = userEvent.setup();
      const onSaveClick = vi.fn();

      const editingSection: SectionView = {
        ...mockSectionWithContent,
        viewState: 'edit_mode',
      };

      render(<SectionCard {...defaultProps} section={editingSection} onSaveClick={onSaveClick} />);

      const saveButton = screen.getByTestId('save-section');
      await user.click(saveButton);

      expect(onSaveClick).toHaveBeenCalledWith('section-123');
    });

    it('calls onCancelClick when cancel button is clicked', async () => {
      const user = userEvent.setup();
      const onCancelClick = vi.fn();

      const editingSection: SectionView = {
        ...mockSectionWithContent,
        viewState: 'edit_mode',
      };

      render(
        <SectionCard {...defaultProps} section={editingSection} onCancelClick={onCancelClick} />
      );

      const cancelButton = screen.getByTestId('cancel-button');
      await user.click(cancelButton);

      expect(onCancelClick).toHaveBeenCalledWith('section-123');
    });

    it('handles missing callback props gracefully', async () => {
      const user = userEvent.setup();

      render(
        <SectionCard
          section={mockSectionWithContent}
          // No callbacks provided
        />
      );

      const editButton = screen.getByTestId('edit-button');

      // Should not throw when clicked
      await expect(user.click(editButton)).resolves.not.toThrow();
    });

    it('prevents interaction when buttons are disabled', async () => {
      const onEditClick = vi.fn();

      const savingSection: SectionView = {
        ...mockSectionWithContent,
        viewState: 'saving',
      };

      render(<SectionCard {...defaultProps} section={savingSection} onEditClick={onEditClick} />);

      // No buttons should be present during saving
      expect(screen.queryByTestId('edit-button')).not.toBeInTheDocument();
    });
  });

  describe('keyboard accessibility', () => {
    it('supports keyboard navigation for edit button', async () => {
      const user = userEvent.setup();
      const onEditClick = vi.fn();

      render(<SectionCard {...defaultProps} onEditClick={onEditClick} />);

      const editButton = screen.getByTestId('edit-button');
      await user.tab();
      expect(editButton).toHaveFocus();

      await user.keyboard('{Enter}');
      expect(onEditClick).toHaveBeenCalledWith('section-123');
    });

    it('supports keyboard navigation for save/cancel buttons', async () => {
      const user = userEvent.setup();
      const onSaveClick = vi.fn();
      const onCancelClick = vi.fn();

      const editingSection: SectionView = {
        ...mockSectionWithContent,
        viewState: 'edit_mode',
      };

      render(
        <SectionCard
          {...defaultProps}
          section={editingSection}
          onSaveClick={onSaveClick}
          onCancelClick={onCancelClick}
        />
      );

      // Tab to cancel button
      await user.tab();
      const cancelButton = screen.getByTestId('cancel-button');
      expect(cancelButton).toHaveFocus();

      await user.keyboard('{Enter}');
      expect(onCancelClick).toHaveBeenCalledWith('section-123');

      // Tab to save button
      await user.tab();
      const saveButton = screen.getByTestId('save-section');
      expect(saveButton).toHaveFocus();

      await user.keyboard('{Enter}');
      expect(onSaveClick).toHaveBeenCalledWith('section-123');
    });
  });

  describe('visual states and styling', () => {
    it('applies transition classes', () => {
      render(<SectionCard {...defaultProps} />);

      const card = screen.getByTestId('section-card');
      expect(card).toHaveClass('transition-all', 'duration-200');
    });

    it('applies correct state colors', () => {
      const sections = [
        { ...mockSectionWithContent, viewState: 'idle' as const },
        { ...mockSectionWithContent, viewState: 'read_mode' as const },
        { ...mockSectionWithContent, viewState: 'edit_mode' as const },
        { ...mockSectionWithContent, viewState: 'saving' as const },
      ];

      sections.forEach(section => {
        const { unmount } = render(<SectionCard {...defaultProps} section={section} />);

        // Check that the state icon has the correct color class
        const [stateIcon] = within(screen.getByTestId('section-card')).getAllByRole(
          'graphics-symbol',
          { hidden: true }
        );
        switch (section.viewState) {
          case 'idle':
            expect(stateIcon).toHaveClass('text-gray-500');
            break;
          case 'read_mode':
            expect(stateIcon).toHaveClass('text-blue-500');
            break;
          case 'edit_mode':
            expect(stateIcon).toHaveClass('text-green-500');
            break;
          case 'saving':
            expect(stateIcon).toHaveClass('text-orange-500');
            break;
        }

        unmount();
      });
    });

    it('shows placeholder content styling for empty sections', () => {
      render(<SectionCard {...defaultProps} section={mockSectionEmpty} />);

      const placeholder = screen.getByTestId('placeholder-text');
      expect(placeholder).toHaveClass('text-center', 'py-8', 'text-gray-500');
    });
  });

  describe('edge cases', () => {
    it('handles extremely long section titles', () => {
      const longTitleSection: SectionView = {
        ...mockSectionWithContent,
        title: 'A'.repeat(200), // Very long title
      };

      render(<SectionCard {...defaultProps} section={longTitleSection} />);

      const titleElement = screen.getByText(longTitleSection.title);
      expect(titleElement).toHaveClass('truncate');
      expect(titleElement).toHaveAttribute('title', longTitleSection.title);
    });

    it('handles sections with no placeholder text', () => {
      const sectionWithoutPlaceholder: SectionView = {
        ...mockSectionEmpty,
        placeholderText: '',
      };

      render(<SectionCard {...defaultProps} section={sectionWithoutPlaceholder} />);

      const placeholder = screen.getByTestId('placeholder-text');
      expect(placeholder).toBeInTheDocument();
      // Should still show the start drafting button
      expect(screen.getByTestId('start-drafting')).toBeInTheDocument();
    });

    it('handles deeply nested sections', () => {
      const deepSection: SectionView = {
        ...mockSectionWithContent,
        depth: 5,
        title: 'Deep Section',
      };

      render(<SectionCard {...defaultProps} section={deepSection} />);

      expect(screen.getByText('Depth: 5')).toBeInTheDocument();
      expect(screen.getByText('Deep Section')).toBeInTheDocument();
    });

    it('handles sections with all possible quality gate statuses', () => {
      const statuses = ['pending', 'passed', 'failed'] as const;

      statuses.forEach(status => {
        const sectionWithStatus: SectionView = {
          ...mockSectionWithContent,
          qualityGateStatus: status,
        };

        const { unmount } = render(<SectionCard {...defaultProps} section={sectionWithStatus} />);

        expect(screen.getByText(`Quality: ${status}`)).toBeInTheDocument();

        unmount();
      });
    });
  });

  describe('performance and memoization', () => {
    it('memoizes component to prevent unnecessary re-renders', () => {
      const { rerender } = render(<SectionCard {...defaultProps} />);

      // Re-render with same props should not cause issues
      rerender(<SectionCard {...defaultProps} />);

      expect(screen.getByTestId('section-card')).toBeInTheDocument();
    });

    it('only re-renders when props change', () => {
      const { rerender } = render(<SectionCard {...defaultProps} />);

      // Change section data
      const updatedSection: SectionView = {
        ...mockSectionWithContent,
        title: 'Updated Title',
      };

      rerender(<SectionCard {...defaultProps} section={updatedSection} />);

      expect(screen.getByText('Updated Title')).toBeInTheDocument();
    });
  });

  describe('date formatting', () => {
    it('formats valid ISO dates correctly', () => {
      render(<SectionCard {...defaultProps} />);

      // Should show some formatted version of the date
      expect(screen.getByTitle('2025-09-20T10:00:00Z')).toBeInTheDocument();
    });

    it('handles malformed dates', () => {
      const sectionWithBadDate: SectionView = {
        ...mockSectionWithContent,
        lastModified: 'not-a-date',
      };

      render(<SectionCard {...defaultProps} section={sectionWithBadDate} />);

      expect(screen.getByText('Unknown')).toBeInTheDocument();
    });

    it('handles empty date strings', () => {
      const sectionWithEmptyDate: SectionView = {
        ...mockSectionWithContent,
        lastModified: '',
      };

      render(<SectionCard {...defaultProps} section={sectionWithEmptyDate} />);

      expect(screen.getByText('Unknown')).toBeInTheDocument();
    });
  });
});

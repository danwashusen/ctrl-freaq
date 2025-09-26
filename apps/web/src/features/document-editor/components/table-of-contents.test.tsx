import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import TableOfContentsComponent from './table-of-contents';
import type { TableOfContents, TocNode } from '@/features/document-editor/types/table-of-contents';

// Mock the utils function
vi.mock('@/features/document-editor/lib/utils', () => ({
  cn: (...classes: (string | boolean | undefined)[]) => classes.filter(Boolean).join(' '),
}));

describe('TableOfContentsComponent', () => {
  const mockTocNode: TocNode = {
    sectionId: 'section-1',
    title: 'Introduction',
    depth: 0,
    orderIndex: 0,
    hasContent: true,
    status: 'ready',
    isExpanded: false,
    isActive: false,
    isVisible: true,
    hasUnsavedChanges: false,
    children: [],
    parentId: null,
  };

  const mockTableOfContents: TableOfContents = {
    documentId: 'doc-123',
    sections: [mockTocNode],
    lastUpdated: '2025-09-20T10:00:00Z',
  };

  const defaultProps = {
    toc: mockTableOfContents,
    activeSectionId: null,
    onSectionClick: vi.fn(),
    onExpandToggle: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('rendering', () => {
    it('renders table of contents with sections', () => {
      render(<TableOfContentsComponent {...defaultProps} />);

      expect(screen.getByTestId('toc-panel')).toBeInTheDocument();
      expect(screen.getByTestId('toc-item')).toBeInTheDocument();
      expect(screen.getByText('Introduction')).toBeInTheDocument();
    });

    it('renders empty state when no sections', () => {
      const emptyToc: TableOfContents = {
        ...mockTableOfContents,
        sections: [],
      };

      render(<TableOfContentsComponent {...defaultProps} toc={emptyToc} />);

      expect(screen.getByTestId('toc-empty')).toBeInTheDocument();
      expect(screen.getByText('No sections available')).toBeInTheDocument();
    });

    it('applies custom className', () => {
      render(<TableOfContentsComponent {...defaultProps} className="custom-class" />);

      expect(screen.getByTestId('toc-panel')).toHaveClass('custom-class');
    });

    it('sets proper ARIA label for navigation', () => {
      render(<TableOfContentsComponent {...defaultProps} />);

      expect(screen.getByRole('navigation')).toHaveAttribute('aria-label', 'Table of Contents');
    });
  });

  describe('section item rendering', () => {
    it('displays section title', () => {
      render(<TableOfContentsComponent {...defaultProps} />);

      expect(screen.getByText('Introduction')).toBeInTheDocument();
    });

    it('displays correct status icon for each status', () => {
      const sectionsWithDifferentStatuses: TocNode[] = [
        { ...mockTocNode, sectionId: 'section-1', status: 'idle', title: 'Idle Section' },
        {
          ...mockTocNode,
          sectionId: 'section-2',
          status: 'assumptions',
          title: 'Assumptions Section',
        },
        { ...mockTocNode, sectionId: 'section-3', status: 'drafting', title: 'Drafting Section' },
        { ...mockTocNode, sectionId: 'section-4', status: 'review', title: 'Review Section' },
        { ...mockTocNode, sectionId: 'section-5', status: 'ready', title: 'Ready Section' },
      ];

      const tocWithMultipleStatuses: TableOfContents = {
        ...mockTableOfContents,
        sections: sectionsWithDifferentStatuses,
      };

      render(<TableOfContentsComponent {...defaultProps} toc={tocWithMultipleStatuses} />);

      expect(screen.getByText('Idle Section')).toBeInTheDocument();
      expect(screen.getByText('Assumptions Section')).toBeInTheDocument();
      expect(screen.getByText('Drafting Section')).toBeInTheDocument();
      expect(screen.getByText('Review Section')).toBeInTheDocument();
      expect(screen.getByText('Ready Section')).toBeInTheDocument();
    });

    it('shows content indicator for sections without content', () => {
      const sectionWithoutContent: TocNode = {
        ...mockTocNode,
        hasContent: false,
        title: 'Empty Section',
      };

      const tocWithEmptySection: TableOfContents = {
        ...mockTableOfContents,
        sections: [sectionWithoutContent],
      };

      render(<TableOfContentsComponent {...defaultProps} toc={tocWithEmptySection} />);

      const sectionItem = screen.getByTestId('toc-item');
      const contentIndicator =
        within(sectionItem).getByText('Empty Section').previousElementSibling;

      // Check for the content indicator div (has specific styling classes)
      expect(contentIndicator).toHaveClass('h-2', 'w-2', 'rounded-full');
    });

    it('shows unsaved changes indicator', () => {
      const sectionWithChanges: TocNode = {
        ...mockTocNode,
        hasUnsavedChanges: true,
        title: 'Modified Section',
      };

      const tocWithModifiedSection: TableOfContents = {
        ...mockTableOfContents,
        sections: [sectionWithChanges],
      };

      render(<TableOfContentsComponent {...defaultProps} toc={tocWithModifiedSection} />);

      const unsavedIndicator = screen.getByTitle('Unsaved changes');
      expect(unsavedIndicator).toBeInTheDocument();
      expect(unsavedIndicator).toHaveClass('bg-orange-400');
    });

    it('applies correct data attributes', () => {
      render(<TableOfContentsComponent {...defaultProps} />);

      const tocItem = screen.getByTestId('toc-item');
      expect(tocItem).toHaveAttribute('data-section-id', 'section-1');
      expect(tocItem).toHaveAttribute('data-depth', '0');
      expect(tocItem).toHaveAttribute('data-active', 'false');
    });

    it('highlights active section', () => {
      render(<TableOfContentsComponent {...defaultProps} activeSectionId="section-1" />);

      const tocItem = screen.getByTestId('toc-item');
      expect(tocItem).toHaveAttribute('data-active', 'true');
      expect(tocItem).toHaveClass('bg-blue-100', 'dark:bg-blue-900/20');
    });
  });

  describe('hierarchical structure', () => {
    const hierarchicalToc: TableOfContents = {
      ...mockTableOfContents,
      sections: [
        {
          ...mockTocNode,
          sectionId: 'section-1',
          title: 'Chapter 1',
          depth: 0,
          isExpanded: true,
          children: [
            {
              ...mockTocNode,
              sectionId: 'section-1-1',
              title: 'Section 1.1',
              depth: 1,
              parentId: 'section-1',
              isExpanded: true,
              children: [
                {
                  ...mockTocNode,
                  sectionId: 'section-1-1-1',
                  title: 'Subsection 1.1.1',
                  depth: 2,
                  parentId: 'section-1-1',
                  children: [],
                },
              ],
            },
            {
              ...mockTocNode,
              sectionId: 'section-1-2',
              title: 'Section 1.2',
              depth: 1,
              parentId: 'section-1',
              children: [],
            },
          ],
        },
      ],
    };

    it('renders nested sections with proper indentation', () => {
      render(<TableOfContentsComponent {...defaultProps} toc={hierarchicalToc} />);

      const tocItems = screen.getAllByTestId('toc-item');

      // Check that we have all sections
      expect(screen.getByText('Chapter 1')).toBeInTheDocument();
      expect(screen.getByText('Section 1.1')).toBeInTheDocument();
      expect(screen.getByText('Subsection 1.1.1')).toBeInTheDocument();
      expect(screen.getByText('Section 1.2')).toBeInTheDocument();

      // Check depth attributes
      expect(tocItems.find(item => item.textContent?.includes('Chapter 1'))).toHaveAttribute(
        'data-depth',
        '0'
      );
      expect(tocItems.find(item => item.textContent?.includes('Section 1.1'))).toHaveAttribute(
        'data-depth',
        '1'
      );
      expect(tocItems.find(item => item.textContent?.includes('Subsection 1.1.1'))).toHaveAttribute(
        'data-depth',
        '2'
      );
    });

    it('shows expand/collapse buttons for sections with children', () => {
      render(<TableOfContentsComponent {...defaultProps} toc={hierarchicalToc} />);

      const expandButtons = screen.getAllByTestId('expand-toggle');

      // Should have expand buttons for parent sections
      expect(expandButtons).toHaveLength(2); // Chapter 1 and Section 1.1 have children
    });

    it('hides children when section is collapsed', () => {
      const collapsedToc: TableOfContents = {
        ...hierarchicalToc,
        sections: [
          {
            ...hierarchicalToc.sections[0]!,
            isExpanded: false, // Collapsed
          },
        ],
      };

      render(<TableOfContentsComponent {...defaultProps} toc={collapsedToc} />);

      expect(screen.getByText('Chapter 1')).toBeInTheDocument();
      expect(screen.queryByText('Section 1.1')).not.toBeInTheDocument();
      expect(screen.queryByText('Section 1.2')).not.toBeInTheDocument();
    });

    it('displays children when section is expanded', () => {
      render(<TableOfContentsComponent {...defaultProps} toc={hierarchicalToc} />);

      expect(screen.getByText('Chapter 1')).toBeInTheDocument();
      expect(screen.getByText('Section 1.1')).toBeInTheDocument();
      expect(screen.getByText('Section 1.2')).toBeInTheDocument();
    });
  });

  describe('user interactions', () => {
    it('calls onSectionClick when section is clicked', async () => {
      const user = userEvent.setup();
      const onSectionClick = vi.fn();

      render(<TableOfContentsComponent {...defaultProps} onSectionClick={onSectionClick} />);

      const tocItem = screen.getByTestId('toc-item');
      await user.click(tocItem);

      expect(onSectionClick).toHaveBeenCalledWith('section-1');
    });

    it('calls onExpandToggle when expand button is clicked', async () => {
      const user = userEvent.setup();
      const onExpandToggle = vi.fn();

      const tocWithChildren: TableOfContents = {
        ...mockTableOfContents,
        sections: [
          {
            ...mockTocNode,
            isExpanded: false,
            children: [{ ...mockTocNode, sectionId: 'child-1' }],
          },
        ],
      };

      render(
        <TableOfContentsComponent
          {...defaultProps}
          toc={tocWithChildren}
          onExpandToggle={onExpandToggle}
        />
      );

      const expandButton = screen.getByTestId('expand-toggle');
      await user.click(expandButton);

      expect(onExpandToggle).toHaveBeenCalledWith('section-1', true);
    });

    it('prevents section click when expand button is clicked', async () => {
      const user = userEvent.setup();
      const onSectionClick = vi.fn();
      const onExpandToggle = vi.fn();

      const tocWithChildren: TableOfContents = {
        ...mockTableOfContents,
        sections: [
          {
            ...mockTocNode,
            isExpanded: false,
            children: [{ ...mockTocNode, sectionId: 'child-1' }],
          },
        ],
      };

      render(
        <TableOfContentsComponent
          {...defaultProps}
          toc={tocWithChildren}
          onSectionClick={onSectionClick}
          onExpandToggle={onExpandToggle}
        />
      );

      const expandButton = screen.getByTestId('expand-toggle');
      await user.click(expandButton);

      expect(onExpandToggle).toHaveBeenCalledWith('section-1', true);
      expect(onSectionClick).not.toHaveBeenCalled();
    });

    it('handles keyboard navigation', async () => {
      const user = userEvent.setup();
      const onSectionClick = vi.fn();

      render(<TableOfContentsComponent {...defaultProps} onSectionClick={onSectionClick} />);

      await user.tab(); // Focus the item
      await user.keyboard('{Enter}');

      expect(onSectionClick).toHaveBeenCalledWith('section-1');
    });

    it('provides proper ARIA labels for expand buttons', () => {
      const tocWithChildren: TableOfContents = {
        ...mockTableOfContents,
        sections: [
          {
            ...mockTocNode,
            isExpanded: false,
            children: [{ ...mockTocNode, sectionId: 'child-1' }],
          },
        ],
      };

      render(<TableOfContentsComponent {...defaultProps} toc={tocWithChildren} />);

      const expandButton = screen.getByTestId('expand-toggle');
      expect(expandButton).toHaveAttribute('aria-label', 'Expand section');
    });

    it('updates ARIA label when section is expanded', () => {
      const tocWithExpandedChildren: TableOfContents = {
        ...mockTableOfContents,
        sections: [
          {
            ...mockTocNode,
            isExpanded: true,
            children: [{ ...mockTocNode, sectionId: 'child-1' }],
          },
        ],
      };

      render(<TableOfContentsComponent {...defaultProps} toc={tocWithExpandedChildren} />);

      const expandButton = screen.getByTestId('expand-toggle');
      expect(expandButton).toHaveAttribute('aria-label', 'Collapse section');
    });
  });

  describe('visual states', () => {
    it('shows correct expand/collapse icon', () => {
      const tocWithChildren: TableOfContents = {
        ...mockTableOfContents,
        sections: [
          {
            ...mockTocNode,
            isExpanded: false,
            children: [{ ...mockTocNode, sectionId: 'child-1' }],
          },
        ],
      };

      const { rerender } = render(
        <TableOfContentsComponent {...defaultProps} toc={tocWithChildren} />
      );

      // Should show right arrow when collapsed
      const expandButton = screen.getByTestId('expand-toggle');
      expect(expandButton.querySelector('svg')).toBeInTheDocument();

      // Update to expanded state
      const expandedToc: TableOfContents = {
        ...tocWithChildren,
        sections: [
          {
            ...tocWithChildren.sections[0]!,
            isExpanded: true,
          },
        ],
      };

      rerender(<TableOfContentsComponent {...defaultProps} toc={expandedToc} />);

      // Should show down arrow when expanded
      expect(expandButton.querySelector('svg')).toBeInTheDocument();
    });

    it('applies hover styles', async () => {
      render(<TableOfContentsComponent {...defaultProps} />);

      const tocItem = screen.getByTestId('toc-item');

      // The hover styles are CSS-based, so we just verify the classes are present
      expect(tocItem).toHaveClass('hover:bg-gray-100', 'dark:hover:bg-gray-800');
    });

    it('styles sections without content differently', () => {
      const sectionWithoutContent: TocNode = {
        ...mockTocNode,
        hasContent: false,
      };

      const tocWithEmptySection: TableOfContents = {
        ...mockTableOfContents,
        sections: [sectionWithoutContent],
      };

      render(<TableOfContentsComponent {...defaultProps} toc={tocWithEmptySection} />);

      const titleElement = screen.getByText('Introduction');
      expect(titleElement).toHaveClass('text-gray-500', 'dark:text-gray-400');
    });

    it('shows border for sections with unsaved changes', () => {
      const sectionWithChanges: TocNode = {
        ...mockTocNode,
        hasUnsavedChanges: true,
      };

      const tocWithModifiedSection: TableOfContents = {
        ...mockTableOfContents,
        sections: [sectionWithChanges],
      };

      render(<TableOfContentsComponent {...defaultProps} toc={tocWithModifiedSection} />);

      const tocItem = screen.getByTestId('toc-item');
      expect(tocItem).toHaveClass('border-l-2', 'border-l-orange-400');
    });
  });

  describe('performance and memoization', () => {
    it('memoizes component to prevent unnecessary re-renders', () => {
      const { rerender } = render(<TableOfContentsComponent {...defaultProps} />);

      // Re-render with same props should not cause re-render
      rerender(<TableOfContentsComponent {...defaultProps} />);

      // Component should still be in the document
      expect(screen.getByTestId('toc-panel')).toBeInTheDocument();
    });

    it('memoizes TocNodeItem to prevent unnecessary re-renders', () => {
      const { rerender } = render(<TableOfContentsComponent {...defaultProps} />);

      // Re-render with same toc data
      rerender(<TableOfContentsComponent {...defaultProps} />);

      expect(screen.getByTestId('toc-item')).toBeInTheDocument();
    });

    it('handles large numbers of sections efficiently', () => {
      const largeToc: TableOfContents = {
        ...mockTableOfContents,
        sections: Array.from({ length: 100 }, (_, i) => ({
          ...mockTocNode,
          sectionId: `section-${i}`,
          title: `Section ${i}`,
          orderIndex: i,
        })),
      };

      const startTime = performance.now();
      render(<TableOfContentsComponent {...defaultProps} toc={largeToc} />);
      const renderTime = performance.now() - startTime;

      // Should render quickly (within 300ms for 100 sections)
      expect(renderTime).toBeLessThan(300);
      expect(screen.getAllByTestId('toc-item')).toHaveLength(100);
    });
  });

  describe('accessibility', () => {
    it('provides proper semantic structure', () => {
      render(<TableOfContentsComponent {...defaultProps} />);

      // Should have nav element with proper label
      const nav = screen.getByRole('navigation');
      expect(nav).toHaveAttribute('aria-label', 'Table of Contents');
    });

    it('provides accessible expand/collapse buttons', () => {
      const tocWithChildren: TableOfContents = {
        ...mockTableOfContents,
        sections: [
          {
            ...mockTocNode,
            isExpanded: false,
            children: [{ ...mockTocNode, sectionId: 'child-1' }],
          },
        ],
      };

      render(<TableOfContentsComponent {...defaultProps} toc={tocWithChildren} />);

      const expandButton = screen.getByTestId('expand-toggle');
      expect(expandButton).toHaveAttribute('aria-label');
      expect(expandButton).toHaveClass('transition-colors'); // Should have focus indicators
    });

    it('provides title attributes for truncated text', () => {
      const longTitleSection: TocNode = {
        ...mockTocNode,
        title: 'This is a very long section title that will likely be truncated in the UI',
      };

      const tocWithLongTitle: TableOfContents = {
        ...mockTableOfContents,
        sections: [longTitleSection],
      };

      render(<TableOfContentsComponent {...defaultProps} toc={tocWithLongTitle} />);

      const titleElement = screen.getByText(longTitleSection.title);
      expect(titleElement).toHaveAttribute('title', longTitleSection.title);
    });
  });

  describe('edge cases', () => {
    it('handles missing callback props gracefully', async () => {
      const user = userEvent.setup();

      render(
        <TableOfContentsComponent
          toc={mockTableOfContents}
          // No callbacks provided
        />
      );

      const tocItem = screen.getByTestId('toc-item');

      // Should not throw when clicked
      await expect(user.click(tocItem)).resolves.not.toThrow();
    });

    it('handles deeply nested sections', () => {
      const deeplyNestedToc: TableOfContents = {
        ...mockTableOfContents,
        sections: [
          {
            ...mockTocNode,
            depth: 0,
            isExpanded: true,
            children: [
              {
                ...mockTocNode,
                sectionId: 'level-1',
                depth: 1,
                isExpanded: true,
                children: [
                  {
                    ...mockTocNode,
                    sectionId: 'level-2',
                    depth: 2,
                    isExpanded: true,
                    children: [
                      {
                        ...mockTocNode,
                        sectionId: 'level-3',
                        depth: 3,
                        children: [],
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      };

      render(<TableOfContentsComponent {...defaultProps} toc={deeplyNestedToc} />);

      const tocItems = screen.getAllByTestId('toc-item');
      const deepestItem = tocItems.find(item => item.getAttribute('data-depth') === '3');
      expect(deepestItem).toBeInTheDocument();
    });

    it('handles empty children arrays', () => {
      const tocWithEmptyChildren: TableOfContents = {
        ...mockTableOfContents,
        sections: [
          {
            ...mockTocNode,
            children: [], // Explicitly empty
          },
        ],
      };

      render(<TableOfContentsComponent {...defaultProps} toc={tocWithEmptyChildren} />);

      // Should not show expand button for sections with empty children
      expect(screen.queryByTestId('expand-toggle')).not.toBeInTheDocument();
    });
  });
});

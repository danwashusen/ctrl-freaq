import { memo, useCallback, useMemo } from 'react';
import {
  ChevronDown,
  ChevronRight,
  FileText,
  CircleDot,
  CheckCircle,
  AlertCircle,
} from 'lucide-react';

import { cn } from '../../../lib/utils';
import type { TocNode, TableOfContents } from '../types/table-of-contents';
import type { SectionStatus } from '../types/section-view';

interface TableOfContentsProps {
  toc: TableOfContents;
  activeSectionId?: string | null;
  onSectionClick?: (sectionId: string) => void;
  onExpandToggle?: (sectionId: string, expanded: boolean) => void;
  className?: string;
}

interface TocNodeItemProps {
  node: TocNode;
  isActive?: boolean;
  onSectionClick?: (sectionId: string) => void;
  onExpandToggle?: (sectionId: string, expanded: boolean) => void;
}

const statusIcons: Record<SectionStatus, React.ComponentType<{ className?: string }>> = {
  idle: CircleDot,
  assumptions: AlertCircle,
  drafting: FileText,
  review: AlertCircle,
  ready: CheckCircle,
};

const statusColors: Record<SectionStatus, string> = {
  idle: 'text-gray-400',
  assumptions: 'text-yellow-500',
  drafting: 'text-blue-500',
  review: 'text-orange-500',
  ready: 'text-green-500',
};

const TocNodeItem = memo<TocNodeItemProps>(({ node, isActive, onSectionClick, onExpandToggle }) => {
  const StatusIcon = statusIcons[node.status];
  const hasChildren = node.children.length > 0;

  const handleClick = useCallback(() => {
    onSectionClick?.(node.sectionId);
  }, [node.sectionId, onSectionClick]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onSectionClick?.(node.sectionId);
      }
    },
    [node.sectionId, onSectionClick]
  );

  const handleExpandToggle = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onExpandToggle?.(node.sectionId, !node.isExpanded);
    },
    [node.sectionId, node.isExpanded, onExpandToggle]
  );

  return (
    <div
      className={cn(
        'group relative',
        `ml-${node.depth * 4}` // Dynamic indentation based on depth
      )}
    >
      <div
        className={cn(
          'flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors',
          'hover:bg-gray-100 dark:hover:bg-gray-800',
          isActive && 'bg-blue-100 text-blue-900 dark:bg-blue-900/20 dark:text-blue-100',
          node.hasUnsavedChanges && 'border-l-2 border-l-orange-400'
        )}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        tabIndex={0}
        role="button"
        data-testid={`toc-item`}
        data-section-id={node.sectionId}
        data-depth={node.depth}
        data-active={isActive || false}
      >
        {/* Expand/Collapse button */}
        {hasChildren && (
          <button
            onClick={handleExpandToggle}
            className="rounded p-0.5 transition-colors hover:bg-gray-200 dark:hover:bg-gray-700"
            data-testid="expand-toggle"
            aria-label={node.isExpanded ? 'Collapse section' : 'Expand section'}
          >
            {node.isExpanded ? (
              <ChevronDown className="h-3 w-3" />
            ) : (
              <ChevronRight className="h-3 w-3" />
            )}
          </button>
        )}

        {/* Status indicator */}
        <StatusIcon className={cn('h-3 w-3 shrink-0', statusColors[node.status])} />

        {/* Content indicator */}
        {!node.hasContent && (
          <div className="h-2 w-2 shrink-0 rounded-full bg-gray-300 dark:bg-gray-600" />
        )}

        {/* Section title */}
        <span
          className={cn('flex-1 truncate', !node.hasContent && 'text-gray-500 dark:text-gray-400')}
          title={node.title}
        >
          {node.title}
        </span>

        {/* Unsaved changes indicator */}
        {node.hasUnsavedChanges && (
          <div className="h-2 w-2 shrink-0 rounded-full bg-orange-400" title="Unsaved changes" />
        )}
      </div>

      {/* Children */}
      {hasChildren && node.isExpanded && (
        <div className="mt-1">
          {node.children.map(child => (
            <TocNodeItem
              key={child.sectionId}
              node={child}
              isActive={isActive}
              onSectionClick={onSectionClick}
              onExpandToggle={onExpandToggle}
            />
          ))}
        </div>
      )}
    </div>
  );
});

TocNodeItem.displayName = 'TocNodeItem';

export const TableOfContentsComponent = memo<TableOfContentsProps>(
  ({ toc, activeSectionId, onSectionClick, onExpandToggle, className }) => {
    const tocSections = useMemo(() => toc.sections, [toc.sections]);

    if (!tocSections.length) {
      return (
        <div
          className={cn('p-4 text-center text-gray-500 dark:text-gray-400', className)}
          data-testid="toc-empty"
        >
          <FileText className="mx-auto mb-2 h-8 w-8 opacity-50" />
          <p>No sections available</p>
        </div>
      );
    }

    return (
      <nav
        className={cn('space-y-1', className)}
        data-testid="toc-panel"
        aria-label="Table of Contents"
      >
        {tocSections.map(section => (
          <TocNodeItem
            key={section.sectionId}
            node={section}
            isActive={activeSectionId === section.sectionId}
            onSectionClick={onSectionClick}
            onExpandToggle={onExpandToggle}
          />
        ))}
      </nav>
    );
  }
);

TableOfContentsComponent.displayName = 'TableOfContents';

export default TableOfContentsComponent;

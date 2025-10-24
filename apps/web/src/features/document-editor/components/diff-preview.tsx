import { memo, useMemo } from 'react';
import { Plus, Minus, FileText } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card';
import { cn } from '../../../lib/utils';
import type { PendingChange } from '../types/pending-change';

interface DiffPreviewProps {
  changes: PendingChange[];
  title?: string;
  showStats?: boolean;
  className?: string;
}

interface DiffStats {
  additions: number;
  deletions: number;
  totalChanges: number;
}

interface DiffLine {
  type: 'add' | 'remove' | 'context';
  content: string;
  lineNumber?: number;
}

const parsePatchToDiffLines = (change: PendingChange): DiffLine[] => {
  const lines: DiffLine[] = [];

  // Simple diff generation from patches
  // In a real implementation, this would use the actual patch data
  const originalLines = change.originalContent.split('\n');
  const previewLines = change.previewContent.split('\n');

  // Basic line-by-line comparison
  let originalIndex = 0;
  let previewIndex = 0;

  while (originalIndex < originalLines.length || previewIndex < previewLines.length) {
    const originalLine = originalLines[originalIndex];
    const previewLine = previewLines[previewIndex];

    if (originalIndex >= originalLines.length) {
      // Only preview lines left (additions)
      lines.push({
        type: 'add',
        content: previewLine || '',
        lineNumber: previewIndex + 1,
      });
      previewIndex++;
    } else if (previewIndex >= previewLines.length) {
      // Only original lines left (deletions)
      lines.push({
        type: 'remove',
        content: originalLine || '',
        lineNumber: originalIndex + 1,
      });
      originalIndex++;
    } else if (originalLine === previewLine) {
      // Lines match (context)
      lines.push({
        type: 'context',
        content: originalLine || '',
        lineNumber: originalIndex + 1,
      });
      originalIndex++;
      previewIndex++;
    } else {
      // Lines differ - show both as remove/add
      lines.push({
        type: 'remove',
        content: originalLine || '',
        lineNumber: originalIndex + 1,
      });
      lines.push({
        type: 'add',
        content: previewLine || '',
        lineNumber: previewIndex + 1,
      });
      originalIndex++;
      previewIndex++;
    }
  }

  return lines;
};

const calculateStats = (changes: PendingChange[]): DiffStats => {
  let additions = 0;
  let deletions = 0;

  changes.forEach(change => {
    change.patches.forEach(patch => {
      switch (patch.op) {
        case 'add':
          additions++;
          break;
        case 'remove':
          deletions++;
          break;
        case 'replace':
          additions++;
          deletions++;
          break;
      }
    });
  });

  return {
    additions,
    deletions,
    totalChanges: additions + deletions,
  };
};

const DiffLineComponent = memo<{ line: DiffLine; showLineNumbers?: boolean }>(
  ({ line, showLineNumbers = true }) => {
    const lineClasses = {
      add: 'bg-green-50 dark:bg-green-900/20 border-l-4 border-l-green-500',
      remove: 'bg-red-50 dark:bg-red-900/20 border-l-4 border-l-red-500',
      context: 'bg-transparent',
    };

    const iconClasses = {
      add: 'text-green-600 dark:text-green-400',
      remove: 'text-red-600 dark:text-red-400',
      context: 'text-gray-400',
    };

    const Icon = line.type === 'add' ? Plus : line.type === 'remove' ? Minus : null;

    return (
      <div
        className={cn('flex items-start gap-2 px-3 py-1 font-mono text-sm', lineClasses[line.type])}
      >
        {/* Line type indicator */}
        <div className="flex h-5 w-4 shrink-0 items-center justify-center">
          {Icon ? (
            <Icon className={cn('h-3 w-3', iconClasses[line.type])} />
          ) : (
            <span className="text-gray-400">·</span>
          )}
        </div>

        {/* Line number */}
        {showLineNumbers && (
          <div className="w-8 shrink-0 select-none text-right text-gray-400">
            {line.lineNumber || ''}
          </div>
        )}

        {/* Content */}
        <div className="min-w-0 flex-1">
          <pre className="wrap-break-word whitespace-pre-wrap text-xs">{line.content || ' '}</pre>
        </div>
      </div>
    );
  }
);

DiffLineComponent.displayName = 'DiffLine';

export const DiffPreview = memo<DiffPreviewProps>(
  ({ changes, title = 'Changes Preview', showStats = true, className }) => {
    const stats = useMemo(() => calculateStats(changes), [changes]);

    const allDiffLines = useMemo(() => {
      if (!changes.length) return [];

      // For now, just show the first change
      // In a real implementation, you'd aggregate all changes
      const firstChange = changes[0];
      return firstChange ? parsePatchToDiffLines(firstChange) : [];
    }, [changes]);

    if (!changes.length) {
      return (
        <Card className={cn('', className)} data-testid="diff-preview-empty">
          <CardContent className="p-6 text-center text-gray-500 dark:text-gray-400">
            <FileText className="mx-auto mb-3 h-12 w-12 opacity-30" />
            <p>No changes to preview</p>
          </CardContent>
        </Card>
      );
    }

    return (
      <Card className={cn('', className)} data-testid="diff-preview">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">{title}</CardTitle>

            {showStats && (
              <div className="flex items-center gap-4 text-sm">
                <div className="flex items-center gap-1 text-green-600 dark:text-green-400">
                  <Plus className="h-3 w-3" />
                  <span>{stats.additions}</span>
                </div>
                <div className="flex items-center gap-1 text-red-600 dark:text-red-400">
                  <Minus className="h-3 w-3" />
                  <span>{stats.deletions}</span>
                </div>
                <div className="text-gray-500 dark:text-gray-400">
                  {stats.totalChanges} change{stats.totalChanges !== 1 ? 's' : ''}
                </div>
              </div>
            )}
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <div className="overflow-hidden rounded-md border border-gray-200 dark:border-gray-700">
            {/* File header */}
            <div className="border-b border-gray-200 bg-gray-50 px-3 py-2 dark:border-gray-700 dark:bg-gray-800">
              <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                <FileText className="h-4 w-4" />
                <span>Section Content</span>
                <span className="text-xs">
                  ({changes.length} pending change{changes.length !== 1 ? 's' : ''})
                </span>
              </div>
            </div>

            {/* Diff content */}
            <div className="max-h-96 overflow-y-auto">
              {allDiffLines.length > 0 ? (
                allDiffLines.map((line, index) => (
                  <DiffLineComponent key={index} line={line} showLineNumbers={true} />
                ))
              ) : (
                <div className="p-4 text-center text-gray-500 dark:text-gray-400">
                  <p>Unable to generate diff preview</p>
                </div>
              )}
            </div>
          </div>

          {/* Change metadata */}
          {changes.length > 0 && changes[0] && (
            <div className="bg-gray-50 p-3 text-xs text-gray-500 dark:bg-gray-800 dark:text-gray-400">
              <div className="flex items-center justify-between">
                <span>Created: {new Date(changes[0].createdAt).toLocaleString()}</span>
                <span>By: {changes[0].createdBy}</span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    );
  }
);

DiffPreview.displayName = 'DiffPreview';

export default DiffPreview;

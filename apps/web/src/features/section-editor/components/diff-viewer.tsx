import type { FC, ReactNode } from 'react';

import { cn } from '@/lib/utils';

import type { DiffResponseDTO, DiffSegmentDTO } from '../api/section-editor.mappers';

const segmentLabels: Record<DiffSegmentDTO['type'], string> = {
  added: 'Added',
  removed: 'Removed',
  unchanged: 'Unchanged',
  context: 'Context',
};

const segmentClasses: Record<DiffSegmentDTO['type'], string> = {
  added: 'border-emerald-200 bg-emerald-50 text-emerald-900',
  removed: 'border-rose-200 bg-rose-50 text-rose-900',
  unchanged: 'border-slate-200 bg-white text-slate-700',
  context: 'border-slate-200 bg-slate-50 text-slate-700',
};

export interface DiffViewerProps {
  diff: DiffResponseDTO | null;
  isLoading?: boolean;
  errorMessage?: string | null;
  emptyMessage?: string;
  className?: string;
  headerSlot?: ReactNode;
}

const renderLineInfo = (segment: DiffSegmentDTO) => {
  if (typeof segment.startLine !== 'number') {
    return null;
  }

  const range =
    segment.endLine && segment.endLine !== segment.startLine
      ? `${segment.startLine}–${segment.endLine}`
      : `${segment.startLine}`;

  return segment.type === 'removed' ? `Approved line ${range}` : `Draft line ${range}`;
};

export const DiffViewer: FC<DiffViewerProps> = ({
  diff,
  isLoading = false,
  errorMessage = null,
  emptyMessage = 'Run a manual save to generate a diff preview.',
  className,
  headerSlot,
}) => {
  return (
    <section
      className={cn(
        'flex w-full flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm',
        className
      )}
      role="region"
      aria-live="polite"
      data-testid="diff-viewer"
    >
      <header className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Draft vs Approved diff
          </p>
          <h2 className="text-sm font-semibold text-slate-900">
            {diff ? `${diff.mode === 'split' ? 'Split' : 'Unified'} view` : 'Preview unavailable'}
          </h2>
        </div>
        {headerSlot}
      </header>

      {isLoading && (
        <div
          className="flex h-40 items-center justify-center text-sm text-slate-500"
          aria-busy="true"
        >
          Loading diff…
        </div>
      )}

      {!isLoading && errorMessage && (
        <div className="px-5 py-4 text-sm text-rose-700">
          <p className="font-medium">Unable to load diff</p>
          <p className="mt-1 text-xs text-rose-600">{errorMessage}</p>
        </div>
      )}

      {!isLoading && !errorMessage && (!diff || diff.segments.length === 0) && (
        <div className="px-5 py-4 text-sm text-slate-500">{emptyMessage}</div>
      )}

      {!isLoading && !errorMessage && diff && diff.segments.length > 0 && (
        <div className="max-h-96 overflow-auto">
          <ol className="divide-y divide-slate-200" role="list">
            {diff.segments.map((segment, index) => (
              <li
                key={`${segment.type}-${segment.startLine ?? index}-${index}`}
                role="listitem"
                data-segment-type={segment.type}
                className={cn(
                  'border-l-4 px-5 py-4 font-mono text-sm leading-6',
                  segmentClasses[segment.type]
                )}
              >
                <div className="mb-2 flex items-center gap-3 text-xs uppercase tracking-wide">
                  <span className="rounded-full bg-black/10 px-2 py-0.5 font-semibold">
                    {segmentLabels[segment.type]}
                  </span>
                  {renderLineInfo(segment) && (
                    <span className="text-slate-600">{renderLineInfo(segment)}</span>
                  )}
                </div>
                <pre className="whitespace-pre-wrap break-words text-[13px] text-current">
                  {segment.content || '(empty line)'}
                </pre>
              </li>
            ))}
          </ol>
        </div>
      )}

      {diff?.metadata && (
        <footer className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-slate-200 px-5 py-3 text-xs text-slate-500">
          {typeof diff.metadata.approvedVersion === 'number' && (
            <span>Approved v{diff.metadata.approvedVersion}</span>
          )}
          {typeof diff.metadata.draftVersion === 'number' && (
            <span>Draft v{diff.metadata.draftVersion}</span>
          )}
          {diff.metadata.generatedAt && (
            <span>Generated {new Date(diff.metadata.generatedAt).toLocaleString()}</span>
          )}
        </footer>
      )}
    </section>
  );
};

export default DiffViewer;

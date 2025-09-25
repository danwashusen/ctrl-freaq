import { memo, useMemo } from 'react';
import type { ReactElement } from 'react';
import { CheckCircle2, Clock, PencilLine, ShieldAlert, UserCheck } from 'lucide-react';

import { Button } from '../../../components/ui/button';
import { Card, CardContent, CardHeader } from '../../../components/ui/card';
import { cn } from '../../../lib/utils';
import type { SectionStatus, SectionView } from '../types/section-view';

interface SectionApprovalMetadata {
  approvedVersion?: number | null;
  approvedAt?: string | null;
  approvedBy?: string | null;
  reviewerSummary?: string | null;
}

// SectionView will be extended in later tasks with approval metadata fields.
type SectionViewWithApproval = SectionView &
  Partial<{
    approvedVersion: number | null;
    approvedAt: string | null;
    approvedBy: string | null;
    lastSummary: string | null;
  }>;

const statusLabels: Record<SectionStatus, string> = {
  idle: 'Draft (Idle)',
  assumptions: 'Assumptions Pending',
  drafting: 'Draft In Progress',
  review: 'In Review',
  ready: 'Approved',
};

const statusIcon: Record<SectionStatus, ReactElement> = {
  idle: <ShieldAlert className="h-4 w-4" aria-hidden="true" />,
  assumptions: <ShieldAlert className="h-4 w-4" aria-hidden="true" />,
  drafting: <PencilLine className="h-4 w-4" aria-hidden="true" />,
  review: <UserCheck className="h-4 w-4" aria-hidden="true" />,
  ready: <CheckCircle2 className="h-4 w-4" aria-hidden="true" />,
};

const buildSummary = (
  section: SectionViewWithApproval,
  approval?: SectionApprovalMetadata
): string => {
  const summary = approval?.reviewerSummary ?? section.lastSummary ?? '';
  return summary.trim().length > 0 ? summary : 'Reviewer summary unavailable';
};

const resolveApprovedAt = (
  section: SectionViewWithApproval,
  approval?: SectionApprovalMetadata
): string | null => {
  const timestamp = approval?.approvedAt ?? section.approvedAt ?? section.lastModified;
  return timestamp ? new Date(timestamp).toISOString() : null;
};

const resolveApprovedBy = (
  section: SectionViewWithApproval,
  approval?: SectionApprovalMetadata
): string | undefined => {
  const approver = approval?.approvedBy ?? section.approvedBy ?? null;
  return approver ?? undefined;
};

const resolveApprovedVersion = (
  section: SectionViewWithApproval,
  approval?: SectionApprovalMetadata
): number | null => {
  const version = approval?.approvedVersion ?? section.approvedVersion ?? null;
  return version ?? null;
};

export interface DocumentSectionPreviewProps {
  section: SectionViewWithApproval;
  approval?: SectionApprovalMetadata;
  onEnterEdit?: (sectionId: string) => void;
  isEditDisabled?: boolean;
  className?: string;
}

export const DocumentSectionPreview = memo<DocumentSectionPreviewProps>(
  ({ section, approval, onEnterEdit, isEditDisabled = false, className }) => {
    const handleEnterEdit = () => {
      onEnterEdit?.(section.id);
    };

    const approvedAt = resolveApprovedAt(section, approval);
    const approvedBy = resolveApprovedBy(section, approval);
    const approvedVersion = resolveApprovedVersion(section, approval);

    const statusLabel = statusLabels[section.status] ?? section.status;
    const statusIndicator = statusIcon[section.status] ?? (
      <ShieldAlert className="h-4 w-4" aria-hidden="true" />
    );

    const summary = useMemo(() => buildSummary(section, approval), [section, approval]);

    return (
      <Card
        className={cn('w-full border border-gray-200 shadow-sm dark:border-gray-800', className)}
        data-testid="section-preview"
      >
        <CardHeader className="flex flex-col gap-3 pb-3">
          <div className="flex items-start justify-between gap-4">
            <div className="flex flex-col gap-2">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-50">
                {section.title}
              </h2>
              <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
                <span
                  className={cn(
                    'inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium',
                    section.status === 'ready'
                      ? 'bg-emerald-100 text-emerald-900 dark:bg-emerald-900/60 dark:text-emerald-100'
                      : section.status === 'review'
                        ? 'bg-blue-100 text-blue-900 dark:bg-blue-900/60 dark:text-blue-100'
                        : 'bg-gray-100 text-gray-800 dark:bg-gray-800/60 dark:text-gray-100'
                  )}
                  data-testid="section-approval-status"
                >
                  {statusIndicator}
                  <span>{statusLabel}</span>
                </span>

                {approvedVersion !== null && (
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    v{approvedVersion}
                  </span>
                )}
              </div>
            </div>

            <Button
              size="sm"
              onClick={handleEnterEdit}
              disabled={isEditDisabled}
              data-testid="enter-edit"
            >
              <PencilLine className="mr-1 h-4 w-4" aria-hidden="true" />
              Edit Section
            </Button>
          </div>

          <div className="flex flex-col gap-1 text-sm" aria-live="polite">
            <div className="flex items-center gap-2" data-testid="section-reviewer-summary">
              <UserCheck className="h-4 w-4 text-gray-500" aria-hidden="true" />
              <span className="text-gray-700 dark:text-gray-200">{summary}</span>
            </div>
            <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
              <span
                className="inline-flex items-center gap-1"
                data-testid="section-approved-timestamp"
              >
                <Clock className="h-3 w-3" aria-hidden="true" />
                {approvedAt ?? 'Unknown timestamp'}
              </span>
              {approvedBy && (
                <span className="inline-flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
                  Approved by {approvedBy}
                </span>
              )}
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="prose prose-sm dark:prose-invert max-w-none text-gray-800 dark:text-gray-100">
            {section.hasContent ? (
              <article data-testid="section-preview-content">
                {section.contentMarkdown.split('\n').map((line, index) => (
                  <p key={index} className="mb-2 last:mb-0">
                    {line.trim().length > 0 ? line : '\u00A0'}
                  </p>
                ))}
              </article>
            ) : (
              <div className="rounded-md border border-dashed border-gray-300 p-6 text-sm text-gray-500 dark:border-gray-700 dark:text-gray-300">
                {section.placeholderText || 'No content yet for this section.'}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }
);

DocumentSectionPreview.displayName = 'DocumentSectionPreview';

export default DocumentSectionPreview;

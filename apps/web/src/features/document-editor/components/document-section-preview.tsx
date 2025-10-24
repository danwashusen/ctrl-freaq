import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactElement } from 'react';
import { CheckCircle2, Clock, PencilLine, ShieldAlert, UserCheck } from 'lucide-react';

import { Button } from '../../../components/ui/button';
import { Card, CardContent, CardHeader } from '../../../components/ui/card';
import { cn } from '../../../lib/utils';
import { useAuth } from '@/lib/auth-provider';
import { DraftStatusBadge } from './section-draft/DraftStatusBadge';
import type { AssumptionFlowState } from '../assumptions-flow';
import type { SectionStatus, SectionView } from '../types/section-view';
import { SectionQualityStatusChip, SectionRemediationList } from '../quality-gates/components';
import { useQualityGates } from '../quality-gates/hooks';
import { sectionQualityStore } from '../quality-gates/stores/section-quality-store';
import { createDocQualityTranslator } from '@/lib/i18n';

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
  assumptionSession?: AssumptionFlowState | null;
  documentId?: string;
  projectSlug: string;
  approval?: SectionApprovalMetadata;
  onEnterEdit?: (sectionId: string) => void;
  isEditDisabled?: boolean;
  className?: string;
}

export const DocumentSectionPreview = memo<DocumentSectionPreviewProps>(
  ({
    section,
    assumptionSession,
    documentId,
    projectSlug,
    approval,
    onEnterEdit,
    isEditDisabled = false,
    className,
  }) => {
    const [isAssumptionModalOpen, setAssumptionModalOpen] = useState(false);
    const unresolvedCount = assumptionSession?.promptsRemaining ?? 0;
    const overridesOpen = assumptionSession?.overridesOpen ?? 0;
    const prompts = assumptionSession?.prompts ?? [];

    useEffect(() => {
      if (!assumptionSession && isAssumptionModalOpen) {
        setAssumptionModalOpen(false);
      }
    }, [assumptionSession, isAssumptionModalOpen]);

    const handleEnterEdit = () => {
      onEnterEdit?.(section.id);
    };

    const handleOpenAssumptionModal = () => setAssumptionModalOpen(true);
    const handleCloseAssumptionModal = () => setAssumptionModalOpen(false);

    const approvedAt = resolveApprovedAt(section, approval);
    const approvedBy = resolveApprovedBy(section, approval);
    const approvedVersion = resolveApprovedVersion(section, approval);

    const statusLabel = statusLabels[section.status] ?? section.status;
    const statusIndicator = statusIcon[section.status] ?? (
      <ShieldAlert className="h-4 w-4" aria-hidden="true" />
    );

    const summary = useMemo(() => buildSummary(section, approval), [section, approval]);

    const auth = useAuth();
    const authorId = auth.userId ?? 'user-local-author';
    const qualityGates = useQualityGates({
      sectionId: section.id,
      documentId: documentId ?? null,
    });
    const {
      status: qualityStatus,
      statusMessage: qualityStatusMessage,
      timeoutCopy: qualityTimeoutCopy,
      lastStatus: qualityLastStatus,
      incidentId: qualityIncidentId,
      blockerCount: qualityBlockerCount,
      isSubmissionBlocked: qualityIsSubmissionBlocked,
      remediation: qualityRemediation,
      runSection: runSectionMutation,
    } = qualityGates;
    const hasAutoRun = useRef(false);
    const autoRunTimerRef = useRef<number | null>(null);
    const docQualityTranslator = useMemo(() => createDocQualityTranslator(), []);
    const [isInitialAutoRun, setInitialAutoRun] = useState(false);

    useEffect(() => {
      if (qualityLastStatus === null) {
        return;
      }

      if (hasAutoRun.current || qualityLastStatus === 'Neutral') {
        return;
      }

      hasAutoRun.current = true;
      setInitialAutoRun(true);
      if (typeof window !== 'undefined') {
        if (autoRunTimerRef.current) {
          window.clearTimeout(autoRunTimerRef.current);
        }
        autoRunTimerRef.current = window.setTimeout(() => {
          setInitialAutoRun(false);
          autoRunTimerRef.current = null;
        }, 750);
      }
      sectionQualityStore.getState().beginValidation({
        requestId: `auto-${section.id}`,
        triggeredBy: 'system-auto',
        startedAt: Date.now(),
        source: 'auto',
      });
      void runSectionMutation({ reason: 'auto' });
    }, [qualityLastStatus, runSectionMutation, section.id]);

    useEffect(() => {
      return () => {
        if (typeof window !== 'undefined' && autoRunTimerRef.current) {
          window.clearTimeout(autoRunTimerRef.current);
          autoRunTimerRef.current = null;
        }
      };
    }, []);

    const handleManualRun = useCallback(async () => {
      setInitialAutoRun(false);
      if (typeof window !== 'undefined' && autoRunTimerRef.current) {
        window.clearTimeout(autoRunTimerRef.current);
        autoRunTimerRef.current = null;
      }
      await runSectionMutation({ reason: 'manual' });
    }, [runSectionMutation]);

    const chipStatus = isInitialAutoRun ? 'validating' : qualityStatus;
    const chipStatusMessage = isInitialAutoRun
      ? docQualityTranslator.status('validating')
      : qualityStatusMessage;
    const chipLastStatus = isInitialAutoRun ? null : qualityLastStatus;
    const chipTimeoutCopy = isInitialAutoRun ? null : qualityTimeoutCopy;
    const chipIncidentId = isInitialAutoRun ? null : qualityIncidentId;
    const chipBlockerCount = qualityBlockerCount;

    return (
      <Card
        className={cn('shadow-xs w-full border border-gray-200 dark:border-gray-800', className)}
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

              {documentId && (
                <DraftStatusBadge
                  projectSlug={projectSlug}
                  documentSlug={documentId}
                  sectionTitle={section.title}
                  sectionPath={section.id}
                  authorId={authorId}
                />
              )}
            </div>

            <div className="flex flex-col items-end gap-3">
              <div className="flex items-center gap-2">
                {assumptionSession && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleOpenAssumptionModal}
                    data-testid="assumption-conflict-trigger"
                  >
                    <ShieldAlert className="mr-1 h-4 w-4" aria-hidden="true" />
                    Review Assumptions
                    <span className="ml-2 rounded bg-amber-200 px-1 py-0.5 text-xs font-semibold text-amber-900">
                      {overridesOpen}
                    </span>
                  </Button>
                )}

                <Button
                  size="sm"
                  onClick={handleEnterEdit}
                  disabled={isEditDisabled}
                  data-testid="enter-edit"
                  aria-label="Enter edit mode"
                  className="bg-blue-600 text-white hover:bg-blue-700 focus-visible:ring-blue-500"
                >
                  <PencilLine className="mr-1 h-4 w-4" aria-hidden="true" />
                  Edit Section
                </Button>
              </div>

              <div className="w-full min-w-[18rem] max-w-xs">
                <SectionQualityStatusChip
                  status={chipStatus}
                  statusMessage={chipStatusMessage}
                  timeoutCopy={chipTimeoutCopy}
                  lastStatus={chipLastStatus}
                  incidentId={chipIncidentId}
                  isSubmissionBlocked={qualityIsSubmissionBlocked}
                  blockerCount={chipBlockerCount}
                  onRun={handleManualRun}
                  onRetry={handleManualRun}
                />
              </div>
            </div>
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
              {assumptionSession && (
                <span className="inline-flex items-center gap-1 rounded bg-amber-100 px-2 py-1 text-amber-900 dark:bg-amber-900/40 dark:text-amber-100">
                  <ShieldAlert className="h-3 w-3" aria-hidden="true" />
                  <span>Unresolved</span>
                  <span data-testid="assumption-unresolved-count">{unresolvedCount}</span>
                </span>
              )}
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {qualityRemediation.length > 0 && (
            <div className="space-y-3" data-testid="section-quality-remediation">
              <SectionRemediationList items={qualityRemediation} />
            </div>
          )}

          <div
            className="prose prose-sm dark:prose-invert max-w-none text-gray-800 dark:text-gray-100"
            data-testid={`section-${section.id}`}
          >
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

        {assumptionSession && isAssumptionModalOpen && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
            data-testid="assumption-conflict-modal"
            role="dialog"
            aria-modal="true"
          >
            <div className="w-full max-w-lg rounded-lg bg-white p-6 shadow-xl dark:bg-gray-900">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                    Assumption Checklist
                  </h3>
                  {documentId && (
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Document {documentId}
                    </p>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleCloseAssumptionModal}
                  aria-label="Close assumption conflicts"
                >
                  X
                </Button>
              </div>

              <div className="mt-4 space-y-3">
                <div className="flex items-center gap-2 text-sm text-amber-700 dark:text-amber-300">
                  <ShieldAlert className="h-4 w-4" aria-hidden="true" />
                  <span data-testid="assumption-unresolved-count">
                    Unresolved items: {unresolvedCount}
                  </span>
                </div>

                {assumptionSession?.summaryMarkdown && (
                  <div className="rounded border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900 dark:border-blue-900/50 dark:bg-blue-900/30 dark:text-blue-100">
                    <p className="font-medium">Session Summary</p>
                    <p className="mt-1 whitespace-pre-line">{assumptionSession.summaryMarkdown}</p>
                  </div>
                )}

                <div
                  className="max-h-64 space-y-3 overflow-y-auto"
                  data-testid="assumption-prompts"
                >
                  {prompts.map(prompt => (
                    <div
                      key={prompt.id}
                      className="rounded border border-gray-200 p-3 text-sm dark:border-gray-700"
                      data-testid="assumption-entry"
                    >
                      <p className="font-medium text-gray-900 dark:text-gray-100">
                        {prompt.heading}
                      </p>
                      <p className="text-gray-600 dark:text-gray-400">{prompt.body}</p>
                      <p className="mt-2 text-xs uppercase text-gray-500 dark:text-gray-400">
                        Status: {prompt.status.replace('_', ' ')}
                      </p>
                      {prompt.overrideJustification && (
                        <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">
                          Override: {prompt.overrideJustification}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </Card>
    );
  }
);

DocumentSectionPreview.displayName = 'DocumentSectionPreview';

export default DocumentSectionPreview;

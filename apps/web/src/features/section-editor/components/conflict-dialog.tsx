import type { FC, ReactNode } from 'react';
import { CheckCircle2, FileDiff, Loader2, RefreshCw, ShieldCheck } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

import type { ConflictLogEntryDTO, RebasedDraftDTO } from '../api/section-editor.mappers';

const stateMessages: Record<'clean' | 'rebase_required' | 'rebased' | 'blocked', string> = {
  clean: 'The draft is up to date and ready to continue.',
  rebase_required:
    'Another teammate published a newer approved version. Rebase to merge their changes before you keep editing.',
  rebased:
    'A fresh draft has been prepared with the latest approved content. Review the changes below before continuing.',
  blocked:
    'Automatic rebase failed. Review the conflict details and manually copy your changes before trying again.',
};

const describeEvent = (event: ConflictLogEntryDTO) => {
  const action = event.detectedDuring === 'entry' ? 'Entering edit mode' : 'Saving the draft';
  const versionSpan = `v${event.previousApprovedVersion} → v${event.latestApprovedVersion}`;
  const resolution = event.resolvedBy
    ? `Resolution: ${event.resolvedBy.replace(/_/g, ' ')}`
    : 'Resolution pending';

  return `${action} detected a new approval ${versionSpan}. ${resolution}`;
};

export interface ConflictDialogProps {
  open: boolean;
  conflictState: 'clean' | 'rebase_required' | 'rebased' | 'blocked';
  conflictReason?: string | null;
  latestApprovedVersion?: number | null;
  rebasedDraft?: RebasedDraftDTO | null;
  events?: ConflictLogEntryDTO[];
  serverSnapshot?: {
    version: number;
    content: string;
    capturedAt?: string | null;
  } | null;
  resolutionNote?: string | null;
  refreshStep?: ConflictDialogStepDescriptor;
  diffStep?: ConflictDialogStepDescriptor;
  reapplyStep?: ConflictDialogStepDescriptor;
  isProcessing?: boolean;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm?: () => void;
  onCancel?: () => void;
  className?: string;
}

type ConflictStepStatus = 'idle' | 'pending' | 'done';

export interface ConflictDialogStepDescriptor {
  status: ConflictStepStatus;
  onClick: () => void;
  disabled?: boolean;
  icon?: ReactNode;
  label?: string;
  description?: string;
}

const DEFAULT_STEP_CONTENT: Record<
  'refresh' | 'diff' | 'reapply',
  { label: string; description: string; icon: ReactNode }
> = {
  refresh: {
    label: '1. Refresh section',
    description: 'Pull the latest approved content into the editor before continuing.',
    icon: <RefreshCw className="h-4 w-4" aria-hidden="true" />,
  },
  diff: {
    label: '2. Review incoming diff',
    description: 'Open the diff viewer to compare teammate updates with your draft.',
    icon: <FileDiff className="h-4 w-4" aria-hidden="true" />,
  },
  reapply: {
    label: '3. Reapply your draft',
    description: 'Restore your cached edits on top of the refreshed content.',
    icon: <ShieldCheck className="h-4 w-4" aria-hidden="true" />,
  },
};

const renderStepStatus = (status: ConflictStepStatus) => {
  if (status === 'pending') {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-amber-600" aria-live="polite">
        <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
        Working…
      </span>
    );
  }
  if (status === 'done') {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-emerald-600" aria-live="polite">
        <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
        Complete
      </span>
    );
  }
  return null;
};

export const ConflictDialog: FC<ConflictDialogProps> = ({
  open,
  conflictState,
  conflictReason,
  latestApprovedVersion,
  rebasedDraft,
  events,
  serverSnapshot,
  resolutionNote,
  refreshStep,
  diffStep,
  reapplyStep,
  isProcessing = false,
  confirmLabel = 'Rebase and continue',
  cancelLabel = 'Cancel',
  onConfirm,
  onCancel,
  className,
}) => {
  if (!open) {
    return null;
  }

  const dialogTitleId = 'section-conflict-dialog-title';
  const descriptionId = 'section-conflict-dialog-description';
  const hasGuidedSteps = Boolean(refreshStep || diffStep || reapplyStep);
  const shouldRenderFooter = Boolean(onConfirm) && !hasGuidedSteps;

  return (
    <div
      className={cn(
        'backdrop-blur-xs fixed inset-0 z-50 flex items-center justify-center bg-black/40',
        className
      )}
      data-testid="conflict-dialog-backdrop"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={dialogTitleId}
        aria-describedby={descriptionId}
        data-testid="conflict-dialog"
        className="focus:outline-hidden w-full max-w-xl rounded-lg border border-slate-200 bg-white shadow-xl"
      >
        <header className="border-b border-slate-200 px-6 py-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-600">
            Draft conflict detected
          </p>
          <h2 id={dialogTitleId} className="mt-1 text-lg font-semibold text-slate-900">
            Rebase required before continuing
          </h2>
        </header>

        <div id={descriptionId} className="space-y-4 px-6 py-4 text-sm text-slate-700">
          <p>{stateMessages[conflictState]}</p>

          {conflictReason && (
            <div
              className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-amber-900"
              data-testid="conflict-reason"
            >
              <span className="font-medium">Why this happened:</span> <span>{conflictReason}</span>
            </div>
          )}

          {typeof latestApprovedVersion === 'number' && (
            <div className="flex items-center gap-3 text-xs text-slate-500">
              <span className="rounded-full bg-slate-100 px-3 py-1 font-semibold text-slate-700">
                Approved version
              </span>
              <span>v{latestApprovedVersion}</span>
            </div>
          )}

          {resolutionNote && (
            <div
              className="rounded-md border border-blue-200 bg-blue-50 px-4 py-3 text-xs text-blue-900"
              data-testid="conflict-resolution-note"
            >
              {resolutionNote}
            </div>
          )}

          {hasGuidedSteps ? (
            <ol className="space-y-3" aria-live="polite">
              {refreshStep ? (
                <li
                  data-testid="conflict-resolution-step"
                  data-step="refresh"
                  data-status={refreshStep.status}
                  className="rounded-md border border-slate-200 bg-slate-50 px-4 py-3"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                      {refreshStep.icon ?? DEFAULT_STEP_CONTENT.refresh.icon}
                      {refreshStep.label ?? DEFAULT_STEP_CONTENT.refresh.label}
                    </div>
                    {renderStepStatus(refreshStep.status)}
                  </div>
                  <p className="mt-1 text-xs text-slate-600">
                    {refreshStep.description ?? DEFAULT_STEP_CONTENT.refresh.description}
                  </p>
                  <div className="mt-3 flex justify-end">
                    <Button
                      size="sm"
                      variant="secondary"
                      data-testid="conflict-step-refresh"
                      onClick={refreshStep.onClick}
                      disabled={
                        refreshStep.disabled ||
                        refreshStep.status === 'pending' ||
                        refreshStep.status === 'done'
                      }
                    >
                      Refresh section
                    </Button>
                  </div>
                </li>
              ) : null}

              {diffStep ? (
                <li
                  data-testid="conflict-resolution-step"
                  data-step="diff"
                  data-status={diffStep.status}
                  className="rounded-md border border-slate-200 bg-slate-50 px-4 py-3"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                      {diffStep.icon ?? DEFAULT_STEP_CONTENT.diff.icon}
                      {diffStep.label ?? DEFAULT_STEP_CONTENT.diff.label}
                    </div>
                    {renderStepStatus(diffStep.status)}
                  </div>
                  <p className="mt-1 text-xs text-slate-600">
                    {diffStep.description ?? DEFAULT_STEP_CONTENT.diff.description}
                  </p>
                  <div className="mt-3 flex justify-end">
                    <Button
                      size="sm"
                      variant="secondary"
                      data-testid="conflict-step-open-diff"
                      onClick={diffStep.onClick}
                      disabled={
                        diffStep.disabled ||
                        diffStep.status === 'pending' ||
                        diffStep.status === 'done'
                      }
                    >
                      Open diff
                    </Button>
                  </div>
                </li>
              ) : null}

              {reapplyStep ? (
                <li
                  data-testid="conflict-resolution-step"
                  data-step="reapply"
                  data-status={reapplyStep.status}
                  className="rounded-md border border-slate-200 bg-slate-50 px-4 py-3"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                      {reapplyStep.icon ?? DEFAULT_STEP_CONTENT.reapply.icon}
                      {reapplyStep.label ?? DEFAULT_STEP_CONTENT.reapply.label}
                    </div>
                    {renderStepStatus(reapplyStep.status)}
                  </div>
                  <p className="mt-1 text-xs text-slate-600">
                    {reapplyStep.description ?? DEFAULT_STEP_CONTENT.reapply.description}
                  </p>
                  <div className="mt-3 flex justify-end">
                    <Button
                      size="sm"
                      variant="default"
                      data-testid="conflict-step-reapply"
                      onClick={reapplyStep.onClick}
                      disabled={
                        reapplyStep.disabled ||
                        reapplyStep.status === 'pending' ||
                        reapplyStep.status === 'done'
                      }
                    >
                      Reapply cached draft
                    </Button>
                  </div>
                </li>
              ) : null}
            </ol>
          ) : null}

          {events && events.length > 0 && (
            <section aria-live="polite">
              <h3 className="text-sm font-semibold text-slate-900">Recent conflict activity</h3>
              <ul className="mt-2 max-h-36 space-y-2 overflow-y-auto">
                {events.map(event => (
                  <li
                    key={`${event.detectedAt}-${event.detectedDuring}`}
                    className="rounded-md border border-slate-200 bg-slate-50 px-4 py-2"
                  >
                    <p className="text-sm font-medium text-slate-800">{describeEvent(event)}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      {new Date(event.detectedAt).toLocaleString()}
                    </p>
                    {event.resolutionNote && (
                      <p className="mt-1 text-xs text-slate-500">{event.resolutionNote}</p>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {rebasedDraft?.contentMarkdown && (
            <section>
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-900">Rebased draft preview</h3>
                {typeof rebasedDraft.draftVersion === 'number' && (
                  <span className="text-xs text-slate-500">Draft v{rebasedDraft.draftVersion}</span>
                )}
              </div>
              <pre
                className="mt-2 max-h-52 overflow-y-auto whitespace-pre-wrap rounded-md border border-slate-200 bg-slate-100 px-4 py-3 text-xs text-slate-700"
                data-testid="conflict-rebased-preview"
              >
                {rebasedDraft.contentMarkdown}
              </pre>
            </section>
          )}

          {serverSnapshot && (
            <section className="mt-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-900">Server version snapshot</h3>
                <div className="flex flex-col items-end text-xs text-slate-500">
                  <span>v{serverSnapshot.version}</span>
                  {serverSnapshot.capturedAt && (
                    <span>{new Date(serverSnapshot.capturedAt).toLocaleString()}</span>
                  )}
                </div>
              </div>
              <pre
                className="mt-2 max-h-52 overflow-y-auto whitespace-pre-wrap rounded-md border border-slate-200 bg-white px-4 py-3 text-xs text-slate-700"
                data-testid="conflict-server-preview"
              >
                {serverSnapshot.content}
              </pre>
            </section>
          )}
        </div>

        <footer className="flex items-center justify-end gap-2 border-t border-slate-200 px-6 py-4">
          {onCancel && (
            <Button
              variant="ghost"
              onClick={onCancel}
              data-testid="dismiss-conflict"
              disabled={isProcessing}
            >
              {cancelLabel}
            </Button>
          )}
          {shouldRenderFooter ? (
            <Button
              variant="default"
              onClick={onConfirm}
              data-testid="confirm-rebase"
              disabled={isProcessing}
              aria-busy={isProcessing}
              className="bg-amber-600 hover:bg-amber-700 focus-visible:ring-amber-600"
            >
              {isProcessing ? 'Applying…' : confirmLabel}
            </Button>
          ) : null}
        </footer>
      </div>
    </div>
  );
};

export default ConflictDialog;

import type { FC } from 'react';

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
  isProcessing?: boolean;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel?: () => void;
  className?: string;
}

export const ConflictDialog: FC<ConflictDialogProps> = ({
  open,
  conflictState,
  conflictReason,
  latestApprovedVersion,
  rebasedDraft,
  events,
  serverSnapshot,
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

  return (
    <div
      className={cn(
        'fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm',
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
        className="w-full max-w-xl rounded-lg border border-slate-200 bg-white shadow-xl focus:outline-none"
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
        </footer>
      </div>
    </div>
  );
};

export default ConflictDialog;

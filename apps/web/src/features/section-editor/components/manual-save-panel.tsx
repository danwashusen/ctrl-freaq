import type { ChangeEvent, FC } from 'react';
import { useMemo } from 'react';

import { AlertTriangle, Clock, Loader2, RefreshCw, Save, ShieldCheck } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

import type { FormattingAnnotation } from '../hooks/use-section-draft';

const conflictStateCopy: Record<
  'clean' | 'rebase_required' | 'rebased' | 'blocked',
  { label: string; description: string; tone: string; icon: typeof ShieldCheck }
> = {
  clean: {
    label: 'Draft is clean',
    description: 'Ready to submit once you are finished editing.',
    tone: 'text-emerald-800',
    icon: ShieldCheck,
  },
  rebase_required: {
    label: 'Rebase required',
    description: 'A teammate published a newer version. Refresh the section before you continue.',
    tone: 'text-amber-600',
    icon: RefreshCw,
  },
  rebased: {
    label: 'Draft rebased',
    description: 'Review the merged draft before saving again.',
    tone: 'text-blue-600',
    icon: RefreshCw,
  },
  blocked: {
    label: 'Manual resolution needed',
    description:
      'Conflicts must be resolved manually. Compare the diff and copy your updates forward.',
    tone: 'text-rose-600',
    icon: AlertTriangle,
  },
};

type FormattingWarning = Pick<FormattingAnnotation, 'id' | 'message' | 'severity'>;

export interface ManualSavePanelProps {
  summaryNote: string;
  onSummaryChange: (summary: string) => void;
  onManualSave: () => void;
  isSaving: boolean;
  formattingWarnings?: FormattingWarning[];
  conflictState?: 'clean' | 'rebase_required' | 'rebased' | 'blocked';
  conflictReason?: string | null;
  lastSavedAt?: string | null;
  lastSavedBy?: string | null;
  lastManualSaveAt?: number | null;
  saveErrorMessage?: string | null;
  onOpenDiff?: () => void;
  onSubmitReview?: () => void;
  isDiffLoading?: boolean;
  disableManualSave?: boolean;
  isReviewDisabled?: boolean;
  reviewDisabledReason?: string | null;
  className?: string;
}

const formatTimestamp = (input?: string | number | null) => {
  if (!input) {
    return null;
  }

  const date = typeof input === 'number' ? new Date(input) : new Date(input);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toLocaleString();
};

const severityStyles: Record<'warning' | 'error', string> = {
  warning: 'border-amber-200 bg-amber-50 text-amber-900',
  error: 'border-rose-200 bg-rose-50 text-rose-900',
};

export const ManualSavePanel: FC<ManualSavePanelProps> = ({
  summaryNote,
  onSummaryChange,
  onManualSave,
  isSaving,
  formattingWarnings = [],
  conflictState = 'clean',
  conflictReason,
  lastSavedAt,
  lastSavedBy,
  lastManualSaveAt,
  saveErrorMessage,
  onOpenDiff,
  onSubmitReview,
  isDiffLoading = false,
  disableManualSave = false,
  isReviewDisabled = false,
  reviewDisabledReason,
  className,
}) => {
  const conflictCopy = conflictStateCopy[conflictState];
  const ConflictIcon = conflictCopy.icon;

  const manualSaveDescription = useMemo(() => {
    const manualSaveTime = formatTimestamp(lastManualSaveAt ?? null);
    const syncedTime = formatTimestamp(lastSavedAt ?? null);

    if (!manualSaveTime && !syncedTime) {
      return 'Draft has not been saved yet.';
    }

    if (manualSaveTime && !syncedTime) {
      return `Draft saved locally at ${manualSaveTime}.`;
    }

    if (!manualSaveTime && syncedTime) {
      return `Last synced at ${syncedTime}${lastSavedBy ? ` by ${lastSavedBy}` : ''}.`;
    }

    return `Saved locally at ${manualSaveTime}. Synced ${syncedTime}${lastSavedBy ? ` by ${lastSavedBy}` : ''}.`;
  }, [lastManualSaveAt, lastSavedAt, lastSavedBy]);

  const handleSummaryChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    onSummaryChange(event.target.value);
  };

  return (
    <section
      className={cn(
        'shadow-xs flex w-full flex-col gap-4 rounded-lg border border-slate-200 bg-white p-5',
        className
      )}
      data-testid="manual-save-panel"
    >
      <header className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Manual save & review
          </p>
          <div className="mt-1 flex items-center gap-2 text-sm">
            <ConflictIcon className={cn('h-4 w-4', conflictCopy.tone)} aria-hidden="true" />
            <span className={cn('font-medium', conflictCopy.tone)}>{conflictCopy.label}</span>
          </div>
          <p className="mt-1 text-xs text-slate-500">{conflictCopy.description}</p>
          {conflictReason && (
            <p className="mt-2 text-xs text-amber-700" data-testid="conflict-reason">
              {conflictReason}
            </p>
          )}
        </div>
        <div className="flex flex-col items-end text-right text-xs text-slate-500">
          <span className="inline-flex items-center gap-1">
            <Clock className="h-3 w-3" aria-hidden="true" />
            {manualSaveDescription}
          </span>
        </div>
      </header>

      <div className="space-y-2">
        <label htmlFor="summary-note" className="text-sm font-medium text-slate-800">
          Summary note for reviewers
        </label>
        <textarea
          id="summary-note"
          className="shadow-xs focus:outline-hidden min-h-[96px] w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
          placeholder="Describe the intent behind these edits so reviewers have context."
          value={summaryNote}
          onChange={handleSummaryChange}
          data-testid="summary-note-input"
        />
      </div>

      {formattingWarnings.length > 0 && (
        <section className="space-y-2" aria-live="polite">
          <h3 className="text-sm font-semibold text-slate-800">Formatting warnings</h3>
          <ul className="space-y-2">
            {formattingWarnings.map(warning => (
              <li
                key={warning.id}
                className={cn(
                  'rounded-md border px-3 py-2 text-xs',
                  severityStyles[warning.severity]
                )}
                data-testid="formatting-warning"
              >
                {warning.message}
              </li>
            ))}
          </ul>
        </section>
      )}

      {saveErrorMessage && (
        <div
          className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700"
          role="alert"
        >
          {saveErrorMessage}
        </div>
      )}

      <footer className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          variant="default"
          onClick={onManualSave}
          disabled={isSaving || disableManualSave}
          aria-busy={isSaving ? 'true' : 'false'}
          data-testid="save-draft"
          className="gap-2"
        >
          {isSaving ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : (
            <Save className="h-4 w-4" aria-hidden="true" />
          )}
          {isSaving ? 'Saving…' : 'Save draft'}
        </Button>

        <Button
          type="button"
          variant="outline"
          onClick={onOpenDiff}
          disabled={!onOpenDiff || isDiffLoading}
          data-testid="open-diff"
          className="gap-2"
        >
          <RefreshCw
            className={cn('h-4 w-4', isDiffLoading && 'animate-spin')}
            aria-hidden="true"
          />
          View diff
        </Button>

        <Button
          type="button"
          variant="secondary"
          onClick={onSubmitReview}
          disabled={isReviewDisabled || !onSubmitReview}
          data-testid="submit-review"
          className="gap-2"
        >
          Submit for review
        </Button>
      </footer>

      {isReviewDisabled && reviewDisabledReason && (
        <p className="text-xs text-amber-700" data-testid="review-blocked-message">
          {reviewDisabledReason}
        </p>
      )}
    </section>
  );
};

export default ManualSavePanel;

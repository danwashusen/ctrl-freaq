import { useMemo } from 'react';
import type { FC, MouseEventHandler } from 'react';
import { AlertOctagon, CheckCircle2, Loader2, ShieldAlert, TimerReset } from 'lucide-react';

import type { QualityGateStatus } from '@ctrl-freaq/editor-core/quality-gates/status';

import { createDocQualityTranslator } from '@/lib/i18n';

import type { SectionQualityStoreState } from '../stores/section-quality-store';

const translator = createDocQualityTranslator();

type StoreStatus = SectionQualityStoreState['status'];

const statusVariant = (
  status: StoreStatus,
  outcome: QualityGateStatus | null
): 'idle' | 'validating' | 'pass' | 'warning' | 'blocker' | 'failed' | 'neutral' => {
  if (status === 'validating') {
    return 'validating';
  }
  if (status === 'failed') {
    return 'failed';
  }
  if (status === 'completed') {
    if (outcome === 'Blocker') {
      return 'blocker';
    }
    if (outcome === 'Warning') {
      return 'warning';
    }
    if (outcome === 'Pass') {
      return 'pass';
    }
  }
  return outcome === 'Neutral' ? 'neutral' : 'idle';
};

const variantClasses: Record<
  ReturnType<typeof statusVariant>,
  { container: string; badge: string; text: string }
> = {
  idle: {
    container: 'bg-slate-100 text-slate-700 dark:bg-slate-900/60 dark:text-slate-200',
    badge: 'bg-slate-200 text-slate-800 dark:bg-slate-800 dark:text-slate-200',
    text: 'text-slate-700 dark:text-slate-200',
  },
  validating: {
    container: 'bg-blue-100 text-blue-900 dark:bg-blue-900/60 dark:text-blue-100',
    badge: 'bg-blue-200 text-blue-900 dark:bg-blue-800 dark:text-blue-100',
    text: 'text-blue-900 dark:text-blue-100',
  },
  pass: {
    container: 'bg-emerald-100 text-emerald-900 dark:bg-emerald-900/60 dark:text-emerald-100',
    badge: 'bg-emerald-200 text-emerald-900 dark:bg-emerald-800 dark:text-emerald-100',
    text: 'text-emerald-900 dark:text-emerald-100',
  },
  warning: {
    container: 'bg-amber-100 text-amber-900 dark:bg-amber-900/50 dark:text-amber-100',
    badge: 'bg-amber-200 text-amber-900 dark:bg-amber-800 dark:text-amber-100',
    text: 'text-amber-900 dark:text-amber-100',
  },
  blocker: {
    container: 'bg-rose-100 text-rose-900 dark:bg-rose-900/60 dark:text-rose-100',
    badge: 'bg-rose-200 text-rose-900 dark:bg-rose-800 dark:text-rose-100',
    text: 'text-rose-900 dark:text-rose-100',
  },
  failed: {
    container: 'bg-red-100 text-red-900 dark:bg-red-900/60 dark:text-red-100',
    badge: 'bg-red-200 text-red-900 dark:bg-red-800 dark:text-red-100',
    text: 'text-red-900 dark:text-red-100',
  },
  neutral: {
    container: 'bg-slate-100 text-slate-600 dark:bg-slate-900/50 dark:text-slate-200',
    badge: 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200',
    text: 'text-slate-600 dark:text-slate-200',
  },
};

const StatusIcon: Record<
  ReturnType<typeof statusVariant>,
  FC<{ className?: string; 'aria-hidden'?: boolean }>
> = {
  idle: CheckCircle2,
  validating: Loader2,
  pass: CheckCircle2,
  warning: AlertOctagon,
  blocker: ShieldAlert,
  failed: AlertOctagon,
  neutral: TimerReset,
};

const formatBlockedCopy = (blockerCount: number | undefined): string => {
  const normalized = blockerCount && blockerCount > 0 ? blockerCount : 1;
  return translator.helper('blocked', { count: normalized });
};

export interface SectionQualityStatusChipProps {
  status: StoreStatus;
  statusMessage: string;
  timeoutCopy?: string | null;
  lastStatus?: QualityGateStatus | null;
  incidentId?: string | null;
  isSubmissionBlocked?: boolean;
  blockerCount?: number;
  disabled?: boolean;
  onRun?: () => void | Promise<void>;
  onRetry?: () => void | Promise<void>;
}

export const SectionQualityStatusChip: FC<SectionQualityStatusChipProps> = ({
  status,
  statusMessage,
  timeoutCopy = null,
  lastStatus = null,
  incidentId = null,
  isSubmissionBlocked = false,
  blockerCount = 0,
  disabled = false,
  onRun,
  onRetry,
}) => {
  const variant = statusVariant(status, lastStatus ?? null);
  const classes = variantClasses[variant];
  const Icon = StatusIcon[variant];

  const failureCopy = useMemo(() => {
    if (status !== 'failed') {
      return null;
    }
    if (timeoutCopy) {
      return timeoutCopy;
    }
    if (incidentId) {
      return translator.helper('incident', { incidentId });
    }
    return translator.helper('genericFailure');
  }, [incidentId, status, timeoutCopy]);

  const helperCopy = useMemo(() => {
    if (status === 'failed') {
      return null;
    }
    if (status === 'idle') {
      return translator.helper('notRun');
    }
    if (status === 'completed' && isSubmissionBlocked) {
      return formatBlockedCopy(blockerCount);
    }
    return null;
  }, [blockerCount, isSubmissionBlocked, status]);

  const runButtonLabel = useMemo(
    () => (status === 'idle' ? translator.actions('run') : translator.actions('rerun')),
    [status]
  );

  const handleRun: MouseEventHandler<HTMLButtonElement> = event => {
    event.preventDefault();
    if (disabled || !onRun) {
      return;
    }
    void onRun();
  };

  const handleRetry: MouseEventHandler<HTMLButtonElement> = event => {
    event.preventDefault();
    const runner = onRetry ?? onRun;
    if (disabled || !runner) {
      return;
    }
    void runner();
  };

  return (
    <div className="space-y-3" data-testid="section-quality-status">
      <div
        className={`flex items-center justify-between gap-3 rounded-full px-4 py-2 text-sm shadow-sm transition-colors ${classes.container}`}
        data-testid="section-quality-status-chip"
        aria-live="polite"
      >
        <div className="flex flex-col items-start gap-1">
          <div className="flex items-center gap-2">
            <Icon
              className={`h-4 w-4 ${variant === 'validating' ? 'animate-spin' : ''}`}
              aria-hidden
            />
            <span className={classes.text}>{statusMessage}</span>
          </div>
          {lastStatus && status !== 'validating' && status !== 'failed' && (
            <span
              className={`text-xs font-semibold uppercase tracking-wide ${classes.text}`}
              data-testid="quality-status-summary"
            >
              Status: {lastStatus}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {onRun && status !== 'failed' && (
            <button
              type="button"
              className="rounded-full bg-white/60 px-3 py-1 text-xs font-semibold text-slate-800 shadow hover:bg-white disabled:cursor-not-allowed disabled:opacity-60 dark:bg-slate-800/60 dark:text-slate-100 dark:hover:bg-slate-800"
              onClick={handleRun}
              disabled={disabled}
              data-testid="quality-run-again"
            >
              {runButtonLabel}
            </button>
          )}

          {lastStatus && status !== 'validating' && status !== 'failed' && (
            <span
              className={`rounded-full px-3 py-0.5 text-xs font-semibold uppercase ${classes.badge}`}
              data-testid="quality-status-outcome"
            >
              {lastStatus}
            </span>
          )}
        </div>
      </div>

      {helperCopy && (
        <p
          className="mt-2 text-xs text-slate-600 dark:text-slate-300"
          data-testid="quality-status-helper"
        >
          {helperCopy}
        </p>
      )}

      {status === 'failed' && failureCopy && (
        <div
          className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-900 shadow-sm dark:border-red-800/70 dark:bg-red-900/40 dark:text-red-100"
          role="alert"
          data-testid="quality-runner-alert"
        >
          <p className="font-semibold">{translator.toast('runnerFailure')}</p>
          <p className="mt-1 whitespace-pre-line">{failureCopy}</p>
          {incidentId && (
            <p className="mt-1 text-xs text-red-700 dark:text-red-200">
              Incident ID: <span data-testid="quality-incident-id">{incidentId}</span>
            </p>
          )}
          <div className="mt-3">
            <button
              type="button"
              onClick={handleRetry}
              disabled={disabled}
              className="rounded bg-red-600 px-3 py-1 text-xs font-semibold text-white shadow hover:bg-red-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600 disabled:cursor-not-allowed disabled:bg-red-400"
              data-testid="quality-runner-retry"
            >
              {translator.actions('retry')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default SectionQualityStatusChip;

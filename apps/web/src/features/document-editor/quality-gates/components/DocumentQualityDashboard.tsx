import { useEffect, useMemo, useRef } from 'react';
import { RefreshCw } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { emitQualityGateDashboardMetric } from '@/lib/telemetry/client-events';

import { TraceabilityAlerts } from './TraceabilityAlerts';
import { TraceabilityMatrix } from './TraceabilityMatrix';
import { useQualityGates, useTraceability } from '../hooks';

const logDashboardWarning = (message: string, error: unknown) => {
  if (process.env.NODE_ENV !== 'production') {
    // eslint-disable-next-line no-console
    console.warn(message, error);
  }
};

const formatTimestamp = (value: string | null): string => {
  if (!value) {
    return 'Not yet run';
  }

  try {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return value;
    }
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(date);
  } catch (error) {
    logDashboardWarning('[quality-gates] Failed to format timestamp', error);
    return value;
  }
};

export interface DocumentQualityDashboardProps {
  documentId: string;
  className?: string;
}

export const DocumentQualityDashboard = ({
  documentId,
  className,
}: DocumentQualityDashboardProps) => {
  const {
    runDocument,
    documentStatus,
    documentStatusMessage,
    documentPublishCopy,
    documentSlaWarningCopy,
    documentSummary,
    documentLastRunAt,
    documentRequestId,
    documentTriggeredBy,
    documentDurationMs,
    isDocumentPublishBlocked,
    isDocumentRunning,
  } = useQualityGates({ documentId });

  const traceability = useTraceability({ documentId });

  const previousRequestRef = useRef<string | null>(null);

  useEffect(() => {
    if (!documentSummary) {
      return;
    }
    if (documentStatus !== 'ready' && documentStatus !== 'idle') {
      return;
    }
    if (previousRequestRef.current === documentSummary.requestId) {
      return;
    }

    emitQualityGateDashboardMetric({
      requestId: documentSummary.requestId,
      documentId: documentSummary.documentId,
      triggeredBy: documentSummary.triggeredBy ?? null,
      durationMs: documentDurationMs ?? 0,
      publishBlocked: documentSummary.publishBlocked,
      statusCounts: documentSummary.statusCounts,
    });

    previousRequestRef.current = documentSummary.requestId;
  }, [documentDurationMs, documentStatus, documentSummary]);

  const summaryCounts = useMemo(() => {
    const counts = documentSummary?.statusCounts ?? {
      pass: 0,
      warning: 0,
      blocker: 0,
      neutral: 0,
    };
    return [
      { label: 'Blockers', value: counts.blocker, tone: 'text-rose-600 dark:text-rose-300' },
      { label: 'Warnings', value: counts.warning, tone: 'text-amber-600 dark:text-amber-300' },
      { label: 'Pass', value: counts.pass, tone: 'text-emerald-600 dark:text-emerald-300' },
      {
        label: 'Not Run',
        value: counts.neutral,
        tone: 'text-gray-600 dark:text-gray-300',
      },
    ];
  }, [documentSummary?.statusCounts]);

  return (
    <section
      data-testid="document-quality-dashboard"
      className={cn(
        'space-y-4 rounded-lg border border-gray-200 bg-white p-4 text-gray-900 shadow-none dark:border-gray-800 dark:bg-gray-950 dark:text-gray-100',
        className
      )}
    >
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">Document Quality</h2>
          {documentPublishCopy && (
            <p
              className={cn(
                'text-sm',
                isDocumentPublishBlocked
                  ? 'text-rose-600 dark:text-rose-300'
                  : 'text-gray-600 dark:text-gray-300'
              )}
            >
              {documentPublishCopy}
            </p>
          )}
        </div>
        <Button
          size="sm"
          variant="secondary"
          disabled={isDocumentRunning}
          onClick={() => runDocument()}
        >
          {isDocumentRunning ? (
            <span className="inline-flex items-center">
              <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
              Validating…
            </span>
          ) : (
            'Re-run document validations'
          )}
        </Button>
      </header>

      <div
        className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm dark:border-gray-800 dark:bg-gray-900"
        data-testid="document-quality-dashboard-status"
        aria-live="polite"
      >
        <p>{documentStatusMessage}</p>
        {documentSlaWarningCopy && (
          <p className="text-gray-600 dark:text-gray-300">{documentSlaWarningCopy}</p>
        )}
      </div>

      <dl className="grid grid-cols-2 gap-3 text-sm">
        {summaryCounts.map(item => (
          <div
            key={item.label}
            className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2 dark:border-gray-800 dark:bg-gray-900"
          >
            <dt className="text-xs font-medium text-gray-600 dark:text-gray-300">{item.label}</dt>
            <dd className={cn('text-base font-semibold', item.tone)}>{item.value}</dd>
          </div>
        ))}
      </dl>

      <dl className="grid grid-cols-2 gap-3 text-xs text-gray-600 dark:text-gray-300">
        <div>
          <dt className="font-semibold text-gray-900 dark:text-gray-100">Last run</dt>
          <dd>{formatTimestamp(documentLastRunAt)}</dd>
        </div>
        <div>
          <dt className="font-semibold text-gray-900 dark:text-gray-100">Triggered by</dt>
          <dd>{documentTriggeredBy ?? 'Unknown'}</dd>
        </div>
        <div className="col-span-2">
          <dt className="font-semibold text-gray-900 dark:text-gray-100">Request ID</dt>
          <dd className="truncate">{documentRequestId ?? '—'}</dd>
        </div>
        <div>
          <dt className="font-semibold text-gray-900 dark:text-gray-100">Coverage gaps</dt>
          <dd>{documentSummary?.coverageGaps.length ?? 0}</dd>
        </div>
        <div>
          <dt className="font-semibold text-gray-900 dark:text-gray-100">Duration</dt>
          <dd>{documentDurationMs != null ? `${documentDurationMs}ms` : '—'}</dd>
        </div>
      </dl>

      <div className="space-y-4">
        <TraceabilityAlerts onResolveGaps={() => traceability.setFilter('neutral')} />
        <TraceabilityMatrix />
      </div>
    </section>
  );
};

export default DocumentQualityDashboard;

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
      { label: 'Blockers', value: counts.blocker, tone: 'text-rose-900 dark:text-rose-200' },
      { label: 'Warnings', value: counts.warning, tone: 'text-amber-600 dark:text-amber-400' },
      { label: 'Pass', value: counts.pass, tone: 'text-emerald-600 dark:text-emerald-400' },
      { label: 'Not Run', value: counts.neutral, tone: 'text-muted-foreground' },
    ];
  }, [documentSummary?.statusCounts]);

  return (
    <section
      data-testid="document-quality-dashboard"
      className={cn('border-border bg-card shadow-xs space-y-4 rounded-lg border p-4', className)}
    >
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-foreground text-base font-semibold">Document Quality</h2>
          {documentPublishCopy && (
            <p
              className={cn(
                'text-sm',
                isDocumentPublishBlocked
                  ? 'text-rose-900 dark:text-rose-200'
                  : 'text-muted-foreground'
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
        className="bg-muted text-foreground rounded-md px-3 py-2 text-sm"
        data-testid="document-quality-dashboard-status"
        aria-live="polite"
      >
        <p>{documentStatusMessage}</p>
        {documentSlaWarningCopy && (
          <p className="text-muted-foreground">{documentSlaWarningCopy}</p>
        )}
      </div>

      <dl className="grid grid-cols-2 gap-3 text-sm">
        {summaryCounts.map(item => (
          <div key={item.label} className="bg-secondary/40 rounded-md px-3 py-2">
            <dt className="text-muted-foreground text-xs font-medium">{item.label}</dt>
            <dd className={cn('text-base font-semibold', item.tone)}>{item.value}</dd>
          </div>
        ))}
      </dl>

      <dl className="text-muted-foreground grid grid-cols-2 gap-3 text-xs">
        <div>
          <dt className="text-foreground font-semibold">Last run</dt>
          <dd>{formatTimestamp(documentLastRunAt)}</dd>
        </div>
        <div>
          <dt className="text-foreground font-semibold">Triggered by</dt>
          <dd>{documentTriggeredBy ?? 'Unknown'}</dd>
        </div>
        <div className="col-span-2">
          <dt className="text-foreground font-semibold">Request ID</dt>
          <dd className="truncate">{documentRequestId ?? '—'}</dd>
        </div>
        <div>
          <dt className="text-foreground font-semibold">Coverage gaps</dt>
          <dd>{documentSummary?.coverageGaps.length ?? 0}</dd>
        </div>
        <div>
          <dt className="text-foreground font-semibold">Duration</dt>
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

import { AlertTriangle } from 'lucide-react';
import type { FC } from 'react';

import { Button } from '@/components/ui/button';

import { useTraceabilityStore } from '../stores/traceability-store';

const logTraceabilityAlertWarning = (message: string, error: unknown) => {
  if (process.env.NODE_ENV !== 'production') {
    // eslint-disable-next-line no-console
    console.warn(message, error);
  }
};

const formatLastRun = (value: string | null): string | null => {
  if (!value) {
    return null;
  }

  try {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return value;
    }
    return new Intl.DateTimeFormat(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    }).format(date);
  } catch (error) {
    logTraceabilityAlertWarning('[quality-gates] Failed to format traceability timestamp', error);
    return value;
  }
};

export interface TraceabilityAlertsProps {
  orphanedCount?: number;
  slowRunIncidentId?: string | null;
  lastRunAt?: string | null;
  onResolveGaps?: () => void;
}

export const TraceabilityAlerts: FC<TraceabilityAlertsProps> = ({
  orphanedCount: orphanedCountProp,
  slowRunIncidentId: incidentIdProp,
  lastRunAt: lastRunProp,
  onResolveGaps,
}) => {
  const {
    orphanedCount: storeOrphans,
    slowRunIncidentId,
    lastRunAt,
  } = useTraceabilityStore(state => ({
    orphanedCount: state.orphanedCount,
    slowRunIncidentId: state.slowRunIncidentId,
    lastRunAt: state.lastRunAt,
  }));
  const setFilter = useTraceabilityStore(state => state.setFilter);

  const orphanedCount = orphanedCountProp ?? storeOrphans;
  const incidentId = incidentIdProp ?? slowRunIncidentId;
  const formattedLastRun = formatLastRun(lastRunProp ?? lastRunAt);

  if (!orphanedCount || orphanedCount <= 0) {
    return null;
  }

  const handleResolve = () => {
    if (onResolveGaps) {
      onResolveGaps();
    } else {
      setFilter('neutral');
    }
  };

  return (
    <div
      role="alert"
      className="flex flex-col gap-2 rounded-md border border-amber-500/40 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-400/40 dark:bg-amber-950/40 dark:text-amber-100"
    >
      <div className="flex items-start gap-2">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        <div className="space-y-1">
          <p className="font-semibold text-amber-900 dark:text-amber-100">
            Traceability gap detected: {orphanedCount}{' '}
            {orphanedCount === 1 ? 'requirement needs' : 'requirements need'} reassignment.
          </p>
          {formattedLastRun ? (
            <p className="text-xs text-amber-800 dark:text-amber-200">
              Last validation run completed on {formattedLastRun}.
            </p>
          ) : null}
          {incidentId ? (
            <p className="text-xs text-amber-800 dark:text-amber-200">
              Reference incident {incidentId} in follow-ups.
            </p>
          ) : null}
        </div>
      </div>
      <div className="flex justify-end">
        <Button size="sm" variant="secondary" onClick={handleResolve}>
          Resolve now
        </Button>
      </div>
    </div>
  );
};

export default TraceabilityAlerts;

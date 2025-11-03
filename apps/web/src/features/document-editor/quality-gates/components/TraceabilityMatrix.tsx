import { useEffect, useMemo, useState } from 'react';
import type { FC } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

import {
  filterTraceabilityRequirements,
  useTraceabilityStore,
  type TraceabilityFilter,
  type TraceabilityRequirementRow,
} from '../stores/traceability-store';

const logTraceabilityWarning = (message: string, error: unknown) => {
  if (process.env.NODE_ENV !== 'production') {
    // eslint-disable-next-line no-console
    console.warn(message, error);
  }
};

const filterLabels: Record<TraceabilityFilter, string> = {
  all: 'All statuses',
  blockers: 'Blockers',
  warnings: 'Warnings',
  neutral: 'Neutral / Not Run',
  covered: 'Covered',
};

const coverageBadgeClasses: Record<TraceabilityRequirementRow['coverageStatus'], string> = {
  blocker: 'bg-rose-100 text-rose-900 dark:bg-rose-900/60 dark:text-rose-100',
  warning: 'bg-amber-100 text-amber-900 dark:bg-amber-900/60 dark:text-amber-100',
  covered: 'bg-emerald-100 text-emerald-900 dark:bg-emerald-900/60 dark:text-emerald-100',
  orphaned: 'bg-slate-200 text-slate-800 dark:bg-slate-800 dark:text-slate-200',
};

const formatTimestamp = (value: string | null): string => {
  if (!value) {
    return 'Not yet validated';
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
    logTraceabilityWarning('[quality-gates] Failed to format timestamp', error);
    return value;
  }
};

const toCoverageLabel = (coverage: TraceabilityRequirementRow['coverageStatus']): string => {
  switch (coverage) {
    case 'blocker':
      return 'Blocker';
    case 'warning':
      return 'Warning';
    case 'covered':
      return 'Covered';
    case 'orphaned':
      return 'Not Linked';
    default:
      return coverage;
  }
};

export interface TraceabilityMatrixProps {
  requirements?: TraceabilityRequirementRow[];
  initialFilter?: TraceabilityFilter;
  onFilterChange?: (filter: TraceabilityFilter) => void;
}

const FILTER_SEQUENCE: TraceabilityFilter[] = ['all', 'blockers', 'warnings', 'neutral', 'covered'];

export const TraceabilityMatrix: FC<TraceabilityMatrixProps> = ({
  requirements,
  initialFilter = 'all',
  onFilterChange,
}) => {
  const [localFilter, setLocalFilter] = useState<TraceabilityFilter>(initialFilter);
  const {
    requirements: storeRequirements,
    filter: storeFilter,
    isLoading,
    error,
  } = useTraceabilityStore(state => ({
    requirements: state.requirements,
    filter: state.filter,
    isLoading: state.isLoading,
    error: state.error,
  }));
  const setStoreFilter = useTraceabilityStore(state => state.setFilter);

  useEffect(() => {
    if (requirements) {
      setLocalFilter(initialFilter);
    }
  }, [requirements, initialFilter]);

  const activeFilter = requirements ? localFilter : storeFilter;
  const rows = requirements ?? storeRequirements;
  const filteredRequirements = useMemo(
    () => filterTraceabilityRequirements(rows, activeFilter),
    [rows, activeFilter]
  );

  const handleFilterChange = (nextFilter: TraceabilityFilter) => {
    if (requirements) {
      setLocalFilter(nextFilter);
    } else {
      setStoreFilter(nextFilter);
    }
    onFilterChange?.(nextFilter);
  };

  const isRemote = !requirements;
  const isBusy = isRemote && isLoading;

  return (
    <Card
      aria-live="polite"
      aria-busy={isBusy}
      className="border border-gray-200 bg-white text-gray-900 dark:border-gray-800 dark:bg-gray-950 dark:text-gray-100"
    >
      <CardHeader className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <CardTitle className="text-lg font-semibold">Traceability matrix</CardTitle>
          <p className="text-sm text-gray-600 dark:text-gray-300">
            Review requirement coverage and validation status across this document.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {FILTER_SEQUENCE.map(filterValue => {
            const isActive = activeFilter === filterValue;
            return (
              <Button
                key={filterValue}
                size="sm"
                variant={isActive ? 'secondary' : 'outline'}
                className={cn(!isActive && 'text-gray-900')}
                onClick={() => handleFilterChange(filterValue)}
                aria-pressed={isActive}
              >
                {filterLabels[filterValue]}
              </Button>
            );
          })}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && !requirements ? (
          <div className="border-destructive/30 bg-destructive/10 text-destructive rounded-md border p-4 text-sm">
            {error}
          </div>
        ) : null}

        {isLoading && !requirements ? (
          <p className="text-sm text-gray-600 dark:text-gray-300">Loading traceability data…</p>
        ) : null}

        {!isLoading && filteredRequirements.length === 0 ? (
          <p className="text-sm text-gray-600 dark:text-gray-300">
            No traceability entries match the selected filter.
          </p>
        ) : null}

        <ul className="space-y-3">
          {filteredRequirements.map(requirement => (
            <li
              key={`${requirement.requirementId}-${requirement.sectionId}`}
              className="rounded-md border border-gray-200 bg-white p-4 text-gray-900 shadow-none dark:border-gray-800 dark:bg-gray-950 dark:text-gray-100"
            >
              <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                <div>
                  <h3 className="text-base font-medium">{requirement.title}</h3>
                  <p className="line-clamp-3 text-sm text-gray-600 dark:text-gray-300">
                    {requirement.preview}
                  </p>
                </div>
                <span
                  className={cn(
                    'inline-flex items-center rounded-md px-2 py-1 text-xs font-semibold uppercase tracking-wide',
                    coverageBadgeClasses[requirement.coverageStatus]
                  )}
                >
                  {toCoverageLabel(requirement.coverageStatus)}
                </span>
              </div>

              <dl className="mt-3 grid grid-cols-1 gap-2 text-xs text-gray-600 md:grid-cols-3 dark:text-gray-300">
                <div>
                  <dt className="font-medium text-gray-900 dark:text-gray-100">Gate status</dt>
                  <dd>{requirement.gateStatus}</dd>
                </div>
                <div>
                  <dt className="font-medium text-gray-900 dark:text-gray-100">Last validated</dt>
                  <dd>{formatTimestamp(requirement.lastValidatedAt)}</dd>
                </div>
                <div>
                  <dt className="font-medium text-gray-900 dark:text-gray-100">Validated by</dt>
                  <dd>{requirement.validatedBy ?? 'Unknown'}</dd>
                </div>
              </dl>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
};

export default TraceabilityMatrix;

export type { TraceabilityFilter, TraceabilityRequirementRow } from '../stores/traceability-store';

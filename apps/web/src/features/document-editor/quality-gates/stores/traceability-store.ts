import { createStore } from 'zustand/vanilla';
import { useStoreWithEqualityFn } from 'zustand/traditional';
import type { StoreApi } from 'zustand';

import type { QualityGateStatus } from '@ctrl-freaq/editor-core/quality-gates/status';

export type TraceabilityFilter = 'all' | 'blockers' | 'warnings' | 'neutral' | 'covered';

export interface TraceabilityAuditEvent {
  eventId: string;
  type: 'link-created' | 'link-updated' | 'link-orphaned' | 'link-reassigned';
  timestamp: string;
  actorId: string;
  details?: Record<string, unknown> | null;
}

export interface TraceabilityRequirementRow {
  requirementId: string;
  sectionId: string;
  title: string;
  preview: string;
  gateStatus: QualityGateStatus;
  coverageStatus: 'covered' | 'warning' | 'blocker' | 'orphaned';
  lastValidatedAt: string | null;
  validatedBy: string | null;
  notes: string[];
  revisionId: string;
  auditTrail: TraceabilityAuditEvent[];
}

export interface TraceabilityStoreData {
  requirements: TraceabilityRequirementRow[];
  filter: TraceabilityFilter;
  isLoading: boolean;
  error: string | null;
  orphanedCount: number;
  lastRunAt: string | null;
  slowRunIncidentId: string | null;
}

export interface TraceabilityStoreActions {
  hydrate(
    requirements: TraceabilityRequirementRow[],
    meta?: { lastRunAt?: string | null; incidentId?: string | null }
  ): void;
  setFilter(filter: TraceabilityFilter): void;
  setLoading(isLoading: boolean): void;
  setError(error: string | null): void;
  reset(): void;
}

export type TraceabilityStoreState = TraceabilityStoreData & TraceabilityStoreActions;
export type TraceabilityStore = StoreApi<TraceabilityStoreState>;

export const filterTraceabilityRequirements = (
  requirements: TraceabilityRequirementRow[],
  filter: TraceabilityFilter
): TraceabilityRequirementRow[] => {
  switch (filter) {
    case 'blockers':
      return requirements.filter(requirement => requirement.coverageStatus === 'blocker');
    case 'warnings':
      return requirements.filter(requirement => requirement.coverageStatus === 'warning');
    case 'neutral':
      return requirements.filter(
        requirement =>
          requirement.coverageStatus === 'orphaned' || requirement.gateStatus === 'Neutral'
      );
    case 'covered':
      return requirements.filter(requirement => requirement.coverageStatus === 'covered');
    default:
      return requirements;
  }
};

const computeOrphanedCount = (requirements: TraceabilityRequirementRow[]): number =>
  requirements.filter(requirement => requirement.coverageStatus === 'orphaned').length;

const deriveLastRunAt = (
  requirements: TraceabilityRequirementRow[],
  explicit?: string | null
): string | null => {
  if (explicit) {
    return explicit;
  }

  const timestamps = requirements
    .map(requirement => requirement.lastValidatedAt)
    .filter((value): value is string => typeof value === 'string');

  if (timestamps.length === 0) {
    return null;
  }

  const sorted = [...timestamps].sort();
  const latest = sorted.pop();
  return latest ?? null;
};

const initialState: TraceabilityStoreData = {
  requirements: [],
  filter: 'all',
  isLoading: false,
  error: null,
  orphanedCount: 0,
  lastRunAt: null,
  slowRunIncidentId: null,
};

export const createTraceabilityStore = (): TraceabilityStore =>
  createStore<TraceabilityStoreState>((set, _get) => ({
    ...initialState,
    hydrate(requirements, meta) {
      const lastRunAt = deriveLastRunAt(requirements, meta?.lastRunAt ?? null);
      const incidentId = meta?.incidentId ?? null;
      set({
        requirements,
        orphanedCount: computeOrphanedCount(requirements),
        lastRunAt,
        slowRunIncidentId: incidentId,
        isLoading: false,
        error: null,
      });
    },
    setFilter(filter) {
      set({ filter });
    },
    setLoading(isLoading) {
      set({ isLoading });
    },
    setError(error) {
      set({ error });
    },
    reset() {
      set({ ...initialState });
    },
  }));

export const traceabilityStore = createTraceabilityStore();

export const useTraceabilityStore = <T>(
  selector: (state: TraceabilityStoreState) => T,
  equalityFn?: (a: T, b: T) => boolean
) => useStoreWithEqualityFn(traceabilityStore, selector, equalityFn);

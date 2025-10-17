import { useMemo, useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { shallow } from 'zustand/shallow';

import type ApiClient from '@/lib/api';
import { useApiClient } from '@/lib/api-context';

import {
  fetchTraceabilityMatrix,
  markTraceabilityRequirementOrphaned,
  type TraceabilityOrphanInput,
} from '../services/quality-gates-api';
import {
  filterTraceabilityRequirements,
  traceabilityStore,
  useTraceabilityStore,
  type TraceabilityFilter,
  type TraceabilityRequirementRow,
} from '../stores/traceability-store';

const TRACEABILITY_QUERY_KEY = (documentId: string | null) =>
  ['quality-gates', 'traceability', documentId ?? 'unknown'] as const;

export interface UseTraceabilityOptions {
  documentId?: string | null;
  client?: ApiClient;
  serviceOverrides?: {
    fetchTraceability?: typeof fetchTraceabilityMatrix;
    markOrphan?: typeof markTraceabilityRequirementOrphaned;
  };
}

export interface TraceabilityRuntime {
  requirements: TraceabilityRequirementRow[];
  filter: TraceabilityFilter;
  setFilter(filter: TraceabilityFilter): void;
  isLoading: boolean;
  error: string | null;
  orphanedCount: number;
  lastRunAt: string | null;
  slowRunIncidentId: string | null;
  markRequirementOrphaned(input: TraceabilityOrphanInput): Promise<void>;
  isSubmitting: boolean;
}

const defaultErrorMessage = 'Failed to load traceability matrix';

const computeFilteredRequirements = (
  requirements: TraceabilityRequirementRow[],
  filter: TraceabilityFilter
): TraceabilityRequirementRow[] => filterTraceabilityRequirements(requirements, filter);

export const useTraceability = (options: UseTraceabilityOptions = {}): TraceabilityRuntime => {
  const clientFromContext = useApiClient();
  const client = options.client ?? clientFromContext;
  const documentId = options.documentId ?? null;
  const fetchService = options.serviceOverrides?.fetchTraceability ?? fetchTraceabilityMatrix;
  const orphanService = options.serviceOverrides?.markOrphan ?? markTraceabilityRequirementOrphaned;
  const queryClient = useQueryClient();

  const { requirements, filter, isLoading, error, orphanedCount, lastRunAt, slowRunIncidentId } =
    useTraceabilityStore(
      state => ({
        requirements: state.requirements,
        filter: state.filter,
        isLoading: state.isLoading,
        error: state.error,
        orphanedCount: state.orphanedCount,
        lastRunAt: state.lastRunAt,
        slowRunIncidentId: state.slowRunIncidentId,
      }),
      shallow
    );

  const setFilter = useTraceabilityStore(state => state.setFilter);
  const setError = useTraceabilityStore(state => state.setError);
  const setLoading = useTraceabilityStore(state => state.setLoading);
  const hydrate = useTraceabilityStore(state => state.hydrate);

  const queryEnabled = documentId != null && documentId.length > 0;
  const lastFetchedDocument = useRef<string | null>(null);

  if (documentId && lastFetchedDocument.current && lastFetchedDocument.current !== documentId) {
    traceabilityStore.getState().reset();
    lastFetchedDocument.current = null;
  }

  useQuery({
    queryKey: TRACEABILITY_QUERY_KEY(documentId),
    enabled: queryEnabled,
    staleTime: 30_000,
    queryFn: async () => {
      if (!documentId) {
        return [] as TraceabilityRequirementRow[];
      }

      setLoading(true);
      try {
        const response = await fetchService(client, documentId);
        hydrate(response.requirements);
        setError(null);
        lastFetchedDocument.current = documentId;
        return response.requirements;
      } catch (error) {
        setError(error instanceof Error ? error.message : defaultErrorMessage);
        throw error;
      } finally {
        setLoading(false);
      }
    },
  });

  const mutation = useMutation({
    mutationFn: async (input: TraceabilityOrphanInput) => {
      if (!documentId) {
        throw new Error('Document ID required to mark traceability orphan');
      }
      return orphanService(client, documentId, input);
    },
    onSuccess: async response => {
      traceabilityStore.setState(current => {
        const updatedRequirements = current.requirements.map(requirement =>
          requirement.requirementId === response.requirementId
            ? {
                ...requirement,
                coverageStatus: response.coverageStatus,
                lastValidatedAt: response.lastValidatedAt,
                validatedBy: response.validatedBy ?? requirement.validatedBy,
              }
            : requirement
        );
        return {
          ...current,
          requirements: updatedRequirements,
          orphanedCount: updatedRequirements.filter(
            requirement => requirement.coverageStatus === 'orphaned'
          ).length,
          lastRunAt: response.lastValidatedAt ?? current.lastRunAt,
        };
      });
      await queryClient.invalidateQueries({ queryKey: TRACEABILITY_QUERY_KEY(documentId) });
    },
    onError: (error: unknown) => {
      setError(error instanceof Error ? error.message : 'Failed to update traceability entry');
    },
  });

  const filteredRequirements = useMemo(
    () => computeFilteredRequirements(requirements, filter),
    [requirements, filter]
  );

  return {
    requirements: filteredRequirements,
    filter,
    setFilter,
    isLoading,
    error,
    orphanedCount,
    lastRunAt,
    slowRunIncidentId,
    async markRequirementOrphaned(input) {
      await mutation.mutateAsync(input);
    },
    isSubmitting: mutation.isPending,
  };
};

export type { TraceabilityRequirementRow };

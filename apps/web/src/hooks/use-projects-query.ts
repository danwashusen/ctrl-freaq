import { useEffect, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { PROJECTS_QUERY_KEY } from '@/features/projects/constants';
import type { ProjectData, ProjectsListQueryParams, ProjectsListResponse } from '@/lib/api';
import { useApi } from '@/lib/api-context';
import type { EventEnvelope } from '@/lib/streaming/event-hub';

const DEFAULT_LIMIT = 20;
const DEFAULT_OFFSET = 0;

const PROJECT_STATUSES: readonly ProjectData['status'][] = [
  'draft',
  'active',
  'paused',
  'completed',
  'archived',
] as const;

const isProjectStatus = (value: string): value is ProjectData['status'] =>
  PROJECT_STATUSES.includes(value as ProjectData['status']);

const toArchivedStatusBefore = (
  value: string | null | undefined
): Exclude<ProjectData['status'], 'archived'> | null => {
  if (!value || value === 'archived' || !isProjectStatus(value)) {
    return null;
  }
  return value as Exclude<ProjectData['status'], 'archived'>;
};

export interface UseProjectsQueryOptions extends ProjectsListQueryParams {}

interface ProjectLifecyclePayload {
  projectId: string;
  status: string;
  previousStatus?: string | null;
  updatedBy?: string | null;
  archivedAt?: string | null;
  archivedBy?: string | null;
  notes?: string | null;
}

const normalizeOptions = (options?: UseProjectsQueryOptions) => {
  const includeArchived = options?.includeArchived ?? false;
  const limit = typeof options?.limit === 'number' ? options.limit : DEFAULT_LIMIT;
  const offset = typeof options?.offset === 'number' ? options.offset : DEFAULT_OFFSET;
  const search =
    typeof options?.search === 'string' && options.search.trim().length > 0
      ? options.search.trim()
      : undefined;

  return { includeArchived, limit, offset, search } as const;
};

export function useProjectsQuery(options?: UseProjectsQueryOptions) {
  const {
    projects: projectsApi,
    eventHub,
    eventHubHealth,
    eventHubEnabled,
  } = useApi();
  const queryClient = useQueryClient();
  const includeArchived = options?.includeArchived;
  const limit = options?.limit;
  const offset = options?.offset;
  const search = options?.search;

  const params = useMemo(
    () => normalizeOptions({ includeArchived, limit, offset, search }),
    [includeArchived, limit, offset, search]
  );
  const queryKey = useMemo(() => [...PROJECTS_QUERY_KEY, params] as const, [params]);

  const shouldPoll = !eventHubEnabled || eventHubHealth.fallbackActive;
  const refetchInterval = shouldPoll ? 1_500 : false;

  const query = useQuery<ProjectsListResponse>({
    queryKey,
    queryFn: () => projectsApi.getAll(params),
    staleTime: 30_000,
    placeholderData: previousData =>
      previousData ?? {
        projects: [],
        total: 0,
        limit: params.limit,
        offset: params.offset,
      },
    refetchInterval,
    refetchIntervalInBackground: true,
  });

  useEffect(() => {
    if (!eventHubEnabled) {
      return;
    }

    const unsubscribe = eventHub.subscribe(
      { topic: 'project.lifecycle' },
      (envelope: EventEnvelope<ProjectLifecyclePayload>) => {
        if (!envelope || envelope.kind === 'heartbeat') {
          return;
        }

        const payload = envelope.payload;
        if (!payload || typeof payload.projectId !== 'string') {
          return;
        }

        queryClient.setQueriesData<ProjectsListResponse | undefined>(
          { queryKey: PROJECTS_QUERY_KEY, exact: false },
          current => {
            if (!current) {
              return current;
            }

            let updated = false;

            const nextProjects = current.projects.map(project => {
              if (project.id !== payload.projectId) {
                return project;
              }

              updated = true;

              const nextStatus = isProjectStatus(payload.status)
                ? payload.status
                : project.status;
              const isArchived = nextStatus === 'archived';
              const nextArchivedStatusBefore = isArchived
                ? toArchivedStatusBefore(payload.previousStatus) ?? project.archivedStatusBefore
                : null;
              const nextDeletedAt = isArchived
                ? payload.archivedAt ?? project.deletedAt
                : null;
              const nextDeletedBy = isArchived
                ? payload.archivedBy ?? project.deletedBy
                : null;

              return {
                ...project,
                status: nextStatus,
                archivedStatusBefore: nextArchivedStatusBefore,
                updatedBy: payload.updatedBy ?? project.updatedBy,
                updatedAt: envelope.emittedAt ?? project.updatedAt,
                deletedAt: nextDeletedAt,
                deletedBy: nextDeletedBy,
              };
            });

            if (!updated) {
              return current;
            }

            return {
              ...current,
              projects: nextProjects,
            };
          }
        );
      }
    );

    return () => {
      unsubscribe();
    };
  }, [eventHub, eventHubEnabled, queryClient]);

  return {
    ...query,
    queryKey,
    params,
  };
}

export type UseProjectsQueryResult = ReturnType<typeof useProjectsQuery>;

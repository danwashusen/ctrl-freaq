import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';

import { PROJECTS_QUERY_KEY } from '@/features/projects/constants';
import type { ProjectsListQueryParams, ProjectsListResponse } from '@/lib/api';
import { useApi } from '@/lib/api-context';

const DEFAULT_LIMIT = 20;
const DEFAULT_OFFSET = 0;

export interface UseProjectsQueryOptions extends ProjectsListQueryParams {}

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
  const api = useApi();
  const includeArchived = options?.includeArchived;
  const limit = options?.limit;
  const offset = options?.offset;
  const search = options?.search;

  const params = useMemo(
    () => normalizeOptions({ includeArchived, limit, offset, search }),
    [includeArchived, limit, offset, search]
  );
  const queryKey = useMemo(() => [...PROJECTS_QUERY_KEY, params] as const, [params]);

  const query = useQuery<ProjectsListResponse>({
    queryKey,
    queryFn: () => api.projects.getAll(params),
    staleTime: 30_000,
    placeholderData: previousData =>
      previousData ?? {
        projects: [],
        total: 0,
        limit: params.limit,
        offset: params.offset,
      },
  });

  return {
    ...query,
    queryKey,
    params,
  };
}

export type UseProjectsQueryResult = ReturnType<typeof useProjectsQuery>;

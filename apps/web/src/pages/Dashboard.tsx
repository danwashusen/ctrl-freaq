import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Activity,
  Archive,
  FileText,
  Loader2,
  MoreHorizontal,
  Plus,
  RotateCcw,
  Settings,
} from 'lucide-react';

import { ArchiveProjectDialog } from '@/components/projects/ArchiveProjectDialog';
import { CreateProjectDialog } from '@/components/projects/CreateProjectDialog';
import ProjectsNav from '@/components/sidebar/ProjectsNav';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useUser, UserButton } from '@/lib/auth-provider';
import type { CreateProjectRequest, ProjectData, ProjectsListResponse } from '@/lib/api';
import { useApi } from '@/lib/api-context';
import logger from '@/lib/logger';
import { formatIsoDateMonthDay } from '@/lib/date-only';
import {
  emitProjectCreateMetric,
  emitProjectDashboardHydrationMetric,
} from '@/lib/telemetry/client-events';
import { useProjectsQuery } from '@/hooks/use-projects-query';
import { PROJECTS_QUERY_KEY } from '@/features/projects/constants';
import { useProjectStore } from '@/stores/project-store';

const DASHBOARD_VIEW_STATE_STORAGE_KEY = 'ctrl-freaq:dashboard:view-state:v1';
const DASHBOARD_ARCHIVE_NOTICE_STORAGE_KEY = 'ctrl-freaq:dashboard:archive-notice';

interface DashboardViewState {
  search: string;
  includeArchived: boolean;
  scrollY: number;
}

type ToastTone = 'success' | 'warning';

interface DashboardToast {
  id: string;
  message: string;
  tone: ToastTone;
}

interface ArchiveVariables {
  project: ProjectData;
}

interface RestoreVariables {
  id: string;
  name: string;
}

const defaultViewState: DashboardViewState = {
  search: '',
  includeArchived: false,
  scrollY: 0,
};

const buildLogContext = (scope: string, error: unknown): Record<string, unknown> => {
  if (error instanceof Error) {
    return {
      scope,
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack,
      },
    };
  }

  if (error !== null && error !== undefined) {
    return {
      scope,
      error: {
        message: String(error),
      },
    };
  }

  return { scope };
};

const loadViewState = (): DashboardViewState => {
  if (typeof window === 'undefined') {
    return defaultViewState;
  }
  try {
    const raw = window.sessionStorage.getItem(DASHBOARD_VIEW_STATE_STORAGE_KEY);
    if (!raw) {
      return defaultViewState;
    }
    const parsed = JSON.parse(raw) as Partial<DashboardViewState>;
    return {
      search: typeof parsed.search === 'string' ? parsed.search : defaultViewState.search,
      includeArchived:
        typeof parsed.includeArchived === 'boolean'
          ? parsed.includeArchived
          : defaultViewState.includeArchived,
      scrollY: typeof parsed.scrollY === 'number' ? parsed.scrollY : defaultViewState.scrollY,
    };
  } catch (error) {
    logger.warn(
      'dashboard.view_state.load_failed',
      buildLogContext('dashboard.view_state.load_failed', error)
    );
    return defaultViewState;
  }
};

const saveViewState = (state: DashboardViewState) => {
  if (typeof window === 'undefined') {
    return;
  }
  try {
    window.sessionStorage.setItem(DASHBOARD_VIEW_STATE_STORAGE_KEY, JSON.stringify(state));
  } catch (error) {
    logger.warn(
      'dashboard.view_state.persist_failed',
      buildLogContext('dashboard.view_state.persist_failed', error)
    );
  }
};

export const formatGoalTargetDate = (value: string | null): string => {
  return formatIsoDateMonthDay(value);
};

const normalizeDescription = (project: ProjectData): string => {
  if (project.description && project.description.trim().length > 0) {
    return project.description.trim();
  }
  return 'No description provided';
};

export default function Dashboard() {
  const { user, isLoaded } = useUser();
  const navigate = useNavigate();
  const api = useApi();
  const queryClient = useQueryClient();

  const [isCreateDialogOpen, setCreateDialogOpen] = useState(false);
  const [toast, setToast] = useState<DashboardToast | null>(null);
  const [viewState, setViewState] = useState<DashboardViewState>(() => loadViewState());
  const [searchInput, setSearchInput] = useState(viewState.search);
  const [openActionsProjectId, setOpenActionsProjectId] = useState<string | null>(null);
  const [archiveTarget, setArchiveTarget] = useState<ProjectData | null>(null);
  const hasRestoredScroll = useRef(false);
  const hydrationStartedAtRef = useRef<number | null>(null);
  const lastHydrationStampRef = useRef<number | null>(null);
  const createStartedAtRef = useRef<number | null>(null);
  const lastCreatePayloadRef = useRef<CreateProjectRequest | null>(null);
  const navigationTriggeredRef = useRef(false);
  const setActiveProject = useProjectStore(state => state.setActiveProject);

  const projectsQuery = useProjectsQuery({
    includeArchived: viewState.includeArchived,
    search: viewState.search,
    limit: 20,
    offset: viewState.includeArchived ? 0 : 0,
  });
  const projectsQueryKey = projectsQuery.queryKey;
  const projectsQueryParams = projectsQuery.params;

  const applyViewState = useCallback(
    (updater: (prev: DashboardViewState) => DashboardViewState) => {
      setViewState(prev => {
        const next = updater(prev);
        saveViewState(next);
        return next;
      });
    },
    []
  );

  const showToast = useCallback((id: string, message: string, tone: ToastTone = 'success') => {
    setToast({ id, message, tone });
  }, []);

  const applyArchiveOptimistic = useCallback(
    (project: ProjectData) => {
      queryClient.setQueryData<ProjectsListResponse>(projectsQueryKey, existing => {
        if (!existing) {
          return existing;
        }

        if (viewState.includeArchived) {
          return {
            ...existing,
            projects: existing.projects.map(item =>
              item.id === project.id
                ? {
                    ...item,
                    status: 'archived',
                    archivedStatusBefore:
                      item.status === 'archived' ? item.archivedStatusBefore : item.status,
                    deletedAt: item.deletedAt ?? new Date().toISOString(),
                    deletedBy: item.deletedBy ?? project.ownerUserId,
                  }
                : item
            ),
          };
        }

        return {
          ...existing,
          projects: existing.projects.filter(item => item.id !== project.id),
          total: Math.max(0, existing.total - 1),
        };
      });
    },
    [projectsQueryKey, queryClient, viewState.includeArchived]
  );

  const applyRestoreOptimistic = useCallback(
    (project: ProjectData) => {
      queryClient.setQueryData<ProjectsListResponse>(projectsQueryKey, existing => {
        if (!existing) {
          return existing;
        }

        const filtered = existing.projects.filter(item => item.id !== project.id);
        if (viewState.includeArchived) {
          return {
            ...existing,
            projects: [project, ...filtered],
          };
        }

        const wasPresent = filtered.length !== existing.projects.length;
        return {
          ...existing,
          projects: [project, ...filtered],
          total: wasPresent ? existing.total : existing.total + 1,
        };
      });
    },
    [projectsQueryKey, queryClient, viewState.includeArchived]
  );

  const projects: ProjectsListResponse['projects'] = projectsQuery.data?.projects ?? [];
  const totalProjects = projectsQuery.data?.total ?? projects.length;
  const isPlaceholderData = projectsQuery.isPlaceholderData ?? false;

  useEffect(() => {
    if (!toast) {
      return;
    }
    const timeout = window.setTimeout(() => setToast(null), 4000);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  useEffect(() => {
    if (typeof performance === 'undefined') {
      return;
    }
    hydrationStartedAtRef.current = performance.now();
  }, []);

  useEffect(() => {
    if (!projectsQuery.isFetching) {
      return;
    }
    if (typeof performance === 'undefined') {
      return;
    }
    hydrationStartedAtRef.current = performance.now();
  }, [projectsQuery.isFetching]);

  useEffect(() => {
    if (!projectsQuery.isSuccess || isPlaceholderData) {
      return;
    }
    if (typeof performance === 'undefined') {
      return;
    }

    const startedAt = hydrationStartedAtRef.current;
    const timestamp = projectsQuery.dataUpdatedAt ?? null;
    if (startedAt === null) {
      return;
    }

    if (timestamp !== null && lastHydrationStampRef.current === timestamp) {
      return;
    }

    lastHydrationStampRef.current = timestamp;
    hydrationStartedAtRef.current = null;

    const durationMs = Math.max(0, Math.round(performance.now() - startedAt));

    emitProjectDashboardHydrationMetric({
      durationMs,
      projectCount: projects.length,
      includeArchived: viewState.includeArchived,
      search: viewState.search,
      triggeredAt: new Date().toISOString(),
      fromCache: projectsQuery.isStale ?? false,
    });
  }, [
    isPlaceholderData,
    projectsQuery.isSuccess,
    projectsQuery.dataUpdatedAt,
    projects.length,
    viewState.includeArchived,
    viewState.search,
    projectsQuery.isStale,
  ]);

  useEffect(() => {
    if (hasRestoredScroll.current) {
      return;
    }
    if (!projectsQuery.isSuccess || isPlaceholderData) {
      return;
    }
    if (typeof window === 'undefined') {
      return;
    }
    window.requestAnimationFrame(() => {
      window.scrollTo({ top: viewState.scrollY ?? 0, behavior: 'auto' });
      hasRestoredScroll.current = true;
    });
  }, [isPlaceholderData, projectsQuery.isSuccess, viewState.scrollY]);

  useEffect(() => {
    return () => {
      if (typeof window === 'undefined') {
        return;
      }
      if (navigationTriggeredRef.current) {
        navigationTriggeredRef.current = false;
        return;
      }
      saveViewState({
        ...viewState,
        scrollY: window.scrollY,
      });
    };
  }, [viewState]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    try {
      const raw = window.sessionStorage.getItem(DASHBOARD_ARCHIVE_NOTICE_STORAGE_KEY);
      if (raw) {
        const payload = JSON.parse(raw) as { message?: string };
        showToast(
          'projects-toast-warning',
          payload?.message ?? 'A project you were viewing was archived.',
          'warning'
        );
        window.sessionStorage.removeItem(DASHBOARD_ARCHIVE_NOTICE_STORAGE_KEY);
      }
    } catch (error) {
      logger.warn(
        'dashboard.archive_notice.load_failed',
        buildLogContext('dashboard.archive_notice.load_failed', error)
      );
    }
  }, [showToast]);

  useEffect(() => {
    const handleDocumentClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target) {
        return;
      }
      if (target.closest('[data-project-card-actions-menu]')) {
        return;
      }
      if (target.closest('[data-testid="project-card-actions"]')) {
        return;
      }
      setOpenActionsProjectId(null);
    };

    document.addEventListener('click', handleDocumentClick);
    return () => document.removeEventListener('click', handleDocumentClick);
  }, []);

  const createProjectMutation = useMutation({
    mutationFn: async (input: CreateProjectRequest) => {
      if (typeof performance !== 'undefined') {
        createStartedAtRef.current = performance.now();
      } else {
        createStartedAtRef.current = null;
      }
      lastCreatePayloadRef.current = input;
      logger.info('dashboard.project_create.requested', { visibility: input.visibility });
      return api.projects.create(input);
    },
    onSuccess: created => {
      const startedAt = createStartedAtRef.current;
      const durationMs =
        typeof performance !== 'undefined' && startedAt !== null
          ? Math.max(0, Math.round(performance.now() - startedAt))
          : 0;
      createStartedAtRef.current = null;
      lastCreatePayloadRef.current = null;

      emitProjectCreateMetric({
        durationMs,
        projectId: created.id,
        visibility: created.visibility,
        result: 'success',
        triggeredAt: new Date().toISOString(),
      });

      logger.info('dashboard.project_create.succeeded', { projectId: created.id });
      setCreateDialogOpen(false);
      showToast('projects-toast-success', 'Project created successfully.');
      if (
        viewState.search.trim().length === 0 &&
        !viewState.includeArchived &&
        projectsQueryParams.offset === 0
      ) {
        queryClient.setQueryData<ProjectsListResponse>(projectsQueryKey, existing => {
          if (!existing) {
            return {
              projects: [created],
              total: 1,
              limit: projectsQueryParams.limit,
              offset: 0,
            };
          }
          const deduped = [
            created,
            ...existing.projects.filter(project => project.id !== created.id),
          ];
          return {
            ...existing,
            projects: deduped.slice(0, projectsQueryParams.limit),
            total: existing.total + 1,
          };
        });
      }
      queryClient.invalidateQueries({ queryKey: PROJECTS_QUERY_KEY });
    },
    onError: error => {
      const startedAt = createStartedAtRef.current;
      const durationMs =
        typeof performance !== 'undefined' && startedAt !== null
          ? Math.max(0, Math.round(performance.now() - startedAt))
          : 0;
      createStartedAtRef.current = null;
      const lastPayload = lastCreatePayloadRef.current;
      lastCreatePayloadRef.current = null;

      emitProjectCreateMetric({
        durationMs,
        projectId: undefined,
        visibility: lastPayload?.visibility ?? 'workspace',
        result: 'error',
        triggeredAt: new Date().toISOString(),
        errorMessage: error instanceof Error ? error.message : undefined,
      });

      logger.error(
        'dashboard.project_create.failed',
        {},
        error instanceof Error ? error : undefined
      );
    },
  });

  const archiveProjectMutation = useMutation<void, Error, ArchiveVariables>({
    mutationFn: async ({ project }) => {
      await api.projects.archive(project.id);
    },
    onMutate: ({ project }) => {
      applyArchiveOptimistic(project);
      setArchiveTarget(null);
      setOpenActionsProjectId(null);
    },
    onSuccess: (_, { project }) => {
      showToast('project-archive-success', `Project archived: "${project.name}".`);
      queryClient.invalidateQueries({ queryKey: PROJECTS_QUERY_KEY });
    },
    onError: (error, { project }) => {
      logger.error(
        'dashboard.project_archive.failed',
        { projectId: project.id },
        error instanceof Error ? error : undefined
      );
      showToast(
        'projects-toast-warning',
        `Unable to archive "${project.name}". Please try again.`,
        'warning'
      );
      queryClient.invalidateQueries({ queryKey: PROJECTS_QUERY_KEY });
    },
  });

  const restoreProjectMutation = useMutation<ProjectData, Error, RestoreVariables>({
    mutationFn: async ({ id }) => api.projects.restore(id),
    onMutate: () => {
      setOpenActionsProjectId(null);
    },
    onSuccess: (restored, { name }) => {
      applyRestoreOptimistic(restored);
      showToast('project-restore-success', `Project restored: "${name}".`);
      queryClient.invalidateQueries({ queryKey: PROJECTS_QUERY_KEY });
    },
    onError: (error, variables) => {
      logger.error(
        'dashboard.project_restore.failed',
        { projectId: variables.id },
        error instanceof Error ? error : undefined
      );
      showToast(
        'projects-toast-warning',
        `Unable to restore "${variables.name}". Please try again.`,
        'warning'
      );
      queryClient.invalidateQueries({ queryKey: PROJECTS_QUERY_KEY });
    },
  });

  const createErrorMessage = useMemo(() => {
    const error = createProjectMutation.error;
    if (!error) {
      return null;
    }
    if (error instanceof Error) {
      return error.message;
    }
    return 'Failed to create project. Please try again.';
  }, [createProjectMutation.error]);

  const handleOpenDialog = () => {
    setCreateDialogOpen(true);
    createProjectMutation.reset();
  };

  const handleCloseDialog = () => {
    setCreateDialogOpen(false);
    createProjectMutation.reset();
  };

  const handleCreateProject = async (payload: CreateProjectRequest) => {
    await createProjectMutation.mutateAsync(payload);
  };

  const handleArchiveRequest = useCallback((project: ProjectData) => {
    setArchiveTarget(project);
  }, []);

  const handleRestoreRequest = useCallback(
    (project: ProjectData) => {
      restoreProjectMutation.mutate({ id: project.id, name: project.name });
    },
    [restoreProjectMutation]
  );

  const handleConfirmArchive = useCallback(() => {
    if (!archiveTarget) {
      return;
    }
    archiveProjectMutation.mutate({ project: archiveTarget });
  }, [archiveProjectMutation, archiveTarget]);

  const handleProjectClick = useCallback(
    (projectId: string) => {
      if (typeof window !== 'undefined') {
        const scrollY = window.scrollY;
        applyViewState(prev => ({
          ...prev,
          scrollY,
        }));
      }
      navigationTriggeredRef.current = true;
      setActiveProject(projectId);
      navigate(`/project/${projectId}`);
    },
    [applyViewState, navigate, setActiveProject]
  );

  const handleSearchChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    setSearchInput(event.target.value);
  }, []);

  const handleSearchSubmit = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const trimmed = searchInput.trim();
      applyViewState(prev => ({
        ...prev,
        search: trimmed,
        scrollY: 0,
      }));
      if (typeof window !== 'undefined') {
        window.scrollTo({ top: 0 });
      }
    },
    [applyViewState, searchInput]
  );

  const handleClearSearch = useCallback(() => {
    setSearchInput('');
    applyViewState(prev => ({
      ...prev,
      search: '',
      scrollY: 0,
    }));
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0 });
    }
  }, [applyViewState]);

  const handleIncludeArchivedChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const checked = event.target.checked;
      applyViewState(prev => ({
        ...prev,
        includeArchived: checked,
      }));
    },
    [applyViewState]
  );

  if (!isLoaded) {
    return <div className="flex h-screen items-center justify-center">Loading...</div>;
  }

  const hasProjects = projects.length > 0;
  const isInitialLoading =
    (projectsQuery.isLoading || (projectsQuery.isFetching && isPlaceholderData)) && !hasProjects;
  const loadErrorMessage =
    projectsQuery.error instanceof Error ? projectsQuery.error.message : 'Failed to load projects';
  const showInlineError = projectsQuery.isError && hasProjects;
  const showFullError = projectsQuery.isError && !hasProjects;
  const navIsLoading =
    (projectsQuery.isLoading || (projectsQuery.isFetching && isPlaceholderData)) && !hasProjects;
  const showFetchSpinner = projectsQuery.isFetching && hasProjects;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="shadow-xs border-b bg-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center space-x-4">
              <h1 className="text-2xl font-bold text-gray-900">CTRL FreaQ</h1>
              <div className="hidden text-sm text-gray-500 sm:block">
                AI-Optimized Documentation System
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <Button variant="ghost" size="sm" onClick={() => navigate('/settings')}>
                <Settings className="mr-2 h-4 w-4" />
                Settings
              </Button>
              <UserButton />
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <h1 className="sr-only">Dashboard</h1>
        <div className="mb-8">
          <h2 className="mb-2 text-3xl font-bold text-gray-900">
            Welcome back, {user?.firstName || 'User'}
          </h2>
          <p className="text-gray-600">
            Manage your documentation projects and AI-optimized content.
          </p>
        </div>

        <aside className="mb-6">
          <ProjectsNav projects={projects} isLoading={navIsLoading} />
        </aside>

        <div className="mb-8 grid grid-cols-1 gap-6 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Total Projects</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{totalProjects}</div>
              <p className="text-sm text-gray-600">Active projects</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Documents</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">0</div>
              <p className="text-sm text-gray-600">Total documents</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Templates</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">0</div>
              <p className="text-sm text-gray-600">Available templates</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Recent Activity</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center text-sm text-gray-600">
                <Activity className="mr-1 h-4 w-4" />
                No recent activity yet
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <h3 className="text-xl font-semibold text-gray-900">Your Projects</h3>
          <Button onClick={handleOpenDialog} data-testid="open-create-project-dialog">
            <Plus className="mr-2 h-4 w-4" />
            New Project
          </Button>
        </div>

        <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <form
            className="flex w-full flex-1 flex-col gap-2 sm:flex-row sm:items-center"
            onSubmit={handleSearchSubmit}
          >
            <label htmlFor="dashboard-project-search" className="sr-only">
              Search projects
            </label>
            <input
              id="dashboard-project-search"
              data-testid="project-list-search-input"
              type="search"
              value={searchInput}
              onChange={handleSearchChange}
              placeholder="Search projects"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              autoComplete="off"
            />
            <div className="flex items-center gap-2 sm:justify-end">
              <Button type="submit" variant="outline" size="sm">
                Search
              </Button>
              {searchInput.trim().length > 0 && (
                <Button type="button" variant="ghost" size="sm" onClick={handleClearSearch}>
                  Clear
                </Button>
              )}
            </div>
          </form>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-sm text-gray-600">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                checked={viewState.includeArchived}
                onChange={handleIncludeArchivedChange}
                data-testid="dashboard-show-archived-toggle"
              />
              Include archived
            </label>
            {showFetchSpinner && (
              <Loader2 className="h-4 w-4 animate-spin text-gray-400" aria-hidden="true" />
            )}
          </div>
        </div>

        {showInlineError && (
          <div
            className="mb-4 rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-700"
            role="status"
            data-testid="projects-refetch-error"
          >
            <div className="mb-1 font-semibold text-amber-800">Failed to refresh projects</div>
            <p className="mb-3 text-amber-700">{loadErrorMessage}</p>
            <Button onClick={() => projectsQuery.refetch()} variant="outline" size="sm">
              Try Again
            </Button>
          </div>
        )}

        {isInitialLoading ? (
          <div className="flex flex-col items-center justify-center gap-3 py-12 text-gray-500">
            <Loader2 className="h-6 w-6 animate-spin" aria-hidden="true" />
            <span>Loading projects…</span>
          </div>
        ) : showFullError ? (
          <Card className="border-red-200 bg-red-50 py-12 text-center">
            <CardContent>
              <div className="mb-4 text-red-600">
                <Activity className="mx-auto mb-2 h-8 w-8" />
                Failed to load projects
              </div>
              <p className="mb-4 text-red-500">{loadErrorMessage}</p>
              <Button onClick={() => projectsQuery.refetch()} variant="outline">
                Try Again
              </Button>
            </CardContent>
          </Card>
        ) : projects.length === 0 ? (
          <Card className="py-12 text-center">
            <CardContent>
              <FileText className="mx-auto mb-4 h-12 w-12 text-gray-400" />
              <h3 className="mb-2 text-lg font-medium text-gray-900">No projects yet</h3>
              <p className="mb-4 text-gray-500">
                Get started by creating your first documentation project.
              </p>
              <Button onClick={handleOpenDialog}>
                <Plus className="mr-2 h-4 w-4" />
                Create your first project
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {projects.map(project => {
              const isMenuOpen =
                openActionsProjectId === project.id && project.status !== 'archived';
              const archivingProjectId = archiveProjectMutation.variables?.project.id;
              const restoringProjectId = restoreProjectMutation.variables?.id;
              const isArchiving =
                archiveProjectMutation.isPending && archivingProjectId === project.id;
              const isRestoring =
                restoreProjectMutation.isPending && restoringProjectId === project.id;

              return (
                <Card
                  key={project.id}
                  data-testid="project-card"
                  className="relative cursor-pointer transition-shadow hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500"
                  onClick={() => handleProjectClick(project.id)}
                  onKeyDown={event => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      handleProjectClick(project.id);
                    }
                  }}
                  role="button"
                  tabIndex={0}
                >
                  <CardHeader>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <CardTitle className="text-lg">{project.name}</CardTitle>
                        <CardDescription>{normalizeDescription(project)}</CardDescription>
                      </div>
                      {project.status === 'archived' ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          data-testid="project-restore-action"
                          disabled={isRestoring}
                          onClick={event => {
                            event.stopPropagation();
                            event.preventDefault();
                            handleRestoreRequest(project);
                          }}
                          className="flex items-center gap-2"
                        >
                          <RotateCcw className="h-4 w-4" />
                          {isRestoring ? 'Restoring…' : 'Restore project'}
                        </Button>
                      ) : (
                        <div className="relative">
                          <button
                            type="button"
                            data-testid="project-card-actions"
                            aria-haspopup="menu"
                            aria-expanded={isMenuOpen}
                            aria-label={`Project actions for ${project.name}`}
                            className="rounded p-1 text-gray-500 transition hover:bg-gray-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500"
                            onClick={event => {
                              event.stopPropagation();
                              event.preventDefault();
                              setOpenActionsProjectId(current =>
                                current === project.id ? null : project.id
                              );
                            }}
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </button>
                          {isMenuOpen ? (
                            <div
                              data-project-card-actions-menu
                              className="absolute right-0 z-10 mt-2 w-44 rounded-md border border-gray-200 bg-white py-1 shadow-lg"
                              role="menu"
                            >
                              <button
                                type="button"
                                role="menuitem"
                                data-testid="project-card-archive"
                                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-70"
                                onClick={event => {
                                  event.stopPropagation();
                                  event.preventDefault();
                                  handleArchiveRequest(project);
                                  setOpenActionsProjectId(null);
                                }}
                                disabled={isArchiving}
                              >
                                <Archive className="h-4 w-4" />
                                {isArchiving ? 'Archiving…' : 'Archive project'}
                              </button>
                            </div>
                          ) : null}
                        </div>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm text-gray-600">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-700">Status:</span>
                      <span
                        data-testid="project-status-badge"
                        className="inline-flex rounded-full bg-indigo-100 px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide text-indigo-700"
                      >
                        {project.status}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-700">Visibility:</span>
                      <span data-testid="project-visibility" className="capitalize">
                        {project.visibility}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-700">Goal date:</span>
                      <span data-testid="project-goal-target-date">
                        {formatGoalTargetDate(project.goalTargetDate)}
                      </span>
                    </div>
                    <div className="text-xs text-gray-500">
                      Last updated {new Date(project.updatedAt).toLocaleDateString()}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </main>

      <CreateProjectDialog
        open={isCreateDialogOpen}
        onCancel={handleCloseDialog}
        onCreate={handleCreateProject}
        isSubmitting={createProjectMutation.isPending}
        errorMessage={createErrorMessage}
        defaultVisibility="workspace"
      />

      <ArchiveProjectDialog
        open={Boolean(archiveTarget)}
        projectName={archiveTarget?.name ?? ''}
        isSubmitting={
          archiveProjectMutation.isPending &&
          archiveProjectMutation.variables?.project.id === archiveTarget?.id
        }
        onCancel={() => setArchiveTarget(null)}
        onConfirm={handleConfirmArchive}
      />

      {toast && (
        <div className="pointer-events-none fixed bottom-4 right-4 z-50">
          <div
            data-testid={toast.id}
            className={`rounded-md px-4 py-3 text-sm font-semibold text-white shadow-lg ${
              toast.tone === 'warning' ? 'bg-amber-600' : 'bg-emerald-600'
            }`}
            role="status"
          >
            {toast.message}
          </div>
        </div>
      )}
    </div>
  );
}

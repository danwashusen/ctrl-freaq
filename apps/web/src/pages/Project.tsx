import { useAuth, useUser, UserButton } from '@/lib/auth-provider';
import { ChevronsLeft, ChevronsRight, Edit, FileText, Settings, Share } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';

import DashboardShell from '@/components/dashboard/DashboardShell';
import { TemplateUpgradeBanner } from '../components/editor/TemplateUpgradeBanner';
import { TemplateValidationGate } from '../components/editor/TemplateValidationGate';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { ProjectMutationAlerts } from '../components/feedback/ProjectMutationAlerts';
import { PROJECTS_QUERY_KEY } from '@/features/projects/constants';
import ProjectsNav from '@/components/sidebar/ProjectsNav';
import { useApi } from '../lib/api-context';
import { logger } from '../lib/logger';
import { formatIsoDateFull } from '../lib/date-only';
import { useTemplateStore } from '../stores/template-store';
import { useProjectsQuery } from '@/hooks/use-projects-query';
import type { ApiError, ProjectData, ProjectStatus, UpdateProjectRequest } from '../lib/api';
import type { EventEnvelope } from '@/lib/streaming/event-hub';
import { useProjectStore } from '@/stores/project-store';
import { ProjectStatusBadge } from '@/components/status/ProjectStatusBadge';

const PROJECT_NAME_MAX_LENGTH = 120;
const GOAL_SUMMARY_MAX_LENGTH = 280;

type TemplateSectionOutline = {
  id: string;
  title?: string;
  orderIndex?: number;
  type?: string;
  children?: TemplateSectionOutline[];
};

type EditableProjectStatus = Exclude<ProjectStatus, 'archived'>;

type ProjectView = ProjectData & {
  documentsCount?: number;
};

type ProjectFormField = 'name' | 'description' | 'status' | 'goalSummary' | 'goalTargetDate';

type MutationState =
  | { type: 'idle'; message?: string }
  | { type: 'saving'; message?: string }
  | { type: 'success'; message?: string }
  | { type: 'conflict'; message?: string }
  | { type: 'error'; message?: string };

interface ProjectLifecycleEventPayload {
  projectId: string;
  status: ProjectStatus;
  previousStatus?: ProjectStatus | null;
  updatedBy?: string | null;
  archivedAt?: string | null;
  archivedBy?: string | null;
}

const DASHBOARD_ARCHIVE_NOTICE_STORAGE_KEY = 'ctrl-freaq:dashboard:archive-notice';

const isApiError = (error: unknown): error is ApiError =>
  typeof error === 'object' && error !== null && 'status' in error;

function getNestedValue(source: unknown, path: Array<string | number>): unknown {
  if (!path.length) {
    return source;
  }
  const [key, ...rest] = path;
  if (Array.isArray(source) && typeof key === 'number') {
    return getNestedValue(source[key], rest);
  }
  if (source && typeof source === 'object' && typeof key === 'string') {
    const value = (source as Record<string, unknown>)[key];
    return getNestedValue(value, rest);
  }
  return undefined;
}

export default function Project() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { projects, client, eventHub, eventHubHealth, eventHubEnabled } = useApi();
  const fallbackPollingActive = !eventHubEnabled || eventHubHealth.fallbackActive;
  const queryClient = useQueryClient();
  const { user } = useUser();
  const auth = useAuth();
  const setActiveProject = useProjectStore(state => state.setActiveProject);
  const sidebarCollapsed = useProjectStore(state => state.sidebarCollapsed);
  const toggleSidebarCollapsed = useProjectStore(state => state.toggleSidebarCollapsed);
  const projectsQuery = useProjectsQuery();
  const projectsList = projectsQuery.data?.projects ?? [];
  const hasNavProjects = projectsList.length > 0;
  const navIsLoading = !hasNavProjects && (projectsQuery.isLoading || projectsQuery.isFetching);
  const [project, setProject] = useState<ProjectView | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const archiveRedirectRef = useRef(false);
  const [viewerArchiveNotice, setViewerArchiveNotice] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [mutationState, setMutationState] = useState<MutationState>({ type: 'idle' });
  const [isEditingMetadata, setIsEditingMetadata] = useState(false);
  const metadataEditingInitializedRef = useRef(false);
  const [formState, setFormState] = useState<{
    name: string;
    description: string;
    status: EditableProjectStatus;
    goalSummary: string;
    goalTargetDate: string;
  }>({
    name: '',
    description: '',
    status: 'draft',
    goalSummary: '',
    goalTargetDate: '',
  });
  const statusOptions: ReadonlyArray<EditableProjectStatus> = [
    'draft',
    'active',
    'paused',
    'completed',
  ];
  const toDateInputValue = useCallback((value: string | null | undefined) => {
    if (!value) {
      return '';
    }
    return value.slice(0, 10);
  }, []);
  const syncFormWithProject = useCallback(
    (incoming: ProjectData) => {
      const normalizedStatus: EditableProjectStatus =
        incoming.status === 'archived' ? 'paused' : (incoming.status as EditableProjectStatus);
      setFormState({
        name: incoming.name,
        description: incoming.description ?? '',
        status: normalizedStatus,
        goalSummary: incoming.goalSummary ?? '',
        goalTargetDate: toDateInputValue(incoming.goalTargetDate),
      });
    },
    [toDateInputValue]
  );
  const initializeMetadataEditingState = useCallback((incoming: ProjectData | ProjectView) => {
    if (metadataEditingInitializedRef.current) {
      return;
    }
    setIsEditingMetadata(incoming.id === 'new');
    metadataEditingInitializedRef.current = true;
  }, []);
  const handleMetadataChange = useCallback(
    (field: ProjectFormField) =>
      (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const value = event.target.value;
        setFormState(previous => ({
          ...previous,
          [field]: value,
        }));
      },
    []
  );
  const handleMetadataSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (!project || project.status === 'archived') {
        return;
      }

      const normalizedDescription = formState.description.trim();
      const normalizedGoalSummary = formState.goalSummary.trim();
      const normalizedGoalTargetDate = formState.goalTargetDate.trim();

      const payload: UpdateProjectRequest = {
        name: formState.name.trim(),
        description: normalizedDescription.length === 0 ? null : normalizedDescription,
        status: formState.status,
        goalSummary: normalizedGoalSummary.length === 0 ? null : normalizedGoalSummary,
        goalTargetDate: normalizedGoalTargetDate.length === 0 ? null : normalizedGoalTargetDate,
      };

      setIsSaving(true);
      setMutationState({ type: 'saving' });

      try {
        const updated = await projects.update(project.id, payload, {
          ifUnmodifiedSince: project.updatedAt,
        });

        const nextProject: ProjectView = {
          ...updated,
          documentsCount: project.documentsCount,
        };

        setProject(nextProject);
        syncFormWithProject(updated);
        setIsEditingMetadata(false);

        setMutationState({
          type: 'success',
          message: 'Project updated successfully.',
        });

        void queryClient.invalidateQueries({ queryKey: PROJECTS_QUERY_KEY });

        window.setTimeout(() => {
          setMutationState(current => (current.type === 'success' ? { type: 'idle' } : current));
        }, 4000);
      } catch (updateError) {
        if (isApiError(updateError) && updateError.code === 'VERSION_CONFLICT') {
          setMutationState({
            type: 'conflict',
            message:
              updateError.message ??
              'Project has changed since you loaded it. Refresh to continue.',
          });
          try {
            const latest = await projects.getById(project.id);
            setProject({
              ...latest,
              documentsCount: project.documentsCount,
            });
            syncFormWithProject(latest);
          } catch (refreshError) {
            logger.error(
              'project.fetch_latest_failed',
              { projectId: project.id },
              refreshError instanceof Error ? refreshError : undefined
            );
          }
        } else if (isApiError(updateError)) {
          setMutationState({
            type: 'error',
            message: updateError.message ?? 'Unable to update the project. Please try again later.',
          });
        } else {
          setMutationState({
            type: 'error',
            message: 'Unexpected error updating project metadata.',
          });
        }
      } finally {
        setIsSaving(false);
      }
    },
    [formState, project, projects, queryClient, syncFormWithProject]
  );
  const handleSidebarProjectSelect = useCallback(
    (projectId: string) => {
      setActiveProject(projectId);
      navigate(`/project/${projectId}`);
    },
    [navigate, setActiveProject]
  );
  useEffect(() => {
    metadataEditingInitializedRef.current = false;
    setIsEditingMetadata(false);
  }, [id]);

  const handleArchivedWhileViewing = useCallback(
    (latest?: ProjectData) => {
      if (!project || archiveRedirectRef.current) {
        return;
      }
      archiveRedirectRef.current = true;
      setViewerArchiveNotice('This project was archived while you were viewing it.');
      setActiveProject(null);

      setProject(prev => {
        if (!prev) {
          return prev;
        }
        const source = latest ?? prev;
        return {
          ...prev,
          ...source,
          status: source.status ?? 'archived',
          deletedAt: source.deletedAt ?? new Date().toISOString(),
          deletedBy: source.deletedBy ?? prev.deletedBy ?? null,
          archivedStatusBefore: source.archivedStatusBefore ?? prev.archivedStatusBefore,
        };
      });

      queryClient.invalidateQueries({ queryKey: PROJECTS_QUERY_KEY });

      try {
        if (typeof window !== 'undefined') {
          window.sessionStorage.setItem(
            DASHBOARD_ARCHIVE_NOTICE_STORAGE_KEY,
            JSON.stringify({
              message: `Project "${project.name}" was archived while you were viewing it.`,
            })
          );
        }
      } catch (storageError) {
        logger.error(
          'project.archive_notice.persist_failed',
          { projectId: project.id },
          storageError instanceof Error ? storageError : undefined
        );
      }

      window.setTimeout(() => {
        navigate('/dashboard');
      }, 1500);
    },
    [navigate, project, queryClient, setActiveProject]
  );
  const dismissMutationAlert = useCallback(() => {
    setMutationState({ type: 'idle' });
  }, []);
  const startEditingMetadata = useCallback(() => {
    if (project?.status === 'archived') {
      return;
    }
    setIsEditingMetadata(true);
  }, [project?.status]);
  const cancelEditingMetadata = useCallback(() => {
    if (project) {
      syncFormWithProject(project);
    }
    setMutationState(current => (current.type === 'success' ? { type: 'idle' } : current));
    setIsEditingMetadata(false);
  }, [project, syncFormWithProject]);

  const templateStatus = useTemplateStore(state => state.status);
  const templateDocument = useTemplateStore(state => state.document);
  const templateMigration = useTemplateStore(state => state.migration);
  const removedVersion = useTemplateStore(state => state.removedVersion);
  const templateError = useTemplateStore(state => state.error);
  const templateErrorCode = useTemplateStore(state => state.errorCode);
  const upgradeFailure = useTemplateStore(state => state.upgradeFailure);
  const sections = useTemplateStore(state => state.sections);
  const validator = useTemplateStore(state => state.validator);
  const formValue = useTemplateStore(state => state.formValue);
  const setFormValue = useTemplateStore(state => state.setFormValue);
  const loadDocument = useTemplateStore(state => state.loadDocument);
  const resetTemplate = useTemplateStore(state => state.reset);
  const projectId = project?.id ?? null;

  useEffect(() => {
    let cancelled = false;

    async function fetchProject(projectId: string) {
      try {
        setLoading(true);
        setError(null);
        const result = await projects.getById(projectId);
        if (!cancelled) {
          setProject({
            ...result,
            description: result.description ?? null,
            goalSummary: result.goalSummary ?? null,
            goalTargetDate: result.goalTargetDate ?? null,
            documentsCount: 0,
          });
          setActiveProject(result.id);
          syncFormWithProject(result);
          initializeMetadataEditingState(result);
        }
      } catch (fetchError) {
        const message =
          fetchError instanceof Error ? fetchError.message : 'Error fetching project.';
        if (!cancelled) {
          setError(message);
          setProject(null);
        }
        logger.error(
          'project.fetch_failed',
          { projectId },
          fetchError instanceof Error ? fetchError : undefined
        );
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    if (id && id !== 'new') {
      archiveRedirectRef.current = false;
      setViewerArchiveNotice(null);
      void fetchProject(id);
      void loadDocument({ apiClient: client, documentId: id });
    } else if (id === 'new') {
      const nowIso = new Date().toISOString();
      const draftProject: ProjectView = {
        id: 'new',
        name: 'New Project',
        ownerUserId: 'user_local',
        slug: 'new-project',
        description: 'Create a new documentation project',
        visibility: 'workspace',
        status: 'draft',
        goalTargetDate: null,
        goalSummary: null,
        createdAt: nowIso,
        createdBy: 'user_local',
        updatedAt: nowIso,
        updatedBy: 'user_local',
        deletedAt: null,
        deletedBy: null,
        archivedStatusBefore: null,
        documentsCount: 0,
      };
      setProject(draftProject);
      syncFormWithProject(draftProject);
      initializeMetadataEditingState(draftProject);
      resetTemplate();
      setLoading(false);
      setActiveProject(null);
    }

    return () => {
      cancelled = true;
      resetTemplate();
    };
  }, [
    client,
    id,
    initializeMetadataEditingState,
    loadDocument,
    setActiveProject,
    projects,
    resetTemplate,
    syncFormWithProject,
  ]);

  useEffect(() => {
    if (!eventHubEnabled || !projectId || projectId === 'new' || archiveRedirectRef.current) {
      return;
    }

    const unsubscribe = eventHub.subscribe(
      { topic: 'project.lifecycle', resourceId: projectId },
      (envelope: EventEnvelope<ProjectLifecycleEventPayload>) => {
        if (envelope.kind === 'heartbeat') {
          return;
        }

        const payload = envelope.payload;
        if (!payload || payload.projectId !== projectId) {
          return;
        }

        let nextProject: ProjectView | null = null;

        setProject(prev => {
          if (!prev || prev.id !== payload.projectId) {
            return prev;
          }

          const nextStatus = payload.status ?? prev.status;
          const isArchived = nextStatus === 'archived';
          const archivedStatusBefore =
            isArchived && payload.previousStatus && payload.previousStatus !== 'archived'
              ? (payload.previousStatus as Exclude<ProjectStatus, 'archived'>)
              : isArchived
                ? prev.archivedStatusBefore
                : null;

          const updatedProject: ProjectView = {
            ...prev,
            status: nextStatus,
            archivedStatusBefore,
            updatedBy: payload.updatedBy ?? prev.updatedBy,
            updatedAt: envelope.emittedAt ?? prev.updatedAt,
            deletedAt: isArchived ? payload.archivedAt ?? prev.deletedAt : null,
            deletedBy: isArchived ? payload.archivedBy ?? prev.deletedBy : null,
          };

          nextProject = updatedProject;
          return updatedProject;
        });

        if (!nextProject) {
          return;
        }

        const projectForSync = nextProject as ProjectView;

        if (projectForSync.status === 'archived') {
          handleArchivedWhileViewing(projectForSync);
          return;
        }

        if (!isEditingMetadata) {
          syncFormWithProject(projectForSync);
        }
      }
    );

    return () => {
      unsubscribe();
    };
  }, [
    eventHub,
    eventHubEnabled,
    handleArchivedWhileViewing,
    isEditingMetadata,
    projectId,
    syncFormWithProject,
  ]);

  useEffect(() => {
    if (
      !fallbackPollingActive ||
      !projectId ||
      projectId === 'new' ||
      archiveRedirectRef.current
    ) {
      return;
    }

    let cancelled = false;

    const poll = async () => {
      try {
        const latest = await projects.getById(projectId);
        if (cancelled) {
          return;
        }
        if (latest.status === 'archived') {
          handleArchivedWhileViewing(latest);
        } else {
          setProject(prev =>
            prev
              ? {
                  ...prev,
                  ...latest,
                  documentsCount: prev.documentsCount,
                }
              : prev
          );
          if (!isEditingMetadata) {
            syncFormWithProject(latest);
          }
        }
      } catch (pollError) {
        if (cancelled) {
          return;
        }
        if (isApiError(pollError) && pollError.status === 404) {
          handleArchivedWhileViewing();
        }
      }
    };

    void poll();
    const interval = window.setInterval(poll, 1500);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [
    fallbackPollingActive,
    handleArchivedWhileViewing,
    isEditingMetadata,
    projectId,
    projects,
    syncFormWithProject,
  ]);

  const migrationSummary = useMemo(() => {
    if (!templateMigration || !templateDocument) {
      return null;
    }
    return {
      status: templateMigration.status,
      fromVersion: templateMigration.fromVersion,
      toVersion: templateMigration.toVersion,
      templateId: templateDocument.templateId,
      completedAt: templateMigration.completedAt ?? undefined,
    };
  }, [templateDocument, templateMigration]);

  const removedVersionInfo = useMemo(() => {
    if (!removedVersion) {
      return null;
    }
    return {
      templateId: removedVersion.templateId,
      version: removedVersion.version,
      message:
        'This document references a removed template version. Ask a template manager to reinstate or migrate the template before editing.',
    };
  }, [removedVersion]);

  const handleFieldChange = useCallback(
    (
      setFieldValue: (path: Array<string | number>, value: unknown) => void,
      path: Array<string>,
      value: unknown
    ) => {
      setFieldValue(path, value);
    },
    []
  );

  const renderSections = useCallback(
    (
      sectionList: TemplateSectionOutline[],
      setFieldValue: (path: Array<string | number>, value: unknown) => void,
      parentPath: string[] = []
    ) => {
      const currentValues = formValue ?? {};
      return sectionList.map(section => {
        const path = [...parentPath, section.id];
        const fieldValue = getNestedValue(currentValues, path) ?? '';
        const key = path.join('.');

        if (section.children && section.children.length > 0) {
          return (
            <fieldset key={key} className="space-y-4 rounded-md border border-gray-200 p-4">
              <legend className="px-1 text-sm font-semibold text-gray-700">
                {section.title ?? section.id}
              </legend>
              {renderSections(section.children, setFieldValue, path)}
            </fieldset>
          );
        }

        const isLongText = section.type === 'markdown' || section.type === 'string';

        return (
          <div key={key} className="space-y-2">
            <label className="block text-sm font-medium text-gray-700" htmlFor={key}>
              {section.title ?? section.id}
            </label>
            {isLongText ? (
              <textarea
                id={key}
                className="shadow-xs focus:outline-hidden w-full rounded-md border border-gray-300 p-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                rows={section.type === 'markdown' ? 6 : 3}
                value={String(fieldValue ?? '')}
                onChange={event => handleFieldChange(setFieldValue, path, event.target.value)}
              />
            ) : (
              <input
                id={key}
                className="shadow-xs focus:outline-hidden w-full rounded-md border border-gray-300 p-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                value={String(fieldValue ?? '')}
                onChange={event => handleFieldChange(setFieldValue, path, event.target.value)}
              />
            )}
          </div>
        );
      });
    },
    [formValue, handleFieldChange]
  );

  useEffect(() => {
    if (id && id !== 'new') {
      setActiveProject(id);
    }
  }, [id, setActiveProject]);

  const handleSwitchAccount = useCallback(async () => {
    const signOut = auth?.signOut;
    if (typeof signOut !== 'function') {
      return;
    }
    try {
      await signOut();
    } catch (error) {
      logger.error('project.switch_account_failed', {}, error instanceof Error ? error : undefined);
    }
  }, [auth]);

  const computedFullName = typeof user?.fullName === 'string' ? user.fullName.trim() : '';
  const fallbackName = [user?.firstName, user?.lastName].filter(Boolean).join(' ').trim();
  const displayName =
    computedFullName || fallbackName || user?.primaryEmailAddress?.emailAddress || undefined;
  const userEmail = user?.primaryEmailAddress?.emailAddress ?? undefined;
  const userAvatarUrl =
    typeof user?.imageUrl === 'string' && user.imageUrl.trim().length > 0
      ? user.imageUrl
      : undefined;
  const accountName = displayName ?? userEmail ?? user?.id ?? undefined;
  const sidebarAccount =
    user && accountName
      ? {
          name: accountName,
          email: userEmail,
          avatarUrl: userAvatarUrl,
        }
      : undefined;
  const collapseLabel = sidebarCollapsed
    ? 'Expand sidebar navigation'
    : 'Collapse sidebar navigation';

  const headerActions = (
    <>
      <Button
        variant="ghost"
        size="icon"
        className="hidden lg:inline-flex"
        onClick={() => {
          toggleSidebarCollapsed();
        }}
        aria-pressed={sidebarCollapsed}
        aria-label={collapseLabel}
        data-testid="project-shell-collapse-button"
        data-collapsed={sidebarCollapsed ? 'true' : 'false'}
      >
        <span className="sr-only">{collapseLabel}</span>
        {sidebarCollapsed ? (
          <ChevronsRight className="h-4 w-4" aria-hidden="true" />
        ) : (
          <ChevronsLeft className="h-4 w-4" aria-hidden="true" />
        )}
      </Button>
      <Button variant="ghost" size="sm" onClick={() => navigate('/settings')}>
        <Settings className="mr-2 h-4 w-4" />
        Settings
      </Button>
      <div data-testid="user-button">
        <UserButton />
      </div>
    </>
  );

  const renderShell = (content: ReactNode) => (
    <DashboardShell
      title="CTRL FreaQ"
      subtitle="AI-Optimized Documentation System"
      headerActions={headerActions}
      sidebar={({ closeSidebar, isCollapsed }) => (
        <ProjectsNav
          projects={projectsList}
          isLoading={navIsLoading}
          isError={projectsQuery.isError}
          errorMessage={
            projectsQuery.error instanceof Error
              ? projectsQuery.error.message
              : 'Failed to load projects'
          }
          activeProjectIdOverride={id && id !== 'new' ? id : null}
          isCollapsed={isCollapsed}
          onProjectSelect={projectId => {
            closeSidebar();
            handleSidebarProjectSelect(projectId);
          }}
          onRetry={() => {
            projectsQuery.refetch();
          }}
          currentUser={
            sidebarAccount
              ? {
                  name: sidebarAccount.name,
                  email: sidebarAccount.email,
                  avatarUrl: sidebarAccount.avatarUrl,
                  onSwitchAccount: () => {
                    closeSidebar();
                    void handleSwitchAccount();
                  },
                }
              : undefined
          }
          onDashboardSelect={() => {
            closeSidebar();
            navigate('/dashboard');
          }}
        />
      )}
    >
      {content}
    </DashboardShell>
  );

  if (loading) {
    return renderShell(
      <div className="flex min-h-[60vh] items-center justify-center text-sm text-gray-500">
        Loading project…
      </div>
    );
  }

  if (error) {
    return renderShell(
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="max-w-lg rounded-md border border-red-200 bg-red-50 p-6 text-center">
          <h2 className="text-lg font-semibold text-red-900">Failed to load project</h2>
          <p className="mt-2 text-sm text-red-800">{error}</p>
        </div>
      </div>
    );
  }

  if (!project) {
    return renderShell(
      <div className="flex min-h-[60vh] items-center justify-center text-sm text-gray-500">
        Project not found
      </div>
    );
  }

  const alertStatus: 'idle' | 'success' | 'conflict' | 'error' =
    mutationState.type === 'saving' ? 'idle' : mutationState.type;
  const alertMessage = mutationState.type === 'saving' ? undefined : mutationState.message;
  const isProjectArchived = project.status === 'archived';
  const isNewProject = project.id === 'new';
  const isMetadataFormVisible = isEditingMetadata || isNewProject;
  const goalTargetDateDisplay =
    project.goalTargetDate && !isMetadataFormVisible
      ? formatIsoDateFull(project.goalTargetDate)
      : null;

  return renderShell(
    <>
      <div className="mb-8">
        <h2 className="mb-2 text-3xl font-bold text-gray-900">{project.name}</h2>
        <p className="text-gray-600">{project.description ?? 'No description provided'}</p>
        <div className="mt-4 text-sm text-gray-500">
          Created: {new Date(project.createdAt).toLocaleDateString()} • Last updated:{' '}
          {new Date(project.updatedAt).toLocaleString()}
        </div>
      </div>

      <section className="mb-10 space-y-4">
        {viewerArchiveNotice && (
          <div
            data-testid="project-archived-notification"
            className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800"
            role="alert"
          >
            {viewerArchiveNotice} Redirecting to dashboard…
          </div>
        )}
        <ProjectMutationAlerts
          status={alertStatus}
          message={alertMessage}
          onDismiss={dismissMutationAlert}
        />
        <Card>
          <CardHeader className="flex flex-col gap-4 border-b border-gray-100 pb-4 sm:flex-row sm:items-start sm:justify-between sm:pb-6">
            <div>
              <CardTitle className="text-lg">Project Metadata</CardTitle>
              <CardDescription>
                Update lifecycle status, description, and goal summary for this project.
              </CardDescription>
            </div>
            {!isMetadataFormVisible && !isProjectArchived ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                data-testid="project-edit-toggle"
                onClick={startEditingMetadata}
              >
                <Edit className="mr-2 h-4 w-4" />
                Edit Project
              </Button>
            ) : null}
          </CardHeader>
          <CardContent>
            {isMetadataFormVisible ? (
              <form
                data-testid="project-metadata-form"
                className="grid grid-cols-1 gap-6 md:grid-cols-2"
                onSubmit={handleMetadataSubmit}
              >
                {isProjectArchived ? (
                  <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 md:col-span-2">
                    Archived projects are read-only. Restore the project to edit metadata.
                  </div>
                ) : null}
                <div className="space-y-2">
                  <label
                    className="block text-sm font-medium text-gray-700"
                    htmlFor="project-name-input"
                  >
                    Project name
                  </label>
                  <input
                    id="project-name-input"
                    data-testid="project-metadata-name"
                    name="project-name"
                    autoComplete="off"
                    className="shadow-xs focus:outline-hidden w-full rounded-md border border-gray-300 p-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                    value={formState.name}
                    onChange={handleMetadataChange('name')}
                    disabled={isSaving || isProjectArchived}
                    required
                    maxLength={PROJECT_NAME_MAX_LENGTH}
                  />
                </div>

                <div className="space-y-2">
                  <label
                    className="block text-sm font-medium text-gray-700"
                    htmlFor="project-status-select"
                  >
                    Lifecycle status
                  </label>
                  <select
                    id="project-status-select"
                    data-testid="project-metadata-status"
                    name="project-status"
                    autoComplete="off"
                    className="shadow-xs focus:outline-hidden w-full rounded-md border border-gray-300 p-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                    value={formState.status}
                    onChange={handleMetadataChange('status')}
                    disabled={isSaving || isProjectArchived}
                  >
                    {statusOptions.map(status => (
                      <option key={status} value={status}>
                        {status.charAt(0).toUpperCase() + status.slice(1)}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2 md:col-span-2">
                  <label
                    className="block text-sm font-medium text-gray-700"
                    htmlFor="project-description-input"
                  >
                    Description
                  </label>
                  <textarea
                    id="project-description-input"
                    data-testid="project-metadata-description"
                    name="project-description"
                    autoComplete="off"
                    className="shadow-xs focus:outline-hidden w-full rounded-md border border-gray-300 p-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                    rows={3}
                    value={formState.description}
                    onChange={handleMetadataChange('description')}
                    disabled={isSaving || isProjectArchived}
                  />
                </div>

                <div className="space-y-2">
                  <label
                    className="block text-sm font-medium text-gray-700"
                    htmlFor="project-goal-summary-input"
                  >
                    Goal summary
                  </label>
                  <input
                    id="project-goal-summary-input"
                    data-testid="project-metadata-goal-summary"
                    name="project-goal-summary"
                    autoComplete="off"
                    className="shadow-xs focus:outline-hidden w-full rounded-md border border-gray-300 p-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                    value={formState.goalSummary}
                    onChange={handleMetadataChange('goalSummary')}
                    disabled={isSaving || isProjectArchived}
                    maxLength={GOAL_SUMMARY_MAX_LENGTH}
                    placeholder="Short description of upcoming milestone"
                  />
                </div>

                <div className="space-y-2">
                  <label
                    className="block text-sm font-medium text-gray-700"
                    htmlFor="project-goal-target-date-input"
                  >
                    Goal target date
                  </label>
                  <input
                    id="project-goal-target-date-input"
                    data-testid="project-metadata-goal-target-date"
                    name="project-goal-target-date"
                    autoComplete="off"
                    type="date"
                    className="shadow-xs focus:outline-hidden w-full rounded-md border border-gray-300 p-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                    value={formState.goalTargetDate}
                    onChange={handleMetadataChange('goalTargetDate')}
                    disabled={isSaving || isProjectArchived}
                  />
                </div>

                <div className="flex items-center justify-end gap-2 md:col-span-2">
                  {!isNewProject ? (
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={cancelEditingMetadata}
                      disabled={isSaving}
                    >
                      Cancel
                    </Button>
                  ) : null}
                  <Button
                    type="submit"
                    data-testid="project-metadata-submit"
                    disabled={isSaving || isProjectArchived}
                  >
                    {isSaving ? 'Saving…' : 'Save changes'}
                  </Button>
                </div>
              </form>
            ) : (
              <div
                data-testid="project-metadata-view"
                className="grid grid-cols-1 gap-6 md:grid-cols-2"
              >
                {isProjectArchived ? (
                  <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 md:col-span-2">
                    Archived projects are read-only. Restore the project to edit metadata.
                  </div>
                ) : (
                  <p className="text-sm text-gray-600 md:col-span-2">
                    Review lifecycle details and select “Edit Project” to make changes.
                  </p>
                )}
                <div>
                  <h3 className="text-sm font-medium text-gray-700">Project name</h3>
                  <p
                    data-testid="project-metadata-view-name"
                    className="mt-1 text-sm text-gray-900"
                  >
                    {project.name}
                  </p>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-gray-700">Lifecycle status</h3>
                  <ProjectStatusBadge
                    status={project.status}
                    className="mt-1"
                    data-testid="project-metadata-view-status"
                  />
                </div>
                <div className="md:col-span-2">
                  <h3 className="text-sm font-medium text-gray-700">Description</h3>
                  <p
                    data-testid="project-metadata-view-description"
                    className="mt-1 text-sm text-gray-900"
                  >
                    {project.description ? project.description : 'No description provided'}
                  </p>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-gray-700">Goal summary</h3>
                  <p
                    data-testid="project-metadata-view-goal-summary"
                    className="mt-1 text-sm text-gray-900"
                  >
                    {project.goalSummary ? project.goalSummary : 'Not set'}
                  </p>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-gray-700">Goal target date</h3>
                  <p
                    data-testid="project-metadata-view-goal-target-date"
                    className="mt-1 text-sm text-gray-900"
                  >
                    {goalTargetDateDisplay ?? 'Not set'}
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      <div className="mb-8 grid grid-cols-1 gap-6 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Documents</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{project.documentsCount ?? 0}</div>
            <p className="text-sm text-gray-600">Total documents</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Templates Used</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{templateDocument ? 1 : 0}</div>
            <p className="text-sm text-gray-600">Active templates</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Export Ready</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">85%</div>
            <p className="text-sm text-gray-600">Completion status</p>
          </CardContent>
        </Card>
      </div>

      {id !== 'new' && (
        <section className="space-y-4">
          <h3 className="text-xl font-semibold text-gray-900">Document Template</h3>
          <TemplateUpgradeBanner
            migration={migrationSummary}
            removedVersion={removedVersionInfo}
            upgradeFailure={upgradeFailure}
          >
            {templateStatus === 'loading' && (
              <div className="rounded-md border border-gray-200 bg-white p-4 text-sm text-gray-700">
                Loading template details…
              </div>
            )}

            {templateStatus === 'blocked' && removedVersionInfo ? (
              <div className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                Editing is disabled until the template manager restores or migrates this version.
              </div>
            ) : null}

            {templateStatus === 'upgrade_failed' && upgradeFailure ? (
              <div
                className="rounded-md border border-amber-200 bg-amber-100 p-4 text-sm text-amber-900"
                data-testid="template-upgrade-failed-guidance"
              >
                Editing is disabled until the auto-upgrade issues above are resolved and content
                passes validation.
              </div>
            ) : null}

            {templateStatus === 'error' && (
              <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-900">
                {templateError ?? 'Failed to load template details. Try reloading the page.'}
                {templateErrorCode ? (
                  <div className="mt-2 text-xs text-red-800">Error code: {templateErrorCode}</div>
                ) : null}
              </div>
            )}

            {templateStatus === 'ready' && templateDocument && validator ? (
              <TemplateValidationGate
                documentId={templateDocument.id}
                templateId={templateDocument.templateId}
                validator={validator}
                value={formValue ?? {}}
                onChange={value => {
                  const nextValue =
                    value && typeof value === 'object' && !Array.isArray(value)
                      ? (value as Record<string, unknown>)
                      : {};
                  setFormValue(nextValue);
                }}
                onValid={value => {
                  const nextValue =
                    value && typeof value === 'object' && !Array.isArray(value)
                      ? (value as Record<string, unknown>)
                      : {};
                  logger.info('document.template.validated', {
                    documentId: templateDocument.id,
                    templateId: templateDocument.templateId,
                    templateVersion: templateDocument.templateVersion,
                  });
                  setFormValue(nextValue);
                }}
              >
                {({ submit, setFieldValue, errors }) => (
                  <form
                    data-testid="document-editor-form"
                    className="space-y-6"
                    onSubmit={event => {
                      event.preventDefault();
                      submit();
                    }}
                  >
                    {sections.length === 0 ? (
                      <p className="rounded-md border border-gray-200 bg-white p-4 text-sm text-gray-700">
                        No template sections available for editing.
                      </p>
                    ) : (
                      renderSections(sections, setFieldValue)
                    )}

                    <div className="space-y-2">
                      <h4 className="text-sm font-semibold text-gray-700">Validation Issues</h4>
                      <ul data-testid="template-errors" className="space-y-1 text-sm text-red-700">
                        {errors.map(issue => (
                          <li key={issue.path.join('.') || issue.message}>{issue.message}</li>
                        ))}
                      </ul>
                      {errors.length === 0 ? (
                        <p className="text-sm text-gray-500">
                          All template fields satisfy the schema.
                        </p>
                      ) : null}
                    </div>

                    <div className="flex items-center justify-end gap-3">
                      <Button type="submit" className="inline-flex items-center">
                        <FileText className="mr-2 h-4 w-4" />
                        Save Changes
                      </Button>
                    </div>
                  </form>
                )}
              </TemplateValidationGate>
            ) : null}
          </TemplateUpgradeBanner>
        </section>
      )}

      <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Card className="cursor-pointer transition-shadow hover:shadow-md">
          <CardHeader>
            <CardTitle className="flex items-center">
              <FileText className="mr-2 h-5 w-5" />
              Create Document
            </CardTitle>
            <CardDescription>Start writing a new document for this project</CardDescription>
          </CardHeader>
        </Card>

        <Card className="cursor-pointer transition-shadow hover:shadow-md">
          <CardHeader>
            <CardTitle className="flex items-center">
              <Edit className="mr-2 h-5 w-5" />
              Edit Templates
            </CardTitle>
            <CardDescription>Customize templates for this project</CardDescription>
          </CardHeader>
        </Card>

        <Card className="cursor-pointer transition-shadow hover:shadow-md">
          <CardHeader>
            <CardTitle className="flex items-center">
              <Share className="mr-2 h-5 w-5" />
              Export Project
            </CardTitle>
            <CardDescription>Export documents in various formats</CardDescription>
          </CardHeader>
        </Card>
      </div>
    </>
  );
}

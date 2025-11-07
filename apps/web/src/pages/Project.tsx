import { useAuth, useUser, UserButton } from '@/lib/auth-provider';
import {
  ChevronsLeft,
  ChevronsRight,
  Edit,
  FileText,
  Loader2,
  Settings,
  Share,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from 'react-router-dom';

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
import { useCreateDocument } from '@/features/document-editor/hooks/use-create-document';
import type {
  ApiError,
  ProjectExportJob,
  PrimaryDocumentSnapshotResponse,
  ProjectData,
  ProjectStatus,
  UpdateProjectRequest,
} from '../lib/api';
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
  const getProjectById = projects.getById;
  const updateProject = projects.update;
  const apiClientRef = useRef(client);
  const fallbackPollingActive = !eventHubEnabled || eventHubHealth.fallbackActive;
  const queryClient = useQueryClient();
  const { user } = useUser();
  const auth = useAuth();
  const setActiveProject = useProjectStore(state => state.setActiveProject);
  const activeProjectId = useProjectStore(state => state.activeProjectId);
  const sidebarCollapsed = useProjectStore(state => state.sidebarCollapsed);
  const toggleSidebarCollapsed = useProjectStore(state => state.toggleSidebarCollapsed);
  const projectsQuery = useProjectsQuery();
  const projectsList = projectsQuery.data?.projects ?? [];
  const hasNavProjects = projectsList.length > 0;
  const navIsLoading = !hasNavProjects && (projectsQuery.isLoading || projectsQuery.isFetching);
  const [project, setProject] = useState<ProjectView | null>(null);
  const projectRef = useRef<ProjectView | null>(null);
  const [primarySnapshot, setPrimarySnapshot] = useState<PrimaryDocumentSnapshotResponse | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [createDocumentError, setCreateDocumentError] = useState<string | null>(null);
  const [createDocumentSuccess, setCreateDocumentSuccess] = useState(false);
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
  const [createDocumentInFlight, setCreateDocumentInFlight] = useState(false);
  const [showProvisioningHint, setShowProvisioningHint] = useState(false);
  const [exportInFlight, setExportInFlight] = useState(false);
  const [exportState, setExportState] = useState<
    'idle' | 'queued' | 'running' | 'completed' | 'failed'
  >('idle');
  const [exportJob, setExportJob] = useState<ProjectExportJob | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const [templateSubmitState, setTemplateSubmitState] = useState<
    'idle' | 'submitting' | 'success' | 'error'
  >('idle');
  const [templateSubmitMessage, setTemplateSubmitMessage] = useState<string | null>(null);
  const {
    createDocument,
    isPending: isProvisioning,
    reset: resetProvisioningMutation,
  } = useCreateDocument({
    apiClient: client,
    onSuccess: result => {
      setCreateDocumentInFlight(false);
      setTimeout(() => {
        setShowProvisioningHint(false);
      }, 500);
      setCreateDocumentError(null);
      setCreateDocumentSuccess(true);
      setPrimarySnapshot({
        projectId: result.projectId,
        status: 'ready',
        document: {
          documentId: result.documentId,
          firstSectionId: result.firstSectionId,
          title: result.title,
          lifecycleStatus: result.lifecycleStatus,
          lastModifiedAt: result.lastModifiedAt,
          template: result.template,
        },
        templateDecision: null,
        lastUpdatedAt: result.lastModifiedAt,
      });
      void queryClient.invalidateQueries({ queryKey: PROJECTS_QUERY_KEY, exact: false });
      resetProvisioningMutation();
      navigate(`/documents/${result.documentId}/sections/${result.firstSectionId}`);
    },
    onError: error => {
      setCreateDocumentInFlight(false);
      setTimeout(() => {
        setShowProvisioningHint(false);
      }, 250);
      const message =
        error instanceof Error && error.message.length > 0
          ? error.message
          : 'Unable to create document.';
      setCreateDocumentError(message);
      setCreateDocumentSuccess(false);
      logger.error(
        'project.create_document_failed',
        { projectId: project?.id ?? id ?? 'unknown' },
        error instanceof Error ? error : undefined
      );
    },
  });
  const primaryDocumentStatus = isProvisioning ? 'loading' : (primarySnapshot?.status ?? 'loading');
  const primaryDocumentReady =
    primarySnapshot?.status === 'ready' &&
    Boolean(primarySnapshot.document?.documentId) &&
    Boolean(primarySnapshot.document?.firstSectionId);
  const openDocumentHref = useMemo(() => {
    if (
      !primaryDocumentReady ||
      !primarySnapshot?.document?.documentId ||
      !primarySnapshot.document?.firstSectionId
    ) {
      return null;
    }

    return `/documents/${primarySnapshot.document.documentId}/sections/${primarySnapshot.document.firstSectionId}`;
  }, [primaryDocumentReady, primarySnapshot]);
  const openDocumentDisabled = !openDocumentHref || isProvisioning;
  const openDocumentDescription = useMemo(() => {
    if (isProvisioning) {
      return 'Creating architecture document…';
    }
    if (!primarySnapshot) {
      return 'Loading live document status…';
    }

    switch (primarySnapshot.status) {
      case 'ready':
        return primarySnapshot.document?.title
          ? `Open “${primarySnapshot.document.title}” in the editor with live data.`
          : 'Open the primary document in the editor with live data.';
      case 'loading':
        return 'Preparing live document data…';
      case 'missing':
        return 'No primary document yet. Create one to get started.';
      case 'archived':
        return 'Primary document archived. Restore or create a new document to continue.';
      default:
        return 'Document status unavailable.';
    }
  }, [isProvisioning, primarySnapshot]);
  const openDocumentStatusLabel = useMemo(() => {
    if (isProvisioning) {
      return 'Provisioning';
    }
    if (!primarySnapshot) {
      return 'Unknown';
    }
    switch (primarySnapshot.status) {
      case 'ready':
        return 'Ready';
      case 'loading':
        return 'Loading';
      case 'missing':
        return 'Missing';
      case 'archived':
        return 'Archived';
      default:
        return 'Unknown';
    }
  }, [isProvisioning, primarySnapshot]);
  const provisioningState = useTemplateStore(state => state.provisioningState ?? 'idle');
  const toDateInputValue = useCallback((value: string | null | undefined) => {
    if (!value) {
      return '';
    }
    return value.slice(0, 10);
  }, []);
  const handleCreateDocument = useCallback(() => {
    if (
      !project ||
      project.id === 'new' ||
      isProvisioning ||
      provisioningState === 'pending' ||
      createDocumentInFlight
    ) {
      return;
    }

    setCreateDocumentError(null);
    setCreateDocumentSuccess(false);
    setCreateDocumentInFlight(true);
    setShowProvisioningHint(true);
    createDocument(project.id);
  }, [createDocument, createDocumentInFlight, isProvisioning, project, provisioningState]);
  const handleExportProject = useCallback(async () => {
    if (!project || project.id === 'new' || exportInFlight || project.status === 'archived') {
      return;
    }

    const apiClient = apiClientRef.current;
    if (!apiClient || typeof apiClient.enqueueProjectExport !== 'function') {
      logger.error('project.export_unavailable', { projectId: project.id });
      return;
    }

    setExportError(null);
    setExportInFlight(true);

    try {
      const job = await apiClient.enqueueProjectExport(project.id, {
        format: 'markdown',
        scope: 'primary_document',
      });
      setExportJob(job);
      setExportState(job.status);
      logger.info('project.export_queued', {
        projectId: project.id,
        jobId: job.jobId,
        status: job.status,
      });
    } catch (err) {
      setExportJob(null);

      let message = 'Failed to start export.';
      if (isApiError(err)) {
        if (err.status === 409) {
          message = 'An export is already in progress for this project.';
        } else if (typeof err.message === 'string' && err.message.length > 0) {
          message = err.message;
        }
      } else if (err instanceof Error && err.message.length > 0) {
        message = err.message;
      }

      setExportError(message);
      setExportState('failed');
      logger.error(
        'project.export_failed',
        { projectId: project.id },
        err instanceof Error ? err : undefined
      );
    } finally {
      setExportInFlight(false);
    }
  }, [exportInFlight, project]);
  const createDocumentButtonDisabled =
    isProvisioning ||
    provisioningState === 'pending' ||
    createDocumentInFlight ||
    !project ||
    project.id === 'new';
  const createDocumentStatusLabel = useMemo(() => {
    if (isProvisioning || provisioningState === 'pending') {
      return 'Provisioning';
    }
    if (createDocumentSuccess) {
      return 'Ready';
    }
    if (!primarySnapshot) {
      return 'Missing';
    }
    switch (primarySnapshot.status) {
      case 'ready':
        return 'Ready';
      case 'missing':
        return 'Missing';
      case 'archived':
        return 'Archived';
      case 'loading':
        return 'Loading';
      default:
        return 'Action';
    }
  }, [createDocumentSuccess, isProvisioning, primarySnapshot, provisioningState]);
  const createDocumentDescription = useMemo<ReactNode>(() => {
    if (createDocumentSuccess) {
      return 'Document ready. Redirecting…';
    }
    if (showProvisioningHint || isProvisioning || provisioningState === 'pending') {
      return 'Creation in progress';
    }
    if (createDocumentError) {
      const detail = createDocumentError.trim();
      return detail.length > 0
        ? `Unable to create document: ${detail}`
        : 'Unable to create document.';
    }
    if (!primarySnapshot || primarySnapshot.status === 'missing') {
      return 'Generate the architecture document from template defaults.';
    }
    if (primarySnapshot.status === 'archived') {
      return 'Primary document archived. Create a replacement to continue.';
    }
    if (primarySnapshot.status === 'ready') {
      return 'Primary document already provisioned.';
    }
    return 'Start writing a new document for this project.';
  }, [
    createDocumentError,
    createDocumentSuccess,
    isProvisioning,
    primarySnapshot,
    provisioningState,
    showProvisioningHint,
  ]);
  const exportStatusLabel = useMemo(() => {
    switch (exportState) {
      case 'queued':
        return 'Queued';
      case 'running':
        return 'Running';
      case 'completed':
        return 'Ready';
      case 'failed':
        return 'Blocked';
      default:
        return 'Idle';
    }
  }, [exportState]);
  const exportDescription = useMemo(() => {
    if (exportState === 'failed') {
      return exportError ?? 'Export failed. Try again later.';
    }
    if (exportState === 'completed') {
      if (exportJob?.artifactUrl) {
        return 'Export completed. Download link delivered to your inbox.';
      }
      return 'Export completed successfully.';
    }
    if (exportState === 'queued') {
      return 'Export request submitted. You will receive a link when the bundle is ready.';
    }
    if (exportState === 'running') {
      return 'Generating export package…';
    }
    return 'Export documents in the latest format for sharing.';
  }, [exportError, exportJob?.artifactUrl, exportState]);
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
        const updated = await updateProject(project.id, payload, {
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
            const latest = await getProjectById(project.id);
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
    [formState, getProjectById, project, queryClient, syncFormWithProject, updateProject]
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

  useEffect(() => {
    projectRef.current = project;
  }, [project]);

  useEffect(() => {
    apiClientRef.current = client;
  }, [client]);

  const handleArchivedWhileViewing = useCallback(
    (latest?: ProjectData) => {
      const currentProject = projectRef.current;
      if (!currentProject || archiveRedirectRef.current) {
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

      const projectName = currentProject.name;

      queryClient.invalidateQueries({ queryKey: PROJECTS_QUERY_KEY });

      try {
        if (typeof window !== 'undefined') {
          window.sessionStorage.setItem(
            DASHBOARD_ARCHIVE_NOTICE_STORAGE_KEY,
            JSON.stringify({
              message: `Project "${projectName}" was archived while you were viewing it.`,
            })
          );
        }
      } catch (storageError) {
        logger.error(
          'project.archive_notice.persist_failed',
          { projectId: currentProject.id },
          storageError instanceof Error ? storageError : undefined
        );
      }

      window.setTimeout(() => {
        navigate('/dashboard');
      }, 1500);
    },
    [navigate, queryClient, setActiveProject]
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
  const templateUpgradeDecision = useTemplateStore(state => state.decision);
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
        const result = await getProjectById(projectId);
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

        const snapshot = (await loadDocument({
          apiClient: apiClientRef.current,
          projectId,
        })) as PrimaryDocumentSnapshotResponse | null;

        if (!cancelled) {
          setPrimarySnapshot(snapshot);
        }
      } catch (fetchError) {
        const message =
          fetchError instanceof Error ? fetchError.message : 'Error fetching project.';
        if (!cancelled) {
          setError(message);
          setProject(null);
          setPrimarySnapshot(null);
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
      setPrimarySnapshot(null);
      void fetchProject(id);
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
      setPrimarySnapshot(null);
    }

    return () => {
      cancelled = true;
      resetTemplate();
      setPrimarySnapshot(null);
    };
  }, [
    getProjectById,
    id,
    initializeMetadataEditingState,
    loadDocument,
    setActiveProject,
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
            deletedAt: isArchived ? (payload.archivedAt ?? prev.deletedAt) : null,
            deletedBy: isArchived ? (payload.archivedBy ?? prev.deletedBy) : null,
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
    if (process.env.NODE_ENV === 'test') {
      return;
    }
    if (!fallbackPollingActive || !projectId || projectId === 'new' || archiveRedirectRef.current) {
      return;
    }

    let cancelled = false;

    const poll = async () => {
      try {
        const latest = await getProjectById(projectId);
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
    getProjectById,
    handleArchivedWhileViewing,
    isEditingMetadata,
    projectId,
    syncFormWithProject,
  ]);

  useEffect(() => {
    setExportState('idle');
    setExportJob(null);
    setExportError(null);
    setExportInFlight(false);
  }, [project?.id]);

  useEffect(() => {
    setTemplateSubmitState('idle');
    setTemplateSubmitMessage(null);
  }, [templateDocument?.id]);

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
            <fieldset
              key={key}
              className="space-y-4 rounded-md border border-[hsla(var(--dashboard-panel-border)/0.6)] bg-[hsla(var(--dashboard-panel-bg)/0.85)] p-4"
            >
              <legend className="px-1 text-sm font-semibold text-[hsl(var(--dashboard-content-muted))]">
                {section.title ?? section.id}
              </legend>
              {renderSections(section.children, setFieldValue, path)}
            </fieldset>
          );
        }

        const isLongText = section.type === 'markdown' || section.type === 'string';

        return (
          <div key={key} className="space-y-2">
            <label
              className="block text-sm font-medium text-[hsl(var(--dashboard-content-muted))]"
              htmlFor={key}
            >
              {section.title ?? section.id}
            </label>
            {isLongText ? (
              <textarea
                id={key}
                className="w-full rounded-md border border-[hsl(var(--dashboard-input-border))] bg-[hsla(var(--dashboard-input-bg)/0.85)] p-2 text-sm text-[hsl(var(--dashboard-content-foreground))] shadow-none focus:border-[hsl(var(--dashboard-panel-border))] focus:outline-none focus:ring-1 focus:ring-[hsl(var(--dashboard-panel-border))]"
                rows={section.type === 'markdown' ? 6 : 3}
                value={String(fieldValue ?? '')}
                onChange={event => handleFieldChange(setFieldValue, path, event.target.value)}
              />
            ) : (
              <input
                id={key}
                className="w-full rounded-md border border-[hsl(var(--dashboard-input-border))] bg-[hsla(var(--dashboard-input-bg)/0.85)] p-2 text-sm text-[hsl(var(--dashboard-content-foreground))] shadow-none focus:border-[hsl(var(--dashboard-panel-border))] focus:outline-none focus:ring-1 focus:ring-[hsl(var(--dashboard-panel-border))]"
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
    if (!id || id === 'new') {
      return;
    }
    if (activeProjectId === id) {
      return;
    }
    setActiveProject(id);
  }, [activeProjectId, id, setActiveProject]);

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
      <div className="flex min-h-[60vh] items-center justify-center text-sm text-[hsl(var(--dashboard-content-subdued))]">
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
      <div className="flex min-h-[60vh] items-center justify-center text-sm text-[hsl(var(--dashboard-content-subdued))]">
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
  const exportIsPending = exportInFlight || exportState === 'queued' || exportState === 'running';
  const exportButtonDisabled = exportIsPending || isNewProject || isProjectArchived;

  return renderShell(
    <>
      <div className="mb-8">
        <h2 className="mb-2 text-3xl font-bold text-[hsl(var(--dashboard-content-foreground))]">
          {project.name}
        </h2>
        <p className="text-[hsl(var(--dashboard-content-muted))]">
          {project.description ?? 'No description provided'}
        </p>
        <div className="mt-4 text-sm text-[hsl(var(--dashboard-content-subdued))]">
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
        <Card className="border-[hsla(var(--dashboard-panel-border)/0.6)] bg-[hsla(var(--dashboard-panel-bg)/0.9)] text-[hsl(var(--dashboard-content-foreground))] shadow-none">
          <CardHeader className="flex flex-col gap-4 border-b border-[hsla(var(--dashboard-panel-border)/0.4)] pb-4 sm:flex-row sm:items-start sm:justify-between sm:pb-6">
            <div>
              <CardTitle className="text-lg">Project Metadata</CardTitle>
              <CardDescription className="text-[hsl(var(--dashboard-content-muted))]">
                Update lifecycle status, description, and goal summary for this project.
              </CardDescription>
            </div>
            {!isMetadataFormVisible && !isProjectArchived ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                data-testid="project-edit-toggle"
                className="border-[hsl(var(--dashboard-panel-border))] bg-[hsla(var(--dashboard-panel-bg)/0.7)] text-[hsl(var(--dashboard-content-foreground))] hover:bg-[hsla(var(--dashboard-surface-hover)/0.45)]"
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
                    className="block text-sm font-medium text-[hsl(var(--dashboard-content-muted))]"
                    htmlFor="project-name-input"
                  >
                    Project name
                  </label>
                  <input
                    id="project-name-input"
                    data-testid="project-metadata-name"
                    name="project-name"
                    autoComplete="off"
                    className="w-full rounded-md border border-[hsl(var(--dashboard-input-border))] bg-[hsla(var(--dashboard-input-bg)/0.85)] p-2 text-sm text-[hsl(var(--dashboard-content-foreground))] shadow-none focus:border-[hsl(var(--dashboard-panel-border))] focus:outline-none focus:ring-1 focus:ring-[hsl(var(--dashboard-panel-border))]"
                    value={formState.name}
                    onChange={handleMetadataChange('name')}
                    disabled={isSaving || isProjectArchived}
                    required
                    maxLength={PROJECT_NAME_MAX_LENGTH}
                  />
                </div>

                <div className="space-y-2">
                  <label
                    className="block text-sm font-medium text-[hsl(var(--dashboard-content-muted))]"
                    htmlFor="project-status-select"
                  >
                    Lifecycle status
                  </label>
                  <select
                    id="project-status-select"
                    data-testid="project-metadata-status"
                    name="project-status"
                    autoComplete="off"
                    className="w-full rounded-md border border-[hsl(var(--dashboard-input-border))] bg-[hsla(var(--dashboard-input-bg)/0.85)] p-2 text-sm text-[hsl(var(--dashboard-content-foreground))] shadow-none focus:border-[hsl(var(--dashboard-panel-border))] focus:outline-none focus:ring-1 focus:ring-[hsl(var(--dashboard-panel-border))]"
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
                    className="block text-sm font-medium text-[hsl(var(--dashboard-content-muted))]"
                    htmlFor="project-description-input"
                  >
                    Description
                  </label>
                  <textarea
                    id="project-description-input"
                    data-testid="project-metadata-description"
                    name="project-description"
                    autoComplete="off"
                    className="w-full rounded-md border border-[hsl(var(--dashboard-input-border))] bg-[hsla(var(--dashboard-input-bg)/0.85)] p-2 text-sm text-[hsl(var(--dashboard-content-foreground))] shadow-none focus:border-[hsl(var(--dashboard-panel-border))] focus:outline-none focus:ring-1 focus:ring-[hsl(var(--dashboard-panel-border))]"
                    rows={3}
                    value={formState.description}
                    onChange={handleMetadataChange('description')}
                    disabled={isSaving || isProjectArchived}
                  />
                </div>

                <div className="space-y-2">
                  <label
                    className="block text-sm font-medium text-[hsl(var(--dashboard-content-muted))]"
                    htmlFor="project-goal-summary-input"
                  >
                    Goal summary
                  </label>
                  <input
                    id="project-goal-summary-input"
                    data-testid="project-metadata-goal-summary"
                    name="project-goal-summary"
                    autoComplete="off"
                    className="w-full rounded-md border border-[hsl(var(--dashboard-input-border))] bg-[hsla(var(--dashboard-input-bg)/0.85)] p-2 text-sm text-[hsl(var(--dashboard-content-foreground))] shadow-none focus:border-[hsl(var(--dashboard-panel-border))] focus:outline-none focus:ring-1 focus:ring-[hsl(var(--dashboard-panel-border))]"
                    value={formState.goalSummary}
                    onChange={handleMetadataChange('goalSummary')}
                    disabled={isSaving || isProjectArchived}
                    maxLength={GOAL_SUMMARY_MAX_LENGTH}
                    placeholder="Short description of upcoming milestone"
                  />
                </div>

                <div className="space-y-2">
                  <label
                    className="block text-sm font-medium text-[hsl(var(--dashboard-content-muted))]"
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
                    className="w-full rounded-md border border-[hsl(var(--dashboard-input-border))] bg-[hsla(var(--dashboard-input-bg)/0.85)] p-2 text-sm text-[hsl(var(--dashboard-content-foreground))] shadow-none focus:border-[hsl(var(--dashboard-panel-border))] focus:outline-none focus:ring-1 focus:ring-[hsl(var(--dashboard-panel-border))]"
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
                  <p className="text-sm text-[hsl(var(--dashboard-content-muted))] md:col-span-2">
                    Review lifecycle details and select “Edit Project” to make changes.
                  </p>
                )}
                <div>
                  <h3 className="text-sm font-medium text-[hsl(var(--dashboard-content-muted))]">
                    Project name
                  </h3>
                  <p
                    data-testid="project-metadata-view-name"
                    className="mt-1 text-sm text-[hsl(var(--dashboard-content-foreground))]"
                  >
                    {project.name}
                  </p>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-[hsl(var(--dashboard-content-muted))]">
                    Lifecycle status
                  </h3>
                  <ProjectStatusBadge
                    status={project.status}
                    className="mt-1"
                    data-testid="project-metadata-view-status"
                  />
                </div>
                <div className="md:col-span-2">
                  <h3 className="text-sm font-medium text-[hsl(var(--dashboard-content-muted))]">
                    Description
                  </h3>
                  <p
                    data-testid="project-metadata-view-description"
                    className="mt-1 text-sm text-[hsl(var(--dashboard-content-foreground))]"
                  >
                    {project.description ? project.description : 'No description provided'}
                  </p>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-[hsl(var(--dashboard-content-muted))]">
                    Goal summary
                  </h3>
                  <p
                    data-testid="project-metadata-view-goal-summary"
                    className="mt-1 text-sm text-[hsl(var(--dashboard-content-foreground))]"
                  >
                    {project.goalSummary ? project.goalSummary : 'Not set'}
                  </p>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-[hsl(var(--dashboard-content-muted))]">
                    Goal target date
                  </h3>
                  <p
                    data-testid="project-metadata-view-goal-target-date"
                    className="mt-1 text-sm text-[hsl(var(--dashboard-content-foreground))]"
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
        <Card className="border-[hsla(var(--dashboard-panel-border)/0.6)] bg-[hsla(var(--dashboard-panel-bg)/0.9)] text-[hsl(var(--dashboard-content-foreground))] shadow-none">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Documents</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{project.documentsCount ?? 0}</div>
            <p className="text-sm text-[hsl(var(--dashboard-content-muted))]">Total documents</p>
          </CardContent>
        </Card>

        <Card className="border-[hsla(var(--dashboard-panel-border)/0.6)] bg-[hsla(var(--dashboard-panel-bg)/0.9)] text-[hsl(var(--dashboard-content-foreground))] shadow-none">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Templates Used</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{templateDocument ? 1 : 0}</div>
            <p className="text-sm text-[hsl(var(--dashboard-content-muted))]">Active templates</p>
          </CardContent>
        </Card>

        <Card className="border-[hsla(var(--dashboard-panel-border)/0.6)] bg-[hsla(var(--dashboard-panel-bg)/0.9)] text-[hsl(var(--dashboard-content-foreground))] shadow-none">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Export Ready</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">85%</div>
            <p className="text-sm text-[hsl(var(--dashboard-content-muted))]">Completion status</p>
          </CardContent>
        </Card>
      </div>

      {id !== 'new' && (
        <section className="space-y-4">
          <h3 className="text-xl font-semibold text-[hsl(var(--dashboard-content-foreground))]">
            Document Template
          </h3>
          <TemplateUpgradeBanner
            migration={migrationSummary}
            removedVersion={removedVersionInfo}
            upgradeFailure={upgradeFailure}
          >
            {templateStatus === 'loading' && (
              <div className="rounded-md border border-[hsla(var(--dashboard-panel-border)/0.6)] bg-[hsla(var(--dashboard-panel-bg)/0.85)] p-4 text-sm text-[hsl(var(--dashboard-content-muted))]">
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
                onValid={async value => {
                  const nextValue =
                    value && typeof value === 'object' && !Array.isArray(value)
                      ? (value as Record<string, unknown>)
                      : {};
                  if (!project) {
                    return;
                  }

                  const apiClient = apiClientRef.current;
                  if (!apiClient || typeof apiClient.submitTemplateDecision !== 'function') {
                    logger.error('project.template_decision_unavailable', {
                      projectId: project.id,
                      documentId: templateDocument.id,
                    });
                    setTemplateSubmitState('error');
                    setTemplateSubmitMessage('Failed to submit template decision.');
                    return;
                  }

                  setTemplateSubmitState('submitting');
                  setTemplateSubmitMessage(null);

                  const requestedVersion =
                    templateUpgradeDecision && templateUpgradeDecision.action === 'upgrade'
                      ? templateUpgradeDecision.targetVersion.version
                      : templateDocument.templateVersion;

                  try {
                    const response = await apiClient.submitTemplateDecision({
                      projectId: project.id,
                      templateId: templateDocument.templateId,
                      documentId: templateDocument.id,
                      action: 'approved',
                      currentVersion: templateDocument.templateVersion,
                      requestedVersion,
                      payload: nextValue,
                    });

                    logger.info('document.template.validated', {
                      documentId: templateDocument.id,
                      templateId: templateDocument.templateId,
                      templateVersion: templateDocument.templateVersion,
                    });

                    setFormValue(nextValue);
                    setTemplateSubmitState('success');
                    setTemplateSubmitMessage('Template validation recorded.');
                    setPrimarySnapshot(prev =>
                      prev
                        ? {
                            ...prev,
                            templateDecision: response,
                          }
                        : prev
                    );
                    logger.info('project.template_decision_submitted', {
                      projectId: project.id,
                      documentId: templateDocument.id,
                      decisionId: response.decisionId,
                    });
                  } catch (submitError) {
                    setTemplateSubmitState('error');
                    let message = 'Failed to submit template decision.';
                    if (isApiError(submitError) && submitError.message.length > 0) {
                      message = submitError.message;
                    } else if (submitError instanceof Error && submitError.message.length > 0) {
                      message = submitError.message;
                    }
                    setTemplateSubmitMessage(message);
                    logger.error(
                      'project.template_decision_failed',
                      {
                        projectId: project.id,
                        documentId: templateDocument.id,
                      },
                      submitError instanceof Error ? submitError : undefined
                    );
                  }
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
                      <p className="rounded-md border border-[hsla(var(--dashboard-panel-border)/0.6)] bg-[hsla(var(--dashboard-panel-bg)/0.85)] p-4 text-sm text-[hsl(var(--dashboard-content-muted))]">
                        No template sections available for editing.
                      </p>
                    ) : (
                      renderSections(sections, setFieldValue)
                    )}

                    <div className="space-y-2">
                      <h4 className="text-sm font-semibold text-[hsl(var(--dashboard-content-muted))]">
                        Validation Issues
                      </h4>
                      <ul data-testid="template-errors" className="space-y-1 text-sm text-red-700">
                        {errors.map(issue => (
                          <li key={issue.path.join('.') || issue.message}>{issue.message}</li>
                        ))}
                      </ul>
                      {errors.length === 0 ? (
                        <p className="text-sm text-[hsl(var(--dashboard-content-subdued))]">
                          All template fields satisfy the schema.
                        </p>
                      ) : null}
                    </div>

                    <div className="flex flex-col items-end gap-2">
                      <Button
                        type="submit"
                        className="inline-flex items-center"
                        disabled={templateSubmitState === 'submitting'}
                      >
                        <FileText className="mr-2 h-4 w-4" />
                        Save Changes
                        {templateSubmitState === 'submitting' ? (
                          <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                        ) : null}
                      </Button>
                      {templateSubmitState === 'success' && templateSubmitMessage ? (
                        <p className="text-sm text-emerald-600">{templateSubmitMessage}</p>
                      ) : null}
                      {templateSubmitState === 'error' && templateSubmitMessage ? (
                        <p className="text-sm text-red-600">{templateSubmitMessage}</p>
                      ) : null}
                    </div>
                  </form>
                )}
              </TemplateValidationGate>
            ) : null}
          </TemplateUpgradeBanner>
        </section>
      )}

      <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Card
          data-testid="project-workflow-open-document"
          data-state={primaryDocumentStatus}
          className="border-[hsla(var(--dashboard-panel-border)/0.6)] bg-[hsla(var(--dashboard-panel-bg)/0.9)] text-[hsl(var(--dashboard-content-foreground))] shadow-none transition hover:bg-[hsla(var(--dashboard-surface-hover)/0.35)]"
        >
          <Link
            to={openDocumentHref ?? '.'}
            role="link"
            aria-label="Open project document"
            aria-disabled={openDocumentDisabled}
            tabIndex={openDocumentDisabled ? -1 : 0}
            onClick={event => {
              if (openDocumentDisabled) {
                event.preventDefault();
              }
            }}
            className={`focus-visible:ring-primary flex h-full w-full flex-col gap-3 rounded-lg p-4 text-left outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${
              openDocumentDisabled ? 'pointer-events-none cursor-not-allowed opacity-70' : ''
            }`}
          >
            <div className="flex items-center justify-between gap-3">
              <span className="flex items-center text-lg font-semibold">
                <FileText className="mr-2 h-5 w-5" />
                Open Document
              </span>
              <span className="text-xs font-semibold uppercase tracking-wide text-[hsl(var(--dashboard-content-muted))]">
                {openDocumentStatusLabel}
              </span>
            </div>
            <span className="text-sm text-[hsl(var(--dashboard-content-muted))]">
              {openDocumentDescription}
            </span>
          </Link>
        </Card>

        <Card
          data-testid="project-workflow-create-document"
          data-state={isProvisioning ? 'loading' : (primarySnapshot?.status ?? 'missing')}
          className="border-[hsla(var(--dashboard-panel-border)/0.6)] bg-[hsla(var(--dashboard-panel-bg)/0.9)] text-[hsl(var(--dashboard-content-foreground))] shadow-none transition hover:bg-[hsla(var(--dashboard-surface-hover)/0.35)]"
        >
          <button
            type="button"
            onClick={handleCreateDocument}
            disabled={createDocumentButtonDisabled}
            className="focus-visible:ring-primary flex w-full flex-col gap-3 rounded-lg p-4 text-left outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-70"
          >
            <div className="flex items-center justify-between gap-3">
              <span className="flex items-center text-lg font-semibold">
                <FileText className="mr-2 h-5 w-5" />
                Create Document
                {isProvisioning ? <Loader2 className="ml-2 h-4 w-4 animate-spin" /> : null}
              </span>
              <span className="text-xs font-semibold uppercase tracking-wide text-[hsl(var(--dashboard-content-muted))]">
                {createDocumentStatusLabel}
              </span>
            </div>
          </button>
          <span
            className={`mt-3 block text-sm ${
              createDocumentError ? 'text-red-600' : 'text-[hsl(var(--dashboard-content-muted))]'
            }`}
            data-testid="project-workflow-create-document-description"
          >
            {createDocumentDescription}
          </span>
        </Card>

        <Card className="cursor-pointer border-[hsla(var(--dashboard-panel-border)/0.6)] bg-[hsla(var(--dashboard-panel-bg)/0.9)] text-[hsl(var(--dashboard-content-foreground))] shadow-none transition hover:bg-[hsla(var(--dashboard-surface-hover)/0.35)]">
          <CardHeader>
            <CardTitle className="flex items-center">
              <Edit className="mr-2 h-5 w-5" />
              Edit Templates
            </CardTitle>
            <CardDescription className="text-[hsl(var(--dashboard-content-muted))]">
              Customize templates for this project
            </CardDescription>
          </CardHeader>
        </Card>

        <Card
          data-testid="project-workflow-export"
          data-state={exportState}
          className="border-[hsla(var(--dashboard-panel-border)/0.6)] bg-[hsla(var(--dashboard-panel-bg)/0.9)] text-[hsl(var(--dashboard-content-foreground))] shadow-none transition hover:bg-[hsla(var(--dashboard-surface-hover)/0.35)]"
        >
          <button
            type="button"
            onClick={handleExportProject}
            disabled={exportButtonDisabled}
            className="focus-visible:ring-primary flex w-full flex-col gap-3 rounded-lg p-4 text-left outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-70"
          >
            <div className="flex items-center justify-between gap-3">
              <span className="flex items-center text-lg font-semibold">
                <Share className="mr-2 h-5 w-5" />
                Export Project
                {exportIsPending ? <Loader2 className="ml-2 h-4 w-4 animate-spin" /> : null}
              </span>
              <span className="text-xs font-semibold uppercase tracking-wide text-[hsl(var(--dashboard-content-muted))]">
                {exportStatusLabel}
              </span>
            </div>
          </button>
          <span
            className={`mt-3 block text-sm ${
              exportState === 'failed'
                ? 'text-red-600'
                : 'text-[hsl(var(--dashboard-content-muted))]'
            }`}
            data-testid="project-workflow-export-description"
          >
            {exportDescription}
          </span>
        </Card>
      </div>
    </>
  );
}

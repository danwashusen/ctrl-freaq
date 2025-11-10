import type {
  DocumentExportJob,
  Project,
  ProjectStatus,
  CreateProjectInput,
  UpdateProjectInput,
  ProjectRetentionPolicy,
} from '@ctrl-freaq/shared-data';
import {
  ProjectRepositoryImpl,
  ProjectUtils,
  ConfigurationRepositoryImpl,
  ConfigurationUtils,
  type ConfigKey,
  ActivityLogRepositoryImpl,
  ActivityLogUtils,
  ACTION_TYPES,
  RESOURCE_TYPES,
  PROJECT_CONSTANTS,
  PROJECT_VISIBILITY_VALUES,
  ProjectRetentionPolicyRepositoryImpl,
} from '@ctrl-freaq/shared-data';
import { Router } from 'express';
import type { Request, Response, Router as ExpressRouter } from 'express';
import type { Logger } from 'pino';
import { z } from 'zod';
import type { EventBroker } from '../modules/event-stream/event-broker.js';
import type { EventStreamConfig } from '../config/event-stream.js';
import {
  DocumentExportService,
  ExportJobInProgressError,
  ExportJobNotFoundError,
} from '../services/export/document-export.service.js';
import { ProjectNotFoundError } from '../services/document-provisioning.service.js';
import { ProjectAccessError, requireProjectAccess } from './helpers/project-access.js';
import { createDefaultRetentionPolicyTemplate } from '../services/retention/default-policies.js';

const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const MUTABLE_PROJECT_STATUS_VALUES = ['draft', 'active', 'paused', 'completed'] as const;
const CONCURRENCY_HEADER = 'if-unmodified-since';
const CONCURRENCY_TOLERANCE_MS = 0; // headers must match the persisted timestamp exactly
const STATUS_TRANSITIONS_ENTRIES: ReadonlyArray<[ProjectStatus, ReadonlyArray<ProjectStatus>]> = [
  ['draft', ['draft', 'active']],
  ['active', ['active', 'paused', 'completed']],
  ['paused', ['paused', 'active', 'completed']],
  ['completed', ['completed']],
  ['archived', ['archived']],
];
const STATUS_TRANSITIONS: ReadonlyMap<ProjectStatus, ReadonlyArray<ProjectStatus>> = new Map(
  STATUS_TRANSITIONS_ENTRIES
);

const elapsedMsSince = (startedAt: number): number => {
  const diff = performance.now() - startedAt;
  if (!Number.isFinite(diff) || diff < 0) {
    return 0;
  }
  return Math.round(diff);
};

const toIsoDateOnly = (value: Date | null): string | null => {
  if (!value) {
    return null;
  }
  return value.toISOString().slice(0, 10);
};

const normalizeOptionalString = (value?: string | null): string | null => {
  if (value === undefined || value === null) {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
};

interface SerializedProject {
  id: string;
  ownerUserId: string;
  name: string;
  slug: string;
  description: string | null;
  visibility: (typeof PROJECT_VISIBILITY_VALUES)[number];
  status: Project['status'];
  archivedStatusBefore: ProjectStatus | null;
  goalTargetDate: string | null;
  goalSummary: string | null;
  createdAt: string;
  createdBy: string;
  updatedAt: string;
  updatedBy: string;
  deletedAt: string | null;
  deletedBy: string | null | undefined;
}

const PROJECT_LIFECYCLE_TOPIC = 'project.lifecycle';
const WORKSPACE_HEADER = 'x-workspace-id';
const DEFAULT_WORKSPACE_ID = 'workspace-default';

type LifecycleReason = 'create' | 'update' | 'archive' | 'restore';

interface PublishLifecycleOptions {
  previousStatus?: ProjectStatus | null;
  actorUserId: string;
  reason: LifecycleReason;
  metadata?: Record<string, string>;
}

const toIsoStringOrNull = (value: Date | string | null | undefined): string | null => {
  if (!value) {
    return null;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }
    const parsed = new Date(trimmed);
    return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
  }

  return null;
};

const resolveWorkspaceId = (req: AuthenticatedRequest): string => {
  const headerValue = req.get(WORKSPACE_HEADER);
  if (typeof headerValue === 'string') {
    const trimmed = headerValue.trim();
    if (trimmed.length > 0) {
      return trimmed;
    }
  }
  return req.auth?.orgId ?? DEFAULT_WORKSPACE_ID;
};

const publishProjectLifecycleEvent = (
  req: AuthenticatedRequest,
  logger: Logger | undefined,
  project: Project,
  options: PublishLifecycleOptions
): void => {
  const container = req.services;
  if (!container?.has('eventStreamConfig') || !container.has('eventBroker')) {
    return;
  }

  let config: EventStreamConfig;
  let broker: EventBroker;

  try {
    config = container.get<EventStreamConfig>('eventStreamConfig');
    broker = container.get<EventBroker>('eventBroker');
  } catch (error) {
    logger?.warn(
      {
        requestId: req.requestId,
        projectId: project.id,
        reason: options.reason,
        error: error instanceof Error ? error.message : String(error),
      },
      'Failed to resolve event stream dependencies for project lifecycle publish'
    );
    return;
  }

  if (!config.enabled) {
    return;
  }

  const payload = {
    projectId: project.id,
    status: project.status,
    previousStatus: options.previousStatus ?? null,
    updatedBy: options.actorUserId,
    archivedAt: toIsoStringOrNull(project.deletedAt ?? null),
    archivedBy: project.deletedBy ?? null,
    notes: null as string | null,
  };

  if (options.reason === 'restore') {
    payload.archivedAt = null;
    payload.archivedBy = null;
  }

  const metadata: Record<string, string> = {
    updatedAt: project.updatedAt.toISOString(),
    reason: options.reason,
  };

  if (project.archivedStatusBefore) {
    metadata.archivedStatusBefore = project.archivedStatusBefore;
  }

  if (options.metadata) {
    Object.assign(metadata, options.metadata);
  }

  try {
    broker.publish({
      workspaceId: resolveWorkspaceId(req),
      topic: PROJECT_LIFECYCLE_TOPIC,
      resourceId: project.id,
      payload,
      metadata,
    });
  } catch (error) {
    logger?.warn(
      {
        requestId: req.requestId,
        projectId: project.id,
        reason: options.reason,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      'Failed to publish project lifecycle event'
    );
  }
};

const serializeProject = (project: Project): SerializedProject => ({
  id: project.id,
  ownerUserId: project.ownerUserId,
  name: project.name,
  slug: project.slug,
  description: project.description ?? null,
  visibility: project.visibility,
  status: project.status,
  goalTargetDate: toIsoDateOnly(project.goalTargetDate ?? null),
  goalSummary: project.goalSummary ?? null,
  createdAt: project.createdAt.toISOString(),
  createdBy: project.createdBy,
  updatedAt: project.updatedAt.toISOString(),
  updatedBy: project.updatedBy,
  deletedAt: project.deletedAt ? project.deletedAt.toISOString() : null,
  deletedBy: project.deletedBy ?? null,
  archivedStatusBefore: project.archivedStatusBefore ?? null,
});

const serializeExportJobResponse = (job: DocumentExportJob) => ({
  jobId: job.id,
  projectId: job.projectId,
  status: job.status,
  format: job.format,
  scope: job.scope,
  requestedBy: job.requestedBy,
  requestedAt: job.requestedAt.toISOString(),
  artifactUrl: job.artifactUrl,
  errorMessage: job.errorMessage,
  completedAt: job.completedAt ? job.completedAt.toISOString() : null,
});

const MIN_TIMEZONE_OFFSET_MINUTES = -12 * 60;
const MAX_TIMEZONE_OFFSET_MINUTES = 14 * 60;

const normalizeTimezoneOffset = (offset: number | null | undefined, fallback: number): number => {
  if (typeof offset !== 'number' || !Number.isFinite(offset)) {
    return fallback;
  }
  const rounded = Math.trunc(offset);
  if (rounded < MIN_TIMEZONE_OFFSET_MINUTES || rounded > MAX_TIMEZONE_OFFSET_MINUTES) {
    return fallback;
  }
  return rounded;
};

const parseGoalTargetDate = (
  value?: string | null,
  clientTimezoneOffsetMinutes?: number | null
): Date | null => {
  if (!value) {
    return null;
  }
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return null;
  }
  if (!ISO_DATE_REGEX.test(trimmed)) {
    throw new Error('Goal target date must be in YYYY-MM-DD format');
  }
  const [yearStr, monthStr, dayStr] = trimmed.split('-');
  const year = Number(yearStr);
  const month = Number(monthStr);
  const day = Number(dayStr);
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
    throw new Error('Goal target date is invalid');
  }
  const parsedUtc = Date.UTC(year, month - 1, day);

  const now = new Date();
  const fallbackOffset = now.getTimezoneOffset();
  const offsetMinutes = normalizeTimezoneOffset(clientTimezoneOffsetMinutes, fallbackOffset);
  const offsetMs = offsetMinutes * 60_000;

  const clientNow = new Date(now.getTime() - offsetMs);
  const clientYear = clientNow.getUTCFullYear();
  const clientMonth = clientNow.getUTCMonth();
  const clientDay = clientNow.getUTCDate();

  const startOfClientDayUtc = Date.UTC(clientYear, clientMonth, clientDay) + offsetMs;
  const parsedClientStartUtc = parsedUtc + offsetMs;

  if (parsedClientStartUtc < startOfClientDayUtc) {
    throw new Error('Goal target date cannot be in the past');
  }

  const parsedDate = new Date(parsedUtc);
  if (
    parsedDate.getUTCFullYear() !== year ||
    parsedDate.getUTCMonth() !== month - 1 ||
    parsedDate.getUTCDate() !== day
  ) {
    throw new Error('Goal target date is invalid');
  }

  return parsedDate;
};

const isValidStatusTransition = (
  currentStatus: ProjectStatus,
  nextStatus: ProjectStatus
): boolean => {
  if (currentStatus === nextStatus) {
    return true;
  }
  const allowed = STATUS_TRANSITIONS.get(currentStatus) ?? [];
  return allowed.includes(nextStatus);
};

/**
 * Request body schema for creating a project
 */
const CreateProjectRequestSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Project name is required')
    .max(PROJECT_CONSTANTS.MAX_NAME_LENGTH, 'Project name too long'),
  description: z
    .string()
    .trim()
    .max(PROJECT_CONSTANTS.MAX_DESCRIPTION_LENGTH, 'Description too long')
    .nullish(),
  visibility: z.enum(PROJECT_VISIBILITY_VALUES).optional(),
  goalTargetDate: z
    .string()
    .trim()
    .refine(value => value.length === 0 || ISO_DATE_REGEX.test(value), {
      message: 'Goal target date must be an ISO date (YYYY-MM-DD)',
    })
    .nullish(),
  goalSummary: z
    .string()
    .trim()
    .max(PROJECT_CONSTANTS.MAX_GOAL_SUMMARY_LENGTH, 'Goal summary too long')
    .nullish(),
});

/**
 * Request body schema for updating a project
 */
const UpdateProjectRequestSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Project name is required')
    .max(PROJECT_CONSTANTS.MAX_NAME_LENGTH, 'Project name too long')
    .optional(),
  description: z
    .string()
    .trim()
    .max(PROJECT_CONSTANTS.MAX_DESCRIPTION_LENGTH, 'Description too long')
    .nullish(),
  visibility: z.enum(PROJECT_VISIBILITY_VALUES).optional(),
  status: z.enum(MUTABLE_PROJECT_STATUS_VALUES).optional(),
  goalTargetDate: z
    .string()
    .trim()
    .refine(value => value.length === 0 || ISO_DATE_REGEX.test(value), {
      message: 'Goal target date must be an ISO date (YYYY-MM-DD)',
    })
    .nullish(),
  goalSummary: z
    .string()
    .trim()
    .max(PROJECT_CONSTANTS.MAX_GOAL_SUMMARY_LENGTH, 'Goal summary too long')
    .nullish(),
});

/**
 * Error response schema
 */
const _ErrorResponseSchema = z.object({
  error: z.string(),
  message: z.string(),
  requestId: z.string(),
  timestamp: z.string().datetime(),
  details: z.record(z.string(), z.any()).optional(),
});

type ErrorResponse = z.infer<typeof _ErrorResponseSchema>;

interface SerializedRetentionPolicy {
  policyId: string;
  retentionWindow: string;
  guidance: string;
}

const serializeRetentionPolicy = (policy: ProjectRetentionPolicy): SerializedRetentionPolicy => ({
  policyId: policy.policyId,
  retentionWindow: policy.retentionWindow,
  guidance: policy.guidance,
});

/**
 * Projects API router
 */
export const projectsRouter: ExpressRouter = Router();

/**
 * GET /api/v1/projects (list)
 * Returns user's projects (MVP: up to 1) in list shape with pagination params
 */
const includeArchivedParam = z
  .preprocess((value: unknown) => {
    if (typeof value === 'string') {
      const normalized = value.trim().toLowerCase();
      if (normalized === 'true') {
        return true;
      }
      if (normalized === 'false') {
        return false;
      }
    }
    return value;
  }, z.boolean().optional())
  .default(false);

const ListQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
  includeArchived: includeArchivedParam,
  search: z
    .string()
    .trim()
    .max(120)
    .optional()
    .transform(value => (value && value.length > 0 ? value : undefined)),
});

const ProjectParamSchema = z.object({
  projectId: z.string().min(1, 'projectId is required'),
});

const ExportProjectRequestSchema = z.object({
  format: z.enum(['markdown', 'zip', 'pdf', 'bundle']),
  scope: z.enum(['primary_document', 'all_documents']).optional(),
  includeDrafts: z.boolean().optional(),
  notifyEmail: z.string().trim().email().optional(),
});

const ExportJobParamsSchema = z.object({
  projectId: z.string().uuid('Project ID must be a valid UUID'),
  jobId: z.string().uuid('Export job ID must be a valid UUID'),
});

projectsRouter.get('/projects', async (req: AuthenticatedRequest, res: Response) => {
  const logger = req.services?.get('logger') as Logger | undefined;
  const startedAt = performance.now();
  const userId = req.user?.userId;

  try {
    if (!userId) {
      res.status(401).json({
        error: 'UNAUTHORIZED',
        message: 'Authentication required',
        requestId: req.requestId || 'unknown',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const parsed = ListQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'Invalid query parameters',
        requestId: req.requestId || 'unknown',
        timestamp: new Date().toISOString(),
        details: parsed.error.format(),
      });
      return;
    }

    const { limit, offset, includeArchived, search } = parsed.data;
    const projectRepo = req.services.get('projectRepository') as ProjectRepositoryImpl;
    const projects = await projectRepo.findManyByUserId(userId, {
      limit,
      offset,
      orderBy: 'updated_at',
      orderDirection: 'DESC',
      includeArchived,
      searchTerm: search,
    });
    const total = await projectRepo.countByUserId(userId, { includeArchived, searchTerm: search });

    const serializedProjects = projects.map(project => {
      const serialized = serializeProject(project);
      return {
        ...serialized,
        memberAvatars: [],
        lastModified: serialized.updatedAt,
      };
    });

    if (projects.length > 0) {
      const firstProject = projects[0];
      if (firstProject) {
        const activityRepo = req.services.get('activityLogRepository') as ActivityLogRepositoryImpl;
        await activityRepo.create(
          ActivityLogUtils.createLogEntry(
            userId,
            ACTION_TYPES.PROJECT_VIEW,
            RESOURCE_TYPES.PROJECT,
            firstProject.id,
            { method: 'GET_LIST', count: projects.length, includeArchived },
            { ip: req.ip, userAgent: req.get('User-Agent') }
          )
        );
      }
    }

    logger?.info(
      {
        requestId: req.requestId,
        userId,
        count: serializedProjects.length,
        total,
        limit,
        offset,
        includeArchived,
        search,
        action: 'list_user_projects',
        durationMs: elapsedMsSince(startedAt),
      },
      'User projects listed'
    );

    res.status(200).json({ projects: serializedProjects, total, limit, offset });
  } catch (error) {
    logger?.error(
      {
        requestId: req.requestId,
        userId,
        error: error instanceof Error ? error.message : 'Unknown error',
        action: 'list_user_projects',
        durationMs: elapsedMsSince(startedAt),
      },
      'Failed to list user projects'
    );

    res.status(500).json({
      error: 'INTERNAL_ERROR',
      message: 'Failed to retrieve projects',
      requestId: req.requestId || 'unknown',
      timestamp: new Date().toISOString(),
    });
  }
});

// CONFIG routes must come before dynamic /projects/:projectId to avoid 404s
projectsRouter.get('/projects/config', async (req: AuthenticatedRequest, res: Response) => {
  const logger = req.services?.get('logger') as Logger | undefined;
  const startedAt = performance.now();
  const userId = req.user?.userId;

  try {
    if (!userId) {
      res.status(401).json({
        error: 'UNAUTHORIZED',
        message: 'Authentication required',
        requestId: req.requestId || 'unknown',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const configRepo = req.services.get('configurationRepository') as ConfigurationRepositoryImpl;
    const configurations = await configRepo.findByUserId(userId);
    const configObject: Record<string, string> = {};
    for (const cfg of configurations) {
      configObject[cfg.key] = cfg.value;
    }

    logger?.info(
      {
        requestId: req.requestId,
        userId,
        configKeys: Object.keys(configObject),
        action: 'get_user_config',
        durationMs: elapsedMsSince(startedAt),
      },
      'User configuration retrieved'
    );

    res.status(200).json(configObject);
  } catch (error) {
    logger?.error(
      {
        requestId: req.requestId,
        userId,
        error: error instanceof Error ? error.message : 'Unknown error',
        action: 'get_user_config',
        durationMs: elapsedMsSince(startedAt),
      },
      'Failed to get user configuration'
    );

    res.status(500).json({
      error: 'INTERNAL_ERROR',
      message: 'Failed to retrieve configuration',
      requestId: req.requestId || 'unknown',
      timestamp: new Date().toISOString(),
    });
  }
});

projectsRouter.patch('/projects/config', async (req: AuthenticatedRequest, res: Response) => {
  const logger = req.services?.get('logger') as Logger | undefined;
  const startedAt = performance.now();
  const userId = req.user?.userId;

  try {
    if (!userId) {
      res.status(401).json({
        error: 'UNAUTHORIZED',
        message: 'Authentication required',
        requestId: req.requestId || 'unknown',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const updates = req.body as Record<string, unknown>;
    const configRepo = req.services.get('configurationRepository') as ConfigurationRepositoryImpl;

    const validatedUpdates = new Map<string, string>();

    for (const [key, value] of Object.entries(updates)) {
      if (typeof value !== 'string') {
        res.status(400).json({
          error: 'VALIDATION_ERROR',
          message: `Invalid value for configuration key: ${key}`,
          requestId: req.requestId || 'unknown',
          timestamp: new Date().toISOString(),
        });
        return;
      }
      if (!ConfigurationUtils.isValidKey(key)) {
        res.status(400).json({
          error: 'VALIDATION_ERROR',
          message: `Invalid configuration key: ${key}`,
          requestId: req.requestId || 'unknown',
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const parsedValue = ConfigurationUtils.deserializeRawValue(value);
      if (!ConfigurationUtils.validateValue(key as ConfigKey, parsedValue)) {
        res.status(400).json({
          error: 'VALIDATION_ERROR',
          message: `Invalid value for configuration key: ${key}`,
          requestId: req.requestId || 'unknown',
          timestamp: new Date().toISOString(),
        });
        return;
      }

      validatedUpdates.set(key, value);
    }

    for (const [key, value] of validatedUpdates.entries()) {
      await configRepo.upsert(userId, key, value);
    }

    logger?.info(
      {
        requestId: req.requestId,
        userId,
        updatedKeys: Array.from(validatedUpdates.keys()),
        action: 'update_user_config',
        durationMs: elapsedMsSince(startedAt),
      },
      'User configuration updated'
    );

    // Return merged current configuration (strings only)
    const configurations = await configRepo.findByUserId(userId);
    const configObject = Object.fromEntries(
      configurations.map(cfg => [cfg.key, cfg.value] as const)
    ) as Record<string, string>;

    res.status(200).json(configObject);
  } catch (error) {
    logger?.error(
      {
        requestId: req.requestId,
        userId,
        error: error instanceof Error ? error.message : 'Unknown error',
        action: 'update_user_config',
        durationMs: elapsedMsSince(startedAt),
      },
      'Failed to update user configuration'
    );

    res.status(500).json({
      error: 'INTERNAL_ERROR',
      message: 'Failed to update configuration',
      requestId: req.requestId || 'unknown',
      timestamp: new Date().toISOString(),
    });
  }
});

projectsRouter.get(
  '/projects/:projectSlug/retention',
  async (req: AuthenticatedRequest, res: Response<SerializedRetentionPolicy | ErrorResponse>) => {
    const logger = req.services?.get('logger') as Logger | undefined;
    const userId = req.user?.userId;
    const { projectSlug } = req.params as { projectSlug: string };

    if (!userId) {
      res.status(401).json({
        error: 'UNAUTHORIZED',
        message: 'Authentication required',
        requestId: req.requestId || 'unknown',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    try {
      const projectRepo = req.services.get('projectRepository') as ProjectRepositoryImpl;
      const retentionRepo = req.services.get(
        'projectRetentionPolicyRepository'
      ) as ProjectRetentionPolicyRepositoryImpl;

      const project = await projectRepo.findBySlug(projectSlug);
      if (!project) {
        res.status(404).json({
          error: 'NOT_FOUND',
          message: `Project not found for slug ${projectSlug}`,
          requestId: req.requestId || 'unknown',
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const policy = await retentionRepo.findByProjectId(project.id);
      if (!policy) {
        res.status(404).json({
          error: 'NOT_FOUND',
          message: `No retention policy defined for project ${projectSlug}`,
          requestId: req.requestId || 'unknown',
          timestamp: new Date().toISOString(),
        });
        return;
      }

      logger?.info(
        {
          requestId: req.requestId,
          userId,
          projectSlug,
          projectId: project.id,
          action: 'get_project_retention_policy',
        },
        'Project retention policy retrieved'
      );

      res.status(200).json(serializeRetentionPolicy(policy));
    } catch (error) {
      logger?.error(
        {
          requestId: req.requestId,
          userId,
          projectSlug,
          error: error instanceof Error ? error.message : 'Unknown error',
          action: 'get_project_retention_policy',
        },
        'Failed to retrieve project retention policy'
      );

      res.status(500).json({
        error: 'INTERNAL_ERROR',
        message: 'Failed to load retention policy',
        requestId: req.requestId || 'unknown',
        timestamp: new Date().toISOString(),
      });
    }
  }
);

/**
 * POST /api/v1/projects
 * Create user's project (one per user in MVP)
 */
projectsRouter.post(
  '/projects',
  async (req: AuthenticatedRequest, res: Response<SerializedProject | ErrorResponse>) => {
    const logger = req.services?.get('logger') as Logger | undefined;
    const startedAt = performance.now();
    const userId = req.user?.userId;

    try {
      if (!userId) {
        res.status(401).json({
          error: 'UNAUTHORIZED',
          message: 'Authentication required',
          requestId: req.requestId || 'unknown',
          timestamp: new Date().toISOString(),
        });
        return;
      }

      // Validate request body
      const parseResult = CreateProjectRequestSchema.safeParse(req.body);
      if (!parseResult.success) {
        res.status(400).json({
          error: 'VALIDATION_ERROR',
          message: 'Invalid request parameters',
          requestId: req.requestId || 'unknown',
          timestamp: new Date().toISOString(),
          details: parseResult.error.format(),
        });
        return;
      }

      const clientTimezoneOffsetHeader = req.header('x-client-timezone-offset');
      const clientTimezoneOffset = clientTimezoneOffsetHeader
        ? Number.parseInt(clientTimezoneOffsetHeader, 10)
        : undefined;

      const { name, description } = parseResult.data;
      const slug = ProjectUtils.generateSlug(name);

      const projectRepo = req.services.get('projectRepository') as ProjectRepositoryImpl;
      let goalTargetDate: Date | null = null;
      try {
        goalTargetDate = parseGoalTargetDate(parseResult.data.goalTargetDate, clientTimezoneOffset);
      } catch (parseError) {
        res.status(400).json({
          error: 'VALIDATION_ERROR',
          message: parseError instanceof Error ? parseError.message : 'Goal target date is invalid',
          requestId: req.requestId || 'unknown',
          timestamp: new Date().toISOString(),
        });
        return;
      }

      // Create project
      const projectData: CreateProjectInput = {
        ownerUserId: userId,
        name,
        slug,
        description: normalizeOptionalString(description),
        visibility: parseResult.data.visibility ?? PROJECT_CONSTANTS.DEFAULT_VISIBILITY,
        status: PROJECT_CONSTANTS.DEFAULT_STATUS,
        goalTargetDate,
        goalSummary: normalizeOptionalString(parseResult.data.goalSummary),
        createdBy: userId,
        updatedBy: userId,
      };

      const project = await projectRepo.create(projectData);
      const serializedProject = serializeProject(project);

      const retentionRepo = req.services.get(
        'projectRetentionPolicyRepository'
      ) as ProjectRetentionPolicyRepositoryImpl;
      const defaultPolicyTemplate = createDefaultRetentionPolicyTemplate();
      try {
        await retentionRepo.upsertDefault(project.id, {
          ...defaultPolicyTemplate,
          createdBy: userId,
          updatedBy: userId,
        });
      } catch (policyError) {
        logger?.error(
          {
            requestId: req.requestId,
            userId,
            projectId: project.id,
            projectSlug: project.slug,
            error: policyError instanceof Error ? policyError.message : 'Unknown error',
            action: 'create_project_retention_policy',
            durationMs: elapsedMsSince(startedAt),
          },
          'Failed to seed default retention policy for project'
        );

        res.status(500).json({
          error: 'INTERNAL_ERROR',
          message: 'Failed to persist project retention policy',
          requestId: req.requestId || 'unknown',
          timestamp: new Date().toISOString(),
        });
        return;
      }

      // Log activity
      const activityRepo = req.services.get('activityLogRepository') as ActivityLogRepositoryImpl;
      await activityRepo.create(
        ActivityLogUtils.createLogEntry(
          userId,
          ACTION_TYPES.PROJECT_CREATE,
          RESOURCE_TYPES.PROJECT,
          project.id,
          {
            name,
            slug,
            description: serializedProject.description,
            status: serializedProject.status,
            visibility: serializedProject.visibility,
            goalTargetDate: serializedProject.goalTargetDate,
            goalSummary: serializedProject.goalSummary,
          },
          { ip: req.ip, userAgent: req.get('User-Agent') }
        )
      );

      logger?.info(
        {
          requestId: req.requestId,
          userId,
          projectId: project.id,
          projectName: name,
          projectSlug: slug,
          action: 'create_project',
          durationMs: elapsedMsSince(startedAt),
        },
        'Project created'
      );

      publishProjectLifecycleEvent(req, logger, project, {
        actorUserId: userId,
        reason: 'create',
        previousStatus: null,
      });

      res.setHeader('Last-Modified', serializedProject.updatedAt);
      res.status(201).json(serializedProject);
    } catch (error) {
      logger?.error(
        {
          requestId: req.requestId,
          userId,
          error: error instanceof Error ? error.message : 'Unknown error',
          action: 'create_project',
          durationMs: elapsedMsSince(startedAt),
        },
        'Failed to create project'
      );

      if (error instanceof Error && error.message.includes('already exists')) {
        res.status(409).json({
          error: 'CONFLICT',
          message: error.message,
          requestId: req.requestId || 'unknown',
          timestamp: new Date().toISOString(),
        });
      } else {
        res.status(500).json({
          error: 'INTERNAL_ERROR',
          message: 'Failed to create project',
          requestId: req.requestId || 'unknown',
          timestamp: new Date().toISOString(),
        });
      }
    }
  }
);

/**
 * GET /api/v1/projects/:projectId
 * Get project by ID (user must be owner)
 */
projectsRouter.get(
  '/projects/:projectId',
  async (req: AuthenticatedRequest, res: Response<SerializedProject | ErrorResponse>) => {
    const logger = req.services?.get('logger') as Logger | undefined;
    const startedAt = performance.now();
    const userId = req.user?.userId;
    const { projectId } = req.params as { projectId?: string };

    try {
      if (!userId) {
        res.status(401).json({
          error: 'UNAUTHORIZED',
          message: 'Authentication required',
          requestId: req.requestId || 'unknown',
          timestamp: new Date().toISOString(),
        });
        return;
      }

      if (!projectId) {
        res.status(400).json({
          error: 'VALIDATION_ERROR',
          message: 'Project ID is required',
          requestId: req.requestId || 'unknown',
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const idValidation = z.string().uuid('Invalid project ID format').safeParse(projectId);
      if (!idValidation.success) {
        res.status(404).json({
          error: 'NOT_FOUND',
          message: 'Project not found',
          requestId: req.requestId || 'unknown',
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const projectRepo = req.services.get('projectRepository') as ProjectRepositoryImpl;
      const project = await projectRepo.findByIdIncludingArchived(projectId);

      if (!project) {
        res.status(404).json({
          error: 'NOT_FOUND',
          message: 'Project not found',
          requestId: req.requestId || 'unknown',
          timestamp: new Date().toISOString(),
        });
        return;
      }

      // Check ownership
      if (project.ownerUserId !== userId) {
        res.status(403).json({
          error: 'FORBIDDEN',
          message: 'You do not have permission to access this project',
          requestId: req.requestId || 'unknown',
          timestamp: new Date().toISOString(),
        });
        return;
      }

      // Log activity
      const activityRepo = req.services.get('activityLogRepository') as ActivityLogRepositoryImpl;
      await activityRepo.create(
        ActivityLogUtils.createLogEntry(
          userId,
          ACTION_TYPES.PROJECT_VIEW,
          RESOURCE_TYPES.PROJECT,
          project.id,
          { method: 'GET', projectId },
          { ip: req.ip, userAgent: req.get('User-Agent') }
        )
      );

      logger?.info(
        {
          requestId: req.requestId,
          userId,
          projectId: project.id,
          action: 'get_project_by_id',
          durationMs: elapsedMsSince(startedAt),
        },
        'Project retrieved by ID'
      );

      res.status(200).json(serializeProject(project));
    } catch (error) {
      logger?.error(
        {
          requestId: req.requestId,
          userId,
          projectId: projectId ?? 'unknown',
          error: error instanceof Error ? error.message : 'Unknown error',
          action: 'get_project_by_id',
          durationMs: elapsedMsSince(startedAt),
        },
        'Failed to get project by ID'
      );

      res.status(500).json({
        error: 'INTERNAL_ERROR',
        message: 'Failed to retrieve project',
        requestId: req.requestId || 'unknown',
        timestamp: new Date().toISOString(),
      });
    }
  }
);

/**
 * PATCH /api/v1/projects/:projectId
 * Update project (user must be owner)
 */
projectsRouter.patch(
  '/projects/:projectId',
  async (req: AuthenticatedRequest, res: Response<SerializedProject | ErrorResponse>) => {
    const logger = req.services?.get('logger') as Logger | undefined;
    const startedAt = performance.now();
    const userId = req.user?.userId;
    const { projectId } = req.params as { projectId?: string };

    try {
      if (!userId) {
        res.status(401).json({
          error: 'UNAUTHORIZED',
          message: 'Authentication required',
          requestId: req.requestId || 'unknown',
          timestamp: new Date().toISOString(),
        });
        return;
      }

      if (!projectId) {
        res.status(400).json({
          error: 'VALIDATION_ERROR',
          message: 'Project ID is required',
          requestId: req.requestId || 'unknown',
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const idValidation = z.string().uuid('Invalid project ID format').safeParse(projectId);
      if (!idValidation.success) {
        res.status(404).json({
          error: 'NOT_FOUND',
          message: 'Project not found',
          requestId: req.requestId || 'unknown',
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const ifUnmodifiedSinceRaw = req.get('If-Unmodified-Since') ?? req.get(CONCURRENCY_HEADER);

      if (!ifUnmodifiedSinceRaw) {
        res.status(428).json({
          error: 'PRECONDITION_REQUIRED',
          message: 'If-Unmodified-Since header is required to update a project',
          requestId: req.requestId || 'unknown',
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const ifUnmodifiedSinceDate = new Date(ifUnmodifiedSinceRaw);
      if (Number.isNaN(ifUnmodifiedSinceDate.getTime())) {
        res.status(400).json({
          error: 'VALIDATION_ERROR',
          message: 'If-Unmodified-Since header must be a valid HTTP date',
          requestId: req.requestId || 'unknown',
          timestamp: new Date().toISOString(),
        });
        return;
      }

      // Validate request body
      const parseResult = UpdateProjectRequestSchema.safeParse(req.body);
      if (!parseResult.success) {
        res.status(400).json({
          error: 'VALIDATION_ERROR',
          message: 'Invalid request parameters',
          requestId: req.requestId || 'unknown',
          timestamp: new Date().toISOString(),
          details: parseResult.error.format(),
        });
        return;
      }

      const clientTimezoneOffsetHeader = req.header('x-client-timezone-offset');
      const clientTimezoneOffset = clientTimezoneOffsetHeader
        ? Number.parseInt(clientTimezoneOffsetHeader, 10)
        : undefined;

      const updatePayload: UpdateProjectInput = {
        updatedBy: userId,
      };

      if (Object.prototype.hasOwnProperty.call(parseResult.data, 'name')) {
        if (parseResult.data.name && parseResult.data.name.length > 0) {
          updatePayload.name = parseResult.data.name;
          updatePayload.slug = ProjectUtils.generateSlug(parseResult.data.name);
        } else {
          updatePayload.name = parseResult.data.name;
        }
      }

      if (Object.prototype.hasOwnProperty.call(parseResult.data, 'description')) {
        const description = parseResult.data.description;
        updatePayload.description = normalizeOptionalString(description);
      }

      if (Object.prototype.hasOwnProperty.call(parseResult.data, 'visibility')) {
        updatePayload.visibility = parseResult.data.visibility;
      }

      if (Object.prototype.hasOwnProperty.call(parseResult.data, 'status')) {
        updatePayload.status = parseResult.data.status;
      }

      if (Object.prototype.hasOwnProperty.call(parseResult.data, 'goalSummary')) {
        const summary = parseResult.data.goalSummary;
        updatePayload.goalSummary = normalizeOptionalString(summary);
      }

      if (Object.prototype.hasOwnProperty.call(parseResult.data, 'goalTargetDate')) {
        try {
          updatePayload.goalTargetDate =
            parseGoalTargetDate(parseResult.data.goalTargetDate, clientTimezoneOffset) ?? null;
        } catch (parseError) {
          res.status(400).json({
            error: 'VALIDATION_ERROR',
            message:
              parseError instanceof Error ? parseError.message : 'Goal target date is invalid',
            requestId: req.requestId || 'unknown',
            timestamp: new Date().toISOString(),
          });
          return;
        }
      }

      const projectRepo = req.services.get('projectRepository') as ProjectRepositoryImpl;
      const project = await projectRepo.findByIdIncludingArchived(projectId);

      if (!project) {
        res.status(404).json({
          error: 'NOT_FOUND',
          message: 'Project not found',
          requestId: req.requestId || 'unknown',
          timestamp: new Date().toISOString(),
        });
        return;
      }

      if (project.status === PROJECT_CONSTANTS.ARCHIVED_STATUS) {
        res.status(409).json({
          error: 'PROJECT_ARCHIVED',
          message: 'Archived projects cannot be updated. Restore the project before editing.',
          requestId: req.requestId || 'unknown',
          timestamp: new Date().toISOString(),
        });
        return;
      }

      // Check ownership
      if (project.ownerUserId !== userId) {
        res.status(403).json({
          error: 'FORBIDDEN',
          message: 'You do not have permission to update this project',
          requestId: req.requestId || 'unknown',
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const persistedUpdatedAtMs = project.updatedAt.getTime();
      const headerTimestampMs = ifUnmodifiedSinceDate.getTime();

      const deltaMs = headerTimestampMs - persistedUpdatedAtMs;
      if (deltaMs < 0 && Math.abs(deltaMs) > CONCURRENCY_TOLERANCE_MS) {
        res.status(409).json({
          error: 'VERSION_CONFLICT',
          message: 'Project was modified after the version you are editing. Refresh and try again.',
          requestId: req.requestId || 'unknown',
          timestamp: new Date().toISOString(),
          details: {
            expectedLastModified: project.updatedAt.toISOString(),
            provided: ifUnmodifiedSinceDate.toISOString(),
            driftMs: Math.abs(deltaMs),
          },
        });
        return;
      }

      if (deltaMs > CONCURRENCY_TOLERANCE_MS) {
        res.status(409).json({
          error: 'VERSION_CONFLICT',
          message: 'Version token is ahead of the stored project state. Refresh and try again.',
          requestId: req.requestId || 'unknown',
          timestamp: new Date().toISOString(),
          details: {
            expectedLastModified: project.updatedAt.toISOString(),
            provided: ifUnmodifiedSinceDate.toISOString(),
            driftMs: deltaMs,
          },
        });
        return;
      }

      if (
        Object.prototype.hasOwnProperty.call(updatePayload, 'status') &&
        updatePayload.status &&
        !isValidStatusTransition(project.status, updatePayload.status)
      ) {
        res.status(400).json({
          error: 'INVALID_STATUS_TRANSITION',
          message: `Cannot change project status from "${project.status}" to "${updatePayload.status}"`,
          requestId: req.requestId || 'unknown',
          timestamp: new Date().toISOString(),
        });
        return;
      }

      // If name is being updated, generate new slug
      const updatedProject = await projectRepo.update(projectId, updatePayload);
      const updatesForLog: Record<string, unknown> = {};
      if (Object.prototype.hasOwnProperty.call(updatePayload, 'name')) {
        updatesForLog.name = updatePayload.name ?? null;
      }
      if (Object.prototype.hasOwnProperty.call(updatePayload, 'slug')) {
        updatesForLog.slug = updatePayload.slug;
      }
      if (Object.prototype.hasOwnProperty.call(updatePayload, 'description')) {
        updatesForLog.description = updatePayload.description ?? null;
      }
      if (Object.prototype.hasOwnProperty.call(updatePayload, 'visibility')) {
        updatesForLog.visibility = updatePayload.visibility;
      }
      if (Object.prototype.hasOwnProperty.call(updatePayload, 'status')) {
        updatesForLog.status = updatePayload.status;
      }
      if (Object.prototype.hasOwnProperty.call(updatePayload, 'goalSummary')) {
        updatesForLog.goalSummary = updatePayload.goalSummary ?? null;
      }
      if (Object.prototype.hasOwnProperty.call(updatePayload, 'goalTargetDate')) {
        const rawValue = updatePayload.goalTargetDate;
        updatesForLog.goalTargetDate =
          rawValue instanceof Date ? toIsoDateOnly(rawValue) : (rawValue ?? null);
      }

      // Log activity
      const activityRepo = req.services.get('activityLogRepository') as ActivityLogRepositoryImpl;
      await activityRepo.create(
        ActivityLogUtils.createLogEntry(
          userId,
          ACTION_TYPES.PROJECT_UPDATE,
          RESOURCE_TYPES.PROJECT,
          project.id,
          {
            updates: updatesForLog,
            oldValues: {
              name: project.name,
              description: project.description,
              slug: project.slug,
              status: project.status,
              visibility: project.visibility,
              goalTargetDate: toIsoDateOnly(project.goalTargetDate),
              goalSummary: project.goalSummary,
            },
          },
          { ip: req.ip, userAgent: req.get('User-Agent') }
        )
      );

      logger?.info(
        {
          requestId: req.requestId,
          userId,
          projectId: updatedProject.id,
          updates: updatesForLog,
          action: 'update_project',
          durationMs: elapsedMsSince(startedAt),
        },
        'Project updated'
      );

      const previousStatus = project.status !== updatedProject.status ? project.status : null;

      publishProjectLifecycleEvent(req, logger, updatedProject, {
        actorUserId: userId,
        reason: 'update',
        previousStatus,
      });

      const serializedProject = serializeProject(updatedProject);
      res.setHeader('Last-Modified', serializedProject.updatedAt);
      res.status(200).json(serializedProject);
    } catch (error) {
      logger?.error(
        {
          requestId: req.requestId,
          userId,
          projectId,
          error: error instanceof Error ? error.message : 'Unknown error',
          action: 'update_project',
          durationMs: elapsedMsSince(startedAt),
        },
        'Failed to update project'
      );

      if (error instanceof Error && error.message.includes('already exists')) {
        res.status(409).json({
          error: 'CONFLICT',
          message: error.message,
          requestId: req.requestId || 'unknown',
          timestamp: new Date().toISOString(),
        });
      } else {
        res.status(500).json({
          error: 'INTERNAL_ERROR',
          message: 'Failed to update project',
          requestId: req.requestId || 'unknown',
          timestamp: new Date().toISOString(),
        });
      }
    }
  }
);

projectsRouter.post(
  '/projects/:projectId/export',
  async (req: AuthenticatedRequest, res: Response<Record<string, unknown> | ErrorResponse>) => {
    const logger = req.services?.get('logger') as Logger | undefined;
    const startedAt = performance.now();
    const requestId = req.requestId ?? 'unknown';
    const userId = req.user?.userId ?? req.auth?.userId ?? null;

    if (!userId) {
      res.status(401).json({
        error: 'UNAUTHORIZED',
        message: 'Authentication required',
        requestId,
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const paramsResult = ProjectParamSchema.safeParse(req.params);
    if (!paramsResult.success) {
      const [issue] = paramsResult.error.issues;
      res.status(400).json({
        code: 'VALIDATION_ERROR',
        error: 'VALIDATION_ERROR',
        message: issue?.message ?? 'Invalid project identifier',
        requestId,
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const bodyResult = ExportProjectRequestSchema.safeParse(req.body ?? {});
    if (!bodyResult.success) {
      const [issue] = bodyResult.error.issues;
      res.status(400).json({
        code: 'VALIDATION_ERROR',
        error: 'VALIDATION_ERROR',
        message: issue?.message ?? 'Invalid export request payload',
        requestId,
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const exportService = req.services?.get('documentExportService') as
      | DocumentExportService
      | undefined;
    const projectRepository = req.services?.get('projectRepository') as
      | ProjectRepositoryImpl
      | undefined;
    if (!exportService || !projectRepository) {
      logger?.error({ requestId }, 'Document export dependencies unavailable');
      res.status(500).json({
        code: 'INTERNAL_ERROR',
        error: 'INTERNAL_ERROR',
        message: 'Document export service unavailable',
        requestId,
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const { projectId } = paramsResult.data;
    const { format, scope = 'primary_document', notifyEmail } = bodyResult.data;

    try {
      await requireProjectAccess({
        projectRepository,
        projectId,
        userId,
        requestId,
        logger,
      });

      const job = await exportService.enqueue({
        projectId,
        format,
        scope,
        requestedBy: userId,
        notifyEmail: notifyEmail ?? null,
      });

      logger?.info(
        {
          requestId,
          userId,
          projectId: job.projectId,
          jobId: job.id,
          format: job.format,
          scope: job.scope,
          durationMs: elapsedMsSince(startedAt),
        },
        'Queued document export job'
      );

      res.status(202).json(serializeExportJobResponse(job));
    } catch (error) {
      if (error instanceof ProjectAccessError) {
        res.status(error.status).json({
          code: error.code,
          error: error.code,
          message: error.message,
          requestId,
          timestamp: new Date().toISOString(),
        });
        return;
      }
      if (error instanceof ProjectNotFoundError) {
        res.status(404).json({
          code: 'PROJECT_NOT_FOUND',
          error: 'PROJECT_NOT_FOUND',
          message: `Project not found: ${projectId}`,
          requestId,
          timestamp: new Date().toISOString(),
        });
        return;
      }

      if (error instanceof ExportJobInProgressError) {
        res.status(409).json({
          code: 'EXPORT_IN_PROGRESS',
          error: 'EXPORT_IN_PROGRESS',
          message: 'An export is already running for this project',
          requestId,
          timestamp: new Date().toISOString(),
        });
        return;
      }

      logger?.error(
        {
          requestId,
          userId,
          projectId,
          reason: error instanceof Error ? error.message : 'unknown',
          durationMs: elapsedMsSince(startedAt),
        },
        'Failed to enqueue document export job'
      );

      res.status(500).json({
        code: 'INTERNAL_ERROR',
        error: 'INTERNAL_ERROR',
        message: 'Failed to start document export',
        requestId,
        timestamp: new Date().toISOString(),
      });
    }
  }
);

projectsRouter.get(
  '/projects/:projectId/export/jobs/:jobId',
  async (req: AuthenticatedRequest, res: Response<Record<string, unknown> | ErrorResponse>) => {
    const logger = req.services?.get('logger') as Logger | undefined;
    const requestId = req.requestId ?? 'unknown';
    const userId = req.user?.userId ?? req.auth?.userId ?? null;

    const paramsResult = ExportJobParamsSchema.safeParse(req.params);
    if (!paramsResult.success) {
      const [issue] = paramsResult.error.issues;
      res.status(400).json({
        code: 'VALIDATION_ERROR',
        error: 'VALIDATION_ERROR',
        message: issue?.message ?? 'Invalid export job parameters',
        requestId,
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const exportService = req.services?.get('documentExportService') as
      | DocumentExportService
      | undefined;
    const projectRepository = req.services?.get('projectRepository') as
      | ProjectRepositoryImpl
      | undefined;

    if (!exportService || !projectRepository) {
      logger?.error({ requestId }, 'Document export dependencies unavailable');
      res.status(500).json({
        code: 'INTERNAL_ERROR',
        error: 'INTERNAL_ERROR',
        message: 'Document export service unavailable',
        requestId,
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const { projectId, jobId } = paramsResult.data;

    try {
      await requireProjectAccess({
        projectRepository,
        projectId,
        userId,
        requestId,
        logger,
      });

      const job = await exportService.getJob(projectId, jobId);
      res.status(200).json(serializeExportJobResponse(job));
    } catch (error) {
      if (error instanceof ProjectAccessError) {
        res.status(error.status).json({
          code: error.code,
          error: error.code,
          message: error.message,
          requestId,
          timestamp: new Date().toISOString(),
        });
        return;
      }

      if (error instanceof ExportJobNotFoundError) {
        res.status(404).json({
          code: 'EXPORT_JOB_NOT_FOUND',
          error: 'EXPORT_JOB_NOT_FOUND',
          message: `Export job not found for project ${projectId}`,
          requestId,
          timestamp: new Date().toISOString(),
        });
        return;
      }

      logger?.error(
        {
          requestId,
          projectId,
          jobId,
          reason: error instanceof Error ? error.message : 'unknown',
        },
        'Failed to load export job status'
      );

      res.status(500).json({
        code: 'INTERNAL_ERROR',
        error: 'INTERNAL_ERROR',
        message: 'Unable to load export job status',
        requestId,
        timestamp: new Date().toISOString(),
      });
    }
  }
);

projectsRouter.delete(
  '/projects/:projectId',
  async (req: AuthenticatedRequest, res: Response<void | ErrorResponse>) => {
    const logger = req.services?.get('logger') as Logger | undefined;
    const startedAt = performance.now();
    const userId = req.user?.userId;
    const { projectId } = req.params as { projectId?: string };

    try {
      if (!userId) {
        res.status(401).json({
          error: 'UNAUTHORIZED',
          message: 'Authentication required',
          requestId: req.requestId || 'unknown',
          timestamp: new Date().toISOString(),
        });
        return;
      }

      if (!projectId) {
        res.status(400).json({
          error: 'VALIDATION_ERROR',
          message: 'Project ID is required',
          requestId: req.requestId || 'unknown',
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const idValidation = z.string().uuid('Invalid project ID format').safeParse(projectId);
      if (!idValidation.success) {
        res.status(404).json({
          error: 'NOT_FOUND',
          message: 'Project not found',
          requestId: req.requestId || 'unknown',
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const projectRepo = req.services.get('projectRepository') as ProjectRepositoryImpl;
      const project = await projectRepo.findByIdIncludingArchived(projectId);

      if (!project) {
        res.status(404).json({
          error: 'NOT_FOUND',
          message: 'Project not found',
          requestId: req.requestId || 'unknown',
          timestamp: new Date().toISOString(),
        });
        return;
      }

      if (project.ownerUserId !== userId) {
        res.status(403).json({
          error: 'FORBIDDEN',
          message: 'You do not have permission to archive this project',
          requestId: req.requestId || 'unknown',
          timestamp: new Date().toISOString(),
        });
        return;
      }

      if (project.status === PROJECT_CONSTANTS.ARCHIVED_STATUS) {
        res.status(204).send();
        return;
      }

      const archived = await projectRepo.archiveProject(projectId, userId);

      const activityRepo = req.services.get('activityLogRepository') as ActivityLogRepositoryImpl;
      await activityRepo.create(
        ActivityLogUtils.createLogEntry(
          userId,
          ACTION_TYPES.PROJECT_ARCHIVE,
          RESOURCE_TYPES.PROJECT,
          project.id,
          {
            previousStatus: project.status,
            deletedAt: archived.deletedAt ? archived.deletedAt.toISOString() : null,
            archivedStatusBefore: archived.archivedStatusBefore,
          },
          { ip: req.ip, userAgent: req.get('User-Agent') }
        )
      );

      logger?.info(
        {
          requestId: req.requestId,
          userId,
          projectId: project.id,
          action: 'archive_project',
          archivedStatusBefore: archived.archivedStatusBefore,
          durationMs: elapsedMsSince(startedAt),
        },
        'Project archived'
      );

      publishProjectLifecycleEvent(req, logger, archived, {
        actorUserId: userId,
        reason: 'archive',
        previousStatus: project.status,
      });

      res.status(204).send();
    } catch (error) {
      logger?.error(
        {
          requestId: req.requestId,
          userId,
          projectId,
          error: error instanceof Error ? error.message : 'Unknown error',
          action: 'archive_project',
          durationMs: elapsedMsSince(startedAt),
        },
        'Failed to archive project'
      );

      res.status(500).json({
        error: 'INTERNAL_ERROR',
        message: 'Failed to archive project',
        requestId: req.requestId || 'unknown',
        timestamp: new Date().toISOString(),
      });
    }
  }
);

projectsRouter.post(
  '/projects/:projectId/restore',
  async (req: AuthenticatedRequest, res: Response<SerializedProject | ErrorResponse>) => {
    const logger = req.services?.get('logger') as Logger | undefined;
    const startedAt = performance.now();
    const userId = req.user?.userId;
    const { projectId } = req.params as { projectId?: string };

    try {
      if (!userId) {
        res.status(401).json({
          error: 'UNAUTHORIZED',
          message: 'Authentication required',
          requestId: req.requestId || 'unknown',
          timestamp: new Date().toISOString(),
        });
        return;
      }

      if (!projectId) {
        res.status(400).json({
          error: 'VALIDATION_ERROR',
          message: 'Project ID is required',
          requestId: req.requestId || 'unknown',
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const idValidation = z.string().uuid('Invalid project ID format').safeParse(projectId);
      if (!idValidation.success) {
        res.status(404).json({
          error: 'NOT_FOUND',
          message: 'Project not found',
          requestId: req.requestId || 'unknown',
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const projectRepo = req.services.get('projectRepository') as ProjectRepositoryImpl;
      const project = await projectRepo.findByIdIncludingArchived(projectId);

      if (!project) {
        res.status(404).json({
          error: 'NOT_FOUND',
          message: 'Project not found',
          requestId: req.requestId || 'unknown',
          timestamp: new Date().toISOString(),
        });
        return;
      }

      if (project.ownerUserId !== userId) {
        res.status(403).json({
          error: 'FORBIDDEN',
          message: 'You do not have permission to restore this project',
          requestId: req.requestId || 'unknown',
          timestamp: new Date().toISOString(),
        });
        return;
      }

      if (project.status !== PROJECT_CONSTANTS.ARCHIVED_STATUS) {
        res.status(409).json({
          error: 'PROJECT_NOT_ARCHIVED',
          message: 'Project must be archived before it can be restored',
          requestId: req.requestId || 'unknown',
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const restored = await projectRepo.restoreProject(projectId, userId);

      const activityRepo = req.services.get('activityLogRepository') as ActivityLogRepositoryImpl;
      await activityRepo.create(
        ActivityLogUtils.createLogEntry(
          userId,
          ACTION_TYPES.PROJECT_RESTORE,
          RESOURCE_TYPES.PROJECT,
          project.id,
          {
            restoredStatus: restored.status,
            archivedStatusBefore: project.archivedStatusBefore,
          },
          { ip: req.ip, userAgent: req.get('User-Agent') }
        )
      );

      logger?.info(
        {
          requestId: req.requestId,
          userId,
          projectId: restored.id,
          restoredStatus: restored.status,
          archivedStatusBefore: project.archivedStatusBefore,
          action: 'restore_project',
          durationMs: elapsedMsSince(startedAt),
        },
        'Project restored'
      );

      publishProjectLifecycleEvent(req, logger, restored, {
        actorUserId: userId,
        reason: 'restore',
        previousStatus: project.status,
      });

      const serializedProject = serializeProject(restored);
      res.setHeader('Last-Modified', serializedProject.updatedAt);
      res.status(200).json(serializedProject);
    } catch (error) {
      logger?.error(
        {
          requestId: req.requestId,
          userId,
          projectId,
          error: error instanceof Error ? error.message : 'Unknown error',
          action: 'restore_project',
          durationMs: elapsedMsSince(startedAt),
        },
        'Failed to restore project'
      );

      res.status(500).json({
        error: 'INTERNAL_ERROR',
        message: 'Failed to restore project',
        requestId: req.requestId || 'unknown',
        timestamp: new Date().toISOString(),
      });
    }
  }
);

/**
 * Extended Request interface with authentication
 */
interface AuthenticatedRequest extends Request {
  user?: {
    userId: string;
    email?: string;
    name?: string;
  };
  requestId?: string;
  auth?: {
    userId?: string;
    sessionId?: string;
    orgId?: string;
    orgRole?: string;
    orgPermissions?: string[];
  };
}

export default projectsRouter;

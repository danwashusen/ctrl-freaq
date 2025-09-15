import type { Project, CreateProjectInput, UpdateProjectInput } from '@ctrl-freaq/shared-data';
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
} from '@ctrl-freaq/shared-data';
import { Router } from 'express';
import type { Request, Response, Router as ExpressRouter } from 'express';
import type { Logger } from 'pino';
import { z } from 'zod';

/**
 * Request body schema for creating a project
 */
const CreateProjectRequestSchema = z.object({
  name: z.string().min(1, 'Project name is required').max(100, 'Project name too long'),
  description: z.string().max(500, 'Description too long').optional(),
});

/**
 * Request body schema for updating a project
 */
const UpdateProjectRequestSchema = z.object({
  name: z.string().min(1, 'Project name is required').max(100, 'Project name too long').optional(),
  description: z.string().max(500, 'Description too long').optional(),
});

/**
 * Error response schema
 */
const _ErrorResponseSchema = z.object({
  error: z.string(),
  message: z.string(),
  requestId: z.string(),
  timestamp: z.string().datetime(),
  details: z.record(z.any()).optional(),
});

type ErrorResponse = z.infer<typeof _ErrorResponseSchema>;

/**
 * Projects API router
 */
export const projectsRouter: ExpressRouter = Router();

/**
 * GET /api/v1/projects (list)
 * Returns user's projects (MVP: up to 1) in list shape with pagination params
 */
const ListQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

projectsRouter.get('/projects', async (req: AuthenticatedRequest, res: Response) => {
  const logger = req.services?.get('logger') as Logger | undefined;
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

    const projectRepo = req.services.get('projectRepository') as ProjectRepositoryImpl;
    const project = await projectRepo.findByUserId(userId);
    const total = await projectRepo.countByUserId(userId);

    let projects = project
      ? [
          {
            ...project,
            memberAvatars: [],
            lastModified: 'N/A',
          },
        ]
      : [];

    // Alpha sort by name per spec
    projects = projects.sort((a, b) => a.name.localeCompare(b.name));

    // Log activity only when there is a project viewed
    if (project) {
      const activityRepo = req.services.get('activityLogRepository') as ActivityLogRepositoryImpl;
      await activityRepo.create(
        ActivityLogUtils.createLogEntry(
          userId,
          ACTION_TYPES.PROJECT_VIEW,
          RESOURCE_TYPES.PROJECT,
          project.id,
          { method: 'GET_LIST' },
          { ip: req.ip, userAgent: req.get('User-Agent') }
        )
      );
    }

    logger?.info(
      {
        requestId: req.requestId,
        userId,
        count: projects.length,
        total,
        action: 'list_user_projects',
      },
      'User projects listed'
    );

    res.status(200).json({ projects, total });
  } catch (error) {
    logger?.error(
      {
        requestId: req.requestId,
        userId,
        error: error instanceof Error ? error.message : 'Unknown error',
        action: 'list_user_projects',
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

    const validatedUpdates: Record<string, string> = {};

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

      validatedUpdates[key] = value;
    }

    for (const [key, value] of Object.entries(validatedUpdates)) {
      await configRepo.upsert(userId, key, value);
    }

    logger?.info(
      {
        requestId: req.requestId,
        userId,
        updatedKeys: Object.keys(validatedUpdates),
        action: 'update_user_config',
      },
      'User configuration updated'
    );

    // Return merged current configuration (strings only)
    const configurations = await configRepo.findByUserId(userId);
    const configObject: Record<string, string> = {};
    for (const cfg of configurations) {
      configObject[cfg.key] = cfg.value;
    }

    res.status(200).json(configObject);
  } catch (error) {
    logger?.error(
      {
        requestId: req.requestId,
        userId,
        error: error instanceof Error ? error.message : 'Unknown error',
        action: 'update_user_config',
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

/**
 * POST /api/v1/projects
 * Create user's project (one per user in MVP)
 */
projectsRouter.post(
  '/projects',
  async (req: AuthenticatedRequest, res: Response<Project | ErrorResponse>) => {
    const logger = req.services?.get('logger') as Logger | undefined;
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

      const { name, description } = parseResult.data;
      const slug = ProjectUtils.generateSlug(name);

      const projectRepo = req.services.get('projectRepository') as ProjectRepositoryImpl;

      // Check if user already has a project (MVP constraint)
      const existingProject = await projectRepo.findByUserId(userId);
      if (existingProject) {
        res.status(409).json({
          error: 'CONFLICT',
          message: 'User already has a project. Only one project per user allowed in MVP.',
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
        description: description || null,
        createdBy: userId,
        updatedBy: userId,
      };

      const project = await projectRepo.create(projectData);

      // Log activity
      const activityRepo = req.services.get('activityLogRepository') as ActivityLogRepositoryImpl;
      await activityRepo.create(
        ActivityLogUtils.createLogEntry(
          userId,
          ACTION_TYPES.PROJECT_CREATE,
          RESOURCE_TYPES.PROJECT,
          project.id,
          { name, slug, description },
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
        },
        'Project created'
      );

      res.status(201).json(project);
    } catch (error) {
      logger?.error(
        {
          requestId: req.requestId,
          userId,
          error: error instanceof Error ? error.message : 'Unknown error',
          action: 'create_project',
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
  async (req: AuthenticatedRequest, res: Response<Project | ErrorResponse>) => {
    const logger = req.services?.get('logger') as Logger | undefined;
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
      const project = await projectRepo.findById(projectId);

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
        },
        'Project retrieved by ID'
      );

      res.status(200).json(project);
    } catch (error) {
      logger?.error(
        {
          requestId: req.requestId,
          userId,
          projectId: projectId ?? 'unknown',
          error: error instanceof Error ? error.message : 'Unknown error',
          action: 'get_project_by_id',
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
  async (req: AuthenticatedRequest, res: Response<Project | ErrorResponse>) => {
    const logger = req.services?.get('logger') as Logger | undefined;
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

      const updateData = parseResult.data;

      const projectRepo = req.services.get('projectRepository') as ProjectRepositoryImpl;
      const project = await projectRepo.findById(projectId);

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
          message: 'You do not have permission to update this project',
          requestId: req.requestId || 'unknown',
          timestamp: new Date().toISOString(),
        });
        return;
      }

      // If name is being updated, generate new slug
      const updates: UpdateProjectInput = { ...updateData, updatedBy: userId };
      if (updateData.name) {
        updates.slug = ProjectUtils.generateSlug(updateData.name);
      }

      const updatedProject = await projectRepo.update(projectId, updates);

      // Log activity
      const activityRepo = req.services.get('activityLogRepository') as ActivityLogRepositoryImpl;
      await activityRepo.create(
        ActivityLogUtils.createLogEntry(
          userId,
          ACTION_TYPES.PROJECT_UPDATE,
          RESOURCE_TYPES.PROJECT,
          project.id,
          {
            updates,
            oldValues: { name: project.name, description: project.description, slug: project.slug },
          },
          { ip: req.ip, userAgent: req.get('User-Agent') }
        )
      );

      logger?.info(
        {
          requestId: req.requestId,
          userId,
          projectId: updatedProject.id,
          updates,
          action: 'update_project',
        },
        'Project updated'
      );

      res.status(200).json(updatedProject);
    } catch (error) {
      logger?.error(
        {
          requestId: req.requestId,
          userId,
          projectId,
          error: error instanceof Error ? error.message : 'Unknown error',
          action: 'update_project',
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
}

export default projectsRouter;

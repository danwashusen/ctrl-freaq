import { Router, Request, Response } from 'express';
import { z } from 'zod';
import Database from 'better-sqlite3';
import {
  Project,
  ProjectRepositoryImpl,
  CreateProjectInput,
  UpdateProjectInput,
  validateCreateProject,
  validateUpdateProject,
  ProjectUtils,
  Configuration,
  ConfigurationRepositoryImpl,
  ConfigurationUtils,
  ActivityLogRepositoryImpl,
  ActivityLogUtils,
  ACTION_TYPES,
  RESOURCE_TYPES
} from '@ctrl-freaq/shared-data';

/**
 * Request body schema for creating a project
 */
const CreateProjectRequestSchema = z.object({
  name: z.string().min(1, 'Project name is required').max(100, 'Project name too long'),
  description: z.string().max(500, 'Description too long').optional()
});

/**
 * Request body schema for updating a project
 */
const UpdateProjectRequestSchema = z.object({
  name: z.string().min(1, 'Project name is required').max(100, 'Project name too long').optional(),
  description: z.string().max(500, 'Description too long').optional()
});

/**
 * Request body schema for updating configuration
 */
const UpdateConfigRequestSchema = z.record(z.string());

/**
 * Error response schema
 */
const ErrorResponseSchema = z.object({
  error: z.string(),
  message: z.string(),
  requestId: z.string(),
  timestamp: z.string().datetime(),
  details: z.record(z.any()).optional()
});

type ErrorResponse = z.infer<typeof ErrorResponseSchema>;

/**
 * Projects API router
 */
export const projectsRouter = Router();

/**
 * GET /api/v1/projects
 * Get user's project (single project per user in MVP)
 */
projectsRouter.get('/projects', async (req: AuthenticatedRequest, res: Response<Project | ErrorResponse>) => {
  const logger = req.services?.get('logger');
  const db = req.services?.get('database') as Database.Database;
  const userId = req.user?.userId;

  try {
    if (!userId) {
      return res.status(401).json({
        error: 'UNAUTHORIZED',
        message: 'Authentication required',
        requestId: req.requestId!,
        timestamp: new Date().toISOString()
      });
    }

    const projectRepo = new ProjectRepositoryImpl(db);
    const project = await projectRepo.findByUserId(userId);

    if (!project) {
      return res.status(404).json({
        error: 'NOT_FOUND',
        message: 'No project found for user',
        requestId: req.requestId!,
        timestamp: new Date().toISOString()
      });
    }

    // Log activity
    const activityRepo = new ActivityLogRepositoryImpl(db);
    await activityRepo.create(ActivityLogUtils.createLogEntry(
      userId,
      ACTION_TYPES.PROJECT_VIEW,
      RESOURCE_TYPES.PROJECT,
      project.id,
      { method: 'GET' },
      { ip: req.ip, userAgent: req.get('User-Agent') }
    ));

    logger?.info({
      requestId: req.requestId,
      userId,
      projectId: project.id,
      action: 'get_user_project'
    }, 'User project retrieved');

    res.status(200).json(project);
  } catch (error) {
    logger?.error({
      requestId: req.requestId,
      userId,
      error: error instanceof Error ? error.message : 'Unknown error',
      action: 'get_user_project'
    }, 'Failed to get user project');

    res.status(500).json({
      error: 'INTERNAL_ERROR',
      message: 'Failed to retrieve project',
      requestId: req.requestId!,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * POST /api/v1/projects
 * Create user's project (one per user in MVP)
 */
projectsRouter.post('/projects', async (req: AuthenticatedRequest, res: Response<Project | ErrorResponse>) => {
  const logger = req.services?.get('logger');
  const db = req.services?.get('database') as Database.Database;
  const userId = req.user?.userId;

  try {
    if (!userId) {
      return res.status(401).json({
        error: 'UNAUTHORIZED',
        message: 'Authentication required',
        requestId: req.requestId!,
        timestamp: new Date().toISOString()
      });
    }

    // Validate request body
    const parseResult = CreateProjectRequestSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'Invalid request parameters',
        requestId: req.requestId!,
        timestamp: new Date().toISOString(),
        details: parseResult.error.format()
      });
    }

    const { name, description } = parseResult.data;
    const slug = ProjectUtils.generateSlug(name);

    const projectRepo = new ProjectRepositoryImpl(db);

    // Check if user already has a project (MVP constraint)
    const existingProject = await projectRepo.findByUserId(userId);
    if (existingProject) {
      return res.status(409).json({
        error: 'CONFLICT',
        message: 'User already has a project. Only one project per user allowed in MVP.',
        requestId: req.requestId!,
        timestamp: new Date().toISOString()
      });
    }

    // Create project
    const projectData: CreateProjectInput = {
      ownerUserId: userId,
      name,
      slug,
      description: description || null
    };

    const project = await projectRepo.create(projectData);

    // Log activity
    const activityRepo = new ActivityLogRepositoryImpl(db);
    await activityRepo.create(ActivityLogUtils.createLogEntry(
      userId,
      ACTION_TYPES.PROJECT_CREATE,
      RESOURCE_TYPES.PROJECT,
      project.id,
      { name, slug, description },
      { ip: req.ip, userAgent: req.get('User-Agent') }
    ));

    logger?.info({
      requestId: req.requestId,
      userId,
      projectId: project.id,
      projectName: name,
      projectSlug: slug,
      action: 'create_project'
    }, 'Project created');

    res.status(201).json(project);
  } catch (error) {
    logger?.error({
      requestId: req.requestId,
      userId,
      error: error instanceof Error ? error.message : 'Unknown error',
      action: 'create_project'
    }, 'Failed to create project');

    if (error instanceof Error && error.message.includes('already exists')) {
      res.status(409).json({
        error: 'CONFLICT',
        message: error.message,
        requestId: req.requestId!,
        timestamp: new Date().toISOString()
      });
    } else {
      res.status(500).json({
        error: 'INTERNAL_ERROR',
        message: 'Failed to create project',
        requestId: req.requestId!,
        timestamp: new Date().toISOString()
      });
    }
  }
});

/**
 * GET /api/v1/projects/:projectId
 * Get project by ID (user must be owner)
 */
projectsRouter.get('/projects/:projectId', async (req: AuthenticatedRequest, res: Response<Project | ErrorResponse>) => {
  const logger = req.services?.get('logger');
  const db = req.services?.get('database') as Database.Database;
  const userId = req.user?.userId;
  const { projectId } = req.params;

  try {
    if (!userId) {
      return res.status(401).json({
        error: 'UNAUTHORIZED',
        message: 'Authentication required',
        requestId: req.requestId!,
        timestamp: new Date().toISOString()
      });
    }

    const projectRepo = new ProjectRepositoryImpl(db);
    const project = await projectRepo.findById(projectId);

    if (!project) {
      return res.status(404).json({
        error: 'NOT_FOUND',
        message: 'Project not found',
        requestId: req.requestId!,
        timestamp: new Date().toISOString()
      });
    }

    // Check ownership
    if (project.ownerUserId !== userId) {
      return res.status(403).json({
        error: 'FORBIDDEN',
        message: 'You do not have permission to access this project',
        requestId: req.requestId!,
        timestamp: new Date().toISOString()
      });
    }

    // Log activity
    const activityRepo = new ActivityLogRepositoryImpl(db);
    await activityRepo.create(ActivityLogUtils.createLogEntry(
      userId,
      ACTION_TYPES.PROJECT_VIEW,
      RESOURCE_TYPES.PROJECT,
      project.id,
      { method: 'GET', projectId },
      { ip: req.ip, userAgent: req.get('User-Agent') }
    ));

    logger?.info({
      requestId: req.requestId,
      userId,
      projectId: project.id,
      action: 'get_project_by_id'
    }, 'Project retrieved by ID');

    res.status(200).json(project);
  } catch (error) {
    logger?.error({
      requestId: req.requestId,
      userId,
      projectId,
      error: error instanceof Error ? error.message : 'Unknown error',
      action: 'get_project_by_id'
    }, 'Failed to get project by ID');

    res.status(500).json({
      error: 'INTERNAL_ERROR',
      message: 'Failed to retrieve project',
      requestId: req.requestId!,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * PATCH /api/v1/projects/:projectId
 * Update project (user must be owner)
 */
projectsRouter.patch('/projects/:projectId', async (req: AuthenticatedRequest, res: Response<Project | ErrorResponse>) => {
  const logger = req.services?.get('logger');
  const db = req.services?.get('database') as Database.Database;
  const userId = req.user?.userId;
  const { projectId } = req.params;

  try {
    if (!userId) {
      return res.status(401).json({
        error: 'UNAUTHORIZED',
        message: 'Authentication required',
        requestId: req.requestId!,
        timestamp: new Date().toISOString()
      });
    }

    // Validate request body
    const parseResult = UpdateProjectRequestSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'Invalid request parameters',
        requestId: req.requestId!,
        timestamp: new Date().toISOString(),
        details: parseResult.error.format()
      });
    }

    const updateData = parseResult.data;

    const projectRepo = new ProjectRepositoryImpl(db);
    const project = await projectRepo.findById(projectId);

    if (!project) {
      return res.status(404).json({
        error: 'NOT_FOUND',
        message: 'Project not found',
        requestId: req.requestId!,
        timestamp: new Date().toISOString()
      });
    }

    // Check ownership
    if (project.ownerUserId !== userId) {
      return res.status(403).json({
        error: 'FORBIDDEN',
        message: 'You do not have permission to update this project',
        requestId: req.requestId!,
        timestamp: new Date().toISOString()
      });
    }

    // If name is being updated, generate new slug
    const updates: UpdateProjectInput = { ...updateData };
    if (updateData.name) {
      updates.slug = ProjectUtils.generateSlug(updateData.name);
    }

    const updatedProject = await projectRepo.update(projectId, updates);

    // Log activity
    const activityRepo = new ActivityLogRepositoryImpl(db);
    await activityRepo.create(ActivityLogUtils.createLogEntry(
      userId,
      ACTION_TYPES.PROJECT_UPDATE,
      RESOURCE_TYPES.PROJECT,
      project.id,
      { updates, oldValues: { name: project.name, description: project.description, slug: project.slug } },
      { ip: req.ip, userAgent: req.get('User-Agent') }
    ));

    logger?.info({
      requestId: req.requestId,
      userId,
      projectId: updatedProject.id,
      updates,
      action: 'update_project'
    }, 'Project updated');

    res.status(200).json(updatedProject);
  } catch (error) {
    logger?.error({
      requestId: req.requestId,
      userId,
      projectId,
      error: error instanceof Error ? error.message : 'Unknown error',
      action: 'update_project'
    }, 'Failed to update project');

    if (error instanceof Error && error.message.includes('already exists')) {
      res.status(409).json({
        error: 'CONFLICT',
        message: error.message,
        requestId: req.requestId!,
        timestamp: new Date().toISOString()
      });
    } else {
      res.status(500).json({
        error: 'INTERNAL_ERROR',
        message: 'Failed to update project',
        requestId: req.requestId!,
        timestamp: new Date().toISOString()
      });
    }
  }
});

/**
 * GET /api/v1/projects/config
 * Get user configuration
 */
projectsRouter.get('/projects/config', async (req: AuthenticatedRequest, res: Response<Record<string, any> | ErrorResponse>) => {
  const logger = req.services?.get('logger');
  const db = req.services?.get('database') as Database.Database;
  const userId = req.user?.userId;

  try {
    if (!userId) {
      return res.status(401).json({
        error: 'UNAUTHORIZED',
        message: 'Authentication required',
        requestId: req.requestId!,
        timestamp: new Date().toISOString()
      });
    }

    const configRepo = new ConfigurationRepositoryImpl(db);
    const configurations = await configRepo.findByUserId(userId);

    // Convert configurations to key-value object, parsing JSON values
    const configObject: Record<string, any> = {};
    for (const config of configurations) {
      configObject[config.key] = ConfigurationUtils.parseValue(config);
    }

    // Merge with defaults for missing keys
    const defaults = ConfigurationUtils.getDefaults();
    const mergedConfig = { ...defaults, ...configObject };

    logger?.info({
      requestId: req.requestId,
      userId,
      configKeys: Object.keys(configObject),
      action: 'get_user_config'
    }, 'User configuration retrieved');

    res.status(200).json(mergedConfig);
  } catch (error) {
    logger?.error({
      requestId: req.requestId,
      userId,
      error: error instanceof Error ? error.message : 'Unknown error',
      action: 'get_user_config'
    }, 'Failed to get user configuration');

    res.status(500).json({
      error: 'INTERNAL_ERROR',
      message: 'Failed to retrieve configuration',
      requestId: req.requestId!,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * PATCH /api/v1/projects/config
 * Update user configuration
 */
projectsRouter.patch('/projects/config', async (req: AuthenticatedRequest, res: Response<Record<string, any> | ErrorResponse>) => {
  const logger = req.services?.get('logger');
  const db = req.services?.get('database') as Database.Database;
  const userId = req.user?.userId;

  try {
    if (!userId) {
      return res.status(401).json({
        error: 'UNAUTHORIZED',
        message: 'Authentication required',
        requestId: req.requestId!,
        timestamp: new Date().toISOString()
      });
    }

    // Validate request body
    const parseResult = UpdateConfigRequestSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'Invalid request parameters',
        requestId: req.requestId!,
        timestamp: new Date().toISOString(),
        details: parseResult.error.format()
      });
    }

    const updates = parseResult.data;
    const configRepo = new ConfigurationRepositoryImpl(db);

    // Validate each configuration key and value
    const updatedConfigs: Record<string, any> = {};
    for (const [key, value] of Object.entries(updates)) {
      if (!ConfigurationUtils.isValidKey(key)) {
        return res.status(400).json({
          error: 'VALIDATION_ERROR',
          message: `Invalid configuration key: ${key}`,
          requestId: req.requestId!,
          timestamp: new Date().toISOString()
        });
      }

      // Parse the JSON string value
      let parsedValue: any;
      try {
        parsedValue = JSON.parse(value);
      } catch {
        parsedValue = value; // Keep as string if not valid JSON
      }

      if (!ConfigurationUtils.validateValue(key as any, parsedValue)) {
        return res.status(400).json({
          error: 'VALIDATION_ERROR',
          message: `Invalid value for configuration key: ${key}`,
          requestId: req.requestId!,
          timestamp: new Date().toISOString()
        });
      }

      // Upsert configuration
      const stringValue = typeof parsedValue === 'string' ? parsedValue : JSON.stringify(parsedValue);
      const config = await configRepo.upsert(userId, key, stringValue);
      updatedConfigs[key] = ConfigurationUtils.parseValue(config);
    }

    // Log activity
    const activityRepo = new ActivityLogRepositoryImpl(db);
    await activityRepo.create(ActivityLogUtils.createLogEntry(
      userId,
      ACTION_TYPES.CONFIG_UPDATE,
      RESOURCE_TYPES.CONFIGURATION,
      'user_config',
      { updates: Object.keys(updates), values: updates },
      { ip: req.ip, userAgent: req.get('User-Agent') }
    ));

    logger?.info({
      requestId: req.requestId,
      userId,
      updatedKeys: Object.keys(updates),
      action: 'update_user_config'
    }, 'User configuration updated');

    res.status(200).json(updatedConfigs);
  } catch (error) {
    logger?.error({
      requestId: req.requestId,
      userId,
      error: error instanceof Error ? error.message : 'Unknown error',
      action: 'update_user_config'
    }, 'Failed to update user configuration');

    res.status(500).json({
      error: 'INTERNAL_ERROR',
      message: 'Failed to update configuration',
      requestId: req.requestId!,
      timestamp: new Date().toISOString()
    });
  }
});

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
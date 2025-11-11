import { Router } from 'express';
import type { Response } from 'express';
import type { Logger } from 'pino';
import { z } from 'zod';

import type { AuthenticatedRequest } from '../middleware/auth.js';
import {
  TemplateCatalogError,
  TemplateCatalogService,
  type TemplateSummary,
  type TemplateVersionDetails,
} from '../services/template-catalog.service.js';
import {
  TemplateValidationDecisionActionSchema,
  TemplateValidationDecisionSchema,
  type DocumentRepositoryImpl,
  type ProjectRepositoryImpl,
  type TemplateValidationDecisionRepository,
} from '@ctrl-freaq/shared-data';
import { ProjectAccessError, requireProjectAccess } from './helpers/project-access.js';

const PublishTemplateVersionSchema = z.object({
  version: z.string().min(1, 'Version is required'),
  templateYaml: z.string().min(1, 'Template YAML is required'),
  changelog: z.string().optional(),
  publish: z.boolean().optional(),
});

const ProjectTemplateDecisionParamsSchema = z.object({
  projectId: z.string().uuid('Project id must be a valid UUID'),
  templateId: z.string().min(1, 'templateId is required'),
});

const TemplateDecisionRequestSchema = z.object({
  documentId: z.string().uuid('documentId must be a valid UUID'),
  action: TemplateValidationDecisionActionSchema,
  currentVersion: z.string().min(1, 'currentVersion is required'),
  requestedVersion: z.string().min(1, 'requestedVersion is required'),
  notes: z.string().optional(),
  payload: z.unknown().optional(),
});

export const templatesRouter: Router = Router();

function getTemplateCatalogService(req: AuthenticatedRequest): TemplateCatalogService {
  return req.services.get('templateCatalogService') as TemplateCatalogService;
}

function getLogger(req: AuthenticatedRequest): Logger | undefined {
  return req.services?.get('logger') as Logger | undefined;
}

function ensureTemplateManagerPermission(
  req: AuthenticatedRequest,
  res: Response,
  action: 'publish' | 'activate'
): string | null {
  const userId = req.user?.userId;
  if (!userId) {
    res.status(403).json({
      error: 'FORBIDDEN',
      message: `Template ${action} requires authentication`,
      timestamp: new Date().toISOString(),
    });
    return null;
  }

  const permissions = req.auth?.orgPermissions ?? [];
  if (!permissions.includes('templates:manage')) {
    getLogger(req)?.warn(
      {
        requestId: req.requestId,
        userId,
        requiredPermission: 'templates:manage',
        action,
      },
      'Template manager permission required'
    );

    res.status(403).json({
      error: 'FORBIDDEN',
      message: 'templates:manage permission required to manage template versions',
      timestamp: new Date().toISOString(),
    });
    return null;
  }

  return userId;
}

function formatTemplateSummary(summary: TemplateSummary) {
  const { template, activeVersion } = summary;
  return {
    id: template.id,
    name: template.name,
    description: template.description,
    documentType: template.documentType,
    status: template.status,
    activeVersion: activeVersion?.version ?? null,
    activeVersionMetadata: activeVersion
      ? {
          version: activeVersion.version,
          schemaHash: activeVersion.schemaHash,
          status: activeVersion.status,
          changelog: activeVersion.changelog ?? null,
          sections: activeVersion.sectionsJson,
        }
      : null,
    createdAt: template.createdAt.toISOString(),
    updatedAt: template.updatedAt.toISOString(),
  };
}

function formatVersion(details: TemplateVersionDetails['version']) {
  return {
    id: details.id,
    version: details.version,
    status: details.status,
    changelog: details.changelog ?? null,
    schemaHash: details.schemaHash,
    sections: details.sectionsJson,
    schema: details.schemaJson,
    createdAt: details.createdAt.toISOString(),
    updatedAt: details.updatedAt.toISOString(),
    publishedAt: details.publishedAt ? details.publishedAt.toISOString() : null,
    publishedBy: details.publishedBy ?? null,
  };
}

function isTemplateCatalogError(error: unknown): error is TemplateCatalogError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'statusCode' in error &&
    typeof (error as TemplateCatalogError).statusCode === 'number'
  );
}

function handleTemplateCatalogError(error: unknown, res: Response, logger?: Logger) {
  if (isTemplateCatalogError(error)) {
    if (error.statusCode >= 500) {
      logger?.error({ error: error.message }, 'Template catalog error');
    }
    const issues =
      error.details && typeof error.details === 'object' && error.details !== null
        ? (error.details as { issues?: unknown }).issues
        : undefined;
    res.status(error.statusCode).json({
      error: 'TEMPLATE_ERROR',
      message: error.message,
      details: error.details,
      issues,
      timestamp: new Date().toISOString(),
    });
    return true;
  }
  return false;
}

templatesRouter.get('/templates', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const catalog = await getTemplateCatalogService(req).listTemplates();
    res.status(200).json({ templates: catalog.map(formatTemplateSummary) });
  } catch (error) {
    if (!handleTemplateCatalogError(error, res, getLogger(req))) {
      getLogger(req)?.error(
        { error: error instanceof Error ? error.message : error },
        'Failed to list templates'
      );
      res.status(500).json({
        error: 'INTERNAL_ERROR',
        message: 'Failed to list templates',
        timestamp: new Date().toISOString(),
      });
    }
  }
});

templatesRouter.get('/templates/:templateId', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { templateId } = req.params as { templateId: string };
    const summary = await getTemplateCatalogService(req).getTemplateDetails(templateId);
    res.status(200).json({ template: formatTemplateSummary(summary) });
  } catch (error) {
    if (!handleTemplateCatalogError(error, res, getLogger(req))) {
      const { templateId } = req.params as { templateId: string };
      getLogger(req)?.error(
        { error: error instanceof Error ? error.message : error, templateId },
        'Failed to load template'
      );
      res.status(500).json({
        error: 'INTERNAL_ERROR',
        message: 'Failed to load template',
        timestamp: new Date().toISOString(),
      });
    }
  }
});

templatesRouter.get(
  '/templates/:templateId/versions',
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { templateId } = req.params as { templateId: string };
      const versions = await getTemplateCatalogService(req).listVersions(templateId);
      res.status(200).json({
        versions: versions.map(version => ({
          id: version.id,
          version: version.version,
          status: version.status,
          changelog: version.changelog ?? null,
          schemaHash: version.schemaHash,
          sections: version.sectionsJson,
          createdAt: version.createdAt.toISOString(),
          updatedAt: version.updatedAt.toISOString(),
        })),
      });
    } catch (error) {
      if (!handleTemplateCatalogError(error, res, getLogger(req))) {
        const { templateId } = req.params as { templateId: string };
        getLogger(req)?.error(
          { error: error instanceof Error ? error.message : error, templateId },
          'Failed to list template versions'
        );
        res.status(500).json({
          error: 'INTERNAL_ERROR',
          message: 'Failed to list template versions',
          timestamp: new Date().toISOString(),
        });
      }
    }
  }
);

templatesRouter.get(
  '/templates/:templateId/versions/:version',
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { templateId, version } = req.params as { templateId: string; version: string };
      const details = await getTemplateCatalogService(req).getVersion(templateId, version);
      res.status(200).json({ version: formatVersion(details.version) });
    } catch (error) {
      if (!handleTemplateCatalogError(error, res, getLogger(req))) {
        const { templateId, version } = req.params as { templateId: string; version: string };
        getLogger(req)?.error(
          { error: error instanceof Error ? error.message : error, templateId, version },
          'Failed to load template version'
        );
        res.status(500).json({
          error: 'INTERNAL_ERROR',
          message: 'Failed to load template version',
          timestamp: new Date().toISOString(),
        });
      }
    }
  }
);

templatesRouter.post(
  '/templates/:templateId/versions',
  async (req: AuthenticatedRequest, res: Response) => {
    const parseResult = PublishTemplateVersionSchema.safeParse(req.body);
    if (!parseResult.success) {
      getLogger(req)?.warn(
        { issues: parseResult.error.format(), requestId: req.requestId },
        'Publish template payload validation failed'
      );
      res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'Invalid template publish payload',
        issues: parseResult.error.format(),
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const userId = ensureTemplateManagerPermission(req, res, 'publish');
    if (!userId) {
      return;
    }

    try {
      const { templateId } = req.params as { templateId: string };
      const catalogService = getTemplateCatalogService(req);
      const details = await catalogService.publishVersion({
        templateId,
        requestedVersion: parseResult.data.version,
        templateYaml: parseResult.data.templateYaml,
        changelog: parseResult.data.changelog ?? null,
        autoActivate: parseResult.data.publish ?? false,
        userId,
      });

      const summary = await catalogService.getTemplateDetails(templateId);

      res.status(201).json({
        template: formatTemplateSummary(summary),
        version: formatVersion(details.version),
      });
    } catch (error) {
      if (!handleTemplateCatalogError(error, res, getLogger(req))) {
        const { templateId } = req.params as { templateId: string };
        getLogger(req)?.error(
          {
            error: error instanceof Error ? error.message : error,
            templateId,
            version: parseResult.data.version,
          },
          'Failed to publish template version'
        );
        res.status(500).json({
          error: 'INTERNAL_ERROR',
          message: 'Failed to publish template version',
          timestamp: new Date().toISOString(),
        });
      }
    }
  }
);

templatesRouter.post(
  '/templates/:templateId/versions/:version/activate',
  async (req: AuthenticatedRequest, res: Response) => {
    const userId = ensureTemplateManagerPermission(req, res, 'activate');
    if (!userId) {
      return;
    }

    try {
      const { templateId, version } = req.params as { templateId: string; version: string };
      await getTemplateCatalogService(req).activateVersion({
        templateId,
        version,
        userId,
      });
      res.status(204).send();
    } catch (error) {
      if (!handleTemplateCatalogError(error, res, getLogger(req))) {
        const { templateId, version } = req.params as { templateId: string; version: string };
        getLogger(req)?.error(
          { error: error instanceof Error ? error.message : error, templateId, version },
          'Failed to activate template version'
        );
        res.status(500).json({
          error: 'INTERNAL_ERROR',
          message: 'Failed to activate template version',
          timestamp: new Date().toISOString(),
        });
      }
    }
  }
);

templatesRouter.post(
  '/projects/:projectId/templates/:templateId/decisions',
  async (req: AuthenticatedRequest, res: Response) => {
    const logger = getLogger(req);
    const requestId = req.requestId ?? 'unknown';
    const timestamp = new Date().toISOString();

    const projectRepository = req.services?.get('projectRepository') as
      | ProjectRepositoryImpl
      | undefined;
    const documentRepository = req.services?.get('documentRepository') as
      | DocumentRepositoryImpl
      | undefined;
    const decisionRepository = req.services?.get('templateValidationDecisionRepository') as
      | TemplateValidationDecisionRepository
      | undefined;

    if (!projectRepository || !documentRepository || !decisionRepository) {
      logger?.error(
        {
          requestId,
          hasProjectRepository: Boolean(projectRepository),
          hasDecisionRepository: Boolean(decisionRepository),
        },
        'Template decision dependencies unavailable'
      );
      res.status(500).json({
        error: 'SERVICE_UNAVAILABLE',
        message: 'Template decision dependencies unavailable',
        requestId,
        timestamp,
      });
      return;
    }

    const paramsResult = ProjectTemplateDecisionParamsSchema.safeParse(req.params);
    if (!paramsResult.success) {
      const [issue] = paramsResult.error.issues;
      res.status(400).json({
        error: 'BAD_REQUEST',
        message: issue?.message ?? 'Invalid request parameters',
        requestId,
        timestamp,
        issues: paramsResult.error.format(),
      });
      return;
    }

    const bodyResult = TemplateDecisionRequestSchema.safeParse(req.body);
    if (!bodyResult.success) {
      const [issue] = bodyResult.error.issues;
      res.status(400).json({
        error: 'BAD_REQUEST',
        message: issue?.message ?? 'Invalid request payload',
        requestId,
        timestamp,
        issues: bodyResult.error.format(),
      });
      return;
    }

    const userId = req.user?.userId ?? req.auth?.userId;

    const { projectId, templateId } = paramsResult.data;
    const input = bodyResult.data;

    try {
      await requireProjectAccess({
        projectRepository,
        projectId,
        userId,
        requestId,
        logger,
      });

      const document = await documentRepository.findById(input.documentId);
      if (!document || document.projectId !== projectId) {
        res.status(404).json({
          error: 'DOCUMENT_NOT_FOUND',
          message: `Document not found for project: ${input.documentId}`,
          requestId,
          timestamp,
        });
        return;
      }

      if (document.templateId !== templateId) {
        res.status(400).json({
          error: 'TEMPLATE_MISMATCH',
          message: 'Document does not reference the requested template',
          requestId,
          timestamp,
        });
        return;
      }

      const decision = await decisionRepository.recordDecision({
        projectId,
        documentId: input.documentId,
        templateId,
        currentVersion: input.currentVersion,
        requestedVersion: input.requestedVersion,
        action: input.action,
        notes: input.notes ?? null,
        submittedBy: userId,
        submittedAt: new Date(),
        payload: input.payload ?? null,
      });

      const payload = TemplateValidationDecisionSchema.parse({
        decisionId: decision.id,
        action: decision.action,
        templateId: decision.templateId,
        currentVersion: decision.currentVersion,
        requestedVersion: decision.requestedVersion,
        submittedAt: decision.submittedAt.toISOString(),
        submittedBy: decision.submittedBy ?? undefined,
        notes: decision.notes ?? null,
      });

      logger?.info(
        {
          requestId,
          projectId,
          documentId: input.documentId,
          decisionId: decision.id,
          action: decision.action,
        },
        'Template validation decision recorded'
      );

      res.status(201).json(payload);
    } catch (error) {
      if (error instanceof ProjectAccessError) {
        res.status(error.status).json({
          error: error.code,
          message: error.message,
          requestId,
          timestamp,
        });
        return;
      }
      logger?.error(
        {
          requestId,
          projectId,
          documentId: input.documentId,
          error: error instanceof Error ? error.message : String(error),
        },
        'Failed to record template validation decision'
      );
      res.status(500).json({
        error: 'INTERNAL_ERROR',
        message: 'Failed to persist template validation decision',
        requestId,
        timestamp: new Date().toISOString(),
      });
    }
  }
);

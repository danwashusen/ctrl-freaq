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

const PublishTemplateVersionSchema = z.object({
  version: z.string().min(1, 'Version is required'),
  templateYaml: z.string().min(1, 'Template YAML is required'),
  changelog: z.string().optional(),
  publish: z.boolean().optional(),
});

export const templatesRouter: Router = Router();

function getTemplateCatalogService(req: AuthenticatedRequest): TemplateCatalogService {
  return req.services.get('templateCatalogService') as TemplateCatalogService;
}

function getLogger(req: AuthenticatedRequest): Logger | undefined {
  return req.services?.get('logger') as Logger | undefined;
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

    const userId = req.user?.userId;
    if (!userId) {
      res.status(403).json({
        error: 'FORBIDDEN',
        message: 'Template publish requires authentication',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    try {
      const { templateId } = req.params as { templateId: string };
      const details = await getTemplateCatalogService(req).publishVersion({
        templateId,
        requestedVersion: parseResult.data.version,
        templateYaml: parseResult.data.templateYaml,
        changelog: parseResult.data.changelog ?? null,
        autoActivate: parseResult.data.publish ?? false,
        userId,
      });

      const templateSummary = formatTemplateSummary({
        template: details.template,
        activeVersion:
          details.template.activeVersionId === details.version.id ? details.version : null,
      });

      res.status(201).json({
        template: templateSummary,
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
    const userId = req.user?.userId;
    if (!userId) {
      res.status(403).json({
        error: 'FORBIDDEN',
        message: 'Template activation requires authentication',
        timestamp: new Date().toISOString(),
      });
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

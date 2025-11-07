import { Router } from 'express';
import { logDraftComplianceWarning } from '@ctrl-freaq/qa';
import type { Response } from 'express';
import type { Logger } from 'pino';
import { randomUUID } from 'crypto';
import { z } from 'zod';

import type {
  Document,
  DocumentTemplateMigration,
  ProjectRepositoryImpl,
} from '@ctrl-freaq/shared-data';

import type { AuthenticatedRequest } from '../middleware/auth.js';
import {
  createTemplateValidationMiddleware,
  type TemplateValidationLocals,
} from '../middleware/template-validation.js';
import {
  DraftBundleService,
  DraftBundleValidationError,
} from '../services/drafts/draft-bundle.service.js';
import type { ProjectDocumentDiscoveryService } from '../services/document-workflows/project-document-discovery.service.js';
import { serializePrimaryDocumentSnapshot } from './serializers/project-document.serializer.js';
import {
  DocumentProvisioningService,
  DocumentProvisioningError,
  ProjectNotFoundError,
  TemplateProvisioningError,
} from '../services/document-provisioning.service.js';
import { ProjectAccessError, requireProjectAccess } from './helpers/project-access.js';

export const documentsRouter: Router = Router();

const templateValidation = createTemplateValidationMiddleware();

const DraftSectionSchema = z.object({
  draftKey: z.string().min(1),
  sectionPath: z.string().min(1),
  patch: z.string(),
  baselineVersion: z.string().min(1),
  qualityGateReport: z.object({
    status: z.enum(['pass', 'fail']),
    issues: z
      .array(
        z.object({
          gateId: z.string().min(1),
          severity: z.enum(['blocker', 'warning']),
          message: z.string().min(1),
        })
      )
      .default([]),
  }),
});

const DraftBundleBodySchema = z.object({
  submittedBy: z.string().min(1),
  sections: z.array(DraftSectionSchema).min(1),
});

const ProjectIdParamSchema = z.object({
  projectId: z.string().min(1, 'projectId is required'),
});

const CreateDocumentRequestSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(1, 'title must include at least one character')
      .max(200, 'title must be shorter than 200 characters')
      .optional(),
    templateId: z.string().trim().min(1).optional(),
    templateVersion: z.string().trim().min(1).optional(),
    seedStrategy: z.enum(['authoritative', 'empty', 'fixture']).optional(),
  })
  .optional();

const sendErrorResponse = (
  res: Response,
  status: number,
  code: string,
  message: string,
  requestId?: string,
  details?: unknown
) => {
  res.status(status).json({
    code,
    message,
    requestId: requestId ?? 'unknown',
    timestamp: new Date().toISOString(),
    details,
  });
};

function serializeDocument(document: Document) {
  return {
    id: document.id,
    projectId: document.projectId,
    title: document.title,
    content: document.content,
    templateId: document.templateId,
    templateVersion: document.templateVersion,
    templateSchemaHash: document.templateSchemaHash,
    createdAt: document.createdAt.toISOString(),
    createdBy: document.createdBy,
    updatedAt: document.updatedAt.toISOString(),
    updatedBy: document.updatedBy,
    deletedAt: document.deletedAt ? document.deletedAt.toISOString() : null,
    deletedBy: document.deletedBy ?? null,
  };
}

function serializeMigration(migration: DocumentTemplateMigration) {
  return {
    id: migration.id,
    documentId: migration.documentId,
    fromVersion: migration.fromVersion,
    toVersion: migration.toVersion,
    status: migration.status,
    validationErrors: migration.validationErrors ?? null,
    initiatedBy: migration.initiatedBy,
    initiatedAt: migration.initiatedAt.toISOString(),
    completedAt: migration.completedAt ? migration.completedAt.toISOString() : null,
  };
}

documentsRouter.get(
  '/projects/:projectId/documents/primary',
  async (req: AuthenticatedRequest, res: Response) => {
    const logger = req.services?.get('logger') as Logger | undefined;
    const projectRepository = req.services?.get('projectRepository') as
      | ProjectRepositoryImpl
      | undefined;
    const discoveryService = req.services?.get('projectDocumentDiscoveryService') as
      | ProjectDocumentDiscoveryService
      | undefined;

    const requestId = req.requestId ?? 'unknown';

    const paramsResult = ProjectIdParamSchema.safeParse(req.params);
    if (!paramsResult.success) {
      const [issue] = paramsResult.error.issues;
      sendErrorResponse(
        res,
        400,
        'BAD_REQUEST',
        issue?.message ?? 'Invalid project identifier',
        requestId,
        { issues: paramsResult.error.issues }
      );
      return;
    }

    const projectId = paramsResult.data.projectId;
    const authenticatedUser = req.auth?.userId ?? req.user?.userId;

    if (!projectRepository || !discoveryService) {
      logger?.error(
        {
          requestId,
          projectId,
          hasProjectRepository: Boolean(projectRepository),
          hasDiscoveryService: Boolean(discoveryService),
        },
        'Project discovery dependencies unavailable'
      );
      sendErrorResponse(
        res,
        500,
        'INTERNAL_ERROR',
        'Project discovery dependencies unavailable',
        requestId
      );
      return;
    }

    try {
      await requireProjectAccess({
        projectRepository,
        projectId,
        userId: authenticatedUser,
        requestId,
        logger,
      });
    } catch (error) {
      if (error instanceof ProjectAccessError) {
        sendErrorResponse(res, error.status, error.code, error.message, requestId);
        return;
      }
      throw error;
    }

    try {
      const snapshot = await discoveryService.fetchPrimaryDocumentSnapshot(projectId);
      res.status(200).json(serializePrimaryDocumentSnapshot(snapshot));
    } catch (error) {
      logger?.error(
        {
          requestId,
          projectId,
          error: error instanceof Error ? error.message : String(error),
        },
        'Failed to fetch primary project document snapshot'
      );
      sendErrorResponse(
        res,
        503,
        'PROJECT_DOCUMENT_UNAVAILABLE',
        'Primary document snapshot unavailable',
        requestId
      );
    }
  }
);

documentsRouter.post(
  '/projects/:projectId/documents',
  async (req: AuthenticatedRequest, res: Response) => {
    const logger = req.services?.get('logger') as Logger | undefined;
    const provisioningService = req.services?.get('documentProvisioningService') as
      | DocumentProvisioningService
      | undefined;
    const projectRepository = req.services?.get('projectRepository') as
      | ProjectRepositoryImpl
      | undefined;
    const requestId = req.requestId ?? 'unknown';

    if (!provisioningService || !projectRepository) {
      sendErrorResponse(
        res,
        500,
        'SERVICE_UNAVAILABLE',
        'Document provisioning dependencies are not available',
        requestId
      );
      return;
    }

    const paramsResult = ProjectIdParamSchema.safeParse(req.params);
    if (!paramsResult.success) {
      const [issue] = paramsResult.error.issues;
      sendErrorResponse(
        res,
        400,
        'BAD_REQUEST',
        issue?.message ?? 'Invalid project identifier',
        requestId
      );
      return;
    }

    const projectId = paramsResult.data.projectId.trim();

    const bodyResult = CreateDocumentRequestSchema.safeParse(req.body);
    if (!bodyResult.success) {
      const [issue] = bodyResult.error.issues;
      sendErrorResponse(
        res,
        400,
        'BAD_REQUEST',
        issue?.message ?? 'Invalid request payload',
        requestId
      );
      return;
    }

    const userId = req.user?.userId ?? req.auth?.userId ?? null;
    const overrides = bodyResult.data ?? undefined;

    try {
      const project = await requireProjectAccess({
        projectRepository,
        projectId,
        userId,
        requestId,
        logger,
      });

      const result = await provisioningService.provisionPrimaryDocument({
        projectId,
        requestedBy: userId ?? project.ownerUserId,
        title: overrides?.title,
        templateId: overrides?.templateId,
        templateVersion: overrides?.templateVersion,
        seedStrategy: overrides?.seedStrategy,
      });

      const statusCode = result.status === 'created' ? 201 : 200;
      res.status(statusCode).json({
        status: result.status,
        documentId: result.documentId,
        projectId: result.projectId,
        firstSectionId: result.firstSectionId,
        lifecycleStatus: result.lifecycleStatus,
        title: result.title,
        template: result.template,
        lastModifiedAt: result.lastModifiedAt,
      });
    } catch (error) {
      if (error instanceof ProjectAccessError) {
        sendErrorResponse(res, error.status, error.code, error.message, requestId);
        return;
      }
      if (error instanceof ProjectNotFoundError) {
        sendErrorResponse(res, 404, 'PROJECT_NOT_FOUND', error.message, requestId);
        return;
      }
      if (error instanceof TemplateProvisioningError) {
        logger?.error(
          {
            requestId,
            projectId,
            error: error.message,
          },
          'Template provisioning failed during document creation'
        );
        sendErrorResponse(res, 503, 'TEMPLATE_UNAVAILABLE', error.message, requestId);
        return;
      }
      if (error instanceof DocumentProvisioningError) {
        logger?.error(
          {
            requestId,
            projectId,
            error: error.message,
          },
          'Document provisioning failed'
        );
        sendErrorResponse(res, 500, 'DOCUMENT_PROVISIONING_FAILED', error.message, requestId);
        return;
      }

      logger?.error(
        {
          requestId,
          projectId,
          error: error instanceof Error ? error.message : String(error),
        },
        'Unexpected failure provisioning project document'
      );
      sendErrorResponse(res, 500, 'INTERNAL_ERROR', 'Failed to provision document', requestId);
    }
  }
);

documentsRouter.get(
  '/documents/:documentId',
  templateValidation,
  async (req: AuthenticatedRequest, res: Response) => {
    const logger = req.services?.get('logger') as Logger | undefined;
    const locals = res.locals as TemplateValidationLocals;
    const document = locals.document;
    const requestId = req.requestId ?? 'unknown';

    if (!document) {
      logger?.error(
        {
          requestId,
          documentId: (req.params as { documentId?: string }).documentId,
        },
        'Document missing from template validation context'
      );

      res.status(500).json({
        error: 'INTERNAL_ERROR',
        message: 'Document context unavailable after validation',
        requestId,
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const projectRepository = req.services?.get('projectRepository') as
      | ProjectRepositoryImpl
      | undefined;
    if (!projectRepository) {
      logger?.error(
        {
          requestId,
          documentId: document.id,
        },
        'Project repository unavailable for document authorization check'
      );
      sendErrorResponse(res, 500, 'INTERNAL_ERROR', 'Project repository unavailable', requestId);
      return;
    }

    const authenticatedUser = req.auth?.userId ?? req.user?.userId ?? null;
    try {
      await requireProjectAccess({
        projectRepository,
        projectId: document.projectId,
        userId: authenticatedUser,
        requestId,
        logger,
      });
    } catch (error) {
      if (error instanceof ProjectAccessError) {
        sendErrorResponse(res, error.status, error.code, error.message, requestId);
        return;
      }
      throw error;
    }

    const migration = locals.templateMigration;
    const decision = locals.templateDecision;

    logger?.info(
      {
        requestId,
        documentId: document.id,
        templateId: document.templateId,
        templateVersion: document.templateVersion,
        decision: decision?.action ?? 'noop',
      },
      'Document loaded successfully'
    );

    res.status(200).json({
      document: serializeDocument(document),
      migration: migration ? serializeMigration(migration) : null,
      templateDecision: decision,
    });
  }
);

documentsRouter.patch(
  '/projects/:projectSlug/documents/:documentId/draft-bundle',
  async (req: AuthenticatedRequest, res: Response) => {
    const logger = req.services?.get('logger') as Logger | undefined;
    const service = req.services?.get('draftBundleService') as DraftBundleService | undefined;
    const requestId = req.requestId ?? 'unknown';
    const { projectSlug, documentId } = req.params as {
      projectSlug?: string;
      documentId?: string;
    };

    if (!projectSlug || !documentId) {
      sendErrorResponse(
        res,
        400,
        'BAD_REQUEST',
        'projectSlug and documentId are required',
        requestId
      );
      return;
    }

    if (!service) {
      sendErrorResponse(res, 500, 'INTERNAL_ERROR', 'Draft bundle service unavailable', requestId);
      return;
    }

    const parsedBody = DraftBundleBodySchema.safeParse(req.body);
    if (!parsedBody.success) {
      sendErrorResponse(res, 400, 'BAD_REQUEST', 'Invalid draft bundle payload', requestId, {
        issues: parsedBody.error.issues,
      });
      return;
    }

    const authenticatedUserId = req.auth?.userId ?? req.user?.userId;

    if (!authenticatedUserId) {
      sendErrorResponse(res, 401, 'UNAUTHORIZED', 'Authentication required', requestId);
      return;
    }

    const submittedBy = parsedBody.data.submittedBy.trim();
    if (submittedBy && submittedBy !== authenticatedUserId) {
      logger?.warn(
        {
          requestId,
          projectSlug,
          documentId,
          authenticatedUserId,
          submittedBy,
        },
        'Draft bundle author mismatch detected'
      );
      sendErrorResponse(
        res,
        403,
        'FORBIDDEN',
        'Authenticated user mismatch for draft bundle',
        requestId
      );
      return;
    }

    try {
      const result = await service.applyBundle({
        projectSlug,
        documentId,
        submittedBy: authenticatedUserId,
        sections: parsedBody.data.sections,
      });

      res.status(200).json(result);
    } catch (error) {
      if (error instanceof DraftBundleValidationError) {
        logger?.warn(
          {
            requestId,
            projectSlug,
            documentId,
            conflicts: error.conflicts,
          },
          'Draft bundle rejected'
        );
        res.status(409).json({
          documentId,
          conflicts: error.conflicts,
        });
        return;
      }

      logger?.error(
        {
          requestId,
          projectSlug,
          documentId,
          error: error instanceof Error ? error.message : String(error),
        },
        'Draft bundle processing failed'
      );
      sendErrorResponse(res, 500, 'INTERNAL_ERROR', 'Failed to process draft bundle', requestId);
    }
  }
);

documentsRouter.post(
  '/projects/:projectSlug/documents/:documentId/draft-compliance',
  async (req: AuthenticatedRequest, res: Response) => {
    const logger = req.services?.get('logger') as Logger | undefined;
    const requestId = req.requestId ?? 'unknown';
    const { projectSlug, documentId } = req.params as {
      projectSlug?: string;
      documentId?: string;
    };

    if (!projectSlug || !documentId) {
      sendErrorResponse(
        res,
        400,
        'BAD_REQUEST',
        'projectSlug and documentId are required',
        requestId
      );
      return;
    }

    const body = (req.body ?? {}) as Record<string, unknown>;
    const authenticatedUserId = req.auth?.userId ?? req.user?.userId;
    const authorId = typeof body.authorId === 'string' ? body.authorId.trim() : '';
    const policyId = typeof body.policyId === 'string' ? body.policyId.trim() : '';
    const detectedAtValue = typeof body.detectedAt === 'string' ? body.detectedAt : '';
    const context =
      (body.context && typeof body.context === 'object'
        ? (body.context as Record<string, string>)
        : undefined) ?? {};

    if (!authenticatedUserId) {
      sendErrorResponse(res, 401, 'UNAUTHORIZED', 'Authentication required', requestId);
      return;
    }

    if (authorId && authorId !== authenticatedUserId) {
      logger?.warn(
        {
          requestId,
          projectSlug,
          documentId,
          authenticatedUserId,
          authorId,
        },
        'Draft compliance author mismatch detected'
      );
      sendErrorResponse(
        res,
        403,
        'FORBIDDEN',
        'Authenticated user mismatch for compliance warning',
        requestId
      );
      return;
    }

    if (!policyId || !detectedAtValue) {
      sendErrorResponse(res, 400, 'BAD_REQUEST', 'Invalid compliance payload', requestId);
      return;
    }

    const detectedAt = new Date(detectedAtValue);
    if (Number.isNaN(detectedAt.getTime())) {
      sendErrorResponse(
        res,
        400,
        'BAD_REQUEST',
        'detectedAt must be a valid ISO timestamp',
        requestId
      );
      return;
    }

    const normalizedContext: Record<string, string> =
      context && typeof context === 'object'
        ? Object.fromEntries(
            Object.entries(context as Record<string, unknown>).map(([key, value]) => [
              key,
              String(value),
            ])
          )
        : {};

    if (logger) {
      logDraftComplianceWarning(
        {
          warn(payload, message) {
            logger.warn(payload, message);
          },
        },
        {
          projectSlug,
          documentSlug: documentId,
          authorId: authenticatedUserId,
          policyId,
          detectedAt,
          context: normalizedContext,
        }
      );
    }

    const warningId = `draft-compliance-${randomUUID()}`;

    res.status(202).json({
      status: 'queued',
      warningId,
    });
  }
);

export default documentsRouter;

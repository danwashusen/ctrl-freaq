import { Router } from 'express';
import { logDraftComplianceWarning } from '@ctrl-freaq/qa';
import type { Response } from 'express';
import type { Logger } from 'pino';
import { randomUUID } from 'crypto';
import { z } from 'zod';

import type { Document, DocumentTemplateMigration } from '@ctrl-freaq/shared-data';

import type { AuthenticatedRequest } from '../middleware/auth.js';
import {
  createTemplateValidationMiddleware,
  type TemplateValidationLocals,
} from '../middleware/template-validation.js';
import {
  DraftBundleService,
  DraftBundleValidationError,
} from '../services/drafts/draft-bundle.service.js';

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
  '/documents/:documentId',
  templateValidation,
  async (req: AuthenticatedRequest, res: Response) => {
    const logger = req.services?.get('logger') as Logger | undefined;
    const locals = res.locals as TemplateValidationLocals;
    const document = locals.document;

    if (!document) {
      logger?.error(
        {
          requestId: req.requestId,
          documentId: (req.params as { documentId?: string }).documentId,
        },
        'Document missing from template validation context'
      );

      res.status(500).json({
        error: 'INTERNAL_ERROR',
        message: 'Document context unavailable after validation',
        requestId: req.requestId ?? 'unknown',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const migration = locals.templateMigration;
    const decision = locals.templateDecision;

    logger?.info(
      {
        requestId: req.requestId,
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

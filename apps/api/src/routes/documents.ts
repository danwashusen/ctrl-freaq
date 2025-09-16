import { Router } from 'express';
import type { Response } from 'express';
import type { Logger } from 'pino';

import type { Document, DocumentTemplateMigration } from '@ctrl-freaq/shared-data';

import type { AuthenticatedRequest } from '../middleware/auth.js';
import {
  createTemplateValidationMiddleware,
  type TemplateValidationLocals,
} from '../middleware/template-validation.js';

export const documentsRouter: Router = Router();

const templateValidation = createTemplateValidationMiddleware();

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

export default documentsRouter;

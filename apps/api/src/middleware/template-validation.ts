import type { NextFunction, Response } from 'express';
import type { Logger } from 'pino';

import type { AuthenticatedRequest } from './auth.js';
import {
  type DocumentTemplateMigration,
  type Document,
  type DocumentTemplate,
} from '@ctrl-freaq/shared-data';
import type { TemplateUpgradeDecision } from '@ctrl-freaq/template-resolver';
import {
  TemplateUpgradeError,
  TemplateUpgradeNotFoundError,
  TemplateUpgradeService,
  TemplateValidationFailedError,
} from '../services/template-upgrade.service.js';

export interface TemplateValidationContext {
  document: Document;
  template: DocumentTemplate;
  decision: TemplateUpgradeDecision;
  migration?: {
    status: 'succeeded' | 'failed';
    recordId: string;
  };
  migrationRecord?: unknown;
}

export interface TemplateValidationLocals {
  document: Document;
  templateDecision: TemplateUpgradeDecision;
  templateMigration?: DocumentTemplateMigration | null;
  template?: DocumentTemplate;
}

function getLogger(req: AuthenticatedRequest): Logger | undefined {
  try {
    return req.services?.get('logger') as Logger | undefined;
  } catch {
    return undefined;
  }
}

function buildBlockedResponse(
  req: AuthenticatedRequest,
  res: Response,
  decision: Extract<TemplateUpgradeDecision, { action: 'blocked' }>
): void {
  const payload = {
    error: 'TEMPLATE_VERSION_REMOVED',
    message: 'The referenced template version is no longer available for editing.',
    templateId: decision.requestedVersion.templateId,
    missingVersion: decision.requestedVersion.version,
    remediation:
      'Ask a template manager to republish or migrate this document to an available version before editing resumes.',
    requestId: req.requestId ?? 'unknown',
    timestamp: new Date().toISOString(),
  };
  res.status(409).json(payload);
}

export function createTemplateValidationMiddleware() {
  return async function templateValidationMiddleware(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) {
    const logger = getLogger(req);
    const services = req.services;

    if (!services) {
      logger?.error({ requestId: req.requestId }, 'Service container unavailable on request');
      res.status(500).json({
        error: 'INTERNAL_ERROR',
        message: 'Template validation requires service container context',
        requestId: req.requestId ?? 'unknown',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    let upgradeService: TemplateUpgradeService;
    try {
      upgradeService = services.get('templateUpgradeService') as TemplateUpgradeService;
    } catch (error) {
      logger?.error(
        {
          requestId: req.requestId,
          error: error instanceof Error ? error.message : error,
        },
        'Template upgrade service is not registered in the service locator'
      );
      res.status(500).json({
        error: 'INTERNAL_ERROR',
        message: 'Template upgrade service is unavailable',
        requestId: req.requestId ?? 'unknown',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const documentId = (req.params as { documentId?: string }).documentId ?? null;
    if (!documentId) {
      res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'Document id is required',
        requestId: req.requestId ?? 'unknown',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    try {
      const outcome = await upgradeService.evaluate({
        documentId,
        userId: req.user?.userId,
        requestId: req.requestId,
      });

      (res.locals as TemplateValidationLocals).document = outcome.document;
      (res.locals as TemplateValidationLocals).templateDecision = outcome.decision;
      (res.locals as TemplateValidationLocals).template = outcome.template;
      (res.locals as TemplateValidationLocals).templateMigration = outcome.migration ?? null;

      if (outcome.decision.action === 'blocked') {
        buildBlockedResponse(req, res, outcome.decision);
        return;
      }

      next();
    } catch (error) {
      if (error instanceof TemplateValidationFailedError) {
        res.status(error.statusCode).json({
          error: 'TEMPLATE_VALIDATION_FAILED',
          message: error.message,
          details: error.details,
          requestId: req.requestId ?? 'unknown',
          timestamp: new Date().toISOString(),
        });
        return;
      }

      if (error instanceof TemplateUpgradeNotFoundError) {
        res.status(error.statusCode).json({
          error: 'TEMPLATE_UPGRADE_NOT_FOUND',
          message: error.message,
          requestId: req.requestId ?? 'unknown',
          timestamp: new Date().toISOString(),
        });
        return;
      }

      if (error instanceof TemplateUpgradeError) {
        res.status(error.statusCode).json({
          error: 'TEMPLATE_UPGRADE_FAILED',
          message: error.message,
          details: error.details,
          requestId: req.requestId ?? 'unknown',
          timestamp: new Date().toISOString(),
        });
        return;
      }

      logger?.error(
        {
          requestId: req.requestId,
          documentId,
          error: error instanceof Error ? error.message : error,
        },
        'Template validation middleware encountered an unexpected error'
      );

      res.status(500).json({
        error: 'INTERNAL_ERROR',
        message: 'Template validation failed',
        requestId: req.requestId ?? 'unknown',
        timestamp: new Date().toISOString(),
      });
    }
  };
}

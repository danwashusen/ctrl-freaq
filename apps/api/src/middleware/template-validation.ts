import type { NextFunction, Response } from 'express';
import type { Logger } from 'pino';

import type { AuthenticatedRequest } from './auth.js';
import {
  DocumentTemplateMigrationStatus,
  type DocumentTemplateMigration,
  type Document,
  type DocumentTemplate,
  type DocumentTemplateMigrationRepositoryImpl,
  type DocumentTemplateRepositoryImpl,
  type DocumentRepositoryImpl,
  type TemplateVersion,
  TemplateVersionStatus,
  type TemplateVersionRepositoryImpl,
} from '@ctrl-freaq/shared-data';
import {
  evaluateTemplateUpgrade,
  type DocumentTemplateBinding,
  type TemplateResolver,
  type TemplateUpgradeDecision,
  type TemplateVersionSummary,
} from '@ctrl-freaq/template-resolver';

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

function normalizeSummaries(versions: TemplateVersion[]): TemplateVersionSummary[] {
  return versions.map(version => ({
    templateId: version.templateId,
    version: version.version,
    schemaHash: version.schemaHash,
    status:
      version.status === TemplateVersionStatus.ACTIVE
        ? 'active'
        : version.status === TemplateVersionStatus.DEPRECATED
          ? 'deprecated'
          : 'draft',
  }));
}

async function loadActiveVersion(
  template: DocumentTemplate,
  versions: TemplateVersion[],
  repository: TemplateVersionRepositoryImpl
): Promise<TemplateVersion | null> {
  if (template.activeVersionId) {
    const active = await repository.findById(template.activeVersionId);
    if (active) {
      return active;
    }
  }

  const fallback = versions.find(version => version.status === 'active');
  return fallback ?? null;
}

function mapBinding(document: Document): DocumentTemplateBinding {
  return {
    templateId: document.templateId,
    version: document.templateVersion,
    schemaHash: document.templateSchemaHash,
  };
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

function validateDocumentContent(
  templateRecord: Awaited<ReturnType<TemplateResolver['resolve']>>,
  document: Document
): { success: boolean; error?: unknown } {
  if (!templateRecord) {
    return { success: false, error: new Error('Template version could not be resolved') };
  }

  const validator = templateRecord.template.validator;
  if (!validator) {
    return { success: true };
  }

  if (typeof validator.safeParse === 'function') {
    const result = validator.safeParse(document.content) as {
      success: boolean;
      error?: unknown;
    };
    return result;
  }

  if (typeof validator.parse === 'function') {
    try {
      validator.parse(document.content);
      return { success: true };
    } catch (error) {
      return { success: false, error };
    }
  }

  return { success: true };
}

async function markMigrationFailure(
  repository: DocumentTemplateMigrationRepositoryImpl,
  migrationId: string,
  error: unknown
) {
  try {
    await repository.markFailed({
      migrationId,
      validationErrors:
        error && typeof error === 'object' && 'issues' in (error as Record<string, unknown>)
          ? (error as Record<string, unknown>).issues
          : error instanceof Error
            ? error.message
            : error,
    });
  } catch {
    // Swallow errors to avoid masking the original failure
  }
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

    let documentRepository: DocumentRepositoryImpl;
    let templateRepository: DocumentTemplateRepositoryImpl;
    let versionRepository: TemplateVersionRepositoryImpl;
    let migrationRepository: DocumentTemplateMigrationRepositoryImpl;
    let resolver: TemplateResolver;

    try {
      documentRepository = services.get('documentRepository') as DocumentRepositoryImpl;
      templateRepository = services.get('documentTemplateRepository') as DocumentTemplateRepositoryImpl;
      versionRepository = services.get('templateVersionRepository') as TemplateVersionRepositoryImpl;
      migrationRepository = services.get(
        'documentTemplateMigrationRepository'
      ) as DocumentTemplateMigrationRepositoryImpl;
      resolver = services.get('templateResolver') as TemplateResolver;
    } catch (error) {
      logger?.error(
        {
          requestId: req.requestId,
          error: error instanceof Error ? error.message : error,
        },
        'Failed to resolve template validation dependencies'
      );
      res.status(500).json({
        error: 'INTERNAL_ERROR',
        message: 'Template validation dependencies are not configured',
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
      const document = await documentRepository.findById(documentId);
      if (!document) {
        res.status(404).json({
          error: 'DOCUMENT_NOT_FOUND',
          message: `Document not found: ${documentId}`,
          requestId: req.requestId ?? 'unknown',
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const template = await templateRepository.findById(document.templateId);
      if (!template) {
        res.status(404).json({
          error: 'TEMPLATE_NOT_FOUND',
          message: `Template not found: ${document.templateId}`,
          requestId: req.requestId ?? 'unknown',
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const versions = await versionRepository.listByTemplate(document.templateId);
      const summaries = normalizeSummaries(versions);
      const activeVersion = await loadActiveVersion(template, versions, versionRepository);

      const decision = evaluateTemplateUpgrade({
        binding: mapBinding(document),
        availableVersions: summaries,
        activeVersion: activeVersion
          ? {
              templateId: activeVersion.templateId,
              version: activeVersion.version,
              schemaHash: activeVersion.schemaHash,
              status:
                activeVersion.status === TemplateVersionStatus.ACTIVE
                  ? 'active'
                  : activeVersion.status === TemplateVersionStatus.DEPRECATED
                    ? 'deprecated'
                    : 'draft',
            }
          : null,
      });

      (res.locals as TemplateValidationLocals).document = document;
      (res.locals as TemplateValidationLocals).templateDecision = decision;
      (res.locals as TemplateValidationLocals).template = template;

      if (decision.action === 'blocked') {
        logger?.warn(
          {
            requestId: req.requestId,
            documentId: document.id,
            templateId: decision.requestedVersion.templateId,
            version: decision.requestedVersion.version,
          },
          'Document editing blocked due to removed template version'
        );
        buildBlockedResponse(req, res, decision);
        return;
      }

      if (decision.action === 'noop') {
        logger?.info(
          {
            requestId: req.requestId,
            documentId: document.id,
            templateId: document.templateId,
            version: document.templateVersion,
          },
          'Template binding already up to date'
        );
        (res.locals as TemplateValidationLocals).templateMigration = null;
        next();
        return;
      }

      const initiatedBy = req.user?.userId ?? 'system_auto_upgrade';
      const targetVersion = decision.targetVersion;

      const pending = await migrationRepository.logPending({
        documentId: document.id,
        fromVersion: decision.currentVersion.version,
        toVersion: targetVersion.version,
        initiatedBy,
      });

      try {
        const resolved = await resolver.resolve({
          templateId: targetVersion.templateId,
          version: targetVersion.version,
          bypassCache: true,
        });

        const validation = validateDocumentContent(resolved, document);
        if (!validation.success) {
          await markMigrationFailure(migrationRepository, pending.id, validation.error);
          logger?.warn(
            {
              requestId: req.requestId,
              documentId: document.id,
              templateId: targetVersion.templateId,
              fromVersion: decision.currentVersion.version,
              toVersion: targetVersion.version,
              status: 'failed',
            },
            'Template auto-upgrade blocked due to validation failure'
          );
          res.status(422).json({
            error: 'TEMPLATE_VALIDATION_FAILED',
            message: 'Document content does not satisfy the target template schema',
            details: validation.error,
            requestId: req.requestId ?? 'unknown',
            timestamp: new Date().toISOString(),
          });
          return;
        }

        const schemaHash = resolved?.template.schemaHash ?? targetVersion.schemaHash;
        const updated = await documentRepository.updateTemplateBinding({
          documentId: document.id,
          templateId: targetVersion.templateId,
          templateVersion: targetVersion.version,
          templateSchemaHash: schemaHash,
          updatedBy: initiatedBy,
        });

        const completed = await migrationRepository.markSucceeded({ migrationId: pending.id });
        (res.locals as TemplateValidationLocals).document = updated;
        (res.locals as TemplateValidationLocals).templateMigration = completed;

        logger?.info(
          {
            requestId: req.requestId,
            documentId: document.id,
            templateId: targetVersion.templateId,
            fromVersion: decision.currentVersion.version,
            toVersion: targetVersion.version,
            status: DocumentTemplateMigrationStatus.SUCCEEDED,
          },
          'Document auto-upgraded to active template version'
        );

        next();
      } catch (error) {
        await markMigrationFailure(migrationRepository, pending.id, error);
        logger?.error(
          {
            requestId: req.requestId,
            documentId: document.id,
            templateId: targetVersion.templateId,
            fromVersion: decision.currentVersion.version,
            toVersion: targetVersion.version,
            error: error instanceof Error ? error.message : error,
          },
          'Template auto-upgrade failed'
        );

        res.status(500).json({
          error: 'TEMPLATE_UPGRADE_FAILED',
          message: 'Failed to upgrade document to active template version',
          requestId: req.requestId ?? 'unknown',
          timestamp: new Date().toISOString(),
        });
      }
    } catch (error) {
      logger?.error(
        {
          requestId: req.requestId,
          documentId,
          error: error instanceof Error ? error.message : error,
        },
        'Template validation middleware encountered an error'
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

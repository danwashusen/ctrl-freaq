import type { Logger } from 'pino';

import {
  DocumentTemplateMigrationStatus,
  type Document,
  type DocumentRepositoryImpl,
  type DocumentTemplate,
  type DocumentTemplateRepositoryImpl,
  type DocumentTemplateMigration,
  type DocumentTemplateMigrationRepositoryImpl,
  type TemplateVersion,
  type TemplateVersionRepositoryImpl,
  TemplateVersionStatus,
} from '@ctrl-freaq/shared-data';
import {
  evaluateTemplateUpgrade,
  type TemplateResolver,
  type TemplateUpgradeDecision,
  type TemplateResolverResult,
} from '@ctrl-freaq/template-resolver';

export interface TemplateUpgradeEvaluateOptions {
  documentId: string;
  userId?: string;
  requestId?: string;
}

export interface TemplateUpgradeOutcome {
  document: Document;
  template: DocumentTemplate;
  decision: TemplateUpgradeDecision;
  migration: DocumentTemplateMigration | null;
}

export class TemplateUpgradeError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number = 500,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = 'TemplateUpgradeError';
  }
}

export class TemplateUpgradeNotFoundError extends TemplateUpgradeError {
  constructor(message: string) {
    super(message, 404);
    this.name = 'TemplateUpgradeNotFoundError';
  }
}

export class TemplateValidationFailedError extends TemplateUpgradeError {
  constructor(message: string, details?: unknown) {
    super(message, 422, details);
    this.name = 'TemplateValidationFailedError';
  }
}

interface ValidationResult {
  success: boolean;
  error?: unknown;
}

export class TemplateUpgradeService {
  constructor(
    private readonly documents: DocumentRepositoryImpl,
    private readonly templates: DocumentTemplateRepositoryImpl,
    private readonly versions: TemplateVersionRepositoryImpl,
    private readonly migrations: DocumentTemplateMigrationRepositoryImpl,
    private readonly resolver: TemplateResolver,
    private readonly logger: Logger
  ) {}

  async evaluate(options: TemplateUpgradeEvaluateOptions): Promise<TemplateUpgradeOutcome> {
    const { documentId, userId, requestId } = options;

    const document = await this.documents.findById(documentId);
    if (!document) {
      throw new TemplateUpgradeNotFoundError(`Document not found: ${documentId}`);
    }

    const template = await this.templates.findById(document.templateId);
    if (!template) {
      throw new TemplateUpgradeNotFoundError(`Template not found: ${document.templateId}`);
    }

    const versions = await this.versions.listByTemplate(template.id);
    const activeVersion = await this.loadActiveVersion(template, versions);

    const decision = evaluateTemplateUpgrade({
      binding: {
        templateId: document.templateId,
        version: document.templateVersion,
        schemaHash: document.templateSchemaHash,
      },
      availableVersions: versions.map(version => ({
        templateId: version.templateId,
        version: version.version,
        schemaHash: version.schemaHash,
        status:
          version.status === TemplateVersionStatus.ACTIVE
            ? 'active'
            : version.status === TemplateVersionStatus.DEPRECATED
              ? 'deprecated'
              : 'draft',
      })),
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

    const templateLogger = this.logger.child({
      requestId,
      templateId: template.id,
      currentVersion: document.templateVersion,
      targetVersion: decision.action === 'upgrade' ? decision.targetVersion.version : undefined,
    });

    if (decision.action === 'blocked') {
      templateLogger.warn(
        {
          documentId,
          missingVersion: decision.requestedVersion.version,
        },
        'Document editing blocked due to removed template version'
      );
      return { document, template, decision, migration: null };
    }

    if (decision.action === 'noop') {
      templateLogger.info(
        {
          documentId,
          version: document.templateVersion,
        },
        'Template binding already up to date'
      );
      return { document, template, decision, migration: null };
    }

    const initiatedBy = userId ?? 'system_auto_upgrade';

    const pending = await this.migrations.logPending({
      documentId,
      fromVersion: decision.currentVersion.version,
      toVersion: decision.targetVersion.version,
      initiatedBy,
    });

    try {
      const resolved = await this.resolver.resolve({
        templateId: decision.targetVersion.templateId,
        version: decision.targetVersion.version,
        bypassCache: true,
      });

      const validation = this.validateDocumentContent(resolved, document);
      if (!validation.success) {
        await this.recordFailure(pending.id, validation.error);
        templateLogger.warn(
          {
            documentId,
            fromVersion: decision.currentVersion.version,
            toVersion: decision.targetVersion.version,
            status: DocumentTemplateMigrationStatus.FAILED,
          },
          'Template auto-upgrade blocked due to validation failure'
        );
        throw new TemplateValidationFailedError(
          'Document content does not satisfy the target template schema',
          validation.error
        );
      }

      const schemaHash = resolved?.template.schemaHash ?? decision.targetVersion.schemaHash;
      const updated = await this.documents.updateTemplateBinding({
        documentId,
        templateId: decision.targetVersion.templateId,
        templateVersion: decision.targetVersion.version,
        templateSchemaHash: schemaHash,
        updatedBy: initiatedBy,
      });

      const completed = await this.migrations.markSucceeded({ migrationId: pending.id });

      templateLogger.info(
        {
          documentId,
          fromVersion: decision.currentVersion.version,
          toVersion: decision.targetVersion.version,
          status: DocumentTemplateMigrationStatus.SUCCEEDED,
        },
        'Document auto-upgraded to active template version'
      );

      return { document: updated, template, decision, migration: completed };
    } catch (error) {
      if (error instanceof TemplateValidationFailedError) {
        throw error;
      }

      await this.recordFailure(pending.id, error);
      templateLogger.error(
        {
          documentId,
          fromVersion: decision.currentVersion.version,
          toVersion: decision.targetVersion.version,
          error: error instanceof Error ? error.message : error,
        },
        'Template auto-upgrade failed'
      );

      if (error instanceof TemplateUpgradeError) {
        throw error;
      }

      throw new TemplateUpgradeError('Failed to upgrade document to active template version');
    }
  }

  private async loadActiveVersion(
    template: DocumentTemplate,
    versions: TemplateVersion[]
  ): Promise<TemplateVersion | null> {
    if (template.activeVersionId) {
      const active = await this.versions.findById(template.activeVersionId);
      if (active) {
        return active;
      }
    }

    const fallback = versions.find(version => version.status === TemplateVersionStatus.ACTIVE);
    return fallback ?? null;
  }

  private validateDocumentContent(
    resolved: TemplateResolverResult | null,
    document: Document
  ): ValidationResult {
    if (!resolved) {
      return { success: false, error: new Error('Template version could not be resolved') };
    }

    const candidate = resolved.template.validator as {
      safeParse?: (value: unknown) => ValidationResult & { data?: unknown };
      parse?: (value: unknown) => unknown;
    } | null;

    if (!candidate) {
      return { success: true };
    }

    if (typeof candidate.safeParse === 'function') {
      const result = candidate.safeParse(document.content);
      if (result.success) {
        return { success: true };
      }
      return { success: false, error: result.error };
    }

    if (typeof candidate.parse === 'function') {
      try {
        candidate.parse(document.content);
        return { success: true };
      } catch (error) {
        return { success: false, error };
      }
    }

    return { success: true };
  }

  private async recordFailure(migrationId: string, details: unknown): Promise<void> {
    await this.migrations.markFailed({
      migrationId,
      validationErrors: details instanceof Error ? { message: details.message } : details,
    });
  }
}

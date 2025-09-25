import type * as BetterSqlite3 from 'better-sqlite3';
import type { Request, Response, NextFunction } from 'express';
import type { Logger } from 'pino';

import {
  ProjectRepositoryImpl,
  ConfigurationRepositoryImpl,
  ActivityLogRepositoryImpl,
  DocumentTemplateRepositoryImpl,
  TemplateVersionRepositoryImpl,
  DocumentTemplateMigrationRepositoryImpl,
  DocumentRepositoryImpl,
  SectionRepositoryImpl,
  EditorSessionRepositoryImpl,
  PendingChangeRepositoryImpl,
  SectionDraftRepositoryImpl,
  FormattingAnnotationRepositoryImpl,
  DraftConflictLogRepositoryImpl,
  SectionReviewRepositoryImpl,
} from '@ctrl-freaq/shared-data';
import { createTemplateResolver } from '@ctrl-freaq/template-resolver';
import type { TemplateResolver } from '@ctrl-freaq/template-resolver';
import { createTemplateValidator } from '@ctrl-freaq/templates';
import { TemplateCatalogService } from './template-catalog.service.js';
import { TemplateUpgradeService } from './template-upgrade.service.js';
import {
  SectionConflictService,
  SectionDraftService,
  SectionDiffService,
  SectionReviewService,
  SectionApprovalService,
  SectionConflictLogService,
} from '../modules/section-editor/services/index.js';
import type { DiffResponse } from '../modules/section-editor/validation/section-editor.schema.js';

const basicDiffGenerator = (
  originalContent: string,
  modifiedContent: string,
  options?: { approvedVersion?: number; draftVersion?: number }
): DiffResponse => {
  const originalLines = originalContent.split('\n');
  const modifiedLines = modifiedContent.split('\n');

  if (originalContent === modifiedContent) {
    return {
      mode: 'split',
      segments: [
        {
          type: 'unchanged',
          content: modifiedContent,
          startLine: 0,
          endLine: Math.max(modifiedLines.length - 1, 0),
        },
      ],
      metadata: {
        approvedVersion: options?.approvedVersion,
        draftVersion: options?.draftVersion,
        generatedAt: new Date().toISOString(),
      },
    } satisfies DiffResponse;
  }

  const segments: DiffResponse['segments'] = [];

  if (originalContent.length) {
    segments.push({
      type: 'removed',
      content: originalContent,
      startLine: 0,
      endLine: Math.max(originalLines.length - 1, 0),
    });
  }

  if (modifiedContent.length) {
    segments.push({
      type: 'added',
      content: modifiedContent,
      startLine: 0,
      endLine: Math.max(modifiedLines.length - 1, 0),
    });
  }

  return {
    mode: 'split',
    segments,
    metadata: {
      approvedVersion: options?.approvedVersion,
      draftVersion: options?.draftVersion,
      generatedAt: new Date().toISOString(),
    },
  } satisfies DiffResponse;
};

/**
 * Registers repository factories into the per-request service container.
 * Routes can then resolve via `req.services.get('<name>')` instead of `new`.
 */
export function createRepositoryRegistrationMiddleware() {
  return (req: Request, _res: Response, next: NextFunction) => {
    const container = req.services;
    if (!container) return next();

    // Database is provided by core service-locator
    const getDb = () => container.get<BetterSqlite3.Database>('database');

    // Register repositories as factories to ensure fresh instances per request
    container.register('projectRepository', () => new ProjectRepositoryImpl(getDb()));
    container.register('configurationRepository', () => new ConfigurationRepositoryImpl(getDb()));
    container.register('activityLogRepository', () => new ActivityLogRepositoryImpl(getDb()));
    container.register(
      'documentTemplateRepository',
      () => new DocumentTemplateRepositoryImpl(getDb())
    );
    container.register(
      'templateVersionRepository',
      () => new TemplateVersionRepositoryImpl(getDb())
    );
    container.register(
      'documentTemplateMigrationRepository',
      () => new DocumentTemplateMigrationRepositoryImpl(getDb())
    );
    container.register('documentRepository', () => new DocumentRepositoryImpl(getDb()));

    // Document Editor repositories
    container.register('sectionRepository', () => new SectionRepositoryImpl(getDb()));
    container.register('editorSessionRepository', () => new EditorSessionRepositoryImpl(getDb()));
    container.register('pendingChangeRepository', () => new PendingChangeRepositoryImpl(getDb()));
    container.register('sectionDraftRepository', () => new SectionDraftRepositoryImpl(getDb()));
    container.register(
      'formattingAnnotationRepository',
      () => new FormattingAnnotationRepositoryImpl(getDb())
    );
    container.register(
      'draftConflictLogRepository',
      () => new DraftConflictLogRepositoryImpl(getDb())
    );
    container.register('sectionReviewRepository', () => new SectionReviewRepositoryImpl(getDb()));

    container.register('templateCatalogService', currentContainer => {
      const templateRepo = currentContainer.get(
        'documentTemplateRepository'
      ) as DocumentTemplateRepositoryImpl;
      const versionRepo = currentContainer.get(
        'templateVersionRepository'
      ) as TemplateVersionRepositoryImpl;
      const logger = currentContainer.get('logger') as Logger;
      return new TemplateCatalogService(templateRepo, versionRepo, logger);
    });

    container.register('templateResolver', currentContainer => {
      const templateRepo = currentContainer.get(
        'documentTemplateRepository'
      ) as DocumentTemplateRepositoryImpl;
      const versionRepo = currentContainer.get(
        'templateVersionRepository'
      ) as TemplateVersionRepositoryImpl;
      const logger = currentContainer.get('logger') as Logger;

      return createTemplateResolver({
        dependencies: {
          async loadVersion(templateId, version) {
            const templateVersion = await versionRepo.findByTemplateAndVersion(templateId, version);
            if (!templateVersion) {
              return null;
            }

            return {
              templateId: templateVersion.templateId,
              version: templateVersion.version,
              schemaHash: templateVersion.schemaHash,
              schema: templateVersion.schemaJson,
              sections: templateVersion.sectionsJson,
              validator: createTemplateValidator({
                templateId: templateVersion.templateId,
                version: templateVersion.version,
                schemaJson: templateVersion.schemaJson,
              }),
              metadata: {
                changelog: templateVersion.changelog,
                status: templateVersion.status,
              },
            };
          },
          async loadActiveVersion(templateId) {
            const template = await templateRepo.findById(templateId);
            if (!template?.activeVersionId) {
              return null;
            }

            const activeVersion = await versionRepo.findById(template.activeVersionId);
            if (!activeVersion) {
              return null;
            }

            return {
              templateId: activeVersion.templateId,
              version: activeVersion.version,
              schemaHash: activeVersion.schemaHash,
              schema: activeVersion.schemaJson,
              sections: activeVersion.sectionsJson,
              validator: createTemplateValidator({
                templateId: activeVersion.templateId,
                version: activeVersion.version,
                schemaJson: activeVersion.schemaJson,
              }),
              metadata: {
                changelog: activeVersion.changelog,
                status: activeVersion.status,
              },
            };
          },
        },
        hooks: {
          onResolved(event) {
            logger.debug(
              {
                templateId: event.templateId,
                version: event.version,
                source: event.source,
              },
              'Template resolver resolved version'
            );
          },
          onError(event) {
            logger.error(
              {
                templateId: event.templateId,
                version: event.version,
                error: event.error instanceof Error ? event.error.message : event.error,
              },
              'Template resolver failed to load version'
            );
          },
        },
      });
    });

    container.register('templateUpgradeService', currentContainer => {
      const documentRepository = currentContainer.get(
        'documentRepository'
      ) as DocumentRepositoryImpl;
      const templateRepository = currentContainer.get(
        'documentTemplateRepository'
      ) as DocumentTemplateRepositoryImpl;
      const versionRepository = currentContainer.get(
        'templateVersionRepository'
      ) as TemplateVersionRepositoryImpl;
      const migrationRepository = currentContainer.get(
        'documentTemplateMigrationRepository'
      ) as DocumentTemplateMigrationRepositoryImpl;
      const resolver = currentContainer.get('templateResolver') as TemplateResolver;
      const logger = currentContainer.get('logger') as Logger;

      return new TemplateUpgradeService(
        documentRepository,
        templateRepository,
        versionRepository,
        migrationRepository,
        resolver,
        logger
      );
    });

    container.register('sectionConflictService', currentContainer => {
      const sections = currentContainer.get('sectionRepository') as SectionRepositoryImpl;
      const drafts = currentContainer.get('sectionDraftRepository') as SectionDraftRepositoryImpl;
      const conflicts = currentContainer.get(
        'draftConflictLogRepository'
      ) as DraftConflictLogRepositoryImpl;
      const scopedLogger = currentContainer.get('logger') as Logger;
      return new SectionConflictService(sections, drafts, conflicts, scopedLogger);
    });

    container.register('sectionDraftService', currentContainer => {
      const sections = currentContainer.get('sectionRepository') as SectionRepositoryImpl;
      const drafts = currentContainer.get('sectionDraftRepository') as SectionDraftRepositoryImpl;
      const conflictService = currentContainer.get(
        'sectionConflictService'
      ) as SectionConflictService;
      const scopedLogger = currentContainer.get('logger') as Logger;
      return new SectionDraftService(sections, drafts, conflictService, scopedLogger);
    });

    container.register('sectionDiffService', currentContainer => {
      const sections = currentContainer.get('sectionRepository') as SectionRepositoryImpl;
      const drafts = currentContainer.get('sectionDraftRepository') as SectionDraftRepositoryImpl;
      const scopedLogger = currentContainer.get('logger') as Logger;
      return new SectionDiffService(sections, drafts, basicDiffGenerator, scopedLogger);
    });

    container.register('sectionReviewService', currentContainer => {
      const sections = currentContainer.get('sectionRepository') as SectionRepositoryImpl;
      const drafts = currentContainer.get('sectionDraftRepository') as SectionDraftRepositoryImpl;
      const reviews = currentContainer.get(
        'sectionReviewRepository'
      ) as SectionReviewRepositoryImpl;
      const scopedLogger = currentContainer.get('logger') as Logger;
      return new SectionReviewService(sections, drafts, reviews, scopedLogger);
    });

    container.register('sectionApprovalService', currentContainer => {
      const sections = currentContainer.get('sectionRepository') as SectionRepositoryImpl;
      const drafts = currentContainer.get('sectionDraftRepository') as SectionDraftRepositoryImpl;
      const reviews = currentContainer.get(
        'sectionReviewRepository'
      ) as SectionReviewRepositoryImpl;
      const scopedLogger = currentContainer.get('logger') as Logger;
      return new SectionApprovalService(sections, drafts, reviews, scopedLogger);
    });

    container.register('sectionConflictLogService', currentContainer => {
      const sections = currentContainer.get('sectionRepository') as SectionRepositoryImpl;
      const drafts = currentContainer.get('sectionDraftRepository') as SectionDraftRepositoryImpl;
      const conflicts = currentContainer.get(
        'draftConflictLogRepository'
      ) as DraftConflictLogRepositoryImpl;
      const scopedLogger = currentContainer.get('logger') as Logger;
      return new SectionConflictLogService(sections, drafts, conflicts, scopedLogger);
    });

    next();
  };
}

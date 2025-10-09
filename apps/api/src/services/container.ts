import { randomUUID } from 'node:crypto';
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
  AssumptionSessionRepository,
} from '@ctrl-freaq/shared-data';
import { CoAuthoringChangelogRepository } from '@ctrl-freaq/shared-data/repositories/changelog/changelog.repository.js';
import { createTemplateResolver } from '@ctrl-freaq/template-resolver';
import type {
  TemplateResolver,
  TemplateResolvedEvent,
  TemplateResolverErrorEvent,
} from '@ctrl-freaq/template-resolver';
import { createTemplateValidator } from '@ctrl-freaq/templates';
import { generateSectionDiff } from '@ctrl-freaq/editor-core';
import { TemplateCatalogService } from './template-catalog.service.js';
import { TemplateUpgradeService } from './template-upgrade.service.js';
import {
  SectionConflictService,
  SectionDraftService,
  SectionDiffService,
  SectionReviewService,
  SectionApprovalService,
  SectionConflictLogService,
  AssumptionSessionService,
  TemplateAssumptionPromptProvider,
} from '../modules/section-editor/services/index.js';
import type {
  AssumptionPromptProvider,
  DocumentDecisionProvider,
} from '../modules/section-editor/services/index.js';
import { DocumentDecisionProviderImpl } from '../modules/section-editor/services/document-decision.provider.js';
import {
  DraftBundleService,
  type DraftConflictTelemetry,
  type DraftBundleAuditLogger,
  type DraftBundleConflict,
} from './drafts/draft-bundle.service.js';
import { DraftBundleRepositoryImpl } from './drafts/draft-bundle.repository.js';
import {
  AIProposalService,
  type AIProposalServiceDependencies,
} from './co-authoring/ai-proposal.service.js';
import type { BuildCoAuthorContextDependencies } from './co-authoring/context-builder.js';
import { createVercelAIProposalProvider } from '@ctrl-freaq/ai/session/proposal-runner.js';
import { CoAuthoringDraftPersistenceAdapter } from './co-authoring/draft-persistence.js';
import { createCoAuthoringAuditLogger } from '@ctrl-freaq/qa';
import type { ServiceContainer } from '../core/service-locator.js';
import type {
  ProposalProvider,
  ProposalProviderEvent,
} from '@ctrl-freaq/ai/session/proposal-runner.js';

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
      'coAuthoringChangelogRepository',
      () => new CoAuthoringChangelogRepository(getDb())
    );
    container.register(
      'draftConflictLogRepository',
      () => new DraftConflictLogRepositoryImpl(getDb())
    );
    container.register('sectionReviewRepository', () => new SectionReviewRepositoryImpl(getDb()));
    container.register(
      'assumptionSessionRepository',
      () => new AssumptionSessionRepository(getDb())
    );

    container.register('draftBundleRepository', currentContainer => {
      const sectionRepository = currentContainer.get('sectionRepository') as SectionRepositoryImpl;
      const documentRepository = currentContainer.get(
        'documentRepository'
      ) as DocumentRepositoryImpl;
      const projectRepository = currentContainer.get('projectRepository') as ProjectRepositoryImpl;
      const logger = currentContainer.get('logger') as Logger;
      return new DraftBundleRepositoryImpl(
        sectionRepository,
        documentRepository,
        projectRepository,
        logger
      );
    });

    container.register('assumptionPromptProvider', currentContainer => {
      const templateResolver = currentContainer.get('templateResolver') as TemplateResolver;
      const documentRepository = currentContainer.get(
        'documentRepository'
      ) as DocumentRepositoryImpl;
      const sectionRepository = currentContainer.get('sectionRepository') as SectionRepositoryImpl;
      const logger = currentContainer.get('logger') as Logger;

      return new TemplateAssumptionPromptProvider({
        templateResolver,
        documentRepository,
        sectionRepository,
        logger,
      });
    });

    container.register('documentDecisionProvider', currentContainer => {
      const documentRepository = currentContainer.get(
        'documentRepository'
      ) as DocumentRepositoryImpl;
      const logger = currentContainer.get('logger') as Logger;
      return new DocumentDecisionProviderImpl({ documents: documentRepository, logger });
    });

    container.register('draftBundleService', currentContainer => {
      const repo = currentContainer.get('draftBundleRepository') as DraftBundleRepositoryImpl;
      const logger = currentContainer.get('logger') as Logger;

      const telemetry = {
        emitBundleAttempt(payload: { documentId: string; sectionCount: number }) {
          logger.debug(payload, 'Draft bundle attempt');
        },
        emitBundleSuccess(payload: { documentId: string; durationMs: number }) {
          logger.info(payload, 'Draft bundle success');
        },
        emitBundleFailure(payload: { documentId: string; reason: string }) {
          logger.warn(payload, 'Draft bundle failure');
        },
      } satisfies DraftConflictTelemetry;

      const audit = {
        async recordBundleApplied(payload: {
          documentId: string;
          authorId: string;
          sectionCount: number;
        }) {
          logger.info(payload, 'Draft bundle applied');
        },
        async recordBundleRejected(payload: {
          documentId: string;
          authorId: string;
          conflicts: DraftBundleConflict[];
        }) {
          logger.warn(payload, 'Draft bundle rejected');
        },
      } satisfies DraftBundleAuditLogger;

      return new DraftBundleService({
        draftRepo: repo,
        audit,
        telemetry,
      });
    });

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

    container.register('coAuthoringService', currentContainer => {
      const logger = currentContainer.get('logger') as Logger;
      const contextDeps = createCoAuthorContextDependencies(currentContainer, logger);
      const drafts = currentContainer.get('sectionDraftRepository') as SectionDraftRepositoryImpl;
      const changelogRepo = currentContainer.get(
        'coAuthoringChangelogRepository'
      ) as CoAuthoringChangelogRepository;
      const draftPersistence = new CoAuthoringDraftPersistenceAdapter(drafts, logger);
      const auditLogger = createCoAuthoringAuditLogger(logger);

      const providerMode = (process.env.COAUTHORING_PROVIDER_MODE ?? '').trim().toLowerCase();
      const useMockProvider =
        providerMode === 'mock' || (!providerMode && process.env.NODE_ENV === 'test');

      if (providerMode && providerMode !== 'mock' && providerMode !== 'vercel') {
        logger.warn(
          { providerMode },
          'Unknown co-authoring provider mode specified; defaulting to vercel provider'
        );
      }

      const serviceDeps: AIProposalServiceDependencies = {
        logger,
        context: contextDeps,
        draftPersistence,
        changelogRepo,
        auditLogger,
        providerFactory: useMockProvider
          ? createMockProposalProvider
          : () => createVercelAIProposalProvider(),
      };

      if (useMockProvider) {
        logger.debug('Co-authoring service using mock proposal provider');
      }

      return new AIProposalService(serviceDeps);
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
          async loadVersion(templateId: string, version: string) {
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
          async loadActiveVersion(templateId: string) {
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
          onResolved(event: TemplateResolvedEvent) {
            logger.debug(
              {
                templateId: event.templateId,
                version: event.version,
                source: event.source,
              },
              'Template resolver resolved version'
            );
          },
          onError(event: TemplateResolverErrorEvent) {
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

    container.register('assumptionSessionService', currentContainer => {
      const repository = currentContainer.get(
        'assumptionSessionRepository'
      ) as AssumptionSessionRepository;
      const logger = currentContainer.get('logger') as Logger;
      const promptProvider = currentContainer.get(
        'assumptionPromptProvider'
      ) as AssumptionPromptProvider;
      const decisionProvider = currentContainer.get(
        'documentDecisionProvider'
      ) as DocumentDecisionProvider;
      return new AssumptionSessionService({
        repository,
        logger,
        promptProvider,
        decisionProvider,
      });
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
      return new SectionDiffService(sections, drafts, generateSectionDiff, scopedLogger);
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

function createCoAuthorContextDependencies(
  container: ServiceContainer,
  logger: Logger
): BuildCoAuthorContextDependencies {
  const documentRepository = container.get('documentRepository') as DocumentRepositoryImpl;
  const sectionRepository = container.get('sectionRepository') as SectionRepositoryImpl;
  const draftRepository = container.get('sectionDraftRepository') as SectionDraftRepositoryImpl;

  const defaultClarifications = [
    'Always include the entire document in provider payloads.',
    'Conversation transcripts must remain ephemeral.',
  ];

  return {
    async fetchDocumentSnapshot(documentId: string) {
      const document = await documentRepository.findById(documentId);
      const sections = await sectionRepository.findByDocumentId(documentId, {
        orderBy: 'order_index',
        orderDirection: 'ASC',
      });

      const normalized = sections.map(section => ({
        sectionId: section.id,
        path: `/documents/${documentId}/sections/${section.id}.md`,
        status: section.status === 'ready' ? ('completed' as const) : ('draft' as const),
        content:
          section.status === 'ready' && section.approvedContent
            ? section.approvedContent
            : section.contentMarkdown,
      }));

      return {
        documentId,
        title: document?.title ?? 'Untitled Document',
        sections: normalized,
      };
    },
    async fetchActiveSectionDraft({
      documentId,
      sectionId,
    }: {
      documentId: string;
      sectionId: string;
    }) {
      try {
        const [draft] = await draftRepository.listBySection(sectionId, { limit: 1 });
        if (!draft) {
          return null;
        }

        return {
          content: draft.contentMarkdown,
          baselineVersion: `rev-${draft.draftBaseVersion}`,
          draftVersion: draft.draftVersion,
        };
      } catch (error) {
        logger.warn(
          {
            documentId,
            sectionId,
            error: error instanceof Error ? error.message : error,
          },
          'Failed to resolve active section draft for co-authoring context'
        );
        return null;
      }
    },
    async fetchDecisionSummaries({ decisionIds }: { decisionIds: string[] }) {
      return decisionIds.map(id => ({
        id,
        summary: `Decision reference: ${id}`,
      }));
    },
    async fetchKnowledgeItems({ knowledgeItemIds }: { knowledgeItemIds: string[] }) {
      return knowledgeItemIds.map(id => ({
        id,
        excerpt: `Knowledge source ${id}`,
      }));
    },
    clarifications: defaultClarifications,
  } satisfies BuildCoAuthorContextDependencies;
}

const createMockProposalProvider = (): ProposalProvider => {
  return {
    async *streamProposal(payload: Parameters<ProposalProvider['streamProposal']>[0]) {
      const startedAt = Date.now();
      yield {
        type: 'progress',
        data: { status: 'streaming', elapsedMs: 10 },
      } satisfies ProposalProviderEvent;

      const citations = payload.context.decisionSummaries.map(summary => summary.id);
      const updatedDraft = `${payload.context.currentDraft}\n\n### Assistant Revision\n${payload.prompt.text}`;
      const serialized = JSON.stringify({
        proposalId: randomUUID(),
        updatedDraft,
        confidence: 0.82,
        citations,
        rationale: 'Expanded clarity and accessibility guidance.',
        promptSummary: payload.prompt.text.slice(0, 120),
      });

      yield { type: 'token', data: { value: serialized } } satisfies ProposalProviderEvent;
      yield {
        type: 'progress',
        data: { status: 'awaiting-approval', elapsedMs: Date.now() - startedAt },
      } satisfies ProposalProviderEvent;

      return {
        type: 'completed',
        data: {
          proposalId: randomUUID(),
          confidence: 0.82,
        },
      } satisfies ProposalProviderEvent;
    },
  } satisfies ProposalProvider;
};

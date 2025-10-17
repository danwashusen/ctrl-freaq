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
  SectionQualityGateResultRepository,
  TraceabilityRepository,
  TraceabilitySyncRepository,
  type RequirementGap,
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
import { createCoAuthoringAuditLogger, createQualityGateAuditLogger } from '@ctrl-freaq/qa';
import { createSectionQualityRunner } from '@ctrl-freaq/qa/gates/section/section-quality-runner';
import { evaluateSectionQualityRules } from '@ctrl-freaq/qa/gates/section/section-quality-evaluator';
import { createTraceabilitySyncService } from '@ctrl-freaq/qa/traceability';
import type { TraceabilitySyncService } from '@ctrl-freaq/qa/traceability';
import { DocumentQaStreamingService } from '../modules/document-qa/services/document-qa-streaming.service.js';
import {
  createSectionQualityService,
  type SectionRunTelemetryPayload,
} from '../modules/quality-gates/services/section-quality.service.js';
import {
  createDocumentQualityService,
  type DocumentRunTelemetryPayload,
} from '../modules/quality-gates/services/document-quality.service.js';
import type { ServiceContainer } from '../core/service-locator.js';
import type {
  ProposalProvider,
  ProposalProviderEvent,
} from '@ctrl-freaq/ai/session/proposal-runner.js';
import { SharedSectionStreamQueueCoordinator } from './streaming/shared-section-stream-queue.js';
import { DocumentQualityGateSummaryRepository } from '../../../../packages/shared-data/src/repositories/quality-gates/document-quality-gate-summary.repository.js';

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

    container.register(
      'sectionQualityGateResultRepository',
      () => new SectionQualityGateResultRepository(getDb())
    );
    container.register(
      'documentQualityGateSummaryRepository',
      () => new DocumentQualityGateSummaryRepository(getDb())
    );
    container.register('traceabilityRepository', () => new TraceabilityRepository(getDb()));
    container.register(
      'traceabilitySyncRepository',
      currentContainer =>
        new TraceabilitySyncRepository({
          repository: currentContainer.get('traceabilityRepository') as TraceabilityRepository,
        })
    );

    container.register(
      'sectionStreamQueueCoordinator',
      () => new SharedSectionStreamQueueCoordinator()
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
      const queueCoordinator = currentContainer.get(
        'sectionStreamQueueCoordinator'
      ) as SharedSectionStreamQueueCoordinator;

      let serviceRef: AIProposalService | null = null;
      const sharedQueue = queueCoordinator.registerOwner('coAuthor', {
        onPromoted(promotion) {
          serviceRef?.handleQueuePromotion(promotion);
        },
      });

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
        streamQueue: sharedQueue,
        providerFactory: useMockProvider
          ? createMockProposalProvider
          : () => createVercelAIProposalProvider(),
      };

      if (useMockProvider) {
        logger.debug('Co-authoring service using mock proposal provider');
      }

      const service = new AIProposalService(serviceDeps);
      serviceRef = service;
      return service;
    });

    container.register('documentQaStreamingService', currentContainer => {
      const logger = currentContainer.get('logger') as Logger;
      const queueCoordinator = currentContainer.get(
        'sectionStreamQueueCoordinator'
      ) as SharedSectionStreamQueueCoordinator;
      const telemetry = {
        logReview(payload: Record<string, unknown>) {
          logger.info(payload, 'Document QA streaming telemetry');
        },
      };

      let serviceRef: DocumentQaStreamingService | null = null;
      const sharedQueue = queueCoordinator.registerOwner('documentQa', {
        onPromoted(promotion) {
          serviceRef?.handleQueuePromotion(promotion);
        },
      });

      const service = new DocumentQaStreamingService({
        logger,
        telemetry,
        queue: sharedQueue,
      });
      serviceRef = service;
      return service;
    });

    container.register('sectionQualityService', currentContainer => {
      const logger = currentContainer.get('logger') as Logger;
      const traceabilityService = currentContainer.get(
        'traceabilitySyncService'
      ) as TraceabilitySyncService;
      const sectionRepository = currentContainer.get('sectionRepository') as SectionRepositoryImpl;

      const repository = currentContainer.get(
        'sectionQualityGateResultRepository'
      ) as SectionQualityGateResultRepository;

      const telemetry = {
        emitSectionRun(payload: SectionRunTelemetryPayload) {
          logger.info(payload, 'Section quality gate run');
        },
      };

      const runner = createSectionQualityRunner({
        async evaluateRules(context) {
          const section = await sectionRepository.findById(context.sectionId);
          if (!section) {
            return [
              {
                ruleId: 'qa.section.missing',
                title: 'Section could not be located',
                severity: 'Blocker',
                guidance: [
                  'Ensure the section exists before running quality gates.',
                  'Refresh the editor to reload the latest document structure.',
                ],
              },
            ];
          }

          return evaluateSectionQualityRules({
            sectionId: context.sectionId,
            documentId: context.documentId,
            title: section.title,
            content: section.contentMarkdown ?? '',
          });
        },
        async persistResult(payload) {
          await repository.upsertResult({
            sectionId: payload.sectionId,
            documentId: payload.documentId,
            runId: payload.runId,
            status: payload.status,
            rules: payload.rules,
            lastRunAt: payload.lastRunAt,
            lastSuccessAt: payload.lastSuccessAt,
            triggeredBy: payload.triggeredBy,
            source: payload.source,
            durationMs: payload.durationMs,
            remediationState: payload.remediationState,
            incidentId: payload.incidentId ?? null,
          });
        },
        emitTelemetry(event, payload) {
          logger.debug({ event, payload }, 'Section quality runner telemetry');
        },
        generateRunId: () => randomUUID(),
        getRequestId: () => randomUUID(),
        now: () => Date.now(),
      });

      const auditLogger = createQualityGateAuditLogger(logger);

      return createSectionQualityService({
        sectionRunner: runner,
        repository,
        telemetry,
        auditLogger,
        traceabilityQueue: {
          async enqueueSectionSync(payload) {
            await traceabilityService.syncSectionRun({
              documentId: payload.documentId,
              sectionId: payload.sectionId,
              runId: payload.runId,
              revisionId: payload.revisionId,
              status: payload.status,
              triggeredBy: payload.triggeredBy,
              source: payload.source,
              completedAt: payload.completedAt,
            });
          },
        },
        resolveSectionRevision: async ({ sectionId }) => {
          const section = await sectionRepository.findById(sectionId);
          if (!section) {
            return null;
          }

          const version = typeof section.approvedVersion === 'number' ? section.approvedVersion : 0;
          const updatedAt =
            section.updatedAt instanceof Date ? section.updatedAt : new Date(section.updatedAt);
          const safeSectionId = sectionId.replace(/[^a-z0-9-]/g, '-').toLowerCase();
          return `rev-${safeSectionId}-v${version}-${updatedAt.getTime()}`;
        },
      });
    });

    container.register('traceabilitySyncService', currentContainer => {
      const repository = currentContainer.get(
        'traceabilitySyncRepository'
      ) as TraceabilitySyncRepository;
      const sectionRepository = currentContainer.get('sectionRepository') as SectionRepositoryImpl;
      return createTraceabilitySyncService({
        repository,
        async getSectionPreview(sectionId) {
          const section = await sectionRepository.findById(sectionId);
          if (!section || typeof section.contentMarkdown !== 'string') {
            return '';
          }
          return section.contentMarkdown.trim().slice(0, 180);
        },
      });
    });

    container.register('documentQualityService', currentContainer => {
      const logger = currentContainer.get('logger') as Logger;
      const sectionRepository = currentContainer.get(
        'sectionQualityGateResultRepository'
      ) as SectionQualityGateResultRepository;
      const summaryRepository = currentContainer.get(
        'documentQualityGateSummaryRepository'
      ) as DocumentQualityGateSummaryRepository;
      const traceabilityService = currentContainer.get(
        'traceabilitySyncService'
      ) as TraceabilitySyncService;

      const telemetry = {
        emitDocumentRun(payload: DocumentRunTelemetryPayload) {
          logger.info(payload, 'Document quality gate run');
        },
      };

      const auditLogger = createQualityGateAuditLogger(logger);
      const severityRank = (value: RequirementGap['reason']): number => {
        switch (value) {
          case 'blocker':
            return 2;
          case 'warning-override':
            return 1;
          case 'no-link':
          default:
            return 0;
        }
      };

      const coverageResolver = async (documentId: string): Promise<RequirementGap[]> => {
        const entries = await traceabilityService.listDocumentTraceability(documentId);
        const gaps = new Map<string, RequirementGap>();

        for (const entry of entries) {
          let reason: RequirementGap['reason'] | null = null;
          if (entry.coverageStatus === 'blocker') {
            reason = 'blocker';
          } else if (entry.coverageStatus === 'warning') {
            reason = 'warning-override';
          } else if (entry.coverageStatus === 'orphaned') {
            reason = 'no-link';
          }

          if (!reason) {
            continue;
          }

          const existing = gaps.get(entry.requirementId);
          const linkedSections = new Set(existing?.linkedSections ?? []);
          if (entry.sectionId) {
            linkedSections.add(entry.sectionId);
          }

          if (!existing) {
            gaps.set(entry.requirementId, {
              requirementId: entry.requirementId,
              reason,
              linkedSections: Array.from(linkedSections),
            });
            continue;
          }

          const currentSeverity = severityRank(existing.reason);
          const incomingSeverity = severityRank(reason);
          const mergedReason = incomingSeverity > currentSeverity ? reason : existing.reason;
          gaps.set(entry.requirementId, {
            requirementId: entry.requirementId,
            reason: mergedReason,
            linkedSections: Array.from(linkedSections),
          });
        }

        return Array.from(gaps.values());
      };

      return createDocumentQualityService({
        sectionRepository,
        summaryRepository,
        telemetry,
        auditLogger,
        coverageResolver,
      });
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
      const queueCoordinator = currentContainer.get(
        'sectionStreamQueueCoordinator'
      ) as SharedSectionStreamQueueCoordinator;

      let serviceRef: AssumptionSessionService | null = null;
      const sharedQueue = queueCoordinator.registerOwner('assumptions', {
        onPromoted(promotion) {
          serviceRef?.handleQueuePromotion(promotion);
        },
        onCanceled(details) {
          serviceRef?.handleQueueCancellation(details);
        },
      });

      const service = new AssumptionSessionService({
        repository,
        logger,
        promptProvider,
        decisionProvider,
        queue: sharedQueue,
      });
      serviceRef = service;
      return service;
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

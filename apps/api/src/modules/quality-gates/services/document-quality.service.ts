import { randomUUID } from 'node:crypto';

import type {
  DocumentQualityGateSummary,
  DocumentQualityGateSummaryRepository,
  RequirementGap,
  SectionQualityGateResultRepository,
} from '@ctrl-freaq/shared-data';
import type { QualityGateAuditLogger } from '@ctrl-freaq/qa';
import {
  aggregateDocumentQualitySummary,
  type AggregateDocumentQualitySummaryResult,
} from '../../../../../../packages/qa/src/dashboard/document-quality-summary.js';
type QualityGateRunSource = 'auto' | 'manual' | 'dashboard';

export interface DocumentRunTelemetryPayload {
  requestId: string;
  documentId: string;
  triggeredBy: string;
  source: QualityGateRunSource;
  status: 'queued' | 'running' | 'completed' | 'failed';
  durationMs: number;
  blockerSections: number;
  warningSections: number;
  publishBlocked: boolean;
}

export interface DocumentQualityServiceDependencies {
  sectionRepository: Pick<SectionQualityGateResultRepository, 'listByDocumentId'>;
  summaryRepository: Pick<
    DocumentQualityGateSummaryRepository,
    'upsertSummary' | 'findByDocumentId'
  >;
  auditLogger: QualityGateAuditLogger;
  telemetry: {
    emitDocumentRun(payload: DocumentRunTelemetryPayload): void;
  };
  coverageResolver?: (
    documentId: string
  ) => Promise<RequirementGap[]> | RequirementGap[] | null | undefined;
  clock?: () => Date;
  requestIdGenerator?: () => string;
  summaryAggregator?: (
    input: Parameters<typeof aggregateDocumentQualitySummary>[0]
  ) => AggregateDocumentQualitySummaryResult;
}

export interface RunDocumentInput {
  documentId: string;
  triggeredBy: string;
  source: QualityGateRunSource;
}

export interface RunDocumentAcknowledgement {
  status: 'running';
  documentId: string;
  requestId: string;
  triggeredBy: string;
  queuedAt: string;
  estimatedCompletionSeconds: number;
}

export interface RunDocumentFailure {
  status: 'failed';
  documentId: string;
  requestId: string;
  triggeredBy: string;
  error: string;
  incidentId: string | null;
}

export type RunDocumentResult = RunDocumentAcknowledgement | RunDocumentFailure;

export interface DocumentQualityService {
  runDocument(input: RunDocumentInput): Promise<RunDocumentResult>;
  getSummary(documentId: string): Promise<DocumentQualityGateSummary | null>;
}

const defaultClock = () => new Date();
const defaultRequestId = () => randomUUID();

const normalizeError = (error: unknown): { message: string; incidentId: string | null } => {
  if (error && typeof error === 'object') {
    const incidentId =
      'incidentId' in error && typeof (error as { incidentId?: unknown }).incidentId === 'string'
        ? ((error as { incidentId?: string }).incidentId as string)
        : null;
    const message =
      'message' in error && typeof (error as { message?: unknown }).message === 'string'
        ? ((error as { message?: string }).message as string)
        : 'Document validation failed';
    return { message, incidentId };
  }

  if (typeof error === 'string') {
    return { message: error, incidentId: null };
  }

  return { message: 'Document validation failed', incidentId: null };
};

const resolveCoverageGaps = async (
  resolver: DocumentQualityServiceDependencies['coverageResolver'] | undefined,
  documentId: string
) => {
  if (!resolver) {
    return [];
  }

  const result = await resolver(documentId);
  if (!result) {
    return [];
  }

  return Array.isArray(result) ? result : [];
};

export function createDocumentQualityService(
  dependencies: DocumentQualityServiceDependencies
): DocumentQualityService {
  const clock = dependencies.clock ?? defaultClock;
  const generateRequestId = dependencies.requestIdGenerator ?? defaultRequestId;
  const aggregate = dependencies.summaryAggregator ?? aggregateDocumentQualitySummary;

  return {
    async runDocument(input) {
      const requestId = generateRequestId();
      const startedAt = clock();

      dependencies.auditLogger.logQueued({
        requestId,
        runId: requestId,
        documentId: input.documentId,
        scope: 'document',
        triggeredBy: input.triggeredBy,
        status: 'queued',
        queuedAt: startedAt.toISOString(),
      });

      dependencies.telemetry.emitDocumentRun({
        requestId,
        documentId: input.documentId,
        triggeredBy: input.triggeredBy,
        source: input.source,
        status: 'queued',
        durationMs: 0,
        blockerSections: 0,
        warningSections: 0,
        publishBlocked: false,
      });

      try {
        const sections = await dependencies.sectionRepository.listByDocumentId(input.documentId);
        const coverageGaps = await resolveCoverageGaps(
          dependencies.coverageResolver,
          input.documentId
        );

        const completedAt = clock();
        const { summary, overallStatus } = aggregate({
          documentId: input.documentId,
          sections,
          coverageGaps,
          requestId,
          triggeredBy: input.triggeredBy,
          completedAt,
        });

        await dependencies.summaryRepository.upsertSummary(summary);

        const durationMs = Math.max(0, completedAt.getTime() - startedAt.getTime());

        dependencies.telemetry.emitDocumentRun({
          requestId,
          documentId: input.documentId,
          triggeredBy: input.triggeredBy,
          source: input.source,
          status: 'completed',
          durationMs,
          blockerSections: summary.blockerSections.length,
          warningSections: summary.warningSections.length,
          publishBlocked: summary.publishBlocked,
        });

        dependencies.auditLogger.logCompleted({
          requestId,
          runId: requestId,
          documentId: input.documentId,
          scope: 'document',
          triggeredBy: input.triggeredBy,
          status: 'completed',
          outcome: overallStatus,
          durationMs,
          completedAt: completedAt.toISOString(),
        });

        return {
          status: 'running',
          documentId: input.documentId,
          requestId,
          triggeredBy: input.triggeredBy,
          queuedAt: startedAt.toISOString(),
          estimatedCompletionSeconds: 5,
        };
      } catch (error) {
        const failureTimestamp = clock();
        const durationMs = Math.max(0, failureTimestamp.getTime() - startedAt.getTime());
        const { message, incidentId } = normalizeError(error);
        dependencies.telemetry.emitDocumentRun({
          requestId,
          documentId: input.documentId,
          triggeredBy: input.triggeredBy,
          source: input.source,
          status: 'failed',
          durationMs,
          blockerSections: 0,
          warningSections: 0,
          publishBlocked: true,
        });

        dependencies.auditLogger.logFailed({
          requestId,
          runId: requestId,
          documentId: input.documentId,
          scope: 'document',
          triggeredBy: input.triggeredBy,
          status: 'failed',
          durationMs,
          error: message,
          incidentId: incidentId ?? undefined,
          failedAt: failureTimestamp.toISOString(),
        });

        return {
          status: 'failed',
          documentId: input.documentId,
          requestId,
          triggeredBy: input.triggeredBy,
          error: message,
          incidentId,
        };
      }
    },

    async getSummary(documentId) {
      return dependencies.summaryRepository.findByDocumentId(documentId);
    },
  };
}

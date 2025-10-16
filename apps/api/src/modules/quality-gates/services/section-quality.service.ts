import { randomUUID } from 'node:crypto';

import type { SectionQualityGateResult } from '@ctrl-freaq/shared-data';
import type { SectionQualityGateResultRepository } from '@ctrl-freaq/shared-data';
import type {
  QualityGateAuditLogger,
  SectionQualityRunner,
  SectionQualityRunResult,
} from '@ctrl-freaq/qa';

type QualityGateRunSource = 'auto' | 'manual' | 'dashboard';

export interface SectionQualityServiceDependencies {
  sectionRunner: Pick<SectionQualityRunner, 'run'>;
  repository?: Partial<
    Pick<SectionQualityGateResultRepository, 'findBySectionId' | 'upsertResult'>
  >;
  telemetry: {
    emitSectionRun(payload: SectionRunTelemetryPayload): void;
  };
  auditLogger: QualityGateAuditLogger;
  traceabilityQueue?: {
    enqueueSectionSync(payload: SectionTraceabilitySyncPayload): Promise<void> | void;
  };
  resolveSectionRevision?: (input: {
    sectionId: string;
    documentId: string;
  }) => Promise<string | null | undefined> | string | null | undefined;
  clock?: () => Date;
}

export interface SectionRunTelemetryPayload {
  requestId: string;
  runId: string;
  documentId: string;
  sectionId: string;
  triggeredBy: string;
  source: QualityGateRunSource;
  status: 'queued' | 'running' | 'completed' | 'failed';
  durationMs: number;
  rulesEvaluated: number;
  incidentId?: string;
}

export interface SectionTraceabilitySyncPayload {
  documentId: string;
  sectionId: string;
  runId: string;
  revisionId?: string | null;
  status: SectionQualityRunResult['status'];
  triggeredBy: string;
  source: QualityGateRunSource;
  completedAt: Date;
}

export interface RunSectionInput {
  sectionId: string;
  documentId: string;
  triggeredBy: string;
  source: QualityGateRunSource;
}

export interface RunSectionAcknowledgement {
  status: 'running';
  requestId: string;
  runId: string;
  triggeredBy: string;
  sectionId: string;
}

export interface RunSectionFailure {
  status: 'failed';
  incidentId: string | null;
  error: string;
}

export type RunSectionResult = RunSectionAcknowledgement | RunSectionFailure;

export interface SectionQualityService {
  runSection(input: RunSectionInput): Promise<RunSectionResult>;
  getLatestResult(sectionId: string): Promise<SectionQualityGateResult | null>;
}

const defaultClock = () => new Date();

const asErrorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  return 'Quality gate run failed';
};

interface NormalizedFailure {
  requestId: string;
  runId: string;
  durationMs: number;
  error: string;
  incidentId: string | null;
  failedAt: string;
}

const normalizeFailure = (
  error: unknown,
  startedAt: Date,
  clock: () => Date
): NormalizedFailure => {
  const durationMs = Math.max(0, clock().getTime() - startedAt.getTime());
  const fallbackRequestId = randomUUID();
  const fallbackRunId = randomUUID();

  if (typeof error === 'object' && error !== null) {
    const incidentId =
      'incidentId' in error ? ((error as { incidentId?: string | null }).incidentId ?? null) : null;
    const requestId =
      'requestId' in error && typeof (error as { requestId?: unknown }).requestId === 'string'
        ? (error as { requestId: string }).requestId
        : fallbackRequestId;
    const runId =
      'runId' in error && typeof (error as { runId?: unknown }).runId === 'string'
        ? (error as { runId: string }).runId
        : fallbackRunId;

    return {
      requestId,
      runId,
      durationMs,
      error: asErrorMessage(error),
      incidentId,
      failedAt: clock().toISOString(),
    };
  }

  return {
    requestId: fallbackRequestId,
    runId: fallbackRunId,
    durationMs,
    error: asErrorMessage(error),
    incidentId: null,
    failedAt: clock().toISOString(),
  };
};

const emitCompletedTelemetry = (
  telemetry: SectionQualityServiceDependencies['telemetry'],
  result: SectionQualityRunResult,
  input: RunSectionInput
) => {
  telemetry.emitSectionRun({
    requestId: result.requestId,
    runId: result.runId,
    documentId: input.documentId,
    sectionId: input.sectionId,
    triggeredBy: input.triggeredBy,
    source: input.source,
    status: 'completed',
    durationMs: result.durationMs,
    rulesEvaluated: result.rules.length,
  });
};

const emitFailedTelemetry = (
  telemetry: SectionQualityServiceDependencies['telemetry'],
  input: RunSectionInput,
  failure: NormalizedFailure
) => {
  telemetry.emitSectionRun({
    requestId: failure.requestId,
    runId: failure.runId,
    documentId: input.documentId,
    sectionId: input.sectionId,
    triggeredBy: input.triggeredBy,
    source: input.source,
    status: 'failed',
    durationMs: failure.durationMs,
    rulesEvaluated: 0,
    incidentId: failure.incidentId ?? undefined,
  });
};

const buildFallbackRevisionId = (sectionId: string, completedAt: Date): string => {
  return `rev-${sectionId}-${completedAt.getTime()}`;
};

export function createSectionQualityService(
  dependencies: SectionQualityServiceDependencies
): SectionQualityService {
  const clock = dependencies.clock ?? defaultClock;

  return {
    async runSection(input) {
      const startedAt = clock();

      try {
        const result = await dependencies.sectionRunner.run(input);

        dependencies.auditLogger.logQueued({
          requestId: result.requestId,
          runId: result.runId,
          documentId: input.documentId,
          sectionId: input.sectionId,
          triggeredBy: input.triggeredBy,
          source: input.source,
          scope: 'section',
          status: 'queued',
          queuedAt: startedAt.toISOString(),
        });

        dependencies.auditLogger.logCompleted({
          requestId: result.requestId,
          runId: result.runId,
          documentId: input.documentId,
          sectionId: input.sectionId,
          triggeredBy: input.triggeredBy,
          source: input.source,
          scope: 'section',
          status: 'completed',
          durationMs: result.durationMs,
          outcome: result.status,
          completedAt: result.completedAt.toISOString(),
        });

        emitCompletedTelemetry(dependencies.telemetry, result, input);

        if (dependencies.traceabilityQueue) {
          const resolvedRevisionId = dependencies.resolveSectionRevision
            ? await dependencies.resolveSectionRevision({
                sectionId: input.sectionId,
                documentId: input.documentId,
              })
            : null;
          const revisionId =
            resolvedRevisionId ?? buildFallbackRevisionId(input.sectionId, result.completedAt);

          await dependencies.traceabilityQueue.enqueueSectionSync({
            documentId: input.documentId,
            sectionId: input.sectionId,
            runId: result.runId,
            revisionId,
            status: result.status,
            triggeredBy: input.triggeredBy,
            source: input.source,
            completedAt: result.completedAt,
          });
        }

        return {
          status: 'running',
          requestId: result.requestId,
          runId: result.runId,
          triggeredBy: input.triggeredBy,
          sectionId: input.sectionId,
        };
      } catch (error) {
        const failure = normalizeFailure(error, startedAt, clock);

        dependencies.auditLogger.logFailed({
          requestId: failure.requestId,
          runId: failure.runId,
          documentId: input.documentId,
          sectionId: input.sectionId,
          triggeredBy: input.triggeredBy,
          source: input.source,
          scope: 'section',
          status: 'failed',
          durationMs: failure.durationMs,
          error: failure.error,
          incidentId: failure.incidentId ?? undefined,
          failedAt: failure.failedAt,
        });

        emitFailedTelemetry(dependencies.telemetry, input, failure);

        const repository = dependencies.repository;

        if (repository?.upsertResult) {
          const existing = repository.findBySectionId
            ? await repository.findBySectionId(input.sectionId)
            : null;

          const guidance = failure.incidentId
            ? [
                'Retry validation once the service is available again.',
                `Reference incident ${failure.incidentId} when contacting QA for follow-up.`,
              ]
            : [
                'Retry validation once the service is available again.',
                'Contact QA if the issue persists.',
              ];

          await repository.upsertResult({
            sectionId: input.sectionId,
            documentId: input.documentId,
            runId: failure.runId,
            status: 'Blocker',
            rules: [
              {
                ruleId: 'quality_gates.runner.unavailable',
                title: 'Quality gate validation unavailable',
                severity: 'Blocker',
                guidance,
                docLink: null,
              },
            ],
            triggeredBy: input.triggeredBy,
            source: input.source,
            durationMs: failure.durationMs,
            lastRunAt: new Date(failure.failedAt),
            lastSuccessAt: existing?.lastSuccessAt ?? null,
            remediationState: 'pending',
            incidentId: failure.incidentId,
          });
        }

        return {
          status: 'failed',
          incidentId: failure.incidentId,
          error: failure.error,
        };
      }
    },

    async getLatestResult(sectionId) {
      if (!dependencies.repository?.findBySectionId) {
        return null;
      }
      return dependencies.repository.findBySectionId(sectionId);
    },
  };
}

import { maxQualityGateStatus, type QualityGateStatus } from '../../shared/quality-gate-status.js';

export type RemediationState = 'pending' | 'in-progress' | 'resolved';

export interface SectionQualityRuleResult {
  ruleId: string;
  title: string;
  severity: QualityGateStatus;
  guidance: string[];
  docLink?: string | null;
  location?: {
    path: string;
    start: number;
    end: number;
  };
  resolvedAt?: Date | null;
}

export interface SectionQualityRunInput {
  sectionId: string;
  documentId: string;
  triggeredBy: string;
  source: 'auto' | 'manual' | 'dashboard';
}

export interface SectionQualityRunTelemetryPayload {
  requestId: string;
  runId: string;
  sectionId: string;
  documentId: string;
  triggeredBy: string;
  source: SectionQualityRunInput['source'];
  status: QualityGateStatus;
  durationMs: number;
  rulesEvaluated: number;
}

export interface SectionQualityRunPersistencePayload {
  sectionId: string;
  documentId: string;
  runId: string;
  status: QualityGateStatus;
  rules: SectionQualityRuleResult[];
  triggeredBy: string;
  source: SectionQualityRunInput['source'];
  durationMs: number;
  lastRunAt: Date;
  lastSuccessAt: Date | null;
  remediationState: RemediationState;
  incidentId?: string | null;
}

export interface SectionQualityRunnerDependencies {
  evaluateRules(
    input: SectionQualityRunInput & { runId: string; requestId: string }
  ): Promise<SectionQualityRuleResult[]>;
  persistResult(payload: SectionQualityRunPersistencePayload): Promise<void>;
  emitTelemetry(event: string, payload: SectionQualityRunTelemetryPayload): void;
  generateRunId(): string;
  getRequestId(): string;
  now(): number;
}

export interface SectionQualityRunResult {
  runId: string;
  requestId: string;
  sectionId: string;
  documentId: string;
  status: QualityGateStatus;
  rules: SectionQualityRuleResult[];
  durationMs: number;
  triggeredBy: string;
  source: SectionQualityRunInput['source'];
  completedAt: Date;
  lastSuccessAt: Date | null;
}

export interface SectionQualityRunner {
  run(input: SectionQualityRunInput): Promise<SectionQualityRunResult>;
}

const DEFAULT_SOURCE: SectionQualityRunInput['source'] = 'manual';

const determineRemediationState = (status: QualityGateStatus): RemediationState => {
  if (status === 'Pass') {
    return 'resolved';
  }
  if (status === 'Warning') {
    return 'in-progress';
  }
  if (status === 'Blocker') {
    return 'pending';
  }
  return 'pending';
};

export function createSectionQualityRunner(
  dependencies: SectionQualityRunnerDependencies
): SectionQualityRunner {
  const now = () => dependencies.now();

  return {
    async run(input) {
      const source = input.source ?? DEFAULT_SOURCE;
      const runId = dependencies.generateRunId();
      const requestId = dependencies.getRequestId();
      const startedAt = now();

      const rules = await dependencies.evaluateRules({ ...input, source, runId, requestId });

      const status =
        rules.length > 0
          ? maxQualityGateStatus(rules.map(rule => rule.severity))
          : ('Pass' as const);

      const completedTimestamp = now();
      const durationMs = Math.max(0, completedTimestamp - startedAt);
      const completedAt = new Date(completedTimestamp);
      const lastSuccessAt = status === 'Blocker' ? null : completedAt;
      const remediationState = determineRemediationState(status);

      await dependencies.persistResult({
        sectionId: input.sectionId,
        documentId: input.documentId,
        runId,
        status,
        rules,
        triggeredBy: input.triggeredBy,
        source,
        durationMs,
        lastRunAt: completedAt,
        lastSuccessAt,
        remediationState,
        incidentId: null,
      });

      dependencies.emitTelemetry('qualityGate.section.completed', {
        requestId,
        runId,
        sectionId: input.sectionId,
        documentId: input.documentId,
        triggeredBy: input.triggeredBy,
        source,
        status,
        durationMs,
        rulesEvaluated: rules.length,
      });

      return {
        runId,
        requestId,
        sectionId: input.sectionId,
        documentId: input.documentId,
        status,
        rules,
        durationMs,
        triggeredBy: input.triggeredBy,
        source,
        completedAt,
        lastSuccessAt,
      };
    },
  };
}

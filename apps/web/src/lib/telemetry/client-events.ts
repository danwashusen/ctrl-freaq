interface DraftEventPayload {
  draftKey: string;
  projectId: string;
  projectSlug: string;
  documentSlug: string;
  sectionPath: string;
  authorId: string;
}

interface QaStreamingMetricPayload {
  sessionId: string;
  sectionId: string;
  elapsedMs: number;
  stageLabel?: string;
  firstUpdateMs?: number | null;
  retryCount?: number;
  concurrencySlot?: number;
}

interface QaResequencePayload {
  sessionId: string;
  sectionId: string;
  reorderedCount: number;
  highestSequence: number;
}

interface QaCancelPayload {
  sessionId: string;
  sectionId: string;
  cancelReason: string;
  retryCount: number;
}

interface StreamingFallbackPayload {
  sessionId: string;
  sectionId: string;
  fallbackReason: string;
  preservedTokensCount?: number;
  retryAttempted?: boolean;
  elapsedMs?: number;
  cancelReason?: string;
  triggeredAt?: string;
}

interface QaFallbackPayload extends StreamingFallbackPayload {
  triggeredAt: string;
}

interface AssumptionStreamingMetricPayload {
  sessionId: string;
  sectionId: string;
  stageLabel?: string;
  elapsedMs: number;
  status: 'streaming' | 'deferred' | 'canceled';
}

interface AssumptionStreamingStatusPayload {
  sessionId: string;
  sectionId: string;
  status: 'deferred' | 'resumed' | 'canceled';
  reason?: string;
}

interface AssumptionStreamingResequencePayload {
  sessionId: string;
  sectionId: string;
  correctedCount: number;
  highestSequence: number;
}

interface QualityGateValidationMetricPayload {
  requestId: string;
  documentId: string;
  scope: 'section' | 'document';
  triggeredBy: string | null;
  durationMs: number;
  status: 'queued' | 'running' | 'completed' | 'failed';
  sectionId?: string;
  incidentId?: string;
  outcome?: 'Pass' | 'Warning' | 'Blocker' | 'Neutral';
}

interface QualityGateDashboardMetricPayload {
  requestId: string;
  documentId: string;
  triggeredBy: string | null;
  durationMs: number;
  publishBlocked: boolean;
  statusCounts: {
    pass: number;
    warning: number;
    blocker: number;
    neutral: number;
  };
}

type TelemetryEvent =
  | 'draft.saved'
  | 'draft.pruned'
  | 'draft.conflict'
  | 'compliance.warning'
  | 'qa.streaming.metric'
  | 'qa.streaming.resequence'
  | 'qa.streaming.cancelled'
  | 'qa.streaming.fallback'
  | 'assumptions.streaming.metric'
  | 'assumptions.streaming.status'
  | 'assumptions.streaming.resequence'
  | 'assumptions.streaming.fallback'
  | 'coauthor.streaming.fallback'
  | 'qualityGates.validation.metric'
  | 'qualityGates.dashboard.metric';

type ProjectTelemetryEvent = 'projects.lifecycle.create' | 'projects.dashboard.hydration';

const logToConsole = <T extends object>(
  level: 'info' | 'warn',
  event: TelemetryEvent,
  message: string,
  payload: T
) => {
  const consoleMethod =
    (console[level] as ((...args: unknown[]) => void) | undefined) ?? console.log;
  consoleMethod(`[draft.telemetry] ${event}`, {
    message,
    payload,
  });
  const serialized = JSON.stringify({ message, payload });
  consoleMethod(`[draft.telemetry] ${event}`, serialized);
};

const logProjectTelemetry = <T extends object>(
  level: 'info' | 'warn',
  event: ProjectTelemetryEvent,
  message: string,
  payload: T
) => {
  const consoleMethod =
    (console[level] as ((...args: unknown[]) => void) | undefined) ?? console.log;
  consoleMethod(`[projects.telemetry] ${event}`, {
    message,
    payload,
  });
  const serialized = JSON.stringify({ message, payload });
  consoleMethod(`[projects.telemetry] ${event}`, serialized);
};

const normalizeDurationMs = (value: number): number => {
  if (!Number.isFinite(value) || value <= 0) {
    return 0;
  }
  return Math.round(value);
};

export const emitDraftSaved = (payload: DraftEventPayload) => {
  logToConsole('info', 'draft.saved', 'Draft saved locally', payload);
};

export const emitDraftPruned = (payload: DraftEventPayload & { prunedKeys: string[] }) => {
  logToConsole('warn', 'draft.pruned', 'Draft pruned due to storage constraints', payload);
};

export const emitDraftConflict = (payload: DraftEventPayload & { reason: string }) => {
  logToConsole('warn', 'draft.conflict', 'Draft entered conflict state', payload);
};

export const emitComplianceWarning = (
  payload: DraftEventPayload & { policyId: string; detectedAt: string }
) => {
  logToConsole('warn', 'compliance.warning', 'Compliance warning captured client-side', payload);
};

export const emitQaStreamingMetric = (payload: QaStreamingMetricPayload) => {
  logToConsole('info', 'qa.streaming.metric', 'QA streaming metric recorded', payload);
};

export const emitQaStreamingResequence = (payload: QaResequencePayload) => {
  logToConsole(
    'info',
    'qa.streaming.resequence',
    'QA stream resequenced to recover ordering',
    payload
  );
};

export const emitQaStreamingCancel = (payload: QaCancelPayload) => {
  logToConsole('warn', 'qa.streaming.cancelled', 'QA streaming canceled client-side', payload);
};

export const emitQaStreamingFallback = (payload: QaFallbackPayload) => {
  logToConsole('warn', 'qa.streaming.fallback', 'QA streaming fallback engaged', payload);
};

export const emitCoAuthorStreamingFallback = (payload: StreamingFallbackPayload) => {
  logToConsole(
    'warn',
    'coauthor.streaming.fallback',
    'Co-author streaming fallback engaged',
    payload
  );
};

export const emitAssumptionStreamingFallback = (payload: StreamingFallbackPayload) => {
  logToConsole(
    'warn',
    'assumptions.streaming.fallback',
    'Assumption streaming fallback engaged',
    payload
  );
};

export const emitAssumptionStreamingMetric = (payload: AssumptionStreamingMetricPayload) => {
  const level = payload.status === 'canceled' ? 'warn' : 'info';
  logToConsole(
    level,
    'assumptions.streaming.metric',
    'Assumption streaming metric recorded',
    payload
  );
};

export const emitAssumptionStreamingStatus = (payload: AssumptionStreamingStatusPayload) => {
  const level = payload.status === 'canceled' ? 'warn' : 'info';
  logToConsole(
    level,
    'assumptions.streaming.status',
    'Assumption streaming status change',
    payload
  );
};

export const emitAssumptionStreamingResequence = (
  payload: AssumptionStreamingResequencePayload
) => {
  logToConsole(
    'info',
    'assumptions.streaming.resequence',
    'Assumption stream resequenced to recover ordering',
    payload
  );
};

export const emitQualityGateValidationMetric = (payload: QualityGateValidationMetricPayload) => {
  const durationMs =
    Number.isFinite(payload.durationMs) && payload.durationMs > 0
      ? Math.round(payload.durationMs)
      : 0;
  logToConsole(
    payload.status === 'failed' ? 'warn' : 'info',
    'qualityGates.validation.metric',
    'Quality gate validation metric recorded',
    {
      ...payload,
      durationMs,
    }
  );
};

export const emitQualityGateDashboardMetric = (payload: QualityGateDashboardMetricPayload) => {
  const durationMs = Number.isFinite(payload.durationMs) ? Math.max(0, payload.durationMs) : 0;
  const normalized = {
    ...payload,
    durationMs,
    scope: 'document' as const,
    emittedAt: new Date().toISOString(),
  };
  console.info('qualityGates.dashboard.metric', JSON.stringify(normalized));
};

interface ProjectCreateMetricPayload {
  durationMs: number;
  projectId?: string;
  visibility: string;
  result: 'success' | 'error';
  triggeredAt: string;
  requestId?: string;
  errorMessage?: string;
}

interface ProjectDashboardHydrationMetricPayload {
  durationMs: number;
  projectCount: number;
  includeArchived: boolean;
  search?: string;
  triggeredAt: string;
  requestId?: string;
  fromCache?: boolean;
}

export const emitProjectCreateMetric = (payload: ProjectCreateMetricPayload) => {
  const normalized = {
    durationMs: normalizeDurationMs(payload.durationMs),
    projectId: payload.projectId,
    visibility: payload.visibility,
    result: payload.result,
    triggeredAt: payload.triggeredAt,
    requestId: payload.requestId,
    errorMessage: payload.errorMessage,
  };
  const level: 'info' | 'warn' = payload.result === 'error' ? 'warn' : 'info';
  logProjectTelemetry(
    level,
    'projects.lifecycle.create',
    'Project lifecycle create metric recorded',
    normalized
  );
};

export const emitProjectDashboardHydrationMetric = (
  payload: ProjectDashboardHydrationMetricPayload
) => {
  const normalized = {
    durationMs: normalizeDurationMs(payload.durationMs),
    projectCount: payload.projectCount,
    includeArchived: payload.includeArchived,
    search:
      typeof payload.search === 'string' && payload.search.trim().length > 0
        ? payload.search.trim()
        : undefined,
    triggeredAt: payload.triggeredAt,
    requestId: payload.requestId,
    fromCache: Boolean(payload.fromCache),
  };

  logProjectTelemetry(
    'info',
    'projects.dashboard.hydration',
    'Project dashboard hydration metric recorded',
    normalized
  );
};

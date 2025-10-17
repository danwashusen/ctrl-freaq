type LoggerLevel = 'info' | 'warn' | 'error';

interface Logger {
  info(payload: Record<string, unknown>, message?: string): void;
  warn(payload: Record<string, unknown>, message?: string): void;
  error(payload: Record<string, unknown>, message?: string): void;
}

export type QualityGateScope = 'section' | 'document';

export interface QualityGateAuditBaseEvent {
  requestId: string;
  runId: string;
  documentId: string;
  scope: QualityGateScope;
  sectionId?: string;
  triggeredBy: string | null;
  source?: 'auto' | 'manual' | 'dashboard';
}

export interface QualityGateValidationQueuedEvent extends QualityGateAuditBaseEvent {
  status: 'queued';
  queuedAt?: string;
}

export interface QualityGateValidationCompletedEvent extends QualityGateAuditBaseEvent {
  status: 'completed';
  durationMs: number;
  outcome: 'Pass' | 'Warning' | 'Blocker' | 'Neutral';
  completedAt?: string;
}

export interface QualityGateValidationFailedEvent extends QualityGateAuditBaseEvent {
  status: 'failed';
  durationMs: number;
  error: string;
  incidentId?: string;
  failedAt?: string;
}

export type QualityGateAuditEvent =
  | QualityGateValidationQueuedEvent
  | QualityGateValidationCompletedEvent
  | QualityGateValidationFailedEvent;

const clampDuration = (value: number): number => {
  if (!Number.isFinite(value)) {
    return 0;
  }
  if (value < 0) {
    return 0;
  }
  return Math.round(value);
};

const emitLog = (
  logger: Logger,
  level: LoggerLevel,
  payload: Record<string, unknown>,
  message: string
) => {
  switch (level) {
    case 'info':
      logger.info(payload, message);
      break;
    case 'warn':
      logger.warn(payload, message);
      break;
    case 'error':
      logger.error(payload, message);
      break;
    default:
      logger.info(payload, message);
  }
};

const buildBasePayload = (event: QualityGateAuditBaseEvent): Record<string, unknown> => {
  const payload: Record<string, unknown> = {
    event: 'qualityGate.validation',
    requestId: event.requestId,
    runId: event.runId,
    documentId: event.documentId,
    scope: event.scope,
    triggeredBy: event.triggeredBy,
  };

  if (event.sectionId) {
    payload.sectionId = event.sectionId;
  }
  if (event.source) {
    payload.source = event.source;
  }

  return payload;
};

export interface QualityGateAuditLogger {
  logQueued(event: QualityGateValidationQueuedEvent): void;
  logCompleted(event: QualityGateValidationCompletedEvent): void;
  logFailed(event: QualityGateValidationFailedEvent): void;
}

export function createQualityGateAuditLogger(logger: Logger): QualityGateAuditLogger {
  return {
    logQueued(event) {
      const payload = {
        ...buildBasePayload(event),
        status: event.status,
        queuedAt: event.queuedAt ?? new Date().toISOString(),
      };
      emitLog(logger, 'info', payload, 'Quality gate validation queued');
    },

    logCompleted(event) {
      const payload = {
        ...buildBasePayload(event),
        status: event.status,
        outcome: event.outcome,
        durationMs: clampDuration(event.durationMs),
        completedAt: event.completedAt ?? new Date().toISOString(),
      };
      emitLog(logger, 'info', payload, 'Quality gate validation completed');
    },

    logFailed(event) {
      const payload = {
        ...buildBasePayload(event),
        status: event.status,
        durationMs: clampDuration(event.durationMs),
        error: event.error,
        incidentId: event.incidentId,
        failedAt: event.failedAt ?? new Date().toISOString(),
      };
      emitLog(logger, 'error', payload, 'Quality gate validation failed');
    },
  };
}

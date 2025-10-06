interface DraftEventPayload {
  draftKey: string;
  projectSlug: string;
  documentSlug: string;
  sectionPath: string;
  authorId: string;
}

type TelemetryEvent = 'draft.saved' | 'draft.pruned' | 'draft.conflict' | 'compliance.warning';

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

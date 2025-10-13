export type QueueCancellationReason =
  | 'author_cancelled'
  | 'replaced_by_new_request'
  | 'transport_failure'
  | 'deferred';

export interface SectionStreamQueueRequest {
  sessionId: string;
  sectionId: string;
  enqueuedAt: number;
}

type QueueState = 'active' | 'pending';

export interface SectionStreamQueueOptions {
  onCancel?: (details: {
    sessionId: string;
    sectionId: string;
    reason: QueueCancellationReason;
    state: QueueState;
  }) => void;
}

interface ActiveSession {
  sessionId: string;
  sectionId: string;
  enqueuedAt: number;
  startedAt: number;
  concurrencySlot: number;
}

interface PendingSession {
  sessionId: string;
  sectionId: string;
  enqueuedAt: number;
}

export interface SectionStreamQueueSnapshot {
  active: Map<string, ActiveSession>;
  pending: Map<string, PendingSession>;
}

export interface EnqueueStartResult {
  disposition: 'started';
  sessionId: string;
  sectionId: string;
  concurrencySlot: number;
  replacedSessionId: null;
}

export interface EnqueuePendingResult {
  disposition: 'pending';
  sessionId: string;
  sectionId: string;
  replacedSessionId: string | null;
}

export type EnqueueResult = EnqueueStartResult | EnqueuePendingResult;

export interface CompleteResult {
  releasedSessionId: string;
  activated: {
    sessionId: string;
    sectionId: string;
    concurrencySlot: number;
  } | null;
}

export interface CancelResult {
  released: boolean;
  reason: QueueCancellationReason;
  promoted: {
    sessionId: string;
    sectionId: string;
    concurrencySlot: number;
  } | null;
}

interface SessionLookupEntry {
  state: QueueState;
  sectionId: string;
}

const cloneActiveSessions = (source: Map<string, ActiveSession>): Map<string, ActiveSession> => {
  return new Map(
    Array.from(source.entries()).map(([sectionId, session]) => [sectionId, { ...session }])
  );
};

const clonePendingSessions = (source: Map<string, PendingSession>): Map<string, PendingSession> => {
  return new Map(
    Array.from(source.entries()).map(([sectionId, session]) => [sectionId, { ...session }])
  );
};

export const createSectionStreamQueue = (
  options: SectionStreamQueueOptions = {}
): {
  enqueue: (request: SectionStreamQueueRequest) => EnqueueResult;
  complete: (sessionId: string) => CompleteResult | null;
  cancel: (sessionId: string, reason: QueueCancellationReason) => CancelResult;
  snapshot: () => SectionStreamQueueSnapshot;
} => {
  const onCancel = options.onCancel ?? (() => {});

  const activeBySection = new Map<string, ActiveSession>();
  const pendingBySection = new Map<string, PendingSession>();
  const sessionIndex = new Map<string, SessionLookupEntry>();

  const calculateConcurrencySlot = (): number => activeBySection.size + 1;

  const startSession = (request: SectionStreamQueueRequest): EnqueueStartResult => {
    const concurrencySlot = calculateConcurrencySlot();
    const activeSession: ActiveSession = {
      sessionId: request.sessionId,
      sectionId: request.sectionId,
      enqueuedAt: request.enqueuedAt,
      startedAt: Date.now(),
      concurrencySlot,
    };

    activeBySection.set(request.sectionId, activeSession);
    sessionIndex.set(request.sessionId, { state: 'active', sectionId: request.sectionId });

    return {
      disposition: 'started',
      sessionId: request.sessionId,
      sectionId: request.sectionId,
      concurrencySlot,
      replacedSessionId: null,
    };
  };

  const replacePending = (request: SectionStreamQueueRequest): PendingSession | null => {
    const existingPending = pendingBySection.get(request.sectionId) ?? null;

    if (existingPending) {
      onCancel({
        sessionId: existingPending.sessionId,
        sectionId: existingPending.sectionId,
        reason: 'replaced_by_new_request',
        state: 'pending',
      });
      sessionIndex.delete(existingPending.sessionId);
    }

    const pendingSession: PendingSession = {
      sessionId: request.sessionId,
      sectionId: request.sectionId,
      enqueuedAt: request.enqueuedAt,
    };

    pendingBySection.set(request.sectionId, pendingSession);
    sessionIndex.set(request.sessionId, { state: 'pending', sectionId: request.sectionId });

    return existingPending;
  };

  const promotePending = (sectionId: string): EnqueueStartResult | null => {
    const pending = pendingBySection.get(sectionId);
    if (!pending) {
      return null;
    }

    pendingBySection.delete(sectionId);
    sessionIndex.delete(pending.sessionId);

    return startSession(pending);
  };

  const enqueue = (request: SectionStreamQueueRequest): EnqueueResult => {
    const active = activeBySection.get(request.sectionId);

    if (!active) {
      pendingBySection.delete(request.sectionId);
      sessionIndex.delete(request.sessionId);
      return startSession(request);
    }

    const replaced = replacePending(request);
    return {
      disposition: 'pending',
      sessionId: request.sessionId,
      sectionId: request.sectionId,
      replacedSessionId: replaced?.sessionId ?? null,
    };
  };

  const complete = (sessionId: string): CompleteResult | null => {
    const lookup = sessionIndex.get(sessionId);
    if (!lookup || lookup.state !== 'active') {
      return null;
    }

    activeBySection.delete(lookup.sectionId);
    sessionIndex.delete(sessionId);

    const promotedResult = promotePending(lookup.sectionId);

    return {
      releasedSessionId: sessionId,
      activated: promotedResult
        ? {
            sessionId: promotedResult.sessionId,
            sectionId: promotedResult.sectionId,
            concurrencySlot: promotedResult.concurrencySlot,
          }
        : null,
    };
  };

  const cancel = (sessionId: string, reason: QueueCancellationReason): CancelResult => {
    const lookup = sessionIndex.get(sessionId);
    if (!lookup) {
      return {
        released: false,
        reason,
        promoted: null,
      };
    }

    sessionIndex.delete(sessionId);

    if (lookup.state === 'pending') {
      pendingBySection.delete(lookup.sectionId);
      onCancel({
        sessionId,
        sectionId: lookup.sectionId,
        reason,
        state: 'pending',
      });

      return {
        released: true,
        reason,
        promoted: null,
      };
    }

    activeBySection.delete(lookup.sectionId);
    onCancel({
      sessionId,
      sectionId: lookup.sectionId,
      reason,
      state: 'active',
    });

    const promotedResult = promotePending(lookup.sectionId);

    return {
      released: true,
      reason,
      promoted: promotedResult
        ? {
            sessionId: promotedResult.sessionId,
            sectionId: promotedResult.sectionId,
            concurrencySlot: promotedResult.concurrencySlot,
          }
        : null,
    };
  };

  const snapshot = (): SectionStreamQueueSnapshot => ({
    active: cloneActiveSessions(activeBySection),
    pending: clonePendingSessions(pendingBySection),
  });

  return {
    enqueue,
    complete,
    cancel,
    snapshot,
  };
};

export type SectionStreamQueue = ReturnType<typeof createSectionStreamQueue>;

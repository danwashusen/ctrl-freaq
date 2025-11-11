import { useCallback, useEffect, useMemo, useReducer, useRef } from 'react';

import {
  subscribeToSession as defaultSubscribeToSession,
  type CoAuthoringStreamEvent,
} from '../api/co-authoring.client';
import {
  postDocumentQaReview as defaultPostDocumentQaReview,
  postDocumentQaCancel as defaultPostDocumentQaCancel,
  postDocumentQaRetry as defaultPostDocumentQaRetry,
} from '../api/document-qa.client';
import { useDocumentQaStore, type DocumentQaSession } from '../stores/document-qa-store';
import type { StreamProgressState } from '../stores/co-authoring-store';
import { createStreamingProgressTracker } from '../../../lib/streaming/progress-tracker';
import {
  emitQaStreamingCancel,
  emitQaStreamingFallback,
  emitQaStreamingMetric,
  emitQaStreamingResequence,
} from '../../../lib/telemetry/client-events';

export interface UseDocumentQaSessionOptions {
  documentId?: string | null;
  sectionId?: string | null;
  reviewerId?: string | null;
  promptBuilder?: (context: { documentId: string; sectionId: string }) => string;
  api?: {
    startReview?: typeof defaultPostDocumentQaReview;
    cancelReview?: typeof defaultPostDocumentQaCancel;
    retryReview?: typeof defaultPostDocumentQaRetry;
    subscribeToSession?: (
      sessionId: string,
      handler: (event: CoAuthoringStreamEvent) => void,
      options?: {
        eventSourceFactory?: (url: string, init?: EventSourceInit) => EventSource;
        streamPath?: string;
      }
    ) => { close: () => void };
  };
}

const createSessionId = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `qa-session-${crypto.randomUUID()}`;
  }
  return `qa-session-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
};

const defaultPromptBuilder = ({
  documentId,
  sectionId,
}: {
  documentId: string;
  sectionId: string;
}): string => {
  return `Review document ${documentId} section ${sectionId} for completeness, risks, and quality gates.`;
};

export function useDocumentQaSession(options: UseDocumentQaSessionOptions = {}) {
  const {
    documentId = null,
    sectionId = null,
    reviewerId = null,
    api,
    promptBuilder: providedPromptBuilder,
  } = options;

  const startReview = api?.startReview ?? defaultPostDocumentQaReview;
  const cancelReview = api?.cancelReview ?? defaultPostDocumentQaCancel;
  const retryReview = api?.retryReview ?? defaultPostDocumentQaRetry;
  const subscribeToSession = api?.subscribeToSession ?? defaultSubscribeToSession;
  const promptBuilder = providedPromptBuilder ?? defaultPromptBuilder;

  const session = useDocumentQaStore(state => state.session);
  const progress = useDocumentQaStore(state => state.progress);
  const transcript = useDocumentQaStore(state => state.transcript);
  const replacementNotice = useDocumentQaStore(state => state.replacementNotice);
  const startSession = useDocumentQaStore(state => state.startSession);
  const appendTranscriptToken = useDocumentQaStore(state => state.appendTranscriptToken);
  const clearTranscript = useDocumentQaStore(state => state.clearTranscript);
  const updateProgress = useDocumentQaStore(state => state.updateProgress);
  const setReplacementNotice = useDocumentQaStore(state => state.setReplacementNotice);
  const resetStore = useDocumentQaStore(state => state.reset);

  const subscriptionRef = useRef<{ close: () => void; sessionId: string } | null>(null);
  const tokenBufferRef = useRef<Map<number, string>>(new Map());
  const expectedTokenSequenceRef = useRef<number>(1);
  const firstProgressRecordedRef = useRef<boolean>(false);
  const resequenceStatsRef = useRef<{ pending: number; highest: number }>({
    pending: 0,
    highest: 0,
  });
  const fallbackEmittedRef = useRef<boolean>(false);
  const [, forceRender] = useReducer(count => count + 1, 0);

  const progressTrackerRef = useRef(
    createStreamingProgressTracker({
      interaction: 'document-qa',
      announce: announcement => {
        if (typeof window !== 'undefined') {
          window.dispatchEvent(
            new CustomEvent('document-qa:announcement', { detail: announcement })
          );
        }
      },
    })
  );

  const closeSubscription = useCallback(() => {
    subscriptionRef.current?.close();
    subscriptionRef.current = null;
  }, []);

  const resetStreamingState = useCallback(() => {
    tokenBufferRef.current.clear();
    expectedTokenSequenceRef.current = 1;
    firstProgressRecordedRef.current = false;
    resequenceStatsRef.current = { pending: 0, highest: 0 };
    fallbackEmittedRef.current = false;
  }, []);

  const cancelStreaming = useCallback(() => {
    resetStreamingState();
    setReplacementNotice(null);

    const currentProgress = useDocumentQaStore.getState().progress;
    const currentSession = useDocumentQaStore.getState().session;
    const nextRetry = (currentProgress.retryCount ?? 0) + 1;
    const elapsedMs = currentProgress.elapsedMs ?? 0;

    if (currentSession) {
      void cancelReview({
        documentId: currentSession.documentId,
        sectionId: currentSession.sectionId,
        sessionId: currentSession.sessionId,
        reason: 'author_cancelled',
      }).catch(() => {
        /* noop — client still treats cancellation as complete */
      });
    }

    progressTrackerRef.current.update({
      status: 'canceled',
      elapsedMs,
      reason: 'author_cancelled',
      cancelReason: 'author_cancelled',
      retryCount: nextRetry,
    });

    if (currentSession) {
      emitQaStreamingCancel({
        sessionId: currentSession.sessionId,
        sectionId: currentSession.sectionId,
        cancelReason: 'author_cancelled',
        retryCount: nextRetry,
      });
    }

    updateProgress({
      status: 'canceled',
      elapsedMs,
      cancelReason: 'author_cancelled',
      retryCount: nextRetry,
      stageLabel: undefined,
      firstUpdateMs: currentProgress.firstUpdateMs ?? null,
    });
    forceRender();
  }, [cancelReview, resetStreamingState, setReplacementNotice, updateProgress]);

  const ensureSubscription = useCallback(
    (activeSession: DocumentQaSession) => {
      if (subscriptionRef.current?.sessionId === activeSession.sessionId) {
        return;
      }

      if (
        subscriptionRef.current &&
        subscriptionRef.current.sessionId !== activeSession.sessionId
      ) {
        subscriptionRef.current.close();
        subscriptionRef.current = null;
      }

      const streamPath =
        activeSession.streamLocation ?? `/document-qa/sessions/${activeSession.sessionId}/events`;

      const subscription = subscribeToSession(
        activeSession.sessionId,
        (event: CoAuthoringStreamEvent) => {
          if (event.type === 'state') {
            const fallbackStatus = (() => {
              switch (event.status) {
                case 'fallback_active':
                  return 'active' as const;
                case 'fallback_completed':
                  return 'completed' as const;
                case 'fallback_canceled':
                  return 'canceled' as const;
                case 'fallback_failed':
                  return 'failed' as const;
                default:
                  return null;
              }
            })();

            if (fallbackStatus) {
              const reason = event.fallbackReason ?? 'assistant_unavailable';
              const preservedTokens =
                typeof event.preservedTokensCount === 'number' &&
                Number.isFinite(event.preservedTokensCount)
                  ? event.preservedTokensCount
                  : undefined;
              const elapsed =
                typeof event.elapsedMs === 'number' && Number.isFinite(event.elapsedMs)
                  ? event.elapsedMs
                  : progress.elapsedMs;

              const statusForProgress: StreamProgressState['status'] =
                fallbackStatus === 'canceled'
                  ? 'canceled'
                  : fallbackStatus === 'failed'
                    ? 'error'
                    : 'fallback';

              updateProgress({
                status: statusForProgress,
                elapsedMs: elapsed,
                fallbackReason: reason,
                preservedTokens,
                delivery: event.delivery ?? 'fallback',
                cancelReason: fallbackStatus === 'canceled' ? reason : undefined,
              });

              progressTrackerRef.current.update({
                status: statusForProgress === 'fallback' ? 'fallback' : statusForProgress,
                elapsedMs: elapsed,
                reason,
                preservedTokens,
              });

              const activeSession = useDocumentQaStore.getState().session;
              if (activeSession && fallbackStatus === 'active' && !fallbackEmittedRef.current) {
                emitQaStreamingFallback({
                  sessionId: activeSession.sessionId,
                  sectionId: activeSession.sectionId,
                  fallbackReason: reason,
                  triggeredAt: new Date().toISOString(),
                  preservedTokensCount: preservedTokens,
                  retryAttempted: event.retryAttempted ?? false,
                  elapsedMs: elapsed,
                });
                fallbackEmittedRef.current = true;
              }

              if (
                fallbackStatus === 'completed' ||
                fallbackStatus === 'failed' ||
                fallbackStatus === 'canceled'
              ) {
                fallbackEmittedRef.current = false;
              }

              forceRender();
            }

            return;
          }

          if (event.type === 'progress') {
            const mappedStatus = (() => {
              if (event.status === 'canceled') {
                return 'canceled';
              }
              if (event.status === 'awaiting-approval') {
                return 'awaiting-approval';
              }
              if (event.status === 'queued') {
                return 'queued';
              }
              if (event.status === 'fallback') {
                return 'fallback';
              }
              if (event.status === 'streaming') {
                return 'streaming';
              }
              if (event.status === 'error') {
                return 'error';
              }
              return 'idle';
            })();

            const nextProgress: Partial<typeof progress> & {
              status: typeof progress.status;
            } = {
              status: mappedStatus,
              elapsedMs: event.elapsedMs,
            };

            if (typeof event.stage === 'string' && event.stage.trim()) {
              nextProgress.stageLabel = event.stage.trim();
            }

            if (!firstProgressRecordedRef.current && mappedStatus === 'streaming') {
              nextProgress.firstUpdateMs = event.elapsedMs;
              firstProgressRecordedRef.current = true;
            }

            if (event.cancelReason) {
              nextProgress.cancelReason = event.cancelReason;
            }

            if (typeof event.retryCount === 'number' && Number.isFinite(event.retryCount)) {
              nextProgress.retryCount = event.retryCount;
            }

            if (event.replacement?.previousSessionId) {
              setReplacementNotice({
                previousSessionId: event.replacement.previousSessionId,
                replacedAt: new Date().toISOString(),
                promotedSessionId: event.replacement.promotedSessionId ?? null,
              });
            }

            if (event.fallbackReason) {
              nextProgress.fallbackReason = event.fallbackReason;
            }

            if (typeof event.preservedTokensCount === 'number') {
              nextProgress.preservedTokens = event.preservedTokensCount;
            }

            if (event.delivery) {
              nextProgress.delivery = event.delivery;
            }

            progressTrackerRef.current.update({
              status: mappedStatus,
              elapsedMs: event.elapsedMs,
              cancelReason: event.cancelReason,
              retryCount: event.retryCount,
              reason: event.fallbackReason,
              preservedTokens: event.preservedTokensCount,
            });

            updateProgress(nextProgress);
            forceRender();

            const latestState = useDocumentQaStore.getState();
            const activeSession = latestState.session;

            if (activeSession) {
              emitQaStreamingMetric({
                sessionId: activeSession.sessionId,
                sectionId: activeSession.sectionId,
                elapsedMs: event.elapsedMs,
                stageLabel: latestState.progress.stageLabel,
                firstUpdateMs: latestState.progress.firstUpdateMs ?? null,
                retryCount: latestState.progress.retryCount,
                concurrencySlot: (event as { concurrencySlot?: number }).concurrencySlot,
              });
            }
            return;
          }

          if (event.type === 'token') {
            const sequence =
              typeof event.sequence === 'number' && Number.isFinite(event.sequence)
                ? event.sequence
                : undefined;

            const emitToken = (token: string) => {
              appendTranscriptToken(token);
              forceRender();
            };

            if (sequence !== undefined) {
              if (sequence !== expectedTokenSequenceRef.current) {
                resequenceStatsRef.current.pending += 1;
              }
              resequenceStatsRef.current.highest = Math.max(
                resequenceStatsRef.current.highest,
                sequence
              );

              tokenBufferRef.current.set(sequence, event.value);
              let flushed = false;
              while (tokenBufferRef.current.has(expectedTokenSequenceRef.current)) {
                const nextValue = tokenBufferRef.current.get(expectedTokenSequenceRef.current);
                tokenBufferRef.current.delete(expectedTokenSequenceRef.current);
                expectedTokenSequenceRef.current += 1;
                if (typeof nextValue === 'string') {
                  emitToken(nextValue);
                }
                flushed = true;
              }

              if (flushed && resequenceStatsRef.current.pending > 0) {
                const activeSession = useDocumentQaStore.getState().session;
                if (activeSession) {
                  emitQaStreamingResequence({
                    sessionId: activeSession.sessionId,
                    sectionId: activeSession.sectionId,
                    reorderedCount: resequenceStatsRef.current.pending,
                    highestSequence: Math.max(
                      resequenceStatsRef.current.highest,
                      expectedTokenSequenceRef.current - 1
                    ),
                  });
                }
                resequenceStatsRef.current.pending = 0;
                resequenceStatsRef.current.highest = expectedTokenSequenceRef.current - 1;
              }
              return;
            }

            emitToken(event.value);
            forceRender();
            return;
          }

          if (event.type === 'error') {
            progressTrackerRef.current.update({
              status: 'error',
              elapsedMs: progress.elapsedMs,
              reason: event.message,
            });
            updateProgress({ status: 'error', elapsedMs: progress.elapsedMs });
            forceRender();
          }
        },
        { streamPath }
      );

      subscriptionRef.current = {
        sessionId: activeSession.sessionId,
        close: subscription.close,
      };
    },
    [
      appendTranscriptToken,
      progress,
      setReplacementNotice,
      subscribeToSession,
      updateProgress,
      forceRender,
    ]
  );

  const ensureSession = useCallback(async (): Promise<DocumentQaSession | null> => {
    if (!documentId || !sectionId || !reviewerId) {
      return null;
    }

    const storeState = useDocumentQaStore.getState();
    const existingSession = storeState.session;
    const currentProgress = storeState.progress;
    const activeStatuses: StreamProgressState['status'][] = [
      'streaming',
      'queued',
      'fallback',
      'awaiting-approval',
    ];

    if (
      existingSession &&
      existingSession.sectionId === sectionId &&
      activeStatuses.includes(currentProgress.status)
    ) {
      ensureSubscription(existingSession);
      return existingSession;
    }

    const retryingExistingSession =
      !!existingSession &&
      existingSession.sectionId === sectionId &&
      !activeStatuses.includes(currentProgress.status);

    if (existingSession && existingSession.sectionId !== sectionId) {
      void cancelReview({
        documentId: existingSession.documentId,
        sectionId: existingSession.sectionId,
        sessionId: existingSession.sessionId,
        reason: 'replaced_by_new_request',
      }).catch(() => {
        /* ignore cleanup failure */
      });
    }

    const now = new Date();
    const startedAtIso = now.toISOString();

    closeSubscription();
    resetStreamingState();
    clearTranscript();

    let responseStreamLocation: string | null = null;
    let queueDisposition: 'started' | 'pending';
    let replacementPolicy: 'newest_replaces_pending';
    let replacedSessionId: string | null;
    let concurrencySlot: number | undefined;
    let nextSessionId: string;
    let deliveryMode: 'streaming' | 'fallback' = 'streaming';
    let deliveryReason: string | null = null;

    if (retryingExistingSession && existingSession) {
      const retryResult = await retryReview({
        documentId,
        sectionId,
        sessionId: existingSession.sessionId,
      });
      responseStreamLocation = retryResult.streamLocation;
      queueDisposition = retryResult.body.queue.disposition;
      replacementPolicy = retryResult.body.queue.replacementPolicy;
      replacedSessionId = retryResult.body.queue.replacedSessionId;
      concurrencySlot = retryResult.body.queue.concurrencySlot;
      nextSessionId = retryResult.body.sessionId;
    } else {
      const prompt = promptBuilder({ documentId, sectionId });
      const startResult = await startReview({
        documentId,
        sectionId,
        reviewerId,
        sessionId: createSessionId(),
        prompt,
      });
      responseStreamLocation = startResult.streamLocation;
      queueDisposition = startResult.body.queue.disposition;
      replacementPolicy = startResult.body.queue.replacementPolicy;
      replacedSessionId = startResult.body.queue.replacedSessionId;
      concurrencySlot = startResult.body.queue.concurrencySlot;
      nextSessionId = startResult.body.sessionId;
      deliveryMode = startResult.body.delivery.mode;
      deliveryReason = startResult.body.delivery.reason ?? null;
    }

    const streamLocation =
      responseStreamLocation ?? `/document-qa/sessions/${nextSessionId}/events`;

    const newSession: DocumentQaSession = {
      sessionId: nextSessionId,
      documentId,
      sectionId,
      reviewerId,
      startedAt: startedAtIso,
      streamState: queueDisposition === 'pending' ? 'queued' : 'streaming',
      streamLocation,
      queueDisposition,
      replacementPolicy,
      concurrencySlot: concurrencySlot ?? null,
      replacedSessionId,
    };

    resetStore();
    startSession(newSession);

    if (replacedSessionId) {
      setReplacementNotice({
        previousSessionId: replacedSessionId,
        replacedAt: startedAtIso,
        promotedSessionId: null,
      });
    } else {
      setReplacementNotice(null);
    }

    const nextRetryCount = retryingExistingSession
      ? (currentProgress.retryCount ?? 0) + 1
      : (currentProgress.retryCount ?? 0);
    const initialStatus: StreamProgressState['status'] =
      queueDisposition === 'pending' ? 'queued' : 'streaming';

    updateProgress({
      status: initialStatus,
      elapsedMs: 0,
      retryCount: nextRetryCount,
      cancelReason: null,
      fallbackReason: deliveryMode === 'fallback' ? (deliveryReason ?? 'transport_blocked') : null,
      preservedTokens: null,
      delivery: deliveryMode,
      stageLabel: undefined,
      firstUpdateMs: null,
    });

    if (deliveryMode === 'fallback') {
      progressTrackerRef.current.update({
        status: 'fallback',
        elapsedMs: 0,
        reason: deliveryReason ?? 'transport_blocked',
      });
      fallbackEmittedRef.current = false;
    } else {
      progressTrackerRef.current.update({
        status: initialStatus,
        elapsedMs: 0,
      });
    }

    ensureSubscription(newSession);
    forceRender();
    return newSession;
  }, [
    documentId,
    sectionId,
    reviewerId,
    ensureSubscription,
    retryReview,
    promptBuilder,
    startReview,
    cancelReview,
    resetStreamingState,
    clearTranscript,
    closeSubscription,
    resetStore,
    startSession,
    setReplacementNotice,
    updateProgress,
    forceRender,
  ]);

  const teardown = useCallback(() => {
    cancelStreaming();
    closeSubscription();
    resetStore();
  }, [cancelStreaming, closeSubscription, resetStore]);

  const isEditorLocked = progress.status === 'awaiting-approval';

  useEffect(() => {
    const buffer = tokenBufferRef.current;
    return () => {
      closeSubscription();
      buffer.clear();
    };
  }, [closeSubscription]);

  const progressSnapshot = useMemo(() => ({ ...progress }), [progress]);

  return useMemo(
    () => ({
      session,
      progress: progressSnapshot,
      transcript,
      replacementNotice,
      ensureSession,
      cancelStreaming,
      teardown,
      isEditorLocked,
    }),
    [
      cancelStreaming,
      ensureSession,
      isEditorLocked,
      progressSnapshot,
      replacementNotice,
      session,
      teardown,
      transcript,
    ]
  );
}

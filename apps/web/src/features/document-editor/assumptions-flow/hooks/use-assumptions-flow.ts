import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  createAssumptionSessionStore,
  type AssumptionSessionSnapshot,
} from '@ctrl-freaq/editor-persistence/assumption-sessions/session-store';

import {
  createAssumptionsFlowBootstrap,
  type AssumptionFlowState,
  type RespondToPromptOptions,
  type StartAssumptionsFlowOptions,
} from '..';
import type { AssumptionAction } from '../../types/assumption-session';
import { useDocumentStore } from '../../stores/document-store';
import { assumptionsApi } from '../../services/assumptions-api';
import {
  emitAssumptionStreamingMetric,
  emitAssumptionStreamingResequence,
  emitAssumptionStreamingStatus,
  emitAssumptionStreamingFallback,
} from '@/lib/telemetry/client-events';
import {
  buildFallbackProgressCopy,
  resolveCoAuthorFallbackMessage,
  resolveFallbackAnnouncement,
  resolveFallbackCancelMessage,
} from '@/lib/streaming/fallback-messages';

const INITIAL_STREAMING_STATE: UseAssumptionsFlowResult['streaming'] = {
  status: 'idle',
  announcements: [],
  bullets: [],
  hasOutOfOrder: false,
  fallback: null,
};

const resolveStatusAnnouncement = (status: string): string | null => {
  switch (status) {
    case 'deferred':
      return 'Assumption guidance deferred';
    case 'resumed':
    case 'streaming':
      return 'Assumption guidance resumed';
    case 'canceled':
      return 'Assumption guidance canceled';
    case 'completed':
      return 'Assumption guidance completed';
    default:
      return null;
  }
};

interface UseAssumptionsFlowOptions {
  sectionId?: string | null;
  documentId: string;
  templateVersion?: string;
  decisionSnapshotId?: string;
  enabled?: boolean;
  api?: {
    subscribeToStream?: (
      sectionId: string,
      sessionId: string,
      handler: (event: { type: string; data: unknown }) => void
    ) => { close: () => void };
  };
}

interface RespondPayload {
  answer?: string;
  notes?: string;
  overrideJustification?: string;
}

interface UseAssumptionsFlowResult {
  state: AssumptionFlowState | null;
  isLoading: boolean;
  error: string | null;
  respond: (promptId: string, action: AssumptionAction, payload?: RespondPayload) => Promise<void>;
  reset: () => void;
  streaming: {
    status: 'idle' | 'streaming' | 'deferred' | 'canceled' | 'fallback';
    announcements: string[];
    bullets: Array<{ sequence: number; stageLabel: string; content: string | null }>;
    hasOutOfOrder: boolean;
    fallback: {
      status: 'active' | 'completed' | 'canceled' | 'failed';
      reason: string;
      message: string;
      progressCopy?: string;
      preservedTokens?: number;
      elapsedMs?: number;
      retryAttempted?: boolean;
    } | null;
  };
}

export function useAssumptionsFlow({
  sectionId,
  documentId,
  templateVersion,
  decisionSnapshotId,
  enabled = true,
  api,
}: UseAssumptionsFlowOptions): UseAssumptionsFlowResult {
  const [state, setState] = useState<AssumptionFlowState | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [streaming, setStreaming] = useState<UseAssumptionsFlowResult['streaming']>(() => ({
    ...INITIAL_STREAMING_STATE,
  }));
  const sessionStoreRef = useRef(createAssumptionSessionStore());
  const bootstrapRef = useRef(
    createAssumptionsFlowBootstrap({ sessionStore: sessionStoreRef.current })
  );
  const lastSequenceRef = useRef(0);
  const streamSubscriptionRef = useRef<{ close: () => void } | null>(null);
  const resequenceCountRef = useRef(0);
  const fallbackLoggedRef = useRef(false);

  const setAssumptionSession = useDocumentStore(store => store.setAssumptionSession);

  const reset = useCallback(() => {
    streamSubscriptionRef.current?.close();
    streamSubscriptionRef.current = null;
    lastSequenceRef.current = 0;
    resequenceCountRef.current = 0;
    fallbackLoggedRef.current = false;
    setStreaming({ ...INITIAL_STREAMING_STATE });
    setState(null);
    setError(null);
  }, []);

  useEffect(() => {
    if (!enabled || !sectionId) {
      reset();
      return;
    }

    let cancelled = false;
    const loadSession = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const sessions = await sessionStoreRef.current.listSessions();
        const existing = sessions.find(
          (snapshot: AssumptionSessionSnapshot) => snapshot.sectionId === sectionId
        );
        let nextState: AssumptionFlowState;

        if (existing) {
          nextState = await bootstrapRef.current.resume({ sessionId: existing.sessionId });
        } else {
          const startOptions: StartAssumptionsFlowOptions = {
            sectionId,
            documentId,
            templateVersion,
            decisionSnapshotId,
          };
          nextState = await bootstrapRef.current.start(startOptions);
        }

        if (cancelled) {
          return;
        }

        setState(nextState);
        setAssumptionSession(sectionId, nextState);
      } catch (unknownError) {
        if (cancelled) {
          return;
        }

        const message =
          unknownError instanceof Error ? unknownError.message : 'Failed to load assumption flow.';
        setError(message);
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void loadSession();

    return () => {
      cancelled = true;
    };
  }, [
    decisionSnapshotId,
    documentId,
    enabled,
    sectionId,
    templateVersion,
    reset,
    setAssumptionSession,
  ]);

  useEffect(() => {
    const activeState = state;

    if (!enabled || !sectionId || !activeState) {
      streamSubscriptionRef.current?.close();
      streamSubscriptionRef.current = null;
      lastSequenceRef.current = 0;
      setStreaming({ ...INITIAL_STREAMING_STATE });
      return;
    }

    const subscribeToStream =
      api?.subscribeToStream ?? assumptionsApi.subscribeToStream?.bind(assumptionsApi);

    if (typeof subscribeToStream !== 'function') {
      return;
    }

    streamSubscriptionRef.current?.close();
    lastSequenceRef.current = 0;
    resequenceCountRef.current = 0;
    setStreaming({ ...INITIAL_STREAMING_STATE });

    const currentSessionId = activeState.sessionId;
    const sectionIdentifier = sectionId as string;

    const handleEvent = (event: { type: string; data: unknown }) => {
      if (!event || typeof event !== 'object') {
        return;
      }

      if (event.type === 'progress') {
        const data = event.data as {
          sequence?: number;
          stageLabel?: string;
          contentSnippet?: string | null;
          status?: string;
          delivery?: string;
          deliveryChannel?: string;
          fallbackReason?: string;
          preservedTokensCount?: number;
          elapsedMs?: number;
          retryAttempted?: boolean;
        };
        if (!data) {
          return;
        }

        if (
          data.status === 'fallback' ||
          data.delivery === 'fallback' ||
          data.deliveryChannel === 'fallback'
        ) {
          const elapsedMs =
            typeof data.elapsedMs === 'number' && Number.isFinite(data.elapsedMs)
              ? data.elapsedMs
              : 0;
          const preservedTokens =
            typeof data.preservedTokensCount === 'number' &&
            Number.isFinite(data.preservedTokensCount)
              ? data.preservedTokensCount
              : 0;
          const reason = data.fallbackReason ?? 'assistant_unavailable';
          const retryAttempted = data.retryAttempted ?? false;

          setStreaming(prev => ({
            ...prev,
            status: 'fallback',
            fallback: {
              status: 'active',
              reason,
              message: resolveCoAuthorFallbackMessage(reason),
              progressCopy: buildFallbackProgressCopy({
                interaction: 'assumptions',
                elapsedMs,
                preservedTokens,
              }),
              preservedTokens,
              elapsedMs,
              retryAttempted,
            },
          }));

          if (!fallbackLoggedRef.current) {
            emitAssumptionStreamingFallback({
              sessionId: currentSessionId,
              sectionId: sectionIdentifier,
              fallbackReason: reason,
              preservedTokensCount: preservedTokens,
              retryAttempted,
              elapsedMs,
            });
            fallbackLoggedRef.current = true;
          }

          emitAssumptionStreamingMetric({
            sessionId: currentSessionId,
            sectionId: sectionIdentifier,
            stageLabel: 'assumptions.fallback.progress',
            elapsedMs,
            status: 'deferred',
          });

          return;
        }

        const sequence =
          typeof data.sequence === 'number' ? data.sequence : lastSequenceRef.current + 1;
        const snippet = data.contentSnippet ?? null;
        const stageLabel = data.stageLabel ?? 'assumptions.progress';
        const rawElapsed = (data as { elapsedMs?: number }).elapsedMs;
        const elapsedMs = typeof rawElapsed === 'number' ? rawElapsed : 0;
        const highestBefore = lastSequenceRef.current;
        const isOutOfOrderEvent = sequence < highestBefore;
        if (sequence > lastSequenceRef.current) {
          lastSequenceRef.current = sequence;
        }

        setStreaming(prev => {
          const filtered = prev.bullets.filter(bullet => bullet.sequence !== sequence);
          const nextBullets = [...filtered, { sequence, stageLabel, content: snippet }].sort(
            (left, right) => left.sequence - right.sequence
          );

          const announcementText = snippet ?? stageLabel;

          return {
            ...prev,
            status: 'streaming',
            bullets: nextBullets,
            hasOutOfOrder: prev.hasOutOfOrder || isOutOfOrderEvent,
            announcements:
              announcementText != null && announcementText.length > 0
                ? [...prev.announcements, announcementText]
                : prev.announcements,
          };
        });

        emitAssumptionStreamingMetric({
          sessionId: currentSessionId,
          sectionId: sectionIdentifier,
          stageLabel,
          elapsedMs,
          status: 'streaming',
        });

        if (isOutOfOrderEvent) {
          resequenceCountRef.current += 1;
          emitAssumptionStreamingResequence({
            sessionId: currentSessionId,
            sectionId: sectionIdentifier,
            correctedCount: resequenceCountRef.current,
            highestSequence: Math.max(highestBefore, sequence),
          });
        }

        return;
      }

      if (event.type === 'status') {
        const data = event.data as {
          status?: string;
          fallbackReason?: string;
          reason?: string;
          preservedTokensCount?: number;
          elapsedMs?: number;
          retryAttempted?: boolean;
        };
        if (!data?.status) {
          return;
        }

        const statusValue = data.status as string;

        if (statusValue.startsWith('fallback_')) {
          const fallbackStatus = (() => {
            switch (statusValue) {
              case 'fallback_active':
                return 'active' as const;
              case 'fallback_completed':
                return 'completed' as const;
              case 'fallback_canceled':
                return 'canceled' as const;
              case 'fallback_failed':
                return 'failed' as const;
              default:
                return 'active' as const;
            }
          })();

          const reason = data.fallbackReason ?? data.reason ?? 'assistant_unavailable';
          const preservedTokens =
            typeof data.preservedTokensCount === 'number' &&
            Number.isFinite(data.preservedTokensCount)
              ? data.preservedTokensCount
              : 0;
          const elapsedMs =
            typeof data.elapsedMs === 'number' && Number.isFinite(data.elapsedMs)
              ? data.elapsedMs
              : 0;
          const retryAttempted = data.retryAttempted ?? false;

          setStreaming(prev => {
            const nextAnnouncements = [...prev.announcements];
            if (
              fallbackStatus === 'active' ||
              fallbackStatus === 'completed' ||
              fallbackStatus === 'canceled'
            ) {
              const announcement = resolveFallbackAnnouncement({
                interaction: 'assumptions',
                state:
                  fallbackStatus === 'completed'
                    ? 'completed'
                    : fallbackStatus === 'canceled'
                      ? 'canceled'
                      : 'active',
                reason,
                elapsedMs,
                preservedTokens,
              });
              nextAnnouncements.push(announcement.message);
            } else {
              nextAnnouncements.push(resolveCoAuthorFallbackMessage(reason));
            }

            return {
              ...prev,
              status: 'fallback',
              fallback: {
                status: fallbackStatus,
                reason,
                preservedTokens,
                elapsedMs,
                retryAttempted,
                message:
                  fallbackStatus === 'canceled'
                    ? resolveFallbackCancelMessage(reason)
                    : resolveCoAuthorFallbackMessage(reason),
                progressCopy:
                  fallbackStatus === 'active' || fallbackStatus === 'completed'
                    ? buildFallbackProgressCopy({
                        interaction: 'assumptions',
                        elapsedMs,
                        preservedTokens,
                      })
                    : undefined,
              },
              announcements: nextAnnouncements.slice(-6),
            };
          });

          if (fallbackStatus === 'active' && !fallbackLoggedRef.current) {
            emitAssumptionStreamingFallback({
              sessionId: currentSessionId,
              sectionId: sectionIdentifier,
              fallbackReason: reason,
              preservedTokensCount: preservedTokens,
              retryAttempted,
              elapsedMs,
            });
            fallbackLoggedRef.current = true;
          } else if (
            fallbackLoggedRef.current &&
            (fallbackStatus === 'completed' ||
              fallbackStatus === 'failed' ||
              fallbackStatus === 'canceled')
          ) {
            fallbackLoggedRef.current = false;
          }

          return;
        }

        const announcement = resolveStatusAnnouncement(statusValue);

        setStreaming(prev => {
          let nextStatus: UseAssumptionsFlowResult['streaming']['status'] = prev.status;
          if (statusValue === 'deferred') {
            nextStatus = 'deferred';
          } else if (statusValue === 'canceled') {
            nextStatus = 'canceled';
          } else if (['resumed', 'streaming', 'completed'].includes(statusValue)) {
            nextStatus = 'streaming';
          }

          return {
            ...prev,
            status: nextStatus,
            fallback: nextStatus === 'streaming' ? null : prev.fallback,
            announcements:
              announcement && announcement.length > 0
                ? [...prev.announcements, announcement]
                : prev.announcements,
          };
        });

        if (['resumed', 'streaming', 'completed'].includes(statusValue)) {
          fallbackLoggedRef.current = false;
        }

        const normalizedStatus: 'deferred' | 'resumed' | 'canceled' =
          statusValue === 'deferred'
            ? 'deferred'
            : statusValue === 'canceled'
              ? 'canceled'
              : 'resumed';
        emitAssumptionStreamingStatus({
          sessionId: currentSessionId,
          sectionId: sectionIdentifier,
          status: normalizedStatus,
        });

        if (normalizedStatus === 'canceled') {
          emitAssumptionStreamingMetric({
            sessionId: currentSessionId,
            sectionId: sectionIdentifier,
            elapsedMs: 0,
            status: 'canceled',
          });
        }
      }
    };

    const subscription = subscribeToStream(sectionIdentifier, currentSessionId, handleEvent);
    streamSubscriptionRef.current = subscription;

    return () => {
      subscription.close();
      if (streamSubscriptionRef.current === subscription) {
        streamSubscriptionRef.current = null;
      }
    };
  }, [api?.subscribeToStream, enabled, sectionId, state]);

  const respond = useCallback(
    async (promptId: string, action: AssumptionAction, payload?: RespondPayload) => {
      if (!state || !sectionId) {
        return;
      }

      try {
        setError(null);
        const nextState = await bootstrapRef.current.respond({
          sectionId,
          documentId,
          templateVersion,
          sessionId: state.sessionId,
          promptId,
          action,
          payload,
          currentState: state,
        } satisfies RespondToPromptOptions);

        setState(nextState);
        setAssumptionSession(sectionId, nextState);
      } catch (unknownError) {
        const message =
          unknownError instanceof Error
            ? unknownError.message
            : 'Failed to update assumption prompt.';
        setError(message);
      }
    },
    [documentId, sectionId, state, templateVersion, setAssumptionSession]
  );

  return useMemo(
    () => ({
      state,
      isLoading,
      error,
      respond,
      reset,
      streaming,
    }),
    [error, isLoading, respond, reset, state, streaming]
  );
}

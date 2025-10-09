import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useMutation } from '@tanstack/react-query';

import {
  postAnalyze as defaultPostAnalyze,
  postProposal as defaultPostProposal,
  postApply as defaultPostApply,
  postRejectProposal as defaultPostRejectProposal,
  postTeardownSession as defaultPostTeardownSession,
  subscribeToSession as defaultSubscribeToSession,
  type ContextSection,
  type CoAuthoringStreamEvent,
  type ApplyResponseBody,
} from '../api/co-authoring.client';
import {
  useCoAuthoringStore,
  type ApprovedProposalRecord,
  type CoAuthoringIntent,
  type ConversationTurn,
  type PendingProposalSnapshot,
  type SectionConversationSession,
  type StreamProgressState,
} from '../stores/co-authoring-store';
import { createStreamingProgressTracker } from '../../../lib/streaming/progress-tracker';
import {
  mapFallbackReasonToAnnouncement,
  resolveCoAuthorFallbackMessage,
} from '../../../lib/streaming/fallback-messages';

export interface AnalyzeInput {
  intent: CoAuthoringIntent;
  prompt: string;
  knowledgeItemIds: string[];
  decisionIds: string[];
  completedSections: ContextSection[];
  currentDraft: string;
  contextSources?: string[];
}

export interface ProposalInput extends AnalyzeInput {
  draftVersion?: number;
  baselineVersion?: string;
}

export interface ApproveProposalInput {
  proposalId: string;
  draftPatch: string;
  diffHash: string;
  approvalNotes?: string;
  draftVersion?: number;
}

export interface CoAuthorFallbackState {
  message: string;
  retryable: boolean;
}

export interface UseCoAuthorSessionOptions {
  documentId?: string | null;
  sectionId?: string | null;
  authorId?: string | null;
  defaultIntent?: CoAuthoringIntent;
  api?: {
    postAnalyze?: typeof defaultPostAnalyze;
    postProposal?: typeof defaultPostProposal;
    postApply?: typeof defaultPostApply;
    postRejectProposal?: typeof defaultPostRejectProposal;
    postTeardownSession?: typeof defaultPostTeardownSession;
    subscribeToSession?: typeof defaultSubscribeToSession;
  };
}

export interface CoAuthorSessionHookValue {
  session: SectionConversationSession | null;
  turns: ConversationTurn[];
  transcript: string[];
  progress: StreamProgressState;
  pendingProposal: PendingProposalSnapshot | null;
  approvedHistory: ApprovedProposalRecord[];
  fallback: CoAuthorFallbackState | null;
  isAnalyzing: boolean;
  isRequestingProposal: boolean;
  isApproving: boolean;
  ensureSession: (options?: {
    intent?: CoAuthoringIntent;
    contextSources?: string[];
  }) => SectionConversationSession | null;
  analyze: (input: AnalyzeInput) => Promise<void>;
  requestProposal: (input: ProposalInput) => Promise<void>;
  approveProposal: (input: ApproveProposalInput) => Promise<ApplyResponseBody | null>;
  cancelStreaming: () => void;
  teardown: (reason: 'section-change' | 'navigation' | 'logout' | 'manual') => void;
  setIntent: (intent: CoAuthoringIntent) => void;
  clearFallback: () => void;
  pushFallback: (message: string, retryable?: boolean) => void;
  dismissProposal: () => void;
  setContextSources: (sources: string[]) => void;
}

const mapProgressStatus = (status: string): StreamProgressState['status'] => {
  if (status === 'streaming' || status === 'awaiting-approval' || status === 'queued') {
    return status === 'queued' ? 'streaming' : status;
  }
  return status === 'error' ? 'error' : 'idle';
};

const createSessionId = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `session-${crypto.randomUUID()}`;
  }
  return `session-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
};

const createTurnId = (sessionId: string, counter: number): string =>
  `${sessionId}::turn-${counter}`;
const createPromptId = (intent: CoAuthoringIntent, counter: number): string =>
  `prompt-${intent}-${counter}`;

interface ActiveInteractionState {
  authorTurnId: string;
  assistantTurnId: string;
  intent: CoAuthoringIntent;
  tokens: string[];
}

interface DiffSegmentSnapshot {
  segmentId: string;
  type: 'added' | 'removed' | 'context';
  content: string;
}

interface NormalizedDiffResult {
  diff: {
    mode: 'unified' | 'split';
    segments: DiffSegmentSnapshot[];
  };
  draftPatch: string;
}

const textEncoder = typeof TextEncoder !== 'undefined' ? new TextEncoder() : null;

const bufferToHex = (buffer: ArrayBuffer): string => {
  const bytes = new Uint8Array(buffer);
  let hex = '';
  for (const byte of bytes) {
    hex += byte.toString(16).padStart(2, '0');
  }
  return hex;
};

const computeSerializedDiffHash = async (diff: unknown): Promise<string | null> => {
  if (!diff || typeof diff !== 'object') {
    return null;
  }
  const record = diff as Record<string, unknown>;
  if (!Array.isArray(record.segments) || record.segments.length === 0) {
    return null;
  }
  if (!textEncoder || typeof globalThis.crypto?.subtle?.digest !== 'function') {
    return null;
  }
  const payload = JSON.stringify(record.segments);
  try {
    const digest = await globalThis.crypto.subtle.digest('SHA-256', textEncoder.encode(payload));
    return `sha256:${bufferToHex(digest)}`;
  } catch {
    return null;
  }
};

const buildDraftPatch = (segments: DiffSegmentSnapshot[]): string => {
  const lines = ['diff --git a/section.md b/section.md', '@@'];
  for (const segment of segments) {
    const prefix = segment.type === 'added' ? '+' : segment.type === 'removed' ? '-' : ' ';
    const segmentLines = segment.content.split('\n');
    for (const rawLine of segmentLines) {
      const normalizedLine = rawLine.replace(/\r$/, '');
      lines.push(`${prefix}${normalizedLine}`);
    }
  }
  return lines.join('\n');
};

const normalizeDiff = (rawDiff: unknown): NormalizedDiffResult => {
  let mode: 'unified' | 'split' = 'unified';
  const segments: DiffSegmentSnapshot[] = [];

  if (rawDiff && typeof rawDiff === 'object') {
    const record = rawDiff as Record<string, unknown>;
    if (record.mode === 'split') {
      mode = 'split';
    }
    if (Array.isArray(record.segments)) {
      record.segments.forEach(segment => {
        const value = segment as Record<string, unknown>;
        const segmentId = typeof value.segmentId === 'string' ? value.segmentId : '';
        if (!segmentId) {
          return;
        }
        const segmentType =
          value.type === 'added' || value.type === 'removed' || value.type === 'context'
            ? value.type
            : 'context';
        const segmentContent =
          typeof value.content === 'string'
            ? value.content
            : typeof value.value === 'string'
              ? value.value
              : '';
        segments.push({
          segmentId,
          type: segmentType,
          content: segmentContent,
        });
      });
    }
  }

  const draftPatch = buildDraftPatch(segments);

  return {
    diff: {
      mode,
      segments,
    },
    draftPatch,
  };
};

export function useCoAuthorSession(
  options: UseCoAuthorSessionOptions = {}
): CoAuthorSessionHookValue {
  const {
    documentId = null,
    sectionId = null,
    authorId = null,
    defaultIntent = 'improve',
    api,
  } = options;

  const postAnalyze = api?.postAnalyze ?? defaultPostAnalyze;
  const postProposal = api?.postProposal ?? defaultPostProposal;
  const postApply = api?.postApply ?? defaultPostApply;
  const subscribeToSession = api?.subscribeToSession ?? defaultSubscribeToSession;
  const postRejectProposal = api?.postRejectProposal ?? defaultPostRejectProposal;
  const postTeardownSession = api?.postTeardownSession ?? defaultPostTeardownSession;

  const session = useCoAuthoringStore(state => state.session);
  const turns = useCoAuthoringStore(state => state.turns);
  const transcript = useCoAuthoringStore(state => state.transcript);
  const progress = useCoAuthoringStore(state => state.progress);
  const pendingProposal = useCoAuthoringStore(state => state.pendingProposal);
  const approvedHistory = useCoAuthoringStore(state => state.approvedHistory);

  const startSession = useCoAuthoringStore(state => state.startSession);
  const recordTurn = useCoAuthoringStore(state => state.recordTurn);
  const appendTranscriptToken = useCoAuthoringStore(state => state.appendTranscriptToken);
  const clearTranscript = useCoAuthoringStore(state => state.clearTranscript);
  const updateStreamProgress = useCoAuthoringStore(state => state.updateStreamProgress);
  const setPendingProposal = useCoAuthoringStore(state => state.setPendingProposal);
  const clearPendingProposal = useCoAuthoringStore(state => state.clearPendingProposal);
  const approveProposalInStore = useCoAuthoringStore(state => state.approveProposal);
  const setActiveIntent = useCoAuthoringStore(state => state.setActiveIntent);
  const setContextSources = useCoAuthoringStore(state => state.setContextSources);
  const teardownSessionInStore = useCoAuthoringStore(state => state.teardownSession);
  const resetStore = useCoAuthoringStore(state => state.reset);

  const [fallback, setFallback] = useState<CoAuthorFallbackState | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);
  const subscriptionRef = useRef<ReturnType<typeof subscribeToSession> | null>(null);
  const lastStreamLocationRef = useRef<string | null>(null);
  const turnCounterRef = useRef<number>(0);
  const activeProposalTurnRef = useRef<string | null>(null);
  const activeInteractionRef = useRef<ActiveInteractionState | null>(null);
  const progressTrackerRef = useRef(
    createStreamingProgressTracker({
      announce: announcement => {
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('coauthor:announcement', { detail: announcement }));
        }
      },
    })
  );
  const progressTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const progressStartedAtRef = useRef<number | null>(null);

  const clearProgressTimer = useCallback(() => {
    if (progressTimerRef.current) {
      clearInterval(progressTimerRef.current);
      progressTimerRef.current = null;
    }
  }, []);

  const closeSubscription = useCallback(() => {
    subscriptionRef.current?.close();
    subscriptionRef.current = null;
  }, []);

  const cancelStreaming = useCallback(() => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    clearProgressTimer();
    progressStartedAtRef.current = null;
    updateStreamProgress({ status: 'idle', elapsedMs: 0 });
  }, [clearProgressTimer, updateStreamProgress]);

  const teardown = useCallback(
    (reason: 'section-change' | 'navigation' | 'logout' | 'manual') => {
      cancelStreaming();
      closeSubscription();
      activeInteractionRef.current = null;
      activeProposalTurnRef.current = null;
      setFallback(null);
      lastStreamLocationRef.current = null;
      const activeSessionId = session?.sessionId ?? null;
      if (activeSessionId && documentId && sectionId) {
        void postTeardownSession({
          documentId,
          sectionId,
          sessionId: activeSessionId,
          reason,
        }).catch(() => {});
      }
      if (reason === 'manual') {
        resetStore();
      } else {
        teardownSessionInStore(reason);
      }
    },
    [
      cancelStreaming,
      closeSubscription,
      documentId,
      postTeardownSession,
      resetStore,
      sectionId,
      session,
      teardownSessionInStore,
    ]
  );

  const ensureSubscription = useCallback(
    (sessionId: string) => {
      if (subscriptionRef.current) {
        return;
      }

      subscriptionRef.current = subscribeToSession(sessionId, (event: CoAuthoringStreamEvent) => {
        if (event.type === 'progress') {
          updateStreamProgress({
            status: mapProgressStatus(event.status),
            elapsedMs: event.elapsedMs,
          });
          return;
        }

        if (event.type === 'token') {
          appendTranscriptToken(event.value);
          if (activeInteractionRef.current) {
            activeInteractionRef.current.tokens.push(event.value);
          }
          return;
        }

        if (event.type === 'analysis.completed') {
          updateStreamProgress({ status: 'idle', elapsedMs: progress.elapsedMs });
          const interaction = activeInteractionRef.current;
          if (interaction) {
            const responseText = interaction.tokens.join('').trim();
            const assistantTurn: ConversationTurn = {
              turnId: interaction.assistantTurnId,
              sessionId,
              speaker: 'assistant',
              intent: interaction.intent,
              promptText: '',
              responseText,
              citations: [],
              confidence: undefined,
              createdAt: event.timestamp ?? new Date().toISOString(),
            };
            recordTurn(assistantTurn);
            activeInteractionRef.current = null;
          }
          return;
        }

        if (event.type === 'proposal.ready') {
          void (async () => {
            try {
              const normalized = normalizeDiff(event.diff);
              const explicitHash =
                typeof event.diffHash === 'string' && event.diffHash.trim().length > 0
                  ? event.diffHash.trim()
                  : '';
              let canonicalDiffHash = explicitHash;
              if (!canonicalDiffHash) {
                canonicalDiffHash = (await computeSerializedDiffHash(event.diff)) ?? '';
              }

              if (!canonicalDiffHash) {
                throw new Error('missing_diff_hash');
              }

              const proposal: PendingProposalSnapshot = {
                proposalId: event.proposalId,
                originTurnId: activeProposalTurnRef.current ?? event.proposalId,
                diff: normalized.diff as unknown as Record<string, unknown>,
                annotations: Array.isArray(event.annotations)
                  ? (event.annotations as Array<Record<string, unknown>>)
                  : [],
                confidence: event.confidence,
                expiresAt: event.expiresAt ?? new Date(Date.now() + 10 * 60 * 1000).toISOString(),
                citations: event.citations ?? [],
                diffHash: canonicalDiffHash,
                draftPatch: normalized.draftPatch,
              };
              setPendingProposal(proposal);
            } catch {
              const reason = mapFallbackReasonToAnnouncement('approval_failed');
              setFallback({
                message: resolveCoAuthorFallbackMessage('approval_failed'),
                retryable: true,
              });
              progressTrackerRef.current.update({
                status: 'error',
                elapsedMs: progress.elapsedMs,
                reason,
              });
              updateStreamProgress({ status: 'error', elapsedMs: progress.elapsedMs });
            } finally {
              activeInteractionRef.current = null;
            }
          })();
          return;
        }

        if (event.type === 'error') {
          const reason = mapFallbackReasonToAnnouncement(event.message);
          setFallback({
            message: resolveCoAuthorFallbackMessage(event.message),
            retryable: true,
          });
          progressTrackerRef.current.update({
            status: 'error',
            elapsedMs: progress.elapsedMs,
            reason,
          });
          updateStreamProgress({ status: 'error', elapsedMs: progress.elapsedMs });
        }
      });
    },
    [
      appendTranscriptToken,
      progress.elapsedMs,
      recordTurn,
      setPendingProposal,
      subscribeToSession,
      updateStreamProgress,
    ]
  );

  useEffect(() => {
    const handleProgressChange = (nextProgress: StreamProgressState) => {
      const isStreaming = nextProgress.status === 'streaming' || nextProgress.status === 'queued';
      if (!isStreaming) {
        progressStartedAtRef.current = null;
        clearProgressTimer();
        return;
      }

      const candidateStart = Date.now() - nextProgress.elapsedMs;
      if (progressStartedAtRef.current === null || candidateStart < progressStartedAtRef.current) {
        progressStartedAtRef.current = candidateStart;
      }

      if (!progressTimerRef.current) {
        progressTimerRef.current = setInterval(() => {
          const startedAt = progressStartedAtRef.current;
          if (startedAt == null) {
            return;
          }

          const now = Date.now();
          const elapsed = Math.max(0, now - startedAt);
          const state = useCoAuthoringStore.getState();
          const currentStatus = state.progress.status;
          if (currentStatus !== 'streaming' && currentStatus !== 'queued') {
            progressStartedAtRef.current = null;
            clearProgressTimer();
            return;
          }

          if (elapsed <= state.progress.elapsedMs) {
            return;
          }

          updateStreamProgress({
            status: currentStatus,
            elapsedMs: elapsed,
          });
        }, 1_000);
      }
    };

    const unsubscribe = useCoAuthoringStore.subscribe(state => {
      handleProgressChange(state.progress);
    });

    handleProgressChange(useCoAuthoringStore.getState().progress);

    return () => {
      unsubscribe();
      clearProgressTimer();
      progressStartedAtRef.current = null;
    };
  }, [clearProgressTimer, updateStreamProgress]);

  const ensureSession = useCallback<CoAuthorSessionHookValue['ensureSession']>(
    (payload = {}) => {
      if (!documentId || !sectionId || !authorId) {
        return null;
      }

      if (session && session.sectionId === sectionId) {
        ensureSubscription(session.sessionId);
        return session;
      }

      const sessionId = createSessionId();
      const newSession: SectionConversationSession = {
        sessionId,
        documentId,
        sectionId,
        authorId,
        startedAt: new Date().toISOString(),
        activeIntent: payload.intent ?? session?.activeIntent ?? defaultIntent,
        contextSources: Array.from(
          new Set(payload.contextSources ?? session?.contextSources ?? [])
        ).sort(),
        streamState: 'idle',
        lastTurnId: null,
      };

      cancelStreaming();
      closeSubscription();
      clearTranscript();
      startSession(newSession);
      ensureSubscription(sessionId);
      return newSession;
    },
    [
      authorId,
      cancelStreaming,
      clearTranscript,
      closeSubscription,
      defaultIntent,
      documentId,
      ensureSubscription,
      session,
      sectionId,
      startSession,
    ]
  );

  const createAbortController = useCallback(() => {
    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;
    return controller;
  }, []);

  const { mutateAsync: runAnalyze, isPending: isAnalyzing } = useMutation({
    mutationFn: async (input: { session: SectionConversationSession; payload: AnalyzeInput }) => {
      const controller = createAbortController();
      clearTranscript();
      updateStreamProgress({ status: 'queued', elapsedMs: 0 });
      setFallback(null);

      const { session: activeSession, payload } = input;
      const turnIndex = ++turnCounterRef.current;
      const turnId = createTurnId(activeSession.sessionId, turnIndex);
      const assistantTurnId = `${turnId}::assistant`;

      const authorTurn: ConversationTurn = {
        turnId,
        sessionId: activeSession.sessionId,
        speaker: 'author',
        intent: payload.intent,
        promptText: payload.prompt,
        citations: payload.decisionIds,
        confidence: undefined,
        createdAt: new Date().toISOString(),
      };
      recordTurn(authorTurn);

      activeInteractionRef.current = {
        authorTurnId: turnId,
        assistantTurnId,
        intent: payload.intent,
        tokens: [],
      };

      const response = await postAnalyze(
        {
          documentId: activeSession.documentId,
          sectionId: activeSession.sectionId,
          sessionId: activeSession.sessionId,
          intent: payload.intent,
          prompt: payload.prompt,
          knowledgeItemIds: payload.knowledgeItemIds,
          decisionIds: payload.decisionIds,
          completedSections: payload.completedSections,
          currentDraft: payload.currentDraft,
        },
        { signal: controller.signal }
      );

      lastStreamLocationRef.current = response.streamLocation ?? null;
      closeSubscription();
      ensureSubscription(activeSession.sessionId);

      return response;
    },
    onError: error => {
      if ((error as Error).name === 'AbortError') {
        return;
      }
      const reason = 'assistant_unavailable';
      setFallback({ message: resolveCoAuthorFallbackMessage(reason), retryable: true });
      progressTrackerRef.current.update({
        status: 'error',
        elapsedMs: progress.elapsedMs,
        reason,
      });
      updateStreamProgress({ status: 'error', elapsedMs: progress.elapsedMs });
    },
  });

  const { mutateAsync: runProposal, isPending: isRequestingProposal } = useMutation({
    mutationFn: async (input: { session: SectionConversationSession; payload: ProposalInput }) => {
      const controller = createAbortController();
      clearTranscript();
      updateStreamProgress({ status: 'queued', elapsedMs: 0 });
      setFallback(null);

      const { session: activeSession, payload } = input;
      const turnIndex = ++turnCounterRef.current;
      const turnId = createTurnId(activeSession.sessionId, turnIndex);
      const promptId = createPromptId(payload.intent, turnIndex);

      activeProposalTurnRef.current = turnId;
      activeInteractionRef.current = {
        authorTurnId: turnId,
        assistantTurnId: `${turnId}::assistant`,
        intent: payload.intent,
        tokens: [],
      };

      const authorTurn: ConversationTurn = {
        turnId,
        sessionId: activeSession.sessionId,
        speaker: 'author',
        intent: payload.intent,
        promptText: payload.prompt,
        citations: payload.decisionIds,
        confidence: undefined,
        createdAt: new Date().toISOString(),
      };
      recordTurn(authorTurn);

      const response = await postProposal(
        {
          documentId: activeSession.documentId,
          sectionId: activeSession.sectionId,
          sessionId: activeSession.sessionId,
          promptId,
          turnId,
          intent: payload.intent,
          prompt: payload.prompt,
          knowledgeItemIds: payload.knowledgeItemIds,
          decisionIds: payload.decisionIds,
          completedSections: payload.completedSections,
          currentDraft: payload.currentDraft,
          draftVersion: payload.draftVersion,
          baselineVersion: payload.baselineVersion,
        },
        { signal: controller.signal }
      );

      lastStreamLocationRef.current = response.streamLocation ?? lastStreamLocationRef.current;
      closeSubscription();
      ensureSubscription(activeSession.sessionId);

      return response;
    },
    onError: error => {
      if ((error as Error).name === 'AbortError') {
        return;
      }
      const reason = 'assistant_unavailable';
      setFallback({ message: resolveCoAuthorFallbackMessage(reason), retryable: true });
      progressTrackerRef.current.update({
        status: 'error',
        elapsedMs: progress.elapsedMs,
        reason,
      });
      updateStreamProgress({ status: 'error', elapsedMs: progress.elapsedMs });
    },
  });

  const { mutateAsync: runApprove, isPending: isApproving } = useMutation({
    mutationFn: async (input: {
      session: SectionConversationSession;
      payload: ApproveProposalInput;
    }) => {
      const controller = createAbortController();
      const response = await postApply(
        {
          documentId: input.session.documentId,
          sectionId: input.session.sectionId,
          sessionId: input.session.sessionId,
          proposalId: input.payload.proposalId,
          draftPatch: input.payload.draftPatch,
          diffHash: input.payload.diffHash,
          approvalNotes: input.payload.approvalNotes,
        },
        { signal: controller.signal }
      );
      return response;
    },
    onSuccess: (_response, variables) => {
      approveProposalInStore({
        proposalId: variables.payload.proposalId,
        approvedAt: new Date().toISOString(),
        approvedBy: authorId ?? 'unknown-author',
        approvalNotes: variables.payload.approvalNotes,
      });
      setFallback(null);
      updateStreamProgress({ status: 'idle', elapsedMs: 0 });
    },
    onError: error => {
      if ((error as Error).name === 'AbortError') {
        return;
      }
      const reason = 'approval_failed';
      setFallback({ message: resolveCoAuthorFallbackMessage(reason), retryable: true });
      progressTrackerRef.current.update({
        status: 'error',
        elapsedMs: progress.elapsedMs,
        reason,
      });
      updateStreamProgress({ status: 'error', elapsedMs: progress.elapsedMs });
    },
  });

  const analyze = useCallback<CoAuthorSessionHookValue['analyze']>(
    async payload => {
      const activeSession = ensureSession({
        intent: payload.intent,
        contextSources: payload.contextSources ?? [],
      });
      if (!activeSession) {
        throw new Error('Co-authoring session requires document, section, and author context.');
      }
      await runAnalyze({ session: activeSession, payload });
    },
    [ensureSession, runAnalyze]
  );

  const requestProposal = useCallback<CoAuthorSessionHookValue['requestProposal']>(
    async payload => {
      const activeSession = ensureSession({
        intent: payload.intent,
        contextSources: payload.contextSources ?? [],
      });
      if (!activeSession) {
        throw new Error('Co-authoring session requires document, section, and author context.');
      }
      await runProposal({ session: activeSession, payload });
    },
    [ensureSession, runProposal]
  );

  const approveProposal = useCallback<CoAuthorSessionHookValue['approveProposal']>(
    async payload => {
      const activeSession = session ?? ensureSession();
      if (!activeSession) {
        return null;
      }
      return runApprove({ session: activeSession, payload });
    },
    [ensureSession, runApprove, session]
  );

  const clearFallbackState = useCallback(() => setFallback(null), []);

  const pushFallback = useCallback<CoAuthorSessionHookValue['pushFallback']>(
    (message, retryable = true) => {
      const reason = mapFallbackReasonToAnnouncement(message);
      setFallback({ message: resolveCoAuthorFallbackMessage(message), retryable });
      progressTrackerRef.current.update({
        status: 'error',
        elapsedMs: progress.elapsedMs,
        reason,
      });
      updateStreamProgress({ status: 'error', elapsedMs: progress.elapsedMs });
    },
    [progress.elapsedMs, updateStreamProgress]
  );

  const dismissPendingProposal = useCallback(() => {
    const activeSessionId = session?.sessionId ?? null;
    const proposalId = pendingProposal?.proposalId ?? null;
    if (activeSessionId && proposalId && documentId && sectionId) {
      void postRejectProposal({
        documentId,
        sectionId,
        sessionId: activeSessionId,
        proposalId,
      }).catch(() => {});
    }
    clearPendingProposal();
  }, [clearPendingProposal, documentId, pendingProposal, postRejectProposal, sectionId, session]);

  useEffect(() => {
    progressTrackerRef.current.update({
      status: progress.status,
      elapsedMs: progress.elapsedMs,
    });
  }, [progress.elapsedMs, progress.status]);

  useEffect(() => {
    return () => {
      cancelStreaming();
      closeSubscription();
      abortControllerRef.current?.abort();
    };
  }, [cancelStreaming, closeSubscription]);

  return useMemo<CoAuthorSessionHookValue>(
    () => ({
      session,
      turns,
      transcript,
      progress,
      pendingProposal,
      approvedHistory,
      fallback,
      isAnalyzing,
      isRequestingProposal,
      isApproving,
      ensureSession,
      analyze,
      requestProposal,
      approveProposal,
      cancelStreaming,
      teardown,
      setIntent: setActiveIntent,
      setContextSources,
      clearFallback: clearFallbackState,
      pushFallback,
      dismissProposal: dismissPendingProposal,
    }),
    [
      analyze,
      approvedHistory,
      approveProposal,
      cancelStreaming,
      clearFallbackState,
      ensureSession,
      fallback,
      isAnalyzing,
      isApproving,
      isRequestingProposal,
      pendingProposal,
      progress,
      requestProposal,
      session,
      setActiveIntent,
      setContextSources,
      teardown,
      pushFallback,
      transcript,
      turns,
      dismissPendingProposal,
    ]
  );
}

export type { SectionConversationSession };

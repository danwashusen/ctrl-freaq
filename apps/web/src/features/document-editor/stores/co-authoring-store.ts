import { create } from 'zustand';

export type CoAuthoringIntent = 'explain' | 'outline' | 'improve' | 'summarize';

export interface SectionConversationSession {
  sessionId: string;
  documentId: string;
  sectionId: string;
  authorId: string;
  startedAt: string;
  activeIntent: CoAuthoringIntent;
  contextSources: string[];
  streamState: 'idle' | 'streaming' | 'awaiting-approval';
  lastTurnId?: string | null;
}

export interface ConversationTurn {
  turnId: string;
  sessionId: string;
  speaker: 'author' | 'assistant' | 'system';
  intent: CoAuthoringIntent;
  promptText: string;
  responseText?: string;
  citations: string[];
  confidence?: number;
  createdAt: string;
}

export interface PendingProposalSnapshot {
  proposalId: string;
  originTurnId: string;
  diff: Record<string, unknown>;
  annotations: Array<Record<string, unknown>>;
  confidence: number;
  expiresAt: string;
  citations: string[];
  promptSummary?: string;
  diffHash: string;
  draftPatch?: string;
}

export interface ApprovedProposalRecord {
  proposalId: string;
  approvedAt: string;
  approvedBy: string;
  approvalNotes?: string;
}

export interface StreamProgressState {
  status: 'idle' | 'queued' | 'streaming' | 'awaiting-approval' | 'fallback' | 'error' | 'canceled';
  elapsedMs: number;
  stageLabel?: string;
  firstUpdateMs?: number | null;
  cancelReason?: string | null;
  retryCount: number;
  fallbackReason?: string | null;
  preservedTokens?: number | null;
  delivery?: 'streaming' | 'fallback';
}

export interface ReplacementNotice {
  previousSessionId: string;
  replacedAt: string;
  promotedSessionId?: string | null;
}

export interface CoAuthoringStoreState {
  session: SectionConversationSession | null;
  turns: ConversationTurn[];
  transcript: string[];
  progress: StreamProgressState;
  replacementNotice: ReplacementNotice | null;
  pendingProposal: PendingProposalSnapshot | null;
  approvedHistory: ApprovedProposalRecord[];
  lastApprovedProposalId: string | null;
  startSession: (session: SectionConversationSession) => void;
  recordTurn: (turn: ConversationTurn) => void;
  appendTranscriptToken: (token: string) => void;
  clearTranscript: () => void;
  updateStreamProgress: (
    progress: Partial<StreamProgressState> & { status?: StreamProgressState['status'] }
  ) => void;
  resetProgress: () => void;
  setReplacementNotice: (notice: ReplacementNotice | null) => void;
  setPendingProposal: (proposal: PendingProposalSnapshot) => void;
  clearPendingProposal: () => void;
  approveProposal: (input: ApprovedProposalRecord) => void;
  setActiveIntent: (intent: CoAuthoringIntent) => void;
  setContextSources: (sources: string[]) => void;
  teardownSession: (reason: 'section-change' | 'navigation' | 'logout' | 'manual') => void;
  reset: () => void;
}

const initialState = {
  session: null,
  turns: [],
  transcript: [],
  progress: {
    status: 'idle',
    elapsedMs: 0,
    retryCount: 0,
    stageLabel: undefined,
    firstUpdateMs: null,
    cancelReason: null,
    fallbackReason: null,
    preservedTokens: null,
    delivery: 'streaming',
  },
  replacementNotice: null,
  pendingProposal: null,
  approvedHistory: [],
  lastApprovedProposalId: null,
} satisfies Pick<
  CoAuthoringStoreState,
  | 'session'
  | 'turns'
  | 'transcript'
  | 'progress'
  | 'replacementNotice'
  | 'pendingProposal'
  | 'approvedHistory'
  | 'lastApprovedProposalId'
>;

export const useCoAuthoringStore = create<CoAuthoringStoreState>((set, get) => ({
  ...initialState,
  startSession: session => {
    set(state => ({
      session: {
        ...session,
        streamState: session.streamState ?? 'streaming',
        lastTurnId: session.lastTurnId ?? null,
      },
      turns: [],
      transcript: [],
      progress: {
        status: 'streaming',
        elapsedMs: 0,
        retryCount: state.progress.retryCount ?? 0,
        stageLabel: undefined,
        firstUpdateMs: null,
        cancelReason: null,
      },
      replacementNotice: null,
      pendingProposal: null,
      lastApprovedProposalId: null,
      approvedHistory: state.approvedHistory,
    }));
  },
  recordTurn: turn => {
    set(state => ({
      turns: [...state.turns, turn],
      session: state.session
        ? {
            ...state.session,
            lastTurnId: turn.turnId,
          }
        : state.session,
    }));
  },
  appendTranscriptToken: token => {
    set(state => ({ transcript: [...state.transcript, token] }));
  },
  clearTranscript: () => {
    set(() => ({ transcript: [] }));
  },
  updateStreamProgress: progress => {
    set(state => {
      const nextStatus: StreamProgressState['status'] = (progress.status ??
        state.progress.status) as StreamProgressState['status'];
      const statusValue = nextStatus as string;
      const merged: StreamProgressState = {
        ...state.progress,
        ...progress,
        status: nextStatus,
        retryCount:
          typeof progress.retryCount === 'number'
            ? progress.retryCount
            : (state.progress.retryCount ?? 0),
      };

      if (nextStatus === 'idle') {
        merged.stageLabel = undefined;
        merged.firstUpdateMs = null;
        merged.cancelReason = null;
        merged.elapsedMs = progress.elapsedMs ?? 0;
        merged.fallbackReason = null;
        merged.preservedTokens = null;
        merged.delivery = 'streaming';
      }

      if (nextStatus === 'streaming' || nextStatus === 'queued') {
        merged.cancelReason = progress.cancelReason ?? null;
      }

      if (nextStatus !== 'canceled' && progress.cancelReason === undefined) {
        merged.cancelReason = null;
      }

      if (progress.fallbackReason !== undefined) {
        merged.fallbackReason = progress.fallbackReason;
      } else if (statusValue === 'fallback' || nextStatus === 'awaiting-approval') {
        merged.fallbackReason = merged.fallbackReason ?? null;
      } else if (statusValue !== 'fallback') {
        merged.fallbackReason = null;
      }

      if (progress.preservedTokens !== undefined) {
        merged.preservedTokens = progress.preservedTokens;
      } else if (statusValue !== 'fallback') {
        merged.preservedTokens =
          nextStatus === 'awaiting-approval' ? (merged.preservedTokens ?? null) : null;
      }

      if (progress.delivery) {
        merged.delivery = progress.delivery;
      } else if (statusValue === 'fallback') {
        merged.delivery = 'fallback';
      } else if (nextStatus === 'awaiting-approval' && state.progress.delivery === 'fallback') {
        merged.delivery = 'fallback';
      } else if (!merged.delivery) {
        merged.delivery = 'streaming';
      }

      return {
        progress: merged,
        session: state.session
          ? {
              ...state.session,
              streamState:
                statusValue === 'queued'
                  ? 'streaming'
                  : nextStatus === 'awaiting-approval'
                    ? 'awaiting-approval'
                    : statusValue === 'fallback'
                      ? 'streaming'
                      : statusValue === 'streaming'
                        ? 'streaming'
                        : 'idle',
            }
          : state.session,
      };
    });
  },
  resetProgress: () => {
    set(state => ({
      progress: { ...initialState.progress },
      session: state.session
        ? {
            ...state.session,
            streamState: 'idle',
          }
        : state.session,
    }));
  },
  setReplacementNotice: notice => {
    set(() => ({
      replacementNotice: notice,
    }));
  },
  setPendingProposal: proposal => {
    set(state => ({
      pendingProposal: proposal,
      progress: {
        status: 'awaiting-approval',
        elapsedMs: state.progress.elapsedMs,
        retryCount: state.progress.retryCount,
        stageLabel: state.progress.stageLabel,
        firstUpdateMs: state.progress.firstUpdateMs,
        cancelReason: null,
      },
      session: state.session
        ? {
            ...state.session,
            streamState: 'awaiting-approval',
          }
        : state.session,
    }));
  },
  clearPendingProposal: () => {
    set(state => ({
      pendingProposal: null,
      progress: {
        status: 'idle',
        elapsedMs: 0,
        retryCount: state.progress.retryCount,
        stageLabel: undefined,
        firstUpdateMs: null,
        cancelReason: null,
      },
      session: state.session
        ? {
            ...state.session,
            streamState: 'idle',
          }
        : state.session,
    }));
  },
  approveProposal: input => {
    set(state => ({
      approvedHistory: [...state.approvedHistory, input],
      lastApprovedProposalId: input.proposalId,
      pendingProposal:
        state.pendingProposal && state.pendingProposal.proposalId === input.proposalId
          ? null
          : state.pendingProposal,
      progress: {
        status: 'idle',
        elapsedMs: 0,
        retryCount: state.progress.retryCount,
        stageLabel: undefined,
        firstUpdateMs: null,
        cancelReason: null,
      },
      session: state.session
        ? {
            ...state.session,
            streamState: 'idle',
          }
        : state.session,
    }));
  },
  setActiveIntent: intent => {
    set(state => {
      if (!state.session || state.session.activeIntent === intent) {
        return state;
      }
      return {
        session: {
          ...state.session,
          activeIntent: intent,
        },
      };
    });
  },
  setContextSources: sources => {
    set(state => {
      if (!state.session) {
        return state;
      }
      const nextSources = Array.from(new Set(sources)).sort();
      const currentSources = [...state.session.contextSources].sort();
      const hasSameSources =
        currentSources.length === nextSources.length &&
        currentSources.every((value, index) => value === nextSources[index]);
      if (hasSameSources) {
        return state;
      }

      return {
        session: {
          ...state.session,
          contextSources: nextSources,
        },
      };
    });
  },
  teardownSession: reason => {
    const { approvedHistory } = get();
    const shouldPreserveHistory = reason !== 'manual';
    set(() => ({
      ...initialState,
      approvedHistory: shouldPreserveHistory ? approvedHistory : [],
    }));
  },
  reset: () => {
    set(() => ({ ...initialState }));
  },
}));

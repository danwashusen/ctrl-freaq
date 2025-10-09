import { create } from 'zustand';

export type CoAuthoringIntent = 'explain' | 'outline' | 'improve';

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
  status: 'idle' | 'queued' | 'streaming' | 'awaiting-approval' | 'error';
  elapsedMs: number;
}

export interface CoAuthoringStoreState {
  session: SectionConversationSession | null;
  turns: ConversationTurn[];
  transcript: string[];
  progress: StreamProgressState;
  pendingProposal: PendingProposalSnapshot | null;
  approvedHistory: ApprovedProposalRecord[];
  lastApprovedProposalId: string | null;
  startSession: (session: SectionConversationSession) => void;
  recordTurn: (turn: ConversationTurn) => void;
  appendTranscriptToken: (token: string) => void;
  clearTranscript: () => void;
  updateStreamProgress: (progress: StreamProgressState) => void;
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
  progress: { status: 'idle', elapsedMs: 0 },
  pendingProposal: null,
  approvedHistory: [],
  lastApprovedProposalId: null,
} satisfies Pick<
  CoAuthoringStoreState,
  | 'session'
  | 'turns'
  | 'transcript'
  | 'progress'
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
      progress: { status: 'streaming', elapsedMs: 0 },
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
    set(state => ({
      progress,
      session: state.session
        ? {
            ...state.session,
            streamState:
              progress.status === 'queued'
                ? 'streaming'
                : progress.status === 'awaiting-approval'
                  ? 'awaiting-approval'
                  : progress.status === 'streaming'
                    ? 'streaming'
                    : 'idle',
          }
        : state.session,
    }));
  },
  setPendingProposal: proposal => {
    set(state => ({
      pendingProposal: proposal,
      progress: {
        status: 'awaiting-approval',
        elapsedMs: state.progress.elapsedMs,
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
      progress: { status: 'idle', elapsedMs: 0 },
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
      progress: { status: 'idle', elapsedMs: 0 },
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

import { create } from 'zustand';

import type { ReplacementNotice, StreamProgressState } from './co-authoring-store';

export interface DocumentQaSession {
  sessionId: string;
  documentId: string;
  sectionId: string;
  reviewerId: string;
  startedAt: string;
  streamState: 'idle' | 'queued' | 'streaming' | 'awaiting-approval';
  streamLocation: string | null;
  queueDisposition: 'started' | 'pending';
  replacementPolicy: 'newest_replaces_pending';
  concurrencySlot: number | null;
  replacedSessionId: string | null;
}

interface DocumentQaStoreState {
  session: DocumentQaSession | null;
  transcript: string[];
  progress: StreamProgressState;
  replacementNotice: ReplacementNotice | null;
  startSession: (session: DocumentQaSession) => void;
  appendTranscriptToken: (token: string) => void;
  clearTranscript: () => void;
  updateProgress: (
    progress: Partial<StreamProgressState> & { status?: StreamProgressState['status'] }
  ) => void;
  setReplacementNotice: (notice: ReplacementNotice | null) => void;
  reset: () => void;
}

const initialProgress: StreamProgressState = {
  status: 'idle',
  elapsedMs: 0,
  retryCount: 0,
  stageLabel: undefined,
  firstUpdateMs: null,
  cancelReason: null,
  fallbackReason: null,
  preservedTokens: null,
  delivery: 'streaming',
};

const initialState = {
  session: null,
  transcript: [],
  progress: { ...initialProgress },
  replacementNotice: null,
} satisfies Pick<DocumentQaStoreState, 'session' | 'transcript' | 'progress' | 'replacementNotice'>;

export const useDocumentQaStore = create<DocumentQaStoreState>((set, get) => ({
  ...initialState,
  startSession: session => {
    set(() => ({
      session: {
        ...session,
        streamState: session.streamState ?? 'streaming',
      },
      transcript: [],
      progress: {
        status: session.streamState === 'queued' ? 'queued' : 'streaming',
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
    }));
  },
  appendTranscriptToken: token => {
    set(state => ({ transcript: [...state.transcript, token] }));
  },
  clearTranscript: () => set(() => ({ transcript: [] })),
  updateProgress: progress => {
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
  setReplacementNotice: notice => {
    set(() => ({ replacementNotice: notice }));
  },
  reset: () => {
    const previousSession = get().session;
    set(() => ({
      ...initialState,
      session: previousSession ? { ...previousSession, streamState: 'idle' } : null,
    }));
  },
}));

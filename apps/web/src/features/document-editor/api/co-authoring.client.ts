const RAW_API_BASE =
  (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_BASE_URL
    ? (import.meta.env.VITE_API_BASE_URL as string)
    : undefined) ?? '/api/v1';
const API_BASE_PATH = RAW_API_BASE.replace(/\/$/, '');

export const buildApiUrl = (path: string): string => {
  return `${API_BASE_PATH}${path}`;
};

export interface ContextSection {
  path: string;
  content: string;
}

export interface AnalyzeRequestPayload {
  documentId: string;
  sectionId: string;
  sessionId: string;
  intent: string;
  prompt: string;
  knowledgeItemIds?: string[];
  decisionIds?: string[];
  completedSections: ContextSection[];
  currentDraft: string;
}

export interface ProposalRequestPayload extends AnalyzeRequestPayload {
  promptId: string;
  turnId: string;
  draftVersion?: number;
  baselineVersion?: string;
}

export interface ApplyRequestPayload {
  documentId: string;
  sectionId: string;
  sessionId: string;
  proposalId: string;
  draftPatch: string;
  diffHash: string;
  approvalNotes?: string;
}

export interface RejectProposalPayload {
  documentId: string;
  sectionId: string;
  sessionId: string;
  proposalId: string;
}

export interface TeardownSessionPayload {
  documentId: string;
  sectionId: string;
  sessionId: string;
  reason?: 'manual' | 'section-change' | 'navigation' | 'logout';
}

export interface AnalyzeResponseBody {
  status: 'accepted';
  sessionId: string;
  contextSummary: {
    completedSectionCount: number;
    knowledgeItemCount: number;
    decisionCount: number;
  };
  audit: {
    documentId: string;
    sectionId: string;
    intent: string;
  };
}

export interface ProposalResponseBody {
  status: 'accepted';
  sessionId: string;
  diffPreview: {
    mode: 'unified' | 'split';
    pendingProposalId: string;
  };
  audit: {
    documentId: string;
    sectionId: string;
    intent: string;
    promptId: string;
  };
}

export interface ApplyResponseBody {
  status: 'queued';
  changelog: {
    summary: string;
    proposalId: string;
    confidence: number;
    citations: string[];
    entryId?: string;
  };
  queue: {
    draftVersion: number;
    diffHash: string;
  };
}

export interface RequestResult<TBody> {
  body: TBody;
  streamLocation?: string | null;
}

export type CoAuthoringStreamEvent =
  | {
      type: 'progress';
      status: string;
      elapsedMs: number;
      stage?: string;
      announcementPriority?: 'polite' | 'assertive';
      sequence?: number;
      concurrencySlot?: number;
      cancelReason?: string;
      retryCount?: number;
      fallbackReason?: string;
      preservedTokensCount?: number;
      delivery?: 'streaming' | 'fallback';
      retryAttempted?: boolean;
      replacement?: {
        previousSessionId: string;
        promotedSessionId?: string | null;
      };
      isEditorLocked?: boolean;
    }
  | { type: 'token'; value: string; sequence?: number }
  | {
      type: 'proposal.ready';
      proposalId: string;
      diff: unknown;
      annotations: unknown;
      confidence: number;
      citations: string[];
      expiresAt?: string;
      diffHash?: string;
    }
  | { type: 'analysis.completed'; timestamp: string; sessionId: string }
  | {
      type: 'state';
      status: string;
      fallbackReason?: string;
      preservedTokensCount?: number;
      retryAttempted?: boolean;
      elapsedMs?: number;
      timestamp?: string;
      delivery?: 'streaming' | 'fallback';
    }
  | { type: 'error'; message: string };

export interface EventSubscription {
  close: () => void;
}

const defaultFetch: typeof fetch = (...args) => fetch(...args);

const createRequestInit = (
  payload: Record<string, unknown>,
  signal?: AbortSignal
): RequestInit => ({
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify(payload),
  signal,
});

const readJson = async <T>(response: Response): Promise<T> => {
  const text = await response.text();
  if (!text) {
    throw new Error('Empty response body');
  }
  return JSON.parse(text) as T;
};

const extractStreamLocation = (response: Response): string | null => {
  return response.headers.get('hx-stream-location');
};

export const postAnalyze = async (
  payload: AnalyzeRequestPayload,
  options?: { fetchImpl?: typeof fetch; signal?: AbortSignal }
): Promise<RequestResult<AnalyzeResponseBody>> => {
  const fetchImpl = options?.fetchImpl ?? defaultFetch;
  const url = buildApiUrl(
    `/documents/${payload.documentId}/sections/${payload.sectionId}/co-author/analyze`
  );

  const response = await fetchImpl(
    url,
    createRequestInit(
      {
        sessionId: payload.sessionId,
        intent: payload.intent,
        prompt: payload.prompt,
        knowledgeItemIds: payload.knowledgeItemIds ?? [],
        decisionIds: payload.decisionIds ?? [],
        completedSections: payload.completedSections,
        currentDraft: payload.currentDraft,
      },
      options?.signal
    )
  );

  if (!response.ok) {
    throw new Error(`Analyze request failed with status ${response.status}`);
  }

  return {
    body: await readJson<AnalyzeResponseBody>(response),
    streamLocation: extractStreamLocation(response),
  };
};

export const postProposal = async (
  payload: ProposalRequestPayload,
  options?: { fetchImpl?: typeof fetch; signal?: AbortSignal }
): Promise<RequestResult<ProposalResponseBody>> => {
  const fetchImpl = options?.fetchImpl ?? defaultFetch;
  const url = buildApiUrl(
    `/documents/${payload.documentId}/sections/${payload.sectionId}/co-author/proposal`
  );

  const response = await fetchImpl(
    url,
    createRequestInit(
      {
        sessionId: payload.sessionId,
        promptId: payload.promptId,
        turnId: payload.turnId,
        intent: payload.intent,
        prompt: payload.prompt,
        knowledgeItemIds: payload.knowledgeItemIds ?? [],
        decisionIds: payload.decisionIds ?? [],
        completedSections: payload.completedSections,
        currentDraft: payload.currentDraft,
        draftVersion: payload.draftVersion,
        baselineVersion: payload.baselineVersion,
      },
      options?.signal
    )
  );

  if (!response.ok) {
    throw new Error(`Proposal request failed with status ${response.status}`);
  }

  return {
    body: await readJson<ProposalResponseBody>(response),
    streamLocation: extractStreamLocation(response),
  };
};

export const postApply = async (
  payload: ApplyRequestPayload,
  options?: { fetchImpl?: typeof fetch; signal?: AbortSignal }
): Promise<ApplyResponseBody> => {
  const fetchImpl = options?.fetchImpl ?? defaultFetch;
  const url = buildApiUrl(
    `/documents/${payload.documentId}/sections/${payload.sectionId}/co-author/apply`
  );

  const response = await fetchImpl(
    url,
    createRequestInit(
      {
        sessionId: payload.sessionId,
        proposalId: payload.proposalId,
        draftPatch: payload.draftPatch,
        diffHash: payload.diffHash,
        approvalNotes: payload.approvalNotes,
      },
      options?.signal
    )
  );

  if (!response.ok) {
    throw new Error(`Apply request failed with status ${response.status}`);
  }

  return readJson<ApplyResponseBody>(response);
};

const resolveStreamPath = (streamPath: string | undefined, sessionId: string): string => {
  if (!streamPath) {
    return buildApiUrl(`/co-authoring/sessions/${sessionId}/events`);
  }

  if (/^https?:\/\//i.test(streamPath)) {
    return streamPath;
  }

  if (streamPath.startsWith('/')) {
    return streamPath;
  }

  const normalized = streamPath.startsWith('/') ? streamPath : `/${streamPath}`;
  return buildApiUrl(normalized);
};

export const subscribeToSession = (
  sessionId: string,
  onEvent: (event: CoAuthoringStreamEvent) => void,
  options?: { eventSourceFactory?: (url: string) => EventSource; streamPath?: string }
): EventSubscription => {
  const factory = options?.eventSourceFactory ?? ((url: string) => new EventSource(url));
  const eventSource = factory(resolveStreamPath(options?.streamPath, sessionId));

  const handleMessage = (event: MessageEvent<string>) => {
    if (!event?.data) {
      return;
    }

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(event.data) as Record<string, unknown>;
    } catch {
      return;
    }

    switch (event.type) {
      case 'progress': {
        const status = typeof parsed.status === 'string' ? parsed.status : 'unknown';
        const elapsedMs = typeof parsed.elapsedMs === 'number' ? parsed.elapsedMs : 0;
        const stage = typeof parsed.stage === 'string' ? parsed.stage : undefined;
        const announcementPriority =
          parsed.announcementPriority === 'assertive' || parsed.announcementPriority === 'polite'
            ? (parsed.announcementPriority as 'polite' | 'assertive')
            : undefined;
        const sequence =
          typeof parsed.sequence === 'number' && Number.isFinite(parsed.sequence)
            ? (parsed.sequence as number)
            : undefined;
        const concurrencySlot =
          typeof parsed.concurrencySlot === 'number' && Number.isFinite(parsed.concurrencySlot)
            ? (parsed.concurrencySlot as number)
            : undefined;
        const cancelReason =
          typeof parsed.cancelReason === 'string' ? parsed.cancelReason : undefined;
        const retryCount =
          typeof parsed.retryCount === 'number' && Number.isFinite(parsed.retryCount)
            ? (parsed.retryCount as number)
            : undefined;
        const fallbackReason =
          typeof parsed.fallbackReason === 'string' ? parsed.fallbackReason : undefined;
        const preservedTokensCount =
          typeof parsed.preservedTokensCount === 'number' &&
          Number.isFinite(parsed.preservedTokensCount)
            ? (parsed.preservedTokensCount as number)
            : undefined;
        const delivery =
          parsed.delivery === 'fallback' || parsed.delivery === 'streaming'
            ? (parsed.delivery as 'fallback' | 'streaming')
            : undefined;
        const retryAttempted =
          typeof parsed.retryAttempted === 'boolean'
            ? (parsed.retryAttempted as boolean)
            : undefined;

        let replacement:
          | {
              previousSessionId: string;
              promotedSessionId?: string | null;
            }
          | undefined;

        const previousSessionId =
          typeof parsed.previousSessionId === 'string'
            ? parsed.previousSessionId
            : typeof parsed.replacedSessionId === 'string'
              ? parsed.replacedSessionId
              : undefined;
        if (previousSessionId) {
          const promoted =
            typeof parsed.promotedSessionId === 'string' ? parsed.promotedSessionId : undefined;
          replacement = {
            previousSessionId,
            promotedSessionId: promoted ?? null,
          };
        }

        const isEditorLocked =
          typeof parsed.isEditorLocked === 'boolean' ? parsed.isEditorLocked : undefined;

        onEvent({
          type: 'progress',
          status,
          elapsedMs,
          stage,
          announcementPriority,
          sequence,
          concurrencySlot,
          cancelReason,
          retryCount,
          replacement,
          isEditorLocked,
          fallbackReason,
          preservedTokensCount,
          delivery,
          retryAttempted,
        });
        break;
      }
      case 'token': {
        const value = typeof parsed.value === 'string' ? parsed.value : '';
        const sequence =
          typeof parsed.sequence === 'number' && Number.isFinite(parsed.sequence)
            ? (parsed.sequence as number)
            : undefined;
        onEvent({ type: 'token', value, sequence });
        break;
      }
      case 'proposal.ready': {
        onEvent({
          type: 'proposal.ready',
          proposalId: typeof parsed.proposalId === 'string' ? parsed.proposalId : 'unknown',
          diff: parsed.diff,
          annotations: parsed.annotations,
          confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0,
          citations: Array.isArray(parsed.citations)
            ? (parsed.citations.filter(value => typeof value === 'string') as string[])
            : [],
          expiresAt: typeof parsed.expiresAt === 'string' ? parsed.expiresAt : undefined,
          diffHash: typeof parsed.diffHash === 'string' ? parsed.diffHash : undefined,
        });
        break;
      }
      case 'analysis.completed': {
        onEvent({
          type: 'analysis.completed',
          timestamp:
            typeof parsed.timestamp === 'string' ? parsed.timestamp : new Date().toISOString(),
          sessionId: typeof parsed.sessionId === 'string' ? parsed.sessionId : sessionId,
        });
        break;
      }
      case 'error': {
        const message = typeof parsed.message === 'string' ? parsed.message : 'stream_error';
        onEvent({ type: 'error', message });
        break;
      }
      case 'state': {
        const status = typeof parsed.status === 'string' ? parsed.status : 'unknown';
        const fallbackReason =
          typeof parsed.fallbackReason === 'string' ? parsed.fallbackReason : undefined;
        const preservedTokensCount =
          typeof parsed.preservedTokensCount === 'number' &&
          Number.isFinite(parsed.preservedTokensCount)
            ? (parsed.preservedTokensCount as number)
            : undefined;
        const retryAttempted =
          typeof parsed.retryAttempted === 'boolean'
            ? (parsed.retryAttempted as boolean)
            : undefined;
        const elapsedMs =
          typeof parsed.elapsedMs === 'number' && Number.isFinite(parsed.elapsedMs)
            ? (parsed.elapsedMs as number)
            : undefined;
        const timestamp = typeof parsed.timestamp === 'string' ? parsed.timestamp : undefined;
        const delivery =
          parsed.delivery === 'fallback' || parsed.delivery === 'streaming'
            ? (parsed.delivery as 'fallback' | 'streaming')
            : undefined;

        onEvent({
          type: 'state',
          status,
          fallbackReason,
          preservedTokensCount,
          retryAttempted,
          elapsedMs,
          timestamp,
          delivery,
        });
        break;
      }
      default:
        break;
    }
  };

  const handleError = () => {
    onEvent({ type: 'error', message: 'stream_disconnected' });
  };

  eventSource.addEventListener('progress', handleMessage);
  eventSource.addEventListener('token', handleMessage);
  eventSource.addEventListener('proposal.ready', handleMessage);
  eventSource.addEventListener('analysis.completed', handleMessage);
  eventSource.addEventListener('error', handleMessage);
  eventSource.addEventListener('state', handleMessage);
  eventSource.onerror = handleError;

  return {
    close: () => {
      eventSource.removeEventListener('progress', handleMessage);
      eventSource.removeEventListener('token', handleMessage);
      eventSource.removeEventListener('proposal.ready', handleMessage);
      eventSource.removeEventListener('analysis.completed', handleMessage);
      eventSource.removeEventListener('error', handleMessage);
      eventSource.removeEventListener('state', handleMessage);
      eventSource.onerror = null;
      eventSource.close();
    },
  };
};

export const postRejectProposal = async (
  payload: RejectProposalPayload,
  options?: { fetchImpl?: typeof fetch; signal?: AbortSignal }
): Promise<void> => {
  const fetchImpl = options?.fetchImpl ?? defaultFetch;
  const url = buildApiUrl(
    `/documents/${payload.documentId}/sections/${payload.sectionId}/co-author/proposal/reject`
  );

  const response = await fetchImpl(
    url,
    createRequestInit(
      {
        sessionId: payload.sessionId,
        proposalId: payload.proposalId,
      },
      options?.signal
    )
  );

  if (!response.ok && response.status !== 204) {
    throw new Error(`Reject proposal request failed with status ${response.status}`);
  }
};

export const postTeardownSession = async (
  payload: TeardownSessionPayload,
  options?: { fetchImpl?: typeof fetch; signal?: AbortSignal }
): Promise<void> => {
  const fetchImpl = options?.fetchImpl ?? defaultFetch;
  const url = buildApiUrl(
    `/documents/${payload.documentId}/sections/${payload.sectionId}/co-author/teardown`
  );

  const response = await fetchImpl(
    url,
    createRequestInit(
      {
        sessionId: payload.sessionId,
        reason: payload.reason ?? 'manual',
      },
      options?.signal
    )
  );

  if (!response.ok && response.status !== 204) {
    throw new Error(`Teardown session request failed with status ${response.status}`);
  }
};

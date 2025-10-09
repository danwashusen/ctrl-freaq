const RAW_API_BASE =
  (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_BASE_URL
    ? (import.meta.env.VITE_API_BASE_URL as string)
    : undefined) ?? '/api/v1';
const API_BASE_PATH = RAW_API_BASE.replace(/\/$/, '');

const buildApiUrl = (path: string): string => {
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
  | { type: 'progress'; status: string; elapsedMs: number }
  | { type: 'token'; value: string }
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

export const subscribeToSession = (
  sessionId: string,
  onEvent: (event: CoAuthoringStreamEvent) => void,
  options?: { eventSourceFactory?: (url: string) => EventSource }
): EventSubscription => {
  const factory = options?.eventSourceFactory ?? ((url: string) => new EventSource(url));
  const eventSource = factory(buildApiUrl(`/co-authoring/sessions/${sessionId}/events`));

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
        onEvent({ type: 'progress', status, elapsedMs });
        break;
      }
      case 'token': {
        const value = typeof parsed.value === 'string' ? parsed.value : '';
        onEvent({ type: 'token', value });
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
  eventSource.onerror = handleError;

  return {
    close: () => {
      eventSource.removeEventListener('progress', handleMessage);
      eventSource.removeEventListener('token', handleMessage);
      eventSource.removeEventListener('proposal.ready', handleMessage);
      eventSource.removeEventListener('analysis.completed', handleMessage);
      eventSource.removeEventListener('error', handleMessage);
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

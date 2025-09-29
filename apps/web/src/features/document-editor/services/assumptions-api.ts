import type { QueryClient } from '@tanstack/react-query';

import ApiClient from '../../../lib/api';
import type {
  AssumptionProposal,
  AssumptionProposalsListResponse,
  AssumptionPromptState,
  CreateProposalRequest,
  RespondToAssumptionRequest,
  StartAssumptionSessionResponse,
} from '../types/assumption-session';

export interface StartAssumptionSessionRequest {
  templateVersion: string;
  decisionSnapshotId?: string;
}

export interface AssumptionsApiServiceOptions {
  baseUrl?: string;
  getAuthToken?: () => Promise<string | null>;
  queryClient?: QueryClient;
}

export const ASSUMPTION_QUERY_KEYS = {
  sectionState: (sectionId: string) => ['assumptions', 'section', sectionId] as const,
  session: (sessionId: string) => ['assumptions', 'session', sessionId] as const,
  prompts: (sessionId: string) => ['assumptions', 'session', sessionId, 'prompts'] as const,
  proposals: (sessionId: string) => ['assumptions', 'session', sessionId, 'proposals'] as const,
} as const;

export interface ProposalStreamCallbacks {
  onChunk?: (payload: { type: 'chunk'; content: string }) => void;
  onComplete?: (proposal: AssumptionProposal) => void;
  onError?: (error: unknown) => void;
}

interface PrivateApiClientShape {
  baseUrl: string;
  requestId: string;
  getAuthToken?: () => Promise<string | null>;
  applyCorrelationFromResponse(response: Response): void;
}

export class AssumptionsApiService extends ApiClient {
  private readonly queryClient?: QueryClient;
  private readonly decoder = new TextDecoder();

  constructor(options: AssumptionsApiServiceOptions = {}) {
    const { queryClient, ...apiOptions } = options;
    super(apiOptions);
    this.queryClient = queryClient;
  }

  async startSession(
    sectionId: string,
    request: StartAssumptionSessionRequest
  ): Promise<StartAssumptionSessionResponse> {
    const response = await this['makeRequest']<StartAssumptionSessionResponse>(
      `/sections/${sectionId}/assumptions/session`,
      {
        method: 'POST',
        body: JSON.stringify(request),
      }
    );

    this.cacheSessionResponse(sectionId, response);
    return response;
  }

  async respondToPrompt(
    sectionId: string,
    assumptionId: string,
    request: RespondToAssumptionRequest,
    options: { sessionId?: string } = {}
  ): Promise<AssumptionPromptState> {
    const prompt = await this['makeRequest']<AssumptionPromptState>(
      `/sections/${sectionId}/assumptions/${assumptionId}/respond`,
      {
        method: 'POST',
        body: JSON.stringify(request),
      }
    );

    if (options.sessionId && this.queryClient) {
      const promptsKey = ASSUMPTION_QUERY_KEYS.prompts(options.sessionId);
      const existing = this.queryClient.getQueryData<AssumptionPromptState[]>(promptsKey) ?? [];
      const updated = existing.map(candidate =>
        candidate.id === prompt.id ? { ...candidate, ...prompt } : candidate
      );
      this.queryClient.setQueryData(promptsKey, updated);

      const sessionKey = ASSUMPTION_QUERY_KEYS.session(options.sessionId);
      const session = this.queryClient.getQueryData<StartAssumptionSessionResponse>(sessionKey);
      if (session) {
        this.queryClient.setQueryData(sessionKey, {
          ...session,
          overridesOpen: prompt.unresolvedOverrideCount,
        });
      }
    }

    return prompt;
  }

  async createProposal(
    sectionId: string,
    sessionId: string,
    request: CreateProposalRequest
  ): Promise<AssumptionProposal> {
    const proposal = await this['makeRequest']<AssumptionProposal>(
      `/sections/${sectionId}/assumptions/session/${sessionId}/proposals`,
      {
        method: 'POST',
        body: JSON.stringify(request),
      }
    );

    this.upsertProposalCache(sessionId, proposal);
    return proposal;
  }

  async listProposals(
    sectionId: string,
    sessionId: string
  ): Promise<AssumptionProposalsListResponse> {
    const response = await this['makeRequest']<AssumptionProposalsListResponse>(
      `/sections/${sectionId}/assumptions/session/${sessionId}/proposals`
    );

    this.queryClient?.setQueryData(ASSUMPTION_QUERY_KEYS.proposals(sessionId), response.proposals);
    return response;
  }

  async streamProposal(
    sectionId: string,
    sessionId: string,
    request: CreateProposalRequest,
    callbacks: ProposalStreamCallbacks = {}
  ): Promise<AssumptionProposal> {
    try {
      const response = await this.performStreamingRequest(
        `/sections/${sectionId}/assumptions/session/${sessionId}/proposals`,
        request
      );

      const contentType = response.headers.get('content-type') ?? '';
      if (!contentType.includes('text/event-stream') || !response.body) {
        throw new Error('Streaming not supported by response');
      }

      const reader = response.body.getReader();
      let buffer = '';
      let finalProposal: AssumptionProposal | null = null;

      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          break;
        }
        buffer += this.decoder.decode(value, { stream: true });

        let separatorIndex = buffer.indexOf('\n\n');
        while (separatorIndex !== -1) {
          const rawEvent = buffer.slice(0, separatorIndex);
          buffer = buffer.slice(separatorIndex + 2);
          this.handleStreamChunk(rawEvent, callbacks, proposal => {
            finalProposal = proposal;
          });
          separatorIndex = buffer.indexOf('\n\n');
        }
      }

      if (!finalProposal) {
        throw new Error('Streaming completed without a proposal payload');
      }

      this.upsertProposalCache(sessionId, finalProposal);
      callbacks.onComplete?.(finalProposal);
      return finalProposal;
    } catch (error) {
      callbacks.onError?.(error);
      return this.createProposal(sectionId, sessionId, request);
    }
  }

  private cacheSessionResponse(sectionId: string, response: StartAssumptionSessionResponse): void {
    if (!this.queryClient) {
      return;
    }

    this.queryClient.setQueryData(ASSUMPTION_QUERY_KEYS.sectionState(sectionId), response);
    this.queryClient.setQueryData(ASSUMPTION_QUERY_KEYS.session(response.sessionId), response);
    this.queryClient.setQueryData(
      ASSUMPTION_QUERY_KEYS.prompts(response.sessionId),
      response.prompts
    );
    this.queryClient.setQueryData(ASSUMPTION_QUERY_KEYS.proposals(response.sessionId), []);
  }

  private upsertProposalCache(sessionId: string, proposal: AssumptionProposal): void {
    if (!this.queryClient) {
      return;
    }

    const key = ASSUMPTION_QUERY_KEYS.proposals(sessionId);
    const existing = this.queryClient.getQueryData<AssumptionProposal[]>(key) ?? [];
    const filtered = existing.filter(item => item.proposalId !== proposal.proposalId);
    filtered.push(proposal);
    filtered.sort((a, b) => a.proposalIndex - b.proposalIndex);
    this.queryClient.setQueryData(key, filtered);
  }

  private async performStreamingRequest(
    endpoint: string,
    request: CreateProposalRequest
  ): Promise<Response> {
    const client = this as unknown as PrivateApiClientShape;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'text/event-stream',
      'X-Request-ID': client.requestId,
    };

    if (client.getAuthToken) {
      const token = await client.getAuthToken();
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
    }

    const response = await fetch(`${client.baseUrl}${endpoint}`, {
      method: 'POST',
      body: JSON.stringify(request),
      headers,
    });

    client.applyCorrelationFromResponse(response);

    if (!response.ok) {
      throw new Error(`Streaming request failed: ${response.status}`);
    }

    return response;
  }

  private handleStreamChunk(
    rawEvent: string,
    callbacks: ProposalStreamCallbacks,
    onProposal: (proposal: AssumptionProposal) => void
  ): void {
    const lines = rawEvent
      .split('\n')
      .map(line => line.trim())
      .filter(Boolean);

    let eventType: string | undefined;
    let dataPayload = '';

    for (const line of lines) {
      if (line.startsWith('event:')) {
        eventType = line.slice(6).trim();
      } else if (line.startsWith('data:')) {
        const fragment = line.slice(5).trim();
        dataPayload = dataPayload.length > 0 ? `${dataPayload}\n${fragment}` : fragment;
      }
    }

    if (!dataPayload) {
      return;
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(dataPayload);
    } catch {
      return;
    }

    const payload = parsed as Record<string, unknown>;
    const resolvedType = (payload.type as string | undefined) ?? eventType ?? 'chunk';

    if (resolvedType === 'chunk') {
      const content = typeof payload.content === 'string' ? payload.content : null;
      if (content) {
        callbacks.onChunk?.({ type: 'chunk', content });
      }
      return;
    }

    if (resolvedType === 'complete' && payload.proposal) {
      onProposal(payload.proposal as AssumptionProposal);
      return;
    }

    if (resolvedType === 'error') {
      callbacks.onError?.(payload.message ?? payload);
    }
  }
}

export const assumptionsApi = new AssumptionsApiService();

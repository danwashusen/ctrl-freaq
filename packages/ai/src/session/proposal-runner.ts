import { randomUUID } from 'node:crypto';

import { createOpenAI } from '@ai-sdk/openai';
import { streamText } from 'ai';
import type { CoreMessage } from 'ai';

export type ProposalIntent = 'explain' | 'outline' | 'improve';

export interface ProposalSession {
  sessionId: string;
  documentId: string;
  sectionId: string;
  authorId: string;
}

export interface ProposalPrompt {
  promptId: string;
  intent: ProposalIntent;
  text: string;
}

export interface ProposalContext {
  documentId: string;
  sectionId: string;
  documentTitle: string;
  completedSections: Array<{ path: string; content: string }>;
  currentDraft: string;
  decisionSummaries: Array<{ id: string; summary: string }>;
  knowledgeItems: Array<{ id: string; excerpt: string }>;
  clarifications: string[];
}

export interface ProposalStreamEvent<
  TType extends string = string,
  TPayload = Record<string, unknown>,
> {
  type: TType;
  data: TPayload;
}

export interface ProposalCompletedEvent {
  type: 'completed';
  data: {
    proposalId: string;
    confidence?: number;
    annotations?: Array<Record<string, unknown>>;
    diff?: Record<string, unknown>;
    rawText?: string;
  };
}

export type ProposalProviderEvent =
  | ProposalStreamEvent<'progress', { status: string; elapsedMs: number }>
  | ProposalStreamEvent<'token', { value: string }>
  | ProposalCompletedEvent;

export interface ProposalProviderPayload {
  session: ProposalSession;
  prompt: ProposalPrompt;
  context: ProposalContext;
  replay?: boolean;
}

export interface ProposalProvider {
  streamProposal: (payload: ProposalProviderPayload) => AsyncIterable<ProposalProviderEvent>;
}

export interface ProposalSessionResult {
  sessionId: string;
  proposalId: string;
  confidence?: number;
  annotations: Array<Record<string, unknown>>;
  diff?: Record<string, unknown>;
  events: Array<ProposalStreamEvent>;
  rawText?: string;
}

export interface ProposalSessionOptions {
  session: ProposalSession;
  prompt: ProposalPrompt;
  context: ProposalContext;
  provider: ProposalProvider;
  onEvent?: (event: ProposalStreamEvent) => void | Promise<void>;
  replay?: boolean;
}

export interface VercelAIProposalProviderOptions {
  apiKey?: string;
  baseUrl?: string;
  model?: string;
  systemPrompt?: string;
}

const DEFAULT_MODEL = 'gpt-4o-mini';

const DEFAULT_SYSTEM_PROMPT = `You are the CTRL FreaQ co-authoring assistant. Given the document context, author prompt, and current draft, produce a JSON object describing an updated draft section that addresses the prompt.
- Respond with JSON only. Do not include markdown or commentary.
- Shape: { "proposalId": string, "updatedDraft": string, "confidence": number (0..1), "citations": string[] }
- Provide concise updates that improve clarity and accessibility while respecting the existing tone.`;

const isCompletedEvent = (
  event: ProposalProviderEvent | ProposalCompletedEvent | undefined
): event is ProposalCompletedEvent => {
  return Boolean(event && event.type === 'completed');
};

const extractJsonObject = (rawText: string): Record<string, unknown> | null => {
  const trimmed = rawText.trim();
  const start = trimmed.indexOf('{');
  const end = trimmed.lastIndexOf('}');
  if (start < 0 || end < 0 || end <= start) {
    return null;
  }

  try {
    return JSON.parse(trimmed.slice(start, end + 1)) as Record<string, unknown>;
  } catch {
    return null;
  }
};

const buildSystemPrompt = (customPrompt: string | undefined): string => {
  return customPrompt && customPrompt.trim().length > 0
    ? customPrompt.trim()
    : DEFAULT_SYSTEM_PROMPT;
};

const buildMessages = (payload: ProposalProviderPayload): CoreMessage[] => {
  const { session, prompt, context } = payload;

  const metadata = {
    session,
    prompt,
    context,
  } satisfies Record<string, unknown>;

  return [
    {
      role: 'user',
      content: [
        {
          type: 'text',
          text: `Author intent: ${prompt.intent}\nPrompt: ${prompt.text}`,
        },
        {
          type: 'text',
          text: `Context JSON:\n${JSON.stringify(metadata, null, 2)}`,
        },
      ],
    },
  ];
};

const parseCompletion = (rawText: string): ProposalCompletedEvent['data'] => {
  const parsed = extractJsonObject(rawText);
  if (!parsed) {
    return {
      proposalId: randomUUID(),
      confidence: undefined,
      annotations: [],
      diff: undefined,
      rawText,
    };
  }

  const proposalId =
    typeof parsed.proposalId === 'string' && parsed.proposalId.trim().length > 0
      ? parsed.proposalId
      : randomUUID();
  const confidence =
    typeof parsed.confidence === 'number' && Number.isFinite(parsed.confidence)
      ? parsed.confidence
      : undefined;

  const annotations = Array.isArray(parsed.annotations)
    ? (parsed.annotations as Array<Record<string, unknown>>)
    : [];

  const diff =
    typeof parsed.diff === 'object' && parsed.diff !== null
      ? (parsed.diff as Record<string, unknown>)
      : undefined;

  return {
    proposalId,
    confidence,
    annotations,
    diff,
    rawText,
  };
};

export function createVercelAIProposalProvider(
  options: VercelAIProposalProviderOptions = {}
): ProposalProvider {
  return {
    async *streamProposal(payload) {
      const apiKey = options.apiKey ?? process.env.AI_SDK_API_KEY;
      if (!apiKey) {
        throw Object.assign(
          new Error('AI_SDK_API_KEY environment variable is required for proposal streaming'),
          {
            code: 'MISSING_AI_API_KEY',
          }
        );
      }

      const modelId = options.model ?? process.env.AI_PROPOSAL_MODEL ?? DEFAULT_MODEL;
      const systemPrompt = buildSystemPrompt(options.systemPrompt);
      const openai = createOpenAI({
        apiKey,
        baseURL: options.baseUrl ?? process.env.AI_SDK_BASE_URL,
      });

      const startedAt = Date.now();
      yield {
        type: 'progress',
        data: { status: 'streaming', elapsedMs: 0 },
      } satisfies ProposalProviderEvent;

      const model = openai(modelId) as unknown as Parameters<typeof streamText>[0]['model'];

      const result = await streamText({
        model,
        system: systemPrompt,
        messages: buildMessages(payload),
      });

      let buffer = '';

      for await (const part of result.fullStream) {
        if (part.type === 'text-delta') {
          buffer += part.textDelta;
          yield { type: 'token', data: { value: part.textDelta } } satisfies ProposalProviderEvent;
        }

        if (part.type === 'step-finish' || part.type === 'finish') {
          const elapsed = Date.now() - startedAt;
          yield {
            type: 'progress',
            data: { status: 'awaiting-approval', elapsedMs: elapsed },
          } satisfies ProposalProviderEvent;
        }

        if (part.type === 'error') {
          const error = part.error instanceof Error ? part.error : new Error(String(part.error));
          throw error;
        }
      }

      const completion = parseCompletion(buffer);
      return { type: 'completed', data: completion } as ProposalCompletedEvent;
    },
  } satisfies ProposalProvider;
}

export async function runProposalSession(
  options: ProposalSessionOptions
): Promise<ProposalSessionResult> {
  const { session, prompt, context, provider, onEvent, replay } = options;

  const payload: ProposalProviderPayload = {
    session,
    prompt,
    context,
    ...(replay ? { replay: true } : {}),
  };

  const iterator = provider.streamProposal(payload)[Symbol.asyncIterator]();
  const events: ProposalStreamEvent[] = [];

  let completion: ProposalCompletedEvent['data'] | undefined;

  let progressTimer: NodeJS.Timeout | null = null;
  let streamingAnchor: number | null = null;
  let lastProgressElapsed = 0;

  const emitSyntheticProgress = (elapsedMs: number) => {
    const progressEvent: ProposalStreamEvent<'progress', { status: string; elapsedMs: number }> = {
      type: 'progress',
      data: {
        status: 'streaming',
        elapsedMs,
      },
    };
    events.push(progressEvent);
    if (onEvent) {
      void Promise.resolve(onEvent(progressEvent)).catch(() => {});
    }
  };

  const clearProgressTimer = () => {
    if (progressTimer) {
      clearInterval(progressTimer);
      progressTimer = null;
    }
    streamingAnchor = null;
    lastProgressElapsed = 0;
  };

  const ensureProgressTimer = (eventElapsed: number) => {
    const elapsed = Math.max(0, eventElapsed);
    const anchorCandidate = Date.now() - elapsed;
    if (streamingAnchor === null || anchorCandidate < streamingAnchor) {
      streamingAnchor = anchorCandidate;
    }
    if (elapsed > lastProgressElapsed) {
      lastProgressElapsed = elapsed;
    }
    if (progressTimer) {
      return;
    }

    progressTimer = setInterval(() => {
      if (streamingAnchor === null) {
        return;
      }
      const now = Date.now();
      const elapsedMs = Math.max(0, now - streamingAnchor);
      if (elapsedMs <= lastProgressElapsed) {
        return;
      }
      lastProgressElapsed = elapsedMs;
      emitSyntheticProgress(elapsedMs);
    }, 1_000);
  };

  while (true) {
    const { value, done } = await iterator.next();

    if (done) {
      clearProgressTimer();
      if (isCompletedEvent(value)) {
        completion = value.data;
      }
      break;
    }

    const event = value as ProposalProviderEvent;

    if (isCompletedEvent(event)) {
      completion = event.data;
      break;
    }

    if (event.type === 'progress') {
      const status = event.data.status;
      if (status === 'streaming' || status === 'queued') {
        ensureProgressTimer(event.data.elapsedMs);
      }
      if (status === 'awaiting-approval' || status === 'error') {
        clearProgressTimer();
      }
      if (status === 'streaming' && event.data.elapsedMs > lastProgressElapsed) {
        lastProgressElapsed = event.data.elapsedMs;
      }
    }

    events.push(event);
    if (onEvent) {
      await onEvent(event);
    }
  }

  clearProgressTimer();

  if (!completion) {
    throw new Error('Proposal session ended without a completion event');
  }

  return {
    sessionId: session.sessionId,
    proposalId: completion.proposalId,
    confidence: completion.confidence,
    annotations: completion.annotations ?? [],
    diff: completion.diff,
    events,
    rawText: completion.rawText,
  };
}

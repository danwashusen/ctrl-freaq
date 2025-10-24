import { describe, expect, it, vi, afterEach } from 'vitest';

vi.mock('@ai-sdk/openai', () => ({
  createOpenAI: vi.fn(() => (modelId: string) => ({ model: modelId })),
}));

vi.mock('ai', async () => {
  const actual = await vi.importActual<typeof import('ai')>('ai');
  return {
    ...actual,
    streamText: vi.fn(),
  };
});

import type { ProposalCompletedEvent, ProposalStreamEvent } from './proposal-runner';
import {
  createVercelAIProposalProvider,
  runProposalSession,
  type ProposalProviderEvent,
  type ProposalProviderPayload,
} from './proposal-runner';
import { streamText } from 'ai';

afterEach(() => {
  vi.clearAllMocks();
});

const isStreamingProgressEvent = (
  event: ProposalStreamEvent
): event is ProposalStreamEvent<'progress', { status: string; elapsedMs: number }> => {
  if (event.type !== 'progress') {
    return false;
  }
  const payload = event.data as Record<string, unknown>;
  const status = payload.status;
  const elapsedMs = payload.elapsedMs;
  if (typeof status !== 'string' || status !== 'streaming') {
    return false;
  }
  if (typeof elapsedMs !== 'number') {
    return false;
  }
  return true;
};

describe('runProposalSession', () => {
  const session = {
    sessionId: 'session-coauthor-123',
    documentId: 'doc-architecture-demo',
    sectionId: 'architecture-overview',
    authorId: 'user_staff_eng',
  };

  const prompt = {
    promptId: 'prompt-improve-architecture',
    intent: 'improve' as const,
    text: 'Suggest accessibility improvements for the architecture overview.',
  };

  const context = {
    documentId: session.documentId,
    sectionId: session.sectionId,
    documentTitle: 'CTRL FreaQ Architecture',
    completedSections: [
      { path: '/architecture/introduction.md', content: '# Intro\nApproved summary' },
      { path: '/architecture/overview.md', content: '# Overview\nCurrent approved content' },
    ],
    currentDraft: '## Draft\nPending improvements.',
    decisionSummaries: [{ id: 'decision:telemetry', summary: 'Telemetry logs console only.' }],
    knowledgeItems: [{ id: 'knowledge:wcag', excerpt: 'ARIA live updates required.' }],
    clarifications: ['Always include full document context in provider payloads.'],
  };

  it('forwards provider payload with entire document context', async () => {
    const onEvent = vi.fn();
    const provider = {
      streamProposal: vi.fn(async function* streamProposal() {
        yield { type: 'progress' as const, data: { status: 'streaming', elapsedMs: 1200 } };
        return {
          type: 'completed' as const,
          data: { proposalId: 'proposal-ctx', diff: { segments: [] } },
        };
      }),
    };

    await runProposalSession({ session, prompt, context, provider, onEvent });

    expect(provider.streamProposal).toHaveBeenCalledTimes(1);
    const [firstCall] = provider.streamProposal.mock.calls as Array<unknown[]>;
    const call = firstCall?.[0];
    expect(call).toMatchObject({
      session,
      prompt,
      context: expect.objectContaining({
        completedSections: [
          expect.objectContaining({ path: '/architecture/introduction.md' }),
          expect.objectContaining({ path: '/architecture/overview.md' }),
        ],
      }),
    });
  });

  it('emits streaming events and returns aggregated proposal snapshot', async () => {
    const onEvent = vi.fn();
    const provider = {
      streamProposal: vi.fn(async function* streamProposal() {
        yield { type: 'progress' as const, data: { status: 'queued', elapsedMs: 0 } };
        yield { type: 'progress' as const, data: { status: 'streaming', elapsedMs: 1800 } };
        yield { type: 'token' as const, data: { value: 'First token' } };
        yield { type: 'token' as const, data: { value: 'Second token' } };
        return {
          type: 'completed' as const,
          data: {
            proposalId: 'proposal-stream-123',
            confidence: 0.84,
            annotations: [
              {
                segmentId: 'turn-improve-1::added::0',
                segmentType: 'added' as const,
                originTurnId: 'turn-improve-1',
                promptId: prompt.promptId,
                rationale: 'Added accessibility clarifications.',
                confidence: 0.84,
                citations: ['decision:telemetry'],
              },
            ],
            diff: {
              mode: 'unified',
              segments: [],
            },
          },
        };
      }),
    };

    const result = await runProposalSession({ session, prompt, context, provider, onEvent });

    expect(onEvent.mock.calls.map(args => args[0])).toEqual([
      { type: 'progress', data: { status: 'queued', elapsedMs: 0 } },
      { type: 'progress', data: { status: 'streaming', elapsedMs: 1800 } },
      { type: 'token', data: { value: 'First token' } },
      { type: 'token', data: { value: 'Second token' } },
    ]);

    expect(result).toMatchObject({
      sessionId: session.sessionId,
      proposalId: 'proposal-stream-123',
      confidence: 0.84,
      annotations: expect.arrayContaining([
        expect.objectContaining({ promptId: prompt.promptId, originTurnId: 'turn-improve-1' }),
      ]),
      events: expect.arrayContaining([
        { type: 'progress', data: { status: 'queued', elapsedMs: 0 } },
        { type: 'token', data: { value: 'First token' } },
      ]),
    });
  });

  it('synthesizes streaming progress updates while the provider is idle', async () => {
    vi.useFakeTimers();
    try {
      const onEvent = vi.fn();
      const provider = {
        streamProposal: vi.fn(async function* streamProposal() {
          yield { type: 'progress' as const, data: { status: 'streaming', elapsedMs: 0 } };
          await new Promise(resolve => {
            setTimeout(resolve, 6_000);
          });
          return {
            type: 'completed' as const,
            data: {
              proposalId: 'proposal-delayed-001',
              diff: { mode: 'unified', segments: [] },
              confidence: 0.6,
            },
          };
        }),
      };

      const runPromise = runProposalSession({ session, prompt, context, provider, onEvent });

      await vi.advanceTimersByTimeAsync(6_100);
      const result = await runPromise;

      const streamingEvents = onEvent.mock.calls
        .map(args => args[0] as ProposalStreamEvent)
        .filter(event => isStreamingProgressEvent(event) && event.data.elapsedMs >= 5_000);

      expect(streamingEvents.length).toBeGreaterThan(0);
      expect(
        result.events.some(
          event => isStreamingProgressEvent(event) && event.data.elapsedMs >= 5_000
        )
      ).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('createVercelAIProposalProvider', () => {
  const payload: ProposalProviderPayload = {
    session: {
      sessionId: 'provider-session-123',
      documentId: 'doc-provider-456',
      sectionId: 'section-provider-789',
      authorId: 'author-001',
    },
    prompt: {
      promptId: 'prompt-provider',
      intent: 'explain',
      text: 'Explain the architecture of CTRL FreaQ.',
    },
    context: {
      documentId: 'doc-provider-456',
      sectionId: 'section-provider-789',
      documentTitle: 'CTRL FreaQ Architecture',
      completedSections: [],
      currentDraft: 'Draft content placeholder.',
      decisionSummaries: [],
      knowledgeItems: [],
      clarifications: [],
    },
  };

  it('emits v5 stream events and aggregates assistant message parts', async () => {
    const stream = (async function* () {
      yield { type: 'text-delta', id: 'text-1', text: 'Hello ' };
      yield { type: 'reasoning-start', id: 'reason-1' };
      yield { type: 'reasoning-delta', id: 'reason-1', text: 'thinking' };
      yield { type: 'reasoning-end', id: 'reason-1' };
      yield {
        type: 'tool-input-start',
        id: 'tool-input-1',
        toolName: 'searchDocs',
        providerExecuted: true,
        dynamic: false,
      };
      yield {
        type: 'tool-input-delta',
        id: 'tool-input-1',
        delta: '{"query":"CTRL FreaQ"}',
      };
      yield { type: 'tool-input-end', id: 'tool-input-1' };
      yield {
        type: 'tool-call',
        toolCallId: 'tool-call-1',
        toolName: 'searchDocs',
        args: { query: 'CTRL FreaQ' },
      };
      yield {
        type: 'finish-step',
        response: { id: 'response-1', modelId: 'gpt-4o' },
        usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
        finishReason: 'stop',
        providerMetadata: {},
      };
      yield {
        type: 'finish',
        finishReason: 'stop',
        totalUsage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
      };
    })();

    vi.mocked(streamText).mockReturnValue({
      fullStream: stream,
      response: Promise.resolve({
        messages: [
          {
            role: 'assistant',
            content: [
              { type: 'text', text: 'Hello ' },
              { type: 'text', text: 'world!' },
              { type: 'tool-result', toolName: 'searchDocs', result: 'complete' },
            ],
          },
        ],
      }),
    } as unknown as ReturnType<typeof streamText>);

    const provider = createVercelAIProposalProvider({ apiKey: 'test-key' });
    const iterator = provider.streamProposal(payload)[Symbol.asyncIterator]();

    const events: ProposalProviderEvent[] = [];
    let completion: ProposalCompletedEvent['data'] | undefined;

    while (true) {
      const { value, done } = await iterator.next();
      if (done) {
        if (value && value.type === 'completed') {
          completion = value.data;
        }
        break;
      }
      events.push(value as ProposalProviderEvent);
    }

    expect(events.some(event => event.type === 'token')).toBe(true);
    expect(events.some(event => event.type === 'reasoning-delta')).toBe(true);
    expect(events.some(event => event.type === 'tool-input-start')).toBe(true);
    expect(events.some(event => event.type === 'tool-call')).toBe(true);
    expect(events.some(event => event.type === 'finish-step')).toBe(true);
    expect(events.some(event => event.type === 'finish')).toBe(true);

    expect(completion?.rawText).toBe('Hello world!');
    expect(completion?.parts?.filter(part => part.type === 'text')).toHaveLength(2);
    expect(completion?.parts?.some(part => part.type === 'tool-result')).toBe(true);
  });
});

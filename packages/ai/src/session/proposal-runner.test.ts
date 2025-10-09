import { describe, expect, it, vi } from 'vitest';

import type { ProposalStreamEvent } from './proposal-runner';
import { runProposalSession } from './proposal-runner';

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

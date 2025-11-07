import { describe, expect, it, beforeEach, vi } from 'vitest';

import { createAssumptionsFlowBootstrap } from '@/features/document-editor/assumptions-flow';
import type { AssumptionPromptState } from '@/features/document-editor/types/assumption-session';
import type {
  ProposalHistoryEntry,
  ProposalStore,
} from '@/features/document-editor/assumptions-flow/stores/proposal-store';
import { AssumptionsApiService } from '@/features/document-editor/services/assumptions-api';
import type {
  AssumptionSessionSnapshot,
  DraftProposalSnapshot,
} from '@ctrl-freaq/editor-persistence/assumption-sessions/session-store';
import { createAssumptionSessionStore } from '@ctrl-freaq/editor-persistence/assumption-sessions/session-store';

interface MockPrompt extends AssumptionPromptState {
  priority: number;
}

const createMockPrompt = (overrides: Partial<MockPrompt> = {}): AssumptionPromptState => ({
  id: overrides.id ?? 'assume-1',
  heading: overrides.heading ?? 'Confirm security baseline',
  body: overrides.body ?? 'Does this change alter security posture?',
  responseType: overrides.responseType ?? 'single_select',
  options: overrides.options ?? [
    { id: 'yes-review', label: 'Requires review', description: null, defaultSelected: false },
    { id: 'no-change', label: 'No impact', description: null, defaultSelected: true },
  ],
  priority: overrides.priority ?? 0,
  status: overrides.status ?? 'pending',
  answer: overrides.answer ?? null,
  overrideJustification: overrides.overrideJustification ?? null,
  unresolvedOverrideCount: overrides.unresolvedOverrideCount ?? 0,
  escalation: overrides.escalation,
});

type MockSessionStore = ReturnType<typeof createAssumptionSessionStore>;

const createMockProposalStore = (): ProposalStore => {
  const history: ProposalHistoryEntry[] = [];
  let latestFailure: {
    reason: string;
    recoveryAction: 'retry' | 'manual';
    timestamp: string;
  } | null = null;
  return {
    clear: () => {
      history.length = 0;
      latestFailure = null;
    },
    recordProposal: proposal => {
      const createdAt = proposal.recordedAt ?? new Date().toISOString();
      const nextEntry: ProposalHistoryEntry = {
        proposalId: proposal.proposalId,
        proposalIndex: proposal.proposalIndex,
        contentMarkdown: proposal.contentMarkdown,
        rationale: proposal.rationale,
        source: proposal.source,
        recordedAt: proposal.recordedAt,
        createdAt,
        supersededByProposalId: null,
      };

      const nextHistory = history.filter(entry => entry.proposalId !== proposal.proposalId);
      nextHistory.push(nextEntry);
      nextHistory.sort((a, b) => a.proposalIndex - b.proposalIndex);
      for (let index = 0; index < nextHistory.length; index += 1) {
        const current = nextHistory[index];
        if (!current) continue;
        current.supersededByProposalId = nextHistory[index + 1]?.proposalId ?? null;
      }

      history.length = 0;
      history.push(...nextHistory.map(entry => ({ ...entry })));
      latestFailure = null;
    },
    getHistory: () => history.map(entry => ({ ...entry })),
    recordFailure: details => {
      latestFailure = { ...details };
    },
    getLatestFailure: () => (latestFailure ? { ...latestFailure } : null),
    hydrateHistory: entries => {
      const cloned = entries.map(entry => ({ ...entry }));
      cloned.sort((a, b) => a.proposalIndex - b.proposalIndex);
      history.length = 0;
      history.push(...cloned);
      latestFailure = null;
    },
  } satisfies ProposalStore;
};

const createMockSessionStore = (): MockSessionStore => {
  const sessions = new Map<string, AssumptionSessionSnapshot>();
  const proposals = new Map<string, DraftProposalSnapshot[]>();

  return {
    async saveSession(snapshot: AssumptionSessionSnapshot) {
      sessions.set(snapshot.sessionId, snapshot);
    },
    async getSession(sessionId: string): Promise<AssumptionSessionSnapshot | undefined> {
      return sessions.get(sessionId);
    },
    async appendProposal(sessionId: string, proposal: DraftProposalSnapshot): Promise<void> {
      const existing = proposals.get(sessionId) ?? [];
      const filtered = existing.filter(item => item.proposalId !== proposal.proposalId);
      filtered.push(proposal);
      filtered.sort((a, b) => a.proposalIndex - b.proposalIndex);
      proposals.set(sessionId, filtered);
    },
    async getProposals(sessionId: string): Promise<DraftProposalSnapshot[]> {
      return proposals.get(sessionId)?.slice() ?? [];
    },
    async listSessions(): Promise<AssumptionSessionSnapshot[]> {
      return Array.from(sessions.values());
    },
    async clear(): Promise<void> {
      sessions.clear();
      proposals.clear();
    },
  } satisfies MockSessionStore;
};

describe('Performance: assumption flow', () => {
  beforeEach(() => {
    vi.useRealTimers();
  });

  it('builds initial checklist state in under 120ms', async () => {
    const mockPrompts = [
      createMockPrompt({ id: 'assume-1', priority: 1 }),
      createMockPrompt({ id: 'assume-2', heading: 'List new dependencies', priority: 2 }),
    ];

    const bootstrap = createAssumptionsFlowBootstrap({
      api: {
        async startSession(
          _documentId: string,
          _sectionId: string
        ): Promise<Awaited<ReturnType<AssumptionsApiService['startSession']>>> {
          return {
            sessionId: 'sess-checklist-fast',
            sectionId: 'sec-fast',
            prompts: mockPrompts,
            overridesOpen: 0,
            summaryMarkdown: '### Checklist seeded',
          };
        },
        async respondToPrompt() {
          throw new Error('respondToPrompt stub should not be called in this test');
        },
      } as unknown as AssumptionsApiService,
      sessionStore: createMockSessionStore(),
      proposalStoreFactory: () => createMockProposalStore(),
    });

    const startedAt = performance.now();
    const state = await bootstrap.start({ sectionId: 'sec-fast', documentId: 'doc-fast' });
    const durationMs = performance.now() - startedAt;

    expect(state.promptsRemaining).toBe(2);
    expect(durationMs).toBeLessThan(120);
  });

  it('streams proposal drafts with latency under 180ms', async () => {
    const service = new AssumptionsApiService({ baseUrl: 'http://localhost:5001/api/v1' });
    const mockProposal = {
      proposalId: 'prop-fast-1',
      proposalIndex: 0,
      contentMarkdown: '## Draft from streaming',
      rationale: [{ assumptionId: 'assume-1', summary: 'Auto generated' }],
      overridesOpen: 0,
    };
    const encoder = new TextEncoder();

    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(
          encoder.encode('event: chunk\n' + 'data: {"type":"chunk","content":"Draft chunk"}\n\n')
        );
        controller.enqueue(
          encoder.encode(
            `event: complete\n` + `data: ${JSON.stringify({ proposal: mockProposal })}\n\n`
          )
        );
        controller.close();
      },
    });

    const response = new Response(stream, {
      status: 200,
      headers: { 'Content-Type': 'text/event-stream' },
    });

    (
      service as unknown as {
        performStreamingRequest: (endpoint: string, body: unknown) => Promise<Response>;
      }
    ).performStreamingRequest = vi.fn(async () => response);

    const startedAt = performance.now();
    const result = await service.streamProposal('doc-fast', 'sec-fast', 'sess-fast', {
      source: 'ai_generate',
    });
    const durationMs = performance.now() - startedAt;

    expect(result).toEqual(mockProposal);
    expect(durationMs).toBeLessThan(180);
  });
});

import type { MockInstance } from 'vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { QueryClient } from '@tanstack/react-query';
import { mockFn } from '@ctrl-freaq/test-support';

import {
  AssumptionsApiService,
  ASSUMPTION_QUERY_KEYS,
} from '@/features/document-editor/services/assumptions-api';
import type {
  AssumptionProposal,
  AssumptionPromptState,
  StartAssumptionSessionResponse,
} from '@/features/document-editor/types/assumption-session';

const DOCUMENT_ID = 'doc-789';
const SECTION_ID = 'sec-123';
const SESSION_ID = 'sess-abc';

const buildPrompt = (overrides: Partial<AssumptionPromptState> = {}): AssumptionPromptState => ({
  id: overrides.id ?? 'prompt-1',
  heading: overrides.heading ?? 'Confirm latency target',
  body: overrides.body ?? 'Does this section keep latency < 300ms?',
  responseType: overrides.responseType ?? 'text',
  options: overrides.options ?? [],
  priority: overrides.priority ?? 0,
  status: overrides.status ?? 'pending',
  answer: overrides.answer ?? null,
  overrideJustification: overrides.overrideJustification ?? null,
  unresolvedOverrideCount: overrides.unresolvedOverrideCount ?? 1,
  escalation: overrides.escalation,
});

const buildProposal = (overrides: Partial<AssumptionProposal> = {}): AssumptionProposal => ({
  proposalId: overrides.proposalId ?? 'prop-1',
  proposalIndex: overrides.proposalIndex ?? 0,
  contentMarkdown: overrides.contentMarkdown ?? '# Draft',
  rationale: overrides.rationale ?? [{ assumptionId: 'prompt-1', summary: 'baseline' }],
  overridesOpen: overrides.overridesOpen ?? 0,
});

describe('AssumptionsApiService', () => {
  let queryClient: QueryClient;
  let fetchSpy: MockInstance;

  beforeEach(() => {
    queryClient = new QueryClient();
    fetchSpy = vi.spyOn(globalThis as any, 'fetch') as unknown as MockInstance;
  });

  afterEach(async () => {
    fetchSpy.mockRestore();
    await queryClient.invalidateQueries();
    queryClient.clear();
  });

  it('caches session + prompts when starting an assumption session', async () => {
    const responseBody: StartAssumptionSessionResponse = {
      sessionId: SESSION_ID,
      sectionId: SECTION_ID,
      overridesOpen: 1,
      summaryMarkdown: '## Summary',
      prompts: [buildPrompt()],
      documentDecisionSnapshotId: null,
    };

    fetchSpy.mockResolvedValue(
      new Response(JSON.stringify(responseBody), {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    const service = new AssumptionsApiService({ queryClient, baseUrl: 'https://example.test' });

    const result = await service.startSession(DOCUMENT_ID, SECTION_ID, {
      templateVersion: '1.0.0',
    });

    expect(result).toEqual(responseBody);
    expect(queryClient.getQueryData(ASSUMPTION_QUERY_KEYS.session(SESSION_ID))).toEqual(
      responseBody
    );
    expect(queryClient.getQueryData(ASSUMPTION_QUERY_KEYS.prompts(SESSION_ID))).toEqual(
      responseBody.prompts
    );
    const [url] = fetchSpy.mock.calls[0] ?? [];
    expect(String(url)).toContain(
      `/documents/${DOCUMENT_ID}/sections/${SECTION_ID}/assumptions/session`
    );
  });

  it('streams proposal events over SSE and resolves with final proposal', async () => {
    const streamChunks = [
      'event: chunk\n',
      'data: {"type":"chunk","content":"partial"}\n\n',
      'event: complete\n',
      `data: {"type":"complete","proposal":${JSON.stringify(buildProposal())}}\n\n`,
    ];

    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        const encoder = new TextEncoder();
        streamChunks.forEach(chunk => controller.enqueue(encoder.encode(chunk)));
        controller.close();
      },
    });

    fetchSpy.mockResolvedValue(
      new Response(stream, {
        status: 200,
        headers: { 'Content-Type': 'text/event-stream', 'X-Accel-Buffering': 'no' },
      })
    );

    const service = new AssumptionsApiService({ queryClient, baseUrl: 'https://example.test' });
    const chunkSpy = mockFn<(payload: { type: 'chunk'; content: string }) => void>();

    const proposal = await service.streamProposal(
      DOCUMENT_ID,
      SECTION_ID,
      SESSION_ID,
      { source: 'ai_generate' },
      { onChunk: chunkSpy }
    );

    expect(proposal.proposalId).toBe('prop-1');
    expect(chunkSpy).toHaveBeenCalledWith({ type: 'chunk', content: 'partial' });
    expect(queryClient.getQueryData(ASSUMPTION_QUERY_KEYS.proposals(SESSION_ID))).toEqual([
      buildProposal(),
    ]);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0] ?? [];
    expect(String(url)).toContain(
      `/documents/${DOCUMENT_ID}/sections/${SECTION_ID}/assumptions/session/${SESSION_ID}/proposals`
    );
    expect((init as RequestInit)?.headers).toMatchObject({ Accept: 'text/event-stream' });
  });

  it('falls back to JSON proposal creation when SSE is unavailable', async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response('Not SSE', {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    const fallbackProposal = buildProposal({ proposalId: 'prop-fallback' });

    class TestService extends AssumptionsApiService {
      public fallbackCalls = 0;
      override async createProposal(
        documentId: string,
        sectionId: string,
        sessionId: string,
        request: Parameters<AssumptionsApiService['createProposal']>[3]
      ): Promise<AssumptionProposal> {
        this.fallbackCalls += 1;
        expect(documentId).toBe(DOCUMENT_ID);
        expect(sectionId).toBe(SECTION_ID);
        expect(sessionId).toBe(SESSION_ID);
        expect(request).toMatchObject({ source: 'ai_generate' });
        return fallbackProposal;
      }
    }

    const service = new TestService({ queryClient, baseUrl: 'https://example.test' });

    const result = await service.streamProposal(DOCUMENT_ID, SECTION_ID, SESSION_ID, {
      source: 'ai_generate',
    });

    expect(result).toEqual(fallbackProposal);
    expect(service.fallbackCalls).toBe(1);
  });
});

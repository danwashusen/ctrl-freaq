import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Logger } from 'pino';
import type { Response } from 'express';
import type {
  ProposalSessionResult,
  ProposalStreamEvent,
} from '@ctrl-freaq/ai/session/proposal-runner.js';
import { createSectionStreamQueue } from '@ctrl-freaq/editor-core/streaming/section-stream-queue.js';
vi.mock('@ctrl-freaq/ai/session/proposal-runner.js', () => {
  const defaultResult: ProposalSessionResult = {
    sessionId: 'session-mock',
    proposalId: 'proposal-mock',
    confidence: 0.9,
    annotations: [],
    diff: {
      mode: 'unified',
      segments: [],
    },
    events: [],
    rawText: JSON.stringify({
      proposalId: 'proposal-mock',
      updatedDraft: 'Mock draft content',
      confidence: 0.9,
      citations: [],
    }),
  };

  return {
    runProposalSession: vi.fn(async () => ({ ...defaultResult })),
    createVercelAIProposalProvider: vi.fn(() => ({
      async *streamProposal() {
        // no-op placeholder for provider stream
      },
    })),
  };
});

import { runProposalSession } from '@ctrl-freaq/ai/session/proposal-runner.js';

import { AIProposalService } from './ai-proposal.service';
import type { AIProposalServiceDependencies } from './ai-proposal.service';
import type {
  DraftPersistenceAdapter,
  QueueProposalInput,
  QueueProposalResult,
} from './draft-persistence';
import type { CoAuthoringAuditLogger } from '@ctrl-freaq/qa';

const baseLogger = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
} as unknown as Logger;

const contextDeps: AIProposalServiceDependencies['context'] = {
  fetchDocumentSnapshot: vi.fn().mockResolvedValue({
    documentId: 'doc-architecture-demo',
    title: 'Architecture Overview',
    sections: [
      {
        sectionId: 'architecture-overview',
        path: 'architecture-overview',
        status: 'completed',
        title: 'Architecture Overview',
        content: 'Existing architecture overview content',
      },
    ],
  }),
  fetchActiveSectionDraft: vi.fn().mockResolvedValue(null),
  fetchDecisionSummaries: vi.fn().mockResolvedValue([]),
  fetchKnowledgeItems: vi.fn().mockResolvedValue([]),
  clarifications: [],
} satisfies AIProposalServiceDependencies['context'];

const buildService = (
  options: {
    dependencies?: Partial<AIProposalServiceDependencies>;
    streamQueue?: ReturnType<typeof createSectionStreamQueue>;
  } = {}
) => {
  const queueProposal = vi.fn(
    async (_input: QueueProposalInput): Promise<QueueProposalResult> => ({
      draftVersion: 8,
      draftId: 'draft-latest',
      requestId: 'req-proposal-apply',
      previousDraftVersion: 7,
    })
  );

  const draftPersistence: DraftPersistenceAdapter = {
    queueProposal,
    getLatestDraftSnapshot: vi.fn().mockResolvedValue(null),
    getSectionApprovedVersion: vi.fn().mockResolvedValue(null),
  };

  const recordProposalApproval = vi.fn().mockResolvedValue(undefined);

  const logIntent = vi.fn();
  const logProposal = vi.fn();
  const logApproval = vi.fn();
  const auditLogger: CoAuthoringAuditLogger = {
    logIntent,
    logProposal,
    logApproval,
  };

  const dependencies: AIProposalServiceDependencies = {
    logger: baseLogger,
    context: contextDeps,
    draftPersistence,
    changelogRepo: {
      recordProposalApproval,
    } as unknown as AIProposalServiceDependencies['changelogRepo'],
    auditLogger,
    now: () => new Date('2025-10-06T12:00:00Z'),
    ...(options.dependencies ?? {}),
  };

  const service = new AIProposalService(dependencies);

  if (options.streamQueue) {
    (
      service as unknown as {
        streamQueue?: ReturnType<typeof createSectionStreamQueue>;
      }
    ).streamQueue = options.streamQueue;
  }

  return {
    service,
    queueProposal,
    recordProposalApproval,
    logApproval,
    logProposal,
    auditLogger,
    streamQueue: options.streamQueue,
  };
};

const runProposalSessionMock = vi.mocked(runProposalSession);

const buildRunResult = (overrides: Partial<ProposalSessionResult> = {}): ProposalSessionResult => {
  const proposalId = overrides.proposalId ?? 'proposal-mock';
  return {
    sessionId: overrides.sessionId ?? 'session-mock',
    proposalId,
    confidence: overrides.confidence ?? 0.9,
    annotations: overrides.annotations ?? [],
    diff: overrides.diff ?? {
      mode: 'unified',
      segments: [],
    },
    events: overrides.events ?? [],
    rawText:
      overrides.rawText ??
      JSON.stringify({
        proposalId,
        updatedDraft: 'Updated draft content',
        confidence: overrides.confidence ?? 0.9,
        citations: [],
      }),
  };
};

const createDeferred = <T>() => {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

const flushMicrotasks = () => new Promise(resolve => setTimeout(resolve, 0));

const captureSse = () => {
  const events: Array<{ event: string; data: unknown }> = [];
  let pending: Partial<{ event: string; data: unknown }> = {};

  const res: Partial<Response> = {
    setHeader: vi.fn(),
    flushHeaders: vi.fn(),
    write(chunk: string) {
      const text = chunk.toString();
      for (const line of text.split('\n')) {
        if (line.startsWith('event:')) {
          pending.event = line.replace('event:', '').trim();
        } else if (line.startsWith('data:')) {
          const payload = line.replace('data:', '').trim();
          try {
            pending.data = JSON.parse(payload);
          } catch {
            pending.data = payload;
          }
        } else if (line.trim() === '' && pending.event) {
          events.push({
            event: pending.event,
            data: pending.data ?? null,
          });
          pending = {};
        }
      }
      return true;
    },
    on: vi.fn(),
    end: vi.fn(),
  };

  return { res: res as Response, events };
};

const startProposalInput = (
  overrides: Partial<Parameters<AIProposalService['startProposal']>[0]> = {}
) => ({
  sessionId: overrides.sessionId ?? 'session-active',
  documentId: overrides.documentId ?? 'doc-architecture-demo',
  sectionId: overrides.sectionId ?? 'architecture-overview',
  authorId: overrides.authorId ?? 'user_staff_eng',
  promptId: overrides.promptId ?? 'prompt-001',
  turnId: overrides.turnId ?? 'turn-001',
  intent: overrides.intent ?? 'improve',
  prompt: overrides.prompt ?? 'Improve clarity',
  draftVersion: overrides.draftVersion,
  baselineVersion: overrides.baselineVersion,
  knowledgeItemIds: overrides.knowledgeItemIds ?? [],
  decisionIds: overrides.decisionIds ?? [],
});

const seedPendingProposal = (service: AIProposalService) => {
  const pending = {
    sessionId: 'session-123',
    documentId: 'doc-architecture-demo',
    sectionId: 'architecture-overview',
    authorId: 'user_staff_eng',
    proposalId: 'proposal-123',
    diff: { mode: 'unified', segments: [] },
    annotations: [
      {
        segmentId: 'proposal-123::added::0',
        segmentType: 'added' as const,
        originTurnId: 'turn-1',
        promptId: 'prompt-improve-1',
        rationale: 'Add clarity to introduction',
        confidence: 0.82,
        citations: ['decision:telemetry'],
      },
    ],
    diffHash: 'sha256:proposal123',
    snapshot: {
      proposalId: 'proposal-123',
      sessionId: 'session-123',
      originTurnId: 'turn-1',
      diff: { mode: 'unified', segments: [] },
      renderMode: 'unified' as const,
      confidence: 0.82,
      citations: ['decision:telemetry'],
      annotations: [],
      createdAt: new Date('2025-10-06T11:59:30Z'),
      expiresAt: new Date('2025-10-06T12:09:30Z'),
    },
    updatedDraft: '## Updated introduction with improved clarity',
    promptSummary: 'Improve the architecture overview introduction',
    confidence: 0.82,
    citations: ['decision:telemetry'],
    expiresAt: Date.now() + 600_000,
  } satisfies Record<string, unknown>;

  const internal = service as unknown as {
    pending: Map<string, Record<string, unknown>>;
    sessionProposals: Map<string, Set<string>>;
  };

  internal.pending.set('proposal-123', pending);
  const proposals = internal.sessionProposals.get('session-123') ?? new Set<string>();
  proposals.add('proposal-123');
  internal.sessionProposals.set('session-123', proposals);
};

describe('AIProposalService approveProposal', () => {
  it('queues draft persistence, records changelog, and logs approval without transcripts', async () => {
    const { service, queueProposal, recordProposalApproval, logApproval } = buildService();
    seedPendingProposal(service);

    const result = await service.approveProposal({
      documentId: 'doc-architecture-demo',
      sectionId: 'architecture-overview',
      sessionId: 'session-123',
      authorId: 'user_staff_eng',
      proposalId: 'proposal-123',
      diffHash: 'sha256:proposal123',
      draftPatch: 'diff --git a/section.md b/section.md\n@@\n-Old\n+New',
      approvalNotes: 'Improved clarity',
    });

    expect(result).not.toBeNull();
    expect(result).toMatchObject({
      status: 'queued',
      queue: {
        draftVersion: 7,
        diffHash: 'sha256:proposal123',
      },
      changelog: expect.objectContaining({
        proposalId: 'proposal-123',
        confidence: 0.82,
      }),
    });

    expect(queueProposal).toHaveBeenCalledWith(
      expect.objectContaining({
        documentId: 'doc-architecture-demo',
        sectionId: 'architecture-overview',
        authorId: 'user_staff_eng',
        proposalId: 'proposal-123',
        diffHash: 'sha256:proposal123',
        draftPatch: 'diff --git a/section.md b/section.md\n@@\n-Old\n+New',
        updatedDraft: '## Updated introduction with improved clarity',
      })
    );

    expect(recordProposalApproval).toHaveBeenCalledWith(
      expect.objectContaining({
        proposal: expect.objectContaining({
          proposalId: 'proposal-123',
        }),
      })
    );

    const approvalPayload = logApproval.mock.calls[0]?.[0];
    expect(approvalPayload).toMatchObject({
      eventId: expect.any(String),
      proposalId: 'proposal-123',
      diffHash: 'sha256:proposal123',
    });

    // Pending proposal should be consumed
    const consumed = service.consumePendingProposal('proposal-123');
    expect(consumed).toBeNull();
  });

  it('builds fallback pending state when proposal is missing', async () => {
    const { service, queueProposal, recordProposalApproval, logApproval } = buildService();

    let canonicalDiffHash: string | undefined;

    await expect(
      service
        .approveProposal({
          documentId: 'doc-architecture-demo',
          sectionId: 'architecture-overview',
          sessionId: 'session-123',
          authorId: 'user_staff_eng',
          proposalId: 'proposal-missing',
          diffHash: 'sha256:invalid',
          draftPatch: 'diff --git a/a b/a',
        })
        .catch(error => {
          if (error && typeof error === 'object' && 'context' in error) {
            canonicalDiffHash = (error as { context?: { expectedDiffHash?: string } }).context
              ?.expectedDiffHash;
          }
          throw error;
        })
    ).rejects.toThrowError(/diff hash/i);

    expect(canonicalDiffHash).toBeDefined();

    const result = await service.approveProposal({
      documentId: 'doc-architecture-demo',
      sectionId: 'architecture-overview',
      sessionId: 'session-123',
      authorId: 'user_staff_eng',
      proposalId: 'proposal-missing',
      diffHash: canonicalDiffHash!,
      draftPatch: 'diff --git a/a b/a',
    });

    expect(result).not.toBeNull();
    expect(result).toMatchObject({
      status: 'queued',
      queue: {
        diffHash: canonicalDiffHash,
      },
      changelog: expect.objectContaining({
        proposalId: 'proposal-missing',
      }),
    });

    expect(queueProposal).toHaveBeenCalledTimes(1);
    expect(recordProposalApproval).toHaveBeenCalledTimes(1);
    expect(logApproval).toHaveBeenCalledTimes(1);
  });

  it('rejects approvals when diff hash does not match pending snapshot', async () => {
    const { service } = buildService();
    seedPendingProposal(service);

    await expect(
      service.approveProposal({
        documentId: 'doc-architecture-demo',
        sectionId: 'architecture-overview',
        sessionId: 'session-123',
        authorId: 'user_staff_eng',
        proposalId: 'proposal-123',
        diffHash: 'sha256:tampered',
        draftPatch: 'diff --git a/section.md b/section.md\n@@\n-Old\n+New',
      })
    ).rejects.toThrowError(/diff hash/i);
  });

  it('returns queued draft version when no baseline metadata exists', async () => {
    const { service, queueProposal } = buildService();
    seedPendingProposal(service);

    queueProposal.mockResolvedValueOnce({
      draftVersion: 1,
      draftId: 'draft-new',
      requestId: 'req-initial',
      previousDraftVersion: null,
    });

    const result = await service.approveProposal({
      documentId: 'doc-architecture-demo',
      sectionId: 'architecture-overview',
      sessionId: 'session-123',
      authorId: 'user_staff_eng',
      proposalId: 'proposal-123',
      diffHash: 'sha256:proposal123',
      draftPatch: 'diff --git a/section.md b/section.md\n@@\n-Old\n+New',
    });

    expect(result).not.toBeNull();
    expect(result?.queue.draftVersion).toBe(1);
  });

  it('tears down session state when teardownSession is invoked', () => {
    const { service } = buildService();
    seedPendingProposal(service);

    const pendingBefore = (service as unknown as { pending: Map<string, unknown> }).pending.size;
    expect(pendingBefore).toBeGreaterThan(0);

    const serviceWithTeardown = service as unknown as {
      teardownSession: (input: { sessionId: string; reason: string }) => void;
    };

    expect(typeof serviceWithTeardown.teardownSession).toBe('function');

    serviceWithTeardown.teardownSession({ sessionId: 'session-123', reason: 'navigation' });

    const pendingAfter = (service as unknown as { pending: Map<string, unknown> }).pending.size;
    expect(pendingAfter).toBe(0);
  });

  it('evicts expired pending proposals during lifecycle cleanup', () => {
    const { service } = buildService();
    const internal = service as unknown as {
      pending: Map<string, { expiresAt: number; sessionId: string }>;
      sessionProposals: Map<string, Set<string>>;
    };

    internal.pending.set('expired-proposal', {
      expiresAt: Date.parse('2025-10-06T11:40:00Z'),
      sessionId: 'session-expired',
    });
    internal.sessionProposals.set('session-expired', new Set(['expired-proposal']));

    const serviceWithLifecycle = service as unknown as {
      evictExpiredSessions: (now: number) => void;
    };

    expect(typeof serviceWithLifecycle.evictExpiredSessions).toBe('function');

    serviceWithLifecycle.evictExpiredSessions(Date.parse('2025-10-06T12:00:00Z'));

    const pendingAfter = (service as unknown as { pending: Map<string, unknown> }).pending.size;
    expect(pendingAfter).toBe(0);
  });
});

describe('AIProposalService fallback interactions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    runProposalSessionMock.mockReset();
    runProposalSessionMock.mockResolvedValue(buildRunResult());
  });

  it('activates fallback path when streaming is disabled, preserving tokens and logging telemetry', async () => {
    const originalFlag = process.env.STREAMING_DISABLED;
    process.env.STREAMING_DISABLED = 'true';

    const { res, events } = captureSse();
    const { service, logProposal } = buildService();

    try {
      service.subscribe('session-fallback', res);

      const fallbackResult = buildRunResult({
        sessionId: 'session-fallback',
        proposalId: 'proposal-fallback',
        confidence: 0.61,
        rawText: JSON.stringify({
          proposalId: 'proposal-fallback',
          updatedDraft: 'Fallback completed draft',
          rationale: 'Assistant explanation for fallback delivery.',
          confidence: 0.61,
          citations: ['decision:queue-policy'],
        }),
        events: [
          {
            type: 'token',
            data: { sequence: 1, value: 'First preserved token' },
          },
          {
            type: 'token',
            data: { sequence: 2, value: 'Second preserved token' },
          },
        ],
      });

      runProposalSessionMock.mockResolvedValueOnce(fallbackResult);

      await service.startProposal(
        startProposalInput({
          sessionId: 'session-fallback',
          promptId: 'prompt-fallback',
          turnId: 'turn-fallback',
        })
      );

      await flushMicrotasks();
      await flushMicrotasks();

      const fallbackActiveEvent = events.find(
        entry =>
          entry.event === 'state' &&
          entry.data != null &&
          typeof entry.data === 'object' &&
          (entry.data as { status?: string }).status === 'fallback_active'
      );

      expect(fallbackActiveEvent).toBeDefined();
      expect(fallbackActiveEvent?.data).toMatchObject({
        status: 'fallback_active',
        fallbackReason: 'transport_blocked',
        preservedTokensCount: 2,
        retryAttempted: false,
      });

      const readyEvent = events.find(entry => entry.event === 'proposal.ready');
      expect(readyEvent).toBeDefined();
      expect(readyEvent?.data).toMatchObject({
        proposalId: 'proposal-fallback',
        confidence: 0.61,
        citations: expect.arrayContaining(['decision:queue-policy']),
      });

      const fallbackTelemetry = logProposal.mock.calls
        .map(call => call[0] ?? null)
        .find(payload => payload && payload.status === 'fallback');

      expect(fallbackTelemetry).toBeDefined();
      expect(fallbackTelemetry).toMatchObject({
        sessionId: 'session-fallback',
        fallbackReason: 'transport_blocked',
        preservedTokensCount: 2,
        delivery: 'fallback',
      });
    } finally {
      if (originalFlag === undefined) {
        delete process.env.STREAMING_DISABLED;
      } else {
        process.env.STREAMING_DISABLED = originalFlag;
      }
    }
  });

  it('supports cancelInteraction while fallback is pending and preserves cancel telemetry', async () => {
    const originalFlag = process.env.STREAMING_DISABLED;
    process.env.STREAMING_DISABLED = 'true';

    const { service, logProposal } = buildService();

    try {
      const deferredResult = createDeferred<ProposalSessionResult>();
      runProposalSessionMock.mockImplementationOnce(() => deferredResult.promise);

      await service.startProposal(
        startProposalInput({
          sessionId: 'session-fallback-cancel',
          promptId: 'prompt-fallback-cancel',
          turnId: 'turn-fallback-cancel',
        })
      );

      await flushMicrotasks();

      const cancelResult = await service.cancelInteraction({
        sessionId: 'session-fallback-cancel',
        sectionId: 'architecture-overview',
        reason: 'author_cancelled',
      });

      expect(cancelResult).toMatchObject({
        status: 'canceled',
        cancelReason: 'author_cancelled',
        promotedSessionId: null,
      });

      const cancelTelemetry = logProposal.mock.calls
        .map(call => call[0] ?? null)
        .find(
          payload =>
            payload && payload.status === 'canceled' && payload.cancelReason === 'author_cancelled'
        );

      expect(cancelTelemetry).toBeDefined();

      deferredResult.resolve(
        buildRunResult({
          sessionId: 'session-fallback-cancel',
          proposalId: 'proposal-fallback-cancel',
        })
      );

      await flushMicrotasks();
    } finally {
      if (originalFlag === undefined) {
        delete process.env.STREAMING_DISABLED;
      } else {
        process.env.STREAMING_DISABLED = originalFlag;
      }
    }
  });
});

describe('AIProposalService streaming interactions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    runProposalSessionMock.mockReset();
    runProposalSessionMock.mockResolvedValue(buildRunResult());
  });

  it('enqueues newest requests, reports replacement metadata, and logs concurrency slots', async () => {
    const { service, logProposal } = buildService();

    const firstDeferred = createDeferred<ProposalSessionResult>();
    runProposalSessionMock.mockImplementationOnce(() => firstDeferred.promise);

    const first = await service.startProposal(startProposalInput({ sessionId: 'session-primary' }));
    await flushMicrotasks();

    expect((first as any).queue).toMatchObject({
      disposition: 'started',
      concurrencySlot: 1,
      replacementPolicy: 'newest_replaces_pending',
    });

    const secondDeferred = createDeferred<ProposalSessionResult>();
    runProposalSessionMock.mockImplementationOnce(() => secondDeferred.promise);

    const second = await service.startProposal(
      startProposalInput({
        sessionId: 'session-secondary',
        promptId: 'prompt-002',
        turnId: 'turn-002',
      })
    );
    await flushMicrotasks();

    expect((second as any).queue).toMatchObject({
      disposition: 'pending',
      replacedSessionId: 'session-primary',
      replacementPolicy: 'newest_replaces_pending',
    });

    const proposalCalls = logProposal.mock.calls.map(call => call[0] ?? {});
    expect(
      proposalCalls.some(
        payload =>
          payload.sessionId === 'session-primary' &&
          payload.status === 'queued' &&
          payload.concurrencySlot === 1
      )
    ).toBe(true);
    expect(
      proposalCalls.some(
        payload =>
          payload.sessionId === 'session-secondary' &&
          payload.status === 'replaced' &&
          payload.replacedSessionId === 'session-primary'
      )
    ).toBe(true);

    firstDeferred.resolve(
      buildRunResult({ sessionId: 'session-primary', proposalId: 'proposal-primary' })
    );
    secondDeferred.resolve(
      buildRunResult({ sessionId: 'session-secondary', proposalId: 'proposal-secondary' })
    );
  });

  it('buffers out-of-order progress events before emitting to subscribers', async () => {
    const { service } = buildService();
    const { res, events } = captureSse();

    service.subscribe('session-buffer', res);

    runProposalSessionMock.mockImplementationOnce(async ({ onEvent }) => {
      const outOfOrder: ProposalStreamEvent[] = [
        {
          type: 'progress',
          data: { sequence: 3, status: 'drafting', elapsedMs: 120 },
        },
        {
          type: 'progress',
          data: { sequence: 1, status: 'started', elapsedMs: 10 },
        },
        {
          type: 'progress',
          data: { sequence: 2, status: 'streaming', elapsedMs: 60 },
        },
      ];

      for (const event of outOfOrder) {
        await onEvent?.(event);
      }

      return buildRunResult({
        sessionId: 'session-buffer',
        proposalId: 'proposal-buffer',
      });
    });

    await service.startProposal(
      startProposalInput({
        sessionId: 'session-buffer',
        promptId: 'prompt-buffer',
        turnId: 'turn-buffer',
      })
    );

    await flushMicrotasks();

    const progressSequences = events
      .filter(
        entry =>
          entry.event === 'progress' &&
          entry.data != null &&
          typeof (entry.data as { sequence?: number }).sequence === 'number'
      )
      .map(entry => (entry.data as { sequence: number }).sequence);

    expect(progressSequences).toEqual([1, 2, 3]);
  });

  it('provides cancelInteraction handler that frees queue slots and logs telemetry', async () => {
    const { service, logProposal } = buildService();

    const activeDeferred = createDeferred<ProposalSessionResult>();
    runProposalSessionMock.mockImplementationOnce(() => activeDeferred.promise);

    await service.startProposal(startProposalInput({ sessionId: 'session-cancel' }));
    await flushMicrotasks();

    const cancelInteraction = (
      service as unknown as {
        cancelInteraction?: (input: {
          sessionId: string;
          sectionId: string;
          reason: 'author_cancelled' | 'replaced_by_new_request';
        }) => Promise<{
          status: string;
          cancelReason: string;
          promotedSessionId: string | null;
        }>;
      }
    ).cancelInteraction;

    expect(typeof cancelInteraction).toBe('function');
    if (typeof cancelInteraction !== 'function') {
      return;
    }

    const result = await cancelInteraction.call(service, {
      sessionId: 'session-cancel',
      sectionId: 'architecture-overview',
      reason: 'author_cancelled',
    });

    expect(result).toMatchObject({
      status: 'canceled',
      cancelReason: 'author_cancelled',
      promotedSessionId: null,
    });

    expect(logProposal).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionId: 'session-cancel',
        status: 'canceled',
        cancelReason: 'author_cancelled',
        concurrencySlot: 1,
      })
    );

    activeDeferred.resolve(
      buildRunResult({ sessionId: 'session-cancel', proposalId: 'proposal-cancel' })
    );
  });

  it('provides retryInteraction handler that chains telemetry to original session', async () => {
    const { service, logProposal } = buildService();

    const activeDeferred = createDeferred<ProposalSessionResult>();
    runProposalSessionMock.mockImplementationOnce(() => activeDeferred.promise);

    await service.startProposal(startProposalInput({ sessionId: 'session-retry-source' }));
    await flushMicrotasks();

    const cancelInteraction = (
      service as unknown as {
        cancelInteraction?: (input: {
          sessionId: string;
          sectionId: string;
          reason: string;
        }) => Promise<unknown>;
      }
    ).cancelInteraction;

    expect(typeof cancelInteraction).toBe('function');
    if (typeof cancelInteraction !== 'function') {
      return;
    }

    await cancelInteraction.call(service, {
      sessionId: 'session-retry-source',
      sectionId: 'architecture-overview',
      reason: 'author_cancelled',
    });

    const retryDeferred = createDeferred<ProposalSessionResult>();
    runProposalSessionMock.mockImplementationOnce(() => retryDeferred.promise);

    const retryInteraction = (
      service as unknown as {
        retryInteraction?: (input: {
          sessionId: string;
          sectionId: string;
          intent?: string;
        }) => Promise<{
          status: string;
          previousSessionId: string;
          queue: Record<string, unknown>;
        }>;
      }
    ).retryInteraction;

    expect(typeof retryInteraction).toBe('function');
    if (typeof retryInteraction !== 'function') {
      return;
    }

    const retryResult = await retryInteraction.call(service, {
      sessionId: 'session-retry-source',
      sectionId: 'architecture-overview',
      intent: 'improve',
    });

    expect(retryResult).toMatchObject({
      status: 'requeued',
      previousSessionId: 'session-retry-source',
      queue: expect.objectContaining({
        disposition: 'pending',
        replacementPolicy: 'newest_replaces_pending',
      }),
    });

    expect(logProposal).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'retried',
        sourceSessionId: 'session-retry-source',
      })
    );

    retryDeferred.resolve(
      buildRunResult({
        sessionId: 'session-retry-fresh',
        proposalId: 'proposal-retry-fresh',
      })
    );
    activeDeferred.resolve(
      buildRunResult({ sessionId: 'session-retry-source', proposalId: 'proposal-retry-source' })
    );
  });
});

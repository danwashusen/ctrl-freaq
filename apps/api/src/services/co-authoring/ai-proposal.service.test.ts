import { describe, expect, it, vi } from 'vitest';
import type { Logger } from 'pino';

import { AIProposalService } from './ai-proposal.service';
import type { AIProposalServiceDependencies } from './ai-proposal.service';
import type {
  DraftPersistenceAdapter,
  QueueProposalInput,
  QueueProposalResult,
} from './draft-persistence';
import type { CoAuthoringAuditLogger } from '@ctrl-freaq/qa';

describe('AIProposalService approveProposal', () => {
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
      sections: [],
    }),
    fetchActiveSectionDraft: vi.fn().mockResolvedValue(null),
    fetchDecisionSummaries: vi.fn().mockResolvedValue([]),
    fetchKnowledgeItems: vi.fn().mockResolvedValue([]),
    clarifications: [],
  } satisfies AIProposalServiceDependencies['context'];

  const buildService = () => {
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
    };

    const service = new AIProposalService(dependencies);

    return {
      service,
      queueProposal,
      recordProposalApproval,
      logApproval,
    };
  };

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

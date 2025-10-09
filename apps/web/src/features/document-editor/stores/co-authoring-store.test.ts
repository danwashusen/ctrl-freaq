import { beforeEach, describe, expect, it } from 'vitest';

import { useCoAuthoringStore } from './co-authoring-store';

const baseSession = {
  sessionId: 'session-123',
  documentId: 'doc-architecture-demo',
  sectionId: 'architecture-overview',
  authorId: 'user_staff_eng',
  startedAt: new Date('2025-10-06T12:00:00Z').toISOString(),
  activeIntent: 'improve' as const,
  contextSources: ['decision:telemetry'],
  streamState: 'idle' as const,
};

const baseProposal = {
  proposalId: 'proposal-001',
  originTurnId: 'turn-1',
  diff: { mode: 'unified', segments: [] as Array<Record<string, unknown>> },
  annotations: [
    {
      segmentId: 'turn-1::added::0',
      segmentType: 'added',
      originTurnId: 'turn-1',
      promptId: 'prompt-improve',
      rationale: 'Improve clarity',
      confidence: 0.88,
      citations: ['decision:telemetry'],
    },
  ],
  confidence: 0.88,
  expiresAt: new Date('2025-10-06T12:10:00Z').toISOString(),
  citations: ['decision:telemetry'],
  diffHash: 'sha256:fixture',
  draftPatch: 'diff --git a/b b/b',
};

describe('co-authoring store', () => {
  beforeEach(() => {
    useCoAuthoringStore.getState().reset();
  });

  it('initializes sessions and resets transcript history', () => {
    const store = useCoAuthoringStore.getState();
    store.startSession(baseSession);
    store.appendTranscriptToken('First token');

    expect(useCoAuthoringStore.getState().session?.sessionId).toBe('session-123');
    expect(useCoAuthoringStore.getState().transcript.length).toBe(1);

    store.startSession({ ...baseSession, sessionId: 'session-456', activeIntent: 'explain' });

    const state = useCoAuthoringStore.getState();
    expect(state.session?.sessionId).toBe('session-456');
    expect(state.session?.activeIntent).toBe('explain');
    expect(state.transcript).toHaveLength(0);
    expect(state.turns).toHaveLength(0);
  });

  it('tracks streaming progress and transcript tokens', () => {
    const store = useCoAuthoringStore.getState();
    store.startSession(baseSession);

    store.updateStreamProgress({ status: 'queued', elapsedMs: 0 });
    expect(useCoAuthoringStore.getState().progress).toMatchObject({
      status: 'queued',
      elapsedMs: 0,
    });

    store.updateStreamProgress({ status: 'streaming', elapsedMs: 1800 });
    store.appendTranscriptToken('Token A ');
    store.appendTranscriptToken('Token B');

    const state = useCoAuthoringStore.getState();
    expect(state.progress).toMatchObject({ status: 'streaming', elapsedMs: 1800 });
    expect(state.transcript.join('')).toBe('Token A Token B');
  });

  it('records pending proposals and clears them upon approval', () => {
    const store = useCoAuthoringStore.getState();
    store.startSession(baseSession);
    store.setPendingProposal(baseProposal);

    expect(useCoAuthoringStore.getState().pendingProposal?.proposalId).toBe('proposal-001');

    store.approveProposal({
      proposalId: 'proposal-001',
      approvedAt: new Date('2025-10-06T12:03:00Z').toISOString(),
      approvedBy: 'user_staff_eng',
      approvalNotes: 'Adopt for clarity',
    });

    const state = useCoAuthoringStore.getState();
    expect(state.pendingProposal).toBeNull();
    expect(state.lastApprovedProposalId).toBe('proposal-001');
    expect(state.approvedHistory).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ proposalId: 'proposal-001', approvedBy: 'user_staff_eng' }),
      ])
    );
  });

  it('purges transcript and session state when section changes', () => {
    const store = useCoAuthoringStore.getState();
    store.startSession(baseSession);
    store.appendTranscriptToken('Token before purge');
    store.recordTurn({
      turnId: 'turn-1',
      sessionId: baseSession.sessionId,
      speaker: 'assistant',
      intent: 'improve',
      promptText: 'Initial prompt',
      responseText: 'Initial response',
      citations: [],
      confidence: 0.7,
      createdAt: new Date('2025-10-06T12:01:00Z').toISOString(),
    });

    store.teardownSession('section-change');

    const state = useCoAuthoringStore.getState();
    expect(state.session).toBeNull();
    expect(state.transcript).toHaveLength(0);
    expect(state.turns).toHaveLength(0);
    expect(state.progress.status).toBe('idle');
  });
});

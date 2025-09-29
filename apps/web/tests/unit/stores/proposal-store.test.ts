import { describe, expect, it } from 'vitest';

import { createProposalStore } from '@/features/document-editor/assumptions-flow/stores/proposal-store';

describe('ProposalStore', () => {
  it('retains only the 10 most recent proposals by index', () => {
    const store = createProposalStore({ sessionId: 'sess-limit' });

    for (let index = 0; index < 12; index += 1) {
      store.recordProposal({
        proposalId: `prop-${index}`,
        proposalIndex: index,
        contentMarkdown: `Draft ${index}`,
        rationale: [{ assumptionId: 'a-1', summary: 'note' }],
        source: 'ai_generated',
        recordedAt: `2025-09-29T00:${index.toString().padStart(2, '0')}:00.000Z`,
      });
    }

    const history = store.getHistory();

    expect(history).toHaveLength(10);
    const first = history[0]!;
    const last = history[history.length - 1]!;
    expect(first.proposalIndex).toBe(2);
    expect(last.proposalIndex).toBe(11);
    expect(history.map(entry => entry.proposalId)).not.toContain('prop-0');
    expect(history.map(entry => entry.proposalId)).not.toContain('prop-1');
  });

  it('hydrates history snapshots and clears last failure', () => {
    const store = createProposalStore({ sessionId: 'sess-hydrate' });

    store.recordFailure({
      reason: 'network',
      recoveryAction: 'retry',
      timestamp: '2025-09-29T01:00:00.000Z',
    });

    store.recordProposal({
      proposalId: 'existing',
      proposalIndex: 0,
      contentMarkdown: 'Old draft',
      rationale: [{ assumptionId: 'a-1', summary: 'old' }],
      source: 'ai_generated',
    });

    store.hydrateHistory([
      {
        proposalId: 'hydrated-1',
        proposalIndex: 1,
        contentMarkdown: 'Replacement draft',
        rationale: [{ assumptionId: 'a-1', summary: 'new' }],
        source: 'manual_revision',
        recordedAt: '2025-09-29T02:00:00.000Z',
        createdAt: '2025-09-29T02:00:00.000Z',
        supersededByProposalId: null,
      },
    ]);

    const history = store.getHistory();
    expect(history).toHaveLength(1);
    expect(history[0]!.proposalId).toBe('hydrated-1');
    expect(store.getLatestFailure()).toBeNull();
  });
});

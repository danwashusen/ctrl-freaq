import { describe, it, expect } from 'vitest';

import { createProposalStore } from '@/features/document-editor/assumptions-flow/stores/proposal-store';

describe('Assumptions Flow AI Fallback', () => {
  it('marks manual drafting available when AI proposal generation fails', () => {
    const store = createProposalStore({ sessionId: 'sess-002' });

    store.recordFailure({
      reason: 'ai_timeout',
      recoveryAction: 'manual',
      timestamp: '2025-09-29T05:10:00.000Z',
    });

    const failure = store.getLatestFailure();
    expect(failure).toMatchObject({
      reason: 'ai_timeout',
      recoveryAction: 'manual',
    });

    store.recordProposal({
      proposalId: 'prop-fallback',
      proposalIndex: 0,
      contentMarkdown: 'Manual draft content',
      rationale: [{ assumptionId: 'assume-1', summary: 'Manual fallback captured' }],
      source: 'fallback_manual',
    });

    const history = store.getHistory();
    expect(history).toHaveLength(1);
    expect(history[0]!.proposalId).toBe('prop-fallback');
  });
});

import { describe, it, expect } from 'vitest';

import { createProposalStore } from '@/features/document-editor/assumptions-flow/stores/proposal-store';

describe('Assumptions Flow Proposal History', () => {
  it('retains every generated draft with rationale mapping', () => {
    const store = createProposalStore({ sessionId: 'sess-001' });

    store.recordProposal({
      proposalId: 'prop-1',
      proposalIndex: 0,
      contentMarkdown: 'Draft v1',
      rationale: [{ assumptionId: 'assume-1', summary: 'Initial decision' }],
      source: 'ai_generated',
    });

    store.recordProposal({
      proposalId: 'prop-2',
      proposalIndex: 1,
      contentMarkdown: 'Draft v2 with edits',
      rationale: [{ assumptionId: 'assume-1', summary: 'Adjusted' }],
      source: 'manual_revision',
    });

    const history = store.getHistory();

    expect(history).toHaveLength(2);
    expect(history[0]).toMatchObject({ supersededByProposalId: 'prop-2' });
    expect(history[1]).toMatchObject({ supersededByProposalId: null });
  });
});

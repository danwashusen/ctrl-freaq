import { describe, expect, it } from 'vitest';

import { DraftProposalSchema } from './draft-proposal.js';

const baseProposal = {
  id: 'prop-1',
  sessionId: 'sess-1',
  sectionId: 'sec-1',
  proposalIndex: 0,
  source: 'ai_generated' as const,
  contentMarkdown: '# Draft content',
  rationale: [
    {
      assumptionId: 'assume-1',
      summary: 'Aligns with streaming baseline',
    },
  ],
  aiConfidence: 0.8,
  failedReason: null,
  createdAt: new Date('2025-09-29T05:00:05.000Z'),
  createdBy: 'user-1',
  supersededAt: null,
  supersededByProposalId: null,
  updatedAt: new Date('2025-09-29T05:00:05.000Z'),
  updatedBy: 'user-1',
  deletedAt: null,
  deletedBy: null,
};

describe('DraftProposalSchema', () => {
  it('parses draft proposal entities with rationale mapping', () => {
    const parsed = DraftProposalSchema.parse(baseProposal);
    expect(parsed.rationale).toHaveLength(1);
    expect(parsed.rationale[0].assumptionId).toBe('assume-1');
  });

  it('requires proposalIndex to be non-negative integer', () => {
    expect(() =>
      DraftProposalSchema.parse({
        ...baseProposal,
        proposalIndex: -1,
      })
    ).toThrow();
  });

  it('allows null aiConfidence when manual draft recorded', () => {
    const parsed = DraftProposalSchema.parse({
      ...baseProposal,
      source: 'manual_revision',
      aiConfidence: null,
    });

    expect(parsed.aiConfidence).toBeNull();
  });
});

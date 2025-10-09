import { describe, expect, it } from 'vitest';

import { mapProposalDiff } from './diff-mapper';

describe('mapProposalDiff', () => {
  it('retains segment identifiers on streamed diff segments', () => {
    const result = mapProposalDiff({
      proposalId: '6d62ef33-1e8f-4ac1-a2fd-4f2336bf7a10',
      sessionId: 'b02c7e6c-44d1-4c7b-97ff-0a5416ff9788',
      originTurnId: 'turn-1',
      promptId: 'prompt-improve-1',
      rationale: 'Ensure accessibility guidance accompanies the new content.',
      confidence: 0.82,
      citations: ['decision:telemetry'],
      baselineContent: 'Original paragraph describing current architecture state.',
      proposedContent:
        'Original paragraph describing current architecture state.\n\nAdded accessible guidance for co-authoring flows.',
      renderMode: 'unified',
      createdAt: new Date('2025-10-06T12:00:00Z'),
    });

    expect(result.diff.segments).not.toHaveLength(0);

    const added = result.diff.segments.find(segment => segment.type === 'added');
    expect(added).toBeDefined();
    expect(typeof added?.segmentId).toBe('string');
    expect(added?.segmentId).toMatch(/^turn-1::added::\d+$/);

    const annotation = result.annotations.find(item => item.segmentType === 'added');
    expect(annotation?.segmentId).toBe(added?.segmentId);
  });
});

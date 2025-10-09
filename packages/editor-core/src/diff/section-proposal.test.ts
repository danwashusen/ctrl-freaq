import { describe, expect, it } from 'vitest';

import { generateProposalDiff } from './section-proposal';

describe('generateProposalDiff', () => {
  const baseline = [
    '# System Overview',
    '',
    'CTRL FreaQ coordinates editors and assistant workflows.',
    '',
    '## Retention Policy',
    'Drafts stay client-side until authors approve assists.',
  ].join('\n');

  const proposal = [
    '# System Overview',
    '',
    'CTRL FreaQ coordinates editors and assistant workflows.',
    '',
    '## Retention Policy',
    'Drafts stay client-side until authors approve assists.',
    '',
    '### Observability Guarantees',
    '- Console telemetry announces proposal confidence.',
  ].join('\n');

  const prompt = {
    turnId: 'turn-improve-001',
    promptId: 'prompt-improve-observability',
    rationale: 'Add observability guarantees tied to console telemetry.',
    confidence: 0.76,
  };

  it('annotates diff segments with prompt metadata and confidence', () => {
    const result = generateProposalDiff({
      baselineContent: baseline,
      proposedContent: proposal,
      prompt,
      citations: ['decision:observability/logging'],
    });

    const addedSegment = result.diff.segments.find(segment => segment.type === 'added');
    expect(addedSegment).toBeDefined();

    const annotation = result.annotations.find(entry => entry.segmentType === 'added');
    expect(annotation).toBeDefined();
    expect(annotation?.segmentId).toMatch(/^turn-improve-001::added::\d+$/);
    expect(annotation).toMatchObject({
      originTurnId: prompt.turnId,
      promptId: prompt.promptId,
      rationale: expect.stringContaining('observability'),
      confidence: prompt.confidence,
      citations: ['decision:observability/logging'],
    });
  });

  it('creates one annotation per non-context diff segment', () => {
    const result = generateProposalDiff({
      baselineContent: baseline,
      proposedContent: proposal,
      prompt,
      citations: ['decision:observability/logging'],
    });

    const annotatedSegments = result.diff.segments.filter(
      segment => segment.type === 'added' || segment.type === 'removed'
    );

    expect(result.annotations).toHaveLength(annotatedSegments.length);

    const uniqueIds = new Set(result.annotations.map(entry => entry.segmentId));
    expect(uniqueIds.size).toBe(result.annotations.length);

    for (const annotation of result.annotations) {
      expect(['added', 'removed']).toContain(annotation.segmentType);
      expect(annotation.segmentId).toContain(annotation.segmentType);
    }
  });
});

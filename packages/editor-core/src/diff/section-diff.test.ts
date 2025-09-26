import { describe, expect, it } from 'vitest';
import { generateSectionDiff } from './section-diff';

describe('generateSectionDiff', () => {
  it('produces structured segments for modified content', () => {
    const original = ['Line 1', 'Line 2', 'Line 3'].join('\n');
    const modified = ['Line 1', 'Line 2 updated', 'Line 3', 'Line 4'].join('\n');

    const diff = generateSectionDiff(original, modified, {
      approvedVersion: 5,
      draftVersion: 6,
    });

    expect(diff.mode).toBe('unified');
    expect(diff.segments.length).toBeGreaterThan(0);

    const addedSegment = diff.segments.find(segment => segment.type === 'added');
    expect(addedSegment).toBeDefined();
    expect(addedSegment?.content).toContain('updated');
    expect(addedSegment?.startLine).toBeGreaterThan(0);

    const removedSegment = diff.segments.find(segment => segment.type === 'removed');
    expect(removedSegment).toBeDefined();

    const unchangedSegment = diff.segments.find(segment => segment.type === 'unchanged');
    expect(unchangedSegment?.metadata?.original?.startLine).toBe(1);

    expect(diff.metadata?.approvedVersion).toBe(5);
    expect(diff.metadata?.draftVersion).toBe(6);
    expect(diff.metadata?.generatedAt).toMatch(/T/);
  });

  it('merges consecutive segments of the same type', () => {
    const original = 'Alpha\nBeta\nGamma';
    const modified = 'Alpha\nBeta new\nGamma new';

    const diff = generateSectionDiff(original, modified);

    const addedSegments = diff.segments.filter(segment => segment.type === 'added');
    const combinedContent = addedSegments.map(segment => segment.content.trim()).join(' ');
    expect(addedSegments.length).toBeGreaterThan(0);
    expect(combinedContent.length).toBeGreaterThan(0);
  });
});

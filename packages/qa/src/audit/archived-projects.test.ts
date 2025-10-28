import { describe, expect, it } from 'vitest';

import {
  evaluateArchivedProjectCorrections,
  type ArchivedProjectAuditRecord,
} from './archived-projects';

const buildRecord = (
  overrides: Partial<ArchivedProjectAuditRecord> = {}
): ArchivedProjectAuditRecord => ({
  projectId: 'project-fixture',
  archivedAt: '2025-10-20T12:00:00.000Z',
  reviewedAt: '2025-10-22T15:30:00.000Z',
  correctionRequired: false,
  ...overrides,
});

describe('evaluateArchivedProjectCorrections', () => {
  it('returns pass state when no records are provided', () => {
    const result = evaluateArchivedProjectCorrections([]);

    expect(result).toEqual({
      sampleSize: 0,
      corrections: 0,
      correctionRate: 0,
      threshold: 0.05,
      withinThreshold: true,
      projectsNeedingReview: [],
      insufficientSample: true,
    });
  });

  it('marks sample as insufficient when below minimum size', () => {
    const records = Array.from({ length: 5 }, (_, index) =>
      buildRecord({ projectId: `project-small-${index}` })
    );

    const result = evaluateArchivedProjectCorrections(records, { minimumSampleSize: 10 });

    expect(result.sampleSize).toBe(5);
    expect(result.insufficientSample).toBe(true);
    expect(result.withinThreshold).toBe(true);
  });

  it('passes when correction rate is within the default threshold', () => {
    const records = Array.from({ length: 20 }, (_, index) =>
      buildRecord({ projectId: `project-${index}` })
    );
    records[3] = buildRecord({
      projectId: 'project-fixed',
      correctionRequired: true,
    });

    const result = evaluateArchivedProjectCorrections(records);

    expect(result.sampleSize).toBe(20);
    expect(result.corrections).toBe(1);
    expect(result.correctionRate).toBeCloseTo(0.05, 4);
    expect(result.withinThreshold).toBe(true);
    expect(result.projectsNeedingReview).toEqual(['project-fixed']);
  });

  it('fails when correction rate exceeds threshold', () => {
    const records = Array.from({ length: 20 }, (_, index) =>
      buildRecord({ projectId: `project-${index}` })
    );
    records[0] = buildRecord({ projectId: 'project-a', correctionRequired: true });
    records[5] = buildRecord({ projectId: 'project-b', correctionRequired: true });

    const result = evaluateArchivedProjectCorrections(records, { threshold: 0.05 });

    expect(result.corrections).toBe(2);
    expect(result.correctionRate).toBeCloseTo(0.1, 4);
    expect(result.withinThreshold).toBe(false);
    expect(result.projectsNeedingReview).toEqual(['project-a', 'project-b']);
  });
});

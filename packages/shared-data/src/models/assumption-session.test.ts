import { describe, expect, it } from 'vitest';

import { AssumptionSessionSchema } from './assumption-session.js';

const baseSession = {
  id: 'sess-1',
  sectionId: 'sec-1',
  documentId: 'doc-1',
  startedBy: 'user-1',
  startedAt: new Date('2025-09-29T05:00:00.000Z'),
  status: 'in_progress' as const,
  templateVersion: '1.0.0',
  documentDecisionSnapshotId: 'snapshot-1',
  unresolvedOverrideCount: 0,
  answeredCount: 0,
  deferredCount: 0,
  escalatedCount: 0,
  overrideCount: 0,
  latestProposalId: null,
  summaryMarkdown: null,
  closedAt: null,
  closedBy: null,
  createdAt: new Date('2025-09-29T05:00:00.000Z'),
  createdBy: 'user-1',
  updatedAt: new Date('2025-09-29T05:00:00.000Z'),
  updatedBy: 'user-1',
  deletedAt: null,
  deletedBy: null,
};

describe('AssumptionSessionSchema', () => {
  it('accepts valid session data', () => {
    const parsed = AssumptionSessionSchema.parse(baseSession);
    expect(parsed.status).toBe('in_progress');
    expect(parsed.templateVersion).toBe('1.0.0');
  });

  it('requires unresolvedOverrideCount to be non-negative', () => {
    expect(() =>
      AssumptionSessionSchema.parse({
        ...baseSession,
        unresolvedOverrideCount: -1,
      })
    ).toThrow();
  });

  it('requires status to be a valid lifecycle state', () => {
    expect(() =>
      AssumptionSessionSchema.parse({
        ...baseSession,
        status: 'archived',
      })
    ).toThrow();
  });
});

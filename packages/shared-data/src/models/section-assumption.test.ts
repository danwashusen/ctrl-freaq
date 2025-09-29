import { describe, expect, it } from 'vitest';

import { SectionAssumptionSchema, AssumptionOptionSchema } from './section-assumption.js';

const baseAssumption = {
  id: 'assume-1',
  sessionId: 'sess-1',
  sectionId: 'sec-1',
  documentId: 'doc-1',
  templateKey: 'capacity-plan',
  promptHeading: 'Capacity planning baseline',
  promptBody: 'Confirm streaming throughput requirements.',
  responseType: 'single_select' as const,
  options: [
    {
      id: 'opt-1',
      label: 'Use managed streaming',
      description: null,
      defaultSelected: true,
    },
  ],
  priority: 1,
  status: 'pending' as const,
  answerValue: null,
  answerNotes: null,
  overrideJustification: null,
  conflictDecisionId: null,
  conflictResolvedAt: null,
  createdAt: new Date('2025-09-29T05:00:00.000Z'),
  createdBy: 'user-author',
  updatedAt: new Date('2025-09-29T05:00:00.000Z'),
  updatedBy: 'user-author',
  deletedAt: null,
  deletedBy: null,
};

describe('SectionAssumptionSchema', () => {
  it('validates a complete assumption record', () => {
    const parsed = SectionAssumptionSchema.parse(baseAssumption);
    expect(parsed).toMatchObject({
      id: 'assume-1',
      status: 'pending',
      options: expect.arrayContaining([expect.objectContaining({ id: 'opt-1' })]),
    });
  });

  it('rejects assumption with unsupported status', () => {
    expect(() =>
      SectionAssumptionSchema.parse({
        ...baseAssumption,
        status: 'unknown',
      })
    ).toThrowError(/Invalid enum value/);
  });

  it('requires options to conform to AssumptionOption schema', () => {
    expect(() =>
      AssumptionOptionSchema.parse({
        id: '',
        label: '',
        description: null,
        defaultSelected: false,
      })
    ).toThrow();
  });

  it('serialises answerValue arrays as expected type', () => {
    const parsed = SectionAssumptionSchema.parse({
      ...baseAssumption,
      responseType: 'multi_select' as const,
      answerValue: ['option-a', 'option-b'],
    });

    expect(parsed.answerValue).toEqual(['option-a', 'option-b']);
  });
});

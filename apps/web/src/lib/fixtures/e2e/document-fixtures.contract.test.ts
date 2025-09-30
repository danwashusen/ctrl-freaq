import { describe, expect, it } from 'vitest';
import { z } from 'zod';

// Fixture helpers intentionally imported even though implementations do not exist yet.
// Contract ensures future helpers align with deterministic schema requirements.
import { getDocumentFixture, getSectionFixture } from './index';

const transcriptMessageSchema = z.object({
  speaker: z.enum(['user', 'assistant', 'system']),
  content: z.string().min(1),
  timestamp: z.string().min(1),
});

const assumptionQuestionSchema = z.object({
  id: z.string().min(1),
  prompt: z.string().min(1),
  decision: z.string().min(1),
  status: z.enum(['open', 'resolved']),
});

const assumptionSessionSchema = z.object({
  sessionId: z.string().min(1),
  policy: z.enum(['conservative', 'balanced', 'yolo']),
  questions: z.array(assumptionQuestionSchema).min(1),
  unresolvedCount: z.number().int().nonnegative(),
  transcript: z.array(transcriptMessageSchema).min(1),
});

const sectionFixtureSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  content: z.string().min(1),
  editable: z.boolean(),
  lifecycleState: z.enum(['idle', 'assumptions', 'drafting', 'review', 'ready']),
  assumptionSession: assumptionSessionSchema.nullable(),
  lastAuthoredBy: z.string().min(1),
  lastUpdatedAt: z.string().min(1),
});

const sectionReferenceSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  state: z.enum(['idle', 'assumptions', 'drafting', 'review', 'ready']),
  hasConflicts: z.boolean().optional(),
});

const documentFixtureSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  summary: z.string().min(1),
  tableOfContents: z.array(sectionReferenceSchema).min(1),
  updatedAt: z.string().min(1),
  lifecycleStatus: z.enum(['draft', 'review', 'ready']),
  sections: z.record(z.string(), sectionFixtureSchema),
  retentionPolicy: z
    .object({
      policyId: z.string().min(1),
      retentionWindow: z.string().min(1),
      guidance: z.string().min(1),
    })
    .optional(),
});

describe('document fixture helpers contract', () => {
  it('returns deterministic document fixture matching contract', () => {
    const result = getDocumentFixture('demo-architecture');
    const parsed = documentFixtureSchema.safeParse(result);

    expect(parsed.success).toBe(true);
  });

  it('returns deterministic section fixture with transcript coverage', () => {
    const result = getSectionFixture('demo-architecture', 'sec-api');
    const parsed = sectionFixtureSchema.safeParse(result);

    expect(parsed.success).toBe(true);
    expect(result.assumptionSession?.transcript.length ?? 0).toBeGreaterThan(0);
  });

  it('throws when requesting unknown fixture identifiers', () => {
    expect(() => getDocumentFixture('missing-doc')).toThrowError();
    expect(() => getSectionFixture('demo-architecture', 'missing-section')).toThrowError();
  });
});

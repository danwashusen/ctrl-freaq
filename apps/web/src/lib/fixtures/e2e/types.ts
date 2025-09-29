import { z } from 'zod';

export const documentLifecycleStatuses = ['draft', 'review', 'ready'] as const;
export type DocumentLifecycleStatus = (typeof documentLifecycleStatuses)[number];

export const sectionLifecycleStates = [
  'idle',
  'assumptions',
  'drafting',
  'review',
  'ready',
] as const;
export type SectionLifecycleState = (typeof sectionLifecycleStates)[number];

export const draftConflictStates = ['clean', 'rebase_required', 'rebased', 'blocked'] as const;
export type DraftConflictState = (typeof draftConflictStates)[number];

export const transcriptSpeakers = ['user', 'assistant', 'system'] as const;
export type TranscriptSpeaker = (typeof transcriptSpeakers)[number];

export const assumptionPolicies = ['conservative', 'balanced', 'yolo'] as const;
export type AssumptionPolicy = (typeof assumptionPolicies)[number];

export const transcriptMessageSchema = z.object({
  speaker: z.enum(transcriptSpeakers),
  content: z.string().min(1),
  timestamp: z.string().min(1),
});
export type TranscriptMessage = z.infer<typeof transcriptMessageSchema>;

export const assumptionQuestionSchema = z.object({
  id: z.string().min(1),
  prompt: z.string().min(1),
  decision: z.string().min(1),
  status: z.enum(['open', 'resolved']),
});
export type AssumptionQuestion = z.infer<typeof assumptionQuestionSchema>;

export const assumptionSessionSchema = z.object({
  sessionId: z.string().min(1),
  policy: z.enum(assumptionPolicies),
  questions: z.array(assumptionQuestionSchema).min(1),
  unresolvedCount: z.number().int().nonnegative(),
  transcript: z.array(transcriptMessageSchema).min(1),
  proposals: z
    .array(
      z.object({
        proposalId: z.string().min(1),
        proposalIndex: z.number().int().nonnegative(),
        source: z.enum(['ai_generated', 'manual_revision', 'ai_retry', 'fallback_manual']),
        recordedAt: z.string().min(1),
      })
    )
    .default([]),
});
export type AssumptionSessionFixture = z.infer<typeof assumptionSessionSchema>;

export const formattingWarningSchema = z.object({
  id: z.string().min(1),
  message: z.string().min(1),
  severity: z.enum(['warning', 'error']),
  startOffset: z.number().int().nonnegative().optional(),
  endOffset: z.number().int().nonnegative().optional(),
  markType: z.string().min(1).optional(),
});
export type FormattingWarningFixture = z.infer<typeof formattingWarningSchema>;

const diffSegmentFixtureSchema = z.object({
  type: z.enum(['added', 'removed', 'unchanged', 'context']),
  content: z.string().min(1),
  startLine: z.number().int().nonnegative().optional(),
  endLine: z.number().int().nonnegative().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const diffFixtureSchema = z.object({
  mode: z.enum(['unified', 'split']),
  segments: diffSegmentFixtureSchema.array().min(1),
  metadata: z
    .object({
      approvedVersion: z.number().int().nonnegative().optional(),
      draftVersion: z.number().int().nonnegative().optional(),
      generatedAt: z.string().optional(),
    })
    .partial()
    .optional(),
});
export type DiffFixture = z.infer<typeof diffFixtureSchema>;

export const conflictLogEntryFixtureSchema = z.object({
  detectedAt: z.string().datetime(),
  detectedDuring: z.enum(['entry', 'save']),
  previousApprovedVersion: z.number().int().nonnegative(),
  latestApprovedVersion: z.number().int().nonnegative(),
  resolvedBy: z.enum(['auto_rebase', 'manual_reapply', 'abandoned']).nullable(),
  resolutionNote: z
    .string()
    .nullish()
    .transform(value => value ?? null),
});
export type ConflictLogEntryFixture = z.infer<typeof conflictLogEntryFixtureSchema>;

export const rebasedDraftFixtureSchema = z.object({
  draftVersion: z.number().int().nonnegative(),
  contentMarkdown: z.string(),
  formattingAnnotations: formattingWarningSchema.array().default([]),
});

export const conflictCheckFixtureSchema = z.object({
  status: z.enum(draftConflictStates),
  latestApprovedVersion: z.number().int().nonnegative(),
  rebasedDraft: rebasedDraftFixtureSchema.optional(),
  conflictReason: z
    .string()
    .nullish()
    .transform(value => value ?? null),
  events: conflictLogEntryFixtureSchema.array().default([]),
});
export type ConflictCheckFixture = z.infer<typeof conflictCheckFixtureSchema>;

export const draftMetadataFixtureSchema = z.object({
  draftId: z.string().min(1),
  draftVersion: z.number().int().nonnegative(),
  draftBaseVersion: z.number().int().nonnegative(),
  latestApprovedVersion: z.number().int().nonnegative().optional(),
  conflictState: z.enum(draftConflictStates).default('clean'),
  conflictReason: z
    .string()
    .nullish()
    .transform(value => value ?? null),
  summaryNote: z
    .string()
    .nullish()
    .transform(value => value ?? null),
  lastSavedAt: z
    .string()
    .nullish()
    .transform(value => value ?? null),
  lastSavedBy: z
    .string()
    .nullish()
    .transform(value => value ?? null),
  lastManualSaveAt: z
    .number()
    .int()
    .nonnegative()
    .nullish()
    .transform(value => (typeof value === 'number' ? value : null)),
  formattingWarnings: formattingWarningSchema.array().default([]),
  conflictLog: conflictLogEntryFixtureSchema.array().optional(),
  conflictSnapshot: conflictCheckFixtureSchema.optional(),
});
export type DraftMetadataFixture = z.infer<typeof draftMetadataFixtureSchema>;

export const reviewSubmissionFixtureSchema = z.object({
  reviewId: z.string().min(1),
  status: z.enum(['pending', 'approved', 'changes_requested']),
  submittedAt: z.string().datetime(),
  submittedBy: z.string().min(1),
  summaryNote: z
    .string()
    .nullish()
    .transform(value => value ?? null),
});
export type ReviewSubmissionFixture = z.infer<typeof reviewSubmissionFixtureSchema>;

export const approvalFixtureSchema = z.object({
  approvedVersion: z.number().int().positive(),
  approvedAt: z.string().datetime(),
  approvedBy: z.string().min(1),
  approvedContent: z.string().min(1),
  reviewerSummary: z
    .string()
    .nullish()
    .transform(value => value ?? null),
});
export type ApprovalFixture = z.infer<typeof approvalFixtureSchema>;

export const sectionFixtureSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  content: z.string().min(1),
  editable: z.boolean(),
  lifecycleState: z.enum(sectionLifecycleStates),
  assumptionSession: assumptionSessionSchema.nullable(),
  lastAuthoredBy: z.string().min(1),
  lastUpdatedAt: z.string().min(1),
  draft: draftMetadataFixtureSchema.optional(),
  diff: diffFixtureSchema.optional(),
  review: reviewSubmissionFixtureSchema.optional(),
  approval: approvalFixtureSchema.optional(),
});
export type SectionFixture = z.infer<typeof sectionFixtureSchema>;

export const sectionReferenceSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  state: z.enum(sectionLifecycleStates),
  hasConflicts: z.boolean().default(false),
});
export type SectionReference = z.infer<typeof sectionReferenceSchema>;

export const documentFixtureSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  summary: z.string().min(1),
  tableOfContents: z.array(sectionReferenceSchema).min(1),
  updatedAt: z.string().min(1),
  lifecycleStatus: z.enum(documentLifecycleStatuses),
  sections: z.record(sectionFixtureSchema),
});
export type DocumentFixture = z.infer<typeof documentFixtureSchema>;

export const fixtureErrorSchema = z.object({
  code: z.string().min(1),
  message: z.string().min(1),
});
export type FixtureErrorResponse = z.infer<typeof fixtureErrorSchema>;

export const fixtureCollectionSchema = z.object({
  documents: z.record(documentFixtureSchema),
});
export type FixtureCollection = z.infer<typeof fixtureCollectionSchema>;

export function assertDocumentFixture(value: unknown): DocumentFixture {
  return documentFixtureSchema.parse(value);
}

export function assertSectionFixture(value: unknown): SectionFixture {
  return sectionFixtureSchema.parse(value);
}

export function isDocumentFixture(value: unknown): value is DocumentFixture {
  return documentFixtureSchema.safeParse(value).success;
}

export function isSectionFixture(value: unknown): value is SectionFixture {
  return sectionFixtureSchema.safeParse(value).success;
}

import { z } from 'zod';

const nonEmptyString = z.string().min(1);

export const ConflictTriggerSchema = z.enum(['entry', 'save']);
export type ConflictTrigger = z.infer<typeof ConflictTriggerSchema>;

export const ConflictStatusSchema = z.enum(['clean', 'rebase_required', 'blocked']);
export type ConflictStatus = z.infer<typeof ConflictStatusSchema>;

export const ConflictResolutionSchema = z.enum(['auto_rebase', 'manual_reapply', 'abandoned']);
export type ConflictResolution = z.infer<typeof ConflictResolutionSchema>;

export const ConflictCheckRequestSchema = z.object({
  draftBaseVersion: z.number().int().min(0, 'draftBaseVersion must be non-negative'),
  draftVersion: z.number().int().min(0, 'draftVersion must be non-negative'),
  approvedVersion: z.number().int().min(0, 'approvedVersion must be non-negative').optional(),
  requestId: nonEmptyString.describe('Trace id propagated from client').optional(),
  triggeredBy: ConflictTriggerSchema.optional(),
});
export type ConflictCheckRequest = z.infer<typeof ConflictCheckRequestSchema>;

const SectionDiffModeSchema = z.enum(['unified', 'split']);
export type SectionDiffMode = z.infer<typeof SectionDiffModeSchema>;

export const SectionDiffSegmentTypeSchema = z.enum(['added', 'removed', 'unchanged', 'context']);
export type SectionDiffSegmentType = z.infer<typeof SectionDiffSegmentTypeSchema>;

const LooseMetadataSchema = z.record(z.string(), z.unknown());

export const SectionDiffSegmentSchema = z
  .object({
    type: SectionDiffSegmentTypeSchema,
    content: z.string(),
    startLine: z.number().int().min(0).optional(),
    endLine: z.number().int().min(0).optional(),
    metadata: LooseMetadataSchema.optional(),
  })
  .refine(
    segment =>
      segment.startLine === undefined ||
      segment.endLine === undefined ||
      segment.endLine >= segment.startLine,
    {
      message: 'endLine cannot be before startLine',
      path: ['endLine'],
    }
  );
export type SectionDiffSegment = z.infer<typeof SectionDiffSegmentSchema>;

export const SectionDiffMetadataSchema = z
  .object({
    approvedVersion: z.number().int().min(0).optional(),
    draftVersion: z.number().int().min(0).optional(),
    generatedAt: z.string().datetime().optional(),
  })
  .catchall(z.unknown());
export type SectionDiffMetadata = z.infer<typeof SectionDiffMetadataSchema>;

export const DiffResponseSchema = z.object({
  mode: SectionDiffModeSchema,
  segments: z.array(SectionDiffSegmentSchema),
  metadata: SectionDiffMetadataSchema.optional(),
});
export type DiffResponse = z.infer<typeof DiffResponseSchema>;

export const FormattingAnnotationSchema = z
  .object({
    id: z.string(),
    startOffset: z.number().int().min(0),
    endOffset: z.number().int().min(0),
    markType: nonEmptyString,
    message: nonEmptyString,
    severity: z.enum(['warning', 'error']),
  })
  .superRefine((annotation, ctx) => {
    if (annotation.endOffset <= annotation.startOffset) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'endOffset must be greater than startOffset',
        path: ['endOffset'],
      });
    }
  });
export type FormattingAnnotation = z.infer<typeof FormattingAnnotationSchema>;

export const ConflictLogEntrySchema = z.object({
  detectedAt: z.string().datetime(),
  detectedDuring: ConflictTriggerSchema,
  previousApprovedVersion: z.number().int().min(0),
  latestApprovedVersion: z.number().int().min(0),
  resolvedBy: ConflictResolutionSchema.nullable().optional(),
  resolutionNote: z.string().nullable().optional(),
});
export type ConflictLogEntry = z.infer<typeof ConflictLogEntrySchema>;

export const RebasedDraftPayloadSchema = z.object({
  draftVersion: z.number().int().min(0),
  contentMarkdown: z.string(),
  formattingAnnotations: z.array(FormattingAnnotationSchema).default([]),
});
export type RebasedDraftPayload = z.infer<typeof RebasedDraftPayloadSchema>;

export const ConflictCheckResponseSchema = z.object({
  status: ConflictStatusSchema,
  latestApprovedVersion: z.number().int().min(0),
  rebasedDraft: RebasedDraftPayloadSchema.optional(),
  conflictReason: z.string().nullable().optional(),
  events: z.array(ConflictLogEntrySchema).optional(),
});
export type ConflictCheckResponse = z.infer<typeof ConflictCheckResponseSchema>;

export const SaveDraftRequestSchema = z.object({
  contentMarkdown: z.string().max(80000),
  draftVersion: z.number().int().min(0),
  draftBaseVersion: z.number().int().min(0),
  summaryNote: z.string().max(500).optional(),
  formattingAnnotations: z.array(FormattingAnnotationSchema).optional(),
  clientTimestamp: z.string().datetime().optional(),
});
export type SaveDraftRequest = z.infer<typeof SaveDraftRequestSchema>;

export const ConflictStateSchema = z.enum(['clean', 'rebase_required', 'rebased', 'blocked']);
export type ConflictState = z.infer<typeof ConflictStateSchema>;

export const SectionDraftResponseSchema = z.object({
  draftId: z.string().min(1),
  sectionId: z.string().min(1),
  draftVersion: z.number().int().min(0),
  conflictState: ConflictStateSchema,
  formattingAnnotations: z.array(FormattingAnnotationSchema),
  savedAt: z.string().datetime(),
  savedBy: z.string().min(1),
  summaryNote: z.string().optional(),
});
export type SectionDraftResponse = z.infer<typeof SectionDraftResponseSchema>;

export const SubmitDraftRequestSchema = z.object({
  draftId: z.string().min(1),
  summaryNote: z.string().max(500),
  reviewers: z.array(z.string().min(1)).optional(),
});
export type SubmitDraftRequest = z.infer<typeof SubmitDraftRequestSchema>;

export const ReviewStatusSchema = z.enum(['pending', 'approved', 'changes_requested']);
export type ReviewStatus = z.infer<typeof ReviewStatusSchema>;

export const ReviewSubmissionResponseSchema = z.object({
  reviewId: z.string().min(1),
  sectionId: z.string().min(1),
  status: ReviewStatusSchema,
  submittedAt: z.string().datetime(),
  submittedBy: z.string().min(1),
  summaryNote: z.string().optional(),
});
export type ReviewSubmissionResponse = z.infer<typeof ReviewSubmissionResponseSchema>;

export const ApproveSectionRequestSchema = z.object({
  draftId: z.string().min(1),
  approvalNote: z.string().max(1000).optional(),
});
export type ApproveSectionRequest = z.infer<typeof ApproveSectionRequestSchema>;

export const ApprovalResponseSchema = z.object({
  sectionId: z.string().min(1),
  approvedVersion: z.number().int().min(1),
  approvedContent: z.string(),
  approvedAt: z.string().datetime(),
  approvedBy: z.string().min(1),
  requestId: z.string(),
});
export type ApprovalResponse = z.infer<typeof ApprovalResponseSchema>;

export const ConflictLogResponseSchema = z.object({
  sectionId: z.string().min(1),
  draftId: z.string().min(1),
  events: z.array(ConflictLogEntrySchema),
});
export type ConflictLogResponse = z.infer<typeof ConflictLogResponseSchema>;

export const SectionEditorSchemas = {
  ConflictCheckRequestSchema,
  ConflictCheckResponseSchema,
  SaveDraftRequestSchema,
  SectionDraftResponseSchema,
  DiffResponseSchema,
  SubmitDraftRequestSchema,
  ReviewSubmissionResponseSchema,
  FormattingAnnotationSchema,
  ConflictLogEntrySchema,
  RebasedDraftPayloadSchema,
  ApproveSectionRequestSchema,
  ApprovalResponseSchema,
  ConflictLogResponseSchema,
};

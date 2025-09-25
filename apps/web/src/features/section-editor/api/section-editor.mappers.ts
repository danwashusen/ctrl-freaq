import { z } from 'zod';

const formattingAnnotationSchema = z.object({
  id: z.string().min(1),
  startOffset: z.number().int().nonnegative(),
  endOffset: z.number().int().nonnegative(),
  markType: z.string().min(1),
  message: z.string().min(1),
  severity: z.enum(['warning', 'error']),
});

const conflictLogEntrySchema = z.object({
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

const rebasedDraftSchema = z.object({
  draftVersion: z.number().int().nonnegative(),
  contentMarkdown: z.string(),
  formattingAnnotations: formattingAnnotationSchema.array().default([]),
});

const conflictCheckResponseSchema = z.object({
  status: z.enum(['clean', 'rebase_required', 'blocked']),
  latestApprovedVersion: z.number().int().nonnegative(),
  rebasedDraft: rebasedDraftSchema.optional(),
  conflictReason: z
    .string()
    .nullish()
    .transform(value => value ?? null),
  events: conflictLogEntrySchema.array().default([]),
});

const sectionDraftResponseSchema = z.object({
  draftId: z.string().min(1),
  sectionId: z.string().min(1),
  draftVersion: z.number().int().nonnegative(),
  conflictState: z.enum(['clean', 'rebase_required', 'rebased', 'blocked']),
  formattingAnnotations: formattingAnnotationSchema.array().default([]),
  savedAt: z.string().datetime(),
  savedBy: z.string().min(1),
  summaryNote: z
    .string()
    .nullish()
    .transform(value => value ?? null),
});

const diffSegmentSchema = z.object({
  type: z.enum(['added', 'removed', 'unchanged', 'context']),
  content: z.string(),
  startLine: z.number().int().nonnegative().optional(),
  endLine: z.number().int().nonnegative().optional(),
  metadata: z.record(z.unknown()).optional(),
});

const diffMetadataSchema = z
  .object({
    approvedVersion: z.number().int().nonnegative().optional(),
    draftVersion: z.number().int().nonnegative().optional(),
    generatedAt: z.string().datetime().optional(),
  })
  .partial()
  .optional()
  .transform(value => (value ? value : undefined));

const diffResponseSchema = z.object({
  mode: z.enum(['unified', 'split']),
  segments: diffSegmentSchema.array().min(1),
  metadata: diffMetadataSchema,
});

const reviewSubmissionResponseSchema = z.object({
  reviewId: z.string().min(1),
  sectionId: z.string().min(1),
  status: z.enum(['pending', 'approved', 'changes_requested']),
  submittedAt: z.string().datetime(),
  submittedBy: z.string().min(1),
  summaryNote: z
    .string()
    .nullish()
    .transform(value => value ?? null),
});

const conflictLogListResponseSchema = z.object({
  events: conflictLogEntrySchema.array().default([]),
});

const approvalResponseSchema = z.object({
  sectionId: z.string().min(1),
  approvedVersion: z.number().int().positive(),
  approvedContent: z.string(),
  approvedAt: z.string().datetime(),
  approvedBy: z.string().min(1),
  requestId: z.string().min(1),
});

export type FormattingAnnotationDTO = z.infer<typeof formattingAnnotationSchema>;
export type ConflictLogEntryDTO = z.infer<typeof conflictLogEntrySchema>;
export type RebasedDraftDTO = z.infer<typeof rebasedDraftSchema>;
export type ConflictCheckResponseDTO = z.infer<typeof conflictCheckResponseSchema>;
export type SectionDraftResponseDTO = z.infer<typeof sectionDraftResponseSchema>;
export type DiffSegmentDTO = z.infer<typeof diffSegmentSchema>;
export type DiffResponseDTO = z.infer<typeof diffResponseSchema>;
export type ReviewSubmissionResponseDTO = z.infer<typeof reviewSubmissionResponseSchema>;
export type ConflictLogListResponseDTO = z.infer<typeof conflictLogListResponseSchema>;
export type ApprovalResponseDTO = z.infer<typeof approvalResponseSchema>;

export const parseConflictCheckResponse = (payload: unknown): ConflictCheckResponseDTO =>
  conflictCheckResponseSchema.parse(payload);

export const parseSectionDraftResponse = (payload: unknown): SectionDraftResponseDTO =>
  sectionDraftResponseSchema.parse(payload);

export const parseSectionDiffResponse = (payload: unknown): DiffResponseDTO =>
  diffResponseSchema.parse(payload);

export const parseReviewSubmissionResponse = (payload: unknown): ReviewSubmissionResponseDTO =>
  reviewSubmissionResponseSchema.parse(payload);

export const parseConflictLogListResponse = (payload: unknown): ConflictLogListResponseDTO =>
  conflictLogListResponseSchema.parse(payload);

export const parseApprovalResponse = (payload: unknown): ApprovalResponseDTO =>
  approvalResponseSchema.parse(payload);

export const schemas = {
  formattingAnnotationSchema,
  conflictLogEntrySchema,
  rebasedDraftSchema,
  conflictCheckResponseSchema,
  sectionDraftResponseSchema,
  diffSegmentSchema,
  diffResponseSchema,
  reviewSubmissionResponseSchema,
  conflictLogListResponseSchema,
  approvalResponseSchema,
};

import { z, type ZodErrorMap } from 'zod';

export const SECTION_REVIEW_STATUSES = ['pending', 'approved', 'changes_requested'] as const;
export type SectionReviewStatus = (typeof SECTION_REVIEW_STATUSES)[number];

const reviewStatusErrorMap: ZodErrorMap = issue => {
  if (issue.code === 'invalid_type') {
    return { message: 'reviewStatus is required' };
  }
  if (issue.code === 'invalid_value') {
    return { message: 'Invalid reviewStatus value' };
  }
  return issue.message ?? undefined;
};

const SectionReviewSummaryObjectSchema = z.object({
  id: z.string().min(1, 'Section review summary id must be provided'),
  sectionId: z.string().min(1, 'sectionId must be provided'),
  documentId: z.string().min(1, 'documentId must be provided'),
  draftId: z.string().min(1, 'draftId must be provided'),
  reviewerId: z.string().min(1, 'reviewerId must be provided'),
  reviewStatus: z.enum(SECTION_REVIEW_STATUSES, {
    error: reviewStatusErrorMap,
  }),
  reviewerNote: z.string().min(1, 'reviewerNote is required').max(2000, 'reviewerNote too long'),
  submittedAt: z.date(),
  decidedAt: z.date().nullable(),
  createdAt: z.date(),
  createdBy: z.string().min(1, 'createdBy must be provided'),
  updatedAt: z.date(),
  updatedBy: z.string().min(1, 'updatedBy must be provided'),
  deletedAt: z.date().nullable().optional(),
  deletedBy: z.string().min(1).nullable().optional(),
});

const withDecisionValidation = <Schema extends z.ZodTypeAny>(schema: Schema) =>
  schema.superRefine((summary, ctx) => {
    const candidate = summary as { submittedAt?: Date; decidedAt?: Date | null };
    if (
      candidate.decidedAt &&
      candidate.submittedAt &&
      candidate.decidedAt < candidate.submittedAt
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['decidedAt'],
        message: 'decidedAt cannot be earlier than submittedAt',
      });
    }
  });

export const SectionReviewSummarySchema = withDecisionValidation(SectionReviewSummaryObjectSchema);

export type SectionReviewSummary = z.infer<typeof SectionReviewSummarySchema>;

export const CreateSectionReviewSummarySchema = withDecisionValidation(
  SectionReviewSummaryObjectSchema.omit({
    id: true,
    createdAt: true,
    createdBy: true,
    updatedAt: true,
    updatedBy: true,
    deletedAt: true,
    deletedBy: true,
  })
);

export type CreateSectionReviewSummaryInput = z.infer<typeof CreateSectionReviewSummarySchema>;

export const UpdateSectionReviewSummarySchema = withDecisionValidation(
  SectionReviewSummaryObjectSchema.partial().extend({
    id: z.string().min(1, 'Section review summary id must be provided'),
  })
);

export type UpdateSectionReviewSummaryInput = z.infer<typeof UpdateSectionReviewSummarySchema>;

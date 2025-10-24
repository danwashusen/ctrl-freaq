import { z, type ZodErrorMap } from 'zod';

import { FormattingAnnotationSchema } from './formatting-annotation.js';

export const SECTION_DRAFT_CONFLICT_STATES = [
  'clean',
  'rebase_required',
  'rebased',
  'blocked',
] as const;
export type SectionDraftConflictState = (typeof SECTION_DRAFT_CONFLICT_STATES)[number];

const conflictStateError: ZodErrorMap = issue => {
  if (issue.code === 'invalid_type') {
    return { message: 'conflictState is required' };
  }
  if (issue.code === 'invalid_value') {
    return { message: 'Invalid conflictState value' };
  }
  return issue.message;
};

export const SectionDraftSchema = z.object({
  id: z.string().min(1, 'Section draft id must be provided'),
  sectionId: z.string().min(1, 'sectionId must be provided'),
  documentId: z.string().min(1, 'documentId must be provided'),
  userId: z.string().min(1, 'userId must be provided'),
  draftVersion: z.number().int().min(1, 'draftVersion must be at least 1'),
  draftBaseVersion: z.number().int().min(0, 'draftBaseVersion must be non-negative'),
  contentMarkdown: z.string().max(80_000, 'contentMarkdown exceeds limit'),
  formattingAnnotations: z.array(FormattingAnnotationSchema),
  summaryNote: z.string().max(500, 'summaryNote must be 500 characters or fewer'),
  conflictState: z.enum(
    SECTION_DRAFT_CONFLICT_STATES as unknown as [
      SectionDraftConflictState,
      ...SectionDraftConflictState[],
    ],
    {
      error: conflictStateError,
    }
  ),
  conflictReason: z.string().max(500, 'conflictReason too long').nullable(),
  rebasedAt: z.date().nullable(),
  savedAt: z.date(),
  savedBy: z.string().min(1, 'savedBy must be provided'),
  createdAt: z.date(),
  createdBy: z.string().min(1, 'createdBy must be provided'),
  updatedAt: z.date(),
  updatedBy: z.string().min(1, 'updatedBy must be provided'),
  deletedAt: z.date().nullable().optional(),
  deletedBy: z.string().min(1).nullable().optional(),
});

export type SectionDraft = z.infer<typeof SectionDraftSchema>;

export const CreateSectionDraftSchema = SectionDraftSchema.omit({
  id: true,
  formattingAnnotations: true,
  summaryNote: true,
  conflictState: true,
  conflictReason: true,
  rebasedAt: true,
  savedAt: true,
  savedBy: true,
  createdAt: true,
  createdBy: true,
  updatedAt: true,
  updatedBy: true,
  deletedAt: true,
  deletedBy: true,
}).extend({
  summaryNote: z.string().max(500).optional(),
});

export type CreateSectionDraftInput = z.infer<typeof CreateSectionDraftSchema>;

export const UpdateSectionDraftSchema = SectionDraftSchema.partial().extend({
  id: z.string().uuid('Section draft id must be a valid UUID'),
});

export type UpdateSectionDraftInput = z.infer<typeof UpdateSectionDraftSchema>;

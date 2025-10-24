import { z, type ZodErrorMap } from 'zod';

export const FORMATTING_ANNOTATION_SEVERITIES = ['warning', 'error'] as const;
export type FormattingAnnotationSeverity = (typeof FORMATTING_ANNOTATION_SEVERITIES)[number];

const createEnumError = (requiredMessage: string, invalidMessage: string): ZodErrorMap => {
  return issue => {
    if (issue.code === 'invalid_type') {
      return { message: requiredMessage };
    }
    if (issue.code === 'invalid_value') {
      return { message: invalidMessage };
    }
    return issue.message;
  };
};

const FormattingAnnotationObjectSchema = z.object({
  id: z.string().uuid('Formatting annotation id must be a valid UUID'),
  sectionId: z.string().uuid('sectionId must be a valid UUID'),
  draftId: z.string().uuid('draftId must be a valid UUID'),
  startOffset: z.number().int().min(0, 'startOffset must be non-negative'),
  endOffset: z.number().int().min(1, 'endOffset must be at least 1'),
  markType: z.string().min(1, 'markType is required').max(100, 'markType too long'),
  message: z.string().min(1, 'message is required').max(500, 'message too long'),
  severity: z.enum(
    FORMATTING_ANNOTATION_SEVERITIES as unknown as [
      FormattingAnnotationSeverity,
      ...FormattingAnnotationSeverity[],
    ],
    {
      error: createEnumError('severity is required', 'Invalid severity value'),
    }
  ),
  createdAt: z.date(),
  createdBy: z.string().uuid('createdBy must be a valid UUID'),
  updatedAt: z.date(),
  updatedBy: z.string().uuid('updatedBy must be a valid UUID'),
  deletedAt: z.date().nullable().optional(),
  deletedBy: z.string().uuid('deletedBy must be a valid UUID').nullable().optional(),
});

const withOffsetValidation = <Schema extends z.ZodTypeAny>(schema: Schema) =>
  schema.superRefine((annotation, ctx) => {
    const candidate = annotation as { startOffset?: number; endOffset?: number };
    const { startOffset, endOffset } = candidate;
    if (
      typeof startOffset === 'number' &&
      typeof endOffset === 'number' &&
      endOffset <= startOffset
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['endOffset'],
        message: 'endOffset must be greater than startOffset',
      });
    }
  });

export const FormattingAnnotationSchema = withOffsetValidation(FormattingAnnotationObjectSchema);

export type FormattingAnnotation = z.infer<typeof FormattingAnnotationSchema>;

export const CreateFormattingAnnotationSchema = withOffsetValidation(
  FormattingAnnotationObjectSchema.omit({
    id: true,
    createdAt: true,
    updatedAt: true,
    deletedAt: true,
    deletedBy: true,
  })
);

export type CreateFormattingAnnotationInput = z.infer<typeof CreateFormattingAnnotationSchema>;

export const UpdateFormattingAnnotationSchema = withOffsetValidation(
  FormattingAnnotationObjectSchema.partial().extend({
    id: z.string().uuid('Formatting annotation id must be a valid UUID'),
  })
);

export type UpdateFormattingAnnotationInput = z.infer<typeof UpdateFormattingAnnotationSchema>;

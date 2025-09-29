import { z, type ZodErrorMap } from 'zod';

export const DRAFT_CONFLICT_DETECTION_POINTS = ['entry', 'save'] as const;
export type DraftConflictDetectionPoint = (typeof DRAFT_CONFLICT_DETECTION_POINTS)[number];

export const DRAFT_CONFLICT_RESOLUTION_METHODS = [
  'auto_rebase',
  'manual_reapply',
  'abandoned',
] as const;
export type DraftConflictResolutionMethod = (typeof DRAFT_CONFLICT_RESOLUTION_METHODS)[number];

const detectedDuringErrorMap: ZodErrorMap = (issue, ctx) => {
  if (issue.code === z.ZodIssueCode.invalid_type) {
    return { message: 'detectedDuring is required' };
  }
  if (issue.code === z.ZodIssueCode.invalid_enum_value) {
    return { message: 'Invalid detectedDuring value' };
  }
  return { message: ctx.defaultError };
};

const resolvedByErrorMap: ZodErrorMap = (issue, ctx) => {
  if (issue.code === z.ZodIssueCode.invalid_enum_value) {
    return { message: 'Invalid resolvedBy value' };
  }
  return { message: ctx.defaultError };
};

const DraftConflictLogObjectSchema = z.object({
  id: z.string().min(1, 'Draft conflict log id must be provided'),
  sectionId: z.string().min(1, 'sectionId must be provided'),
  draftId: z.string().min(1, 'draftId must be provided'),
  detectedAt: z.date(),
  detectedDuring: z.enum(DRAFT_CONFLICT_DETECTION_POINTS, {
    errorMap: detectedDuringErrorMap,
  }),
  previousApprovedVersion: z.number().int().min(0, 'previousApprovedVersion must be non-negative'),
  latestApprovedVersion: z.number().int().min(0, 'latestApprovedVersion must be non-negative'),
  resolvedBy: z
    .enum(DRAFT_CONFLICT_RESOLUTION_METHODS, {
      errorMap: resolvedByErrorMap,
    })
    .nullable(),
  resolutionNote: z.string().max(1000, 'resolutionNote too long').nullable(),
  createdAt: z.date(),
  createdBy: z.string().min(1, 'createdBy must be provided'),
  updatedAt: z.date(),
  updatedBy: z.string().min(1, 'updatedBy must be provided'),
  deletedAt: z.date().nullable().optional(),
  deletedBy: z.string().min(1).nullable().optional(),
});

const withVersionValidation = <Schema extends z.ZodTypeAny>(schema: Schema) =>
  schema.superRefine((log, ctx) => {
    const candidate = log as { previousApprovedVersion?: number; latestApprovedVersion?: number };
    const { previousApprovedVersion, latestApprovedVersion } = candidate;
    if (
      typeof previousApprovedVersion === 'number' &&
      typeof latestApprovedVersion === 'number' &&
      latestApprovedVersion <= previousApprovedVersion
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['latestApprovedVersion'],
        message: 'latestApprovedVersion must be greater than previousApprovedVersion',
      });
    }
  });

export const DraftConflictLogSchema = withVersionValidation(DraftConflictLogObjectSchema);

export type DraftConflictLog = z.infer<typeof DraftConflictLogSchema>;

export const CreateDraftConflictLogSchema = withVersionValidation(
  DraftConflictLogObjectSchema.omit({
    id: true,
    createdAt: true,
    createdBy: true,
    updatedAt: true,
    updatedBy: true,
    deletedAt: true,
    deletedBy: true,
  })
);

export type CreateDraftConflictLogInput = z.infer<typeof CreateDraftConflictLogSchema>;

export const UpdateDraftConflictLogSchema = withVersionValidation(
  DraftConflictLogObjectSchema.partial().extend({
    id: z.string().min(1, 'Draft conflict log id must be provided'),
  })
);

export type UpdateDraftConflictLogInput = z.infer<typeof UpdateDraftConflictLogSchema>;

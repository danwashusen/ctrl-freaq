import { z } from 'zod';

const IsoTimestampSchema = z
  .string()
  .min(1, 'Timestamp is required')
  .refine(value => !Number.isNaN(Date.parse(value)), {
    message: 'Timestamp must be a valid ISO 8601 string',
  });

export const DocumentLifecycleStatusSchema = z.enum(['draft', 'review', 'published']);
export type DocumentLifecycleStatus = z.infer<typeof DocumentLifecycleStatusSchema>;

export const ProjectDocumentWorkflowStatusSchema = z.enum([
  'missing',
  'loading',
  'ready',
  'archived',
]);
export type ProjectDocumentWorkflowStatus = z.infer<typeof ProjectDocumentWorkflowStatusSchema>;

export const TemplateValidationDecisionActionSchema = z.enum(['approved', 'pending', 'blocked']);
export type TemplateValidationDecisionAction = z.infer<
  typeof TemplateValidationDecisionActionSchema
>;

export const TemplateBindingSchema = z
  .object({
    templateId: z.string().min(1, 'templateId is required'),
    templateVersion: z.string().min(1, 'templateVersion is required'),
    templateSchemaHash: z.string().min(1, 'templateSchemaHash is required'),
  })
  .strict();
export type TemplateBinding = z.infer<typeof TemplateBindingSchema>;

export const TemplateValidationDecisionSchema = z
  .object({
    decisionId: z.string().uuid('decisionId must be a valid UUID'),
    action: TemplateValidationDecisionActionSchema,
    templateId: z.string().min(1, 'templateId is required'),
    currentVersion: z.string().min(1, 'currentVersion is required'),
    requestedVersion: z.string().min(1, 'requestedVersion is required'),
    submittedBy: z.string().min(1, 'submittedBy must be a non-empty string').optional(),
    submittedAt: IsoTimestampSchema,
    notes: z.string().nullable().optional(),
  })
  .strict();
export type TemplateValidationDecision = z.infer<typeof TemplateValidationDecisionSchema>;

export const ProjectDocumentSummarySchema = z
  .object({
    documentId: z.string().uuid('documentId must be a valid UUID'),
    firstSectionId: z.string().uuid('firstSectionId must be a valid UUID'),
    title: z.string().min(1, 'title is required'),
    lifecycleStatus: DocumentLifecycleStatusSchema,
    lastModifiedAt: IsoTimestampSchema,
    template: TemplateBindingSchema.optional(),
  })
  .strict();
export type ProjectDocumentSummary = z.infer<typeof ProjectDocumentSummarySchema>;

export const ProjectDocumentSnapshotSchema = z
  .object({
    projectId: z.string().uuid('projectId must be a valid UUID'),
    status: ProjectDocumentWorkflowStatusSchema,
    document: ProjectDocumentSummarySchema.nullable().default(null),
    templateDecision: TemplateValidationDecisionSchema.nullable().default(null),
    lastUpdatedAt: IsoTimestampSchema,
  })
  .strict()
  .superRefine((value, ctx) => {
    const hasDocument = value.document !== null;
    if (value.status === 'ready' && !hasDocument) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `status=${value.status} requires a document payload`,
        path: ['document'],
      });
    }
  });
export type ProjectDocumentSnapshot = z.infer<typeof ProjectDocumentSnapshotSchema>;

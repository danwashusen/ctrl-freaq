import { z, type ZodErrorMap } from 'zod';

export const SECTION_RECORD_STATUSES = ['idle', 'drafting', 'review', 'ready'] as const;
export type SectionRecordStatus = (typeof SECTION_RECORD_STATUSES)[number];

export const SECTION_RECORD_QUALITY_GATES = ['pending', 'passed', 'failed'] as const;
export type SectionRecordQualityGate = (typeof SECTION_RECORD_QUALITY_GATES)[number];

const createEnumErrorMap = (requiredMessage: string, invalidMessage: string): ZodErrorMap => {
  return issue => {
    if (issue.code === 'invalid_type') {
      return { message: requiredMessage };
    }
    if (issue.code === 'invalid_value') {
      return { message: invalidMessage };
    }
    return issue.message ?? undefined;
  };
};

export const SectionRecordSchema = z.object({
  id: z.string().min(1, 'Section record id must be provided'),
  documentId: z.string().min(1, 'documentId must be provided'),
  templateKey: z.string().min(1, 'templateKey is required').max(100, 'templateKey too long'),
  title: z.string().min(1, 'title is required').max(255, 'title too long'),
  depth: z.number().int().min(0, 'depth must be positive').max(5, 'depth too deep'),
  orderIndex: z.number().int().min(0, 'orderIndex must be non-negative'),
  approvedVersion: z.number().int().min(0, 'approvedVersion must be non-negative'),
  approvedContent: z.string().max(100_000, 'approvedContent exceeds limit'),
  approvedAt: z.date().nullable(),
  approvedBy: z.string().min(1).nullable(),
  lastSummary: z.string().max(1000, 'lastSummary too long').nullable(),
  status: z.enum(SECTION_RECORD_STATUSES, {
    error: createEnumErrorMap('status is required', 'Invalid section status'),
  }),
  qualityGate: z.enum(SECTION_RECORD_QUALITY_GATES, {
    error: createEnumErrorMap('qualityGate is required', 'Invalid qualityGate state'),
  }),
  accessibilityScore: z.number().min(0).max(100).nullable(),
  createdAt: z.date(),
  createdBy: z.string().min(1),
  updatedAt: z.date(),
  updatedBy: z.string().min(1),
  deletedAt: z.date().nullable().optional(),
  deletedBy: z.string().min(1).nullable().optional(),
});

export type SectionRecord = z.infer<typeof SectionRecordSchema>;

export const CreateSectionRecordSchema = SectionRecordSchema.omit({
  id: true,
  approvedAt: true,
  approvedBy: true,
  lastSummary: true,
  createdAt: true,
  updatedAt: true,
  deletedAt: true,
  deletedBy: true,
});

export type CreateSectionRecordInput = z.infer<typeof CreateSectionRecordSchema>;

export const UpdateSectionRecordSchema = SectionRecordSchema.partial().extend({
  id: z.string().uuid('Section record id must be a valid UUID'),
});

export type UpdateSectionRecordInput = z.infer<typeof UpdateSectionRecordSchema>;

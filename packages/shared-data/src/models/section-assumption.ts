import { z, type ZodErrorMap } from 'zod';

export const AssumptionResponseTypeSchema = z.enum(['single_select', 'multi_select', 'text']);
export type AssumptionResponseType = z.infer<typeof AssumptionResponseTypeSchema>;

const assumptionStatusError: ZodErrorMap = issue => {
  if (issue.code === 'invalid_value') {
    return { message: 'Invalid enum value' };
  }
  return issue.message;
};

const ASSUMPTION_STATUS_VALUES = [
  'pending',
  'answered',
  'deferred',
  'escalated',
  'override_skipped',
] as const;
type AssumptionStatusValue = (typeof ASSUMPTION_STATUS_VALUES)[number];

export const AssumptionStatusSchema = z.enum(
  ASSUMPTION_STATUS_VALUES as unknown as [AssumptionStatusValue, ...AssumptionStatusValue[]],
  {
    error: assumptionStatusError,
  }
);
export type AssumptionStatus = z.infer<typeof AssumptionStatusSchema>;

export const AssumptionOptionSchema = z.object({
  id: z.string().min(1, 'Option id is required'),
  label: z.string().min(1, 'Option label is required'),
  description: z.string().max(500).nullable(),
  defaultSelected: z.boolean(),
});
export type AssumptionOption = z.infer<typeof AssumptionOptionSchema>;

const AnswerValueSchema = z.union([z.string().min(1), z.array(z.string().min(1)).min(1), z.null()]);

type AnswerValue = z.infer<typeof AnswerValueSchema>;

export const SectionAssumptionSchema = z.object({
  id: z.string().min(1, 'Assumption id is required'),
  sessionId: z.string().min(1, 'Session id is required'),
  sectionId: z.string().min(1, 'Section id is required'),
  documentId: z.string().min(1, 'Document id is required'),
  templateKey: z.string().min(1, 'Template key is required'),
  promptHeading: z.string().min(1, 'Prompt heading is required'),
  promptBody: z.string().min(1, 'Prompt body is required'),
  responseType: AssumptionResponseTypeSchema,
  options: z.array(AssumptionOptionSchema).default([]),
  priority: z.number().int().nonnegative(),
  status: AssumptionStatusSchema,
  answerValue: AnswerValueSchema.default(null),
  answerNotes: z.string().nullable().optional().default(null),
  overrideJustification: z.string().nullable().optional().default(null),
  conflictDecisionId: z.string().nullable().optional().default(null),
  conflictResolvedAt: z.date().nullable().optional().default(null),
  createdAt: z.date(),
  createdBy: z.string().min(1),
  updatedAt: z.date(),
  updatedBy: z.string().min(1),
  deletedAt: z.date().nullable().optional().default(null),
  deletedBy: z.string().nullable().optional().default(null),
});

export type SectionAssumption = z.infer<typeof SectionAssumptionSchema>;

export interface SectionAssumptionUpdate {
  status?: AssumptionStatus;
  answerValue?: AnswerValue;
  answerNotes?: string | null;
  overrideJustification?: string | null;
  conflictDecisionId?: string | null;
  conflictResolvedAt?: Date | null;
  updatedBy: string;
}

export function normaliseAnswerValue(value: unknown): AnswerValue {
  if (Array.isArray(value)) {
    return value.filter(item => typeof item === 'string' && item.length > 0);
  }
  if (typeof value === 'string') {
    return value.length > 0 ? value : null;
  }
  return null;
}

export function serializeAssumptionOptions(options: AssumptionOption[]): string {
  return JSON.stringify(options);
}

export function deserializeAssumptionOptions(serialized: unknown): AssumptionOption[] {
  if (typeof serialized !== 'string') {
    return [];
  }

  try {
    const parsed = JSON.parse(serialized) as unknown;
    const options = z.array(AssumptionOptionSchema).safeParse(parsed);
    if (options.success) {
      return options.data;
    }
  } catch (error) {
    throw new Error(
      `Failed to parse assumption options JSON: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
  return [];
}

export function serializeAnswerValue(value: AnswerValue): string | null {
  if (value === null) {
    return null;
  }

  if (Array.isArray(value)) {
    return JSON.stringify(value);
  }

  return value;
}

export function deserializeAnswerValue(value: unknown): AnswerValue {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === 'string' && value.startsWith('[')) {
    try {
      const parsed = JSON.parse(value) as unknown;
      const result = z.array(z.string()).safeParse(parsed);
      if (result.success) {
        return result.data;
      }
    } catch (error) {
      throw new Error(
        `Failed to parse assumption answer array: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  if (typeof value === 'string') {
    return value.length > 0 ? value : null;
  }

  return null;
}

export function toSnakeCaseColumn(column: keyof SectionAssumption): string {
  return column.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`).replace(/^_/, '');
}

export type SectionAssumptionSeed = Omit<SectionAssumption, 'createdAt' | 'updatedAt'> & {
  createdAt?: Date;
  updatedAt?: Date;
};

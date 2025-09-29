import { z } from 'zod';

export const AssumptionSessionStatusSchema = z.enum([
  'in_progress',
  'awaiting_draft',
  'drafting',
  'blocked',
  'ready',
]);
export type AssumptionSessionStatus = z.infer<typeof AssumptionSessionStatusSchema>;

export const AssumptionSessionSchema = z.object({
  id: z.string().min(1, 'Session id is required'),
  sectionId: z.string().min(1, 'Section id is required'),
  documentId: z.string().min(1, 'Document id is required'),
  startedBy: z.string().min(1, 'Started by user id is required'),
  startedAt: z.date(),
  status: AssumptionSessionStatusSchema,
  templateVersion: z.string().min(1, 'Template version is required'),
  documentDecisionSnapshotId: z.string().nullable().optional().default(null),
  unresolvedOverrideCount: z.number().int().min(0),
  answeredCount: z.number().int().min(0),
  deferredCount: z.number().int().min(0),
  escalatedCount: z.number().int().min(0),
  overrideCount: z.number().int().min(0),
  latestProposalId: z.string().nullable().optional().default(null),
  summaryMarkdown: z.string().nullable().optional().default(null),
  closedAt: z.date().nullable().optional().default(null),
  closedBy: z.string().nullable().optional().default(null),
  createdAt: z.date(),
  createdBy: z.string().min(1),
  updatedAt: z.date(),
  updatedBy: z.string().min(1),
  deletedAt: z.date().nullable().optional().default(null),
  deletedBy: z.string().nullable().optional().default(null),
});

export type AssumptionSession = z.infer<typeof AssumptionSessionSchema>;

export interface AssumptionSessionCreateInput {
  sectionId: string;
  documentId: string;
  templateVersion: string;
  startedBy: string;
  startedAt: Date;
  summaryMarkdown?: string | null;
  decisionSnapshotId?: string | null;
  createdBy: string;
  updatedBy: string;
}

export interface AssumptionSessionUpdateInput {
  status?: AssumptionSessionStatus;
  unresolvedOverrideCount?: number;
  answeredCount?: number;
  deferredCount?: number;
  escalatedCount?: number;
  overrideCount?: number;
  latestProposalId?: string | null;
  summaryMarkdown?: string | null;
  decisionSnapshotId?: string | null;
  closedAt?: Date | null;
  closedBy?: string | null;
  updatedBy: string;
}

export function toSnakeCaseColumn(column: keyof AssumptionSession): string {
  return column.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`).replace(/^_/, '');
}

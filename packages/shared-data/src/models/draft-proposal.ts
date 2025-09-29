import { z } from 'zod';

export const DraftProposalSourceSchema = z.enum([
  'ai_generated',
  'manual_revision',
  'ai_retry',
  'fallback_manual',
]);
export type DraftProposalSource = z.infer<typeof DraftProposalSourceSchema>;

export const DraftProposalRationaleSchema = z.object({
  assumptionId: z.string().min(1, 'Assumption id is required'),
  summary: z.string().min(1, 'Rationale summary is required'),
});
export type DraftProposalRationale = z.infer<typeof DraftProposalRationaleSchema>;

export const DraftProposalSchema = z.object({
  id: z.string().min(1, 'Proposal id is required'),
  sessionId: z.string().min(1, 'Session id is required'),
  sectionId: z.string().min(1, 'Section id is required'),
  proposalIndex: z.number().int().min(0),
  source: DraftProposalSourceSchema,
  contentMarkdown: z.string().min(1, 'Proposal content is required'),
  rationale: z.array(DraftProposalRationaleSchema).default([]),
  aiConfidence: z.number().min(0).max(1).nullable().optional().default(null),
  failedReason: z.string().nullable().optional().default(null),
  createdAt: z.date(),
  createdBy: z.string().min(1),
  updatedAt: z.date(),
  updatedBy: z.string().min(1),
  supersededAt: z.date().nullable().optional().default(null),
  supersededByProposalId: z.string().nullable().optional().default(null),
  deletedAt: z.date().nullable().optional().default(null),
  deletedBy: z.string().nullable().optional().default(null),
});

export type DraftProposal = z.infer<typeof DraftProposalSchema>;

export function serializeRationale(rationale: DraftProposalRationale[]): string {
  return JSON.stringify(rationale);
}

export function deserializeRationale(serialized: unknown): DraftProposalRationale[] {
  if (typeof serialized !== 'string') {
    return [];
  }

  try {
    const parsed = JSON.parse(serialized) as unknown;
    const result = z.array(DraftProposalRationaleSchema).safeParse(parsed);
    if (result.success) {
      return result.data;
    }
  } catch (error) {
    throw new Error(
      `Failed to parse draft proposal rationale JSON: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }

  return [];
}

export interface DraftProposalCreateInput {
  sessionId: string;
  sectionId: string;
  proposalIndex?: number;
  source: DraftProposalSource;
  contentMarkdown: string;
  rationale: DraftProposalRationale[];
  aiConfidence?: number | null;
  failedReason?: string | null;
  createdBy: string;
  updatedBy: string;
}

export interface DraftProposalUpdateInput {
  supersededAt?: Date | null;
  supersededByProposalId?: string | null;
  updatedBy: string;
}

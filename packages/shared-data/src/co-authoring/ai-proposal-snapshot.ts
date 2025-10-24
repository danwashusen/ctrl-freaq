import { z } from 'zod';

const IsoTimestampSchema = z
  .string()
  .min(1, 'Timestamp is required')
  .refine(value => !Number.isNaN(Date.parse(value)), {
    message: 'Timestamp must be a valid ISO 8601 string',
  });

const DiffRenderModeSchema = z.enum(['split', 'unified']);

const DiffSchema = z.object({
  mode: DiffRenderModeSchema,
  segments: z.array(z.record(z.string(), z.unknown())),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

const ProposalAnnotationSchema = z.object({
  segmentId: z.string().min(1, 'segmentId is required'),
  segmentType: z.enum(['added', 'removed', 'context']),
  originTurnId: z.string().min(1, 'originTurnId is required'),
  promptId: z.string().min(1, 'promptId is required'),
  rationale: z.string().min(1, 'rationale is required'),
  confidence: z.number().min(0).max(1),
  citations: z.array(z.string()).default([]),
});

export type DiffPreviewAnnotation = z.infer<typeof ProposalAnnotationSchema>;

const DEFAULT_PROPOSAL_TTL_MS = 10 * 60 * 1000;

export const AIProposalSnapshotSchema = z
  .object({
    proposalId: z.string().uuid('proposalId must be a valid UUID'),
    sessionId: z.string().uuid('sessionId must be a valid UUID'),
    originTurnId: z.string().min(1, 'originTurnId is required'),
    diff: DiffSchema,
    renderMode: DiffRenderModeSchema,
    confidence: z.number().min(0).max(1),
    citations: z.array(z.string()).default([]),
    annotations: z.array(ProposalAnnotationSchema).default([]),
    createdAt: IsoTimestampSchema,
    expiresAt: IsoTimestampSchema,
  })
  .strict();

export type AIProposalSnapshot = z.infer<typeof AIProposalSnapshotSchema>;

export interface CreateAIProposalSnapshotInput
  extends Omit<
    AIProposalSnapshot,
    'createdAt' | 'expiresAt' | 'citations' | 'annotations' | 'renderMode'
  > {
  citations?: string[];
  annotations?: DiffPreviewAnnotation[];
  renderMode?: 'split' | 'unified';
  createdAt?: Date | string;
  ttlMs?: number;
}

const toIsoString = (input: Date | string | undefined): string => {
  if (!input) {
    return new Date().toISOString();
  }

  if (input instanceof Date) {
    return input.toISOString();
  }

  if (!Number.isNaN(Date.parse(input))) {
    return new Date(input).toISOString();
  }

  throw new Error('Invalid timestamp supplied to AIProposalSnapshot');
};

const toPositiveDuration = (value: number | undefined): number => {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    return DEFAULT_PROPOSAL_TTL_MS;
  }

  return value;
};

const sanitizeStringList = (values: readonly string[] | undefined): string[] => {
  if (!values) {
    return [];
  }

  const seen = new Set<string>();
  const result: string[] = [];

  for (const value of values) {
    if (typeof value !== 'string') {
      continue;
    }
    const trimmed = value.trim();
    if (!trimmed || seen.has(trimmed)) {
      continue;
    }
    seen.add(trimmed);
    result.push(trimmed);
  }

  return result;
};

export function createAIProposalSnapshot(input: CreateAIProposalSnapshotInput): AIProposalSnapshot {
  const createdAt = toIsoString(input.createdAt);
  const ttlMs = toPositiveDuration(input.ttlMs);
  const expiresAt = new Date(new Date(createdAt).getTime() + ttlMs).toISOString();

  const sanitized: AIProposalSnapshot = {
    proposalId: input.proposalId,
    sessionId: input.sessionId,
    originTurnId: input.originTurnId,
    diff: input.diff,
    renderMode: input.renderMode ?? input.diff.mode,
    confidence: input.confidence,
    citations: sanitizeStringList(input.citations),
    annotations: (input.annotations ?? []).map(annotation =>
      ProposalAnnotationSchema.parse(annotation)
    ),
    createdAt,
    expiresAt,
  };

  return AIProposalSnapshotSchema.parse(sanitized);
}

export const AI_PROPOSAL_DEFAULT_TTL_MS = DEFAULT_PROPOSAL_TTL_MS;

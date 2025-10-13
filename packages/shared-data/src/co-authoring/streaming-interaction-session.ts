import { z } from 'zod';

const IsoTimestampSchema = z
  .string()
  .min(1, 'Timestamp is required')
  .refine(value => !Number.isNaN(Date.parse(value)), {
    message: 'Timestamp must be a valid ISO 8601 string',
  });

const NullableIsoTimestampSchema = IsoTimestampSchema.nullable().optional().default(null);

const NonNegativeIntegerSchema = z.number().int().min(0);

const sanitizeMetadata = (
  value: Record<string, unknown> | null | undefined
): Record<string, unknown> => {
  if (!value) {
    return {};
  }

  const entries = Object.entries(value).filter(([key]) => typeof key === 'string');
  return Object.fromEntries(entries);
};

const toIsoOrNull = (value: string | Date | null | undefined): string | null => {
  if (value == null) {
    return null;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (typeof value === 'string' && !Number.isNaN(Date.parse(value))) {
    return new Date(value).toISOString();
  }

  throw new Error('Invalid timestamp input');
};

const requireIsoTimestamp = (value: string | Date | null | undefined, field: string): string => {
  const iso = toIsoOrNull(value);
  if (!iso) {
    throw new Error(`${field} must be a valid timestamp`);
  }
  return iso;
};

const toNonNegativeOrNull = (value: number | null | undefined): number | null => {
  if (value == null) {
    return null;
  }

  if (!Number.isFinite(value) || value < 0) {
    throw new Error('Concurrency slot must be a non-negative integer');
  }

  return Math.trunc(value);
};

const sanitizeOptionalString = (value: string | null | undefined): string | null => {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const sanitizeContentSnippet = (value: string | null | undefined): string | null => {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

export const StreamingInteractionModeSchema = z.enum(['streaming', 'fallback']);
export type StreamingInteractionMode = z.infer<typeof StreamingInteractionModeSchema>;

export const StreamingInteractionStatusSchema = z.enum([
  'pending',
  'active',
  'fallback_active',
  'completed',
  'canceled',
]);
export type StreamingInteractionStatus = z.infer<typeof StreamingInteractionStatusSchema>;

export const StreamingInteractionTypeSchema = z.enum(['co_author', 'assumption_loop', 'qa']);
export type StreamingInteractionType = z.infer<typeof StreamingInteractionTypeSchema>;

export const StreamingCancellationReasonSchema = z.enum([
  'author_cancelled',
  'replaced_by_new_request',
  'transport_failure',
  'deferred',
]);
export type StreamingCancellationReason = z.infer<typeof StreamingCancellationReasonSchema>;

export const StreamingFallbackReasonSchema = z.enum([
  'transport_blocked',
  'timeout',
  'retry_exhausted',
]);
export type StreamingFallbackReason = z.infer<typeof StreamingFallbackReasonSchema>;

export const StreamingDeliveryChannelSchema = z.enum(['streaming', 'fallback']);
export type StreamingDeliveryChannel = z.infer<typeof StreamingDeliveryChannelSchema>;

export const StreamingAnnouncementPrioritySchema = z.enum(['polite', 'assertive']);
export type StreamingAnnouncementPriority = z.infer<typeof StreamingAnnouncementPrioritySchema>;

export const StreamingDeltaTypeSchema = z.enum(['text', 'status', 'metric']);
export type StreamingDeltaType = z.infer<typeof StreamingDeltaTypeSchema>;

export const StreamingInteractionSessionSchema = z
  .object({
    sessionId: z.string().uuid('sessionId must be a valid UUID'),
    documentId: z.string().uuid('documentId must be a valid UUID'),
    sectionId: z.string().uuid('sectionId must be a valid UUID'),
    workspaceId: z.string().uuid('workspaceId must be a valid UUID'),
    initiatorUserId: z.string().uuid('initiatorUserId must be a valid UUID'),
    interactionType: StreamingInteractionTypeSchema,
    mode: StreamingInteractionModeSchema,
    status: StreamingInteractionStatusSchema,
    queuedAt: NullableIsoTimestampSchema,
    startedAt: NullableIsoTimestampSchema,
    timeToFirstUpdateMs: NonNegativeIntegerSchema.nullable().optional().default(null),
    completedAt: NullableIsoTimestampSchema,
    canceledAt: NullableIsoTimestampSchema,
    cancellationReason: StreamingCancellationReasonSchema.nullable().optional().default(null),
    fallbackTriggeredAt: NullableIsoTimestampSchema,
    fallbackReason: StreamingFallbackReasonSchema.nullable().optional().default(null),
    finalSummaryId: z
      .string()
      .uuid('finalSummaryId must be a valid UUID')
      .nullable()
      .optional()
      .default(null),
    concurrencySlot: NonNegativeIntegerSchema.nullable().optional().default(null),
    metadata: z.record(z.string(), z.unknown()).optional().default({}),
  })
  .strict();

export type StreamingInteractionSession = z.infer<typeof StreamingInteractionSessionSchema>;

export interface CreateStreamingInteractionSessionInput
  extends Omit<
    StreamingInteractionSession,
    | 'queuedAt'
    | 'startedAt'
    | 'completedAt'
    | 'canceledAt'
    | 'fallbackTriggeredAt'
    | 'metadata'
    | 'finalSummaryId'
    | 'fallbackReason'
    | 'cancellationReason'
    | 'concurrencySlot'
    | 'timeToFirstUpdateMs'
  > {
  queuedAt?: string | Date | null;
  startedAt?: string | Date | null;
  completedAt?: string | Date | null;
  canceledAt?: string | Date | null;
  fallbackTriggeredAt?: string | Date | null;
  metadata?: Record<string, unknown> | null;
  finalSummaryId?: string | null;
  fallbackReason?: StreamingFallbackReason | null;
  cancellationReason?: StreamingCancellationReason | null;
  concurrencySlot?: number | null;
  timeToFirstUpdateMs?: number | null;
}

export function createStreamingInteractionSession(
  input: CreateStreamingInteractionSessionInput
): StreamingInteractionSession {
  const candidate = {
    ...input,
    queuedAt: toIsoOrNull(input.queuedAt),
    startedAt: toIsoOrNull(input.startedAt),
    completedAt: toIsoOrNull(input.completedAt),
    canceledAt: toIsoOrNull(input.canceledAt),
    fallbackTriggeredAt: toIsoOrNull(input.fallbackTriggeredAt),
    metadata: sanitizeMetadata(input.metadata),
    finalSummaryId: sanitizeOptionalString(input.finalSummaryId ?? null),
    fallbackReason: input.fallbackReason ?? null,
    cancellationReason: input.cancellationReason ?? null,
    concurrencySlot: toNonNegativeOrNull(input.concurrencySlot),
    timeToFirstUpdateMs:
      input.timeToFirstUpdateMs == null
        ? null
        : NonNegativeIntegerSchema.parse(input.timeToFirstUpdateMs),
  };

  return StreamingInteractionSessionSchema.parse(candidate);
}

export const StreamingProgressEventSchema = z
  .object({
    sessionId: z.string().uuid('sessionId must be a valid UUID'),
    sequence: NonNegativeIntegerSchema,
    stageLabel: z.string().min(1, 'stageLabel is required'),
    timestamp: IsoTimestampSchema,
    contentSnippet: z.string().nullable().optional().default(null),
    deltaType: StreamingDeltaTypeSchema,
    deliveryChannel: StreamingDeliveryChannelSchema,
    announcementPriority: StreamingAnnouncementPrioritySchema,
    elapsedMs: NonNegativeIntegerSchema,
  })
  .strict();

export type StreamingProgressEvent = z.infer<typeof StreamingProgressEventSchema>;

export interface CreateStreamingProgressEventInput
  extends Omit<StreamingProgressEvent, 'timestamp' | 'contentSnippet'> {
  timestamp: string | Date;
  contentSnippet?: string | null;
}

export function createStreamingProgressEvent(
  input: CreateStreamingProgressEventInput
): StreamingProgressEvent {
  const candidate = {
    ...input,
    timestamp: requireIsoTimestamp(input.timestamp, 'timestamp'),
    contentSnippet: sanitizeContentSnippet(input.contentSnippet),
  };

  return StreamingProgressEventSchema.parse(candidate);
}

export const StreamingFallbackRootCauseSchema = z.enum([
  'transport_blocked',
  'stream_timeout',
  'sse_error',
  'policy_restriction',
]);
export type StreamingFallbackRootCause = z.infer<typeof StreamingFallbackRootCauseSchema>;

export const StreamingFallbackRecordSchema = z
  .object({
    sessionId: z.string().uuid('sessionId must be a valid UUID'),
    triggeredAt: IsoTimestampSchema,
    resolvedAt: NullableIsoTimestampSchema,
    rootCause: StreamingFallbackRootCauseSchema,
    preservedTokensCount: NonNegativeIntegerSchema.default(0),
    retryAttempted: z.boolean().default(false),
    notes: z.string().nullable().optional().default(null),
    reportedToClient: z.boolean().default(true),
  })
  .strict();

export type StreamingFallbackRecord = z.infer<typeof StreamingFallbackRecordSchema>;

export interface CreateStreamingFallbackRecordInput
  extends Omit<StreamingFallbackRecord, 'triggeredAt' | 'resolvedAt' | 'notes'> {
  triggeredAt: string | Date;
  resolvedAt?: string | Date | null;
  notes?: string | null;
}

export function createStreamingFallbackRecord(
  input: CreateStreamingFallbackRecordInput
): StreamingFallbackRecord {
  const candidate = {
    ...input,
    triggeredAt: requireIsoTimestamp(input.triggeredAt, 'triggeredAt'),
    resolvedAt: toIsoOrNull(input.resolvedAt),
    notes: sanitizeOptionalString(input.notes),
  };

  return StreamingFallbackRecordSchema.parse(candidate);
}

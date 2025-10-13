import { z } from 'zod';

import {
  StreamingAnnouncementPrioritySchema,
  StreamingCancellationReasonSchema,
  StreamingDeliveryChannelSchema,
  StreamingDeltaTypeSchema,
  StreamingFallbackReasonSchema,
  StreamingFallbackRecordSchema,
  StreamingFallbackRootCauseSchema,
  StreamingInteractionModeSchema,
  StreamingInteractionSessionSchema,
  StreamingInteractionStatusSchema,
  StreamingInteractionTypeSchema,
  StreamingProgressEventSchema,
  createStreamingFallbackRecord,
  createStreamingInteractionSession,
  createStreamingProgressEvent,
  type StreamingFallbackRecord,
  type StreamingInteractionSession,
  type StreamingProgressEvent,
} from '../co-authoring/streaming-interaction-session.js';

const IsoTimestampSchema = z
  .string()
  .min(1, 'Timestamp is required')
  .refine(value => !Number.isNaN(Date.parse(value)), {
    message: 'Timestamp must be a valid ISO 8601 string',
  });

const NullableIsoTimestampSchema = IsoTimestampSchema.nullable().optional();
const NonNegativeIntegerSchema = z.number().int().min(0);

const MetadataJsonSchema = z
  .string()
  .optional()
  .transform(value => (typeof value === 'string' ? value : '{}'));

const parseMetadataJson = (json: string | undefined): Record<string, unknown> => {
  if (typeof json !== 'string' || json.trim().length === 0) {
    return {};
  }

  try {
    const parsed = JSON.parse(json) as unknown;
    if (parsed && typeof parsed === 'object') {
      return parsed as Record<string, unknown>;
    }
  } catch (error) {
    throw new Error(
      `Failed to parse streaming metadata JSON: ${(error as Error).message ?? 'Unknown error'}`
    );
  }

  return {};
};

const toIsoOrNull = (value: Date | string | null | undefined): string | null => {
  if (value == null) {
    return null;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (typeof value === 'string' && !Number.isNaN(Date.parse(value))) {
    return new Date(value).toISOString();
  }

  throw new Error('Invalid timestamp supplied to streaming persistence mapper');
};

const requireIsoTimestamp = (value: Date | string | null | undefined, field: string): string => {
  const iso = toIsoOrNull(value);
  if (!iso) {
    throw new Error(`${field} must be a valid timestamp`);
  }
  return iso;
};

const sanitizeOptionalString = (value: unknown): string | null => {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const toNullableInt = (value: unknown): number | null => {
  if (value == null) {
    return null;
  }

  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error('Expected a numeric value for concurrency slot/timing metadata');
  }

  return Math.trunc(value);
};

export const StreamingInteractionSessionRowSchema = z
  .object({
    session_id: z.string().uuid('session_id must be a valid UUID'),
    document_id: z.string().uuid('document_id must be a valid UUID'),
    section_id: z.string().uuid('section_id must be a valid UUID'),
    workspace_id: z.string().uuid('workspace_id must be a valid UUID'),
    initiator_user_id: z.string().uuid('initiator_user_id must be a valid UUID'),
    interaction_type: StreamingInteractionTypeSchema,
    mode: StreamingInteractionModeSchema,
    status: StreamingInteractionStatusSchema,
    queued_at: NullableIsoTimestampSchema.default(null),
    started_at: NullableIsoTimestampSchema.default(null),
    time_to_first_update_ms: NonNegativeIntegerSchema.nullable().optional().default(null),
    completed_at: NullableIsoTimestampSchema.default(null),
    canceled_at: NullableIsoTimestampSchema.default(null),
    cancellation_reason: StreamingCancellationReasonSchema.nullable().optional().default(null),
    fallback_triggered_at: NullableIsoTimestampSchema.default(null),
    fallback_reason: StreamingFallbackReasonSchema.nullable().optional().default(null),
    final_summary_id: z.string().uuid().nullable().optional().default(null),
    concurrency_slot: NonNegativeIntegerSchema.nullable().optional().default(null),
    metadata_json: MetadataJsonSchema,
    created_at: IsoTimestampSchema,
    created_by: z.string().min(1),
    updated_at: IsoTimestampSchema,
    updated_by: z.string().min(1),
    deleted_at: NullableIsoTimestampSchema.default(null),
    deleted_by: z.string().min(1).nullable().optional().default(null),
  })
  .strict();

export type StreamingInteractionSessionRow = z.infer<typeof StreamingInteractionSessionRowSchema>;

export const StreamingProgressEventRowSchema = z
  .object({
    session_id: z.string().uuid('session_id must be a valid UUID'),
    sequence: NonNegativeIntegerSchema,
    stage_label: z.string().min(1),
    timestamp: IsoTimestampSchema,
    content_snippet: z.string().nullable().optional().default(null),
    delta_type: StreamingDeltaTypeSchema,
    delivery_channel: StreamingDeliveryChannelSchema,
    announcement_priority: StreamingAnnouncementPrioritySchema,
    elapsed_ms: NonNegativeIntegerSchema,
    created_at: IsoTimestampSchema,
    created_by: z.string().min(1),
  })
  .strict();

export type StreamingProgressEventRow = z.infer<typeof StreamingProgressEventRowSchema>;

export const StreamingFallbackRecordRowSchema = z
  .object({
    session_id: z.string().uuid('session_id must be a valid UUID'),
    triggered_at: IsoTimestampSchema,
    resolved_at: NullableIsoTimestampSchema.default(null),
    root_cause: StreamingFallbackRootCauseSchema,
    preserved_tokens_count: NonNegativeIntegerSchema.default(0),
    retry_attempted: z.boolean().default(false),
    notes: z.string().nullable().optional().default(null),
    reported_to_client: z.boolean().default(true),
    created_at: IsoTimestampSchema,
    created_by: z.string().min(1),
    updated_at: IsoTimestampSchema,
    updated_by: z.string().min(1),
  })
  .strict();

export type StreamingFallbackRecordRow = z.infer<typeof StreamingFallbackRecordRowSchema>;

export interface StreamingInteractionSessionPersistence {
  session: StreamingInteractionSession;
  row: StreamingInteractionSessionRow;
}

export const STREAMING_INTERACTION_SESSION_TABLE = 'streaming_interaction_sessions';
export const STREAMING_PROGRESS_EVENT_TABLE = 'streaming_progress_events';
export const STREAMING_FALLBACK_RECORD_TABLE = 'streaming_fallback_records';

export function mapSessionRowToEntity(
  row: StreamingInteractionSessionRow
): StreamingInteractionSession {
  const metadata = parseMetadataJson(row.metadata_json);

  const entity = createStreamingInteractionSession({
    sessionId: row.session_id,
    documentId: row.document_id,
    sectionId: row.section_id,
    workspaceId: row.workspace_id,
    initiatorUserId: row.initiator_user_id,
    interactionType: row.interaction_type,
    mode: row.mode,
    status: row.status,
    queuedAt: row.queued_at,
    startedAt: row.started_at,
    timeToFirstUpdateMs: row.time_to_first_update_ms,
    completedAt: row.completed_at,
    canceledAt: row.canceled_at,
    cancellationReason: row.cancellation_reason,
    fallbackTriggeredAt: row.fallback_triggered_at,
    fallbackReason: row.fallback_reason,
    finalSummaryId: row.final_summary_id,
    concurrencySlot: row.concurrency_slot,
    metadata,
  });

  StreamingInteractionSessionSchema.parse(entity);
  return entity;
}

export function mapSessionEntityToRow(
  entity: StreamingInteractionSession,
  audit: { createdAt?: Date; createdBy: string; updatedAt: Date; updatedBy: string }
): StreamingInteractionSessionRow {
  StreamingInteractionSessionSchema.parse(entity);

  const createdAt = audit.createdAt ?? audit.updatedAt;

  return StreamingInteractionSessionRowSchema.parse({
    session_id: entity.sessionId,
    document_id: entity.documentId,
    section_id: entity.sectionId,
    workspace_id: entity.workspaceId,
    initiator_user_id: entity.initiatorUserId,
    interaction_type: entity.interactionType,
    mode: entity.mode,
    status: entity.status,
    queued_at: toIsoOrNull(entity.queuedAt),
    started_at: toIsoOrNull(entity.startedAt),
    time_to_first_update_ms: toNullableInt(entity.timeToFirstUpdateMs),
    completed_at: toIsoOrNull(entity.completedAt),
    canceled_at: toIsoOrNull(entity.canceledAt),
    cancellation_reason: entity.cancellationReason ?? null,
    fallback_triggered_at: toIsoOrNull(entity.fallbackTriggeredAt),
    fallback_reason: entity.fallbackReason ?? null,
    final_summary_id: sanitizeOptionalString(entity.finalSummaryId),
    concurrency_slot: toNullableInt(entity.concurrencySlot),
    metadata_json: JSON.stringify(entity.metadata ?? {}),
    created_at: toIsoOrNull(createdAt) ?? new Date().toISOString(),
    created_by: audit.createdBy,
    updated_at: toIsoOrNull(audit.updatedAt) ?? new Date().toISOString(),
    updated_by: audit.updatedBy,
    deleted_at: null,
    deleted_by: null,
  });
}

export function mapProgressEventRowToEntity(
  row: StreamingProgressEventRow
): StreamingProgressEvent {
  const entity = createStreamingProgressEvent({
    sessionId: row.session_id,
    sequence: row.sequence,
    stageLabel: row.stage_label,
    timestamp: row.timestamp,
    contentSnippet: row.content_snippet,
    deltaType: row.delta_type,
    deliveryChannel: row.delivery_channel,
    announcementPriority: row.announcement_priority,
    elapsedMs: row.elapsed_ms,
  });

  StreamingProgressEventSchema.parse(entity);
  return entity;
}

export function mapProgressEventEntityToRow(
  entity: StreamingProgressEvent,
  audit: { createdAt: Date; createdBy: string }
): StreamingProgressEventRow {
  StreamingProgressEventSchema.parse(entity);

  return StreamingProgressEventRowSchema.parse({
    session_id: entity.sessionId,
    sequence: entity.sequence,
    stage_label: entity.stageLabel,
    timestamp: requireIsoTimestamp(entity.timestamp, 'timestamp'),
    content_snippet: sanitizeOptionalString(entity.contentSnippet),
    delta_type: entity.deltaType,
    delivery_channel: entity.deliveryChannel,
    announcement_priority: entity.announcementPriority,
    elapsed_ms: entity.elapsedMs,
    created_at: requireIsoTimestamp(audit.createdAt, 'createdAt'),
    created_by: audit.createdBy,
  });
}

export function mapFallbackRecordRowToEntity(
  row: StreamingFallbackRecordRow
): StreamingFallbackRecord {
  const entity = createStreamingFallbackRecord({
    sessionId: row.session_id,
    triggeredAt: row.triggered_at,
    resolvedAt: row.resolved_at,
    rootCause: row.root_cause,
    preservedTokensCount: row.preserved_tokens_count,
    retryAttempted: row.retry_attempted,
    notes: row.notes,
    reportedToClient: row.reported_to_client,
  });

  StreamingFallbackRecordSchema.parse(entity);
  return entity;
}

export function mapFallbackRecordEntityToRow(
  entity: StreamingFallbackRecord,
  audit: { createdAt: Date; createdBy: string; updatedAt: Date; updatedBy: string }
): StreamingFallbackRecordRow {
  StreamingFallbackRecordSchema.parse(entity);

  return StreamingFallbackRecordRowSchema.parse({
    session_id: entity.sessionId,
    triggered_at: requireIsoTimestamp(entity.triggeredAt, 'triggeredAt'),
    resolved_at: toIsoOrNull(entity.resolvedAt),
    root_cause: entity.rootCause,
    preserved_tokens_count: entity.preservedTokensCount,
    retry_attempted: entity.retryAttempted,
    notes: sanitizeOptionalString(entity.notes),
    reported_to_client: entity.reportedToClient,
    created_at: requireIsoTimestamp(audit.createdAt, 'createdAt'),
    created_by: audit.createdBy,
    updated_at: requireIsoTimestamp(audit.updatedAt, 'updatedAt'),
    updated_by: audit.updatedBy,
  });
}

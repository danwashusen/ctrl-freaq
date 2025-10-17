import { z } from 'zod';

export const TRACEABILITY_AUDIT_EVENT_TYPES = [
  'link-created',
  'link-updated',
  'link-orphaned',
  'link-reassigned',
] as const;

export type TraceabilityAuditEventType = (typeof TRACEABILITY_AUDIT_EVENT_TYPES)[number];

const [LINK_CREATED, LINK_UPDATED, LINK_ORPHANED, LINK_REASSIGNED] = TRACEABILITY_AUDIT_EVENT_TYPES;

export const TraceabilityAuditEventTypeSchema: z.ZodType<TraceabilityAuditEventType> = z.union([
  z.literal(LINK_CREATED),
  z.literal(LINK_UPDATED),
  z.literal(LINK_ORPHANED),
  z.literal(LINK_REASSIGNED),
]);

export const TraceabilityAuditEventSchema = z.object({
  eventId: z.string().uuid('eventId must be a valid UUID'),
  type: TraceabilityAuditEventTypeSchema,
  timestamp: z.date(),
  actorId: z.string().min(1, 'actorId is required'),
  details: z.record(z.string(), z.string()).default({}),
});

export type TraceabilityAuditEvent = z.infer<typeof TraceabilityAuditEventSchema>;

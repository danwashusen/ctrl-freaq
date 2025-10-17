import { z } from 'zod';

import { QUALITY_GATE_STATUSES, type QualityGateStatus } from '../quality-gates/status.js';

import { TraceabilityAuditEventSchema } from './traceability-audit-event.js';

export const TRACEABILITY_COVERAGE_STATUSES = [
  'covered',
  'warning',
  'blocker',
  'orphaned',
] as const;
export type TraceabilityCoverageStatus = (typeof TRACEABILITY_COVERAGE_STATUSES)[number];

export const TraceabilityLinkSchema = z.object({
  id: z.string().uuid('id must be a valid UUID'),
  requirementId: z.string().min(1, 'requirementId is required'),
  sectionId: z.string().min(1, 'sectionId is required'),
  documentId: z.string().min(1, 'documentId is required'),
  revisionId: z.string().min(1, 'revisionId is required'),
  gateStatus: z.enum(QUALITY_GATE_STATUSES),
  coverageStatus: z.enum(TRACEABILITY_COVERAGE_STATUSES),
  lastValidatedAt: z.date(),
  validatedBy: z.string().min(1, 'validatedBy is required'),
  notes: z.array(z.string().min(1)).default([]),
  auditTrail: z.array(TraceabilityAuditEventSchema).default([]),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type TraceabilityLink = z.infer<typeof TraceabilityLinkSchema>;
export type TraceabilityGateStatus = QualityGateStatus;

export const CreateTraceabilityLinkSchema = TraceabilityLinkSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type CreateTraceabilityLinkInput = z.infer<typeof CreateTraceabilityLinkSchema>;

export const UpdateTraceabilityLinkSchema = TraceabilityLinkSchema.partial().extend({
  id: z.string().uuid('id must be a valid UUID'),
});

export type UpdateTraceabilityLinkInput = z.infer<typeof UpdateTraceabilityLinkSchema>;

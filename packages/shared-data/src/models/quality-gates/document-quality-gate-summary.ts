import { z } from 'zod';

import type { QualityGateStatus } from '@ctrl-freaq/editor-core/quality-gates/status';

export const QUALITY_GATE_COVERAGE_GAP_REASONS = [
  'no-link',
  'blocker',
  'warning-override',
] as const;
export type QualityGateCoverageGapReason = (typeof QUALITY_GATE_COVERAGE_GAP_REASONS)[number];

export const QualityGateStatusCountsSchema = z.object({
  pass: z.number().int().min(0),
  warning: z.number().int().min(0),
  blocker: z.number().int().min(0),
  neutral: z.number().int().min(0),
});

export type QualityGateStatusCounts = z.infer<typeof QualityGateStatusCountsSchema>;

export const RequirementGapSchema = z.object({
  requirementId: z.string().min(1, 'requirementId is required'),
  reason: z.enum(QUALITY_GATE_COVERAGE_GAP_REASONS),
  linkedSections: z.array(z.string().min(1)).default([]),
});

export type RequirementGap = z.infer<typeof RequirementGapSchema>;

export const DocumentQualityGateSummarySchema = z.object({
  id: z.string().uuid('id must be a valid UUID'),
  documentId: z.string().min(1, 'documentId is required'),
  statusCounts: QualityGateStatusCountsSchema,
  blockerSections: z.array(z.string().min(1)),
  warningSections: z.array(z.string().min(1)),
  lastRunAt: z.date().nullable(),
  triggeredBy: z.string().min(1, 'triggeredBy is required'),
  requestId: z.string().min(1, 'requestId is required'),
  publishBlocked: z.boolean(),
  coverageGaps: z.array(RequirementGapSchema),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type DocumentQualityGateSummary = z.infer<typeof DocumentQualityGateSummarySchema>;
export type DocumentQualityGateStatus = QualityGateStatus;

export const CreateDocumentQualityGateSummarySchema = DocumentQualityGateSummarySchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type CreateDocumentQualityGateSummaryInput = z.infer<
  typeof CreateDocumentQualityGateSummarySchema
>;

export const UpdateDocumentQualityGateSummarySchema =
  DocumentQualityGateSummarySchema.partial().extend({
    documentId: z.string().min(1, 'documentId is required'),
  });

export type UpdateDocumentQualityGateSummaryInput = z.infer<
  typeof UpdateDocumentQualityGateSummarySchema
>;

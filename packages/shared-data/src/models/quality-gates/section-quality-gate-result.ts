import { z } from 'zod';

import type { QualityGateStatus } from './status.js';

import { GateRuleResultSchema, QualityGateStatusSchema } from './gate-rule-result.js';

export const QUALITY_GATE_RUN_SOURCES = ['auto', 'manual', 'dashboard'] as const;
export type QualityGateRunSource = (typeof QUALITY_GATE_RUN_SOURCES)[number];

export const REMEDIATION_STATES = ['pending', 'in-progress', 'resolved'] as const;
export type RemediationState = (typeof REMEDIATION_STATES)[number];

export const SectionQualityGateResultSchema = z.object({
  id: z.string().min(1, 'id is required'),
  sectionId: z.string().min(1, 'sectionId is required'),
  documentId: z.string().min(1, 'documentId is required'),
  runId: z.string().min(1, 'runId is required'),
  status: QualityGateStatusSchema,
  rules: z.array(GateRuleResultSchema),
  lastRunAt: z.date().nullable(),
  lastSuccessAt: z.date().nullable(),
  triggeredBy: z.string().min(1, 'triggeredBy is required'),
  source: z.enum(QUALITY_GATE_RUN_SOURCES),
  durationMs: z.number().int().min(0, 'durationMs must be positive'),
  remediationState: z.enum(REMEDIATION_STATES),
  incidentId: z.string().min(1).nullable().optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type SectionQualityGateResult = z.infer<typeof SectionQualityGateResultSchema>;
export type SectionQualityGateStatus = QualityGateStatus;

export const CreateSectionQualityGateResultSchema = SectionQualityGateResultSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type CreateSectionQualityGateResultInput = z.infer<
  typeof CreateSectionQualityGateResultSchema
>;

export const UpdateSectionQualityGateResultSchema = SectionQualityGateResultSchema.partial().extend(
  {
    sectionId: z.string().min(1, 'sectionId is required'),
  }
);

export type UpdateSectionQualityGateResultInput = z.infer<
  typeof UpdateSectionQualityGateResultSchema
>;

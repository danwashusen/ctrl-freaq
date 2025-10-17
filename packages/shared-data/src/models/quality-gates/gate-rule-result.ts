import { z } from 'zod';

import { QUALITY_GATE_STATUSES, type QualityGateStatus } from './status.js';

const [BLOCKER_STATUS, WARNING_STATUS, PASS_STATUS, NEUTRAL_STATUS] = QUALITY_GATE_STATUSES;

export const QualityGateStatusSchema: z.ZodType<QualityGateStatus> = z.union([
  z.literal(BLOCKER_STATUS),
  z.literal(WARNING_STATUS),
  z.literal(PASS_STATUS),
  z.literal(NEUTRAL_STATUS),
]);

export const GateRuleLocationSchema = z.object({
  path: z.string().min(1, 'location.path is required'),
  start: z.number().int().min(0, 'location.start must be >= 0'),
  end: z.number().int().min(0, 'location.end must be >= 0'),
});

export type GateRuleLocation = z.infer<typeof GateRuleLocationSchema>;

export const GateRuleResultSchema = z.object({
  ruleId: z.string().min(1, 'ruleId is required'),
  title: z.string().min(1, 'title is required'),
  severity: QualityGateStatusSchema,
  guidance: z.array(z.string().min(1, 'guidance copy must not be empty')),
  docLink: z.string().url().nullable().optional(),
  location: GateRuleLocationSchema.optional(),
  resolvedAt: z.date().nullable().optional(),
});

export type GateRuleResult = z.infer<typeof GateRuleResultSchema>;

export const QUALITY_GATE_RULE_SEVERITIES = QUALITY_GATE_STATUSES;
export type QualityGateRuleSeverity = QualityGateStatus;

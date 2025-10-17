import type { QualityGateStatus } from '@ctrl-freaq/shared-data/models/quality-gates/status';

import type { SectionQualityRuleResult } from './section-quality-runner';

export interface RemediationGuidanceLink {
  label: string;
  href: string;
}

export type RemediationBadgeVariant = 'critical' | 'warning' | 'success' | 'neutral';

export interface RemediationGuidanceCard {
  ruleId: string;
  severity: QualityGateStatus;
  summary: string;
  steps: string[];
  badgeVariant: RemediationBadgeVariant;
  docLink: RemediationGuidanceLink | null;
  location?: SectionQualityRuleResult['location'];
}

export const REMEDIATION_BADGE_VARIANT_BY_STATUS: Record<
  QualityGateStatus,
  RemediationBadgeVariant
> = {
  Blocker: 'critical',
  Warning: 'warning',
  Pass: 'success',
  Neutral: 'neutral',
};

export const DEFAULT_REMEDIATION_LINK_LABEL = 'View policy';

export function toRemediationGuidanceCard(rule: SectionQualityRuleResult): RemediationGuidanceCard {
  return {
    ruleId: rule.ruleId,
    severity: rule.severity,
    summary: rule.title,
    steps: [...rule.guidance],
    badgeVariant: REMEDIATION_BADGE_VARIANT_BY_STATUS[rule.severity],
    docLink: rule.docLink ? { label: DEFAULT_REMEDIATION_LINK_LABEL, href: rule.docLink } : null,
    location: rule.location,
  };
}

export function buildRemediationGuidance(
  rules: SectionQualityRuleResult[]
): RemediationGuidanceCard[] {
  return rules.map(toRemediationGuidanceCard);
}

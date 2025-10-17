import type { QualityGateStatus } from '@ctrl-freaq/shared-data/models/quality-gates/status';

import type { SectionQualityRuleResult } from './section-quality-runner';

export interface EvaluateSectionQualityRulesInput {
  sectionId: string;
  documentId: string;
  title: string;
  content: string;
}

const SEVERITY_WEIGHT: Record<QualityGateStatus, number> = {
  Blocker: 3,
  Warning: 2,
  Pass: 1,
  Neutral: 0,
};

const normalize = (value: string): string => value.trim();

const hasHeading = (content: string): boolean => /(^|\n)#{1,6}\s+\S/.test(content);

const includesRequestId = (content: string): boolean =>
  /\brequest[\s-]?id\b/i.test(content) || /\bx-request-id\b/i.test(content);

const requiresRiskNarrative = (sectionId: string, title: string): boolean => {
  const needle = `${sectionId} ${title}`.toLowerCase();
  return /overview|governance|compliance|risk/.test(needle);
};

const containsRiskNarrative = (content: string): boolean =>
  /\brisk\b|\bmitigation\b|\bescalation\b/i.test(content);

const computeRule = (
  ruleId: string,
  severity: QualityGateStatus,
  title: string,
  guidance: string[],
  docLink?: string | null
): SectionQualityRuleResult => ({
  ruleId,
  title,
  severity,
  guidance,
  docLink: docLink ?? null,
});

export function evaluateSectionQualityRules(
  input: EvaluateSectionQualityRulesInput
): SectionQualityRuleResult[] {
  const content = normalize(input.content ?? '');
  const rules: SectionQualityRuleResult[] = [];

  const headingPresent = hasHeading(content);
  rules.push(
    computeRule(
      'qa.section.structure.heading',
      headingPresent ? 'Pass' : 'Blocker',
      headingPresent ? 'Section introduces required headings' : 'Add a level-two heading',
      headingPresent
        ? []
        : [
            'Add at least one `##` heading summarizing the section scope.',
            'Ensure the introduction sets context for reviewers before diving into details.',
          ],
      'https://ctrl-freaq.dev/docs/quality-gates#headings'
    )
  );

  const telemetryCovered = includesRequestId(content);
  rules.push(
    computeRule(
      'qa.section.telemetry.request-id',
      telemetryCovered ? 'Pass' : 'Warning',
      telemetryCovered ? 'Request ID propagation documented' : 'Document Request ID propagation',
      telemetryCovered
        ? []
        : [
            'Mention how `Request ID` values propagate through this workflow.',
            'Include a troubleshooting note referencing telemetry dashboards.',
          ],
      'https://ctrl-freaq.dev/docs/telemetry/request-id'
    )
  );

  const riskNarrativeRequired = requiresRiskNarrative(input.sectionId, input.title);
  if (riskNarrativeRequired) {
    const riskAddressed = containsRiskNarrative(content);
    rules.push(
      computeRule(
        'qa.section.governance.risk-register',
        riskAddressed ? 'Pass' : 'Blocker',
        riskAddressed ? 'Risk posture captured' : 'Capture risk and escalation guidance',
        riskAddressed
          ? []
          : [
              'Call out active risks or mitigation steps for this section.',
              'Reference the escalation path for unresolved blockers.',
            ],
        'https://ctrl-freaq.dev/policies/risk-governance'
      )
    );
  } else {
    const minimumLength = content.replace(/\s+/g, ' ').length >= 120;
    rules.push(
      computeRule(
        'qa.section.quality.completeness',
        minimumLength ? 'Pass' : 'Warning',
        minimumLength ? 'Section meets baseline completeness' : 'Expand section narrative',
        minimumLength
          ? []
          : [
              'Add contextual paragraphs so reviewers understand the change intent.',
              'Include references to supporting documents or diagrams if available.',
            ],
        null
      )
    );
  }

  return rules.sort((a, b) => {
    const severityDelta = SEVERITY_WEIGHT[b.severity] - SEVERITY_WEIGHT[a.severity];
    if (severityDelta !== 0) {
      return severityDelta;
    }
    return a.ruleId.localeCompare(b.ruleId);
  });
}

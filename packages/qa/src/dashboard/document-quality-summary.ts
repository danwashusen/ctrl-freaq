import { maxQualityGateStatus } from '@ctrl-freaq/editor-core/quality-gates/status';
import type { QualityGateStatus } from '@ctrl-freaq/editor-core/quality-gates/status';
import type {
  CreateDocumentQualityGateSummaryInput,
  RequirementGap,
  SectionQualityGateResult,
} from '@ctrl-freaq/shared-data';

export interface AggregateDocumentQualitySummaryInput {
  documentId: string;
  sections: SectionQualityGateResult[];
  requestId: string;
  triggeredBy: string;
  completedAt: Date;
  coverageGaps?: RequirementGap[];
}

export interface AggregateDocumentQualitySummaryResult {
  summary: CreateDocumentQualityGateSummaryInput;
  overallStatus: QualityGateStatus;
}

const mapStatusToBucket = (status: QualityGateStatus) => {
  if (status === 'Blocker') {
    return 'blocker';
  }
  if (status === 'Warning') {
    return 'warning';
  }
  if (status === 'Pass') {
    return 'pass';
  }
  return 'neutral';
};

const mapCoverageGapToStatus = (gap: RequirementGap): QualityGateStatus => {
  switch (gap.reason) {
    case 'blocker':
    case 'no-link':
      return 'Blocker';
    case 'warning-override':
      return 'Warning';
    default:
      return 'Neutral';
  }
};

export function aggregateDocumentQualitySummary(
  input: AggregateDocumentQualitySummaryInput
): AggregateDocumentQualitySummaryResult {
  const counts = {
    pass: 0,
    warning: 0,
    blocker: 0,
    neutral: 0,
  };

  const blockerSections: string[] = [];
  const warningSections: string[] = [];

  input.sections.forEach(section => {
    const bucket = mapStatusToBucket(section.status);
    counts[bucket as keyof typeof counts] += 1;

    if (section.status === 'Blocker') {
      blockerSections.push(section.sectionId);
    } else if (section.status === 'Warning') {
      warningSections.push(section.sectionId);
    }
  });

  const coverageGaps = input.coverageGaps ?? [];
  const coverageGapStatuses = coverageGaps.map(mapCoverageGapToStatus);
  const publishBlocked =
    blockerSections.length > 0 || coverageGapStatuses.some(status => status === 'Blocker');

  const statusPool: QualityGateStatus[] = [
    ...input.sections.map(section => section.status),
    ...coverageGapStatuses,
  ];

  const overallStatus =
    statusPool.length > 0 ? maxQualityGateStatus(statusPool) : ('Neutral' as QualityGateStatus);

  return {
    summary: {
      documentId: input.documentId,
      statusCounts: counts,
      blockerSections,
      warningSections,
      lastRunAt: input.completedAt,
      triggeredBy: input.triggeredBy,
      requestId: input.requestId,
      publishBlocked,
      coverageGaps,
    },
    overallStatus,
  };
}

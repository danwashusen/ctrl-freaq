import type ApiClient from '@/lib/api';
import type {
  QualityGateRunAcknowledgementDTO,
  QualityGateRunSourceDTO,
  SectionQualityGateResultDTO,
  DocumentQualitySummaryDTO,
  TraceabilityRequirementDTO,
  TraceabilityAuditEventDTO,
} from '@/lib/api';

import type {
  QualityGateRunSource,
  SectionQualityRule,
  SectionQualitySnapshot,
} from '../stores/section-quality-store';
import type { DocumentCoverageGap, DocumentQualitySummary } from '../stores/document-quality-store';
import type {
  TraceabilityRequirementRow,
  TraceabilityAuditEvent,
} from '../stores/traceability-store';

type RunReason = QualityGateRunSource | undefined;

const toSectionQualityRule = (
  rule: SectionQualityGateResultDTO['rules'][number]
): SectionQualityRule => ({
  ruleId: rule.ruleId,
  title: rule.title,
  severity: rule.severity,
  guidance: [...rule.guidance],
  docLink: rule.docLink ?? null,
  location: rule.location,
});

const toQualityRunSource = (reason?: QualityGateRunSourceDTO): QualityGateRunSource => {
  if (reason === 'auto' || reason === 'manual' || reason === 'dashboard') {
    return reason;
  }
  return 'manual';
};

const toSnapshot = (dto: SectionQualityGateResultDTO): SectionQualitySnapshot => ({
  sectionId: dto.sectionId,
  documentId: dto.documentId,
  runId: dto.runId,
  status: dto.status,
  rules: dto.rules.map(toSectionQualityRule),
  lastRunAt: dto.lastRunAt,
  lastSuccessAt: dto.lastSuccessAt,
  triggeredBy: dto.triggeredBy,
  source: toQualityRunSource(dto.source),
  durationMs: dto.durationMs,
  remediationState: dto.remediationState,
  incidentId: dto.incidentId ?? null,
  createdAt: dto.createdAt,
  updatedAt: dto.updatedAt,
  requestId: dto.requestId ?? null,
});

export interface SectionRunInput {
  sectionId: string;
  documentId: string;
  reason?: RunReason;
}

export interface DocumentRunInput {
  documentId: string;
  reason?: RunReason;
}

export interface TraceabilityMatrixFetchResult {
  documentId: string;
  requirements: TraceabilityRequirementRow[];
}

export interface TraceabilityOrphanInput {
  requirementId: string;
  sectionId: string;
  reason?: 'no-link' | 'blocker' | 'warning-override';
}

export interface TraceabilityOrphanResult {
  requirementId: string;
  sectionId: string;
  coverageStatus: 'covered' | 'warning' | 'blocker' | 'orphaned';
  reason: 'no-link' | 'blocker' | 'warning-override';
  lastValidatedAt: string;
  validatedBy: string | null;
}

const toDocumentCoverageGap = (
  gap: DocumentQualitySummaryDTO['coverageGaps'][number]
): DocumentCoverageGap => ({
  requirementId: gap.requirementId,
  reason: gap.reason,
  linkedSections: [...gap.linkedSections],
});

const toDocumentSummary = (dto: DocumentQualitySummaryDTO): DocumentQualitySummary => ({
  documentId: dto.documentId,
  statusCounts: {
    pass: dto.statusCounts.pass,
    warning: dto.statusCounts.warning,
    blocker: dto.statusCounts.blocker,
    neutral: dto.statusCounts.neutral,
  },
  blockerSections: [...dto.blockerSections],
  warningSections: [...dto.warningSections],
  lastRunAt: dto.lastRunAt ?? null,
  triggeredBy: dto.triggeredBy,
  requestId: dto.requestId,
  publishBlocked: dto.publishBlocked,
  coverageGaps: dto.coverageGaps.map(toDocumentCoverageGap),
});

const toTraceabilityAuditEvent = (event: TraceabilityAuditEventDTO): TraceabilityAuditEvent => ({
  eventId: event.eventId,
  type: event.type,
  timestamp: event.timestamp,
  actorId: event.actorId,
  details: event.details ?? null,
});

const toTraceabilityRequirement = (
  dto: TraceabilityRequirementDTO
): TraceabilityRequirementRow => ({
  requirementId: dto.requirementId,
  sectionId: dto.sectionId,
  title: dto.title,
  preview: dto.preview,
  gateStatus: dto.gateStatus,
  coverageStatus: dto.coverageStatus,
  lastValidatedAt: dto.lastValidatedAt,
  validatedBy: dto.validatedBy,
  notes: dto.notes ?? [],
  revisionId: dto.revisionId,
  auditTrail: dto.auditTrail.map(toTraceabilityAuditEvent),
});

export const fetchSectionQualityResult = async (
  client: ApiClient,
  documentId: string,
  sectionId: string
): Promise<SectionQualitySnapshot> => {
  const dto = await client.getSectionQualityGate(documentId, sectionId);
  return toSnapshot(dto);
};

export const runSectionQualityGate = async (
  client: ApiClient,
  input: SectionRunInput
): Promise<QualityGateRunAcknowledgementDTO> => {
  return client.runSectionQualityGate(input.documentId, input.sectionId, {
    reason: input.reason,
  });
};

export const runDocumentQualityGate = async (
  client: ApiClient,
  input: DocumentRunInput
): Promise<QualityGateRunAcknowledgementDTO> => {
  return client.runDocumentQualityGate(input.documentId, {
    reason: input.reason,
  });
};

export const fetchTraceabilityMatrix = async (
  client: ApiClient,
  documentId: string
): Promise<TraceabilityMatrixFetchResult> => {
  const dto = await client.getDocumentTraceability(documentId);
  return {
    documentId: dto.documentId,
    requirements: dto.requirements.map(toTraceabilityRequirement),
  };
};

export const markTraceabilityRequirementOrphaned = async (
  client: ApiClient,
  documentId: string,
  input: TraceabilityOrphanInput
): Promise<TraceabilityOrphanResult> => {
  const dto = await client.markTraceabilityRequirementOrphaned(documentId, input);
  return {
    requirementId: dto.requirementId,
    sectionId: dto.sectionId,
    coverageStatus: dto.coverageStatus,
    reason: dto.reason,
    lastValidatedAt: dto.lastValidatedAt,
    validatedBy: dto.validatedBy ?? null,
  };
};

export const fetchDocumentQualitySummary = async (
  client: ApiClient,
  documentId: string
): Promise<DocumentQualitySummary> => {
  const dto = await client.getDocumentQualityGateSummary(documentId);
  return toDocumentSummary(dto);
};

export const mapRunReason = (reason?: RunReason): QualityGateRunSourceDTO | undefined => {
  if (!reason) {
    return undefined;
  }
  return reason;
};

export const createSnapshotFromResult = toSnapshot;

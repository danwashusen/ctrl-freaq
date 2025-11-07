import type {
  ProjectDocumentSnapshot,
  ProjectDocumentSummary,
  TemplateBinding,
  TemplateValidationDecision,
} from '@ctrl-freaq/shared-data';

export type TemplateValidationDecisionResponse = {
  decisionId: string;
  action: TemplateValidationDecision['action'];
  templateId: string;
  currentVersion: string;
  requestedVersion: string;
  submittedAt: string;
  submittedBy?: string;
  notes: string | null;
};

export type ProjectDocumentSummaryResponse = {
  documentId: string;
  firstSectionId: string;
  title: string;
  lifecycleStatus: ProjectDocumentSummary['lifecycleStatus'];
  lastModifiedAt: string;
  template?: TemplateBinding;
};

export type PrimaryDocumentSnapshotResponse = {
  projectId: string;
  status: ProjectDocumentSnapshot['status'];
  document: ProjectDocumentSummaryResponse | null;
  templateDecision: TemplateValidationDecisionResponse | null;
  lastUpdatedAt: string;
};

export function serializeTemplateValidationDecision(
  decision: TemplateValidationDecision | null
): TemplateValidationDecisionResponse | null {
  if (!decision) {
    return null;
  }

  return {
    decisionId: decision.decisionId,
    action: decision.action,
    templateId: decision.templateId,
    currentVersion: decision.currentVersion,
    requestedVersion: decision.requestedVersion,
    submittedAt: decision.submittedAt,
    submittedBy: decision.submittedBy,
    notes: decision.notes ?? null,
  };
}

export function serializeProjectDocumentSummary(
  summary: ProjectDocumentSummary | null
): ProjectDocumentSummaryResponse | null {
  if (!summary) {
    return null;
  }

  const response: ProjectDocumentSummaryResponse = {
    documentId: summary.documentId,
    firstSectionId: summary.firstSectionId,
    title: summary.title,
    lifecycleStatus: summary.lifecycleStatus,
    lastModifiedAt: summary.lastModifiedAt,
  };

  if (summary.template) {
    response.template = { ...summary.template };
  }

  return response;
}

export function serializePrimaryDocumentSnapshot(
  snapshot: ProjectDocumentSnapshot
): PrimaryDocumentSnapshotResponse {
  return {
    projectId: snapshot.projectId,
    status: snapshot.status,
    document: serializeProjectDocumentSummary(snapshot.document),
    templateDecision: serializeTemplateValidationDecision(snapshot.templateDecision),
    lastUpdatedAt: snapshot.lastUpdatedAt,
  };
}

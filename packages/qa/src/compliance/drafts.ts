export interface ComplianceLogger {
  warn(payload: Record<string, unknown>, message?: string): void;
}

export interface DraftComplianceWarning {
  projectId: string;
  projectSlug: string;
  documentSlug: string;
  authorId: string;
  policyId: string;
  detectedAt: Date;
  context?: Record<string, string>;
}

export function formatDraftComplianceWarning(
  warning: DraftComplianceWarning
): Record<string, unknown> {
  return {
    event: 'draft.compliance.warning',
    projectId: warning.projectId,
    projectSlug: warning.projectSlug,
    documentSlug: warning.documentSlug,
    authorId: warning.authorId,
    policyId: warning.policyId,
    detectedAt: warning.detectedAt.toISOString(),
    context: warning.context ?? {},
  };
}

export function logDraftComplianceWarning(
  logger: ComplianceLogger,
  warning: DraftComplianceWarning
): void {
  const payload = formatDraftComplianceWarning(warning);
  logger.warn(payload, 'Draft retention policy warning recorded');
}

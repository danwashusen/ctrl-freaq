export interface DraftConflictDetails {
  sectionPath: string;
  message: string;
  detectedAt: string;
  policyId?: string;
}

export function formatDraftConflictNotification(conflict: DraftConflictDetails): string {
  const timestamp = new Date(conflict.detectedAt).toLocaleTimeString();
  const policySegment = conflict.policyId ? ` (policy ${conflict.policyId})` : '';
  return `[${timestamp}] ${conflict.sectionPath}${policySegment}: ${conflict.message}`;
}

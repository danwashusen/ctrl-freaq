import ApiClient, { type ApiClientOptions } from '@/lib/api';

export interface DraftSectionSubmission {
  draftKey: string;
  sectionPath: string;
  patch: string;
  baselineVersion: string;
  qualityGateReport: {
    status: 'pass' | 'fail';
    issues: Array<{
      gateId: string;
      severity: 'blocker' | 'warning';
      message: string;
    }>;
  };
}

export interface DraftBundleRequest {
  submittedBy: string;
  sections: DraftSectionSubmission[];
}

export interface DraftBundleResponse {
  documentId: string;
  appliedSections: string[];
}

export interface DraftComplianceRequest {
  authorId: string;
  policyId: string;
  detectedAt: string;
  context?: Record<string, string>;
}

export interface DraftComplianceResponse {
  status: 'queued';
  warningId: string;
}

export class DraftPersistenceClient extends ApiClient {
  constructor(options?: ApiClientOptions) {
    super(options);
  }

  async applyDraftBundle(
    projectSlug: string,
    documentId: string,
    payload: DraftBundleRequest
  ): Promise<DraftBundleResponse> {
    return this.makeRequest<DraftBundleResponse>(
      `/projects/${projectSlug}/documents/${documentId}/draft-bundle`,
      {
        method: 'PATCH',
        body: JSON.stringify(payload),
      }
    );
  }

  async logComplianceWarning({
    projectSlug,
    documentId,
    payload,
  }: {
    projectSlug: string;
    documentId: string;
    payload: DraftComplianceRequest;
  }): Promise<DraftComplianceResponse> {
    return this.makeRequest<DraftComplianceResponse>(
      `/projects/${projectSlug}/documents/${documentId}/draft-compliance`,
      {
        method: 'POST',
        body: JSON.stringify(payload),
      }
    );
  }
}

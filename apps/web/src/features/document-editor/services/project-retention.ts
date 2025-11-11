import ApiClient from '@/lib/api';
import { createDocumentEditorApiClientOptions } from '@/lib/document-editor-client-config';

export interface ProjectRetentionPolicy {
  policyId: string;
  retentionWindow: string;
  guidance: string;
}

class ProjectRetentionClient extends ApiClient {
  constructor() {
    super(createDocumentEditorApiClientOptions());
  }

  async getRetentionPolicy(projectSlug: string): Promise<ProjectRetentionPolicy | null> {
    if (!projectSlug) {
      return null;
    }

    try {
      return await this.makeRequest<ProjectRetentionPolicy>(`/projects/${projectSlug}/retention`);
    } catch (error) {
      if (
        error instanceof Error &&
        'status' in error &&
        (error as { status?: number }).status === 404
      ) {
        return null;
      }
      throw error;
    }
  }
}

let cachedClient: ProjectRetentionClient | null = null;

const getProjectRetentionClient = (): ProjectRetentionClient => {
  if (!cachedClient) {
    cachedClient = new ProjectRetentionClient();
  }
  return cachedClient;
};

export async function fetchProjectRetentionPolicy(
  projectSlug: string
): Promise<ProjectRetentionPolicy | null> {
  return getProjectRetentionClient().getRetentionPolicy(projectSlug);
}

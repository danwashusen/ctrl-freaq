import ApiClient from '@/lib/api';

export interface ProjectRetentionPolicy {
  policyId: string;
  retentionWindow: string;
  guidance: string;
}

class ProjectRetentionClient extends ApiClient {
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

const client = new ProjectRetentionClient();

export async function fetchProjectRetentionPolicy(
  projectSlug: string
): Promise<ProjectRetentionPolicy | null> {
  return client.getRetentionPolicy(projectSlug);
}

export interface ProjectRetentionFixture {
  projectId: string;
  projectSlug: string;
  policyId: string;
  retentionWindow: string;
  description: string;
}

export const demoProjectRetention: ProjectRetentionFixture = {
  projectId: '11111111-2222-4333-8444-555555555555',
  projectSlug: 'project-test',
  policyId: 'retention-client-only',
  retentionWindow: '30d',
  description: 'Fixtures queue a compliance warning when drafts exceed client-only retention.',
};

export interface ProjectRetentionFixture {
  projectSlug: string;
  policyId: string;
  retentionWindow: string;
  description: string;
}

export const demoProjectRetention: ProjectRetentionFixture = {
  projectSlug: 'project-test',
  policyId: 'retention-client-only',
  retentionWindow: '30d',
  description: 'Fixtures queue a compliance warning when drafts exceed client-only retention.',
};

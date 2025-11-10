export interface ProjectRetentionFixture {
  projectId: string;
  projectSlug: string;
  policyId: string;
  retentionWindow: string;
  guidance: string;
}

export const demoProjectRetention: ProjectRetentionFixture = {
  projectId: '11111111-2222-4333-8444-555555555555',
  projectSlug: 'project-test',
  policyId: 'retention-client-only',
  retentionWindow: '30d',
  guidance:
    'Client-only drafts must be reviewed within 30 days or escalated to compliance storage.',
};

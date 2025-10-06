export interface RetentionPolicyFixture {
  projectSlug: string;
  policyId: string;
  retentionWindow: string;
  guidance: string;
}

const retentionPolicies: Record<string, RetentionPolicyFixture> = {
  'project-test': {
    projectSlug: 'project-test',
    policyId: 'retention-client-only',
    retentionWindow: '30d',
    guidance:
      'Client-only drafts must be reviewed within 30 days or escalated to compliance storage.',
  },
};

export function getProjectRetentionPolicy(projectSlug: string): RetentionPolicyFixture | null {
  return retentionPolicies[projectSlug] ?? null;
}

export function listRetentionPolicies(): RetentionPolicyFixture[] {
  return Object.values(retentionPolicies);
}

export default retentionPolicies;

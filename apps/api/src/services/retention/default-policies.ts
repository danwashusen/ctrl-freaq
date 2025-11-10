import type { Logger } from 'pino';

import type { ProjectRepository, ProjectRetentionPolicyRepository } from '@ctrl-freaq/shared-data';

const SYSTEM_ACTOR = 'system';

export interface RetentionPolicyTemplate {
  policyId: string;
  retentionWindow: string;
  guidance: string;
}

export interface RetentionPolicySeed extends RetentionPolicyTemplate {
  projectSlug: string;
}

export interface BootstrapRetentionPoliciesOptions {
  projectRepository: ProjectRepository;
  retentionRepository: ProjectRetentionPolicyRepository;
  logger?: Logger;
  seeds?: ReadonlyArray<RetentionPolicySeed>;
}

export const DEFAULT_RETENTION_POLICY_TEMPLATE: RetentionPolicyTemplate = {
  policyId: 'retention-client-only',
  retentionWindow: '30d',
  guidance:
    'Client-only drafts must be reviewed within 30 days or escalated to compliance storage.',
};

export const DEFAULT_RETENTION_POLICY_SEEDS: ReadonlyArray<RetentionPolicySeed> = [
  {
    projectSlug: 'project-test',
    ...DEFAULT_RETENTION_POLICY_TEMPLATE,
  },
];

export function createDefaultRetentionPolicyTemplate(): RetentionPolicyTemplate {
  return { ...DEFAULT_RETENTION_POLICY_TEMPLATE };
}

export async function bootstrapRetentionPolicies({
  projectRepository,
  retentionRepository,
  logger,
  seeds = DEFAULT_RETENTION_POLICY_SEEDS,
}: BootstrapRetentionPoliciesOptions): Promise<void> {
  for (const seed of seeds) {
    try {
      const project = await projectRepository.findBySlug(seed.projectSlug);
      if (!project) {
        logger?.debug(
          {
            projectSlug: seed.projectSlug,
          },
          'Skipping retention policy bootstrap: project slug not found'
        );
        continue;
      }

      await retentionRepository.upsertDefault(project.id, {
        policyId: seed.policyId,
        retentionWindow: seed.retentionWindow,
        guidance: seed.guidance,
        createdBy: SYSTEM_ACTOR,
        updatedBy: SYSTEM_ACTOR,
      });

      logger?.debug(
        {
          projectSlug: seed.projectSlug,
          projectId: project.id,
          policyId: seed.policyId,
        },
        'Retention policy seeded'
      );
    } catch (error) {
      logger?.error(
        {
          projectSlug: seed.projectSlug,
          error: error instanceof Error ? error.message : String(error),
        },
        'Failed to bootstrap retention policy'
      );
    }
  }
}

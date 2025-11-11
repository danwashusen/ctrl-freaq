import { z } from 'zod';

const RETENTION_WINDOW_MAX_LENGTH = 120;
const POLICY_ID_MAX_LENGTH = 120;
const GUIDANCE_MAX_LENGTH = 2000;

/**
 * Project retention policy entity schema.
 *
 * Stores the retention window metadata and policy guidance associated with
 * a specific project. Persistence uses project IDs internally while API
 * consumers continue to reference projects by slug.
 */
export const ProjectRetentionPolicySchema = z.object({
  id: z.string().uuid('Invalid retention policy ID format'),
  projectId: z.string().uuid('Invalid project ID format'),
  policyId: z
    .string()
    .min(1, 'Policy identifier is required')
    .max(POLICY_ID_MAX_LENGTH, 'Policy identifier too long'),
  retentionWindow: z
    .string()
    .min(1, 'Retention window is required')
    .max(RETENTION_WINDOW_MAX_LENGTH, 'Retention window too long'),
  guidance: z
    .string()
    .min(1, 'Policy guidance is required')
    .max(GUIDANCE_MAX_LENGTH, 'Policy guidance too long'),
  createdAt: z.date(),
  createdBy: z.string().min(1, 'Created by is required'),
  updatedAt: z.date(),
  updatedBy: z.string().min(1, 'Updated by is required'),
});

export type ProjectRetentionPolicy = z.infer<typeof ProjectRetentionPolicySchema>;

export const CreateProjectRetentionPolicySchema = ProjectRetentionPolicySchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type CreateProjectRetentionPolicyInput = z.infer<typeof CreateProjectRetentionPolicySchema>;

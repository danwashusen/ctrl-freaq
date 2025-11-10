import { randomUUID } from 'node:crypto';

import Database from 'better-sqlite3';

import { BaseRepository } from './base-repository.js';
import {
  ProjectRetentionPolicySchema,
  type ProjectRetentionPolicy,
} from '../models/project-retention-policy.js';
import type { Repository } from '../types/index.js';

export interface ProjectRetentionPolicyDefaults {
  policyId: string;
  retentionWindow: string;
  guidance: string;
  createdBy: string;
  updatedBy: string;
}

export interface ProjectRetentionPolicyRepository extends Repository<ProjectRetentionPolicy> {
  findByProjectId(projectId: string): Promise<ProjectRetentionPolicy | null>;
  upsertDefault(
    projectId: string,
    defaults: ProjectRetentionPolicyDefaults
  ): Promise<ProjectRetentionPolicy>;
}

export class ProjectRetentionPolicyRepositoryImpl
  extends BaseRepository<ProjectRetentionPolicy>
  implements ProjectRetentionPolicyRepository
{
  constructor(db: Database.Database) {
    super(db, 'project_retention_policies', ProjectRetentionPolicySchema);
  }

  async findByProjectId(projectId: string): Promise<ProjectRetentionPolicy | null> {
    const stmt = this.db.prepare(
      `SELECT * FROM ${this.tableName}
       WHERE project_id = ?`
    );
    const row = stmt.get(projectId) as Record<string, unknown> | undefined;

    if (!row) {
      return null;
    }

    return this.mapRowToEntity(row);
  }

  async upsertDefault(
    projectId: string,
    defaults: ProjectRetentionPolicyDefaults
  ): Promise<ProjectRetentionPolicy> {
    const now = new Date().toISOString();
    const stmt = this.db.prepare(
      `INSERT INTO ${this.tableName} (
         id,
         project_id,
         policy_id,
         retention_window,
         guidance,
         created_at,
         created_by,
         updated_at,
         updated_by
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(project_id) DO UPDATE SET
         policy_id = excluded.policy_id,
         retention_window = excluded.retention_window,
         guidance = excluded.guidance,
         updated_at = excluded.updated_at,
         updated_by = excluded.updated_by
       RETURNING *`
    );

    const row = stmt.get(
      randomUUID(),
      projectId,
      defaults.policyId,
      defaults.retentionWindow,
      defaults.guidance,
      now,
      defaults.createdBy,
      now,
      defaults.updatedBy
    ) as Record<string, unknown>;

    return this.mapRowToEntity(row);
  }
}

import Database from 'better-sqlite3';
import { beforeEach, describe, expect, it } from 'vitest';

import { ProjectRetentionPolicyRepositoryImpl } from './project-retention-policy.repository.js';

const PROJECT_ID = '00000000-0000-4000-8000-000000000001';

function setupDb() {
  const db = new Database(':memory:');
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.exec(`
    CREATE TABLE projects (
      id TEXT PRIMARY KEY,
      owner_user_id TEXT NOT NULL,
      name TEXT NOT NULL,
      slug TEXT NOT NULL,
      created_at TEXT NOT NULL,
      created_by TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      updated_by TEXT NOT NULL
    );

    CREATE TABLE project_retention_policies (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL UNIQUE,
      policy_id TEXT NOT NULL,
      retention_window TEXT NOT NULL,
      guidance TEXT NOT NULL,
      created_at TEXT NOT NULL,
      created_by TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      updated_by TEXT NOT NULL,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );
  `);
  db.prepare(
    `INSERT INTO projects (
       id, owner_user_id, name, slug, created_at, created_by, updated_at, updated_by
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    PROJECT_ID,
    'user_author',
    'Demo Project',
    'project-demo',
    new Date().toISOString(),
    'user_author',
    new Date().toISOString(),
    'user_author'
  );
  return db;
}

describe('ProjectRetentionPolicyRepository', () => {
  let db: Database.Database;
  let repository: ProjectRetentionPolicyRepositoryImpl;

  beforeEach(() => {
    db = setupDb();
    repository = new ProjectRetentionPolicyRepositoryImpl(db);
  });

  it('returns null when a policy does not exist for the project', async () => {
    const result = await repository.findByProjectId(PROJECT_ID);
    expect(result).toBeNull();
  });

  it('creates a retention policy with upsertDefault when missing', async () => {
    const created = await repository.upsertDefault(PROJECT_ID, {
      policyId: 'retention-client-only',
      retentionWindow: '30d',
      guidance: 'Client-only drafts must be reviewed within 30 days.',
      createdBy: 'system',
      updatedBy: 'system',
    });

    expect(created.projectId).toBe(PROJECT_ID);
    expect(created.policyId).toBe('retention-client-only');
    expect(created.retentionWindow).toBe('30d');
    expect(created.guidance).toContain('30 days.');

    const fetched = await repository.findByProjectId(PROJECT_ID);
    expect(fetched?.id).toBe(created.id);
  });

  it('updates an existing policy while preserving creation metadata', async () => {
    const initial = await repository.upsertDefault(PROJECT_ID, {
      policyId: 'retention-client-only',
      retentionWindow: '30d',
      guidance: 'Initial guidance',
      createdBy: 'seed_actor',
      updatedBy: 'seed_actor',
    });

    const updated = await repository.upsertDefault(PROJECT_ID, {
      policyId: 'retention-expanded',
      retentionWindow: '45d',
      guidance: 'Updated guidance with extended window.',
      createdBy: 'should_not_overwrite',
      updatedBy: 'system',
    });

    expect(updated.id).toBe(initial.id);
    expect(updated.policyId).toBe('retention-expanded');
    expect(updated.retentionWindow).toBe('45d');
    expect(updated.guidance).toContain('extended window');
    expect(updated.createdBy).toBe('seed_actor');
    expect(updated.updatedBy).toBe('system');
    expect(updated.updatedAt.getTime()).toBeGreaterThanOrEqual(initial.updatedAt.getTime());
  });
});

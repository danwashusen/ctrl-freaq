import Database from 'better-sqlite3';
import { beforeEach, describe, expect, it } from 'vitest';

// Explicitly import from .ts to avoid stale compiled JS in src
import {
  PROJECT_CONSTANTS,
  ProjectRepositoryImpl,
  ProjectUtils,
  validateCreateProject,
  type CreateProjectInput,
  type Project,
} from '../models/project';

function setupDb() {
  const db = new Database(':memory:');
  db.pragma('journal_mode = WAL');
  db.exec(`
    CREATE TABLE projects (
      id TEXT PRIMARY KEY,
      owner_user_id TEXT NOT NULL,
      name TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      description TEXT,
      visibility TEXT NOT NULL DEFAULT 'workspace',
      status TEXT NOT NULL DEFAULT 'draft',
      archived_status_before TEXT,
      goal_target_date TEXT,
      goal_summary TEXT,
      created_at TEXT NOT NULL,
      created_by TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      updated_by TEXT NOT NULL,
      deleted_at TEXT,
      deleted_by TEXT
    );
  `);
  return db;
}

type CreateProjectOverrides = Partial<CreateProjectInput> & Record<string, unknown>;

function makeCreateInput(overrides: CreateProjectOverrides = {}): CreateProjectInput {
  const base = validateCreateProject({
    ownerUserId: 'user_123',
    name: 'Alpha',
    slug: ProjectUtils.generateSlug('Alpha'),
    description: 'Test project',
    createdBy: 'user_123',
    updatedBy: 'user_123',
  }) as CreateProjectInput;

  return {
    ...base,
    ...(overrides as Partial<CreateProjectInput>),
  };
}

function getProjectById(db: Database.Database, id: string): Project | null {
  const row = db
    .prepare(
      `SELECT id, owner_user_id as ownerUserId, name, slug, description, visibility,
              status, archived_status_before as archivedStatusBefore,
              goal_target_date as goalTargetDate, goal_summary as goalSummary,
              created_at as createdAt, created_by as createdBy, updated_at as updatedAt,
              updated_by as updatedBy, deleted_at as deletedAt, deleted_by as deletedBy
       FROM projects WHERE id = ?`
    )
    .get(id) as Record<string, unknown> | undefined;
  if (!row) return null;

  return {
    ...row,
    archivedStatusBefore:
      'archivedStatusBefore' in row && row.archivedStatusBefore != null
        ? String(row.archivedStatusBefore)
        : null,
    goalTargetDate: row.goalTargetDate ? new Date(String(row.goalTargetDate)) : null,
    createdAt: new Date(String(row.createdAt)),
    updatedAt: new Date(String(row.updatedAt)),
    deletedAt: row.deletedAt ? new Date(String(row.deletedAt)) : null,
  } as Project;
}

describe('ProjectRepository', () => {
  let db: Database.Database;
  let repo: ProjectRepositoryImpl;

  beforeEach(() => {
    db = setupDb();
    repo = new ProjectRepositoryImpl(db);
  });

  it('returns null when user has no project', async () => {
    const result = await repo.findByUserId('user_none');
    expect(result).toBeNull();
    const count = await repo.countByUserId('user_none');
    expect(count).toBe(0);
  });

  it('creates and retrieves a project for a user', async () => {
    const userId = 'user_123';
    const input = makeCreateInput({
      ownerUserId: userId,
      name: 'Alpha',
      slug: ProjectUtils.generateSlug('Alpha'),
    });
    const created = await repo.create(input);
    expect(created.id).toBeTruthy();

    const fetched = await repo.findByUserId(userId);
    expect(fetched?.id).toBe(created.id);
    expect(fetched?.name).toBe('Alpha');
    expect(fetched?.createdBy).toBe(userId);
    expect(fetched?.updatedBy).toBe(userId);
    expect(fetched?.status).toBe('draft');
    expect(fetched?.visibility).toBe('workspace');
    expect(fetched?.goalTargetDate).toBeNull();
    expect(fetched?.goalSummary).toBeNull();

    const count = await repo.countByUserId(userId);
    expect(count).toBe(1);
  });

  it('findByUserIdWithMembers returns same project in MVP', async () => {
    const userId = 'user_mvp';
    const input = makeCreateInput({
      ownerUserId: userId,
      name: 'Bravo',
      slug: ProjectUtils.generateSlug('Bravo'),
      visibility: 'private',
      status: 'active',
      goalTargetDate: new Date('2025-12-01T00:00:00.000Z'),
      goalSummary: 'Document the lifecycle work',
      createdBy: userId,
      updatedBy: userId,
    });
    const created = await repo.create(input);

    const fetched = await repo.findByUserIdWithMembers(userId);
    expect(fetched?.id).toBe(created.id);
    expect(fetched?.name).toBe('Bravo');
    expect(fetched?.status).toBe('active');
    expect(fetched?.goalTargetDate?.toISOString()).toBe('2025-12-01T00:00:00.000Z');
    expect(fetched?.goalSummary).toBe('Document the lifecycle work');
  });

  it('allows multiple projects per user', async () => {
    const userId = 'user_multi';
    const first = await repo.create(
      makeCreateInput({
        ownerUserId: userId,
        name: 'First',
        slug: ProjectUtils.generateSlug('First'),
      })
    );
    const second = await repo.create(
      makeCreateInput({
        ownerUserId: userId,
        name: 'Second',
        slug: ProjectUtils.generateSlug('Second'),
      })
    );

    expect(first.id).not.toBe(second.id);
    const all = await repo.findAll({ where: { owner_user_id: userId } });
    expect(all).toHaveLength(2);
    const count = await repo.countByUserId(userId);
    expect(count).toBe(2);
  });

  it('restores legacy archived projects missing pre-archive snapshot using fallback status', async () => {
    const legacyId = '00000000-0000-4000-8000-000000000099';
    const archivedAt = new Date('2024-09-15T12:00:00.000Z').toISOString();
    const createdAt = new Date('2024-01-01T00:00:00.000Z').toISOString();

    db.prepare(
      `INSERT INTO projects (
        id, owner_user_id, name, slug, description, visibility, status, archived_status_before,
        goal_target_date, goal_summary, created_at, created_by, updated_at, updated_by,
        deleted_at, deleted_by
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      legacyId,
      'legacy_owner',
      'Legacy Archived Project',
      'legacy-archived-project',
      'Project archived before lifecycle snapshot existed',
      'workspace',
      'archived',
      null,
      null,
      null,
      createdAt,
      'legacy_owner',
      archivedAt,
      'legacy_owner',
      archivedAt,
      'system'
    );

    const legacy = await repo.findByIdIncludingArchived(legacyId);
    expect(legacy?.status).toBe('archived');
    expect(legacy?.archivedStatusBefore).toBe(PROJECT_CONSTANTS.RESTORED_STATUS);
    expect(legacy?.deletedAt?.toISOString()).toBe(archivedAt);

    const restored = await repo.restoreProject(legacyId, 'restorer_123');
    expect(restored.status).toBe(PROJECT_CONSTANTS.RESTORED_STATUS);
    expect(restored.archivedStatusBefore).toBeNull();
    expect(restored.deletedAt).toBeNull();
    expect(restored.deletedBy).toBeNull();

    const restoredRow = getProjectById(db, legacyId);
    expect(restoredRow?.status).toBe(PROJECT_CONSTANTS.RESTORED_STATUS);
    expect(restoredRow?.archivedStatusBefore).toBeNull();
    expect(restoredRow?.deletedAt).toBeNull();
    expect(restoredRow?.deletedBy).toBeNull();
  });

  it('archives and restores project lifecycle metadata', async () => {
    const creator = 'owner_123';
    const project = await repo.create(
      makeCreateInput({
        ownerUserId: creator,
        name: 'Archivable',
        slug: ProjectUtils.generateSlug('Archivable'),
        visibility: 'workspace',
        status: 'active',
      })
    );

    const archived = await repo.archiveProject(project.id, 'archiver_456');
    expect(archived.status).toBe('archived');
    expect(archived.deletedAt).toBeInstanceOf(Date);
    expect(archived.deletedBy).toBe('archiver_456');
    expect(await repo.findById(project.id)).toBeNull();

    const archivedRow = getProjectById(db, project.id);
    expect(archivedRow?.status).toBe('archived');
    expect(archivedRow?.archivedStatusBefore).toBe('active');
    expect(archivedRow?.deletedBy).toBe('archiver_456');

    const restored = await repo.restoreProject(project.id, 'restorer_789');
    expect(restored.status).toBe('active');
    expect(restored.deletedAt).toBeNull();
    expect(restored.deletedBy).toBeNull();
    expect(restored.updatedBy).toBe('restorer_789');

    const restoredRow = getProjectById(db, project.id);
    expect(restoredRow?.status).toBe('active');
    expect(restoredRow?.deletedAt).toBeNull();
    expect(restoredRow?.archivedStatusBefore).toBeNull();
  });
});

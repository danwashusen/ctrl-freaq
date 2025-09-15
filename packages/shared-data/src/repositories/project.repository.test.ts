import Database from 'better-sqlite3';
import { describe, it, expect, beforeEach } from 'vitest';

// Explicitly import from .ts to avoid stale compiled JS in src
import { ProjectRepositoryImpl, ProjectUtils, type CreateProjectInput } from '../models/project';

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
    const input: CreateProjectInput = {
      ownerUserId: userId,
      name: 'Alpha',
      slug: ProjectUtils.generateSlug('Alpha'),
      description: 'Test project',
      createdBy: userId,
      updatedBy: userId,
    };
    const created = await repo.create(input);
    expect(created.id).toBeTruthy();

    const fetched = await repo.findByUserId(userId);
    expect(fetched?.id).toBe(created.id);
    expect(fetched?.name).toBe('Alpha');
    expect(fetched?.createdBy).toBe(userId);
    expect(fetched?.updatedBy).toBe(userId);

    const count = await repo.countByUserId(userId);
    expect(count).toBe(1);
  });

  it('findByUserIdWithMembers returns same project in MVP', async () => {
    const userId = 'user_mvp';
    const input: CreateProjectInput = {
      ownerUserId: userId,
      name: 'Bravo',
      slug: ProjectUtils.generateSlug('Bravo'),
      description: null,
      createdBy: userId,
      updatedBy: userId,
    };
    const created = await repo.create(input);

    const fetched = await repo.findByUserIdWithMembers(userId);
    expect(fetched?.id).toBe(created.id);
    expect(fetched?.name).toBe('Bravo');
  });

  it('enforces one project per user (MVP)', async () => {
    const userId = 'user_1';
    await repo.create({
      ownerUserId: userId,
      name: 'First',
      slug: ProjectUtils.generateSlug('First'),
      description: null,
      createdBy: userId,
      updatedBy: userId,
    });

    await expect(
      repo.create({
        ownerUserId: userId,
        name: 'Second',
        slug: ProjectUtils.generateSlug('Second'),
        description: null,
        createdBy: userId,
        updatedBy: userId,
      })
    ).rejects.toThrow();
  });
});

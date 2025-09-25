import Database from 'better-sqlite3';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { DraftConflictLogRepositoryImpl } from './draft-conflict-log.repository';

const SECTION_ID = 'f8fac19f-6ab3-4a7b-90e9-73720c81bc01';
const DRAFT_ID = '2c6d4102-464a-4cc9-bd5b-c227788f18b8';
const AUTHOR_ID = 'e4ff5d31-6883-4f0a-a371-5557bb5f68de';
const REVIEWER_ID = 'ea2f931f-bf8b-41cf-93fb-30e16c675e11';

function createDatabase(): Database.Database {
  const db = new Database(':memory:');
  db.pragma('journal_mode = WAL');
  db.exec(
    `CREATE TABLE draft_conflict_logs (
        id TEXT PRIMARY KEY,
        section_id TEXT NOT NULL,
        draft_id TEXT NOT NULL,
        detected_at TEXT NOT NULL,
        detected_during TEXT NOT NULL,
        previous_approved_version INTEGER NOT NULL,
        latest_approved_version INTEGER NOT NULL,
        resolved_by TEXT,
        resolution_note TEXT,
        created_at TEXT NOT NULL,
        created_by TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        updated_by TEXT NOT NULL,
        deleted_at TEXT,
        deleted_by TEXT
      );`
  );
  return db;
}

describe('DraftConflictLogRepositoryImpl', () => {
  let db: Database.Database;
  let repository: DraftConflictLogRepositoryImpl;

  beforeEach(() => {
    db = createDatabase();
    repository = new DraftConflictLogRepositoryImpl(db);
  });

  afterEach(() => {
    db.close();
  });

  it('records conflict events and lists them by draft in reverse chronological order', async () => {
    const earlier = await repository.createLogEntry(
      {
        sectionId: SECTION_ID,
        draftId: DRAFT_ID,
        detectedAt: new Date('2025-03-04T10:00:00.000Z'),
        detectedDuring: 'entry',
        previousApprovedVersion: 2,
        latestApprovedVersion: 3,
        resolvedBy: null,
        resolutionNote: null,
      },
      AUTHOR_ID
    );

    const later = await repository.createLogEntry(
      {
        sectionId: SECTION_ID,
        draftId: DRAFT_ID,
        detectedAt: new Date('2025-03-04T12:30:00.000Z'),
        detectedDuring: 'save',
        previousApprovedVersion: 3,
        latestApprovedVersion: 5,
        resolvedBy: null,
        resolutionNote: null,
      },
      AUTHOR_ID
    );

    const logs = await repository.listByDraft(DRAFT_ID);
    expect(logs.map(log => log.id)).toEqual([later.id, earlier.id]);
    expect(logs[0].latestApprovedVersion).toBe(5);
  });

  it('resolves conflict entries with reviewer metadata', async () => {
    const entry = await repository.createLogEntry(
      {
        sectionId: SECTION_ID,
        draftId: DRAFT_ID,
        detectedAt: new Date('2025-03-05T08:15:00.000Z'),
        detectedDuring: 'save',
        previousApprovedVersion: 4,
        latestApprovedVersion: 6,
        resolvedBy: null,
        resolutionNote: null,
      },
      AUTHOR_ID
    );

    const resolved = await repository.resolveLogEntry(
      entry.id,
      {
        id: entry.id,
        resolvedBy: 'auto_rebase',
        resolutionNote: 'Server rebased draft to v6',
      },
      REVIEWER_ID
    );

    expect(resolved.resolvedBy).toBe('auto_rebase');
    expect(resolved.resolutionNote).toBe('Server rebased draft to v6');
    expect(resolved.updatedBy).toBe(REVIEWER_ID);
  });

  it('soft deletes conflict logs and hides them from listings', async () => {
    const entry = await repository.createLogEntry(
      {
        sectionId: SECTION_ID,
        draftId: DRAFT_ID,
        detectedAt: new Date('2025-03-06T09:45:00.000Z'),
        detectedDuring: 'entry',
        previousApprovedVersion: 5,
        latestApprovedVersion: 7,
        resolvedBy: null,
        resolutionNote: null,
      },
      AUTHOR_ID
    );

    await repository.deleteLogEntry(entry.id, REVIEWER_ID);

    const logsAfterDelete = await repository.listByDraft(DRAFT_ID);
    expect(logsAfterDelete).toHaveLength(0);

    const record = db
      .prepare(
        'SELECT deleted_at as deletedAt, deleted_by as deletedBy FROM draft_conflict_logs WHERE id = ?'
      )
      .get(entry.id) as { deletedAt: string | null; deletedBy: string | null } | undefined;
    expect(record?.deletedAt).toBeTruthy();
    expect(record?.deletedBy).toBe(REVIEWER_ID);
  });
});

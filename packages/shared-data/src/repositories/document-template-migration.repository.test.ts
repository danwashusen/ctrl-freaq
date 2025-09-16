import Database from 'better-sqlite3';
import { beforeEach, describe, expect, it } from 'vitest';

import {
  DocumentTemplateMigrationRepositoryImpl,
  DocumentTemplateMigrationStatus,
} from '../models/document-template-migration';

function setupDb() {
  const db = new Database(':memory:');
  db.pragma('journal_mode = WAL');
  db.exec(`
    CREATE TABLE document_template_migrations (
      id TEXT PRIMARY KEY,
      document_id TEXT NOT NULL,
      from_version TEXT NOT NULL,
      to_version TEXT NOT NULL,
      status TEXT NOT NULL,
      validation_errors TEXT,
      initiated_by TEXT NOT NULL,
      initiated_at TEXT NOT NULL,
      completed_at TEXT
    );
  `);
  return db;
}

describe('DocumentTemplateMigrationRepositoryImpl', () => {
  let db: Database.Database;
  let repo: DocumentTemplateMigrationRepositoryImpl;
  const documentId = 'doc_123';

  beforeEach(() => {
    db = setupDb();
    repo = new DocumentTemplateMigrationRepositoryImpl(db);
  });

  it('records pending migration events with audit metadata', async () => {
    const pending = await repo.logPending({
      documentId,
      fromVersion: '0.9.0',
      toVersion: '1.0.0',
      initiatedBy: 'system_auto_upgrade',
    });

    expect(pending.status).toBe(DocumentTemplateMigrationStatus.PENDING);
    expect(pending.initiatedAt).toBeInstanceOf(Date);
    expect(pending.completedAt).toBeNull();

    const logs = await repo.listForDocument(documentId);
    expect(logs).toHaveLength(1);
    expect(logs[0].status).toBe(DocumentTemplateMigrationStatus.PENDING);
  });

  it('marks migrations succeeded and stamps completion metadata', async () => {
    const pending = await repo.logPending({
      documentId,
      fromVersion: '0.9.0',
      toVersion: '1.0.0',
      initiatedBy: 'manager_upgrade',
    });

    const succeeded = await repo.markSucceeded({
      migrationId: pending.id,
    });

    expect(succeeded.status).toBe(DocumentTemplateMigrationStatus.SUCCEEDED);
    expect(succeeded.completedAt).toBeInstanceOf(Date);

    const [log] = await repo.listForDocument(documentId);
    expect(log.status).toBe(DocumentTemplateMigrationStatus.SUCCEEDED);
    expect(log.completedAt).toBeInstanceOf(Date);
  });

  it('marks migrations failed with validation issues and keeps chronological ordering', async () => {
    const earlier = await repo.logPending({
      documentId,
      fromVersion: '0.8.0',
      toVersion: '0.9.0',
      initiatedBy: 'system_auto_upgrade',
    });

    const later = await repo.logPending({
      documentId,
      fromVersion: '0.9.0',
      toVersion: '1.0.0',
      initiatedBy: 'system_auto_upgrade',
    });

    await repo.markFailed({
      migrationId: later.id,
      validationErrors: [{ path: ['sections', 0], message: 'Missing summary' }],
    });

    const logs = await repo.listForDocument(documentId);
    expect(logs).toHaveLength(2);
    expect(logs[0].id).toBe(later.id);
    expect(logs[0].status).toBe(DocumentTemplateMigrationStatus.FAILED);
    expect(logs[0].validationErrors).toEqual([
      { path: ['sections', 0], message: 'Missing summary' },
    ]);
    expect(logs[1].id).toBe(earlier.id);
  });
});

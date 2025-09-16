import Database from 'better-sqlite3';
import { beforeEach, describe, expect, it } from 'vitest';

import {
  DocumentTemplateRepositoryImpl,
  DocumentTemplateStatus,
} from '../models/document-template';

function setupCatalogDb() {
  const db = new Database(':memory:');
  db.pragma('journal_mode = WAL');
  db.exec(`
    CREATE TABLE document_templates (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      document_type TEXT NOT NULL,
      active_version_id TEXT,
      status TEXT NOT NULL,
      default_aggressiveness TEXT,
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

describe('DocumentTemplateRepositoryImpl', () => {
  let db: Database.Database;
  let repo: DocumentTemplateRepositoryImpl;

  beforeEach(() => {
    db = setupCatalogDb();
    repo = new DocumentTemplateRepositoryImpl(db);
  });

  it('creates a template catalog entry using provided slug identifier', async () => {
    const created = await repo.create({
      id: 'architecture',
      name: 'Architecture Template',
      description: 'Baseline architecture document',
      documentType: 'architecture',
      createdBy: 'manager_123',
      updatedBy: 'manager_123',
    });

    expect(created.id).toBe('architecture');
    expect(created.status).toBe(DocumentTemplateStatus.DRAFT);
    expect(created.activeVersionId).toBeNull();
    expect(created.createdAt).toBeInstanceOf(Date);
    expect(created.updatedAt).toBeInstanceOf(Date);

    const fetched = await repo.findById(created.id);
    expect(fetched?.name).toBe('Architecture Template');
    expect(fetched?.status).toBe(DocumentTemplateStatus.DRAFT);
  });

  it('promotes a template to active when a version is set', async () => {
    const template = await repo.create({
      id: 'architecture',
      name: 'Architecture Template',
      documentType: 'architecture',
      createdBy: 'manager_123',
      updatedBy: 'manager_123',
    });

    const updated = await repo.setActiveVersion({
      templateId: template.id,
      versionId: 'version-001',
      updatedBy: 'manager_activator',
    });

    expect(updated.status).toBe(DocumentTemplateStatus.ACTIVE);
    expect(updated.activeVersionId).toBe('version-001');
    expect(updated.updatedBy).toBe('manager_activator');
    expect(updated.updatedAt.getTime()).toBeGreaterThan(template.updatedAt.getTime());

    const stored = await repo.findById(template.id);
    expect(stored?.status).toBe(DocumentTemplateStatus.ACTIVE);
    expect(stored?.activeVersionId).toBe('version-001');
  });

  it('marks a template deprecated without clearing active version pointer', async () => {
    const template = await repo.create({
      id: 'architecture',
      name: 'Architecture Template',
      documentType: 'architecture',
      createdBy: 'manager_123',
      updatedBy: 'manager_123',
    });

    await repo.setActiveVersion({
      templateId: template.id,
      versionId: 'version-001',
      updatedBy: 'manager_activator',
    });

    const deprecated = await repo.markDeprecated({
      templateId: template.id,
      updatedBy: 'manager_deprecate',
    });

    expect(deprecated.status).toBe(DocumentTemplateStatus.DEPRECATED);
    expect(deprecated.activeVersionId).toBe('version-001');
    expect(deprecated.updatedBy).toBe('manager_deprecate');

    const stored = await repo.findById(template.id);
    expect(stored?.status).toBe(DocumentTemplateStatus.DEPRECATED);
    expect(stored?.activeVersionId).toBe('version-001');
  });

  it('upserts template metadata and lists catalog entries alphabetically', async () => {
    const created = await repo.upsertMetadata({
      id: 'architecture',
      name: 'Architecture Template',
      description: 'Initial architecture reference',
      documentType: 'architecture',
      createdBy: 'manager_initial',
      updatedBy: 'manager_initial',
    });

    expect(created.name).toBe('Architecture Template');
    expect(created.createdBy).toBe('manager_initial');

    const [first] = await repo.listAll();
    expect(first?.id).toBe('architecture');

    const updated = await repo.upsertMetadata({
      id: 'architecture',
      name: 'Architecture Template v2',
      description: 'Updated description',
      documentType: 'architecture',
      createdBy: 'manager_initial',
      updatedBy: 'manager_update',
    });

    expect(updated.name).toBe('Architecture Template v2');
    expect(updated.updatedBy).toBe('manager_update');
    expect(updated.updatedAt.getTime()).toBeGreaterThan(created.updatedAt.getTime());

    await repo.upsertMetadata({
      id: 'decision-log',
      name: 'Decision Log Template',
      documentType: 'decision-log',
      createdBy: 'manager_initial',
      updatedBy: 'manager_initial',
      description: null,
    });

    const templates = await repo.listAll();
    expect(templates).toHaveLength(2);
    expect(templates.map(t => t.id)).toEqual(['architecture', 'decision-log']);
  });
});

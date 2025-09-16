import Database from 'better-sqlite3';
import { beforeEach, describe, expect, it } from 'vitest';

import { DocumentRepositoryImpl } from '../models/document';

function setupDatabase() {
  const db = new Database(':memory:');
  db.pragma('journal_mode = WAL');
  db.exec(`
    CREATE TABLE documents (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      title TEXT NOT NULL,
      content_json TEXT NOT NULL,
      template_id TEXT NOT NULL,
      template_version TEXT NOT NULL,
      template_schema_hash TEXT NOT NULL,
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

describe('DocumentRepositoryImpl', () => {
  let db: Database.Database;
  let repo: DocumentRepositoryImpl;
  const managerId = 'user_mgr_template_admin';

  beforeEach(() => {
    db = setupDatabase();
    repo = new DocumentRepositoryImpl(db);
  });

  it('creates documents with template bindings persisted in JSON payload', async () => {
    const created = await repo.create({
      projectId: 'proj_123',
      title: 'Architecture Overview',
      content: {
        introduction: 'System summary',
        system_overview: {
          architecture_diagram: 'https://cdn.ctrl-freaq.dev/diagram.png',
          tech_stack: 'react',
        },
      },
      templateId: 'architecture',
      templateVersion: '1.0.0',
      templateSchemaHash: 'hash-v1',
      createdBy: managerId,
      updatedBy: managerId,
    });

    expect(created.templateId).toBe('architecture');
    expect(created.templateSchemaHash).toBe('hash-v1');

    const stored = await repo.findById(created.id);
    expect(stored).not.toBeNull();
    expect(stored?.content).toMatchObject({
      introduction: 'System summary',
      system_overview: {
        tech_stack: 'react',
      },
    });
    expect(stored?.templateVersion).toBe('1.0.0');
  });

  it('updates document content and template hash on save', async () => {
    const document = await repo.create({
      projectId: 'proj_456',
      title: 'Integration Doc',
      content: { introduction: 'v1' },
      templateId: 'architecture',
      templateVersion: '1.0.0',
      templateSchemaHash: 'hash-v1',
      createdBy: managerId,
      updatedBy: managerId,
    });

    const updated = await repo.updateContent(document.id, {
      title: 'Integration Doc v2',
      content: {
        introduction: 'Updated summary',
        decision_log: [],
      },
      templateVersion: '1.1.0',
      templateSchemaHash: 'hash-v2',
      updatedBy: 'user_editor',
    });

    expect(updated.title).toBe('Integration Doc v2');
    expect(updated.templateVersion).toBe('1.1.0');
    expect(updated.templateSchemaHash).toBe('hash-v2');

    const stored = await repo.findById(document.id);
    expect(stored?.updatedBy).toBe('user_editor');
    expect(stored?.content).toMatchObject({
      introduction: 'Updated summary',
      decision_log: [],
    });
  });

  it('supports updating template binding independent of content changes', async () => {
    const document = await repo.create({
      projectId: 'proj_binding',
      title: 'Binding Doc',
      content: { introduction: 'v1' },
      templateId: 'architecture',
      templateVersion: '1.0.0',
      templateSchemaHash: 'hash-v1',
      createdBy: managerId,
      updatedBy: managerId,
    });

    const binding = await repo.updateTemplateBinding({
      documentId: document.id,
      templateId: 'architecture',
      templateVersion: '1.2.0',
      templateSchemaHash: 'hash-v3',
      updatedBy: 'system_auto_upgrade',
    });

    expect(binding.templateVersion).toBe('1.2.0');
    expect(binding.templateSchemaHash).toBe('hash-v3');
    expect(binding.updatedBy).toBe('system_auto_upgrade');

    const stored = await repo.findById(document.id);
    expect(stored?.templateVersion).toBe('1.2.0');
    expect(stored?.content).toMatchObject({ introduction: 'v1' });
  });

  it('lists documents for a project ordered by most recently updated', async () => {
    const first = await repo.create({
      projectId: 'proj_list',
      title: 'Doc A',
      content: { introduction: 'A' },
      templateId: 'architecture',
      templateVersion: '1.0.0',
      templateSchemaHash: 'hash-a',
      createdBy: managerId,
      updatedBy: managerId,
    });

    await new Promise(resolve => setTimeout(resolve, 5));

    await repo.updateContent(first.id, {
      content: { introduction: 'A updated' },
      templateVersion: '1.0.1',
      templateSchemaHash: 'hash-a2',
      updatedBy: 'user_editor',
    });

    await repo.create({
      projectId: 'proj_list',
      title: 'Doc B',
      content: { introduction: 'B' },
      templateId: 'architecture',
      templateVersion: '1.0.0',
      templateSchemaHash: 'hash-b',
      createdBy: managerId,
      updatedBy: managerId,
    });

    const docs = await repo.listByProject('proj_list');
    expect(docs).toHaveLength(2);
    expect(docs.map(doc => doc.title)).toEqual(expect.arrayContaining(['Doc A', 'Doc B']));
    expect(docs[0].updatedAt.getTime()).toBeGreaterThanOrEqual(docs[1].updatedAt.getTime());
  });
});

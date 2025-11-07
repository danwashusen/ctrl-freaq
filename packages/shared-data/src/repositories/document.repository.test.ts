import Database from 'better-sqlite3';
import { beforeEach, describe, expect, it, vi } from 'vitest';

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

    CREATE TABLE sections (
      id TEXT PRIMARY KEY,
      doc_id TEXT NOT NULL,
      parent_section_id TEXT,
      key TEXT NOT NULL,
      title TEXT NOT NULL,
      depth INTEGER NOT NULL,
      order_index INTEGER NOT NULL,
      content_markdown TEXT NOT NULL,
      placeholder_text TEXT NOT NULL,
      has_content INTEGER NOT NULL,
      view_state TEXT NOT NULL,
      editing_user TEXT,
      last_modified TEXT NOT NULL,
      status TEXT NOT NULL,
      assumptions_resolved INTEGER NOT NULL,
      quality_gate_status TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (doc_id) REFERENCES documents(id) ON DELETE CASCADE
    );

    CREATE INDEX idx_sections_doc_order ON sections(doc_id, order_index);
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

  it('soft deletes documents and retains tombstone metadata for audit', async () => {
    const document = await repo.create({
      projectId: 'proj_soft_delete',
      title: 'Doc to Delete',
      content: { introduction: 'Soft delete me' },
      templateId: 'architecture',
      templateVersion: '1.0.0',
      templateSchemaHash: 'hash-soft-delete',
      createdBy: managerId,
      updatedBy: managerId,
    });

    const result = await repo.delete(document.id, 'user_soft_delete');
    expect(result).toBe(true);

    const tombstone = db
      .prepare(
        'SELECT deleted_at as deletedAt, deleted_by as deletedBy FROM documents WHERE id = ?'
      )
      .get(document.id) as { deletedAt: string | null; deletedBy: string | null } | undefined;

    expect(tombstone).toBeDefined();
    expect(tombstone?.deletedAt).not.toBeNull();
    expect(tombstone?.deletedBy).toBe('user_soft_delete');

    const lookup = await repo.findById(document.id);
    expect(lookup).toBeNull();

    const documents = await repo.listByProject('proj_soft_delete');
    expect(documents).toHaveLength(0);
  });

  describe('fetchProjectDocumentSnapshot', () => {
    const projectId = '11111111-1111-4111-8111-111111111111';

    it('returns missing snapshot when project lacks a document', async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2025-03-01T00:00:00.000Z'));

      const snapshot = await repo.fetchProjectDocumentSnapshot(projectId);

      expect(snapshot).toEqual({
        projectId,
        status: 'missing',
        document: null,
        templateDecision: null,
        lastUpdatedAt: '2025-03-01T00:00:00.000Z',
      });

      vi.useRealTimers();
    });

    it('returns ready snapshot with first section metadata and lifecycle derived from section statuses', async () => {
      const document = await repo.create({
        projectId,
        title: 'Architecture Overview',
        content: { introduction: 'System summary' },
        templateId: 'architecture',
        templateVersion: '1.2.0',
        templateSchemaHash: 'tmpl-hash',
        createdBy: managerId,
        updatedBy: managerId,
      });

      const firstSectionId = '22222222-2222-4222-8222-222222222222';
      const secondSectionId = '33333333-3333-4333-8333-333333333333';
      const nowIso = new Date('2025-04-05T12:30:00.000Z').toISOString();

      db.prepare(
        `INSERT INTO sections (
          id, doc_id, parent_section_id, key, title, depth, order_index,
          content_markdown, placeholder_text, has_content, view_state,
          editing_user, last_modified, status, assumptions_resolved,
          quality_gate_status, created_at, updated_at
        ) VALUES (?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?, ?, ?, ?)`
      ).run(
        firstSectionId,
        document.id,
        'introduction',
        'Introduction',
        0,
        0,
        '# Intro',
        'Add intro',
        1,
        'read_mode',
        nowIso,
        'review',
        1,
        'passed',
        nowIso,
        nowIso
      );

      db.prepare(
        `INSERT INTO sections (
          id, doc_id, parent_section_id, key, title, depth, order_index,
          content_markdown, placeholder_text, has_content, view_state,
          editing_user, last_modified, status, assumptions_resolved,
          quality_gate_status, created_at, updated_at
        ) VALUES (?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?, ?, ?, ?)`
      ).run(
        secondSectionId,
        document.id,
        'overview',
        'Overview',
        0,
        1,
        '# Overview',
        'Add overview',
        1,
        'read_mode',
        nowIso,
        'drafting',
        1,
        'pending',
        nowIso,
        nowIso
      );

      const snapshot = await repo.fetchProjectDocumentSnapshot(projectId);

      expect(snapshot.status).toBe('ready');
      expect(snapshot.projectId).toBe(projectId);
      expect(snapshot.document).toMatchObject({
        documentId: document.id,
        firstSectionId,
        title: 'Architecture Overview',
        lifecycleStatus: 'review',
        lastModifiedAt: document.updatedAt.toISOString(),
        template: {
          templateId: 'architecture',
          templateVersion: '1.2.0',
          templateSchemaHash: 'tmpl-hash',
        },
      });
      expect(snapshot.templateDecision).toBeNull();
      expect(snapshot.lastUpdatedAt).toBe(document.updatedAt.toISOString());
    });

    it('treats documents with all sections ready as published and respects archival state', async () => {
      const archivedProjectId = '44444444-4444-4444-8444-444444444444';
      const document = await repo.create({
        projectId: archivedProjectId,
        title: 'Publish Ready Doc',
        content: { overview: 'All done' },
        templateId: 'architecture',
        templateVersion: '2.0.0',
        templateSchemaHash: 'tmpl-hash-2',
        createdBy: managerId,
        updatedBy: managerId,
      });

      const timestamp = new Date('2025-05-10T09:00:00.000Z').toISOString();
      db.prepare(
        `INSERT INTO sections (
          id, doc_id, parent_section_id, key, title, depth, order_index,
          content_markdown, placeholder_text, has_content, view_state,
          editing_user, last_modified, status, assumptions_resolved,
          quality_gate_status, created_at, updated_at
        ) VALUES (?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?, ?, ?, ?)`
      ).run(
        '55555555-5555-4555-8555-555555555555',
        document.id,
        'architecture.summary',
        'Summary',
        0,
        0,
        '# Summary',
        'Add summary',
        1,
        'read_mode',
        timestamp,
        'ready',
        1,
        'passed',
        timestamp,
        timestamp
      );

      const publishedSnapshot = await repo.fetchProjectDocumentSnapshot(archivedProjectId);
      expect(publishedSnapshot.document?.lifecycleStatus).toBe('published');

      const deletedAt = new Date('2025-05-15T10:00:00.000Z').toISOString();
      db.prepare(`UPDATE documents SET deleted_at = ?, deleted_by = ? WHERE id = ?`).run(
        deletedAt,
        'system',
        document.id
      );

      const archivedSnapshot = await repo.fetchProjectDocumentSnapshot(archivedProjectId);
      expect(archivedSnapshot.status).toBe('archived');
      expect(archivedSnapshot.document).toBeNull();
      expect(archivedSnapshot.lastUpdatedAt).toBe(deletedAt);
    });
  });
});

import Database from 'better-sqlite3';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { SectionRepositoryImpl } from './section-repository';

const SECTION_ID = 'b3a48800-2875-4f3a-9f1d-0a83d4bd2a56';
const DOCUMENT_ID = '6d5e7a4b-6078-4f2f-9f5e-b18bb90f4671';
const APPROVER_ID = 'f8184d11-07e9-44e9-9546-4fb1517972cf';

function createDatabase(): Database.Database {
  const db = new Database(':memory:');
  db.pragma('journal_mode = WAL');
  db.exec(
    `CREATE TABLE sections (
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
        updated_at TEXT NOT NULL
      );

      CREATE TABLE section_records (
        id TEXT PRIMARY KEY,
        document_id TEXT NOT NULL,
        template_key TEXT NOT NULL,
        title TEXT NOT NULL,
        depth INTEGER NOT NULL,
        order_index INTEGER NOT NULL,
        approved_version INTEGER NOT NULL,
        approved_content TEXT NOT NULL,
        approved_at TEXT,
        approved_by TEXT,
        last_summary TEXT,
        status TEXT NOT NULL,
        quality_gate TEXT NOT NULL,
        accessibility_score REAL,
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

function seedSection(db: Database.Database) {
  const now = new Date('2025-01-02T10:15:30.000Z').toISOString();
  const approvalTimestamp = new Date('2025-01-03T08:45:00.000Z').toISOString();

  db.prepare(
    `INSERT INTO sections (
      id, doc_id, parent_section_id, key, title, depth, order_index, content_markdown,
      placeholder_text, has_content, view_state, editing_user, last_modified,
      status, assumptions_resolved, quality_gate_status, created_at, updated_at
    ) VALUES (?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?, ?, ?, ?)`
  ).run(
    SECTION_ID,
    DOCUMENT_ID,
    'architecture.overview',
    'Architecture Overview',
    0,
    0,
    '# Approved Content',
    'Add architecture overview',
    1,
    'read_mode',
    now,
    'review',
    1,
    'passed',
    now,
    now
  );

  db.prepare(
    `INSERT INTO section_records (
      id, document_id, template_key, title, depth, order_index, approved_version,
      approved_content, approved_at, approved_by, last_summary, status, quality_gate,
      accessibility_score, created_at, created_by, updated_at, updated_by
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    SECTION_ID,
    DOCUMENT_ID,
    'architecture.overview',
    'Architecture Overview',
    0,
    0,
    6,
    '# Approved Content\n\nSystem is production ready.',
    approvalTimestamp,
    APPROVER_ID,
    'Summarized most recent architecture changes.',
    'review',
    'passed',
    95.2,
    now,
    APPROVER_ID,
    now,
    APPROVER_ID
  );
}

describe('SectionRepositoryImpl - approval metadata integration', () => {
  let db: Database.Database;
  let repository: SectionRepositoryImpl;

  beforeEach(() => {
    db = createDatabase();
    seedSection(db);
    repository = new SectionRepositoryImpl(db);
  });

  afterEach(() => {
    db.close();
  });

  it('returns sections with approval metadata and version tokens', async () => {
    const section = await repository.findById(SECTION_ID);
    expect(section).not.toBeNull();
    expect(section).toMatchObject({
      id: SECTION_ID,
      approvedVersion: 6,
      approvedContent: '# Approved Content\n\nSystem is production ready.',
      approvedBy: APPROVER_ID,
      lastSummary: 'Summarized most recent architecture changes.',
      qualityGate: 'passed',
    });

    expect(section?.approvedAt?.toISOString()).toBe('2025-01-03T08:45:00.000Z');
    expect(section?.accessibilityScore).toBeCloseTo(95.2);
  });

  it('includes approval metadata in document listing queries', async () => {
    const sections = await repository.findByDocumentId(DOCUMENT_ID);
    expect(sections).toHaveLength(1);

    const [section] = sections;
    expect(section).toBeDefined();
    expect(section).toMatchObject({
      approvedVersion: 6,
      approvedBy: APPROVER_ID,
      qualityGate: 'passed',
    });
  });

  it('safely defaults approval metadata when canonical record is missing', async () => {
    const orphanId = '4d8d9cf0-4ec6-4a01-b2bb-7bb6aade9f54';
    const now = new Date('2025-02-01T12:00:00.000Z').toISOString();

    db.prepare(
      `INSERT INTO sections (
        id, doc_id, parent_section_id, key, title, depth, order_index, content_markdown,
        placeholder_text, has_content, view_state, editing_user, last_modified,
        status, assumptions_resolved, quality_gate_status, created_at, updated_at
      ) VALUES (?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?, ?, ?, ?)`
    ).run(
      orphanId,
      DOCUMENT_ID,
      'architecture.appendix',
      'Appendix',
      1,
      2,
      'Appendix body',
      'Add appendix content',
      1,
      'idle',
      now,
      'idle',
      0,
      'pending',
      now,
      now
    );

    const section = await repository.findById(orphanId);
    expect(section).not.toBeNull();
    expect(section).toMatchObject({
      approvedVersion: 0,
      approvedContent: 'Appendix body',
      approvedBy: null,
      lastSummary: null,
      qualityGate: 'pending',
    });
  });
});

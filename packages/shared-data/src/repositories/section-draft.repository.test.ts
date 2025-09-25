import Database from 'better-sqlite3';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { SectionDraftRepositoryImpl } from './section-draft.repository';

const SECTION_ID = '2f356c08-3e4f-4382-8973-5b9b5f6f546d';
const DOCUMENT_ID = 'd72f8023-0485-488a-8c2c-e7b2915031ab';
const AUTHOR_ID = '3af22cc8-2b04-424a-a8ad-42d3c775562d';
const REVIEWER_ID = '0c14582e-2090-4c36-8f0e-b3cf7684d626';

function createDatabase(): Database.Database {
  const db = new Database(':memory:');
  db.pragma('journal_mode = WAL');
  db.exec(
    `CREATE TABLE section_drafts (
        id TEXT PRIMARY KEY,
        section_id TEXT NOT NULL,
        document_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        draft_version INTEGER NOT NULL,
        draft_base_version INTEGER NOT NULL,
        content_markdown TEXT NOT NULL,
        summary_note TEXT NOT NULL,
        conflict_state TEXT NOT NULL,
        conflict_reason TEXT,
        rebased_at TEXT,
        saved_at TEXT NOT NULL,
        saved_by TEXT NOT NULL,
        created_at TEXT NOT NULL,
        created_by TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        updated_by TEXT NOT NULL,
        deleted_at TEXT,
        deleted_by TEXT
      );

      CREATE TABLE formatting_annotations (
        id TEXT PRIMARY KEY,
        section_id TEXT NOT NULL,
        draft_id TEXT NOT NULL,
        start_offset INTEGER NOT NULL,
        end_offset INTEGER NOT NULL,
        mark_type TEXT NOT NULL,
        message TEXT NOT NULL,
        severity TEXT NOT NULL,
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

function extractIds(records: Array<{ id: string }>): string[] {
  return records.map(record => record.id);
}

describe('SectionDraftRepositoryImpl', () => {
  let db: Database.Database;
  let repository: SectionDraftRepositoryImpl;

  beforeEach(() => {
    db = createDatabase();
    repository = new SectionDraftRepositoryImpl(db);
  });

  afterEach(() => {
    db.close();
  });

  it('creates drafts and hydrates formatting annotations via helper', async () => {
    const savedAt = new Date('2025-03-01T10:00:00.000Z');

    const draft = await repository.createDraft(
      {
        sectionId: SECTION_ID,
        documentId: DOCUMENT_ID,
        userId: AUTHOR_ID,
        draftVersion: 2,
        draftBaseVersion: 1,
        contentMarkdown: '# Draft content',
        summaryNote: 'Initial exploration',
      },
      {
        actorId: AUTHOR_ID,
        savedAt,
      }
    );

    await repository.replaceFormattingAnnotations(
      draft.id,
      [
        {
          startOffset: 10,
          endOffset: 24,
          markType: 'unsupported-color',
          message: 'Custom colors are not allowed',
          severity: 'warning',
        },
      ],
      AUTHOR_ID
    );

    const fetched = await repository.findById(draft.id);
    expect(fetched).not.toBeNull();
    expect(fetched?.formattingAnnotations).toHaveLength(1);
    expect(fetched?.formattingAnnotations[0]).toMatchObject({
      draftId: draft.id,
      markType: 'unsupported-color',
      severity: 'warning',
    });
    expect(fetched?.savedAt.toISOString()).toBe(savedAt.toISOString());
  });

  it('updates conflict metadata and replaces annotations atomically', async () => {
    const draft = await repository.createDraft(
      {
        sectionId: SECTION_ID,
        documentId: DOCUMENT_ID,
        userId: AUTHOR_ID,
        draftVersion: 3,
        draftBaseVersion: 2,
        contentMarkdown: '# Pending draft',
        summaryNote: 'Needs review',
      },
      {
        actorId: AUTHOR_ID,
        savedAt: new Date('2025-03-02T09:00:00.000Z'),
      }
    );

    await repository.replaceFormattingAnnotations(
      draft.id,
      [
        {
          startOffset: 5,
          endOffset: 15,
          markType: 'unsupported-font',
          message: 'Font overrides are not allowed',
          severity: 'warning',
        },
      ],
      AUTHOR_ID
    );

    const updated = await repository.updateDraft(
      draft.id,
      {
        conflictState: 'rebase_required',
        conflictReason: 'Approved content advanced to v6',
        draftBaseVersion: 6,
        summaryNote: 'Needs rebase before review',
      },
      {
        actorId: REVIEWER_ID,
        savedAt: new Date('2025-03-02T11:30:00.000Z'),
        savedBy: REVIEWER_ID,
        formattingAnnotations: [
          {
            startOffset: 1,
            endOffset: 8,
            markType: 'unsupported-color',
            message: 'Remove highlight before submit',
            severity: 'warning',
          },
          {
            startOffset: 30,
            endOffset: 38,
            markType: 'unsupported-table',
            message: 'Tables must use template styles',
            severity: 'error',
          },
        ],
      }
    );

    expect(updated.conflictState).toBe('rebase_required');
    expect(updated.conflictReason).toBe('Approved content advanced to v6');

    const rehydrated = await repository.findById(draft.id);
    expect(rehydrated?.formattingAnnotations).toHaveLength(2);
    const markTypes =
      rehydrated?.formattingAnnotations.map(annotation => annotation.markType) ?? [];
    expect(markTypes).toEqual(['unsupported-color', 'unsupported-table']);
    expect(rehydrated?.savedBy).toBe(REVIEWER_ID);
  });

  it('lists drafts by section ordered by savedAt and excludes soft-deleted entries', async () => {
    const seed = async ({
      draftVersion = 1,
      savedAt = new Date('2025-03-03T09:00:00.000Z'),
      summaryNote = '',
      userId = AUTHOR_ID,
    }: {
      draftVersion?: number;
      savedAt?: Date;
      summaryNote?: string;
      userId?: string;
    }) =>
      repository.createDraft(
        {
          sectionId: SECTION_ID,
          documentId: DOCUMENT_ID,
          userId,
          draftVersion,
          draftBaseVersion: 0,
          contentMarkdown: '# Seed draft',
          summaryNote,
        },
        {
          actorId: userId,
          savedAt,
          savedBy: userId,
        }
      );

    const older = await seed({
      draftVersion: 1,
      savedAt: new Date('2025-03-03T08:00:00.000Z'),
      summaryNote: 'Older draft',
    });

    const newer = await seed({
      draftVersion: 2,
      savedAt: new Date('2025-03-03T12:30:00.000Z'),
      summaryNote: 'Newer draft',
      userId: REVIEWER_ID,
    });

    let drafts = await repository.listBySection(SECTION_ID);
    expect(extractIds(drafts)).toEqual([newer.id, older.id]);

    await repository.delete(older.id, AUTHOR_ID);

    drafts = await repository.listBySection(SECTION_ID);
    expect(extractIds(drafts)).toEqual([newer.id]);
    expect(await repository.findById(older.id)).toBeNull();
  });
});

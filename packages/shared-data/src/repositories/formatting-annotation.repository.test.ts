import Database from 'better-sqlite3';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { FormattingAnnotationRepositoryImpl } from './formatting-annotation.repository';

const SECTION_ID = 'b63bc30c-0e8c-452a-9bc6-e924952957cb';
const DRAFT_ID = '7f392f0f-5fdc-4d01-9fec-2b2b8f58d6d0';
const AUTHOR_ID = '70a4a788-ece4-4a42-b742-4fa4680fb2a5';
const REVIEWER_ID = '8d20a748-fb06-4b0d-8af4-fcb1247f1d6b';

function createDatabase(): Database.Database {
  const db = new Database(':memory:');
  db.pragma('journal_mode = WAL');
  db.exec(
    `CREATE TABLE formatting_annotations (
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

describe('FormattingAnnotationRepositoryImpl', () => {
  let db: Database.Database;
  let repository: FormattingAnnotationRepositoryImpl;

  beforeEach(() => {
    db = createDatabase();
    repository = new FormattingAnnotationRepositoryImpl(db);
  });

  afterEach(() => {
    db.close();
  });

  it('creates annotations and lists them in start offset order', async () => {
    const first = await repository.createAnnotation(
      {
        sectionId: SECTION_ID,
        draftId: DRAFT_ID,
        startOffset: 20,
        endOffset: 30,
        markType: 'unsupported-table',
        message: 'Tables must use template styles',
        severity: 'error',
        createdBy: AUTHOR_ID,
        updatedBy: AUTHOR_ID,
      },
      AUTHOR_ID
    );

    const second = await repository.createAnnotation(
      {
        sectionId: SECTION_ID,
        draftId: DRAFT_ID,
        startOffset: 5,
        endOffset: 12,
        markType: 'unsupported-color',
        message: 'Remove custom color',
        severity: 'warning',
        createdBy: AUTHOR_ID,
        updatedBy: AUTHOR_ID,
      },
      AUTHOR_ID
    );

    expect(first.id).not.toBe(second.id);

    const annotations = await repository.listByDraft(DRAFT_ID);
    expect(annotations.map(annotation => annotation.startOffset)).toEqual([5, 20]);

    const fetched = await repository.findById(first.id);
    expect(fetched).not.toBeNull();
    expect(fetched?.markType).toBe('unsupported-table');
  });

  it('updates annotation message and severity', async () => {
    const annotation = await repository.createAnnotation(
      {
        sectionId: SECTION_ID,
        draftId: DRAFT_ID,
        startOffset: 0,
        endOffset: 4,
        markType: 'unsupported-bold',
        message: 'Bold not permitted here',
        severity: 'warning',
        createdBy: AUTHOR_ID,
        updatedBy: AUTHOR_ID,
      },
      AUTHOR_ID
    );

    const updated = await repository.updateAnnotation(
      annotation.id,
      {
        id: annotation.id,
        message: 'Bold allowed in summary only',
        severity: 'error',
        updatedBy: REVIEWER_ID,
      },
      REVIEWER_ID
    );

    expect(updated.message).toBe('Bold allowed in summary only');
    expect(updated.severity).toBe('error');
    expect(updated.updatedBy).toBe(REVIEWER_ID);
  });

  it('soft deletes annotations and excludes them from listings', async () => {
    const annotation = await repository.createAnnotation(
      {
        sectionId: SECTION_ID,
        draftId: DRAFT_ID,
        startOffset: 40,
        endOffset: 50,
        markType: 'unsupported-highlight',
        message: 'Highlight must be removed',
        severity: 'warning',
        createdBy: AUTHOR_ID,
        updatedBy: AUTHOR_ID,
      },
      AUTHOR_ID
    );

    await repository.deleteAnnotation(annotation.id, REVIEWER_ID);

    const afterDelete = await repository.findById(annotation.id);
    expect(afterDelete).toBeNull();

    const annotations = await repository.listByDraft(DRAFT_ID);
    expect(annotations).toHaveLength(0);

    const row = db
      .prepare(
        'SELECT deleted_at as deletedAt, deleted_by as deletedBy FROM formatting_annotations WHERE id = ?'
      )
      .get(annotation.id) as { deletedAt: string | null; deletedBy: string | null } | undefined;
    expect(row?.deletedAt).toBeTruthy();
    expect(row?.deletedBy).toBe(REVIEWER_ID);
  });
});

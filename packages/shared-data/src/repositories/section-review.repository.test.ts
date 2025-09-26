import Database from 'better-sqlite3';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { SectionReviewRepositoryImpl } from './section-review.repository';

const SECTION_ID = 'e79bbdf0-ecea-4d44-966f-2dcda8474f92';
const DOCUMENT_ID = 'f7b35745-2e16-4ba7-8d1a-02c832c233f0';
const DRAFT_ID = '6d812c3b-c9fe-4f7b-a086-0ed9aa8dba5c';
const REVIEWER_ID = 'e6d5933b-14d4-4a87-9dfc-7992faf787f1';
const APPROVER_ID = 'a4433147-3d6a-4c53-8233-1935804ec8d4';

function createDatabase(): Database.Database {
  const db = new Database(':memory:');
  db.pragma('journal_mode = WAL');
  db.exec(
    `CREATE TABLE section_review_summaries (
        id TEXT PRIMARY KEY,
        section_id TEXT NOT NULL,
        document_id TEXT NOT NULL,
        draft_id TEXT NOT NULL,
        reviewer_id TEXT NOT NULL,
        review_status TEXT NOT NULL,
        reviewer_note TEXT NOT NULL,
        submitted_at TEXT NOT NULL,
        decided_at TEXT,
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

describe('SectionReviewRepositoryImpl', () => {
  let db: Database.Database;
  let repository: SectionReviewRepositoryImpl;

  beforeEach(() => {
    db = createDatabase();
    repository = new SectionReviewRepositoryImpl(db);
  });

  afterEach(() => {
    db.close();
  });

  it('creates review summaries and lists pending ones by section', async () => {
    const submittedAt = new Date('2025-03-07T14:00:00.000Z');

    const pendingReview = await repository.createReview(
      {
        sectionId: SECTION_ID,
        documentId: DOCUMENT_ID,
        draftId: DRAFT_ID,
        reviewerId: REVIEWER_ID,
        reviewStatus: 'pending',
        reviewerNote: 'Ready for approval review.',
        submittedAt,
        decidedAt: null,
      },
      REVIEWER_ID
    );

    const approvedReview = await repository.createReview(
      {
        sectionId: SECTION_ID,
        documentId: DOCUMENT_ID,
        draftId: 'b0c3d7b9-28f7-4f18-9af3-4bdaaad222ee',
        reviewerId: APPROVER_ID,
        reviewStatus: 'approved',
        reviewerNote: 'Looks good to ship!',
        submittedAt: new Date('2025-03-08T09:15:00.000Z'),
        decidedAt: new Date('2025-03-08T09:45:00.000Z'),
      },
      APPROVER_ID
    );

    expect(pendingReview.reviewStatus).toBe('pending');
    expect(approvedReview.reviewStatus).toBe('approved');

    const allReviews = await repository.listBySection(SECTION_ID);
    expect(allReviews.map(review => review.reviewStatus)).toEqual(['approved', 'pending']);

    const pendingOnly = await repository.listBySection(SECTION_ID, 'pending');
    expect(pendingOnly).toHaveLength(1);
    expect(pendingOnly[0].id).toBe(pendingReview.id);
  });

  it('updates review status with approval metadata', async () => {
    const review = await repository.createReview(
      {
        sectionId: SECTION_ID,
        documentId: DOCUMENT_ID,
        draftId: DRAFT_ID,
        reviewerId: REVIEWER_ID,
        reviewStatus: 'pending',
        reviewerNote: 'Needs decision',
        submittedAt: new Date('2025-03-09T10:00:00.000Z'),
        decidedAt: null,
      },
      REVIEWER_ID
    );

    const decidedAt = new Date('2025-03-09T11:20:00.000Z');
    const updated = await repository.updateReviewStatus(
      review.id,
      {
        id: review.id,
        reviewStatus: 'changes_requested',
        decidedAt,
        reviewerNote: 'Update architecture diagram before approval.',
      },
      APPROVER_ID
    );

    expect(updated.reviewStatus).toBe('changes_requested');
    expect(updated.reviewerNote).toContain('Update architecture diagram');
    expect(updated.decidedAt?.toISOString()).toBe(decidedAt.toISOString());
    expect(updated.updatedBy).toBe(APPROVER_ID);
  });

  it('soft deletes review summaries and excludes them from results', async () => {
    const review = await repository.createReview(
      {
        sectionId: SECTION_ID,
        documentId: DOCUMENT_ID,
        draftId: DRAFT_ID,
        reviewerId: REVIEWER_ID,
        reviewStatus: 'pending',
        reviewerNote: 'Staged for approval',
        submittedAt: new Date('2025-03-10T08:30:00.000Z'),
        decidedAt: null,
      },
      REVIEWER_ID
    );

    await repository.deleteReview(review.id, APPROVER_ID);

    const reviews = await repository.listBySection(SECTION_ID);
    expect(reviews).toHaveLength(0);

    const row = db
      .prepare(
        'SELECT deleted_at as deletedAt, deleted_by as deletedBy FROM section_review_summaries WHERE id = ?'
      )
      .get(review.id) as { deletedAt: string | null; deletedBy: string | null } | undefined;
    expect(row?.deletedAt).toBeTruthy();
    expect(row?.deletedBy).toBe(APPROVER_ID);
  });
});

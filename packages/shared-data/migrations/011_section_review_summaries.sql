-- Section Review Summaries Table
-- Migration 011: Review workflow tracking for section drafts
-- Feature: 007-epic-2-story

CREATE TABLE IF NOT EXISTS section_review_summaries (
    id TEXT PRIMARY KEY,
    section_id TEXT NOT NULL,
    document_id TEXT NOT NULL,
    draft_id TEXT NOT NULL,
    reviewer_id TEXT NOT NULL,
    review_status TEXT NOT NULL,
    reviewer_note TEXT NOT NULL,
    submitted_at TEXT NOT NULL,
    decided_at TEXT NULL,
    created_at TEXT NOT NULL,
    created_by TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    updated_by TEXT NOT NULL,
    deleted_at TEXT NULL,
    deleted_by TEXT NULL,
    FOREIGN KEY (section_id) REFERENCES section_records(id) ON DELETE CASCADE,
    FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE,
    FOREIGN KEY (draft_id) REFERENCES section_drafts(id) ON DELETE CASCADE,
    FOREIGN KEY (reviewer_id) REFERENCES users(id) ON DELETE CASCADE,
    CHECK (review_status IN ('pending', 'approved', 'changes_requested')),
    CHECK (length(reviewer_note) <= 2000),
    CHECK (decided_at IS NULL OR decided_at >= submitted_at),
    CHECK (length(created_by) > 0),
    CHECK (length(updated_by) > 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_section_review_summaries_draft
    ON section_review_summaries(draft_id);
CREATE INDEX IF NOT EXISTS idx_section_review_summaries_section_status
    ON section_review_summaries(section_id, review_status);
CREATE INDEX IF NOT EXISTS idx_section_review_summaries_reviewer
    ON section_review_summaries(reviewer_id);

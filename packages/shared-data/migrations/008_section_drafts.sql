-- Section Drafts Table
-- Migration 008: Manual draft storage for section editor workflow
-- Feature: 007-epic-2-story

CREATE TABLE IF NOT EXISTS section_drafts (
    id TEXT PRIMARY KEY,
    section_id TEXT NOT NULL,
    document_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    draft_version INTEGER NOT NULL,
    draft_base_version INTEGER NOT NULL,
    content_markdown TEXT NOT NULL,
    summary_note TEXT NOT NULL DEFAULT '',
    conflict_state TEXT NOT NULL DEFAULT 'clean',
    conflict_reason TEXT NULL,
    rebased_at TEXT NULL,
    saved_at TEXT NOT NULL,
    saved_by TEXT NOT NULL,
    created_at TEXT NOT NULL,
    created_by TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    updated_by TEXT NOT NULL,
    deleted_at TEXT NULL,
    deleted_by TEXT NULL,
    FOREIGN KEY (section_id) REFERENCES section_records(id) ON DELETE CASCADE,
    FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CHECK (draft_version > 0),
    CHECK (draft_base_version >= 0),
    CHECK (conflict_state IN ('clean', 'rebase_required', 'rebased', 'blocked')),
    CHECK (conflict_reason IS NULL OR length(conflict_reason) <= 500),
    CHECK (length(summary_note) <= 500),
    CHECK (length(content_markdown) <= 80000),
    CHECK (length(saved_by) > 0),
    CHECK (length(created_by) > 0),
    CHECK (length(updated_by) > 0)
);

CREATE INDEX IF NOT EXISTS idx_section_drafts_section
    ON section_drafts(section_id);
CREATE INDEX IF NOT EXISTS idx_section_drafts_document
    ON section_drafts(document_id);
CREATE INDEX IF NOT EXISTS idx_section_drafts_user
    ON section_drafts(user_id);
CREATE INDEX IF NOT EXISTS idx_section_drafts_conflict_state
    ON section_drafts(conflict_state);
CREATE UNIQUE INDEX IF NOT EXISTS idx_section_drafts_section_user_version
    ON section_drafts(section_id, user_id, draft_version);

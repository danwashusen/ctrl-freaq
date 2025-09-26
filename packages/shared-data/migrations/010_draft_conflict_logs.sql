-- Draft Conflict Logs Table
-- Migration 010: Conflict detection audit trail for manual drafts
-- Feature: 007-epic-2-story

CREATE TABLE IF NOT EXISTS draft_conflict_logs (
    id TEXT PRIMARY KEY,
    section_id TEXT NOT NULL,
    draft_id TEXT NOT NULL,
    detected_at TEXT NOT NULL,
    detected_during TEXT NOT NULL,
    previous_approved_version INTEGER NOT NULL,
    latest_approved_version INTEGER NOT NULL,
    resolved_by TEXT NULL,
    resolution_note TEXT NULL,
    created_at TEXT NOT NULL,
    created_by TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    updated_by TEXT NOT NULL,
    deleted_at TEXT NULL,
    deleted_by TEXT NULL,
    FOREIGN KEY (section_id) REFERENCES section_records(id) ON DELETE CASCADE,
    FOREIGN KEY (draft_id) REFERENCES section_drafts(id) ON DELETE CASCADE,
    CHECK (detected_during IN ('entry', 'save')),
    CHECK (previous_approved_version >= 0),
    CHECK (latest_approved_version >= 0),
    CHECK (latest_approved_version > previous_approved_version),
    CHECK (resolved_by IS NULL OR resolved_by IN ('auto_rebase', 'manual_reapply', 'abandoned')),
    CHECK (resolution_note IS NULL OR length(resolution_note) <= 1000),
    CHECK (length(created_by) > 0),
    CHECK (length(updated_by) > 0)
);

CREATE INDEX IF NOT EXISTS idx_draft_conflict_logs_section
    ON draft_conflict_logs(section_id);
CREATE INDEX IF NOT EXISTS idx_draft_conflict_logs_draft
    ON draft_conflict_logs(draft_id);
CREATE INDEX IF NOT EXISTS idx_draft_conflict_logs_detected_at
    ON draft_conflict_logs(detected_at DESC);

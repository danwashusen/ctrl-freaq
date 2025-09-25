-- Formatting Annotations Table
-- Migration 009: Unsupported formatting markers for manual drafts
-- Feature: 007-epic-2-story

CREATE TABLE IF NOT EXISTS formatting_annotations (
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
    deleted_at TEXT NULL,
    deleted_by TEXT NULL,
    FOREIGN KEY (section_id) REFERENCES section_records(id) ON DELETE CASCADE,
    FOREIGN KEY (draft_id) REFERENCES section_drafts(id) ON DELETE CASCADE,
    CHECK (start_offset >= 0),
    CHECK (end_offset > start_offset),
    CHECK (severity IN ('warning', 'error')),
    CHECK (length(mark_type) <= 100),
    CHECK (length(message) <= 500),
    CHECK (length(created_by) > 0),
    CHECK (length(updated_by) > 0)
);

CREATE INDEX IF NOT EXISTS idx_formatting_annotations_section
    ON formatting_annotations(section_id);
CREATE INDEX IF NOT EXISTS idx_formatting_annotations_draft
    ON formatting_annotations(draft_id);
CREATE INDEX IF NOT EXISTS idx_formatting_annotations_severity
    ON formatting_annotations(severity);

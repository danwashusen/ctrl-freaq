-- Section Record Versions Table
-- Migration 007: Canonical section record storage with approval audit fields
-- Feature: 007-epic-2-story

CREATE TABLE IF NOT EXISTS section_records (
    id TEXT PRIMARY KEY,
    document_id TEXT NOT NULL,
    template_key TEXT NOT NULL,
    title TEXT NOT NULL,
    depth INTEGER NOT NULL DEFAULT 0,
    order_index INTEGER NOT NULL,
    approved_version INTEGER NOT NULL DEFAULT 0,
    approved_content TEXT NOT NULL DEFAULT '',
    approved_at TEXT NULL,
    approved_by TEXT NULL,
    last_summary TEXT NULL,
    status TEXT NOT NULL DEFAULT 'idle',
    quality_gate TEXT NOT NULL DEFAULT 'pending',
    accessibility_score REAL NULL,
    created_at TEXT NOT NULL,
    created_by TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    updated_by TEXT NOT NULL,
    deleted_at TEXT NULL,
    deleted_by TEXT NULL,
    FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE,
    CHECK (depth >= 0 AND depth <= 5),
    CHECK (order_index >= 0),
    CHECK (approved_version >= 0),
    CHECK (status IN ('idle', 'drafting', 'review', 'ready')),
    CHECK (quality_gate IN ('pending', 'passed', 'failed')),
    CHECK (accessibility_score IS NULL OR (accessibility_score >= 0 AND accessibility_score <= 100)),
    CHECK (last_summary IS NULL OR length(last_summary) <= 1000),
    CHECK (length(template_key) <= 100),
    CHECK (length(title) <= 255),
    CHECK (length(created_by) > 0),
    CHECK (length(updated_by) > 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_section_records_document_template
    ON section_records(document_id, template_key);
CREATE INDEX IF NOT EXISTS idx_section_records_document_status
    ON section_records(document_id, status);
CREATE INDEX IF NOT EXISTS idx_section_records_document_order
    ON section_records(document_id, order_index);

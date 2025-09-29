-- Assumption Sessions Tables
-- Migration 012: Assumption-first authoring workflow support
-- Feature: 009-epic-2-story-4

CREATE TABLE IF NOT EXISTS assumption_sessions (
    id TEXT PRIMARY KEY,
    section_id TEXT NOT NULL,
    document_id TEXT NOT NULL,
    started_by TEXT NOT NULL,
    started_at TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'in_progress',
    template_version TEXT NOT NULL,
    decision_snapshot_id TEXT NULL,
    unresolved_override_count INTEGER NOT NULL DEFAULT 0,
    answered_count INTEGER NOT NULL DEFAULT 0,
    deferred_count INTEGER NOT NULL DEFAULT 0,
    escalated_count INTEGER NOT NULL DEFAULT 0,
    override_count INTEGER NOT NULL DEFAULT 0,
    latest_proposal_id TEXT NULL,
    summary_markdown TEXT NULL,
    closed_at TEXT NULL,
    closed_by TEXT NULL,
    created_at TEXT NOT NULL,
    created_by TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    updated_by TEXT NOT NULL,
    deleted_at TEXT NULL,
    deleted_by TEXT NULL,
    FOREIGN KEY (section_id) REFERENCES section_records(id) ON DELETE CASCADE,
    FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE,
    FOREIGN KEY (started_by) REFERENCES users(id) ON DELETE CASCADE,
    CHECK (status IN ('in_progress', 'awaiting_draft', 'drafting', 'blocked', 'ready')),
    CHECK (unresolved_override_count >= 0),
    CHECK (answered_count >= 0),
    CHECK (deferred_count >= 0),
    CHECK (escalated_count >= 0),
    CHECK (override_count >= 0),
    CHECK (length(template_version) > 0),
    CHECK (length(created_by) > 0),
    CHECK (length(updated_by) > 0)
);

CREATE INDEX IF NOT EXISTS idx_assumption_sessions_section
    ON assumption_sessions(section_id);
CREATE INDEX IF NOT EXISTS idx_assumption_sessions_document
    ON assumption_sessions(document_id);
CREATE INDEX IF NOT EXISTS idx_assumption_sessions_status
    ON assumption_sessions(status);

CREATE TABLE IF NOT EXISTS section_assumptions (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    section_id TEXT NOT NULL,
    document_id TEXT NOT NULL,
    template_key TEXT NOT NULL,
    prompt_heading TEXT NOT NULL,
    prompt_body TEXT NOT NULL,
    response_type TEXT NOT NULL,
    options_json TEXT NOT NULL DEFAULT '[]',
    priority INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'pending',
    answer_value_json TEXT NULL,
    answer_notes TEXT NULL,
    override_justification TEXT NULL,
    conflict_decision_id TEXT NULL,
    conflict_resolved_at TEXT NULL,
    created_at TEXT NOT NULL,
    created_by TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    updated_by TEXT NOT NULL,
    deleted_at TEXT NULL,
    deleted_by TEXT NULL,
    FOREIGN KEY (session_id) REFERENCES assumption_sessions(id) ON DELETE CASCADE,
    FOREIGN KEY (section_id) REFERENCES section_records(id) ON DELETE CASCADE,
    FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE,
    CHECK (response_type IN ('single_select', 'multi_select', 'text')),
    CHECK (status IN ('pending', 'answered', 'deferred', 'escalated', 'override_skipped')),
    CHECK (priority >= 0),
    CHECK (length(template_key) > 0),
    CHECK (length(created_by) > 0),
    CHECK (length(updated_by) > 0)
);

CREATE INDEX IF NOT EXISTS idx_section_assumptions_session_priority
    ON section_assumptions(session_id, priority);
CREATE INDEX IF NOT EXISTS idx_section_assumptions_template
    ON section_assumptions(template_key);
CREATE INDEX IF NOT EXISTS idx_section_assumptions_status
    ON section_assumptions(status);

CREATE TABLE IF NOT EXISTS draft_proposals (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    section_id TEXT NOT NULL,
    proposal_index INTEGER NOT NULL,
    source TEXT NOT NULL,
    content_markdown TEXT NOT NULL,
    rationale_json TEXT NOT NULL,
    ai_confidence REAL NULL,
    failed_reason TEXT NULL,
    created_at TEXT NOT NULL,
    created_by TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    updated_by TEXT NOT NULL,
    superseded_at TEXT NULL,
    superseded_by_proposal_id TEXT NULL,
    deleted_at TEXT NULL,
    deleted_by TEXT NULL,
    FOREIGN KEY (session_id) REFERENCES assumption_sessions(id) ON DELETE CASCADE,
    FOREIGN KEY (section_id) REFERENCES section_records(id) ON DELETE CASCADE,
    CHECK (proposal_index >= 0),
    CHECK (source IN ('ai_generated', 'manual_revision', 'ai_retry', 'fallback_manual')),
    CHECK (ai_confidence IS NULL OR (ai_confidence >= 0 AND ai_confidence <= 1)),
    CHECK (length(created_by) > 0),
    CHECK (length(updated_by) > 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_draft_proposals_session_index
    ON draft_proposals(session_id, proposal_index);
CREATE INDEX IF NOT EXISTS idx_draft_proposals_section
    ON draft_proposals(section_id);

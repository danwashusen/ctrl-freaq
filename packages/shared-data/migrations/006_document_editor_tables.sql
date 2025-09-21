-- Document Editor Core Infrastructure Tables
-- Migration 006: Add tables for section views, pending changes, and editor sessions
-- Feature: 006-story-2-2

-- Create sections table for document section view state
CREATE TABLE IF NOT EXISTS sections (
    id TEXT PRIMARY KEY,
    doc_id TEXT NOT NULL,
    parent_section_id TEXT NULL,
    key TEXT NOT NULL,
    title TEXT NOT NULL,
    depth INTEGER NOT NULL DEFAULT 0,
    order_index INTEGER NOT NULL DEFAULT 0,

    -- Content states
    content_markdown TEXT NOT NULL DEFAULT '',
    placeholder_text TEXT NOT NULL DEFAULT '',
    has_content BOOLEAN NOT NULL DEFAULT 0,

    -- Editor states
    view_state TEXT NOT NULL DEFAULT 'idle',
    editing_user TEXT NULL,
    last_modified TEXT NOT NULL,

    -- Section lifecycle
    status TEXT NOT NULL DEFAULT 'idle',
    assumptions_resolved BOOLEAN NOT NULL DEFAULT 0,
    quality_gate_status TEXT NULL,

    -- Base entity fields
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,

    -- Foreign key constraints
    FOREIGN KEY (doc_id) REFERENCES documents(id) ON DELETE CASCADE,
    FOREIGN KEY (parent_section_id) REFERENCES sections(id) ON DELETE CASCADE,

    -- Constraints
    CHECK (depth >= 0 AND depth <= 5),
    CHECK (order_index >= 0),
    CHECK (view_state IN ('idle', 'read_mode', 'edit_mode', 'saving')),
    CHECK (status IN ('idle', 'assumptions', 'drafting', 'review', 'ready')),
    CHECK (quality_gate_status IS NULL OR quality_gate_status IN ('pending', 'passed', 'failed')),
    CHECK (length(content_markdown) <= 100000),
    CHECK (length(title) <= 255),
    CHECK (length(key) <= 100),
    CHECK (length(placeholder_text) <= 1000)
);

-- Create indexes for sections table
CREATE INDEX IF NOT EXISTS idx_sections_doc_id ON sections(doc_id);
CREATE INDEX IF NOT EXISTS idx_sections_parent_section_id ON sections(parent_section_id);
CREATE INDEX IF NOT EXISTS idx_sections_doc_id_order ON sections(doc_id, parent_section_id, order_index);
CREATE INDEX IF NOT EXISTS idx_sections_view_state ON sections(view_state);
CREATE INDEX IF NOT EXISTS idx_sections_status ON sections(status);
CREATE INDEX IF NOT EXISTS idx_sections_has_content ON sections(has_content);
CREATE UNIQUE INDEX IF NOT EXISTS idx_sections_doc_key ON sections(doc_id, key);

-- Create pending_changes table for tracking unsaved section changes
CREATE TABLE IF NOT EXISTS pending_changes (
    id TEXT PRIMARY KEY,
    section_id TEXT NOT NULL,
    document_id TEXT NOT NULL,

    -- Patch data (JSON serialized)
    patches TEXT NOT NULL, -- JSON array of PatchDiff objects
    original_content TEXT NOT NULL,
    preview_content TEXT NOT NULL,

    -- Metadata
    created_at TEXT NOT NULL,
    created_by TEXT NOT NULL,
    session_id TEXT NOT NULL,

    -- State
    status TEXT NOT NULL DEFAULT 'pending',
    conflicts_with TEXT NOT NULL DEFAULT '[]', -- JSON array of conflicting change IDs

    -- Base entity fields
    updated_at TEXT NOT NULL,

    -- Foreign key constraints
    FOREIGN KEY (section_id) REFERENCES sections(id) ON DELETE CASCADE,
    FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE,

    -- Constraints
    CHECK (status IN ('pending', 'applying', 'applied', 'failed')),
    CHECK (length(patches) > 0),
    CHECK (length(created_by) > 0),
    CHECK (length(session_id) > 0)
);

-- Create indexes for pending_changes table
CREATE INDEX IF NOT EXISTS idx_pending_changes_section_id ON pending_changes(section_id);
CREATE INDEX IF NOT EXISTS idx_pending_changes_document_id ON pending_changes(document_id);
CREATE INDEX IF NOT EXISTS idx_pending_changes_session_id ON pending_changes(session_id);
CREATE INDEX IF NOT EXISTS idx_pending_changes_status ON pending_changes(status);
CREATE INDEX IF NOT EXISTS idx_pending_changes_created_by ON pending_changes(created_by);
CREATE INDEX IF NOT EXISTS idx_pending_changes_created_at ON pending_changes(created_at);
CREATE INDEX IF NOT EXISTS idx_pending_changes_section_status ON pending_changes(section_id, status);

-- Create editor_sessions table for managing active editing sessions
CREATE TABLE IF NOT EXISTS editor_sessions (
    id TEXT PRIMARY KEY,
    document_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    session_id TEXT NOT NULL,

    -- Navigation state
    active_section_id TEXT NULL,
    expanded_sections TEXT NOT NULL DEFAULT '[]', -- JSON array of section IDs
    scroll_position REAL NOT NULL DEFAULT 0,

    -- Editor configuration
    editor_mode TEXT NOT NULL DEFAULT 'wysiwyg',
    show_diff_view BOOLEAN NOT NULL DEFAULT 0,
    auto_save_enabled BOOLEAN NOT NULL DEFAULT 1,
    auto_save_interval INTEGER NOT NULL DEFAULT 30000,

    -- Collaboration (JSON serialized)
    collaborators TEXT NOT NULL DEFAULT '[]', -- JSON array of Collaborator objects

    -- Performance metrics
    last_save_time REAL NOT NULL DEFAULT 0,
    pending_change_count INTEGER NOT NULL DEFAULT 0,

    -- Base entity fields
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,

    -- Foreign key constraints
    FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE,
    FOREIGN KEY (active_section_id) REFERENCES sections(id) ON DELETE SET NULL,

    -- Constraints
    CHECK (scroll_position >= 0),
    CHECK (editor_mode IN ('wysiwyg', 'markdown', 'preview')),
    CHECK (auto_save_interval >= 10000), -- Minimum 10 seconds
    CHECK (last_save_time >= 0),
    CHECK (pending_change_count >= 0),
    CHECK (length(user_id) > 0),
    CHECK (length(session_id) > 0)
);

-- Create indexes for editor_sessions table
CREATE INDEX IF NOT EXISTS idx_editor_sessions_document_id ON editor_sessions(document_id);
CREATE INDEX IF NOT EXISTS idx_editor_sessions_user_id ON editor_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_editor_sessions_session_id ON editor_sessions(session_id);
CREATE INDEX IF NOT EXISTS idx_editor_sessions_active_section_id ON editor_sessions(active_section_id);
CREATE INDEX IF NOT EXISTS idx_editor_sessions_updated_at ON editor_sessions(updated_at);
CREATE UNIQUE INDEX IF NOT EXISTS idx_editor_sessions_doc_user ON editor_sessions(document_id, user_id);

-- Create triggers for automatic timestamp updates
CREATE TRIGGER IF NOT EXISTS sections_updated_at
    AFTER UPDATE ON sections
    FOR EACH ROW
    WHEN NEW.updated_at = OLD.updated_at
BEGIN
    UPDATE sections SET updated_at = datetime('now') WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS pending_changes_updated_at
    AFTER UPDATE ON pending_changes
    FOR EACH ROW
    WHEN NEW.updated_at = OLD.updated_at
BEGIN
    UPDATE pending_changes SET updated_at = datetime('now') WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS editor_sessions_updated_at
    AFTER UPDATE ON editor_sessions
    FOR EACH ROW
    WHEN NEW.updated_at = OLD.updated_at
BEGIN
    UPDATE editor_sessions SET updated_at = datetime('now') WHERE id = NEW.id;
END;

-- Create view for section hierarchy (useful for ToC generation)
CREATE VIEW IF NOT EXISTS section_hierarchy AS
WITH RECURSIVE section_tree AS (
    -- Base case: root sections
    SELECT
        id,
        doc_id,
        parent_section_id,
        key,
        title,
        depth,
        order_index,
        has_content,
        status,
        view_state,
        0 as tree_level,
        CAST(order_index AS TEXT) as sort_path
    FROM sections
    WHERE parent_section_id IS NULL

    UNION ALL

    -- Recursive case: child sections
    SELECT
        s.id,
        s.doc_id,
        s.parent_section_id,
        s.key,
        s.title,
        s.depth,
        s.order_index,
        s.has_content,
        s.status,
        s.view_state,
        st.tree_level + 1,
        st.sort_path || '.' || CAST(s.order_index AS TEXT)
    FROM sections s
    INNER JOIN section_tree st ON s.parent_section_id = st.id
)
SELECT * FROM section_tree
ORDER BY doc_id, sort_path;

-- Create view for pending changes summary
CREATE VIEW IF NOT EXISTS pending_changes_summary AS
SELECT
    section_id,
    document_id,
    COUNT(*) as total_changes,
    COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_count,
    COUNT(CASE WHEN status = 'applying' THEN 1 END) as applying_count,
    COUNT(CASE WHEN status = 'applied' THEN 1 END) as applied_count,
    COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_count,
    MIN(created_at) as oldest_change,
    MAX(created_at) as newest_change
FROM pending_changes
GROUP BY section_id, document_id;

-- Create view for active editing sessions
CREATE VIEW IF NOT EXISTS active_editor_sessions AS
SELECT
    es.*,
    s.title as active_section_title,
    datetime(es.updated_at, '+30 minutes') > datetime('now') as is_recently_active
FROM editor_sessions es
LEFT JOIN sections s ON es.active_section_id = s.id
WHERE datetime(es.updated_at, '+2 hours') > datetime('now'); -- Sessions active within 2 hours
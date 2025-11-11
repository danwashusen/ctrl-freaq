-- Migration 013: Ensure every section has a canonical section_records row
-- Story: Surface Document Editor - section record seeding

INSERT INTO section_records (
    id,
    document_id,
    template_key,
    title,
    depth,
    order_index,
    approved_version,
    approved_content,
    approved_at,
    approved_by,
    last_summary,
    status,
    quality_gate,
    accessibility_score,
    created_at,
    created_by,
    updated_at,
    updated_by,
    deleted_at,
    deleted_by
)
SELECT
    s.id,
    s.doc_id,
    s.key,
    s.title,
    s.depth,
    s.order_index,
    0,
    '',
    NULL,
    NULL,
    NULL,
    'idle',
    'pending',
    NULL,
    COALESCE(s.created_at, datetime('now')),
    'section_record_seed',
    COALESCE(s.updated_at, datetime('now')),
    'section_record_seed',
    NULL,
    NULL
FROM sections s
WHERE NOT EXISTS (
    SELECT 1
    FROM section_records sr
    WHERE sr.id = s.id AND (sr.deleted_at IS NULL OR sr.deleted_at = '')
);

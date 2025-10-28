-- Backfill legacy archived projects lacking pre-archive status snapshots.
-- Earlier migrations upgraded archived records but left `archived_status_before`
-- empty, which breaks runtime validation. Populate those rows with the
-- fallback restored status so restore flows and API listings remain stable.

UPDATE projects
SET archived_status_before = 'paused'
WHERE status = 'archived'
  AND (archived_status_before IS NULL OR archived_status_before = '')
  AND deleted_at IS NOT NULL
  AND deleted_at != '';

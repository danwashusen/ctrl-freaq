-- Project lifecycle migration
-- Adds lifecycle metadata columns, removes single-project uniqueness,
-- and seeds archived projects with lifecycle defaults.

PRAGMA foreign_keys = OFF;

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY
);

CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  owner_user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  created_at TEXT NOT NULL,
  created_by TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  updated_by TEXT NOT NULL,
  deleted_at TEXT,
  deleted_by TEXT
);

DROP TABLE IF EXISTS projects_lifecycle_new;

CREATE TABLE projects_lifecycle_new (
  id TEXT PRIMARY KEY,
  owner_user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  visibility TEXT NOT NULL DEFAULT 'workspace' CHECK (visibility IN ('private', 'workspace')),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'paused', 'completed', 'archived')),
  archived_status_before TEXT CHECK (
    archived_status_before IS NULL OR archived_status_before IN ('draft', 'active', 'paused', 'completed')
  ),
  goal_target_date TEXT,
  goal_summary TEXT,
  created_at TEXT NOT NULL,
  created_by TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  updated_by TEXT NOT NULL,
  deleted_at TEXT,
  deleted_by TEXT,
  FOREIGN KEY (owner_user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET DEFAULT,
  FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET DEFAULT,
  FOREIGN KEY (deleted_by) REFERENCES users(id) ON DELETE SET NULL
);

INSERT INTO projects_lifecycle_new (
  id,
  owner_user_id,
  name,
  slug,
  description,
  visibility,
  status,
  archived_status_before,
  goal_target_date,
  goal_summary,
  created_at,
  created_by,
  updated_at,
  updated_by,
  deleted_at,
  deleted_by
)
SELECT
  id,
  owner_user_id,
  name,
  slug,
  description,
  'workspace' AS visibility,
  CASE
    WHEN deleted_at IS NOT NULL AND deleted_at != '' THEN 'archived'
    ELSE 'draft'
  END AS status,
  NULL AS archived_status_before,
  NULL AS goal_target_date,
  NULL AS goal_summary,
  created_at,
  created_by,
  updated_at,
  updated_by,
  deleted_at,
  CASE
    WHEN deleted_at IS NOT NULL AND (deleted_by IS NULL OR deleted_by = '')
      THEN 'system'
    ELSE deleted_by
  END AS deleted_by
FROM projects;

DROP TABLE projects;

ALTER TABLE projects_lifecycle_new RENAME TO projects;

CREATE INDEX IF NOT EXISTS idx_projects_owner ON projects(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_projects_owner_deleted ON projects(owner_user_id, deleted_at);
CREATE INDEX IF NOT EXISTS idx_projects_slug ON projects(slug);

PRAGMA foreign_keys = ON;

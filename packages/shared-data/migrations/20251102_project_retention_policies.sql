CREATE TABLE IF NOT EXISTS project_retention_policies (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL UNIQUE,
  policy_id TEXT NOT NULL,
  retention_window TEXT NOT NULL,
  guidance TEXT NOT NULL,
  created_at TEXT NOT NULL,
  created_by TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  updated_by TEXT NOT NULL,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_project_retention_policies_project_id
  ON project_retention_policies(project_id);

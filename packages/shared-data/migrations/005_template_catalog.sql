-- Ensure documents table exists before adding template metadata columns
CREATE TABLE IF NOT EXISTS documents (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  title TEXT NOT NULL,
  content_json TEXT NOT NULL,
  template_id TEXT,
  template_version TEXT,
  template_schema_hash TEXT,
  created_at TEXT NOT NULL,
  created_by TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  updated_by TEXT NOT NULL,
  deleted_at TEXT,
  deleted_by TEXT
);

CREATE TABLE IF NOT EXISTS document_templates (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  document_type TEXT NOT NULL,
  active_version_id TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  default_aggressiveness TEXT,
  created_at TEXT NOT NULL,
  created_by TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  updated_by TEXT NOT NULL,
  deleted_at TEXT,
  deleted_by TEXT
);

CREATE TABLE IF NOT EXISTS template_versions (
  id TEXT PRIMARY KEY,
  template_id TEXT NOT NULL,
  version TEXT NOT NULL,
  status TEXT NOT NULL,
  changelog TEXT,
  schema_hash TEXT NOT NULL,
  schema_json TEXT NOT NULL,
  sections_json TEXT NOT NULL,
  source_path TEXT NOT NULL,
  published_at TEXT,
  published_by TEXT,
  deprecated_at TEXT,
  deprecated_by TEXT,
  created_at TEXT NOT NULL,
  created_by TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  updated_by TEXT NOT NULL,
  FOREIGN KEY (template_id) REFERENCES document_templates(id) ON DELETE CASCADE,
  UNIQUE (template_id, version)
);

CREATE TABLE IF NOT EXISTS document_template_migrations (
  id TEXT PRIMARY KEY,
  document_id TEXT NOT NULL,
  from_version TEXT NOT NULL,
  to_version TEXT NOT NULL,
  status TEXT NOT NULL,
  validation_errors TEXT,
  initiated_by TEXT NOT NULL,
  initiated_at TEXT NOT NULL,
  completed_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_template_versions_template_status
  ON template_versions (template_id, status);

CREATE INDEX IF NOT EXISTS idx_template_versions_schema_hash
  ON template_versions (schema_hash);

CREATE INDEX IF NOT EXISTS idx_document_template_migrations_document
  ON document_template_migrations (document_id, initiated_at DESC);


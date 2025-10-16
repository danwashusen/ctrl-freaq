-- Quality gates persistence tables

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS section_quality_gate_results (
  id TEXT PRIMARY KEY,
  section_id TEXT NOT NULL UNIQUE,
  document_id TEXT NOT NULL,
  run_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('Blocker', 'Warning', 'Pass', 'Neutral')),
  rules TEXT NOT NULL,
  last_run_at TEXT,
  last_success_at TEXT,
  triggered_by TEXT NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('auto', 'manual', 'dashboard')),
  duration_ms INTEGER NOT NULL CHECK (duration_ms >= 0),
  remediation_state TEXT NOT NULL CHECK (remediation_state IN ('pending', 'in-progress', 'resolved')),
  incident_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_quality_gate_results_document
  ON section_quality_gate_results(document_id);

CREATE INDEX IF NOT EXISTS idx_quality_gate_results_status
  ON section_quality_gate_results(status);

CREATE TABLE IF NOT EXISTS document_quality_gate_summaries (
  id TEXT PRIMARY KEY,
  document_id TEXT NOT NULL UNIQUE,
  status_counts TEXT NOT NULL,
  blocker_sections TEXT NOT NULL,
  warning_sections TEXT NOT NULL,
  last_run_at TEXT,
  triggered_by TEXT NOT NULL,
  request_id TEXT NOT NULL,
  publish_blocked INTEGER NOT NULL CHECK (publish_blocked IN (0, 1)),
  coverage_gaps TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_quality_gate_summaries_document
  ON document_quality_gate_summaries(document_id);

CREATE TABLE IF NOT EXISTS traceability_links (
  id TEXT PRIMARY KEY,
  requirement_id TEXT NOT NULL,
  section_id TEXT NOT NULL,
  document_id TEXT NOT NULL,
  revision_id TEXT NOT NULL,
  gate_status TEXT NOT NULL CHECK (gate_status IN ('Blocker', 'Warning', 'Pass', 'Neutral')),
  coverage_status TEXT NOT NULL CHECK (coverage_status IN ('covered', 'warning', 'blocker', 'orphaned')),
  last_validated_at TEXT NOT NULL,
  validated_by TEXT NOT NULL,
  notes TEXT NOT NULL,
  audit_trail TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(requirement_id, section_id)
);

CREATE INDEX IF NOT EXISTS idx_traceability_links_document
  ON traceability_links(document_id);

CREATE INDEX IF NOT EXISTS idx_traceability_links_coverage
  ON traceability_links(coverage_status);

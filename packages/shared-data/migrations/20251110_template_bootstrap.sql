-- Bootstrap the default architecture-reference template and version.
-- Ensures both document_templates and template_versions contain canonical rows.

INSERT INTO document_templates (
  id,
  name,
  description,
  document_type,
  active_version_id,
  status,
  default_aggressiveness,
  created_at,
  created_by,
  updated_at,
  updated_by,
  deleted_at,
  deleted_by
)
VALUES (
  'architecture-reference',
  'Architecture Reference Document',
  NULL,
  'architecture',
  'b61a3d62-2e4f-4d1c-9b0f-5e9950a3c321',
  'active',
  NULL,
  datetime('now'),
  'system_template_bootstrap',
  datetime('now'),
  'system_template_bootstrap',
  NULL,
  NULL
)
ON CONFLICT(id) DO UPDATE SET
  name = excluded.name,
  description = excluded.description,
  document_type = excluded.document_type,
  status = excluded.status,
  default_aggressiveness = excluded.default_aggressiveness,
  active_version_id = excluded.active_version_id,
  updated_at = excluded.updated_at,
  updated_by = excluded.updated_by;

INSERT INTO template_versions (
  id,
  template_id,
  version,
  status,
  changelog,
  schema_hash,
  schema_json,
  sections_json,
  source_path,
  published_at,
  published_by,
  deprecated_at,
  deprecated_by,
  created_at,
  created_by,
  updated_at,
  updated_by
)
VALUES (
  'b61a3d62-2e4f-4d1c-9b0f-5e9950a3c321',
  'architecture-reference',
  '2.1.0',
  'active',
  NULL,
  'e4da6c86723feba8843017296d64a4b31f9e2691a4df59012665356e39f564bb',
  '{"type":"object","additionalProperties":false,"properties":{"architecture-overview":{"type":"string"},"system-architecture":{"type":"object","properties":{"system-components":{"type":"string"},"integration-surface":{"type":"string"}},"required":["system-components"]},"delivery-and-risk":{"type":"string"}},"required":["architecture-overview","system-architecture"]}',
  '[{"id":"architecture-overview","title":"Architecture Overview","orderIndex":1,"required":true,"type":"markdown","guidance":"Summarize the current architecture, highlighting critical systems,\\nintegrations, and the primary objective of this engagement. Focus on\\nwhat has changed since the last update and any executive takeaways.\\n","fields":[],"children":[]},{"id":"system-architecture","title":"System Architecture","orderIndex":2,"required":true,"type":"markdown","guidance":"Describe the major components, data flows, and external services.\\nCapture diagrams, ownership, and key quality attributes. Explain how\\nthe system satisfies reliability, scalability, and compliance targets.\\n","fields":[],"children":[{"id":"system-components","title":"Core Components","orderIndex":1,"required":true,"type":"markdown","guidance":"Document each core component, the responsibility boundaries, and the\\nassociated runtime profiles. Include any service-level objectives.\\n","fields":[],"children":[]},{"id":"integration-surface","title":"Integration Surface","orderIndex":2,"required":false,"type":"markdown","guidance":"List partner systems, sync schedules, auth strategies, and failure\\nhandling. Call out any contracts or schema dependencies.\\n","fields":[],"children":[]}]},{"id":"delivery-and-risk","title":"Delivery & Risk","orderIndex":3,"required":false,"type":"markdown","guidance":"Capture milestones, responsible parties, and tracked risks. Note the\\nmitigations, open questions, and escalation paths that require follow up.\\n","fields":[],"children":[]}]',
  'templates/architecture-reference.yaml',
  datetime('now'),
  'system_template_bootstrap',
  NULL,
  NULL,
  datetime('now'),
  'system_template_bootstrap',
  datetime('now'),
  'system_template_bootstrap'
)
ON CONFLICT(id) DO UPDATE SET
  status = excluded.status,
  changelog = excluded.changelog,
  schema_hash = excluded.schema_hash,
  schema_json = excluded.schema_json,
  sections_json = excluded.sections_json,
  source_path = excluded.source_path,
  published_at = excluded.published_at,
  published_by = excluded.published_by,
  deprecated_at = excluded.deprecated_at,
  deprecated_by = excluded.deprecated_by,
  updated_at = excluded.updated_at,
  updated_by = excluded.updated_by;

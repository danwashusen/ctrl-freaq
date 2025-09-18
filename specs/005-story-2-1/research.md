# Research: Document Schema & Template System

## Standards Digest

- **Type Safety & Null Guards**: Avoid `any` and non-null assertions in template
  services. Bad: `const section = template.sections![0];` Good:
  `const section = template.sections?.[0] ?? createDefaultSection();`
- **Intentional Unused Markers**: Prefix placeholder params with `_` in service
  locator registrations. Bad:
  `services.register('templates', (req, res) => loadTemplate(req));` Good:
  `services.register('templates', (_req, _res, locator) => loadTemplate(locator));`
- **ESM Imports with Extensions**: Use `import` syntax and include `.js` on
  local paths. Bad: `const resolver = require('./template-resolver');` Good:
  `import { resolver } from './template-resolver.js';`
- **TDD Enforcement**: Write failing Vitest specs for template versioning before
  implementation. Bad: Shipping resolver logic without tests. Good:
  Red-Green-Refactor around schema migration scenarios.

## UI Standards Digest

- Propagate backend correlation IDs through client logs and align with API error
  envelopes.
- Keep template editor state immutable. Bad:
  `templateState.sections.push(newSection);` Good:
  `set(state => ({ sections: [...state.sections, newSection] }));`
- Validate all template-related API responses with Zod before updating UI state;
  surface loading and error states.
- Enforce WCAG-compliant focus management when blocking saves for validation
  errors; present guidance with semantic roles.
- Sanitize template-derived content before rendering and avoid
  `dangerouslySetInnerHTML`.

## Executive Summary

The research validates a library-first approach for managing document templates
with explicit versioning, leveraging YAML as the source of truth while
persisting compiled JSON schema snapshots for auditing and runtime validation.
Template workflows will introduce manager-facing publishing controls, shared
validation logic for backend and editor, and safety nets for documents bound to
deprecated versions.

## Research Findings

### 1. Template Catalog & Storage Format

**Decision**: Treat `.yaml` files in `templates/` as canonical template
definitions, compiled by `@ctrl-freaq/templates` into strongly-typed JSON schema
snapshots saved in SQLite via `@ctrl-freaq/shared-data` for auditing.

**Rationale**:

- YAML aligns with existing template authoring workflow and shadcn/CLI seeding
  (docs/front-end-spec.md).
- Persisted JSON schema enables version comparisons, rollback, and validation
  without re-reading the filesystem.
- Library-first requirement satisfied by confining parsing/compilation to
  `packages/templates` with CLI support.

**Implementation Approach**:

- Extend `packages/templates` with a `compileTemplate(filePath)` helper
  returning `{ template, schema }`.
- Introduce `TemplateCatalogRepository` in `packages/shared-data` to store
  `template_catalog` and `template_versions` records.
- Provide CLI command
  `pnpm --filter @ctrl-freaq/templates publish --file templates/architecture.yaml`
  that compiles, validates, and persists metadata.

**Alternatives Considered**:

- Storing templates solely in DB: rejected (breaks git-based workflow, harder
  diffing).
- JSON-only templates: rejected (loses authoring readability for managers).

### 2. Versioning & Publishing Workflow

**Decision**: Use semantic version strings managed by template managers, with
`template_versions` rows tracking status (`draft`, `active`, `deprecated`) and
`template_catalog.active_version_id` pointing to the current version.

**Rationale**:

- Aligns with FR-003 requirement for explicit version identifiers and rollback.
- SOC 2 audit trail demands history and change author metadata.
- Works with existing Document model fields (`templateId`, `templateVersion`).

**Implementation Approach**:

- New API endpoint `POST /api/v1/templates/:id/versions` accepts uploaded YAML +
  version number (manager scope) and stores compiled schema + metadata.
- Provide `POST /api/v1/templates/:id/versions/:version/activate` to promote a
  version, updating catalog active pointer and broadcasting event via WebSocket/
  SSE for editors.
- Add CLI support `templates activate --template architecture --version 1.2.0`
  for scripted promotion.
- Persist `published_at`, `published_by`, and `changelog` fields for audit
  records.

**Alternatives Considered**:

- Auto-increment versions: rejected (spec requires manager-managed version
  labels and audit notes).
- Allow multiple active versions per template: rejected (complicates editor
  logic; prefer single active pointer with fallback to document-specific version
  reference).

### 3. Runtime Validation Pipeline

**Decision**: Share Zod schemas across backend and frontend by exporting
compiled validators from `packages/templates`, consumed by `apps/api` request
hooks and `apps/web` editor state machine.

**Rationale**:

- FR-005 mandates validation during editing and before save/export; unified
  schema prevents drift.
- Aligns with UI standards for runtime response validation and error-state
  surfacing.
- Service Locator pattern allows injecting validators per request without
  singletons.

**Implementation Approach**:

- `packages/templates` exports `createTemplateValidator(templateId, version)`
  returning Zod schema for sections/fields.
- Backend: middleware obtains validator, checks payloads on document
  create/update, raises `ValidationError` with pointer to failing fields.
- Frontend: editor store loads validator via `packages/template-resolver`, runs
  pre-save checks, and maps failures to inline UI guidance.
- Logging: record validation failures with correlation ID and sanitized field
  keys only.

**Alternatives Considered**:

- Custom validation logic per template: rejected (duplication, risk of
  divergence).
- Schema validation only on save: rejected (spec requires in-editor validation
  feedback).

### 4. Backwards Compatibility & Deprecations

**Decision**: Auto-upgrade drafts to the latest active template version on load,
and block editing entirely when a referenced version has been removed from the
catalog until a manager republishes or remaps the document.

**Rationale**:

- Guarantees editors work against a supported schema without manual
  intervention, satisfying FR-004/FR-005.
- Blocking edits for removed versions avoids invalid content capture and
  surfaces administrative follow-up immediately.
- Minimal MVP behavior reduces migration UI complexity while still capturing SOC
  2 audit trails.

**Implementation Approach**:

- On document load, API compares `templateVersion` to the catalog
  `activeVersion`; if different but available, run auto-upgrade (validate
  content, persist new version + schema hash, emit migration log).
- If the referenced version no longer exists, backend returns
  `409 TEMPLATE_VERSION_REMOVED`; editor disables inputs and displays
  remediation guidance until a manager reinstates a version.
- Auto-upgrade workflows create `DocumentTemplateMigration` entries
  (`status: succeeded|failed`) with sanitized validation issues when applicable.
- Retain `templates migrate` CLI for manual recovery scripts, but default editor
  path performs automatic upgrade.
- Structured logs include `upgradeStatus`, `fromVersion`, `toVersion`, and
  `requestId`.

**Alternatives Considered**:

- Manual opt-in migrations: rejected to meet auto-upgrade MVP requirement.
- Allowing edits on removed versions: rejected for compliance and data integrity
  risk.

## Outstanding Considerations

- _None (clarifications resolved)._

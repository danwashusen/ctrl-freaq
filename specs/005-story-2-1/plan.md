# Implementation Plan: Document Schema & Template System

**Branch**: `005-story-2-1` | **Date**: 2025-09-16 | **Spec**:
[spec.md](./spec.md) **Input**: Feature specification from
`/specs/005-story-2-1/spec.md`

## Execution Flow (/plan command scope)

```
1. Load feature spec from Input path
   ✓ Specification parsed (Document Schema & Template System)
2. Fill Technical Context (scan for NEEDS CLARIFICATION)
   ✓ Project Type detected: web (frontend + backend + shared libraries)
   ✓ Structure Decision: Option 2 (Monorepo frontend/backend + packages)
   ✓ Clarifications resolved: removed versions block editing; drafts auto-upgrade on load
3. Evaluate Constitution Check section below
   ✓ Library-first architecture preserved (packages/templates, template-resolver, shared-data)
   ✓ No singletons introduced; Service Locator integration planned
   ✓ Structured logging + Repository pattern confirmed
   ✓ Update Progress Tracking: Initial Constitution Check
4. Execute Phase 0 → research.md
   ✓ Standards Digest incorporated
   ✓ Research decisions recorded for storage format, versioning, validation, backward compatibility
5. Execute Phase 1 → contracts, data-model.md, quickstart.md, CLAUDE.md
   ✓ Data model extended with template catalog + versions + migrations
   ✓ OpenAPI contract drafted for template management endpoints
   ✓ Quickstart cover publish/activate/validation flows
   ✓ CLAUDE.md update planned (template system pointers)
6. Re-evaluate Constitution Check section
   ✓ Post-design review - architecture + testing requirements satisfied
   ✓ Update Progress Tracking: Post-Design Constitution Check
7. Plan Phase 2 → Describe task generation approach (DO NOT create tasks.md)
8. STOP - Ready for /tasks command
```

## Summary

Document Schema & Template System delivers a governed template catalog with
explicit versioning, YAML-driven definitions, and shared validation for backend
and editor flows. Managers publish/activate template versions via API/CLI,
documents auto-upgrade to the latest active schema during load, removed versions
block editing with guidance, and UI enforces schema rules during editing and
before export.

## Technical Context

**Language/Version**: TypeScript 5.4.x + Node.js 22.x  
**Primary Dependencies**: better-sqlite3 9.x, Zod, pnpm workspaces,
packages/templates & template-resolver, Pino 9.5.0  
**Storage**: SQLite (new template tables + audit logs)  
**Testing**: Vitest (packages + apps), React Testing Library for UI validation
scenarios  
**Target Platform**: Local development (Express API + React editor)  
**Project Type**: web (frontend + backend + shared libraries)  
**Performance Goals**: Template resolution < 50ms P95, validation pipeline adds
< 20ms per save  
**Constraints**: Library-first, repository pattern, structured JSON logging, no
singletons, SOC 2 audit fields  
**Scale/Scope**: Single document type initial (architecture) with growth path to
additional templates

**Architecture Context**:

- Template engine + resolver libraries (docs/architecture.md#templates,
  #template-resolver)
- Template caching + traversal rules
  (docs/ui-architecture.md#template-resolution-content-generation)
- Logging, error handling, security, SOC 2 obligations
  (docs/architecture.md#logging-standards, #error-handling-strategy, #security,
  #soc2-guidelines)

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

**Simplicity**:

- Projects: 3 (apps/api, apps/web,
  packages/{templates,template-resolver,shared-data}) ✓
- Using framework directly? Yes—Express routes, React components, no wrapper
  frameworks ✓
- Single data model? Yes—DocumentTemplate/TemplateVersion integrated with
  existing Document/Section ✓
- Avoiding patterns? Repository + Service Locator mandated by architecture ✓

**Architecture**:

- EVERY feature as library? Yes—core logic lives in packages/templates &
  template-resolver; persistence via shared-data ✓
- Libraries listed:
  - `@ctrl-freaq/templates`: YAML parsing, compilation, publish CLI
  - `@ctrl-freaq/template-resolver`: Version-aware resolver + cache invalidation
  - `@ctrl-freaq/shared-data`: Template catalog repositories & migrations
- CLI per library: New `publish`, `activate`, `list`, `migrate` commands planned
  ✓
- Library docs: Update README + llms.txt with template workflows ✓

**Testing (NON-NEGOTIABLE)**:

- RED-GREEN-Refactor enforced (fail-first tests for validator + migrations) ✓
- Contract tests for new API endpoints before implementation ✓
- Integration tests: Document save hitting validation; template publish/activate
  flows ✓
- Real dependencies: use SQLite transaction-backed repos in tests ✓
- UI tests: React Testing Library scenarios for required-field blocking ✓

**Observability**:

- Structured logging via Pino with correlation/user context ✓
- Frontend logs propagate correlation IDs and template version metadata ✓
- Error context: typed ValidationError with pointer data, sanitized ✓

**Versioning**:

- Template versions tracked with semver + audit fields ✓
- Migration logs for document upgrades ✓
- Build numbering unaffected ✓

## Project Structure

### Documentation (this feature)

```
specs/005-story-2-1/
├── spec.md
├── plan.md                # This file
├── research.md            # Phase 0 output
├── data-model.md          # Phase 1 entity definitions
├── quickstart.md          # Phase 1 verification guide
├── contracts/
│   └── templates-api.yaml # Template management API contract
└── tasks.md               # Phase 2 output (created by /tasks)
```

### Source Code (repository root)

```
packages/
├── templates/
│   ├── src/
│   │   ├── compiler/           # YAML → schema compilation
│   │   ├── validators/         # Shared Zod schemas
│   │   └── cli/commands/       # publish/activate/list/migrate
│   └── tests/
├── template-resolver/
│   ├── src/cache/              # Version-aware cache with invalidation hooks
│   └── tests/
├── shared-data/
│   ├── src/repositories/template/ # TemplateCatalogRepository et al.
│   └── migrations/             # New tables
```

apps/ ├── api/ │ ├── src/routes/templates.ts # REST endpoints & validation
middleware │ ├── src/services/templates/ # Managers + migration orchestrators │
└── tests/contract/ # OpenAPI contract tests └── web/ ├──
src/features/templates/ # Editor integration, migration banner └── tests/ #
Validation interaction specs

```

**Structure Decision**: Option 2 (web application) with new template submodules inside existing packages; no additional projects needed.

## Phase 0: Outline & Research
- Standards Digest + UI Digest copied into research.md (per playbook requirement).
- Key decisions captured:
  1. YAML as canonical source with compiled JSON schema snapshots stored in SQLite.
  2. Explicit semver versioning with publish/activate controls and audit metadata.
  3. Shared Zod validators exported for backend + frontend enforcement.
  4. Backwards compatibility via optional migrations and non-breaking fallback behavior.
- Outstanding clarifications:
  - Handling documents when a referenced template version is removed.
  - Expectation for auto-migrating drafts versus manual promotion.

**Output**: `research.md` (complete).

## Phase 1: Design & Contracts

### Data Model & Persistence
- `data-model.md` defines `DocumentTemplate`, `TemplateVersion`, `DocumentTemplateMigration` with SOC 2 audit fields.
- Add SQLite migrations via shared-data with FK constraints to `documents(templateId, templateVersion)`.
- Cache schema hash for quick change detection.

### API Contracts
- `contracts/templates-api.yaml` describes template listing, version retrieval, publishing, and activation endpoints.
- Validation error schema ensures sanitized issue payloads.
- Security requires Clerk bearer token + manager authorization.

### Validation & Runtime Flow
- Backend middleware obtains template validators per document request, auto-upgrades drafts to the active version when compatible, and throws typed `ValidationError` with issue details when validation fails.
- Frontend editor loads version metadata, applies auto-upgrade workflows with confirmation messaging, runs Zod validation before commit, and maps errors to inline UI states.
- Logging adds `templateId`, `templateVersion`, `schemaHash`, `documentId`, and upgrade outcome when available.

### CLI & Tooling
- Extend `@ctrl-freaq/templates` CLI with `publish`, `activate`, `list`, `migrate` commands.
- Provide dry-run mode for publish to output validation summary without persisting.
- Hook CLI actions into Service Locator for API reuse.

### Testing Strategy
- Contract tests for each endpoint verifying schema + error paths.
- Repository tests covering publish, activate, conflict conditions, and migration logs.
- Frontend integration tests verifying required field blocking and migration banners.
- End-to-end quickstart script ensures CLI + API + UI integration.

### Agent Context Update
- Update `CLAUDE.md` with template system pointers, CLI commands, validator entry points, and quickstart reference.

**Output**: `data-model.md`, `contracts/templates-api.yaml`, `quickstart.md`, CLAUDE.md updates, failing tests to drive implementation.

## Phase 2: Task Planning Approach
_Task generation to be executed by /tasks command_

**Task Generation Strategy**:
1. Create SQLite migrations + repository layer updates for template catalog (tests first).
2. Extend packages/templates with compiler + validator exports (unit tests before implementation).
3. Enhance template-resolver with version-aware cache invalidation + fallback (tests first).
4. Add API controllers/routes/middleware for template endpoints (contract tests first).
5. Update document load/save/export flows to enforce schema validation and auto-upgrade with block-on-removed-version behavior (integration + regression tests).
6. Implement frontend validation flows + upgrade/blocking UI states (React Testing Library first).
7. Wire CLI commands for publish/activate/migrate with tests around argument parsing.

**Ordering Strategy**:
- Stage 1: Data layer + compiler (shared libraries) [P]
- Stage 2: API endpoints + validation middleware (depends on Stage 1)
- Stage 3: Frontend integration + UX messaging (depends on Stage 2)
- Stage 4: CLI & migration tooling (parallel where safe)
- Stage 5: Quality gates (contract/integration tests) + docs updates

**Estimated Output**: 28-32 tasks grouped by library and app boundaries.

## Phase 3+: Future Implementation
_These phases are beyond the scope of the /plan command_

**Phase 3**: Task execution (/tasks command)
**Phase 4**: Implementation (libraries, API, UI, CLI)
**Phase 5**: Validation (tests, quickstart walkthrough, export verification)

## Complexity Tracking
| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| _None_ | | |

## Progress Tracking
**Phase Status**:
- [x] Phase 0: Research complete (/plan command)
- [x] Phase 1: Design complete (/plan command)
- [x] Phase 2: Task planning complete (/plan command - describe approach only)
- [ ] Phase 3: Tasks generated (/tasks command)
- [ ] Phase 4: Implementation complete
- [ ] Phase 5: Validation passed

**Gate Status**:
- [x] Initial Constitution Check: PASS
- [x] Post-Design Constitution Check: PASS
- [x] All NEEDS CLARIFICATION resolved
- [x] Complexity deviations documented

---
_Based on Constitution v2.1.1 - See `/memory/constitution.md`_
```

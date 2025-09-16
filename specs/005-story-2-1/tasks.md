# Tasks: Document Schema & Template System

**Input**: Design documents from `/specs/005-story-2-1/` **Prerequisites**:
plan.md ✓, research.md ✓, data-model.md ✓, contracts/ ✓, quickstart.md ✓

## Execution Flow (main)

```
1. Load plan.md from feature directory
   ✓ Document Schema & Template System scope confirmed (template catalog, auto-upgrade, removed-version blocks)
   ✓ Clarifications recorded: removed template versions block editing; drafts auto-upgrade on load
   ✓ Architecture boundaries identified: packages/shared-data, packages/templates, packages/template-resolver, apps/api, apps/web
2. Load optional design documents:
   ✓ data-model.md: 5 entities (DocumentTemplate, TemplateVersion, TemplateSection, TemplateField, DocumentTemplateMigration)
   ✓ contracts/templates-api.yaml: 6 endpoints requiring contract tests and implementations
   ✓ research.md: YAML source of truth, semver versioning, shared Zod validators, auto-upgrade & block behavior
   ✓ quickstart.md: CLI publish/activate flows, validation walkthrough, export verification
3. Generate tasks by category:
   ✓ Setup: migrations scaffold + fixtures (3 tasks)
   ✓ Tests: repository/unit/contract/integration/CLI coverage (19 tasks)
   ✓ Core: data models, template libraries, API routes (19 tasks)
   ✓ Integration: cross-service wiring + UI flows (7 tasks)
   ✓ Polish: docs, scripts, quality gates (3 tasks)
4. Apply task rules:
   ✓ Tests precede implementation and must fail first
   ✓ [P] only when tasks touch different files with no shared state
   ✓ Endpoints implemented sequentially within the same route file
5. Number tasks sequentially (T001-T053)
6. Draft dependency graph and parallel execution examples
7. Validate completeness:
   ✓ Contracts → 6 contract tests + 6 endpoint tasks
   ✓ Data model entities → dedicated repository/model tasks
   ✓ Quickstart scenarios mapped to integration and UI tests
```

## Format: `[ID] [P?] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- Include exact file paths in descriptions

## Path Conventions

- **Backend**: `apps/api/src/` (routes, middleware, services, testing utilities)
- **Frontend**: `apps/web/src/` (stores, components, integration tests)
- **Shared data**: `packages/shared-data/src/` +
  `packages/shared-data/migrations/`
- **Template libraries**: `packages/templates/src/`,
  `packages/template-resolver/src/`
- **Contracts & docs**: `specs/005-story-2-1/contracts/`, `docs/`, `CLAUDE.md`

## Phase 3.1: Setup

- [x] T001 Create `packages/shared-data/migrations/` scaffold with README
      explaining versioned SQL files and register migration loader for template
      catalog tables <!-- completed: 2025-09-16 14:15 UTC -->
- [x] T002 [P] Add reusable YAML fixtures for templates in
      `packages/templates/tests/fixtures/` (valid architecture template, invalid
      schema cases) <!-- completed: 2025-09-16 14:25 UTC -->
- [x] T003 [P] Add template testing helpers for API/resolver in
      `apps/api/src/testing/templates-test-helpers.ts` (fixture loaders, clerk
      manager token stub) <!-- completed: 2025-09-16 14:32 UTC -->

## Phase 3.2: Tests First (TDD) ⚠️ MUST COMPLETE BEFORE 3.3

**CRITICAL: All tests below MUST be written to fail before implementation
begins**

- [ ] T004 [P] Create failing DocumentTemplate repository tests in
      `packages/shared-data/src/repositories/document-template.repository.test.ts`
- [ ] T005 [P] Create failing TemplateVersion repository tests in
      `packages/shared-data/src/repositories/template-version.repository.test.ts`
- [ ] T006 [P] Create failing DocumentTemplateMigration repository tests in
      `packages/shared-data/src/repositories/document-template-migration.repository.test.ts`
- [ ] T007 [P] Add template compiler snapshot/semver tests in
      `packages/templates/src/compilers/template-compiler.test.ts`
- [ ] T008 [P] Add validator generation tests covering required/optional fields
      in `packages/templates/src/validators/template-validator.test.ts`
- [ ] T009 [P] Add version-aware cache eviction tests in
      `packages/template-resolver/src/version-cache.test.ts`
- [ ] T010 [P] Add contract test for GET /templates in
      `apps/api/tests/contract/templates.list.contract.test.ts`
- [ ] T011 [P] Add contract test for GET /templates/{templateId} in
      `apps/api/tests/contract/template.get.contract.test.ts`
- [ ] T012 [P] Add contract test for GET /templates/{templateId}/versions in
      `apps/api/tests/contract/template.versions.list.contract.test.ts`
- [ ] T013 [P] Add contract test for POST /templates/{templateId}/versions in
      `apps/api/tests/contract/template.versions.publish.contract.test.ts`
- [ ] T014 [P] Add contract test for GET
      /templates/{templateId}/versions/{version} in
      `apps/api/tests/contract/template.version.get.contract.test.ts`
- [ ] T015 [P] Add contract test for POST
      /templates/{templateId}/versions/{version}/activate in
      `apps/api/tests/contract/template.version.activate.contract.test.ts`
- [ ] T016 [P] Add integration test for auto-upgrade + migration logging in
      `apps/api/tests/integration/template-auto-upgrade.test.ts`
- [ ] T017 [P] Add integration test for removed-version block response in
      `apps/api/tests/integration/template-removed-version.test.ts`
- [ ] T018 [P] Add frontend integration test guarding required fields in
      `apps/web/tests/integration/template-validation-gate.test.tsx`
- [ ] T019 [P] Add frontend integration test for upgrade banner + logging in
      `apps/web/tests/integration/template-upgrade-banner.test.tsx`
- [ ] T020 [P] Add CLI publish command tests in
      `packages/templates/src/cli/publish-command.test.ts`
- [ ] T021 [P] Add CLI activate command tests in
      `packages/templates/src/cli/activate-command.test.ts`
- [ ] T022 [P] Add CLI migrate command tests in
      `packages/templates/src/cli/migrate-command.test.ts`

## Phase 3.3: Core Implementation (ONLY after tests fail)

### Data Layer & Schema

- [ ] T023 Create template catalog/version/migration SQL migrations in
      `packages/shared-data/migrations/005_template_catalog.sql` with audit
      fields + unique constraints
- [ ] T024 [P] Implement `DocumentTemplate` model + repository in
      `packages/shared-data/src/models/document-template.ts`
- [ ] T025 [P] Implement `TemplateVersion` model + repository in
      `packages/shared-data/src/models/template-version.ts`
- [ ] T026 [P] Implement `DocumentTemplateMigration` model + repository in
      `packages/shared-data/src/models/document-template-migration.ts`
- [ ] T027 [P] Extend document model/repository with `templateId`,
      `templateVersion`, `templateSchemaHash` handling in
      `packages/shared-data/src/models/document.ts`
- [ ] T028 Update shared-data exports/CLI wiring for new template repositories
      in `packages/shared-data/src/models/index.ts`,
      `packages/shared-data/src/index.ts`, and `packages/shared-data/src/cli.ts`

### Template Libraries

- [ ] T029 [P] Extend YAML compiler in
      `packages/templates/src/templates/index.ts` to emit schema hash + sections
      snapshot
- [ ] T030 [P] Implement `createTemplateValidator` + shared Zod exports in
      `packages/templates/src/validators/template-validator.ts`
- [ ] T031 [P] Add publish orchestration helpers bridging compiler +
      repositories in `packages/templates/src/publishers/template-publisher.ts`
- [ ] T032 Implement CLI `publish`, `activate`, `list`, `migrate` commands with
      structured logging in `packages/templates/src/cli.ts`

### Template Resolver Enhancements

- [ ] T033 Update resolver core for version-aware caching + resolver hooks in
      `packages/template-resolver/src/index.ts`
- [ ] T034 [P] Add auto-upgrade + removed-version detection utilities in
      `packages/template-resolver/src/auto-upgrade.ts`

### Backend API Implementation

- [x] T035 Register template repositories, validator factory, and resolver in
      `apps/api/src/services/container.ts`
- [x] T036 Implement GET /api/v1/templates handler in
      `apps/api/src/routes/templates.ts`
- [x] T037 Implement GET /api/v1/templates/:templateId handler in
      `apps/api/src/routes/templates.ts`
- [x] T038 Implement GET /api/v1/templates/:templateId/versions handler in
      `apps/api/src/routes/templates.ts`
- [x] T039 Implement GET /api/v1/templates/:templateId/versions/:version handler
      in `apps/api/src/routes/templates.ts`
- [x] T040 Implement POST /api/v1/templates/:templateId/versions (publish) with
      Zod validation + schema persistence in `apps/api/src/routes/templates.ts`
- [x] T041 Implement POST
      /api/v1/templates/:templateId/versions/:version/activate with audit
      logging in `apps/api/src/routes/templates.ts`
- [ ] T042 Add template validation + auto-upgrade middleware in
      `apps/api/src/middleware/template-validation.ts`
- [ ] T043 Create document routes using validation middleware for
      load/save/export in `apps/api/src/routes/documents.ts` and register in
      `apps/api/src/app.ts`

## Phase 3.4: Integration

- [ ] T044 [P] Implement template upgrade orchestration service in
      `apps/api/src/services/template-upgrade.service.ts`
- [ ] T045 [P] Update exporter ordering to follow active template sections in
      `packages/exporter/src/index.ts`
- [ ] T046 [P] Enrich backend structured logging with template context in
      `apps/api/src/core/logging.ts`
- [ ] T047 [P] Create frontend template store for active version + validators in
      `apps/web/src/stores/template-store.ts`
- [ ] T048 [P] Build `TemplateValidationGate` component enforcing inline errors
      in `apps/web/src/components/editor/TemplateValidationGate.tsx`
- [ ] T049 Update document editor workflow to show upgrade banner/block removed
      versions in `apps/web/src/pages/Project.tsx`
- [ ] T050 [P] Wire browser Pino template logging + correlation propagation in
      `apps/web/src/lib/logger.ts`

## Phase 3.5: Polish

- [ ] T051 Update `specs/005-story-2-1/quickstart.md` and `CLAUDE.md` with
      template publish/upgrade workflows and CLI references
- [ ] T052 Add pnpm workspace scripts and package metadata for template CLI
      commands in `package.json` and `packages/templates/package.json`
- [ ] T053 Run `pnpm -w lint`, `pnpm -w typecheck`, `pnpm -w test`,
      `pnpm -w build`; address regressions and ensure all new tasks stay checked
      only after passing

## Dependencies

```
Setup (T001-T003) → Tests (T004-T022) → Data layer & exports (T023-T028) → Template libraries/resolver (T029-T034) → API routes & middleware (T035-T043) → Integration (T044-T050) → Polish (T051-T053)

Key edges:
- T023 blocks T024-T028 (schema before repositories)
- T029-T034 depend on repositories (T024-T028)
- T032 depends on publish helpers (T031) and repositories (T024-T028)
- T035 depends on template libraries/resolver (T029-T034)
- T036-T041 depend on service container updates (T035)
- T042-T043 depend on resolver utilities (T033-T034) + container (T035)
- T047-T050 depend on backend endpoints (T036-T041) and resolver updates (T033-T034)
```

## Parallel Execution Examples

### Phase 3.2 Tests (after T003)

```bash
Task: "Create failing DocumentTemplate repository tests in packages/shared-data/src/repositories/document-template.repository.test.ts"
Task: "Add contract test for GET /templates in apps/api/tests/contract/templates.list.contract.test.ts"
Task: "Add version-aware cache eviction tests in packages/template-resolver/src/version-cache.test.ts"
Task: "Add frontend integration test guarding required fields in apps/web/tests/integration/template-validation-gate.test.tsx"
```

### Phase 3.3 Data Models (after T023)

```bash
Task: "Implement DocumentTemplate model + repository in packages/shared-data/src/models/document-template.ts"
Task: "Implement TemplateVersion model + repository in packages/shared-data/src/models/template-version.ts"
Task: "Implement DocumentTemplateMigration model + repository in packages/shared-data/src/models/document-template-migration.ts"
```

### Phase 3.4 Frontend (after T047)

```bash
Task: "Build TemplateValidationGate component enforcing inline errors in apps/web/src/components/editor/TemplateValidationGate.tsx"
Task: "Wire browser Pino template logging + correlation propagation in apps/web/src/lib/logger.ts"
```

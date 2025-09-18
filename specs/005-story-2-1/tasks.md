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

- [x] T004 [P] Create failing DocumentTemplate repository tests in
      `packages/shared-data/src/repositories/document-template.repository.test.ts`
- [x] T005 [P] Create failing TemplateVersion repository tests in
      `packages/shared-data/src/repositories/template-version.repository.test.ts`
- [x] T006 [P] Create failing DocumentTemplateMigration repository tests in
      `packages/shared-data/src/repositories/document-template-migration.repository.test.ts`
- [x] T007 [P] Add template compiler snapshot/semver tests in
      `packages/templates/src/compilers/template-compiler.test.ts`
- [x] T008 [P] Add validator generation tests covering required/optional fields
      in `packages/templates/src/validators/template-validator.test.ts`
- [x] T009 [P] Add version-aware cache eviction tests in
      `packages/template-resolver/src/version-cache.test.ts`
- [x] T010 [P] Add contract test for GET /templates in
      `apps/api/tests/contract/templates.list.contract.test.ts`
- [x] T011 [P] Add contract test for GET /templates/{templateId} in
      `apps/api/tests/contract/template.get.contract.test.ts`
- [x] T012 [P] Add contract test for GET /templates/{templateId}/versions in
      `apps/api/tests/contract/template.versions.list.contract.test.ts`
- [x] T013 [P] Add contract test for POST /templates/{templateId}/versions in
      `apps/api/tests/contract/template.versions.publish.contract.test.ts`
- [x] T014 [P] Add contract test for GET
      /templates/{templateId}/versions/{version} in
      `apps/api/tests/contract/template.version.get.contract.test.ts`
- [x] T015 [P] Add contract test for POST
      /templates/{templateId}/versions/{version}/activate in
      `apps/api/tests/contract/template.version.activate.contract.test.ts`
- [x] T016 [P] Add integration test for auto-upgrade + migration logging in
      `apps/api/tests/integration/template-auto-upgrade.test.ts`
- [x] T017 [P] Add integration test for removed-version block response in
      `apps/api/tests/integration/template-removed-version.test.ts`
- [x] T018 [P] Add frontend integration test guarding required fields in
      `apps/web/tests/integration/template-validation-gate.test.tsx`
- [x] T019 [P] Add frontend integration test for upgrade banner + logging in
      `apps/web/tests/integration/template-upgrade-banner.test.tsx`
- [x] T020 [P] Add CLI publish command tests in
      `packages/templates/src/cli/publish-command.test.ts`
- [x] T021 [P] Add CLI activate command tests in
      `packages/templates/src/cli/activate-command.test.ts`
- [x] T022 [P] Add CLI migrate command tests in
      `packages/templates/src/cli/migrate-command.test.ts`

## Phase 3.3: Core Implementation (ONLY after tests fail)

### Data Layer & Schema

- [x] T023 Create template catalog/version/migration SQL migrations in
      `packages/shared-data/migrations/005_template_catalog.sql` with audit
      fields + unique constraints
- [x] T024 [P] Implement `DocumentTemplate` model + repository in
      `packages/shared-data/src/models/document-template.ts`
- [x] T025 [P] Implement `TemplateVersion` model + repository in
      `packages/shared-data/src/models/template-version.ts`
- [x] T026 [P] Implement `DocumentTemplateMigration` model + repository in
      `packages/shared-data/src/models/document-template-migration.ts`
- [x] T027 [P] Extend document model/repository with `templateId`,
      `templateVersion`, `templateSchemaHash` handling in
      `packages/shared-data/src/models/document.ts`
- [x] T028 Update shared-data exports/CLI wiring for new template repositories
      in `packages/shared-data/src/models/index.ts`,
      `packages/shared-data/src/index.ts`, and `packages/shared-data/src/cli.ts`

### Template Libraries

- [x] T029 [P] Extend YAML compiler in
      `packages/templates/src/templates/index.ts` to emit schema hash + sections
      snapshot
- [x] T030 [P] Implement `createTemplateValidator` + shared Zod exports in
      `packages/templates/src/validators/template-validator.ts`
- [x] T031 [P] Add publish orchestration helpers bridging compiler +
      repositories in `packages/templates/src/publishers/template-publisher.ts`
- [x] T032 Implement CLI `publish`, `activate`, `list`, `migrate` commands with
      structured logging in `packages/templates/src/cli.ts`

### Template Resolver Enhancements

- [x] T033 Update resolver core for version-aware caching + resolver hooks in
      `packages/template-resolver/src/index.ts`
      <!-- completed: 2025-09-16 17:54 UTC -->
- [x] T034 [P] Add auto-upgrade + removed-version detection utilities in
      `packages/template-resolver/src/auto-upgrade.ts`
      <!-- completed: 2025-09-16 17:54 UTC -->

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
- [x] T042 Add template validation + auto-upgrade middleware in
      `apps/api/src/middleware/template-validation.ts`
      <!-- completed: 2025-09-16 08:35 UTC -->
- [x] T043 Create document routes using validation middleware for
      load/save/export in `apps/api/src/routes/documents.ts` and register in
      `apps/api/src/app.ts` <!-- completed: 2025-09-16 08:35 UTC -->

## Phase 3.4: Integration

- [x] T044 [P] Implement template upgrade orchestration service in
      `apps/api/src/services/template-upgrade.service.ts`
      <!-- completed: 2025-09-16 22:09 UTC -->
- [x] T045 [P] Update exporter ordering to follow active template sections in
      `packages/exporter/src/index.ts` <!-- completed: 2025-09-16 22:09 UTC -->
- [x] T046 [P] Enrich backend structured logging with template context in
      `apps/api/src/core/logging.ts` <!-- completed: 2025-09-16 22:09 UTC -->
- [x] T047 [P] Create frontend template store for active version + validators in
      `apps/web/src/stores/template-store.ts`
      <!-- completed: 2025-09-16 22:09 UTC -->
- [x] T048 [P] Build `TemplateValidationGate` component enforcing inline errors
      in `apps/web/src/components/editor/TemplateValidationGate.tsx`
      <!-- completed: 2025-09-16 22:09 UTC -->
- [x] T049 Update document editor workflow to show upgrade banner/block removed
      versions in `apps/web/src/pages/Project.tsx`
      <!-- completed: 2025-09-16 22:09 UTC -->
- [x] T050 [P] Wire browser Pino template logging + correlation propagation in
      `apps/web/src/lib/logger.ts` <!-- completed: 2025-09-16 22:09 UTC -->

## Phase 3.5: Polish

- [x] T051 Update `specs/005-story-2-1/quickstart.md` and `CLAUDE.md` with
      template publish/upgrade workflows and CLI references
      <!-- completed: 2025-09-16 22:40 UTC -->
- [x] T052 Add pnpm workspace scripts and package metadata for template CLI
      commands in `package.json` and `packages/templates/package.json`
      <!-- completed: 2025-09-16 22:40 UTC -->
- [x] T053 Run `pnpm -w lint`, `pnpm -w typecheck`, `pnpm -w test`,
      `pnpm -w build`; address regressions and ensure all new tasks stay checked
      only after passing <!-- completed: 2025-09-16 22:40 UTC -->

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

## Phase 3.6: Code Review Feedback from 2025-09-17 09:21

- [x] T107 [Correctness] Restore removed-version banner —
      apps/web/src/stores/template-store.ts - Why: API returns HTTP 409 for
      removed template versions; client expects 200 with decision payload, so
      editors hit fatal load error - Severity: Major - Fix: Teach template store
      to detect 409, surface blocked decision/banner, add integration test
      <!-- completed: 2025-09-16 23:34 UTC -->

- [x] T108 [Correctness] Surface auto-upgrade failures —
      apps/web/src/stores/template-store.ts - Why: Middleware sends 422 on
      validation failure; UI expects success response and never shows
      upgrade-failed state - Severity: Major - Fix: Handle 422 path, map to
      failure banner, add integration coverage
      <!-- completed: 2025-09-16 23:34 UTC -->

## Phase 3.7: Code Review Feedback from 2025-09-17 01:07

- [x] T109 [Correctness] Restore bundler module resolution for web template
      validator — apps/web/tsconfig.json:13 - Why: Overriding the workspace
      bundler resolution prevents TypeScript and ESLint from resolving `zod`, so
      the template validator import fails and the editor cannot build -
      Severity: Major - Fix: Drop the local `moduleResolution` override (or
      configure bundler-compatible paths), then rerun all workspace quality
      commands to confirm they pass. <!-- completed: 2025-09-17 01:11 UTC -->

- [x] T110 [Maintainability] Resolve linting issues (aggregate) — Command: pnpm
      -w lint - Why: Lint errors reduce maintainability and mask defects -
      Severity: Major - Fix: Eliminate all ESLint errors across touched
      workspaces; remove stray console.\*; avoid eslint-disable without
      justification and ticket reference - Acceptance: pnpm -w lint returns 0
      errors; no .only/.skip in tests; no new global disables.
      <!-- completed: 2025-09-17 01:11 UTC -->

- [x] T111 [Correctness] Resolve type check issues (aggregate) — Command: pnpm
      -w typecheck - Why: Type errors indicate potential runtime failures and
      contract drift - Severity: Major - Fix: Resolve type errors without
      introducing // @ts-ignore salvo; prefer precise types; update public
      types/fixtures as needed - Acceptance: pnpm -w typecheck returns 0 errors;
      no new justified @ts-ignore. <!-- completed: 2025-09-17 01:11 UTC -->

- [x] T112 [Reliability] Resolve build failures (aggregate) — Command: pnpm -w
      build - Why: Build failures block deployability and prevent verification
      of shipping artifacts - Severity: Major - Fix: Repair build configuration
      so tsc + vite build succeed end-to-end; document any tooling changes
      needed; ensure artifacts generate without warnings - Acceptance: pnpm -w
      build completes successfully; no residual module resolution warnings.
      <!-- completed: 2025-09-17 01:11 UTC -->

- [x] T113 [Testing] Resolve test failures (aggregate) — Command: pnpm -w test -
      Why: Failing tests block reliability and conceal regressions - Severity:
      Critical - Fix: Repair failing unit/integration/contract tests; update
      snapshots only for intentional behavior changes; remove .only/.skip;
      ensure coverage meets project thresholds - Acceptance: pnpm -w test
      passes; coverage targets met; no .only/.skip.
      <!-- completed: 2025-09-17 01:11 UTC -->

## Phase 3.8: Code Review Feedback from 2025-09-18 06:40

- [x] T114 [Security] Enforce template manager RBAC —
      apps/api/src/routes/templates.ts — Why: POST publish/activate endpoints
      only check for authenticated user and ignore `templates:manage`
      permission, violating Constitution Rule 2 and enabling privilege
      escalation — Severity: Critical — Fix: gate publish/activate handlers
      behind explicit authorization (e.g., ensure `req.auth.orgPermissions`
      contains `templates:manage`), return 403 otherwise, and add failing
      contract tests before implementation.
      <!-- completed: 2025-09-17 23:21 UTC -->
- [x] T115 [Correctness] Implement soft delete contract —
      packages/shared-data/src/repositories/base-repository.ts — Why: `delete`
      currently issues hard DELETE statements, breaching Constitution Rule 15
      requiring `deleted_at`/`deleted_by` audit trails — Severity: Major — Fix:
      refactor repository delete path to mark soft deletes, ensure queries
      filter them out, and extend repository tests to cover soft delete
      behavior. <!-- completed: 2025-09-17 23:21 UTC -->
- [x] T116 [Security] Apply authenticated rate limiting — apps/api/src/app.ts —
      Why: User rate limiter factory exists but is not wired into `/api/v1`
      routes, violating Constitution Rule 17 and leaving endpoints vulnerable to
      brute-force abuse — Severity: Major — Fix: instantiate per-user limiter
      from AppConfig, attach before router mounts, emit retry headers, and add
      integration tests covering 429 and logging.
      <!-- completed: 2025-09-17 23:21 UTC -->

## Phase 3.9: Code Review Feedback from 2025-09-18 19:45

- [x] T117 [Correctness] Restore template CLI database resolution —
      packages/templates/src/cli.ts — Why: `pnpm template:list -- --json` fails
      with "Cannot open database" because the CLI resolves the SQLite path
      inside each package, breaking Quickstart step 2 — Severity: Major — Fix:
      add a failing smoke test (e.g., Vitest/fixtures) that publishes and lists
      a version after calling the shared-data migration, then update the
      CLI/publisher to resolve the workspace database path (create the directory
      when missing) and honour `DATABASE_PATH`; rerun the CLI smoke test and
      Quickstart commands (`pnpm template:publish`, `pnpm template:list`)
      successfully. <!-- completed: 2025-09-18 00:37 UTC -->
- [x] T118 [Reliability] Provide shared-data migrate script —
      packages/shared-data/package.json — Why: Quickstart step 1 references
      `pnpm --filter @ctrl-freaq/shared-data migrate`, but no script exists, so
      migrations must be run manually — Severity: Major — Fix: add a test (shell
      or Vitest) that invokes the new
      `pnpm --filter @ctrl-freaq/shared-data migrate` command against an empty
      DB and verifies tables exist, wire the script through the shared-data CLI
      migration loader, document the command in
      `specs/005-story-2-1/quickstart.md`, and rerun the quickstart sequence
      end-to-end. <!-- completed: 2025-09-18 00:37 UTC -->
- [x] T119 [Correctness] Preserve template metadata on publish —
      packages/templates/src/publishers/template-publisher.ts — Why:
      `upsertMetadata` always passes `defaultAggressiveness: null`, wiping
      existing catalog settings on each publish — Severity: Minor — Fix: write a
      regression test that publishes a template with non-null aggressiveness,
      republish, and asserts the value persists; update the publisher/service
      layer to reuse stored metadata when present.
      <!-- completed: 2025-09-18 00:37 UTC -->
- [x] T120 [Performance] Expand resolver cache granularity —
      packages/template-resolver/src/version-cache.ts — Why: the versioned cache
      stores only one entry per template ID, so alternating between versions
      causes repeated DB loads — Severity: Minor — Fix: add a resolver unit test
      that alternates between two versions and expects cache hits, then refactor
      the cache/mirror to key by `(templateId, version, schemaHash)` while
      keeping memory bounded. <!-- completed: 2025-09-18 00:37 UTC -->

## Phase 3.10: Code Review Feedback from 2025-09-18 13:55

- [x] T121 [Correctness] Preserve template metadata on API publish —
      apps/api/src/services/template-catalog.service.ts:264 — Why:
      `ensureTemplateCatalog` always writes `defaultAggressiveness: null`, so
      REST publishes still wipe catalog defaults contrary to T119 acceptance
      criteria and Quickstart step 2 expectations — Severity: Major — Fix: add
      an API-level regression test that publishes, updates metadata (e.g., via
      repository), republish through `/api/v1/templates/:templateId/versions`,
      and assert metadata persists; update the service to reuse existing
      template metadata before calling `upsertMetadata`; verify Quickstart
      publish/activate flows retain defaults — Links:
      specs/005-story-2-1/tasks.md#L314,
      apps/api/tests/contract/template.versions.publish.contract.test.ts
      <!-- completed: 2025-09-18 04:08 UTC -->

## Phase 3.11: Code Review Feedback from 2025-09-18 15:20

- [x] T122 [Correctness] Preserve active version metadata in publish response —
      apps/api/src/routes/templates.ts:271 — Why: when publishing a draft
      without `publish=true`, the response clears `activeVersion`, so clients
      lose awareness of the current active release, breaking Quickstart Step 2
      verification and UI expectations — Severity: Major — Fix: add a failing
      contract test that publishes and activates v1, publishes v1.1 without
      activation, and asserts the response still reports
      `activeVersion: "1.0.0"`; update the handler to fetch the existing active
      version before formatting the summary so metadata remains intact. — Links:
      docs/playbooks/validate-story-impl.md,
      apps/api/tests/contract/template.versions.publish.contract.test.ts
      <!-- completed: 2025-09-18 04:32 UTC -->

## Implementation Log - 2025-09-17 23:21

### Session Summary

- Tasks Attempted: 3
- Tasks Completed: 3
- Tasks Failed: 0
- Time Elapsed: ~60 minutes

### Completed Tasks

✅ T114: Enforce template manager RBAC (apps/api/src/routes/templates.ts) —
contract tests proved 403 for non-manager tokens ✅ T115: Implement soft delete
contract (packages/shared-data/src/repositories/base-repository.ts) — repository
tests cover tombstone filtering ✅ T116: Apply authenticated rate limiting
(apps/api/src/app.ts) — integration test verifies 429 responses and retry
headers

### Next Steps

- Monitor for additional code review follow-ups on template security surfaces

## Implementation Log - 2025-09-18 00:37

### Session Summary

- Tasks Attempted: 4
- Tasks Completed: 4
- Tasks Failed: 0
- Time Elapsed: ~75 minutes

### Completed Tasks

✅ T117: Template CLI now resolves the workspace SQLite path, provisions missing
directories, and the new Vitest smoke test exercises `pnpm template:publish` /
`template:list` with a temporary database. ✅ T118: Added
`pnpm --filter @ctrl-freaq/shared-data migrate` script with programmatic runner
and a shell-backed test that verifies migrations create the required tables. ✅
T119: Regression test confirms template metadata persists across publishes;
publisher now reuses existing `defaultAggressiveness` instead of nulling it out.
✅ T120: Version cache keys by `(templateId, version, schemaHash)` with a
per-template cap, and alternating-version tests now observe cache hits.

### Next Steps

- Execute full workspace quality bundle and keep Quickstart instructions in sync
  with future tooling changes.

## Implementation Log - 2025-09-18 04:08

### Session Summary

- Tasks Attempted: 1
- Tasks Completed: 1
- Tasks Failed: 0
- Time Elapsed: ~45 minutes

### Completed Tasks

✅ T121: REST publish flow preserves catalog `defaultAggressiveness` via
regression contract test and `ensureTemplateCatalog` reuse of stored metadata.

### Next Steps

- Monitor for further API metadata regressions tied to template manager
  workflows.

## Implementation Log - 2025-09-18 04:32

### Session Summary

- Tasks Attempted: 1
- Tasks Completed: 1
- Tasks Failed: 0
- Time Elapsed: ~45 minutes

### Completed Tasks

✅ T122: Publish response retains active version metadata
(apps/api/tests/contract/template.versions.publish.contract.test.ts,
apps/api/src/routes/templates.ts) — contract test now guards draft publishes and
handler reloads catalog summary for active version details.

### Next Steps

- Monitor template publish responses for further metadata regressions.

# Tasks: Project Lifecycle Management

**Input**: Design documents from `/specs/016-a-user-should-be-able/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: Required (Constitution mandates TDD). Write failing tests before
implementation within each story phase.

**Organization**: Tasks grouped by user story to enable independent
implementation and testing.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Confirm local workspace and tooling ready to exercise lifecycle
changes.

- [x] T001 [Setup] Verify workspace dependencies with `pnpm install` and
      document any missing env variables in
      `/specs/016-a-user-should-be-able/quickstart.md`.
- [x] T002 [P] [Setup] Validate API and web environment configs
      (`AUTH_PROVIDER`, `VITE_API_BASE_URL`) in `/apps/api/.env.local` and
      `/apps/web/.env.local`, updating quickstart notes if adjustments are
      required.
- [x] T003 [P] [Setup] Smoke start dev servers
      (`timeout 10 pnpm --filter @ctrl-freaq/api dev`,
      `pnpm --filter @ctrl-freaq/web dev:e2e`) to ensure baseline stack is
      healthy before feature work.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Extend shared data layer to support lifecycle metadata for all
subsequent stories. ⚠️ Complete before beginning any user story.

- [x] T004 [Foundation] Create failing lifecycle schema tests in
      `/packages/shared-data/tests/project.lifecycle.test.ts` covering status,
      visibility, goal fields, and soft-delete behaviour.
- [x] T005 [Foundation] Update `/packages/shared-data/src/models/project.ts` to
      add lifecycle fields, remove single-project guardrails, and expose helper
      methods for archive/restore per research decisions D001–D006.
- [x] T006 [Foundation] Add forward/backward-safe migration in
      `/packages/shared-data/src/migrations/20251025_project_lifecycle.ts` and
      register it in `/packages/shared-data/src/migrations/index.ts`.
- [x] T007 [P] [Foundation] Extend `/packages/shared-data/src/cli.ts` with
      project lifecycle subcommands (list statuses, archive, restore) to
      maintain CLI parity.

**Checkpoint**: Shared data layer supports new lifecycle metadata; migrations
applied successfully.

---

## Phase 3: User Story 1 – Create a new project from the dashboard (Priority: P1) 🎯 MVP

**Goal**: Authenticated users can create projects with lifecycle metadata
directly from the dashboard.

**Independent Test**: From a clean workspace, create a project via the dashboard
and confirm it appears in the list with default `draft` status and recorded
metadata.

### Tests for User Story 1 (write first)

- [x] T008 [P] [US1] Add contract coverage for `POST /api/v1/projects` in
      `/apps/api/tests/contract/projects-api.test.ts`, asserting new fields and
      conflict handling.
- [x] T009 [P] [US1] Extend `/apps/api/tests/integration/projects.test.ts` with
      creation flow asserting lifecycle defaults and audit logging.
- [x] T010 [P] [US1] Author Playwright scenario
      `/apps/web/tests/e2e/dashboard/project-create.e2e.ts` validating dashboard
      creation UX and immediate list refresh.

### Implementation for User Story 1

- [x] T011 [US1] Update request schemas and creation handler in
      `/apps/api/src/routes/projects.ts` to accept lifecycle inputs, set
      defaults, and return enriched payloads.
- [x] T012 [US1] Extend API client and context (`/apps/web/src/lib/api.ts`,
      `/apps/web/src/lib/api-context.tsx`) with typed create mutation supporting
      visibility/goal fields.
- [x] T013 [US1] Introduce reusable create dialog component at
      `/apps/web/src/components/projects/CreateProjectDialog.tsx` with
      validation aligned to spec FR-001/002.
- [x] T014 [US1] Wire dashboard creation flow in
      `/apps/web/src/pages/Dashboard.tsx` to open dialog, submit mutation, and
      invalidate project queries on success.

**Checkpoint**: User Story 1 complete—project creation works end-to-end with
tests passing.

---

## Phase 4: User Story 2 – Review project summaries on the dashboard (Priority: P2)

**Goal**: Dashboard displays all accessible projects with status, goal timeline,
and summary metadata in real time.

**Independent Test**: Seed multiple projects, open dashboard, and verify
cards/side navigation render accurate lifecycle data within 2 seconds.

### Tests for User Story 2 (write first)

- [x] T015 [P] [US2] Enhance
      `/apps/api/tests/contract/projects.list.contract.test.ts` to assert
      pagination, status, visibility, and total fields.
- [x] T016 [P] [US2] Add integration coverage in
      `/apps/api/tests/integration/projects.test.ts` for multi-project listing
      and archived filtering.
- [x] T017 [P] [US2] Add component-level test
      `/apps/web/src/pages/Dashboard.test.tsx` (or nearest equivalent) verifying
      TanStack Query renders list summaries.
- [x] T039 [P] [US2] Add Playwright coverage
      `/apps/web/tests/e2e/dashboard/project-navigation.e2e.ts` asserting
      dashboard→project→dashboard retains filters, search, and scroll state.
- [x] T041 [P] [US2] Add regression test (component or Playwright) ensuring
      dashboard preserves existing list data and surfaces retry messaging when
      project fetch fails.

### Implementation for User Story 2

- [x] T018 [US2] Update list handler in `/apps/api/src/routes/projects.ts` to
      support pagination, include lifecycle fields, and optionally include
      archived projects.
- [x] T019 [US2] Introduce projects query hook
      (`/apps/web/src/hooks/use-projects-query.ts`) backed by TanStack Query
      with background refetch logic.
- [x] T020 [US2] Refactor `/apps/web/src/pages/Dashboard.tsx` to consume query
      hook, render status/goal badges, and handle loading/error states per spec.
- [x] T021 [US2] Sync `/apps/web/src/components/sidebar/ProjectsNav.tsx` with
      query store to reflect active project counts and highlight selected
      project.
- [x] T040 [US2] Persist dashboard view preferences (filters/search/scroll) and
      restore them after returning from project detail to satisfy FR-005.
- [x] T042 [US2] Implement resilient error handling on dashboard fetch failures
      (retain prior list snapshot, show inline retry) per edge-case expectation.

**Checkpoint**: User Story 1 + 2 deliverable independently testable; dashboard
reflects multiple projects accurately.

---

## Phase 5: User Story 3 – Update an existing project (Priority: P3)

**Goal**: Authorized users can edit project metadata with concurrency safeguards
and status transitions.

**Independent Test**: Open project detail, adjust metadata, observe success
path, then trigger stale update to confirm conflict handling.

### Tests for User Story 3 (write first)

- [x] T022 [P] [US3] Add contract assertions in
      `/apps/api/tests/contract/projects-api.test.ts` for
      `PATCH /api/v1/projects/:id` requiring `If-Unmodified-Since`.
- [x] T023 [P] [US3] Extend `/apps/api/tests/integration/projects.test.ts` with
      concurrency conflict scenario and status transition checks.
- [x] T024 [P] [US3] Add Playwright spec
      `/apps/web/tests/e2e/dashboard/project-update.e2e.ts` simulating edit
      success and conflict messaging.

### Implementation for User Story 3

- [x] T025 [US3] Enforce concurrency header, status transitions, and goal
      validation in `/apps/api/src/routes/projects.ts` patch handler
      (FR-006/007).
- [x] T026 [US3] Update update mutation pipeline in `/apps/web/src/lib/api.ts`
      and `/apps/web/src/lib/api-context.tsx` to send/refresh
      `If-Unmodified-Since`.
- [x] T027 [US3] Implement editable metadata form and conflict banner in
      `/apps/web/src/pages/Project.tsx`, including status selector tied to
      lifecycle map.
- [x] T028 [P] [US3] Provide reusable toast/dialog messaging for conflicts in
      `/apps/web/src/components/feedback/ProjectMutationAlerts.tsx`.

**Checkpoint**: User Story 3 independently testable with concurrency protections
verified.

---

## Phase 6: User Story 4 – Archive a project no longer in active use (Priority: P4)

**Goal**: Authorized users can archive projects (soft delete) and restore them
while preserving audit trail.

**Independent Test**: Archive a project via dashboard, confirm removal from
active list, then restore and verify it returns with the status and metadata
captured before archival.

### Tests for User Story 4 (write first)

- [x] T029 [P] [US4] Add contract tests for `DELETE /api/v1/projects/:id` and
      `POST /api/v1/projects/:id/restore` in
      `/apps/api/tests/contract/projects-api.test.ts`.
- [x] T030 [P] [US4] Extend `/apps/api/tests/integration/projects.test.ts` with
      archive/restore path validating soft-delete columns and audit logging.
- [x] T031 [P] [US4] Add Playwright scenario
      `/apps/web/tests/e2e/dashboard/project-archive.e2e.ts` verifying
      archive/restore controls and list filtering.
- [x] T043 [P] [US4] Add Playwright or integration coverage ensuring viewers see
      archive notification and guided redirect when a project is archived
      mid-session.

### Implementation for User Story 4

- [x] T032 [US4] Implement archive and restore handlers in
      `/apps/api/src/routes/projects.ts`, capturing pre-archive status/metadata,
      updating activity logs, and returning the restored state.
- [x] T033 [US4] Add repository helpers (`archiveProject`, `restoreProject`)
      that persist pre-archive status metadata and adjust soft-delete filtering
      in `/packages/shared-data/src/models/project.ts`.
- [x] T034 [US4] Extend API client (`/apps/web/src/lib/api.ts`) and context to
      expose archive/restore mutations with query invalidation and restored
      status hydration.
- [x] T035 [US4] Introduce archive controls (overflow menu, confirm dialog) in
      `/apps/web/src/pages/Dashboard.tsx` and accompanying badge updates
      reflecting restored status.
- [x] T044 [US4] Surface archive-notification UX for active viewers
      (toast/banner plus redirect) backed by refetch/polling to handle
      concurrent archive events.

**Checkpoint**: All four user stories complete; archived projects handled
end-to-end.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Final hardening across stories.

- [x] T036 [P] [Polish] Update `/specs/016-a-user-should-be-able/quickstart.md`
      with final verification steps and troubleshooting notes.
- [x] T037 [Polish] Audit logging and request tracing in
      `/apps/api/src/routes/projects.ts` to ensure new operations emit
      structured logs per Constitution.
- [x] T038 [P] [Polish] Run full verification suite (`pnpm lint`,
      `pnpm typecheck`, `pnpm test`,
      `pnpm --filter @ctrl-freaq/web test:e2e:quick`) and capture results in
      implementation log.
- [x] T045 [Polish] Instrument create and dashboard flows to capture
      SC-001/SC-002 timings (telemetry hooks, Vitest/Playwright assertions,
      quickstart updates).
- [x] T046 [Polish] Define and document success-rate sampling process for SC-003
      (QA checklist, telemetry aggregation, troubleshooting guidance).
- [x] T047 [Polish] Add archived-project audit sampling script/tests to ensure
      <5% manual correction rate per SC-004.

---

## Dependencies & Execution Order

- **Phase 1 → Phase 2**: Setup tasks enable foundational schema work.
- **Phase 2 → User Stories**: Foundational lifecycle schema/migration must land
  before any user story begins.
- **User Story Dependencies**:
  - US1 is the MVP baseline.
  - US2 builds on query infrastructure introduced in US1 but can run after
    foundation + US1 completion.
  - US3 depends on US1 API changes to exist (PATCH handler updates extend
    earlier work).
  - US4 relies on lifecycle fields and repository helpers from foundation and
    may proceed after US1 (archive actions require creation list).
- **Polish**: Final sweep after desired stories complete, including
  success-criteria instrumentation (T045–T047).

---

## Parallel Execution Examples

- After Phase 2, contract/integration/Playwright tests for each story (e.g.,
  T008–T010) can be authored in parallel.
- API client updates (T012, T019, T026, T034) touch the same file and should run
  sequentially, but UI tasks on different components (T013, T020, T027, T035)
  can be split across engineers once dependencies met.
- Migration work (T006) should complete before parallelizing other phases to
  avoid rebasing conflicts.
- Reserve Polish instrumentation tasks (T045–T047) until after user stories
  settle to avoid noisy telemetry baselines.

---

## Implementation Strategy

### MVP First

1. Complete Phases 1–2.
2. Deliver User Story 1 (T008–T014) and validate via quickstart—this is the
   minimum deployable increment.

### Incremental Delivery

- Post-MVP, deliver US2 for richer dashboard context, then US3 concurrency
  improvements, finishing with US4 archive capability.
- Each story has its own tests ensuring independent demo readiness.

### Team Parallelism

- Developer A: Foundation + US1 backend.
- Developer B: US1 frontend + US2 query/UI work.
- Developer C: US3/US4 API + tests once earlier phases land.

---

## Implementation Log

_Maintained by `/speckit.implement`; newest entries go at the top._

- 2025-10-28T06:17:46Z — F020/F021 Guarded DateTimeFormat stub handling in the
  dashboard goal-date test and allowed timezone offset headers through API CORS;
  key files: `apps/web/src/pages/Dashboard.goal-date.test.tsx`,
  `apps/api/src/app.ts`, `apps/api/tests/integration/projects.test.ts`;
  commands:
  `pnpm --filter @ctrl-freaq/web test -- src/pages/Dashboard.goal-date.test.tsx`,
  `pnpm --filter @ctrl-freaq/api test -- tests/integration/projects.test.ts`,
  `pnpm typecheck`; validations: Vitest unit and API integration suites pass
  with preflight assertions, and workspace typecheck/build completes cleanly;
  follow-ups: continue manual QA monitoring of `X-Client-Timezone-Offset`
  adoption noted in earlier log entry.
- 2025-10-31T16:12:45Z — F019 Backfilled legacy archived snapshot metadata and
  added regression coverage; key files:
  `packages/shared-data/src/models/project.ts`,
  `packages/shared-data/src/repositories/project.repository.test.ts`,
  `packages/shared-data/tests/project.migration.test.ts`,
  `packages/shared-data/migrations/20251031_project_archive_snapshot_backfill.sql`;
  commands:
  `pnpm --filter @ctrl-freaq/shared-data test -- src/repositories/project.repository.test.ts`,
  `pnpm --filter @ctrl-freaq/shared-data test -- project.migration.test.ts`;
  validations: repository and migration suites now confirm legacy archived rows
  hydrate safely and restore to paused status; follow-ups: none.
- 2025-10-28T02:42:06Z — F017/F018 Accepted same-day goal dates for client
  offsets and removed UI date drift; key files:
  `apps/api/src/routes/projects.ts`,
  `apps/api/tests/integration/projects.test.ts`, `apps/web/src/lib/api.ts`,
  `apps/web/src/lib/date-only.ts`, `apps/web/src/pages/Dashboard.tsx`,
  `apps/web/src/pages/Dashboard.goal-date.test.tsx`,
  `apps/web/src/pages/Project.tsx`, `apps/web/src/pages/Project.test.tsx`;
  commands:
  `pnpm --filter @ctrl-freaq/api test -- tests/integration/projects.test.ts`,
  `pnpm --filter @ctrl-freaq/web test -- src/pages/Dashboard.goal-date.test.tsx src/pages/Project.test.tsx`,
  `pnpm lint`; validations: regression suites confirm timezone tolerance and UI
  rendering without drift; follow-ups: monitor downstream clients for header
  adoption of `X-Client-Timezone-Offset` during manual QA.
- 2025-10-28T00:54:29Z — F016 Corrected includeArchived query handling so
  `'false'` stays false; key files: `apps/api/src/routes/projects.ts`,
  `apps/api/tests/contract/projects.list.contract.test.ts`,
  `apps/api/tests/integration/projects.test.ts`; commands:
  `pnpm --filter @ctrl-freaq/api test -- tests/contract/projects.list.contract.test.ts`,
  `pnpm --filter @ctrl-freaq/api test -- tests/integration/projects.test.ts`;
  validations: contract and integration suites verify archived projects remain
  hidden when `includeArchived` is omitted or explicitly set to `'false'`;
  follow-ups: none.
- 2025-10-30T09:55:00Z — F015/F016 Cleared React Query placeholder warning,
  added nav lifecycle badges, and documented lifecycle CLI usage; key files:
  `apps/web/src/hooks/use-projects-query.ts`,
  `apps/web/src/components/sidebar/ProjectsNav.tsx`,
  `apps/web/src/pages/Dashboard.tsx`,
  `specs/016-a-user-should-be-able/quickstart.md`,
  `docs/examples/simple-auth-users.yaml`; commands:
  `pnpm --filter @ctrl-freaq/web test -- src/pages/Dashboard.test.tsx`;
  validations: Dashboard loading UI now remains visible while queries fetch,
  sidebar projects list surfaces status pills, quickstart documents shared-data
  lifecycle CLI flows, and sample simple-auth users ship with `manage:projects`;
  follow-ups: none.

- 2025-10-30T08:05:12Z — F013/F014 Removed concurrency drift tolerance and
  restored lockfiles to Docker contexts; key files:
  `apps/api/src/routes/projects.ts`,
  `apps/api/tests/contract/projects-api.test.ts`,
  `apps/api/tests/integration/projects.test.ts`, `.dockerignore`,
  `specs/016-a-user-should-be-able/tasks.md`; commands:
  `pnpm --filter @ctrl-freaq/api test -- tests/contract/projects-api.test.ts`,
  `pnpm --filter @ctrl-freaq/api test -- tests/integration/projects.test.ts`;
  validations: contract and integration suites now assert 409 whenever
  `If-Unmodified-Since` drifts even 1 ms, project updates keep the latest
  writer, and Docker build contexts retain `pnpm-lock.yaml` for deterministic
  installs; follow-ups: none.
- 2025-10-30T07:15:13Z — F011/F012 Reconciled project creation required fields
  and refreshed US2 seeding guidance; key files:
  `specs/016-a-user-should-be-able/spec.md`,
  `specs/016-a-user-should-be-able/data-model.md`,
  `specs/016-a-user-should-be-able/contracts/projects.openapi.json`,
  `specs/016-a-user-should-be-able/quickstart.md`; commands: _(none —
  documentation updates only)_; validations: Confirmed dossier now reflects the
  single required field (`name`) and provides accurate seeding walkthrough;
  follow-ups: none.
- 2025-10-27T05:58:07Z — F010 Expanded project name allowance to 120 characters
  across shared-data, API validation, and React surfaces while trimming
  generated slugs to the 50-character cap; key files:
  `packages/shared-data/src/models/project.ts`,
  `packages/shared-data/tests/project.lifecycle.test.ts`,
  `apps/api/tests/contract/projects-api.test.ts`,
  `apps/web/src/components/projects/CreateProjectDialog.tsx`,
  `apps/web/src/components/projects/CreateProjectDialog.test.tsx`,
  `apps/web/src/pages/Project.tsx`, `apps/web/src/pages/Project.test.tsx`,
  `specs/016-a-user-should-be-able/contracts/projects.openapi.json`,
  `specs/016-a-user-should-be-able/data-model.md`; commands:
  `pnpm --filter @ctrl-freaq/shared-data test -- project.lifecycle.test.ts`,
  `pnpm --filter @ctrl-freaq/api test -- tests/contract/projects-api.test.ts`,
  `pnpm --filter @ctrl-freaq/web test -- src/components/projects/CreateProjectDialog.test.tsx src/pages/Project.test.tsx`;
  validations: contract and component/unit suites now confirm 120-character
  names succeed end-to-end with slugs truncated to 50 characters; follow-ups:
  none.

- 2025-10-27T04:59:13Z — F009 Raised goal summary limit to spec-compliant 280
  characters across shared-data, API, and web UI; key files:
  `packages/shared-data/src/models/project.ts`,
  `packages/shared-data/tests/project.lifecycle.test.ts`,
  `apps/api/tests/contract/projects-api.test.ts`,
  `apps/api/tests/integration/projects.test.ts`,
  `apps/web/src/components/projects/CreateProjectDialog.tsx`,
  `apps/web/src/pages/Project.tsx`, `apps/web/src/pages/Project.test.tsx`,
  `specs/016-a-user-should-be-able/contracts/projects.openapi.json`,
  `specs/016-a-user-should-be-able/data-model.md`; commands:
  `pnpm --filter @ctrl-freaq/shared-data test -- project.lifecycle.test.ts`,
  `pnpm --filter @ctrl-freaq/api test -- tests/contract/projects-api.test.ts`,
  `pnpm --filter @ctrl-freaq/api test -- tests/integration/projects.test.ts`,
  `pnpm --filter @ctrl-freaq/web test -- src/pages/Project.test.tsx`;
  validations: shared-data schema now accepts 280 characters, API create/update
  routes succeed with 280-character summaries while still rejecting 281+, and
  the Project metadata form enforces the new client-side max; follow-ups: none.

- 2025-10-27T04:17:06Z — F008 Enforced archived-project guard on PATCH by using
  archived-aware lookup and added regression tests; key files:
  `apps/api/src/routes/projects.ts`,
  `apps/api/tests/integration/projects.test.ts`,
  `apps/api/tests/contract/projects-api.test.ts`; commands:
  `pnpm --filter @ctrl-freaq/api test -- tests/integration/projects.test.ts`,
  `pnpm --filter @ctrl-freaq/api test -- tests/contract/projects-api.test.ts`;
  follow-ups: none.
- 2025-10-27T13:55:00Z — F005/F006/F007 Hardened archived slug handling,
  stabilized shared-data CLI lifecycle test, and migrated lint ignores into
  config; key files: `apps/api/tests/integration/projects.test.ts`,
  `packages/shared-data/src/models/project.ts`,
  `packages/shared-data/tests/cli.project-lifecycle.test.ts`,
  `eslint.config.js`; commands:
  `pnpm --filter @ctrl-freaq/api test -- tests/integration/projects.test.ts -t "returns 409 when creating a project with the name of an archived project"`,
  `pnpm --filter @ctrl-freaq/shared-data test -- cli.project-lifecycle.test.ts`,
  `pnpm lint`; follow-ups: none.
- 2025-10-27T12:52:23Z — F004 Cleared metadata edit mode after successful save
  and added regression test covering view-mode restoration; key files:
  `apps/web/src/pages/Project.tsx`, `apps/web/src/pages/Project.test.tsx`,
  `specs/016-a-user-should-be-able/tasks.md`; commands:
  `pnpm --filter @ctrl-freaq/web test -- src/pages/Project.test.tsx`;
  follow-ups: none.
- 2025-10-27T11:28:35Z — F002/F003 Added read-only project detail view with
  explicit edit toggle and hardened metadata form autofill hints; key files:
  `apps/web/src/pages/Project.tsx`, `apps/web/src/pages/Project.test.tsx`,
  `specs/016-a-user-should-be-able/tasks.md`; commands:
  `pnpm --filter @ctrl-freaq/web test -- src/pages/Project.test.tsx`;
  follow-ups: monitor dashboard→project navigation to ensure metadata view
  toggle preserves scroll state noted in prior follow-up.
- 2025-10-26T23:03:38Z — F001 Restored archived status snapshot handling for
  project restore flow; key files: `packages/shared-data/src/models/project.ts`,
  `apps/api/tests/integration/projects.test.ts`,
  `apps/api/tests/contract/projects-api.test.ts`,
  `apps/api/tests/integration/projects.logging.test.ts`; commands:
  `pnpm --filter @ctrl-freaq/api test -- tests/integration/projects.test.ts`,
  `pnpm --filter @ctrl-freaq/api test -- tests/contract/projects-api.test.ts`;
  follow-ups: none.

- 2025-10-26T21:35:00Z — T036/T037/T038/T045/T046/T047 Added request-duration
  logging, dashboard telemetry instrumentation, archived-project audit sampling
  utilities, and quickstart success-criteria guidance; key files:
  `apps/api/src/routes/projects.ts`,
  `apps/api/tests/integration/projects.logging.test.ts`,
  `apps/web/src/pages/Dashboard.tsx`, `apps/web/src/pages/Dashboard.test.tsx`,
  `apps/web/tests/e2e/dashboard/project-navigation.e2e.ts`,
  `packages/qa/src/audit/archived-projects.ts`, `packages/qa/src/cli.ts`,
  `specs/016-a-user-should-be-able/quickstart.md`,
  `specs/016-a-user-should-be-able/tasks.md`; commands:
  `pnpm --filter @ctrl-freaq/api test -- tests/integration/projects.logging.test.ts`,
  `pnpm --filter @ctrl-freaq/web test -- src/lib/telemetry/client-events.test.ts`,
  `pnpm --filter @ctrl-freaq/web test -- src/pages/Dashboard.test.tsx`,
  `pnpm --filter @ctrl-freaq/qa test -- src/audit/archived-projects.test.ts`,
  `pnpm lint`, `pnpm typecheck`, `pnpm test`,
  `pnpm --filter @ctrl-freaq/web test:e2e:quick`; validations: API lifecycle
  logs emit `durationMs`, dashboard telemetry appears during fixture runs, QA
  CLI output surfaces correction rate/sample sufficiency; follow-ups: continue
  telemetry sampling for SC metrics and watch API update logs for sustained ≥85%
  success rate.

- 2025-10-26T00:33:45Z — T029/T030/T031/T043/T032/T033/T034/T035/T044 Verified
  archive/restore contract + integration suites, hardened API client fixtures,
  surfaced inline restore CTA, and tightened archive polling UX; key files:
  `apps/api/tests/contract/projects-api.test.ts`,
  `apps/api/tests/integration/projects.test.ts`, `apps/web/src/lib/api.ts`,
  `apps/web/src/pages/Dashboard.tsx`, `apps/web/src/pages/Project.tsx`;
  commands:
  `pnpm --filter @ctrl-freaq/web test:e2e:quick -- tests/e2e/dashboard/project-archive.e2e.ts`;
  validations: Playwright archive scenarios now pass end-to-end with immediate
  restore control and <2s archive notification latency; follow-ups: run
  remaining Polish tasks (T036–T047) before release.
- 2025-10-25T22:52:20Z — T022/T023/T024/T025/T026/T027/T028 Added ±1s
  concurrency tolerance coverage and refreshed client update flow; key files:
  `apps/api/tests/contract/projects-api.test.ts`,
  `apps/api/tests/integration/projects.test.ts`,
  `apps/api/src/routes/projects.ts`, `apps/web/src/lib/api.ts`,
  `apps/web/tests/e2e/dashboard/project-update.e2e.ts`,
  `specs/016-a-user-should-be-able/tasks.md`; commands:
  `pnpm --filter @ctrl-freaq/api test -- tests/contract/projects-api.test.ts -t "accepts If-Unmodified-Since values within one second tolerance"`,
  `pnpm --filter @ctrl-freaq/api test -- tests/integration/projects.test.ts -t "accepts concurrency headers within one second tolerance"`,
  `pnpm --filter @ctrl-freaq/web test:e2e:quick -- tests/e2e/dashboard/project-update.e2e.ts`;
  validations: API now accepts header drift ≤1s and surfaces conflict metadata,
  UI refreshes concurrency token from Last-Modified and reloads latest project
  copy after conflicts; follow-ups: full projects-api contract suite still
  failing restore case pending US4 archive/restore implementation.

- 2025-10-25T21:36:45Z — T018/T019/T020/T021/T040/T042 Implemented dashboard
  list delivery via shared search-ready API and persisted view state; key files:
  `apps/api/src/routes/projects.ts`,
  `packages/shared-data/src/models/project.ts`,
  `apps/web/src/hooks/use-projects-query.ts`,
  `apps/web/src/pages/Dashboard.tsx`,
  `apps/web/src/components/sidebar/ProjectsNav.tsx`,
  `apps/web/tests/e2e/dashboard/project-navigation.e2e.ts`; commands:
  `pnpm --filter @ctrl-freaq/api test -- tests/contract/projects.list.contract.test.ts`,
  `pnpm --filter @ctrl-freaq/api test -- tests/integration/projects.test.ts`,
  `pnpm --filter @ctrl-freaq/web test -- Dashboard.test.tsx`,
  `pnpm --filter @ctrl-freaq/web test:e2e:quick -- --grep "Dashboard"`;
  validations: dashboard query hook now hydrates pagination/search, inline retry
  preserves cache, and Playwright navigation spec exercises scroll/search
  persistence; follow-ups: investigate React Query warning about undefined data
  to ensure all consumers return explicit payloads.
- 2025-10-25T05:58:25Z — T015/T016/T017/T039/T041 Authored US2 list coverage
  tests across API contract/integration, dashboard unit, and Playwright flows;
  key files: `apps/api/tests/contract/projects.list.contract.test.ts`,
  `apps/api/tests/integration/projects.test.ts`,
  `apps/web/src/pages/Dashboard.test.tsx`,
  `apps/web/tests/e2e/dashboard/project-navigation.e2e.ts`; commands:
  `pnpm --filter @ctrl-freaq/api test -- tests/contract/projects.list.contract.test.ts`
  (failed: pnpm unavailable in current shell),
  `npx pnpm --filter @ctrl-freaq/api test -- tests/contract/projects.list.contract.test.ts`
  (failed: sandbox abort); follow-ups: update list handler to return real
  lastModified timestamps, add dashboard search/filter persistence, and ensure
  error refetch path retains list data.

- 2025-10-25T05:37:41Z — T011/T012/T013/T014 Delivered API and dashboard project
  creation flow with lifecycle metadata; key files:
  `apps/api/src/routes/projects.ts`, `apps/web/src/lib/api.ts`,
  `apps/web/src/pages/Dashboard.tsx`,
  `apps/web/src/components/projects/CreateProjectDialog.tsx`,
  `apps/web/src/components/sidebar/ProjectsNav.tsx`; commands:
  `pnpm --filter @ctrl-freaq/api test -- tests/contract/projects-api.test.ts`,
  `pnpm --filter @ctrl-freaq/api test -- tests/integration/projects.test.ts`,
  `pnpm --filter @ctrl-freaq/web test:e2e:quick -- tests/e2e/dashboard/project-create.e2e.ts`;
  follow-ups: ensure future API endpoints reuse fixture-aware helper and extend
  nav to show lifecycle badges after US2.`

- 2025-10-25T04:43:00Z — T008/T009/T010 Added lifecycle create coverage across
  contract, integration, and dashboard E2E flows; key files:
  `apps/api/tests/contract/projects-api.test.ts`,
  `apps/api/tests/integration/projects.test.ts`,
  `apps/web/tests/e2e/dashboard/project-create.e2e.ts`; commands:
  `pnpm --filter @ctrl-freaq/api test -- tests/contract/projects-api.test.ts`
  (fails: create route missing lifecycle defaults/validation),
  `pnpm --filter @ctrl-freaq/api test -- tests/integration/projects.test.ts`
  (fails: activity log metadata lacks lifecycle fields),
  `pnpm --filter @ctrl-freaq/web test:e2e:quick -- tests/e2e/dashboard/project-create.e2e.ts`
  (fails: dashboard modal/dialog not implemented); follow-ups: implement API
  lifecycle validation + audit metadata, expose project create modal with
  TanStack Query refresh to satisfy new assertions.

- 2025-10-25T15:30:35Z — T007 Added project lifecycle CLI commands for
  list/archive/restore; key files: `packages/shared-data/src/cli.ts`,
  `packages/shared-data/tests/cli.project-lifecycle.test.ts`; commands:
  `pnpm --filter @ctrl-freaq/shared-data test -- cli.project-lifecycle.test.ts`;
  validations: end-to-end CLI flow exercises lifecycle transitions with JSON
  output; follow-ups: add CLI docs once API routes land and ensure simple-auth
  actors exist in seed scripts.
- 2025-10-25T15:30:18Z — T006 Delivered forward/backward-safe migration for
  project lifecycle fields; key files:
  `packages/shared-data/migrations/20251025_project_lifecycle.sql`,
  `packages/shared-data/src/migrations/20251025_project_lifecycle.ts`,
  `packages/shared-data/tests/project.migration.test.ts`,
  `packages/shared-data/src/migrations/index.ts`; commands:
  `pnpm --filter @ctrl-freaq/shared-data test -- project.migration.test.ts`;
  validations: migration test confirms lifecycle columns, default status, and
  owner/deleted indexes; follow-ups: coordinate API migration parity and ensure
  integration tests verify lifecycle fields after applying shared-data
  migrations.
- 2025-10-25T02:28:32Z — T005 Expanded shared-data project model with lifecycle
  fields, multi-project support, and archive/restore helpers; key files:
  `packages/shared-data/src/models/project.ts`,
  `packages/shared-data/tests/project.lifecycle.test.ts`,
  `packages/shared-data/src/repositories/project.repository.test.ts`; commands:
  `pnpm --filter @ctrl-freaq/shared-data test -- project.lifecycle.test.ts`,
  `pnpm --filter @ctrl-freaq/shared-data test -- src/repositories/project.repository.test.ts`;
  validations: lifecycle schema and repository suites now pass; follow-ups: add
  lifecycle migration (T006) and CLI parity (T007).

- 2025-10-25T02:16:54Z — T004 Authored lifecycle schema tests covering status,
  visibility, goal defaults, and archive validation; key files:
  `packages/shared-data/tests/project.lifecycle.test.ts`; commands:
  `pnpm --filter @ctrl-freaq/shared-data test -- project.lifecycle.test.ts`
  (expected failure); validations: new tests fail against current schema;
  follow-ups: implement lifecycle fields/migration in T005–T006.
- 2025-10-25T02:12:18Z — T003 Smoke-started API/Web dev servers with 10s
  timeouts; key files: _(runtime only)_; commands:
  `timeout 10 pnpm --filter @ctrl-freaq/api dev`,
  `timeout 10 pnpm --filter @ctrl-freaq/web dev:e2e`; validations: both servers
  reached ready state before timeout-induced SIGTERM; follow-ups: none.
- 2025-10-25T02:11:23Z — T002 Validated API/web env configuration values remain
  aligned with quickstart guidance; key files: `apps/api/.env.local`,
  `apps/web/.env.local`; commands: `cat apps/api/.env.local`,
  `cat apps/web/.env.local`; validations: confirmed `AUTH_PROVIDER=simple`,
  `SIMPLE_AUTH_USER_FILE`, and `VITE_API_BASE_URL=http://localhost:5001/api/v1`;
  follow-ups: none.
- 2025-10-25T02:10:15Z — T001 Verified workspace dependencies via
  `pnpm install`; key files: _(none)_; commands: `pnpm install`; validations:
  install completed cleanly with no missing env vars; follow-ups: none.

---

## Notes

- [P] tasks operate on distinct files or scopes.
- Tests precede implementation in each story to satisfy Test-First mandate.
- Update implementation log and quickstart upon completing major milestones.

## Phase 4.R: Review Follow-Up

- [x] F001 Finding F001: Restore endpoint ignores archived status snapshot as
      described in audit.md
- [x] F002 Finding F002: Project detail opens in edit mode with no view-state
      toggle as described in audit.md
- [x] F003 Finding F003: Metadata form lacks autofill controls, triggering
      password manager overlays as described in audit.md
- [x] F004 Finding F004: Metadata save leaves project stuck in edit mode as
      described in audit.md
- [x] F005 Finding F005: Archived project slugs cause 500 on recreate as
      described in audit.md
- [x] F006 Finding F006: Shared-data CLI lifecycle test times out during pnpm
      test:quick as described in audit.md
- [x] F007 Finding F007: .eslintignore addition triggers lint warning; migrate
      ignores per audit.md
- [x] F008 Finding F008: PROJECT_ARCHIVED guard unreachable on PATCH as
      described in audit.md
- [x] F009 Finding F009: Goal summary cap violates FR-002 (280-char requirement)
      as described in audit.md
- [x] F010 Finding F010: Project name validation capped at 100 chars; raise to
      FR-002-compliant 120 in shared-data, API, and web surfaces as described in
      audit.md
- [x] F011 Finding F011: Align project creation required fields across spec,
      data-model, and contracts as described in audit.md
- [x] F012 Finding F012: Fix quickstart seeding instructions or provision CLI
      support as described in audit.md
- [x] F013 Finding F013: Concurrency tolerance allows stale project updates to
      overwrite newer edits as described in audit.md
- [x] F014 Finding F014: `.dockerignore` drops pnpm-lock.yaml, breaking
      deterministic container builds as described in audit.md
- [x] F015 Finding F015: Remove unsupported .eslintignore and migrate ignore
      patterns per audit.md
- [x] F016 Finding F016: Fix includeArchived boolean parsing so archived
      projects stay hidden when toggle is off, as described in audit.md
- [x] F017 Finding F017: Goal target date rejects same-day entries near UTC as
      described in audit.md
- [x] F018 Finding F018: UI renders goal target dates one day early as described
      in audit.md
- [x] F019 Finding F019: Legacy archived projects fail new schema guard as
      described in audit.md
- [x] F020 Finding F020: Fix Dashboard goal-date test to guard optional
      DateTimeFormat inputs and rerun pnpm typecheck as described in audit.md
- [x] F021 Finding F021: Allow X-Client-Timezone-Offset in API CORS headers so
      lifecycle requests pass browser preflight as described in audit.md

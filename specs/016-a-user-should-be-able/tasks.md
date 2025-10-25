# Tasks: Project Lifecycle Management

**Input**: Design documents from `/specs/016-a-user-should-be-able/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: Required (Constitution mandates TDD). Write failing tests before implementation within each story phase.

**Organization**: Tasks grouped by user story to enable independent implementation and testing.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Confirm local workspace and tooling ready to exercise lifecycle changes.

- [ ] T001 [Setup] Verify workspace dependencies with `pnpm install` and document any missing env variables in `/specs/016-a-user-should-be-able/quickstart.md`.
- [ ] T002 [P] [Setup] Validate API and web environment configs (`AUTH_PROVIDER`, `VITE_API_BASE_URL`) in `/apps/api/.env.local` and `/apps/web/.env.local`, updating quickstart notes if adjustments are required.
- [ ] T003 [P] [Setup] Smoke start dev servers (`pnpm --filter @ctrl-freaq/api dev`, `pnpm --filter @ctrl-freaq/web dev:e2e`) to ensure baseline stack is healthy before feature work.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Extend shared data layer to support lifecycle metadata for all subsequent stories. ⚠️ Complete before beginning any user story.

- [ ] T004 [Foundation] Create failing lifecycle schema tests in `/packages/shared-data/tests/project.lifecycle.test.ts` covering status, visibility, goal fields, and soft-delete behaviour.
- [ ] T005 [Foundation] Update `/packages/shared-data/src/models/project.ts` to add lifecycle fields, remove single-project guardrails, and expose helper methods for archive/restore per research decisions D001–D006.
- [ ] T006 [Foundation] Add forward/backward-safe migration in `/packages/shared-data/src/migrations/20251025_project_lifecycle.ts` and register it in `/packages/shared-data/src/migrations/index.ts`.
- [ ] T007 [P] [Foundation] Extend `/packages/shared-data/src/cli.ts` with project lifecycle subcommands (list statuses, archive, restore) to maintain CLI parity.

**Checkpoint**: Shared data layer supports new lifecycle metadata; migrations applied successfully.

---

## Phase 3: User Story 1 – Create a new project from the dashboard (Priority: P1) 🎯 MVP

**Goal**: Authenticated users can create projects with lifecycle metadata directly from the dashboard.

**Independent Test**: From a clean workspace, create a project via the dashboard and confirm it appears in the list with default `draft` status and recorded metadata.

### Tests for User Story 1 (write first)

- [ ] T008 [P] [US1] Add contract coverage for `POST /api/v1/projects` in `/apps/api/tests/contract/projects-api.test.ts`, asserting new fields and conflict handling.
- [ ] T009 [P] [US1] Extend `/apps/api/tests/integration/projects.test.ts` with creation flow asserting lifecycle defaults and audit logging.
- [ ] T010 [P] [US1] Author Playwright scenario `/apps/web/tests/e2e/dashboard/project-create.e2e.ts` validating dashboard creation UX and immediate list refresh.

### Implementation for User Story 1

- [ ] T011 [US1] Update request schemas and creation handler in `/apps/api/src/routes/projects.ts` to accept lifecycle inputs, set defaults, and return enriched payloads.
- [ ] T012 [US1] Extend API client and context (`/apps/web/src/lib/api.ts`, `/apps/web/src/lib/api-context.tsx`) with typed create mutation supporting visibility/goal fields.
- [ ] T013 [US1] Introduce reusable create dialog component at `/apps/web/src/components/projects/CreateProjectDialog.tsx` with validation aligned to spec FR-001/002.
- [ ] T014 [US1] Wire dashboard creation flow in `/apps/web/src/pages/Dashboard.tsx` to open dialog, submit mutation, and invalidate project queries on success.

**Checkpoint**: User Story 1 complete—project creation works end-to-end with tests passing.

---

## Phase 4: User Story 2 – Review project summaries on the dashboard (Priority: P2)

**Goal**: Dashboard displays all accessible projects with status, goal timeline, and summary metadata in real time.

**Independent Test**: Seed multiple projects, open dashboard, and verify cards/side navigation render accurate lifecycle data within 2 seconds.

### Tests for User Story 2 (write first)

- [ ] T015 [P] [US2] Enhance `/apps/api/tests/contract/projects.list.contract.test.ts` to assert pagination, status, visibility, and total fields.
- [ ] T016 [P] [US2] Add integration coverage in `/apps/api/tests/integration/projects.test.ts` for multi-project listing and archived filtering.
- [ ] T017 [P] [US2] Add component-level test `/apps/web/src/pages/Dashboard.test.tsx` (or nearest equivalent) verifying TanStack Query renders list summaries.
- [ ] T039 [P] [US2] Add Playwright coverage `/apps/web/tests/e2e/dashboard/project-navigation.e2e.ts` asserting dashboard→project→dashboard retains filters, search, and scroll state.
- [ ] T041 [P] [US2] Add regression test (component or Playwright) ensuring dashboard preserves existing list data and surfaces retry messaging when project fetch fails.

### Implementation for User Story 2

- [ ] T018 [US2] Update list handler in `/apps/api/src/routes/projects.ts` to support pagination, include lifecycle fields, and optionally include archived projects.
- [ ] T019 [US2] Introduce projects query hook (`/apps/web/src/hooks/use-projects-query.ts`) backed by TanStack Query with background refetch logic.
- [ ] T020 [US2] Refactor `/apps/web/src/pages/Dashboard.tsx` to consume query hook, render status/goal badges, and handle loading/error states per spec.
- [ ] T021 [US2] Sync `/apps/web/src/components/sidebar/ProjectsNav.tsx` with query store to reflect active project counts and highlight selected project.
- [ ] T040 [US2] Persist dashboard view preferences (filters/search/scroll) and restore them after returning from project detail to satisfy FR-005.
- [ ] T042 [US2] Implement resilient error handling on dashboard fetch failures (retain prior list snapshot, show inline retry) per edge-case expectation.

**Checkpoint**: User Story 1 + 2 deliverable independently testable; dashboard reflects multiple projects accurately.

---

## Phase 5: User Story 3 – Update an existing project (Priority: P3)

**Goal**: Authorized users can edit project metadata with concurrency safeguards and status transitions.

**Independent Test**: Open project detail, adjust metadata, observe success path, then trigger stale update to confirm conflict handling.

### Tests for User Story 3 (write first)

- [ ] T022 [P] [US3] Add contract assertions in `/apps/api/tests/contract/projects-api.test.ts` for `PATCH /api/v1/projects/:id` requiring `If-Unmodified-Since`.
- [ ] T023 [P] [US3] Extend `/apps/api/tests/integration/projects.test.ts` with concurrency conflict scenario and status transition checks.
- [ ] T024 [P] [US3] Add Playwright spec `/apps/web/tests/e2e/dashboard/project-update.e2e.ts` simulating edit success and conflict messaging.

### Implementation for User Story 3

- [ ] T025 [US3] Enforce concurrency header, status transitions, and goal validation in `/apps/api/src/routes/projects.ts` patch handler (FR-006/007).
- [ ] T026 [US3] Update update mutation pipeline in `/apps/web/src/lib/api.ts` and `/apps/web/src/lib/api-context.tsx` to send/refresh `If-Unmodified-Since`.
- [ ] T027 [US3] Implement editable metadata form and conflict banner in `/apps/web/src/pages/Project.tsx`, including status selector tied to lifecycle map.
- [ ] T028 [P] [US3] Provide reusable toast/dialog messaging for conflicts in `/apps/web/src/components/feedback/ProjectMutationAlerts.tsx`.

**Checkpoint**: User Story 3 independently testable with concurrency protections verified.

---

## Phase 6: User Story 4 – Archive a project no longer in active use (Priority: P4)

**Goal**: Authorized users can archive projects (soft delete) and restore them while preserving audit trail.

**Independent Test**: Archive a project via dashboard, confirm removal from active list, then restore and verify it returns with the status and metadata captured before archival.

### Tests for User Story 4 (write first)

- [ ] T029 [P] [US4] Add contract tests for `DELETE /api/v1/projects/:id` and `POST /api/v1/projects/:id/restore` in `/apps/api/tests/contract/projects-api.test.ts`.
- [ ] T030 [P] [US4] Extend `/apps/api/tests/integration/projects.test.ts` with archive/restore path validating soft-delete columns and audit logging.
- [ ] T031 [P] [US4] Add Playwright scenario `/apps/web/tests/e2e/dashboard/project-archive.e2e.ts` verifying archive/restore controls and list filtering.
- [ ] T043 [P] [US4] Add Playwright or integration coverage ensuring viewers see archive notification and guided redirect when a project is archived mid-session.

### Implementation for User Story 4

- [ ] T032 [US4] Implement archive and restore handlers in `/apps/api/src/routes/projects.ts`, capturing pre-archive status/metadata, updating activity logs, and returning the restored state.
- [ ] T033 [US4] Add repository helpers (`archiveProject`, `restoreProject`) that persist pre-archive status metadata and adjust soft-delete filtering in `/packages/shared-data/src/models/project.ts`.
- [ ] T034 [US4] Extend API client (`/apps/web/src/lib/api.ts`) and context to expose archive/restore mutations with query invalidation and restored status hydration.
- [ ] T035 [US4] Introduce archive controls (overflow menu, confirm dialog) in `/apps/web/src/pages/Dashboard.tsx` and accompanying badge updates reflecting restored status.
- [ ] T044 [US4] Surface archive-notification UX for active viewers (toast/banner plus redirect) backed by refetch/polling to handle concurrent archive events.

**Checkpoint**: All four user stories complete; archived projects handled end-to-end.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Final hardening across stories.

- [ ] T036 [P] [Polish] Update `/specs/016-a-user-should-be-able/quickstart.md` with final verification steps and troubleshooting notes.
- [ ] T037 [Polish] Audit logging and request tracing in `/apps/api/src/routes/projects.ts` to ensure new operations emit structured logs per Constitution.
- [ ] T038 [P] [Polish] Run full verification suite (`pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm --filter @ctrl-freaq/web test:e2e:quick`) and capture results in implementation log.
- [ ] T045 [Polish] Instrument create and dashboard flows to capture SC-001/SC-002 timings (telemetry hooks, Vitest/Playwright assertions, quickstart updates).
- [ ] T046 [Polish] Define and document success-rate sampling process for SC-003 (QA checklist, telemetry aggregation, troubleshooting guidance).
- [ ] T047 [Polish] Add archived-project audit sampling script/tests to ensure <5% manual correction rate per SC-004.

---

## Dependencies & Execution Order

- **Phase 1 → Phase 2**: Setup tasks enable foundational schema work.
- **Phase 2 → User Stories**: Foundational lifecycle schema/migration must land before any user story begins.
- **User Story Dependencies**:
  - US1 is the MVP baseline.
  - US2 builds on query infrastructure introduced in US1 but can run after foundation + US1 completion.
  - US3 depends on US1 API changes to exist (PATCH handler updates extend earlier work).
  - US4 relies on lifecycle fields and repository helpers from foundation and may proceed after US1 (archive actions require creation list).
- **Polish**: Final sweep after desired stories complete, including success-criteria instrumentation (T045–T047).

---

## Parallel Execution Examples

- After Phase 2, contract/integration/Playwright tests for each story (e.g., T008–T010) can be authored in parallel.
- API client updates (T012, T019, T026, T034) touch the same file and should run sequentially, but UI tasks on different components (T013, T020, T027, T035) can be split across engineers once dependencies met.
- Migration work (T006) should complete before parallelizing other phases to avoid rebasing conflicts.
- Reserve Polish instrumentation tasks (T045–T047) until after user stories settle to avoid noisy telemetry baselines.

---

## Implementation Strategy

### MVP First

1. Complete Phases 1–2.
2. Deliver User Story 1 (T008–T014) and validate via quickstart—this is the minimum deployable increment.

### Incremental Delivery

- Post-MVP, deliver US2 for richer dashboard context, then US3 concurrency improvements, finishing with US4 archive capability.
- Each story has its own tests ensuring independent demo readiness.

### Team Parallelism

- Developer A: Foundation + US1 backend.
- Developer B: US1 frontend + US2 query/UI work.
- Developer C: US3/US4 API + tests once earlier phases land.

---

## Implementation Log

*Maintained by `/speckit.implement`; newest entries go at the top.*

- _Pending – populate during implementation_

---

## Notes

- [P] tasks operate on distinct files or scopes.
- Tests precede implementation in each story to satisfy Test-First mandate.
- Update implementation log and quickstart upon completing major milestones.

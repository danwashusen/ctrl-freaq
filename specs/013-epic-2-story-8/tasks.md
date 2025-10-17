# Tasks: Quality Gates Integration

**Input**: Design documents from `/specs/013-epic-2-story-8/` **Prerequisites**:
plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: Constitution mandates test-first delivery. Each user story phase
begins with failing tests before implementation.

**Organization**: Tasks are grouped by user story to enable independent
implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3,
  Setup, Foundation)
- Include exact file paths in descriptions (rooted at repository root)

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Establish scaffolding for backend and frontend quality gate modules
plus test fixtures.

- [x] T001 [P] [Setup] Scaffold `/apps/api/src/modules/quality-gates/`
      directories (`controllers/`, `services/`, `types/`) with barrel exports so
      subsequent tasks have concrete targets.
- [x] T002 [P] [Setup] Create
      `/apps/web/src/features/document-editor/quality-gates/` module structure
      (`components/`, `hooks/`, `stores/`) and add placeholder tests (e.g.,
      `SectionQualityStatusChip.test.tsx`) colocated with components; export
      stubs via `/apps/web/src/features/document-editor/index.ts`.
- [x] T003 [Setup] Seed Playwright and Vitest fixtures with gate scenarios by
      adding `/apps/web/tests/e2e/fixtures/document-quality.ts` and registering
      it in `/apps/web/tests/e2e/document-editor/fixtures.ts`.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Provide shared data models, telemetry contracts, and CLI surfaces
required by every story.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [x] T004 [Foundation] Create shared quality gate status exports in
      `/packages/editor-core/src/quality-gates/status.ts` and re-export via
      `/packages/editor-core/src/index.ts`.
- [x] T005 [Foundation] Add `SectionQualityGateResult` and
      `DocumentQualityGateSummary` models, repositories, and migration in
      `/packages/shared-data/src/models/quality-gates/`,
      `/packages/shared-data/src/repositories/quality-gates/`, and
      `/packages/shared-data/src/migrations/20251013_quality_gates.ts`.
- [x] T006 [Foundation] Extend traceability persistence to track coverage states
      by updating
      `/packages/shared-data/src/repositories/traceability/traceability.repository.ts`
      and related types.
- [x] T007 [Foundation] Expand telemetry and audit logging to include validation
      `requestId`, `triggeredBy`, and duration fields in
      `/packages/qa/src/audit/index.ts`,
      `/apps/api/src/middleware/ai-request-audit.ts`, and
      `/apps/web/src/lib/telemetry/client-events.ts`.
- [x] T008 [Foundation] Add CLI scaffolding for `run-section` and `run-document`
      commands in `/packages/qa/src/cli.ts` with stub handlers resolved from new
      services.

**Checkpoint**: Foundation ready — user story implementation can now begin.

---

## Phase 3: User Story 1 – Section-Level Validation Feedback (Priority: P1) 🎯 MVP

**Goal**: Deliver <2 s section validations with inline remediation guidance and
block submission while blockers exist.

**Independent Test**: From
`/apps/web/tests/e2e/document-editor/quality-gates-section.e2e.ts`, modify a
section to trigger blockers, observe remediation cards, resolve issues, and
verify publish remains blocked until a successful re-run.

### Tests for User Story 1 (write first, ensure they fail)

- [x] T009 [P] [US1] Author failing QA runner unit tests in
      `/packages/qa/src/gates/section/section-quality-runner.test.ts` covering
      status transitions, remediation payload, and duration recording.
- [x] T010 [P] [US1] Write contract tests for section gate endpoints in
      `/apps/api/tests/contract/quality-gates/sections.contract.test.ts`
      capturing `POST /sections/{id}/quality-gates/run` and
      `GET /sections/{id}/quality-gates`.
- [x] T011 [P] [US1] Create React store/component tests in
      `/apps/web/tests/unit/stores/quality-gates/section-quality-store.test.tsx`
      validating progress messaging, blocker gating, and timeout copy.
- [x] T012 [P] [US1] Add Playwright scenario
      `/apps/web/tests/e2e/document-editor/quality-gates-sla.e2e.ts` that
      measures validation start/finish timestamps, asserts status update within
      2 s, and verifies telemetry emits the SLA metric.
- [x] T012a [P] [US1] Add Playwright scenario
      `/apps/web/tests/e2e/document-editor/quality-gates-neutral.e2e.ts` that
      opens a never-edited section, confirms the neutral badge/tooltip, and
      prompts authors to run validation before submission.
- [x] T013 [P] [US1] Add timeout-handling unit test in
      `/apps/api/tests/unit/quality-gates/section-runner-timeout.test.ts`
      ensuring incident IDs propagate when the runner fails.

### Implementation for User Story 1

- [x] T014 [US1] Implement section gate runner orchestration in
      `/packages/qa/src/gates/section/section-quality-runner.ts` returning
      structured results consistent with tests.
- [x] T015 [US1] Encode remediation guidance mini-card definitions (severity
      badge, bullet steps, optional doc link) in
      `/packages/qa/src/gates/section/remediation-guidance.ts`.
- [x] T016 [US1] Add `POST /sections/:sectionId/quality-gates/run` and
      `GET /sections/:sectionId/quality-gates` routes in
      `/apps/api/src/routes/quality-gates.ts` delegating to new services.
- [x] T017 [US1] Implement section gate service in
      `/apps/api/src/modules/quality-gates/services/section-quality.service.ts`
      to persist results, emit telemetry, and enqueue traceability sync events.
- [x] T018 [US1] Wire CLI `run-section` command in `/packages/qa/src/cli.ts` to
      call the new service and echo `requestId`.
- [x] T019 [US1] Build section validation hook in
      `/apps/web/src/features/document-editor/quality-gates/hooks/useQualityGates.ts`
      using TanStack Query for auto/manual triggers.
- [x] T020 [P] [US1] Render status chip and remediation cards via
      `/apps/web/src/features/document-editor/quality-gates/components/SectionQualityStatusChip.tsx`
      and `/SectionRemediationList.tsx`.
- [x] T021 [US1] Block section submission and bundled saves when blockers exist
      by updating
      `/apps/web/src/features/document-editor/components/section-card.tsx` to
      consult the quality gate store.
- [x] T022 [US1] Localize progress copy and helper text in
      `/apps/web/src/lib/i18n/doc-quality.json` and ensure loader exports the
      namespace.
- [x] T022a [US1] Initialize neutral validation state in
      `/apps/web/src/features/document-editor/quality-gates/stores/section-quality-store.ts`
      and surface the “Validation not run yet” tooltip + CTA in
      `SectionQualityStatusChip.tsx`.
- [x] T023 [US1] Handle runner failures in
      `/apps/api/src/modules/quality-gates/services/section-quality.service.ts`
      by surfacing retryable warnings, logging incident IDs, and exposing state
      to clients.
- [x] T024 [US1] Render timeout warning toast and persistent retry control in
      `/apps/web/src/features/document-editor/quality-gates/components/SectionQualityStatusChip.tsx`,
      displaying incident IDs and linking to re-run validation.

**Checkpoint**: User Story 1 functional and independently testable.

---

## Phase 4: User Story 2 – Document Quality Gate Dashboard (Priority: P2)

**Goal**: Provide aggregated document dashboard with publish gating, summary
tiles, batch re-run, and <5 s refresh telemetry.

**Independent Test**: Run
`/apps/web/tests/e2e/document-editor/quality-gates-dashboard.e2e.ts` to confirm
publish controls remain disabled until blockers clear after dashboard-triggered
re-run.

### Tests for User Story 2 (write first, ensure they fail)

- [x] T025 [P] [US2] Add contract coverage for
      `POST /documents/{id}/quality-gates/run` and
      `GET /documents/{id}/quality-gates/summary` in
      `/apps/api/tests/contract/quality-gates/documents.contract.test.ts`.
- [x] T026 [P] [US2] Create dashboard integration test in
      `/apps/web/tests/integration/document-editor/quality-gates-dashboard.test.tsx`
      verifying summary tiles, publish disabling, and footer metadata.
- [x] T027 [P] [US2] Extend Playwright flow
      `/apps/web/tests/e2e/document-editor/quality-gates-dashboard-sla.e2e.ts`
      to re-run gates, assert summary refresh within 5 s, and ensure telemetry
      logs slow-run warnings.

### Implementation for User Story 2

- [x] T028 [US2] Implement document summary aggregation helpers in
      `/packages/qa/src/dashboard/document-quality-summary.ts` consuming
      persisted section results.
- [x] T029 [US2] Extend service layer with
      `/apps/api/src/modules/quality-gates/services/document-quality.service.ts`
      to orchestrate batch runs and summary retrieval.
- [x] T030 [US2] Register document routes in
      `/apps/api/src/routes/quality-gates.ts` and ensure
      `apps/api/src/services/container.ts` resolves new services and
      repositories.
- [x] T031 [P] [US2] Build dashboard components in
      `/apps/web/src/features/document-editor/quality-gates/components/DocumentQualityDashboard.tsx`
      with severity grouping and shortcuts.
- [x] T032 [US2] Create Zustand slice in
      `/apps/web/src/features/document-editor/quality-gates/stores/document-quality-store.ts`
      syncing counts, footer metadata, SLA timing, and publish flag.
- [x] T033 [US2] Disable publish/export actions with helper copy in
      `/apps/web/src/features/document-editor/components/document-editor.tsx`,
      linking to the dashboard re-run action and surfacing SLA warnings.

**Checkpoint**: User Stories 1 and 2 complete and independently verifiable.

---

## Phase 5: User Story 3 – Traceability Matrix Sync (Priority: P3)

**Goal**: Keep requirement traceability current with filters, orphan
notifications, and coverage gaps surfaced as blockers.

**Independent Test**: Execute
`/apps/web/tests/e2e/document-editor/traceability-matrix.e2e.ts` to confirm
requirement updates reflect latest gate results, filters work, and orphan banner
appears when coverage is removed.

### Tests for User Story 3 (write first, ensure they fail)

- [x] T034 [P] [US3] Write repository unit tests for traceability sync in
      `/packages/shared-data/src/repositories/quality-gates/traceability-sync.repository.test.ts`.
- [x] T035 [P] [US3] Add contract tests for `/documents/{id}/traceability` and
      orphan endpoints in
      `/apps/api/tests/contract/quality-gates/traceability.contract.test.ts`.
- [x] T036 [P] [US3] Add React component tests for filters and orphan banner in
      `/apps/web/tests/unit/components/quality-gates/traceability-matrix.test.tsx`.

### Implementation for User Story 3

- [x] T037 [US3] Implement traceability sync service in
      `/packages/qa/src/traceability/traceability-sync.ts` to map gate outcomes
      to requirements.
- [x] T038 [US3] Update shared-data repository wiring in
      `/packages/shared-data/src/repositories/quality-gates/traceability-sync.repository.ts`
      to persist coverage status, audit events, and timestamps.
- [x] T039 [US3] Expose traceability HTTP handlers in
      `/apps/api/src/modules/quality-gates/controllers/traceability.controller.ts`
      and register routes in `/apps/api/src/routes/quality-gates.ts`.
- [x] T040 [P] [US3] Build matrix components and filter chips in
      `/apps/web/src/features/document-editor/quality-gates/components/TraceabilityMatrix.tsx`
      with two-line previews and status badges.
- [x] T041 [US3] Render orphaned requirement banner and notification workflow in
      `/apps/web/src/features/document-editor/quality-gates/components/TraceabilityAlerts.tsx`
      and connect to dashboard banner.

**Checkpoint**: All user stories independently functional.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Finish documentation, telemetry validation, and accessibility
conformance.

- [x] T042 [P] [Polish] Update developer docs and quickstart walkthroughs in
      `/specs/013-epic-2-story-8/quickstart.md` and `/docs/ui-architecture.md`
      to reference dashboard + traceability flows.
- [x] T043 [Polish] Verify telemetry/audit parity in `/packages/qa/src/audit`
      and `/apps/api/src/middleware/ai-request-audit.ts` ensuring SOC2 logging
      completeness.
- [x] T044 [Polish] Perform accessibility checks (ARIA live regions, contrast)
      and adjust UI tokens in
      `/apps/web/src/features/document-editor/quality-gates/components` before
      final review.
- [x] T045 [Polish] Capture clarity-survey artefacts in
      `/specs/013-epic-2-story-8/research.md` (Clarity Survey Artefacts section)
      including prompts and UI copy used to meet SC-005.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)** → Enables directory structure and fixtures for later
  phases.
- **Foundational (Phase 2)** → Depends on Phase 1, BLOCKS all user story phases.
- **User Story Phases (3–5)** → Each depends on Foundational completion; proceed
  in priority order (US1 → US2 → US3) or in parallel once prerequisites
  resolved.
- **Polish (Phase 6)** → Final pass after desired user stories are complete.

### User Story Dependencies

- **US1**: Requires Phase 1–2; no dependency on other stories.
- **US2**: Depends on US1 data structures (section results) but can start after
  Phase 2 with agreed contracts.
- **US3**: Depends on US1 section results and US2 summary events for coverage
  metadata.

### Within Each User Story

- Tests (contract/unit/UI) must fail first before implementation tasks.
- Models/repositories precede service logic.
- Services precede API routes and CLI/UX integration.
- UI stores must land before rendering components.

---

## Parallel Execution Examples

- **US1**: After T019 lands, tasks T020 and T022a touch separate files and can
  proceed in parallel. Backend work T016–T018 can also run concurrently once
  T014–T015 complete.
- **US2**: T031 (dashboard components) and T032 (store) operate independently
  once T028–T030 finish, enabling parallel frontend work.
- **US3**: T040 (matrix components) and T041 (alerts) can run in parallel after
  T038–T039 expose data.

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phases 1–2 to establish shared infrastructure.
2. Execute Phase 3 (US1) through checkpoint and run Quickstart section
   validation test.
3. Demo section-level validation feedback before proceeding.

### Incremental Delivery

1. Deliver US1 for immediate author feedback improvements.
2. Layer US2 to unlock document owner dashboard.
3. Add US3 for compliance traceability once prior stories stabilize.

### Parallel Team Strategy

1. Shared team completes Phases 1–2.
2. Assign developer A to US1 backend/frontend, developer B to US2 dashboard,
   developer C to US3 traceability once prerequisites satisfy.

---

## Assumption Log

- Assumption: SQLite migrations can handle new tables without cross-environment
  divergence. Rationale: Shared-data package already centralizes migration
  execution.
- Assumption: Existing TanStack Query setup can cache new quality gate
  endpoints. Rationale: Document editor services already leverage the query
  client for section data.
- Assumption (T014): Map remediation state to `pending` for blockers,
  `in-progress` for warnings, and `resolved` for passes so UI consumers can
  reflect next-step guidance consistently. Rationale: Spec defines required
  states but not mapping rules; this aligns severity with remediation
  expectations.
- Assumption (T017): Section runner evaluation temporarily returns an empty rule
  set until rule catalog wiring (T014/T015) lands; service handles
  persistence/telemetry based on future results. Rationale: Specification defers
  rule orchestration to subsequent tasks, so placeholder keeps flow functional.
- [ASSUMPTION] (F002) Section revision identifiers can be derived from the
  section's `approvedVersion` and `updatedAt` timestamp, formatted as
  `rev-{sectionId}-v{version}-{timestamp}` when no dedicated revision record
  exists. Rationale: shared-data repositories expose versioning metadata but not
  explicit revision IDs, so this preserves stable identifiers for traceability
  links without reintroducing run IDs.

---

## Phase 4.R: Review Follow-Up

- [x] F001 Finding F001: Section quality runner never evaluates QA rules —
      resolved per `/specs/013-epic-2-story-8/audit.md` (2025-10-16).
- [x] F002 Finding F002: Traceability sync stores run IDs instead of section
      revisions — resolved per `/specs/013-epic-2-story-8/audit.md`
      (2025-10-16).
- [x] F003 Finding F003: Document summary ignores traceability coverage gaps —
      resolved per `/specs/013-epic-2-story-8/audit.md` (2025-10-16).
- [x] F004 Finding F004: Section run API deviates from published contracts —
      resolved per `/specs/013-epic-2-story-8/audit.md` (2025-10-16).

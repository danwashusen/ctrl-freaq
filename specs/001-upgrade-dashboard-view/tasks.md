# Tasks: Dashboard Shell Alignment

**Input**: Design documents from `/specs/001-upgrade-dashboard-view/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: Vitest (unit) and Playwright (fixture) tests are required per plan.md
and constitutional TDD mandate.

**Organization**: Tasks are grouped by user story to enable independent
implementation and testing.

- 2025-11-03T04:18:00Z — F002–F006: Re-skinned the dashboard shell with
  Story 2.2 gradients, product branding, desktop collapse rail, palette-driven
  status badges, and account footer tile. Updated ProjectsNav glyphs/collapse
  handling and introduced new CSS token coverage with a regression test. Files:
  `apps/web/src/index.css`,
  `apps/web/src/components/dashboard/DashboardShell.tsx`,
  `apps/web/src/components/sidebar/ProjectsNav.tsx`,
  `apps/web/src/pages/Dashboard.tsx`, `apps/web/src/pages/Project.tsx`,
  `apps/web/src/stores/project-store.ts`,
  `apps/web/src/stores/project-store.test.ts`,
  `apps/web/src/pages/Dashboard.test.tsx`, `apps/web/src/index.css.test.ts`.
  Commands:
  `pnpm --filter @ctrl-freaq/web test -- src/pages/Dashboard.test.tsx`,
  `pnpm --filter @ctrl-freaq/web test -- src/stores/project-store.test.ts`,
  `pnpm --filter @ctrl-freaq/web test -- src/index.css.test.ts`,
  `pnpm --filter @ctrl-freaq/web lint`. Follow-ups: none.

## Implementation Log

- 2025-11-03T03:52:24Z — F013, F014: Mapped `ProjectStatusBadge` styling to
  Story 2.2 status tokens and rethemed the sidebar empty-state CTA to the
  primary palette. Files:
  `apps/web/src/components/status/ProjectStatusBadge.tsx`,
  `apps/web/src/components/status/ProjectStatusBadge.test.tsx`,
  `apps/web/src/components/sidebar/ProjectsNav.tsx`,
  `apps/web/src/pages/Dashboard.test.tsx`. Commands:
  `pnpm --filter @ctrl-freaq/web test -- src/components/status/ProjectStatusBadge.test.tsx`,
  `pnpm --filter @ctrl-freaq/web test -- src/pages/Dashboard.test.tsx`,
  `pnpm lint`. Follow-ups: Rerun Playwright dashboard suites to capture visual
  regressions once fixes stabilize; confirm sidebar active-text clarification
  with design.
- 2025-11-03T01:16:42Z — F011, F012: Reworked ProjectsNav layout to prevent
  badge clipping and align row spacing with Story 2.2 compact specs. Files:
  `apps/web/src/components/sidebar/ProjectsNav.tsx`,
  `apps/web/src/components/dashboard/DashboardShell.tsx`,
  `apps/web/src/pages/Dashboard.test.tsx`. Commands:
  `pnpm --filter @ctrl-freaq/web test -- src/pages/Dashboard.test.tsx`,
  `pnpm --filter @ctrl-freaq/web test:e2e -- tests/e2e/dashboard/project-sidebar-navigation.e2e.ts`,
  `pnpm --filter @ctrl-freaq/web test:e2e -- tests/e2e/dashboard/project-sidebar-scroll.e2e.ts`.
  Follow-ups: none.
- 2025-11-03T00:15:02Z — F007, F010: Removed the dashboard main content width
  clamp and moved the Dashboard CTA into its own primary navigation block.
  Files: `apps/web/src/components/dashboard/DashboardShell.tsx`,
  `apps/web/src/components/sidebar/ProjectsNav.tsx`,
  `apps/web/src/pages/Dashboard.test.tsx`,
  `apps/web/tests/e2e/dashboard/dashboard-shell.e2e.ts`,
  `apps/web/tests/e2e/dashboard/project-sidebar-navigation.e2e.ts`,
  `apps/web/tests/e2e/dashboard/project-rehydrate.e2e.ts`,
  `apps/web/tests/integration/sidebar.projects.test.tsx`. Commands:
  `pnpm --filter @ctrl-freaq/web test -- src/pages/Dashboard.test.tsx`,
  `pnpm --filter @ctrl-freaq/web test:e2e -- tests/e2e/dashboard/project-sidebar-navigation.e2e.ts`,
  `pnpm --filter @ctrl-freaq/web test:e2e -- tests/e2e/dashboard/dashboard-shell.e2e.ts`,
  `pnpm --filter @ctrl-freaq/web test:e2e -- tests/e2e/dashboard/project-rehydrate.e2e.ts`.
  Follow-ups: none.
- 2025-11-03T07:15:00Z — F007–F009: Removed the header max-width clamp so the
  banner gutters follow new shell tokens and added a dashboard entry plus folder
  glyph icons in the sidebar. Files:
  `apps/web/src/components/dashboard/DashboardShell.tsx`,
  `apps/web/src/components/sidebar/ProjectsNav.tsx`,
  `apps/web/src/pages/Dashboard.tsx`, `apps/web/src/pages/Project.tsx`,
  `apps/web/src/pages/Dashboard.test.tsx`. Commands:
  `pnpm --filter @ctrl-freaq/web test -- src/pages/Dashboard.test.tsx`.
  Follow-ups: none.
- 2025-11-02T06:55:42Z — F001: Restored Story 2.2 palette tokens and replaced
  dashboard shell/sidebar neutrals with tokenized classes. Files:
  `apps/web/src/index.css`,
  `apps/web/src/components/dashboard/DashboardShell.tsx`,
  `apps/web/src/components/sidebar/ProjectsNav.tsx`,
  `specs/001-upgrade-dashboard-view/audit.md`,
  `specs/001-upgrade-dashboard-view/tasks.md`. Commands:
  `pnpm --filter @ctrl-freaq/web test -- src/pages/Dashboard.test.tsx`.
  Follow-ups: none—palette parity verified.
- 2025-11-01T23:47:31Z — T018–T026a: Completed US3 test-first workflow, sidebar
  state wiring, and polish. Added Vitest coverage for loading/empty/error
  states, new Playwright empty-state CTA spec, and extended navigation spec with
  `performance.mark` instrumentation (81.4 ms SC-002 sample). Implemented
  ProjectsNav empty/error handling, Dashboard filter reset wiring, and Project
  page retry pass-through; refreshed quickstart/research docs. Files:
  `apps/web/src/components/sidebar/ProjectsNav.tsx`,
  `apps/web/src/pages/Dashboard.tsx`, `apps/web/src/pages/Dashboard.test.tsx`,
  `apps/web/src/pages/Project.tsx`,
  `apps/web/tests/e2e/dashboard/project-empty-state.e2e.ts`,
  `apps/web/tests/e2e/dashboard/project-sidebar-navigation.e2e.ts`,
  `specs/001-upgrade-dashboard-view/quickstart.md`,
  `specs/001-upgrade-dashboard-view/research.md`,
  `specs/001-upgrade-dashboard-view/tasks.md`. Commands:
  `pnpm --filter @ctrl-freaq/web test -- src/pages/Dashboard.test.tsx`,
  `pnpm --filter @ctrl-freaq/web test -- src/pages/Project.test.tsx`,
  `pnpm --filter @ctrl-freaq/web test:e2e -- tests/e2e/dashboard/project-empty-state.e2e.ts`,
  `pnpm --filter @ctrl-freaq/web test:e2e -- tests/e2e/dashboard/project-sidebar-navigation.e2e.ts`,
  `pnpm lint`, `pnpm typecheck`, `pnpm test`,
  `pnpm --filter @ctrl-freaq/web test:e2e`.
- 2025-11-01T22:20:36Z — T012–T017 follow-up: Resolved quality gate SLA
  Playwright hang by subscribing to the section run identifier in
  `useQualityGates`, ensuring result polling completes, and cleaning
  fixture/test debug noise. Removed an unused `ArrowLeft` import flagged by
  `tsc`. Files:
  `apps/web/src/features/document-editor/quality-gates/hooks/useQualityGates.ts`,
  `apps/web/src/features/document-editor/quality-gates/stores/section-quality-store.ts`,
  `apps/web/tests/e2e/document-editor/fixtures.ts`,
  `apps/web/tests/e2e/document-editor/quality-gates-sla.e2e.ts`,
  `apps/web/src/pages/Project.tsx`, `specs/001-upgrade-dashboard-view/tasks.md`.
  Commands:
  `pnpm --filter @ctrl-freaq/web test:e2e -- tests/e2e/document-editor/quality-gates-sla.e2e.ts`,
  `pnpm --filter @ctrl-freaq/web test:e2e:quick`, `pnpm build`. Follow-ups:
  Confirm `pnpm lint`, `pnpm typecheck`, and the full gauntlet remain green once
  US3 tasks complete.
- 2025-11-01T00:27:44Z — T012–T017: Expanded dashboard sidebar coverage and
  state handling. Authored Vitest assertions for ProjectsNav ordering, active
  highlight styling, and tooltip accessibility alongside new Playwright
  scenarios for navigation persistence, overflow scrolling, and session
  rehydration. Extended the project store with persisted selection and focus
  tracking, refreshed ProjectsNav styling, wired DashboardShell to the store,
  and refactored useProjectsQuery/dashboard auth effects to invalidate caches on
  sign-out. Files: `apps/web/src/pages/Dashboard.test.tsx`,
  `apps/web/tests/e2e/dashboard/project-sidebar-navigation.e2e.ts`,
  `apps/web/tests/e2e/dashboard/project-sidebar-scroll.e2e.ts`,
  `apps/web/tests/e2e/dashboard/project-rehydrate.e2e.ts`,
  `apps/web/src/stores/project-store.ts`,
  `apps/web/src/stores/project-store.test.ts`,
  `apps/web/src/components/sidebar/ProjectsNav.tsx`, `apps/web/src/index.css`,
  `apps/web/src/components/dashboard/DashboardShell.tsx`,
  `apps/web/src/hooks/use-projects-query.ts`,
  `apps/web/src/pages/Dashboard.tsx`,
  `specs/001-upgrade-dashboard-view/tasks.md`. Commands:
  `pnpm --filter @ctrl-freaq/web test -- src/pages/Dashboard.test.tsx` (fails
  with Sandbox(Signal(6)); Node runtime unavailable). Follow-ups: rerun targeted
  Vitest and new Playwright specs plus lint/typecheck once node execution is
  restored.
- 2025-10-31T23:56:57Z — T005–T011: Added Dashboard shell tests and
  implementation. Created `DashboardShell` wrapper, refactored `Dashboard.tsx`,
  updated sidebar focus handling, and aligned spacing tokens. Files:
  `apps/web/src/components/dashboard/DashboardShell.tsx`,
  `apps/web/src/pages/Dashboard.tsx`,
  `apps/web/tests/e2e/dashboard/dashboard-shell.e2e.ts`,
  `apps/web/src/components/sidebar/ProjectsNav.tsx`, `apps/web/src/index.css`,
  `apps/web/src/pages/Dashboard.test.tsx`. Commands:
  `pnpm --filter @ctrl-freaq/web test -- src/pages/Dashboard.test.tsx`,
  `pnpm --filter @ctrl-freaq/web test:e2e -- tests/e2e/dashboard/dashboard-shell.e2e.ts`,
  `pnpm --filter @ctrl-freaq/web lint`,
  `pnpm --filter @ctrl-freaq/web typecheck`. Follow-ups: Ready for User Story 2
  sidebar enhancements.
- 2025-10-31T23:29:06Z — T003, T004: Documented current dashboard layout tokens
  and stabilized Playwright quality fixtures for deterministic seeds. Files:
  `apps/web/src/pages/Dashboard.tsx`,
  `apps/web/tests/e2e/fixtures/document-quality.ts`,
  `apps/web/tests/e2e/document-editor/fixtures.ts`. Commands:
  `pnpm --filter @ctrl-freaq/web lint`. Follow-ups: Ready to start User Story 1
  test scaffolding.
- 2025-10-31T23:25:57Z — T001, T002: Completed workspace setup. Commands:
  `pnpm install`, `pnpm format`, `pnpm lint:fix`, `pnpm lint`, `pnpm typecheck`,
  `pnpm test`. Key files: none (verification commands only). Validations: lint,
  typecheck, full gauntlet. Follow-ups: Proceed to Phase 2 foundational tasks.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)
- Include exact repository-root anchored file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Confirm local workspace is ready for UI refactor work.

- [x] T001 Verify dependency graph is current by running `pnpm install`
      referenced from `/package.json`.
- [x] T002 Execute baseline quality gates (`pnpm lint`, `pnpm typecheck`,
      `pnpm test`) using commands defined in `/package.json` to ensure a green
      starting point.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared groundwork required before any user story work begins.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [x] T003 Capture current dashboard layout notes and spacing tokens directly in
      `/apps/web/src/pages/Dashboard.tsx` comments to guide shell refactor.
- [x] T004 Refresh Playwright fixture context for dashboard flows by auditing
      `/apps/web/tests/e2e/fixtures/document-quality.ts` (and related imports)
      so upcoming scenarios share consistent seeds.

**Checkpoint**: Foundation ready — user story implementation can begin.

---

## Phase 3: User Story 1 – Stay Oriented in the Dashboard Shell (Priority: P1) 🎯 MVP

**Goal**: Deliver a persistent header + sidebar shell that frames the dashboard
content with accessible landmarks and responsive behavior.

**Independent Test**: Load `/dashboard` while authenticated and confirm header
content, subtitle visibility on desktop, and mobile sidebar toggle with focus
management.

### Tests for User Story 1 (write first)

- [x] T005 [US1] Add Vitest coverage for header landmarks, subtitle visibility,
      and preservation of metrics cards and filter controls in
      `/apps/web/src/pages/Dashboard.test.tsx`.
- [x] T006 [P] [US1] Author Playwright scenario validating header, mobile
      sidebar toggle, and visibility of metrics cards and filters in
      `/apps/web/tests/e2e/dashboard/dashboard-shell.e2e.ts`.

### Implementation for User Story 1

- [x] T007 [US1] Create layout wrapper component
      `/apps/web/src/components/dashboard/DashboardShell.tsx` encapsulating
      header, sidebar slot, and main region.
- [x] T008 [US1] Refactor `/apps/web/src/pages/Dashboard.tsx` to render content
      inside `DashboardShell` while preserving dialogs and toast providers.
- [x] T009 [US1] Implement responsive header controls (settings, account menu,
      subtitle breakpoints) within `/apps/web/src/pages/Dashboard.tsx`.
- [x] T010 [US1] Add focus management and landmark attributes inside
      `/apps/web/src/components/dashboard/DashboardShell.tsx` for mobile overlay
      accessibility.
- [x] T011 [US1] Align global spacing and background tokens in
      `/apps/web/src/index.css` to support the new shell grid.

**Checkpoint**: User Story 1 independently demonstrable (shell structure +
header behavior).

---

## Phase 4: User Story 2 – Navigate Projects from the Sidebar (Priority: P2)

**Goal**: Ensure the sidebar lists projects from live data, highlights the
active project, and routes to project detail without losing dashboard context.

**Independent Test**: With multiple projects loaded, selecting a project in the
sidebar highlights it and navigates to that project’s workspace while retaining
selection on return.

### Tests for User Story 2 (write first)

- [x] T012 [US2] Extend Vitest coverage for sidebar project ordering, active
      highlight, and long-name truncation tooltip in
      `/apps/web/src/pages/Dashboard.test.tsx`.
- [x] T013 [P] [US2] Add Playwright scenario validating sidebar navigation and
      highlight persistence in
      `/apps/web/tests/e2e/dashboard/project-sidebar-navigation.e2e.ts`.
- [x] T013a [P] [US2] Add Playwright scenario for long project lists verifying
      the sidebar scrolls without obscuring header or main content in
      `/apps/web/tests/e2e/dashboard/project-sidebar-scroll.e2e.ts`, referencing
      Edge Case coverage from `spec.md:94-99`.
- [x] T013b [US2] Add Playwright scenario that signs out and back in, asserting
      the projects list refetches fresh data in
      `/apps/web/tests/e2e/dashboard/project-rehydrate.e2e.ts` per
      `spec.md:101`.

### Implementation for User Story 2

- [x] T014 [US2] Extend `/apps/web/src/stores/project-store.ts` to manage
      sidebar open state, capture `lastFocusedTrigger`, and persist active
      project across routes.
- [x] T015 [US2] Update `/apps/web/src/components/sidebar/ProjectsNav.tsx` to
      consume store state, render lifecycle badges, truncate long names with
      accessible tooltip, and handle selection callbacks.
- [x] T015a [US2] Ensure sidebar overflow behavior keeps the header and main
      landmarks fixed by updating
      `/apps/web/src/components/dashboard/DashboardShell.tsx` styles consistent
      with Edge Case requirements in `spec.md:94-99`.
- [x] T016 [US2] Wire `/apps/web/src/pages/Dashboard.tsx` to set the active
      project before navigating to the project workspace.
- [x] T016a [US2] Update `/apps/web/src/hooks/use-projects-query.ts` (and store
      listeners if needed) so signing out and back in forces a refetch of the
      projects data to satisfy `spec.md:101`.
- [x] T017 [US2] Ensure the shell toggle state resets appropriately on
      navigation return within
      `/apps/web/src/components/dashboard/DashboardShell.tsx`.

**Checkpoint**: User Stories 1 and 2 both independently functional.

---

## Phase 5: User Story 3 – Recover from Empty or Error States (Priority: P3)

**Goal**: Provide actionable empty, loading, and error states in the sidebar,
including a CTA that opens the existing new project dialog.

**Independent Test**: Force empty and failing project queries and verify sidebar
messaging, CTA behavior, and main dashboard availability.

### Tests for User Story 3 (write first)

- [x] T018 [US3] Add Vitest coverage for sidebar loading/empty/error messaging
      and CTA triggers in `/apps/web/src/pages/Dashboard.test.tsx`.
- [x] T018a [US3] Extend Vitest coverage so filtered zero-result scenarios show
      context-aware empty-state messaging and reset control in
      `/apps/web/src/pages/Dashboard.test.tsx` per `spec.md:99`.
- [x] T019 [P] [US3] Create Playwright scenario covering empty project state CTA
      flow in `/apps/web/tests/e2e/dashboard/project-empty-state.e2e.ts`.

### Implementation for User Story 3

- [x] T020 [US3] Implement loading spinner, empty-state copy, and error
      messaging in `/apps/web/src/components/sidebar/ProjectsNav.tsx`.
- [x] T020a [US3] Add filter-aware empty-state messaging and reset handler in
      `/apps/web/src/components/sidebar/ProjectsNav.tsx` aligned with Edge Case
      guidance in `spec.md:99`.
- [x] T021 [US3] Connect the sidebar CTA to `CreateProjectDialog` activation
      within `/apps/web/src/pages/Dashboard.tsx`.
- [x] T022 [US3] Add retry handling for project fetch failures inside
      `/apps/web/src/components/sidebar/ProjectsNav.tsx`.
- [x] T023 [US3] Verify toast visibility and focus restoration after error
      states in `/apps/web/src/pages/Dashboard.tsx`.

**Checkpoint**: All three user stories meet acceptance criteria independently.

---

## Phase 6: Polish & Cross-Cutting

**Purpose**: Finalize documentation, sanity checks, and regression validation.

- [x] T024 Update usage guidance in
      `/specs/001-upgrade-dashboard-view/quickstart.md` to reflect new shell
      workflows.
- [x] T025 Record shell-specific notes in
      `/specs/001-upgrade-dashboard-view/research.md` for future reference.
- [x] T026 Run full gauntlet (`pnpm lint`, `pnpm typecheck`, `pnpm test`,
      `pnpm --filter @ctrl-freaq/web test:e2e`) as listed in `/package.json`
      before handoff.
- [x] T026a Capture SC-002 timing by running the Playwright navigation scenario
      with `performance.mark` instrumentation and recording outcomes in
      `research.md` prior to sign-off.

---

## Phase 4.R: Review Follow-Up

- [x] F001 Finding F001: Restore Story 2.2 palette tokens in
      `apps/web/src/index.css`, replace dashboard shell/sidebar `text-gray-*`
      utilities with spec-driven classes, and confirm updates in
      `specs/001-upgrade-dashboard-view/audit.md`.
- [x] F002 Finding F002: Shell palette still uses legacy tokens and lacks
      gradients as described in `audit.md`.
- [x] F003 Finding F003: Product mark and project glyphs missing from shell as
      described in `audit.md`.
- [x] F004 Finding F004: Desktop sidebar collapse parity not implemented as
      described in `audit.md`.
- [x] F005 Finding F005: Status badges still use hard-coded Tailwind colors as
      described in `audit.md`.
- [x] F006 Finding F006: Account footer tile missing from sidebar as described
      in `audit.md`.
- [x] F007 Finding F007: Header wrapper capped at max-w-7xl leaves wide viewport
      gutters as described in `audit.md`.
- [x] F008 Finding F008: Sidebar omits Dashboard navigation entry as described
      in `audit.md`.
- [x] F009 Finding F009: Project glyph fallback uses initials, not the shared
      folder icon as described in `audit.md`.
- [x] F010 Finding F010: Dashboard entry is nested inside the Projects group as
      described in `audit.md`.
- [x] F011 Finding F011: Status badges clip inside sidebar rows as described in
      `audit.md`.
- [x] F012 Finding F012: Sidebar row spacing/glyph size overshoots Story 2.2
      compact spec as described in `audit.md`.
- [x] F013 Finding F013: Lifecycle badges ignore Story 2.2 color tokens as
      described in `audit.md`.
- [x] F014 Finding F014: Sidebar empty-state CTA does not use the Primary token
      as described in `audit.md`.

---

## Dependencies & Execution Order

- **Phase 1 → Phase 2 → Phase 3 → Phase 4 → Phase 5 → Phase 6**
- User Story 2 depends on User Story 1 shell scaffolding but remains
  independently testable afterward.
- User Story 3 depends on sidebar structure from User Story 2 to layer
  empty/error behaviors.

### Story Dependency Graph

```
Setup → Foundational → US1 → US2 → US3 → Polish
```

---

## Parallel Execution Opportunities

- T006, T013, and T019 are Playwright scenarios in distinct files and can be
  authored in parallel with unit test tasks.
- Within User Story 1, T007 (new component) may start while T005 test
  scaffolding is in progress because they touch different files.
- After Foundational completion, different engineers can own US2 and US3
  sequentially if capacity allows, but ensure User Story 1 code merges first to
  avoid rebase churn.

---

## Implementation Strategy

### MVP First (User Story 1)

1. Complete Phase 1 and Phase 2.
2. Implement Phase 3 (User Story 1) and run associated tests.
3. Demo persistent shell before continuing.

### Incremental Delivery

1. Ship MVP (US1).
2. Layer US2 sidebar navigation improvements.
3. Add US3 empty/error resilience.
4. Finish with polish tasks and gauntlet run.

### Team Parallelization

- Developer A: Focus on US1 shell layout.
- Developer B: Begin US2 sidebar enhancements once US1 merges.
- Developer C: Pick up US3 empty/error scenarios after US2 foundation is in
  place.

---

## Assumption Log

- Assumption: Existing Playwright fixtures already seed multiple projects.
  Rationale: Plan.md indicates reuse of current fixtures; adjust if tests reveal
  gaps.
- Assumption: No backend/API changes needed since contract remains
  `GET /api/projects`. Rationale: Specification confines work to frontend shell
  and data already available.

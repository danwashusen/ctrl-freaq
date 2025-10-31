# Tasks: Dashboard Shell Alignment

**Input**: Design documents from `/specs/001-upgrade-dashboard-view/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: Vitest (unit) and Playwright (fixture) tests are required per plan.md
and constitutional TDD mandate.

**Organization**: Tasks are grouped by user story to enable independent
implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)
- Include exact repository-root anchored file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Confirm local workspace is ready for UI refactor work.

- [ ] T001 Verify dependency graph is current by running `pnpm install`
      referenced from `/package.json`.
- [ ] T002 Execute baseline quality gates (`pnpm lint`, `pnpm typecheck`,
      `pnpm test`) using commands defined in `/package.json` to ensure a green
      starting point.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared groundwork required before any user story work begins.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [ ] T003 Capture current dashboard layout notes and spacing tokens directly in
      `/apps/web/src/pages/Dashboard.tsx` comments to guide shell refactor.
- [ ] T004 Refresh Playwright fixture context for dashboard flows by auditing
      `/apps/web/tests/e2e/dashboard/fixtures` data usage so upcoming scenarios
      share consistent seeds.

**Checkpoint**: Foundation ready — user story implementation can begin.

---

## Phase 3: User Story 1 – Stay Oriented in the Dashboard Shell (Priority: P1) 🎯 MVP

**Goal**: Deliver a persistent header + sidebar shell that frames the dashboard
content with accessible landmarks and responsive behavior.

**Independent Test**: Load `/dashboard` while authenticated and confirm header
content, subtitle visibility on desktop, and mobile sidebar toggle with focus
management.

### Tests for User Story 1 (write first)

- [ ] T005 [US1] Add Vitest coverage for header landmarks, subtitle visibility,
      and preservation of metrics cards and filter controls in
      `/apps/web/src/pages/Dashboard.test.tsx`.
- [ ] T006 [P] [US1] Author Playwright scenario validating header, mobile
      sidebar toggle, and visibility of metrics cards and filters in
      `/apps/web/tests/e2e/dashboard/dashboard-shell.e2e.ts`.

### Implementation for User Story 1

- [ ] T007 [US1] Create layout wrapper component
      `/apps/web/src/components/dashboard/DashboardShell.tsx` encapsulating
      header, sidebar slot, and main region.
- [ ] T008 [US1] Refactor `/apps/web/src/pages/Dashboard.tsx` to render content
      inside `DashboardShell` while preserving dialogs and toast providers.
- [ ] T009 [US1] Implement responsive header controls (settings, account menu,
      subtitle breakpoints) within `/apps/web/src/pages/Dashboard.tsx`.
- [ ] T010 [US1] Add focus management and landmark attributes inside
      `/apps/web/src/components/dashboard/DashboardShell.tsx` for mobile overlay
      accessibility.
- [ ] T011 [US1] Align global spacing and background tokens in
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

- [ ] T012 [US2] Extend Vitest coverage for sidebar project ordering, active
      highlight, and long-name truncation tooltip in
      `/apps/web/src/pages/Dashboard.test.tsx`.
- [ ] T013 [P] [US2] Add Playwright scenario validating sidebar navigation and
      highlight persistence in
      `/apps/web/tests/e2e/dashboard/project-sidebar-navigation.e2e.ts`.

### Implementation for User Story 2

- [ ] T014 [US2] Extend `/apps/web/src/stores/project-store.ts` to manage
      sidebar open state, capture `lastFocusedTrigger`, and persist active
      project across routes.
- [ ] T015 [US2] Update `/apps/web/src/components/sidebar/ProjectsNav.tsx` to
      consume store state, render lifecycle badges, truncate long names with
      accessible tooltip, and handle selection callbacks.
- [ ] T016 [US2] Wire `/apps/web/src/pages/Dashboard.tsx` to set the active
      project before navigating to the project workspace.
- [ ] T017 [US2] Ensure the shell toggle state resets appropriately on
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

- [ ] T018 [US3] Add Vitest coverage for sidebar loading/empty/error messaging
      and CTA triggers in `/apps/web/src/pages/Dashboard.test.tsx`.
- [ ] T019 [P] [US3] Create Playwright scenario covering empty project state CTA
      flow in `/apps/web/tests/e2e/dashboard/project-empty-state.e2e.ts`.

### Implementation for User Story 3

- [ ] T020 [US3] Implement loading spinner, empty-state copy, and error
      messaging in `/apps/web/src/components/sidebar/ProjectsNav.tsx`.
- [ ] T021 [US3] Connect the sidebar CTA to `CreateProjectDialog` activation
      within `/apps/web/src/pages/Dashboard.tsx`.
- [ ] T022 [US3] Add retry handling for project fetch failures inside
      `/apps/web/src/components/sidebar/ProjectsNav.tsx`.
- [ ] T023 [US3] Verify toast visibility and focus restoration after error
      states in `/apps/web/src/pages/Dashboard.tsx`.

**Checkpoint**: All three user stories meet acceptance criteria independently.

---

## Phase 6: Polish & Cross-Cutting

**Purpose**: Finalize documentation, sanity checks, and regression validation.

- [ ] T024 Update usage guidance in
      `/specs/001-upgrade-dashboard-view/quickstart.md` to reflect new shell
      workflows.
- [ ] T025 Record shell-specific notes in
      `/specs/001-upgrade-dashboard-view/research.md` for future reference.
- [ ] T026 Run full gauntlet (`pnpm lint`, `pnpm typecheck`, `pnpm test`,
      `pnpm --filter @ctrl-freaq/web test:e2e`) as listed in `/package.json`
      before handoff.

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

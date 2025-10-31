# Implementation Plan: Dashboard Shell Alignment

**Branch**: `001-upgrade-dashboard-view` | **Date**: 2025-11-01 | **Spec**:
[Dashboard Shell Alignment](./spec.md)  
**Input**: Feature specification from
`/specs/001-upgrade-dashboard-view/spec.md`

## Summary

Implement a persistent application shell around the CTRL FreaQ dashboard so the
header, sidebar, and main content align with the mock’s visual hierarchy while
continuing to use production project data and existing flows. Work concentrates
on restructuring the React layout in `apps/web`, refining sidebar interactions
(project selection, empty/error states), and adjusting spacing/typography to
maintain accessibility, responsiveness, and telemetry hooks without altering
backend contracts.

## Technical Context

<!--
  ACTION REQUIRED: Replace the content in this section with the technical details
  for the project. The structure here is presented in advisory capacity to guide
  the iteration process.
-->

**Language/Version**: TypeScript (React 19, JSX)  
**Primary Dependencies**: Vite toolchain, TanStack Query, Zustand, Tailwind CSS,
shadcn/ui, React Router  
**Storage**: N/A (client-side state only; server data via existing API)  
**Testing**: Vitest + React Testing Library, Playwright fixture suites  
**Target Platform**: Responsive web (desktop and mobile browsers) **Project
Type**: Web application (apps/web) within pnpm monorepo  
**Performance Goals**: Sidebar project selection opens project workspace within
2 seconds (SC-002); perceived header/sidebar load without layout jank  
**Performance Measurement**: Instrument Playwright flow and client
`performance.mark` calls in the dashboard shell to record
selection-to-navigation timing; log results during Polish phase before
sign-off.  
**Constraints**: Maintain accessible landmarks, focus management, and consistent
spacing without regressing existing dashboard functionality  
**Scale/Scope**: Single dashboard view for authenticated users; sidebar handles
up to 20 projects per current query limit

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

- **Library-First Architecture (Constitution §I)** – No new shared libraries
  required; updates confined to existing app components and respect package
  boundaries. **Status: PASS**
- **CLI Interface Standard (Constitution §II)** – No changes to backend
  libraries or CLIs; shell enhancements remain client-side. **Status: PASS**
- **Test-First Development (Constitution §III)** – Plan mandates writing Vitest
  and Playwright coverage for header/sidebar behaviors before implementation,
  with gauntlet commands (`pnpm lint`, `pnpm typecheck`, `pnpm test`) run prior
  to merge. **Status: PASS**
- **Integration Testing & Observability (Constitution §IV)** – Existing
  telemetry and navigation metrics remain intact; any new metrics will follow
  structured logging conventions if introduced. **Status: PASS**
- **Simplicity & Versioning (Constitution §V)** – Layout refactor avoids
  unnecessary abstractions, reuses existing components, and documents any
  spacing token updates. **Status: PASS**

## Project Structure

### Documentation (this feature)

```text
specs/[###-feature]/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
apps/
└── web/
    ├── src/pages/Dashboard.tsx
    ├── src/pages/Dashboard.test.tsx
    ├── src/components/sidebar/ProjectsNav.tsx
    ├── src/components/projects/CreateProjectDialog.tsx
    ├── src/components/projects/ArchiveProjectDialog.tsx
    ├── src/hooks/use-projects-query.ts
    ├── src/stores/project-store.ts
    ├── src/lib/api.ts
    └── tests/e2e/dashboard/*.e2e.ts

docs/
└── examples/ctrl-freaq-ui/ (mock shell reference)
```

**Structure Decision**: All work resides in `apps/web`, primarily within the
dashboard page and supporting sidebar/store modules. Mock assets in
`docs/examples/ctrl-freaq-ui/` remain a visual reference only—no direct imports
planned.

## Codebase Reconnaissance

<!--
  ACTION REQUIRED: Summarize exhaustive findings from Phase 0 reconnaissance.
  Use Story IDs from spec.md (US1, US2, ...) and Decision IDs (D001, D002, ...)
  to keep entries aligned with research.md. Add subsections per story when
  helpful (e.g., ### US1 – Story name).
-->

| Story/Decision | File/Directory                                             | Role Today                                                      | Helpers/Configs                                   | Risks & Follow-up                                                                                                                        | Verification Hooks                                                                                  |
| -------------- | ---------------------------------------------------------- | --------------------------------------------------------------- | ------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| US1 / D001     | /apps/web/src/pages/Dashboard.tsx                          | Top-level dashboard layout, header markup, cards, dialog mounts | `useUser`, `useProjectsQuery`, telemetry emitters | Layout refactor must preserve toast timing, scroll restoration, metrics grid, filters, and dialogs                                       | `/apps/web/src/pages/Dashboard.test.tsx`; `/apps/web/tests/e2e/dashboard/project-navigation.e2e.ts` |
| US1 / D004     | /apps/web/src/App.tsx                                      | Hosts router and global wrappers, sets page background          | React Router, `SimpleAuthWarningBanner`           | Shell layout must coexist with existing root background and warning banner                                                               | `/apps/web/tests/e2e/dashboard/project-navigation.e2e.ts` smoke                                     |
| US2 / D002     | /apps/web/src/components/sidebar/ProjectsNav.tsx           | Renders project list, status badges, active highlight           | `useProjectStore`, Tailwind tokens                | Needs loading/error/empty states without losing badge styling                                                                            | `/apps/web/src/pages/Dashboard.test.tsx`; `/apps/web/tests/e2e/dashboard/project-navigation.e2e.ts` |
| US2 / D002     | /apps/web/src/stores/project-store.ts                      | Maintains `activeProjectId`, `sidebarOpen`, `viewMode`          | Zustand store                                     | Reusing `sidebarOpen` must not break existing defaults; ensure SSR safety and capture `lastFocusedTrigger` for accessible overlay return | `/apps/web/src/stores/project-store.test.ts`                                                        |
| US2 / D003     | /apps/web/src/hooks/use-projects-query.ts                  | Provides TanStack Query wrapper with params, optimistic updates | Query key constants, telemetry emitters           | Sidebar must reuse same data to avoid double-fetch / stale states                                                                        | `/apps/web/src/pages/Dashboard.test.tsx`; `/apps/web/tests/e2e/dashboard/project-archive.e2e.ts`    |
| US3 / D003     | /apps/web/src/components/projects/CreateProjectDialog.tsx  | Modal for new project CTA                                       | TanStack `useMutation`, form validation           | Sidebar CTA must focus dialog trigger flows; respect pending state                                                                       | `/apps/web/tests/e2e/dashboard/project-create.e2e.ts`                                               |
| US3 / D004     | /apps/web/src/components/projects/ArchiveProjectDialog.tsx | Archive confirmation                                            | Query invalidation, toast messaging               | Shell changes cannot hide dialog trigger or degrade focus order                                                                          | `/apps/web/tests/e2e/dashboard/project-archive.e2e.ts`                                              |
| Reference      | /docs/examples/ctrl-freaq-ui/src/components/ui/sidebar.tsx | Mock shell implementation                                       | Shadcn primitives, custom cookies                 | Treated as guidance—not imported wholesale; use to benchmark spacing and toggle patterns                                                 | Manual comparison (mock server)                                                                     |

## Complexity Tracking

No constitutional exceptions are anticipated for this feature. If future scope
introduces a violation, document it here with rationale before proceeding.

## Phase 0: Outline & Research

- Audit the current dashboard shell implementation in
  `/apps/web/src/pages/Dashboard.tsx`, `ProjectsNav.tsx`, and related tests to
  confirm assumptions recorded in `spec.md`.
- Capture spacing tokens, accessibility dependencies, and telemetry hooks in
  `research.md`, citing `docs/front-end-spec.md#spacing-layout` and any mobile
  focus behaviour that must be preserved.
- Log unresolved questions (if any) directly in `research.md`; otherwise record
  that no additional research is required beyond the existing artifacts.

**Output**: `research.md` updated with shell layout notes and open questions (if
applicable).

## Phase 1: Design Alignment

_Prerequisites: Phase 0 complete_

1. Reconcile the `Project Summary` and `Dashboard Shell` entities in
   `data-model.md` with the existing `/api/projects` response fields, noting any
   UI-only properties.
2. Document the intended shell interaction flow (desktop vs. mobile,
   navigation/focus handling) in `quickstart.md` so implementers have step-by-step
   guidance.
3. Confirm that the current `/api/projects` contract remains sufficient; if no
   changes are needed, annotate the contracts directory with a short note rather
   than generating new schemas.
4. Update agent context files only if new tools or patterns are introduced by
   this feature.

**Output**: `data-model.md`, `quickstart.md`, and contracts notes reflecting the
validated design assumptions; agent context updated only when new information is
introduced.

## Agent Context Update

No new tools or frameworks are introduced beyond the existing
React/Tailwind/TanStack stack; agent context files remain current.

## Phase 2: Task Planning Approach

_This section describes what the `/speckit.tasks` command will do - DO NOT
execute during `/speckit.plan`_

**Task Generation Strategy**:

- Load `.specify/templates/tasks-template.md` as base
- Generate tasks from Phase 1 design docs (contracts, data model, quickstart)
- Organize tasks by user story priority (P1, P2, P3...)
- Each user story → complete set of tests (if requested), models, services,
  endpoints, and integration work
- Shared setup and foundational tasks appear before user stories; polish tasks
  appear last
- Use `[P]` markers for parallel-safe tasks (different files)

**Outputs expected from `/speckit.tasks`**:

- `tasks.md` with phases for setup, foundational work, each user story, and
  polish
- MVP recommendation and dependency graph between user stories
- Parallel execution guidance and implementation strategy summary

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

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation                  | Why Needed         | Simpler Alternative Rejected Because |
| -------------------------- | ------------------ | ------------------------------------ |
| [e.g., 4th project]        | [current need]     | [why 3 projects insufficient]        |
| [e.g., Repository pattern] | [specific problem] | [why direct DB access insufficient]  |

## Phase 0: Outline & Research

1. **Extract unknowns from Technical Context** above:
   - For each NEEDS CLARIFICATION → research task
   - For each dependency → best practices task
   - For each integration → patterns task

2. **Generate and dispatch research agents**:

   ```
   For each unknown in Technical Context:
     Task: "Research {unknown} for {feature context}"
   For each technology choice:
     Task: "Find best practices for {tech} in {domain}"
   ```

3. **Consolidate findings** in `research.md` using format:
   - Decision: [what was chosen]
   - Rationale: [why chosen]
   - Alternatives considered: [what else evaluated]

**Output**: research.md with all NEEDS CLARIFICATION resolved

## Phase 1: Design & Contracts

_Prerequisites: research.md complete_

1. **Extract entities from feature spec** → `data-model.md`:
   - Entity name, fields, relationships
   - Validation rules from requirements
   - State transitions if applicable

2. **Generate API contracts** from functional requirements:
   - For each user action → endpoint
   - Use standard REST/GraphQL patterns
   - Output schema to `/contracts/`

3. **Update agent context**:
   - Run the agent-specific context script to record new technologies introduced
     in this plan
   - Append only new information; preserve existing manual notes

4. **Extract test scenarios** from user stories:
   - Each story → integration test scenario
   - Quickstart test = story validation steps

**Output**: data-model.md, /contracts/\*, quickstart.md, updated agent context
file

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

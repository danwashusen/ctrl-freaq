# Research & Recon: Dashboard Shell Alignment

## Decisions

### D001 – Dashboard Layout Strategy

- **Decision**: Introduce a dedicated `DashboardShell` layout that wraps the
  existing dashboard content with a CSS grid/flex structure placing the header
  across the top and sidebar along the left, while keeping the main pane
  scrollable.
- **Rationale**: Centralizing shell responsibilities simplifies responsiveness,
  ensures consistent spacing tokens, and prevents the page component from
  duplicating layout logic every time it re-renders.
- **Alternatives Considered**:
  - _Inline wrapper inside `Dashboard.tsx`_: Rejected because it would keep
    layout concerns intertwined with business logic and make future reuse
    harder.
  - _Reusing mock `SidebarProvider` pattern wholesale_: Rejected to avoid
    importing unused cookie/tooltip machinery and to respect the current
    component inventory.

### D002 – Sidebar State & Interaction Model

- **Decision**: Reuse `useProjectStore` for active project highlighting and
  extend it (or companion local state) to manage sidebar visibility across
  desktop and mobile, including overlay focus trapping.
- **Rationale**: Leveraging the existing Zustand store keeps project context
  synchronized between dashboard and project views without introducing another
  state source.
- **Alternatives Considered**:
  - _New React context for shell state_: Rejected to avoid duplicating store
    concerns and to stay aligned with Constitution §I (library-first reuse).
  - _Reliance on CSS-only breakpoint toggles_: Rejected because accessibility
    requirements demand explicit focus control when presenting mobile overlays.

### D003 – Data Hydration Approach

- **Decision**: Continue using `useProjectsQuery` with current pagination
  parameters and placeholder logic, feeding the sidebar and main cards from the
  same response while preserving sessionStorage-backed view state.
- **Rationale**: The hook already encapsulates telemetry, cache keys, and
  optimistic updates; reusing it prevents divergence and keeps archive/create
  flows intact.
- **Alternatives Considered**:
  - _Separate lightweight query for sidebar_: Rejected to avoid duplicate
    network calls and to maintain a single source of truth for project listings.

### D004 – Accessibility & Focus Handling

- **Decision**: Add semantic landmarks (`header`, `nav`, `main`) and manage
  mobile sidebar focus by shifting focus to the first interactive element when
  opened, restoring it to the toggle when closed.
- **Rationale**: Aligns with Success Criteria and Constitution §IV mandates on
  observability and user experience while meeting WCAG expectations for overlay
  navigation.
- **Alternatives Considered**:
  - _Rely on browser default focus order_: Rejected because overlays without
    focus management cause screen-reader traps.

### D005 – Sidebar Empty & Error Messaging

- **Decision**: Extend `ProjectsNav` to render explicit loading, empty, and
  error states with accessible affordances. Empty states now expose a
  `Start a project` CTA that opens the existing creation dialog, while
  filter-driven empties add a secondary `Reset filters` control. Errors surface
  inline retry handling without hiding previously loaded projects.
- **Rationale**: Surfacing contextual messaging in the sidebar prevents user
  dead-ends, aligns with FR-005/FR-006 requirements, and keeps the shell
  resilient during network turbulence while preserving focus for screen-reader
  users.
- **Alternatives Considered**:
  - _Leave messaging to main-content cards_: Rejected; the shell must be
    self-contained per US3 acceptance criteria.
  - _Use toasts only for failures_: Rejected because transient toasts can be
    missed and do not provide persistent guidance.

## Codebase Reconnaissance

### US1 – Stay Oriented in the Dashboard Shell

| Story/Decision | Path                              | Current Responsibility                                                                                             | Helpers/Configs                                                     | Risks & Notes                                                                                              | Verification Hooks                                                                                                                                         |
| -------------- | --------------------------------- | ------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| US1 / D001     | /apps/web/src/pages/Dashboard.tsx | Renders entire dashboard including header, metrics grid, project cards, dialogs                                    | `useUser`, `useProjectsQuery`, `Button`, `Card`, telemetry emitters | High churn file; layout changes must preserve existing dialog mounts, toasts, and scroll restoration logic | `/apps/web/src/pages/Dashboard.test.tsx`, `/apps/web/tests/e2e/dashboard/project-navigation.e2e.ts`, `/apps/web/tests/e2e/dashboard/project-create.e2e.ts` |
| US1 / D004     | /apps/web/src/App.tsx             | Configures router and global wrappers (`ApiProvider`, auth gating, `<div className="bg-background min-h-screen">`) | React Router config, `SimpleAuthWarningBanner`                      | Any shell-level changes must coexist with app-wide background wrapper                                      | Smoke via `/apps/web/tests/e2e/dashboard/project-navigation.e2e.ts`                                                                                        |
| US1 / D001     | /apps/web/src/index.css           | Global typography and base layout tokens                                                                           | Tailwind layers, CSS variables                                      | Verify new layout classes align with existing root background/padding expectations                         | Visual diff via Playwright visual tests when updated                                                                                                       |

### US2 – Navigate Projects from the Sidebar

| Story/Decision | Path                                             | Current Responsibility                                                                       | Helpers/Configs                                            | Risks & Notes                                                                             | Verification Hooks                                                                                                       |
| -------------- | ------------------------------------------------ | -------------------------------------------------------------------------------------------- | ---------------------------------------------------------- | ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| US2 / D002     | /apps/web/src/components/sidebar/ProjectsNav.tsx | Displays alphabetical project list with status badges and handles active selection via store | `useProjectStore`, status badge class map                  | Must extend to surface loading/empty/error states without breaking existing badge styling | `/apps/web/src/pages/Dashboard.test.tsx` (sidebar assertions), `/apps/web/tests/e2e/dashboard/project-navigation.e2e.ts` |
| US2 / D002     | /apps/web/src/stores/project-store.ts            | Zustand store tracking `activeProjectId`, `sidebarOpen`, view mode                           | Zustand, persisted defaults                                | `sidebarOpen` currently unused; verify semantics before reuse; ensure SSR safety          | `/apps/web/src/stores/project-store.test.ts`                                                                             |
| US2 / D003     | /apps/web/src/hooks/use-projects-query.ts        | Encapsulates TanStack Query fetching and parameters                                          | `PROJECTS_QUERY_KEY`, telemetry, placeholder data handling | Changing query usage risks breaking optimistic updates for archive/create flows           | `/apps/web/src/pages/Dashboard.test.tsx`, `/apps/web/tests/e2e/dashboard/project-archive.e2e.ts`                         |

### US3 – Recover from Empty or Error States

| Story/Decision | Path                                                       | Current Responsibility                                            | Helpers/Configs                                         | Risks & Notes                                                                                        | Verification Hooks                                                                              |
| -------------- | ---------------------------------------------------------- | ----------------------------------------------------------------- | ------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| US3 / D003     | /apps/web/src/pages/Dashboard.tsx                          | Handles empty/error messaging, create dialog CTA, toast lifecycle | Session storage view-state helpers, toast state machine | Ensure new shell keeps toasts accessible and empty states visible without pushing CTA below the fold | `/apps/web/src/pages/Dashboard.test.tsx`, `/apps/web/tests/e2e/dashboard/project-create.e2e.ts` |
| US3 / D002     | /apps/web/src/components/projects/CreateProjectDialog.tsx  | Modal for new project creation                                    | `useMutation` integration, form validation              | CTA from sidebar must trigger same dialog; ensure focus moves into dialog for accessibility          | `/apps/web/tests/e2e/dashboard/project-create.e2e.ts`                                           |
| US3 / D004     | /apps/web/src/components/projects/ArchiveProjectDialog.tsx | Confirmation dialog for archive flows                             | Query invalidation, toast messaging                     | Maintain access via action menus post layout changes                                                 | `/apps/web/tests/e2e/dashboard/project-archive.e2e.ts`                                          |

**Open Questions**: None — all Technical Context fields resolved without NEEDS
CLARIFICATION.

## Success Criteria Evidence

- **SC-002**: Playwright `project-sidebar-navigation.e2e.ts` instrumentation
  recorded a sidebar selection-to-navigation duration of **81.4 ms**
  (`performance.measure('sidebar-navigation')`), comfortably within the 2,000 ms
  target.

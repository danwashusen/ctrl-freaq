# Data Model: Dashboard Shell Alignment

## Entity: ProjectSummary (Source of Truth: `/apps/web/src/lib/api.ts`, `ProjectsListResponse`)

- **Fields**
  - `id`: string (UUID)
  - `name`: string (1–120 chars, trimmed)
  - `status`: enum {`draft`, `active`, `paused`, `completed`, `archived`}
  - `visibility`: enum {`private`, `workspace`}
  - `description`: string \| null
  - `goalTargetDate`: ISO date string \| null
  - `updatedAt`: ISO timestamp
  - `archivedStatusBefore`: enum excluding `archived` \| null
- **Responsibilities**
  - Drives project listings in both sidebar and main cards.
  - Supplies badge label (`status`) and supporting metadata (goal, visibility).
- **Validation Rules**
  - Name must be non-empty after trimming (existing create/update dialogs
    enforce).
  - Status badge must map to known palette to avoid unstyled state.
  - Archived projects require `archivedStatusBefore` to surface restore
    messaging.
- **State Transitions**
  - Status changes occur via archive/restore flows; sidebar must react to
    TanStack Query cache updates without manual refresh.
- **Relationships**
  - One-to-many with `DashboardShellState.sidebar.projects`.
  - Shared with dashboard card grid (must remain consistent).

## Entity: DashboardViewState (Persisted via `sessionStorage`)

- **Fields**
  - `search`: string (user-entered filter)
  - `includeArchived`: boolean
  - `scrollY`: number (last main-pane scroll position)
- **Responsibilities**
  - Restores filters, archived toggle, and scroll position after navigation.
  - Used to seed query params and main pane layout on page load.
- **Validation Rules**
  - `search` trimmed before persistence to avoid whitespace-only values.
  - `scrollY` clamped to ≥0.
- **State Transitions**
  - Updated through form submission, toggle interaction, or navigation away from
    dashboard.
  - Reset to defaults when user clears search or logs out.
- **Relationships**
  - Provides defaults for `useProjectsQuery` parameters.
  - Informs header/sub-header copy (search cleared message).

## Entity: DashboardShellState (In-memory via `useProjectStore`)

- **Fields**
  - `sidebarOpen`: boolean (desktop collapse state; mobile overlay derived)
  - `activeProjectId`: string \| null
  - `viewMode`: enum {`list`, `grid`} (future-proofing; currently list)
  - `lastFocusedTrigger`: `HTMLElement` reference (transient, for accessibility)
- **Responsibilities**
  - Controls whether sidebar is visible at given breakpoint.
  - Tracks which project is highlighted across sidebar and project detail route.
  - Stores `lastFocusedTrigger` so focus can return to the correct control when
    the mobile overlay closes.
- **Validation Rules**
  - `activeProjectId` must be either null or correspond to existing
    ProjectSummary.
  - `sidebarOpen` defaults to true on desktop; mobile overlay forces closed
    state when dismissed.
- **State Transitions**
  - Toggled by header control or keyboard shortcut (future).
  - Updated when user navigates into project or returns to dashboard.
- **Relationships**
  - Consumed by `ProjectsNav` (highlight) and new shell wrapper (render logic).
  - Syncs with React Router navigation so that project detail view can reference
    selected project.

## Entity: HeaderContext

- **Fields**
  - `productTitle`: static string ("CTRL FreaQ")
  - `productDescriptor`: static string ("AI-Optimized Documentation System")
  - `actions`: array of header actions (currently settings button, user menu)
  - `subtitleVisibility`: breakpoint map controlling tagline visibility
- **Responsibilities**
  - Ensures consistent header copy and action placement across viewports.
  - Provides metadata for future additions (notifications, help).
- **Validation Rules**
  - Subtitle hidden only at breakpoints where space is constrained (<`sm`).
  - Actions require accessible labels and icons.
- **State Transitions**
  - Static content; may expand as new actions introduced.
- **Relationships**
  - Header wrapper injects actions into shell; settings button uses React Router
    navigate to `/settings`.

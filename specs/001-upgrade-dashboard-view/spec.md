# Feature Specification: Dashboard Shell Alignment

**Feature Branch**: `001-upgrade-dashboard-view`  
**Created**: 2025-11-01  
**Status**: Draft  
**Input**: User description: "upgrade the dashboard view based on this
discussion"

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Stay Oriented in the Dashboard Shell (Priority: P1)

When an authenticated contributor lands on the dashboard, they see the header
and navigation shell that reflects CTRL FreaQ's product identity and gives clear
access to workspace controls.

**Why this priority**: Without a persistent shell, returning users cannot
reliably reach settings or understand where they are in the app; this touchpoint
sets the tone for future shell-parity work.

**Independent Test**: Start from a signed-in state and load `/dashboard`;
confirm the header, subtitle (desktop), settings entry point, and account menu
are visible and screen-reader landmarks correctly frame the page.

**Acceptance Scenarios**:

1. **Given** an authenticated user on a desktop viewport, **When** they open the
   dashboard, **Then** the header displays the product name, tagline, settings
   access, and account menu while the main content remains reachable via the
   `main` landmark.
2. **Given** the same user on a narrow viewport, **When** they activate the
   shell toggle, **Then** the sidebar opens as an overlay, focus moves into it,
   and dismissing the overlay returns focus to the toggle.

---

### User Story 2 - Navigate Projects from the Sidebar (Priority: P2)

A dashboard user needs to browse their project list and jump to a project
workspace without losing their place.

**Why this priority**: Access to live project data through the sidebar is the
core value of the shell update and connects the dashboard with existing project
detail flows.

**Independent Test**: With multiple projects returned by the existing projects
query, verify the sidebar lists them alphabetically with lifecycle badges;
selecting a project highlights it and transfers the user to the project detail
page.

**Acceptance Scenarios**:

1. **Given** at least three active projects returned by the server, **When** the
   user clicks a project name in the sidebar, **Then** that project becomes
   highlighted and the project detail view opens with the corresponding data.
2. **Given** the same list, **When** the dashboard is reloaded, **Then** the
   sidebar again reflects the current projects from the server and the currently
   active project is emphasized.

---

### User Story 3 - Recover from Empty or Error States (Priority: P3)

If the project list is empty or fails to load, the user still needs clear
guidance on the next step.

**Why this priority**: The shell cannot strand users; it must guide new work and
help recover from transient issues.

**Independent Test**: Simulate empty and error responses from the projects
query; confirm the sidebar presents the empty-state guidance and the main area
retains dashboard controls.

**Acceptance Scenarios**:

1. **Given** the project API returns zero items, **When** the dashboard loads,
   **Then** the sidebar shows “No projects yet” messaging plus a primary action
   that opens the existing new project dialog.
2. **Given** the project request fails, **When** the dashboard loads, **Then**
   the sidebar surfaces an inline error with retry guidance while the rest of
   the dashboard remains accessible.

---

### Edge Cases

- When the project list contains more entries than fit on screen, the sidebar
  provides scrolling without hiding the header or main content.
- When project names exceed the available width, the list truncates them via CSS
  (`text-overflow: ellipsis`) and exposes an accessible tooltip so full titles
  remain discoverable without shifting layout.
- When filters (search or include archived) hide all projects, the empty-state
  reflects the filter context and offers a clear reset path.
- When the user signs out and back in quickly, the shell rehydrates with fresh
  project data rather than cached stale entries.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: The dashboard page MUST render within a persistent application
  shell that combines a global header, left-aligned navigation sidebar, and main
  content area, maintaining visual parity with the mock while relying on real
  data.
- **FR-002**: The header MUST communicate product identity (name and short
  descriptor), expose global actions (settings, account menu), and adapt
  responsively so critical actions remain visible on narrow viewports.
- **FR-003**: The sidebar MUST display the current project list supplied by the
  projects query, sorted alphabetically, include lifecycle badges, and highlight
  the active project selection.
- **FR-004**: Selecting a project in the sidebar MUST update the active project
  context and route the user to the corresponding project workspace using the
  existing project detail entrypoint, preserving dashboard scroll state for
  return navigation.
- **FR-005**: The sidebar MUST show a loading indicator while the projects query
  is in flight, and present an inline error with retry guidance if the request
  fails.
- **FR-006**: When the projects query returns zero results (initial state or
  filtered), the sidebar MUST present an empty-state message plus a clear call
  to start a new project via the existing creation dialog.
- **FR-007**: The main dashboard content MUST retain its current metrics grid,
  filter controls, and project cards while spacing, typography, and
  responsiveness are harmonized with the new shell so no information becomes
  obscured, repositioned, or duplicated.
- **FR-008**: The shell MUST implement accessible landmarks (`header`, `nav`,
  `main`), keyboard focus management for the mobile navigation overlay, and
  retain screen-reader visibility of toasts and dialogs triggered from the
  dashboard.

### Key Entities

- **Project Summary**: Represents a single workspace surfaced in the sidebar;
  includes attributes such as identifier, display name, lifecycle status,
  visibility, updated timestamp, and goal target date. Receives data directly
  from the existing projects API response.
- **Dashboard Shell**: The structural layout wrapping the dashboard; composed of
  the header, sidebar (expanded or collapsed), and main content region, each
  with defined responsibilities for navigation, global actions, and
  dashboard-specific controls.

### Assumptions

- Existing project API endpoints and the current dashboard project data query
  remain authoritative sources for project metadata; no new data contract
  changes are required.
- The current “New Project” dialog and project detail route will be reused
  without functional changes, only repositioned within the shell.
- Design tokens, typography scale, and iconography from the active web app
  remain the visual system, with the mock guiding layout and spacing only.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: 95% of evaluated users correctly identify how to reach settings or
  account controls within 10 seconds of landing on the dashboard during
  moderated usability sessions.
- **SC-002**: At least 90% of project selections from the sidebar result in the
  corresponding project workspace opening within 2 seconds during controlled
  evaluation with representative data.
- **SC-003**: In scenarios with zero projects (new account or filtered view),
  100% of observed sessions present a clear call-to-action that opens the
  existing new project flow without requiring additional navigation.
- **SC-004**: Post-launch feedback surveys report that at least 80% of
  respondents find the updated dashboard layout clearer or equally clear
  compared to the prior experience.

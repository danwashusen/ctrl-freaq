# Feature Specification: Project Lifecycle Management

**Feature Branch**: `016-a-user-should-be-able`  
**Created**: 2025-10-25  
**Status**: Draft  
**Input**: User description: "A user should be able to create, retrieve, update
and detete projects. Projects should be listed on the dashboard."

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Create a new project from the dashboard (Priority: P1)

Authenticated workspace members start new initiatives directly from the
dashboard without leaving their workflow.

**Why this priority**: Teams cannot use the workspace without a way to seed new
projects, so this unlocks all other project-related actions.

**Independent Test**: Trigger the dashboard "create project" flow and confirm a
new project appears with required defaults and is visible on refresh.

**Acceptance Scenarios**:

1. **Given** an authenticated user on the dashboard with permission to manage
   projects, **When** they provide the mandatory project name (and any optional
   action, **Then** the system confirms creation and displays the project in the
   project list.
2. **Given** an authenticated user initiates project creation with missing or
   invalid required inputs, **When** they attempt to submit, **Then** the system
   blocks the submission and highlights the fields that must be corrected.

---

### User Story 2 - Review project summaries on the dashboard (Priority: P2)

Users need to see all projects they can access, along with key summary
information, from the dashboard.

**Why this priority**: Keeping projects front and center on the dashboard keeps
the workspace actionable and aligns with the product's document-first focus.

**Independent Test**: Populate multiple projects for a user, load the dashboard,
and verify summaries render in the expected order with accurate status data.

**Acceptance Scenarios**:

1. **Given** an authenticated user with several accessible projects, **When**
   they load or refresh the dashboard, **Then** the project list shows each
   active project with its name, status, and last-updated timestamp.

---

### User Story 3 - Update an existing project (Priority: P3)

Project owners refine project metadata so the dashboard stays accurate over
time.

**Why this priority**: Projects evolve, and stakeholders rely on current
information to make decisions.

**Independent Test**: Edit an existing project, save the changes, and ensure the
dashboard and project detail view show the updated values immediately.

**Acceptance Scenarios**:

1. **Given** an authenticated user with edit access opens a project, **When**
   they change editable fields and confirm the update, **Then** the new values
   persist and the dashboard reflects them without stale data.

---

### User Story 4 - Archive a project no longer in active use (Priority: P4)

Authorized users retire projects while preserving an audit trail.

**Why this priority**: Soft deletion keeps the dashboard uncluttered without
losing historical context demanded by governance requirements.

**Independent Test**: Mark a project as archived, confirm it disappears from
active dashboard views, and verify it remains discoverable through audit tools.

**Acceptance Scenarios**:

1. **Given** an authenticated user with archive permissions selects a project,
   **When** they confirm the archive action, **Then** the project is removed
   from the active dashboard list while its history remains retrievable via
   audit reporting.

---

### Edge Cases

- A user attempts to create a project with a duplicate name inside the same
  workspace; the system must explain the conflict and request a unique name.
- A project is archived while another user is viewing it; the viewer receives a
  notice that the project is no longer active and is guided back to the
  dashboard.
- The dashboard loads while project data fails to return; the system
  communicates the issue and offers a retry without clearing existing projects
  from view.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: The system must allow authenticated users with project-manage
  permission to create a project from the dashboard by providing at minimum a
  project name. Optional fields — short description (≤ 500 chars), visibility
  (defaults to `workspace` when omitted), goal summary, and goal target date —
  may be supplied to enrich the project metadata but must not block creation.
- **FR-002**: The system must validate project creation and update inputs with
  actionable error messages; validation rules include name ≤ 120 characters,
  short description ≤ 500 characters, goal summary ≤ 280 characters, and goal
  target date formatted as ISO-8601 and not earlier than today.
- **FR-003**: The system must record who created or updated a project and when,
  preserving an audit trail aligned with constitutional governance.
- **FR-004**: The dashboard must display all active projects the user can access
  with key summary fields (name, status, last updated) and refresh the list
  within 2 seconds of any create, update, archive, or restore confirmation
  (matching SC-002).
- **FR-005**: Users must be able to open a project from the dashboard to review
  its details without losing dashboard context, preserving filters, search, and
  scroll position when they return.
- **FR-006**: The system must allow authorized users to edit project metadata,
  including name, description, status, and goal timeline, with confirmation of
  successful updates.
- **FR-007**: The system must prevent conflicting edits by alerting users when a
  project has changed since they loaded it and guiding them to refresh before
  saving.
- **FR-008**: The system must support soft deletion (archiving) of projects so
  archived projects disappear from active dashboard listings but remain
  queryable through governance tools.
- **FR-009**: The system must provide a path to restore archived projects,
  reinstating them to the dashboard with the status and metadata captured
  immediately before archival.
- **FR-010**: Project status must follow the lifecycle states Draft, Active,
  Paused, Completed, and Archived, and transitions must enforce valid progress
  (e.g., only Archived can be restored, Paused returns to Active, Completed does
  not revert to Draft).

### Key Entities

- **Project**: Represents a unit of work tracked within CTRL FreaQ; includes
  name, short description, status, goal timeline, creation and update metadata,
  and archival state.
- **Project Access**: Captures the relationship between users and projects,
  including permissions (view, edit, archive) and ownership for audit records.

## Assumptions

- All authenticated workspace members share a consistent permission model where
  "project-manage" governs create, update, and archive actions.
- Projects belong to a single workspace, and dashboard listings show only
  projects within the viewer's current workspace context.
- Archive events feed existing audit and reporting tools so governance teams can
  retrieve historical records without new interfaces.
- The dashboard already supports pagination or infinite scroll; this feature
  leverages existing list behavior without redesigning pagination.

## Clarifications

### Session 2025-10-25

- Q: Which lifecycle states should govern project status updates displayed on
  the dashboard? → A: Draft → Active → Paused → Completed → Archived

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: 90% of pilot users can create and see a new project on the
  dashboard in under 60 seconds from first click to confirmation.
- **SC-002**: Dashboard project lists load with up-to-date summaries for active
  users within 2 seconds in 95% of sessions during UAT.
- **SC-003**: At least 85% of update attempts succeed on the first try without
  requiring support intervention over a two-week beta period.
- **SC-004**: Less than 5% of archived projects require manual data correction
  during audit reviews across the first 30 days after launch.

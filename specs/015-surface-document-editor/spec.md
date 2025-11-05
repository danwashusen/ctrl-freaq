# Feature Specification: Surface Document Editor

**Feature Branch**: `015-surface-document-editor`  
**Created**: 2025-11-05  
**Status**: Draft  
**Input**: User description: "Surface the document editor and related
functionality as described in .surface-in-ui.md."

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Resume architecture document from Project view (Priority: P1)

As a project maintainer, I can open the in-progress architecture document from
the Project page and land in the editor with live content so I can continue
editing without hunting for links.

**Why this priority**: This is the core path for delivering the architecture
document; without it, teams cannot progress beyond the dashboard.

**Independent Test**: Load a project that already has a primary document,
activate the document workflow card, and verify the editor renders the latest
sections and metadata.

**Acceptance Scenarios**:

1. **Given** an authenticated maintainer on a project with a primary document,
   **When** they activate the document workflow card, **Then** they are routed
   to the document editor and the table of contents and section content display
   the latest saved state.
2. **Given** live document data is still loading, **When** the maintainer opens
   the document editor, **Then** the UI presents a loading indicator and
   prevents editing until the document content is ready.

---

### User Story 2 - Provision a document when none exists (Priority: P2)

As a project maintainer, I can create the project’s first architecture document
directly from the Project page and be guided into the editor so I can bootstrap
work without leaving the workflow.

**Why this priority**: Teams with new projects must be able to create their
first document; preventing empty states keeps projects moving forward.

**Independent Test**: Start from a project without a primary document, trigger
the create document CTA, and confirm the new document opens at its first section
once creation completes.

**Acceptance Scenarios**:

1. **Given** a project without a primary document, **When** the maintainer
   selects the “Create Document” action, **Then** the system provisions a
   document, shows progress, and routes the maintainer to the first section upon
   success.
2. **Given** document creation fails, **When** the maintainer reviews the
   workflow card, **Then** the UI surfaces an error message with guidance to
   retry without creating duplicates.

---

### User Story 3 - Collaborate and validate within the document editor (Priority: P3)

As a document contributor, I can edit sections, collaborate with co-authors, and
run quality checks on the live document so the team can produce a review-ready
artifact inside one workspace.

**Why this priority**: Collaboration, saving, and quality gates are required for
the document to reach approval readiness.

**Independent Test**: Update a section, trigger manual save, co-author, and QA
actions, and verify the editor reflects results, handles conflicts, and reports
failures with recovery options.

**Acceptance Scenarios**:

1. **Given** a contributor with edit access, **When** they modify a section and
   trigger manual save, **Then** the editor shows the diff, confirms the save,
   and updates the document state without reloading the page.
2. **Given** another collaborator has conflicting edits, **When** the
   contributor attempts to save, **Then** the editor flags the conflict,
   preserves the contributor’s draft, and offers options to retry after
   refreshing.

---

### Edge Cases

- Project metadata fetch fails or returns stale document IDs; the Project page
  must fall back to a refresh prompt instead of navigating to a broken editor
  URL.
- Backend returns 404 for the requested document; the editor must display a
  recovery CTA that returns to the Project view or initiates document
  provisioning.
- Section save requests time out or are rejected; the editor must preserve
  unsaved edits locally and guide the user to retry or discard.
- Streaming co-author or QA requests drop mid-session; the UI must surface the
  interruption and allow the user to resume without losing chat history.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: System MUST let authenticated project collaborators open the
  primary project document from the Project page via an accessible workflow
  action, keeping the existing clickable card pattern (link-wrapped card with
  existing navigation focus handling) rather than introducing a new standalone
  button.
- **FR-002**: System MUST display the current document status on the Project
  page, including loading, ready, and missing states, before the user acts.
- **FR-003**: System MUST offer a “Create Document” call-to-action when a
  project lacks a primary document and prevent editor navigation until creation
  succeeds.
- **FR-004**: System MUST provision a new primary document when requested, show
  progress and errors, and block duplicate submissions while a request is
  pending.
- **FR-005**: System MUST route the user to the document editor after creation
  or selection and land on the document’s first available section.
- **FR-006**: System MUST load live document content—sections, metadata, table
  of contents, assumptions, and QA context—before enabling editing, with
  explicit loading and not-found states.
- **FR-007**: System MUST allow contributors to review diffs and commit manual
  saves for sections, confirming success and reverting to the last saved version
  when a save fails.
- **FR-008**: System MUST detect conflicting section revisions, preserve the
  contributor’s draft, and present guided resolution steps—refresh the section
  to pull the latest version, review the diff of incoming changes, then reapply
  the preserved draft—before further edits can be saved.
- **FR-009**: System MUST run the assumptions flow against the active project
  and document identifiers, let users accept or reject updates, and log the
  latest state in the editor.
- **FR-010**: System MUST connect the co-author sidebar to live collaboration
  sessions, stream responses, and provide cancel and retry options when a
  session ends unexpectedly.
- **FR-011**: System MUST let users request document QA checks from within the
  editor and show the latest gate results, including timestamps and pass/fail
  status.
- **FR-012**: System MUST persist template validation decisions made from the
  Project page and provide success or error feedback after each submission.
- **FR-013**: System MUST allow users to trigger a project export from the
  Project page and deliver the resulting artifact or job status without leaving
  the workflow.
- **FR-014**: System MUST provide breadcrumbs or equivalent navigation so users
  can return from the document editor to the originating project view without
  losing selection context.

### Key Entities _(include if feature involves data)_

- **Project**: Represents a team workspace, including project ID, name, and
  metadata that identifies the primary document and workflow status.
- **Document**: The architecture document tied to a project, with document ID,
  title, version state, and association to sections and quality gates.
- **Section**: A segment of the document with ordered content, draft text,
  approval status, and modification timestamps used for diffing and conflict
  detection.
- **Collaboration Session**: A co-author or QA interaction scoped to a document,
  capturing participant IDs, streaming transcripts, and session state (active,
  failed, completed).
- **Template Upgrade Decision**: Records template validations or upgrades
  initiated from the Project page, including requested change, approver, result,
  and timestamp.
- **Export Job**: Tracks document export requests with project ID, requested
  format, completion status, and delivery reference.

### Assumptions

- Primary documents already have at least one section seeded when created so the
  editor can route to a valid section by default.
- Only authenticated collaborators with edit permission access the Project view
  and document editor for the targeted project.
- Backend services expose reliable identifiers for sections, assumptions
  sessions, QA runs, and export jobs required by the UI workflows.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: 95% of users who open a project with an existing document can
  reach the document editor and view section content within 5 seconds.
- **SC-002**: 90% of first-attempt document creation flows complete successfully
  without manual support tickets.
- **SC-003**: 85% of manual section saves complete without conflict, and any
  conflict that occurs is resolved by the user within 2 minutes using the
  provided guidance.
- **SC-004**: 90% of QA or export requests initiated from the Project page
  return a success or actionable failure message within 30 seconds.

## Clarifications

### Session 2025-11-05

- Q: How should the Project workflow card achieve accessibility for launching
  the document editor? → A: Keep the current clickable card pattern and rely on
  surrounding navigation.
- Q: What guidance should conflict dialogs provide when drafts diverge? → A:
  Conflict dialog lists refresh, diff review, and reapply steps.

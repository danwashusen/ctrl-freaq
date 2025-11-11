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
   the document editor, **Then** the UI presents the documented loading skeleton
   (`Preparing sections…`), keeps focus within the spinner container, and
   prevents editing until the document content is ready.
3. **Given** a maintainer uses only keyboard navigation, **When** they tab to
   the workflow card and activate it with Enter or Space, **Then** the action is
   announced via screen reader, the editor loads, and focus returns to the
   originating card upon exit.

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
   workflow card, **Then** the UI surfaces the actionable failure banner with
   retry button and support link so the maintainer can try again without
   creating duplicates.
3. **Given** a maintainer attempts to trigger creation while a prior request is
   pending, **When** they press the CTA again, **Then** the control remains
   disabled with spinner copy `Creation in progress…` and no duplicate request
   is submitted.

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
   preserves the contributor’s draft, and offers the documented guided steps to
   refresh, review diffs, and reapply before saving.
3. **Given** a manual save fails for connectivity reasons, **When** the user
   stays in the editor, **Then** the UI shows
   `Save failed. Your draft is still here.` banner, applies `Unsaved` badges to
   affected sections, and keeps the draft locally until a retry succeeds or the
   user discards it.

---

### Edge Cases

- Project metadata fetch fails or returns stale document IDs; the Project page
  shows the refresh banner with retained scroll position and blocks editor
  launch until `Refresh project data` succeeds.
- Backend returns 404 for the requested document; the editor displays the
  documented not-found modal with `Return to Project` primary CTA and secondary
  provisioning link.
- Section save requests time out or are rejected; the editor preserves unsaved
  edits locally, applies `Unsaved` badges, and guides the user through retry or
  discard options before leaving the page.
- Streaming co-author or QA requests drop mid-session; the UI surfaces the
  interruption banner, keeps transcript history visible, and offers
  `Resume session` control.

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

#### UX Detail: Document Status Presentation

- **Loading**: Project card displays a shimmer skeleton, muted progress pill
  labeled `Document status: Loading…`, and disabled interaction until data
  resolves. Editor route shows a centered spinner with `Preparing sections…`
  copy and disables section list focus targets.
- **Ready**: Project card shows status pill `Ready` with green indicator and
  highlights last updated timestamp. Editor header shows the same pill and the
  active section name.
- **Missing**: Project card displays empty-state illustration, headline
  `No document yet`, guidance text, and primary `Create document` button. Editor
  route is blocked with modal offering provisioning CTA and `Return to project`
  secondary action.
- **Archived**: Project card shows gray `Archived` badge and disables editor
  launch while surfacing tooltip `Restore document to resume editing`. Editor
  route renders read-only banner with link back to Project view.

#### UX Detail: Document Provisioning Flow

- Progress indicator uses a three-step horizontal stepper: `Initializing`,
  `Provisioning`, `Finalizing`. Each step highlights active state and shows
  subtext describing backend work.
- Success state displays toast `Document created. Opening editor…` and routes to
  section one while stepper shows a checkmark animation.
- Failure state surfaces inline destructive banner
  `We could not create the document. Retry now or contact support.` with
  `Retry create document` button and secondary `View troubleshooting guide`
  link. Duplicate submissions are blocked with disabled CTA showing spinner and
  `Creation in progress…`.

#### UX Detail: Manual Save and Conflict UX

- Manual save button label `Save changes` with inline diff preview panel
  summarizing added/removed lines. Upon success, toast `Section saved at 12:34`
  appears, and diff collapses.
- Failure banner `Save failed. Your draft is still here.` offers `Retry save`
  primary button and `Discard draft` secondary. Unsaved sections gain badge
  `Unsaved` next to title until resolved.
- Conflict dialog presents ordered steps: `1. Refresh section` (button to fetch
  latest), `2. Review incoming diff` (link to diff viewer),
  `3. Reapply your draft` (button that restores preserved draft). Dialog copy
  explicitly notes that the draft remains cached until user confirms.

#### UX Detail: Accessible Workflow Action

- Workflow card uses `role="link"` with `aria-label="Open project document"` and
  remains focusable via Tab order that precedes secondary project actions.
- Hitting Enter or Space triggers navigation; Escape returns focus to the
  Project list without scrolling. Focus ring conforms to design token
  `focus-primary`.
- After editor closes, focus returns to originating card and announces
  `Returned to Project workflow card for Architecture document`.

#### UX Detail: Editor Bootstrap States

- Loading layout retains table of contents skeleton, disables editor textarea,
  and announces via `aria-live="polite"` `Loading document content`. Primary
  actions remain focusable but inert while spinner is present.
- Not-found view shows icon, headline `We cannot find that document`, body copy
  with steps, primary `Return to Project` button, and secondary link
  `Provision a new document`. Focus defaults to the primary CTA.

#### UX Detail: QA and Export Feedback

- QA request results show inline card with status chip (`Passed`, `Failed`,
  `Needs attention`) plus timestamp and summary text. Failure card includes
  bullet list of corrective actions and `View detailed report` link.
- Export triggers toast `Export queued. We will email you when it is ready.` and
  updates status card with progress. Failure state displays actionable message
  describing cause (e.g., `Missing template fields`) and `Retry export` button.

#### UX Detail: Status Vocabulary Alignment

- Shared vocabulary: `Loading`, `Ready`, `Provisioning`, `Missing`, `Archived`,
  `In progress`. Both Project cards and editor banners must show identical text,
  color tokens, and iconography documented in design system component specs.
- Status changes broadcast through shared store so Project and editor surfaces
  update synchronously with consistent copy.

#### UX Detail: Permission and Session Loss

- When permissions lapse on the Project page, the card converts to disabled
  state with lock icon, copy `You no longer have access`, and primary
  `Request access` button. Editor session loss raises modal `Session expired`
  with `Sign back in` primary action retaining context.
- Mid-editor token expiry announces via `aria-live` and preserves unsaved edits;
  after reauth, the editor resumes the previous section view.

#### UX Detail: Stale Identifier Handling

- If metadata returns stale or mismatched document ID, Project page displays
  warning banner
  `This project reference looks out of date. Refresh data to continue.` with
  `Refresh project data` button that retains scroll position and focus. Editor
  launch is prevented until refresh completes successfully.

#### UX Detail: Interrupted Collaboration Resumption

- Co-author or QA interruptions show persistent amber banner `Connection lost`
  with timestamp, `Resume session` primary button, and transcript preview to
  reassure no history was lost. Banner collapses automatically once connection
  reestablishes.
- Transcript panels persist conversation history with scroll anchoring to the
  last received message and note `Messages preserved locally` for clarity.

#### UX Detail: Missing Seeded Content Fallback

- If seeded sections fail to load, editor shows placeholder section card
  `Add your first section` with CTA to create section, while TOC displays
  skeleton entries labeled `Section pending`. Metadata panel states
  `Project details loading` with retry option.

#### UX Detail: Unsaved Edit Preservation

- When autosave fails, banner `Unsaved changes saved locally` stays visible,
  listing affected sections. Navigation away prompts confirmation dialog with
  summary of unsaved items and option to export draft.
- `Unsaved` badges appear in TOC and section headers until a successful save
  occurs; tooltip explains drafts persist in browser storage for 24 hours.

#### UX Detail: Messaging Terminology

- `Progress` references the provisioning stepper and export queue updates with
  explicit step labels and percentage when available.
- `Success message` definition: green toast or inline card with confirmation
  headline, timestamp, and next-step CTA. `Actionable failure` requires red
  banner containing cause summary, retry CTA, and support link when escalation
  is required.

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
- When seeded sections or metadata are delayed, the UI presents placeholder
  cards and retry affordances so users understand content is pending rather than
  missing forever.
- If authentication or permission changes occur mid-session, the UI retains
  unsaved edits while prompting re-authentication or access requests.

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
- **SC-005**: 85% of surveyed users rate the provisioning and save messaging as
  clear or very clear in usability validation sessions.
- **SC-006**: 90% of users confirm progress indicators and status labels were
  easy to understand in post-session questionnaires.

## Clarifications

### Session 2025-11-05

- Q: How should the Project workflow card achieve accessibility for launching
  the document editor? → A: Keep the current clickable card pattern and rely on
  surrounding navigation.
- Q: What guidance should conflict dialogs provide when drafts diverge? → A:
  Conflict dialog lists refresh, diff review, and reapply steps.

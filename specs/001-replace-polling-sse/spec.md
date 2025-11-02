# Feature Specification: Unified SSE Event Hub

**Feature Branch**: `[001-replace-polling-sse]`  
**Created**: 2025-11-03  
**Status**: Draft  
**Input**: User description: "replace polling with SSE events based on the info
found in .sse-events.md"

## Clarifications

### Session 2025-11-03

- Q: When an authorized client connects without specifying scope parameters,
  which topics should stream by default? → A: Stream all workspace-authorized
  topics.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Project lifecycle updates stream instantly (Priority: P1)

As a workspace admin on the Project page, I receive lifecycle changes (archive,
restore, status updates) in real time without refreshing so I can take timely
follow-up actions.

**Why this priority**: Ensures primary dashboard reflects authoritative project
status and eliminates manual refresh, directly replacing legacy polling loops.

**Independent Test**: Connect to the shared event hub as an authorized admin,
perform a lifecycle mutation in another session, and verify the UI reflects the
change and disables polling while the stream is healthy.

**Acceptance Scenarios**:

1. **Given** an authenticated admin viewing an authorized project, **When**
   another user archives the project, **Then** the SSE hub pushes a
   `project.lifecycle` event and the Project page state updates within 2 seconds
   without triggering the legacy polling interval.
2. **Given** the admin is connected to the hub and the SSE stream errors,
   **When** the hub exceeds the retry threshold, **Then** the UI flags degraded
   status and resumes the original polling cadence until the stream reconnects.

---

### User Story 2 - Quality gate progress streams to editors (Priority: P2)

As a document author running quality gates inside the editor, I can monitor live
progress and summaries so I can respond immediately to blockers.

**Why this priority**: Real-time quality gate feedback removes the 200 ms
polling cadence and keeps authors in the editor workspace during validation.

**Independent Test**: Start a quality gate run while connected to the hub, emit
progress updates, and confirm the editor reflects each stage and reverts to
timed refresh only when the hub reports degraded health.

**Acceptance Scenarios**:

1. **Given** an authenticated author with an active quality gate run, **When**
   the backend emits `quality-gate.progress` and `quality-gate.summary` events,
   **Then** the editor updates the run status without polling and captures the
   final summary once the run completes.

---

### User Story 3 - Section draft conflicts alert collaborators (Priority: P3)

As a reviewer collaborating on sections, I want conflict alerts and diffs to
appear immediately so I avoid overwriting teammates.

**Why this priority**: Immediate conflict awareness prevents data loss and
reduces manual diff checks during collaboration.

**Independent Test**: Simulate concurrent edits that trigger `section.conflict`
and `section.diff` events, observe hub delivery, and confirm the editor warns
the reviewer while maintaining the fallback timer when the hub is offline.

**Acceptance Scenarios**:

1. **Given** two collaborators editing the same section, **When** the backend
   publishes a `section.conflict` event, **Then** the reviewer receives an
   in-app warning within 2 seconds and the diff viewer opens with the latest
   content.

---

### Edge Cases

- SSE connection attempts exceed the configured retries; the system must surface
  degraded status, switch listeners back to polling, and continue keep-alive
  attempts without overwhelming the server.
- A client reconnects with a `Last-Event-ID` older than the replay buffer; the
  server must send the most recent snapshot event per topic and log the
  truncated recovery.
- A user requests scopes they are not authorized to access; the server must
  reject the subscription with an authorization error and no partial stream.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: The platform MUST expose `/api/v1/events` as an authenticated SSE
  endpoint that verifies either Clerk JWT or simple-mode session before
  establishing the stream.
- **FR-002**: The SSE endpoint MUST validate optional `projectId`, `documentId`,
  and `sectionId` query scopes against existing authorization helpers and close
  the connection with an error message when access is denied. When no scope is
  provided, the stream defaults to all topics the user is authorized to access
  within the active workspace.
- **FR-003**: The backend MUST maintain an in-memory broker that tracks active
  subscribers per topic/resource, enforces a bounded replay buffer (per topic),
  and delivers events in publish order with monotonic sequence numbers.
- **FR-004**: Domain services MUST publish events for `project.lifecycle`,
  `quality-gate.progress`, `quality-gate.summary`, `section.diff`, and
  `section.conflict`, ensuring envelopes include `topic`, `resourceId`,
  `payload`, `sequence`, and `emittedAt`.
- **FR-005**: The SSE stream MUST emit heartbeat comments at a configurable
  interval when no events are available so intermediaries keep the connection
  alive and clients can detect idle timeouts.
- **FR-006**: The broker MUST honor `Last-Event-ID` headers by replaying missed
  events from the buffer and, when sequence gaps remain, issuing a snapshot
  event that restores the latest known state for each subscribed topic.
- **FR-007**: The web client MUST provide a shared event hub that manages one
  authenticated streaming connection per tab, handles auth token refresh,
  performs progressive retry intervals with jitter, and exposes health state to
  downstream consumers.
- **FR-008**: User-facing data providers for project lifecycle, quality gates,
  and section drafts MUST subscribe through the hub, deliver updates to their
  stores, and automatically disable legacy polling while the hub reports a
  healthy state, re-enabling polling when degraded.
- **FR-009**: The system MUST capture telemetry for stream lifecycle events
  (connections, disconnect reasons, authorization failures, fallback
  activations) and surface them through existing logging/monitoring channels for
  operations review.
- **FR-010**: Feature flags `ENABLE_EVENT_STREAM` (backend) and
  `VITE_ENABLE_SSE_HUB` (frontend) MUST gate the new functionality, defaulting
  to off until rollout is approved and allowing safe rollback to polling.

### Key Entities

- **EventEnvelope**: Describes each published message with fields `topic`,
  `resourceId`, `payload`, `sequence`, `emittedAt`, and optional metadata used
  for replay and client routing.
- **StreamSubscription**: Represents an active SSE connection scoped to
  authorized topics, including retry state, associated user identity, and last
  delivered sequence per topic.
- **HubHealthState**: Captures the client-side streaming status (`healthy`,
  `recovering`, `degraded`) with the timestamp of last successful event and
  guidance for toggling fallback behaviors.

## Assumptions & Dependencies

- Existing authentication middleware remains the source of truth for validating
  Clerk and simple-mode sessions before any streaming connection is granted.
- Legacy polling implementations stay available as a fallback path for project
  lifecycle, quality gate, and section draft data until the rollout flags are
  permanently enabled.
- Domain services responsible for projects, quality gates, and section drafts
  can emit the necessary business events without requiring schema changes beyond
  the unified event envelope.
- Observability tooling already ingesting backend logs can be extended to
  capture stream health metrics without introducing new platforms.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: 95% of authorized users observe project lifecycle updates in the
  UI within 2 seconds of the originating change while the feature flag is
  enabled.
- **SC-002**: Quality gate progress and summaries reach connected editors
  without polling for at least 90% of runs, with the hub reverting to polling
  within 5 seconds when the stream is degraded.
- **SC-003**: Section conflict warnings appear to affected collaborators before
  any manual refresh in at least 95% of simultaneous edit scenarios during
  controlled testing.
- **SC-004**: Stream health telemetry shows fewer than 2% of connections
  terminating due to authorization errors and records fallback activations for
  all degraded periods, enabling operations to audit incident response.

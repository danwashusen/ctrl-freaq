# Feature Specification: Browser Log Ingestion Endpoint

**Feature Branch**: `097-injest-browser-logs`  
**Created**: 2025-11-14  
**Status**: Draft  
**Input**: User description: "Injest browser logs as described in github issue
https://github.com/danwashusen/ctrl-freaq/issues/112"

## Clarifications

### Session 2025-11-14

- Q: When a log batch contains at least one invalid entry, should the ingestion
  endpoint reject the whole batch or accept partial entries? → A: Reject the
  entire batch with no partial processing.

## User Scenarios & Testing _(mandatory)_

<!--
  IMPORTANT: User stories should be PRIORITIZED as user journeys ordered by importance.
  Each user story/journey must be INDEPENDENTLY TESTABLE - meaning if you implement just ONE of them,
  you should still have a viable MVP (Minimum Viable Product) that delivers value.

  Assign priorities (P1, P2, P3, etc.) to each story, where P1 is the most critical.
  Think of each story as a standalone slice of functionality that can be:
  - Developed independently
  - Tested independently
  - Deployed independently
  - Demonstrated to users independently
-->

### User Story 1 - Browser flush receives acknowledgement (Priority: P1)

Frontend instrumentation engineers need every browser telemetry flush to land on
an authenticated ingestion endpoint that validates the batch and returns an
acceptance response before the tab closes.

**Why this priority**: Without a dependable `/api/v1/logs` endpoint, every
queued telemetry flush currently fails, leaving ops blind to client-only issues
such as offline recovery attempts or editor crashes.

**Independent Test**: From a signed-in browser session, trigger a logger batch
flush (batch size ≤10, 5 s timer, or `sendBeacon`) and confirm the API responds
with 202 and echoes a server-side `requestId` while server logs capture enriched
entries.

**Acceptance Scenarios**:

1. **Given** an authenticated browser session with ≥1 queued log entries,
   **When** the logger POSTs the batch to `/api/v1/logs`, **Then** the API
   validates the payload, responds with HTTP 202 within 1 s, and the server log
   contains each entry tagged with the originating sessionId.
2. **Given** a tab closing event that triggers `navigator.sendBeacon`, **When**
   the payload reaches the API, **Then** the endpoint still validates and
   acknowledges the batch so telemetry survives tab closes.

---

### User Story 2 - Ops teams correlate browser issues (Priority: P2)

Operations responders need enriched log events so they can correlate client-side
failures with specific users, sessions, and backend request traces.

**Why this priority**: Browser-only incidents (offline drafts, editor crashes)
often lack backend traces; enriched ingestion provides the missing diagnostics
without building a new persistence layer.

**Independent Test**: After sending a valid batch, inspect the API structured
logs to confirm each entry carries requestId, authenticated userId (if present),
IP, user agent, sessionId, level, message, and optional attributes/context.

**Acceptance Scenarios**:

1. **Given** a successful batch submission, **When** an ops engineer reviews the
   server logs, **Then** each entry includes both the original browser fields
   and server-derived context so tickets can reference a single enriched log
   line.
2. **Given** a log entry that includes an `attributes` map detailing a crash,
   **When** the server logger emits the event, **Then** the structured payload
   remains intact for downstream alerting or dashboards.

---

### User Story 3 - Clients receive actionable rejections (Priority: P3)

The browser logger must learn immediately when its payload is malformed or
exceeds platform limits so instrumentation owners can correct issues without
guesswork.

**Why this priority**: Silent drops waste developer time and risk retry storms;
explicit errors bounded by payload size/governance enable safe throttling.

**Independent Test**: Submit intentionally invalid payloads (missing fields,
more than 100 entries, >1 MB body) and verify the API returns 400/413/429 with
clear error metadata.

**Acceptance Scenarios**:

1. **Given** a batch missing `requestId` on one entry, **When** the API receives
   it, **Then** it responds 400 with a machine-readable path to the failing log
   entry so the frontend can drop or fix the data.
2. **Given** a payload exceeding the 100-entry limit, **When** it is posted,
   **Then** the API responds 413 or 429, explains the limit, and does not emit
   any partial log events.

---

[Add more user stories as needed, each with an assigned priority]

### Edge Cases

- Payload body exceeds 1 MB because a client bundles large stack traces; the API
  must reject it before reading the entire stream and surface a clear error.
- `logs` array arrives empty or holds >100 entries; the server should block it
  with limit messaging and avoid partial writes.
- `source` is anything other than `browser`; ingestion should reject to prevent
  noisy cross-service misuse.
- Entries include invalid timestamps or unsupported `level` values; validation
  should flag the exact entry index.
- Any single invalid entry triggers full-batch rejection; the server responds
  400 with the precise failing index and skips emitting enriched events.
- Authenticated session expires mid-flight; endpoint should reuse global auth
  handling and surface 401 without additional logging.

## Requirements _(mandatory)_

<!--
  ACTION REQUIRED: The content in this section represents placeholders.
  Fill them out with the right functional requirements.
-->

### Functional Requirements

- **FR-001**: Provide a `POST /api/v1/logs` endpoint scoped to authenticated web
  sessions that accepts JSON bodies with `source`, `sessionId`, optional
  `userId`, and a `logs` array of 1–100 entries.
- **FR-002**: Validate the request body with detailed errors: `source` must
  equal `browser`, `sessionId` must be a non-empty string, and every log entry
  requires `timestamp` (ISO 8601), `level` in {DEBUG, INFO, WARN, ERROR, FATAL},
  `message`, and `requestId`; optional `event_type`, `context`, `attributes`,
  and `error` objects must follow documented shapes. Any validation failure must
  reject the entire batch with HTTP 400 and emit no enriched log entries to keep
  telemetry consistent.
- **FR-003**: Enforce size and rate limits by rejecting bodies exceeding 1 MB or
  `logs.length` >100 with HTTP 413/429 plus descriptive details, while never
  partially processing oversized batches.
- **FR-004**: Reuse the platform’s authenticated user lookup and per-user rate
  limiting middleware before request handling; unauthenticated or throttled
  callers must receive 401/429 responses consistent with existing API behavior.
- **FR-005**: For accepted batches, respond with HTTP 202 within one second and
  include a `requestId`/trace token so clients can correlate the flush with
  backend logs and retry logic remains straightforward.
- **FR-006**: Enrich every log entry with server-provided metadata (API
  requestId, authenticated userId if available, IP address, and user agent) and
  emit it to the structured logger using a consistent event name (e.g.,
  `browser.log`) plus severity alignment.
- **FR-007**: Keep processing in-memory—no database writes, queues, or new
  persistence layers may be added for this feature per issue constraints.
- **FR-008**: Capture both successful and rejected batches in audit-friendly
  logs while redacting secrets, aligning with the Constitution’s structured
  logging rules.
- **FR-009**: Publish or update documentation (front-end spec/runbooks) that
  describes payload contracts, flush triggers (batch-size, 5 s timer,
  `sendBeacon`), limits, and sample responses so frontend teams can implement
  and test the logger confidently.

### Key Entities _(include if feature involves data)_

- **BrowserLogBatch**: Represents a payload sent from a browser tab; includes
  `source=browser`, `sessionId`, optional `userId`, optional global metadata,
  and a bounded `logs` array; subject to 1 MB max body size.
- **BrowserLogEntry**: Individual telemetry item within a batch; contains
  `timestamp`, `level`, `message`, `requestId`, optional `event_type`, optional
  `context` and `attributes` maps, and optional serialized `error` blocks.
- **EnrichedLogEvent**: The server-side representation emitted after ingestion,
  combining the original entry with server context (`apiRequestId`, userId,
  remote IP, user agent, ingestion timestamp) for downstream observability.

## Success Criteria _(mandatory)_

<!--
  ACTION REQUIRED: Define measurable success criteria.
  These must be technology-agnostic and measurable.
-->

### Measurable Outcomes

- **SC-001**: During manual verification, 99% of valid browser log flushes
  receive HTTP 202 responses within one second while sending batches of ≤10
  entries.
- **SC-002**: 100% of accepted entries appear in server logs with both
  client-provided context and server-enriched metadata, enabling incident
  responders to correlate a log line to a user/session/request without
  additional lookups.
- **SC-003**: 100% of malformed payload attempts (missing required fields or
  exceeding limits) return 4xx responses that include machine-readable error
  paths, confirmed via automated tests.
- **SC-004**: Automated API tests for this route include at least one success
  case, one validation failure, and one limit enforcement case, and those suites
  run cleanly in the standard repository test pipeline to guard against
  regressions.

## Assumptions

- Browser logger already batches logs (size ≥1, ≤10 by default) and exposes the
  payload contract described in Issue #112; server work focuses on ingestion.
- Existing authentication and rate limiting middleware remain available for the
  new route without additional configuration beyond wiring.
- Structured logging infrastructure (Pino) is already configured to emit
  enriched events, so this feature only needs to supply the correct metadata
  payloads.

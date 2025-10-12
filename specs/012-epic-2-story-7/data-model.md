# Data Model — Streaming UX for Document Editor

## Entities

### StreamingInteractionSession

- **Purpose**: Represents a single AI-assisted workflow request (co-author,
  assumption loop, QA) with streaming or fallback delivery.
- **Identity**: `sessionId` (UUID v4) generated server-side.
- **Fields**:
  - `sessionId` (UUID, PK, non-null, immutable)
  - `documentId` (UUID, non-null, FK → documents)
  - `sectionId` (UUID, non-null, FK → document_sections)
  - `workspaceId` (UUID, non-null, FK → workspaces)
  - `initiatorUserId` (UUID, non-null, FK → users)
  - `interactionType` (enum: `co_author`, `assumption_loop`, `qa`)
  - `mode` (enum: `streaming`, `fallback`)
  - `status` (enum state machine below)
  - `queuedAt` (timestamp, nullable — populated when request enters queue)
  - `startedAt` (timestamp, non-null once streaming begins)
  - `timeToFirstUpdateMs` (integer, nullable until first chunk delivered)
  - `completedAt` (timestamp, nullable)
  - `canceledAt` (timestamp, nullable)
  - `cancellationReason` (enum: `author_cancelled`, `replaced_by_new_request`,
    `transport_failure`, `deferred`)
  - `fallbackTriggeredAt` (timestamp, nullable)
  - `fallbackReason` (enum: `transport_blocked`, `timeout`, `retry_exhausted`)
  - `finalSummaryId` (UUID, nullable FK → response_summaries)
  - `concurrencySlot` (integer, represents ordinal among simultaneous sessions
    within same workspace at time of start)
  - `metadata` (JSONB, optional — includes request parameters, prompt hashes)
- **State transitions**:
  1. `pending` (queued) → `active` (on start) — retains only newest pending per
     section.
  2. `active` → `completed` (stream finished) OR `fallback_active`.
  3. `fallback_active` → `completed`.
  4. Any state → `canceled` with reason (`author_cancelled`,
     `replaced_by_new_request`, etc.).
- **Constraints**:
  - Unique composite index `(sectionId, state in {pending})` to enforce single
    pending request per section.
  - Unique composite index `(sectionId, status in {active, fallback_active})`.
  - Trigger updates to set `mode = 'fallback'` once fallback is engaged.

### StreamingProgressEvent

- **Purpose**: Ordered progress updates delivered to the client and telemetry.
- **Identity**: `(sessionId, sequence)` composite key.
- **Fields**:
  - `sessionId` (UUID, FK → StreamingInteractionSession)
  - `sequence` (integer, non-null, monotonically increasing)
  - `stageLabel` (string, non-null — e.g., `analysis`, `drafting`,
    `summarizing`)
  - `timestamp` (timestamp, non-null)
  - `contentSnippet` (text, nullable — partial text or bullet)
  - `deltaType` (enum: `text`, `status`, `metric`)
  - `deliveryChannel` (enum: `streaming`, `fallback`)
  - `announcementPriority` (enum: `polite`, `assertive`)
  - `elapsedMs` (integer, non-null)
- **Relationships**:
  - Many-to-one with `StreamingInteractionSession`.
- **Constraints**:
  - Enforce `sequence` gap-free ordering within a session.
  - Ensure `deliveryChannel` matches current session `mode`.

### StreamingFallbackRecord

- **Purpose**: Audit trail capturing when streaming transitions to fallback.
- **Identity**: `sessionId` (one-to-one with StreamingInteractionSession).
- **Fields**:
  - `sessionId` (UUID, PK, FK → StreamingInteractionSession)
  - `triggeredAt` (timestamp, non-null)
  - `resolvedAt` (timestamp, nullable — completion time)
  - `rootCause` (enum: `transport_blocked`, `stream_timeout`, `sse_error`,
    `policy_restriction`)
  - `preservedTokensCount` (integer, non-null, defaults to 0)
  - `retryAttempted` (boolean, non-null, default false)
  - `notes` (text, nullable — free-form debugging info)
  - `reportedToClient` (boolean, non-null, default true)
- **Constraints**:
  - Create only when fallback activated.
  - `resolvedAt` must be ≥ `triggeredAt`.

## Relationships & Integrity Rules

- `StreamingInteractionSession` (1) → `StreamingProgressEvent` (N)
- `StreamingInteractionSession` (1) ↔ `StreamingFallbackRecord` (0..1)
- Foreign keys cascade deletes softly by marking `StreamingInteractionSession`
  `status = canceled` instead of physical deletion (aligning with audit trail
  guidance).

## Validation & Business Rules

- Reject new session creation if an `active` session already exists for the same
  `sectionId`; instead, enqueue as `pending` and immediately replace prior
  pending entry.
- When a new session is enqueued for a section with an existing pending one,
  mark the existing pending session as `canceled` with reason
  `replaced_by_new_request`.
- On session start, compute `concurrencySlot` as the count of concurrent active
  sessions across the workspace to support observability goals.
- `timeToFirstUpdateMs` must be ≤300 (milliseconds) for 95% of instrumented
  sessions; raise telemetry warning if exceeded.
- Accessibility logic consumes `announcementPriority` from each progress event
  to route announcements into polite vs assertive ARIA regions.

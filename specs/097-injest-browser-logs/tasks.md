# Tasks: Browser Log Ingestion Endpoint

**Input**: Design documents from `/specs/097-injest-browser-logs/`  
**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`,
`contracts/browser-logs.openapi.yaml`

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Create shared fixtures and helpers the contract/integration suites
will reuse across every story.

- [ ] T001 Create reusable browser log payload builders in
      `/apps/api/tests/fixtures/browser-logs.ts` for valid, oversize, and
      malformed batches.
- [ ] T002 Add `/apps/api/tests/fixtures/logger-spy.ts` to capture and assert
      structured `browser.log` events inside Vitest without violating the
      fixtures-only rule.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Wire a dedicated router so later stories can focus on behavior
instead of plumbing.

- [ ] T003 Scaffold `/apps/api/src/routes/logs/index.ts` with an Express router,
      typed handler shell, and TODO comments referencing D001–D004.
- [ ] T004 Mount the new logs router inside `/apps/api/src/app.ts` (after auth +
      rate limit middleware) so `/api/v1/logs` traffic reaches the feature
      module.

**Checkpoint**: Router reachable with guards attached.

---

## Phase 3: User Story 1 – Browser flush receives acknowledgement (Priority: P1) 🎯 MVP

**Goal**: Authenticated browsers can POST ≤1 MB batches (JSON or `text/plain`
sendBeacon) and always receive a 202 acknowledgement with the server
`requestId`.

**Independent Test**: From a signed-in fixture session, send a ≤10 entry payload
and confirm the API returns 202 with echoed `requestId` while writing zero
persistence.

### Tests for User Story 1 (write first)

- [ ] T005 [P] [US1] Create `POST /api/v1/logs` happy-path contract test in
      `/apps/api/tests/contracts/logs/browser-logs.acceptance.contract.test.ts`
      asserting 202 JSON body plus `x-request-id`.
- [ ] T006 [P] [US1] Add
      `/apps/api/tests/integration/logs/browser-logs.send-beacon.test.ts`
      covering `text/plain` payloads routed through the feature-specific body
      parser.
- [ ] T007 [P] [US1] Create
      `/apps/api/tests/contracts/logs/browser-logs.auth.contract.test.ts`
      covering missing tokens and expired fixture sessions so 401/429 responses
      propagate from shared middleware.

### Implementation for User Story 1

- [ ] T008 [US1] Introduce `/apps/api/src/routes/logs/body-parser.ts` to wrap
      `express.json` with a 1 MB limit and allow both `application/json` and
      `text/plain`.
- [ ] T009 [US1] Define initial Zod schemas for `BrowserLogBatch` + ack DTO in
      `/apps/api/src/routes/logs/logs.schema.ts` (source=browser, sessionId,
      logs[1..100]).
- [ ] T010 [US1] Implement the success handler in
      `/apps/api/src/routes/logs/index.ts` to validate payloads, capture
      `req.requestId`, reuse `requireAuth`, and respond with
      `{ status: 'accepted', receivedCount, requestId }`.

**Checkpoint**: `/api/v1/logs` acknowledges valid batches end-to-end.

---

## Phase 4: User Story 2 – Ops teams correlate browser issues (Priority: P2)

**Goal**: Every accepted entry is enriched with server metadata and emitted as a
structured `browser.log` event for ops to correlate incidents.

**Independent Test**: After a successful batch, inspect captured logs to verify
`event=browser.log` entries include apiRequestId, entryRequestId, sessionId,
userId, IP, UA, and raw payload.

### Tests for User Story 2 (write first)

- [ ] T011 [P] [US2] Add
      `/apps/api/tests/unit/routes/logs/enrich-log-entry.test.ts` to cover data
      enrichment (userId, requestId, ip, userAgent).
- [ ] T012 [P] [US2] Extend
      `/apps/api/tests/integration/logs/browser-logs.logger.test.ts` to assert a
      `browser.log` Pino event is emitted per entry using the logger spy.

### Implementation for User Story 2

- [ ] T013 [US2] Implement `/apps/api/src/routes/logs/enrich-log-entry.ts` to
      merge client entry data with server context (apiRequestId, userId, ip,
      userAgent, ingestedAt, index).
- [ ] T014 [US2] Create `/apps/api/src/routes/logs/emit-browser-log.ts` that
      pulls `logger` from the service locator and writes structured events per
      D003.
- [ ] T015 [US2] Update `/apps/api/src/routes/logs/index.ts` to loop over
      entries, call the enrichment helper, emit logs, and keep `receivedCount`
      in sync with emitted events.

**Checkpoint**: Ops can tail `browser.log` entries with complete context.

---

## Phase 5: User Story 3 – Clients receive actionable rejections (Priority: P3)

**Goal**: Invalid or over-limit payloads are rejected atomically with
machine-readable errors, size limit enforcement, and audit logging of the
rejection reason.

**Independent Test**: Submit malformed, oversize, and burst requests via curl
and confirm 400/413/429 responses include `details.path` plus audit log entries.

### Tests for User Story 3 (write first)

- [ ] T016 [P] [US3] Author
      `/apps/api/tests/contracts/logs/browser-logs.validation.contract.test.ts`
      covering schema failures (missing `requestId`, invalid level,
      non-`browser` source) and verifying `INVALID_PAYLOAD` format with
      `details.path`.
- [ ] T017 [P] [US3] Add
      `/apps/api/tests/integration/logs/browser-logs.limits.test.ts` to exercise
      1 MB enforcement, >100 entries, rate-limit propagation, and ensure no
      partial logs emit.

### Implementation for User Story 3

- [ ] T018 [US3] Expand `/apps/api/src/routes/logs/logs.schema.ts` to validate
      per-entry fields (levels, lengths, attributes size, timestamp drift) plus
      enforce `source: 'browser'` const and attach index metadata.
- [ ] T019 [US3] Implement `/apps/api/src/routes/logs/logs.errors.ts` to
      translate Zod issues and parser failures into
      `{ code, message, details.path }` envelopes shared by handlers.
- [ ] T020 [US3] Harden `/apps/api/src/routes/logs/index.ts` +
      `/apps/api/src/routes/logs/body-parser.ts` to short-circuit 400/413/429
      responses (no partial logging) and echo `Retry-After` when throttled.
- [ ] T021 [US3] Emit audit-friendly rejection events through
      `/apps/api/src/services/audit-log.service.ts` (reason, sessionId, userId,
      requestId) per FR-008.

**Checkpoint**: Clients get actionable errors; bad batches never reach logging.

---

## Phase 6: Polish & Cross-Cutting

**Purpose**: Final documentation and spec alignment so frontend teams understand
payloads and operational flows.

- [ ] T022 Update `/docs/front-end-spec.md` with the `/api/v1/logs` payload
      contract, flush triggers (≤10 entries, 5 s timer, sendBeacon), and error
      codes.
- [ ] T023 Extend `/specs/097-injest-browser-logs/quickstart.md` with final curl
      samples covering success + rejection flows to guide instrumentation teams.

---

## Dependencies

1. Complete Setup (Phase 1) before Foundational tasks.
2. Foundational router (Phase 2) must land before User Story 1 work.
3. User Story 1 → User Story 2 → User Story 3; each story depends on the
   previous story’s handler shape.
4. Polish tasks run last after all user stories pass.

## Parallel Execution Examples

- **US1**: While T005 builds the contract test, T006 can cover `text/plain`
  payloads, T007 hits auth failures, and T008/T009 can proceed in parallel
  because they touch different files (`body-parser.ts` vs `logs.schema.ts`).
- **US2**: T011 and T012 both target independent test files, allowing T013 and
  T014 to advance concurrently once helpers are stubbed.
- **US3**: T016 (contract) and T017 (integration) can run simultaneously;
  afterward, T018 (schema) and T019 (error mapper) proceed in parallel before
  T020 stitches the handler.

## Implementation Strategy

1. **MVP First**: Deliver User Story 1 end-to-end (tests + handler) to unblock
   telemetry teams; this also exercises the new router wiring and shared auth
   enforcement.
2. **Incremental Logging**: Layer User Story 2 by adding enrichment and logger
   emissions without changing request semantics, ensuring ops value arrives as a
   self-contained increment.
3. **Hardening & Docs**: Finish with validation/error handling (User Story 3)
   and documentation polish so frontend teams have clear contracts before
   invoking `/speckit.implement`.

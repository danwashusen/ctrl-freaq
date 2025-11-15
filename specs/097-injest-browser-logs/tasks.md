# Tasks: Browser Log Ingestion Endpoint

**Input**: Design documents from `/specs/097-injest-browser-logs/`  
**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`,
`contracts/browser-logs.openapi.yaml`

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Create shared fixtures and helpers the contract/integration suites
will reuse across every story.

- [x] T001 Create reusable browser log payload builders in
      `/apps/api/tests/fixtures/browser-logs.ts` for valid, oversize, and
      malformed batches.
- [x] T002 Add `/apps/api/tests/fixtures/logger-spy.ts` to capture and assert
      structured `browser.log` events inside Vitest without violating the
      fixtures-only rule.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Wire a dedicated router so later stories can focus on behavior
instead of plumbing.

- [x] T003 Scaffold `/apps/api/src/routes/logs/index.ts` with an Express router,
      typed handler shell, and TODO comments referencing D001–D004.
- [x] T004 Mount the new logs router inside `/apps/api/src/app.ts` (after auth +
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

- [x] T005 [P] [US1] Create `POST /api/v1/logs` happy-path contract test in
      `/apps/api/tests/contracts/logs/browser-logs.acceptance.contract.test.ts`
      asserting 202 JSON body plus `x-request-id`.
- [x] T006 [P] [US1] Add
      `/apps/api/tests/integration/logs/browser-logs.send-beacon.test.ts`
      covering `text/plain` payloads routed through the feature-specific body
      parser.
- [x] T007 [P] [US1] Create
      `/apps/api/tests/contracts/logs/browser-logs.auth.contract.test.ts`
      covering missing tokens and expired fixture sessions so 401/429 responses
      propagate from shared middleware.

### Implementation for User Story 1

- [x] T008 [US1] Introduce `/apps/api/src/routes/logs/body-parser.ts` to wrap
      `express.json` with a 1 MB limit and allow both `application/json` and
      `text/plain`.
- [x] T009 [US1] Define initial Zod schemas for `BrowserLogBatch` + ack DTO in
      `/apps/api/src/routes/logs/logs.schema.ts` (source=browser, sessionId,
      logs[1..100]).
- [x] T010 [US1] Implement the success handler in
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

- [x] T011 [P] [US2] Add
      `/apps/api/tests/unit/routes/logs/enrich-log-entry.test.ts` to cover data
      enrichment (userId, requestId, ip, userAgent).
- [x] T012 [P] [US2] Extend
      `/apps/api/tests/integration/logs/browser-logs.logger.test.ts` to assert a
      `browser.log` Pino event is emitted per entry using the logger spy.

### Implementation for User Story 2

- [x] T013 [US2] Implement `/apps/api/src/routes/logs/enrich-log-entry.ts` to
      merge client entry data with server context (apiRequestId, userId, ip,
      userAgent, ingestedAt, index).
- [x] T014 [US2] Create `/apps/api/src/routes/logs/emit-browser-log.ts` that
      pulls `logger` from the service locator and writes structured events per
      D003.
- [x] T015 [US2] Update `/apps/api/src/routes/logs/index.ts` to loop over
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

- [x] T016 [P] [US3] Author
      `/apps/api/tests/contracts/logs/browser-logs.validation.contract.test.ts`
      covering schema failures (missing `requestId`, invalid level,
      non-`browser` source) and verifying `INVALID_PAYLOAD` format with
      `details.path`.
- [x] T017 [P] [US3] Add
      `/apps/api/tests/integration/logs/browser-logs.limits.test.ts` to exercise
      1 MB enforcement, >100 entries, rate-limit propagation, and ensure no
      partial logs emit.

### Implementation for User Story 3

- [x] T018 [US3] Expand `/apps/api/src/routes/logs/logs.schema.ts` to validate
      per-entry fields (levels, lengths, attributes size, timestamp drift) plus
      enforce `source: 'browser'` const and attach index metadata.
- [x] T019 [US3] Implement `/apps/api/src/routes/logs/logs.errors.ts` to
      translate Zod issues and parser failures into
      `{ code, message, details.path }` envelopes shared by handlers.
- [x] T020 [US3] Harden `/apps/api/src/routes/logs/index.ts` +
      `/apps/api/src/routes/logs/body-parser.ts` to short-circuit 400/413/429
      responses (no partial logging) and echo `Retry-After` when throttled.
- [x] T021 [US3] Emit audit-friendly rejection events through
      `/apps/api/src/services/audit-log.service.ts` (reason, sessionId, userId,
      requestId) per FR-008.

**Checkpoint**: Clients get actionable errors; bad batches never reach logging.

---

## Phase 6: Polish & Cross-Cutting

**Purpose**: Final documentation and spec alignment so frontend teams understand
payloads and operational flows.

- [x] T022 Update `/docs/front-end-spec.md` with the `/api/v1/logs` payload
      contract, flush triggers (≤10 entries, 5 s timer, sendBeacon), and error
      codes.
- [x] T023 Extend `/specs/097-injest-browser-logs/quickstart.md` with final curl
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

## Implementation Log

- 2025-11-15T19:56:34Z – F001/F002: Unignored all log feature directories so the
  router/tests are in source control and aligned emitted severities with browser
  levels.
  - Files: `.gitignore`,
    `apps/api/src/routes/logs/{body-parser.ts,emit-browser-log.ts,enrich-log-entry.ts,index.ts,logs.errors.ts,logs.schema.ts}`,
    `apps/api/src/services/audit-log.service.ts`,
    `apps/api/tests/fixtures/{browser-logs.ts,browser-logs.test.ts,logger-spy.ts,logger-spy.test.ts}`,
    `apps/api/tests/contract/logs/{browser-logs.acceptance.contract.test.ts,browser-logs.auth.contract.test.ts,browser-logs.validation.contract.test.ts}`,
    `apps/api/tests/integration/logs/{browser-logs.logger.test.ts,browser-logs.limits.test.ts,browser-logs.send-beacon.test.ts,logs-router.setup.test.ts}`,
    `apps/api/tests/unit/routes/logs/enrich-log-entry.test.ts`,
    `specs/097-injest-browser-logs/{audit.md,tasks.md}`
  - Commands:
    - `pnpm format`
    - `pnpm lint:fix`
    - `pnpm lint`
    - `pnpm --filter @ctrl-freaq/api typecheck`
    - `pnpm --filter @ctrl-freaq/api test -- tests/contract/logs/browser-logs.acceptance.contract.test.ts tests/contract/logs/browser-logs.auth.contract.test.ts tests/contract/logs/browser-logs.validation.contract.test.ts tests/integration/logs/browser-logs.send-beacon.test.ts tests/integration/logs/browser-logs.logger.test.ts tests/integration/logs/browser-logs.limits.test.ts tests/integration/logs/logs-router.setup.test.ts tests/unit/routes/logs/enrich-log-entry.test.ts`
  - Notes: `.gitignore` now only ignores the root `logs/` folder so every
    `apps/api/**/logs` directory is tracked, and emit-browser-log.ts maps
    browser `WARN`/`ERROR`/`FATAL` levels to the corresponding Pino method to
    satisfy FR-006; updated integration tests assert the severity alignment and
    logger spy coverage confirms zero regressions.

- 2025-11-14T21:32:58Z – T016–T023: Added US3 validation/limit tests, hardened
  the ingestion stack, and updated docs.
  - Files:
    `apps/api/tests/contract/logs/browser-logs.validation.contract.test.ts`,
    `apps/api/tests/integration/logs/browser-logs.limits.test.ts`,
    `apps/api/src/routes/logs/logs.schema.ts`,
    `apps/api/src/routes/logs/logs.errors.ts`,
    `apps/api/src/routes/logs/index.ts`,
    `apps/api/src/services/audit-log.service.ts`, `docs/front-end-spec.md`,
    `specs/097-injest-browser-logs/quickstart.md`
  - Commands:
    - `pnpm --filter @ctrl-freaq/api test -- tests/contract/logs/browser-logs.validation.contract.test.ts tests/integration/logs/browser-logs.limits.test.ts`
    - `pnpm format`
    - `pnpm lint:fix`
    - `pnpm lint`
    - `pnpm --filter @ctrl-freaq/api typecheck`
  - Notes: Schema now enforces timestamp drift, context/attribute limits, and
    indexes entries immediately—limit enforcement short-circuits 413 errors
    before logging. Parser errors map through `logs.errors.ts`, audit logging
    records rejection reason/session/user details, and `/api/v1/logs` skips the
    global 10 MB parser so the route-scoped 1 MB + `text/plain` parser owns the
    request. Frontend spec + quickstart document flush triggers, sendBeacon
    JSON/text payloads, and the precise error codes surfaced to clients.

- 2025-11-14T20:47:58Z – T011–T015: Added US2 enrichment + logging tests and
  implementation.
  - Files: `apps/api/tests/unit/routes/logs/enrich-log-entry.test.ts`,
    `apps/api/tests/integration/logs/browser-logs.logger.test.ts`,
    `apps/api/src/routes/logs/enrich-log-entry.ts`,
    `apps/api/src/routes/logs/emit-browser-log.ts`,
    `apps/api/src/routes/logs/index.ts`
  - Commands:
    - `pnpm --filter @ctrl-freaq/api test -- tests/unit/routes/logs/enrich-log-entry.test.ts tests/integration/logs/browser-logs.logger.test.ts`
  - Notes: Enrichment helper now derives session/user/ip/UA context, stamps
    ingestedAt/index, and emit helper routes request-scoped logger events per
    entry with info/warn severity. Router loops through validated entries to log
    before acking so receivedCount matches emitted events.

- 2025-11-14T20:14:40Z – T005–T010: Landed US1 test suite plus happy-path
  handler.
  - Files:
    `apps/api/tests/contract/logs/browser-logs.acceptance.contract.test.ts`,
    `apps/api/tests/contract/logs/browser-logs.auth.contract.test.ts`,
    `apps/api/tests/integration/logs/browser-logs.send-beacon.test.ts`,
    `apps/api/tests/integration/logs/logs-router.setup.test.ts`,
    `apps/api/src/routes/logs/body-parser.ts`,
    `apps/api/src/routes/logs/logs.schema.ts`,
    `apps/api/src/routes/logs/index.ts`
  - Commands:
    - `pnpm --filter @ctrl-freaq/api test -- tests/contract/logs/browser-logs.acceptance.contract.test.ts tests/contract/logs/browser-logs.auth.contract.test.ts tests/integration/logs/browser-logs.send-beacon.test.ts tests/integration/logs/logs-router.setup.test.ts`
    - `pnpm lint:fix`
    - `pnpm --filter @ctrl-freaq/api typecheck`
  - Notes: Route now enforces the 1 MB parser, validates browser batches with
    Zod, and returns `{ status: 'accepted', receivedCount, requestId }` for
    JSON + `text/plain` sendBeacon payloads; rate-limit/auth contract now covers
    401/429 propagation. `pnpm lint:fix` surfaced two existing
    `security/detect-object-injection` warnings in
    `apps/api/tests/fixtures/logger-spy.ts`.

- 2025-11-14T02:10:45Z – T003/T004: Scaffolded the `/api/v1/logs` router with a
  placeholder handler plus integration coverage to prove the route is reachable
  through the authenticated stack.
  - Files: `apps/api/src/routes/logs/index.ts`,
    `apps/api/tests/integration/logs/logs-router.setup.test.ts`,
    `apps/api/src/app.ts`
  - Commands:
    - `pnpm --filter @ctrl-freaq/api run build:deps`
    - `pnpm --filter @ctrl-freaq/api test -- tests/integration/logs/logs-router.setup.test.ts`
  - Notes: Handler currently returns 501 with TODO references for D001–D004;
    update the response + tests once US1 lands.

- 2025-11-14T02:06:28Z – T001/T002: Added reusable browser log payload builders
  plus a logger spy fixture to unblock downstream contract/integration suites.
  - Files: `apps/api/tests/fixtures/browser-logs.ts`,
    `apps/api/tests/fixtures/browser-logs.test.ts`,
    `apps/api/tests/fixtures/logger-spy.ts`,
    `apps/api/tests/fixtures/logger-spy.test.ts`
  - Commands:
    `pnpm --filter @ctrl-freaq/api test -- tests/fixtures/browser-logs.test.ts tests/fixtures/logger-spy.test.ts`
  - Notes: Builders cover valid/oversize/malformed payloads; spy exposes
    `browser.log` capture helpers. No follow-ups pending for Phase 1.

## Phase 4.R: Review Follow-Up

- [x] F001 Finding F001: Narrow `.gitignore` so `apps/api/src/routes/logs/**`
      and `apps/api/tests/**/logs/**` are tracked, then add the router + tests
      as described in audit.md.
- [x] F002 Finding F002: Update `apps/api/src/routes/logs/emit-browser-log.ts`
      (and its tests) so WARN/ERROR/FATAL entries log at matching Pino severity
      per audit.md.

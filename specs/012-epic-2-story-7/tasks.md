# Tasks: Streaming UX for Document Editor

**Input**: Design documents from `/specs/012-epic-2-story-7/` **Prerequisites**:
plan.md (required), spec.md (required for user stories), research.md,
data-model.md, contracts/

**Tests**: Tests are mandated by the constitution; each story lists test-first
tasks.

**Organization**: Tasks are grouped by user story so each increment is
independently deliverable.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact repository-root anchored file paths in descriptions

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Align contributors on scope and ensure workspace readiness.

- [x] T001 [Setup] Review `/specs/012-epic-2-story-7/spec.md` and
      `/specs/012-epic-2-story-7/plan.md` to confirm streaming requirements,
      success criteria, edge cases, and architectural constraints.
- [x] T002 [P] [Setup] Verify workspace dependencies via `pnpm install` using
      `/package.json` and `/pnpm-lock.yaml`, documenting any install deltas.
- [x] T003 [Setup] Cross-check research and contracts in
      `/specs/012-epic-2-story-7/research.md` and
      `/specs/012-epic-2-story-7/contracts/streaming-openapi.yaml` so engineers
      share queue replacement, cancel/retry, and fallback expectations.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST exist before any user story work
begins.

- [x] T004 [Foundational] Add shared DTOs for `StreamingInteractionSession`,
      `StreamingProgressEvent`, and `StreamingFallbackRecord` in
      `/packages/shared-data/src/co-authoring/streaming-interaction-session.ts`,
      exporting them via `/packages/shared-data/src/co-authoring/index.ts` and
      `/packages/shared-data/src/index.ts` for co-authoring, document QA, and
      assumptions.
- [x] T005 [Foundational] Extend persistence typings and migration scaffolding
      in `/packages/shared-data/src/models/streaming.ts` (and doc updates in
      `/packages/shared-data/src/migrations/README.md`) to persist queue state,
      cancel/retry metadata, and fallback diagnostics.
- [x] T006 [Foundational] Author failing unit tests in
      `/packages/editor-core/src/streaming/section-stream-queue.test.ts`
      covering newest-request replacement, single active per section,
      concurrency slot calculation, and cancel propagation.
- [x] T007 [Foundational] Implement `section-stream-queue` utilities in
      `/packages/editor-core/src/streaming/section-stream-queue.ts` (enqueue,
      replace pending, cancel, concurrency slot tracking) and export from
      `/packages/editor-core/src/index.ts`.

**Checkpoint**: Shared data types and queue utilities ready—user story work may
begin.

---

## Phase 3: User Story 1 - Streamed Co-Author & QA Guidance (Priority: P1) 🎯 MVP

**Goal**: Ensure co-authoring and document QA interactions stream within 0.3s,
respect per-section serialization, expose cancel/retry controls, and keep the
editor responsive.

**Independent Test**: Trigger co-author guidance and document QA review on
separate sections; confirm first update <0.3s, cancel/retry controls report
status, editing remains unblocked, and session logs persist final summaries.

### Tests for User Story 1 (write first, ensure they fail)

- [x] T008 [US1] Expand
      `/apps/api/src/services/co-authoring/ai-proposal.service.test.ts` with
      failing cases for newest-request replacement, cancel/retry flows,
      out-of-order event buffering, concurrency slots, and telemetry assertions.
- [x] T009 [P] [US1] Extend
      `/apps/web/src/features/document-editor/hooks/useCoAuthorSession.test.tsx`
      with failing specs covering visible progress cues, cancel/retry
      confirmation, out-of-order event resequencing, and editing responsiveness.
- [x] T010 [US1] Create failing API coverage in
      `/apps/api/tests/unit/document-qa/document-qa-streaming.service.test.ts`
      verifying document QA streams reuse queue rules, buffer out-of-order
      events, honor cancel/retry, and emit telemetry.
- [x] T011 [P] [US1] Add failing UI test in
      `/apps/web/src/features/document-editor/hooks/useDocumentQaSession.test.tsx`
      confirming document QA streaming parity, replacement notices, out-of-order
      resequencing, and cancel/retry status messaging.

### Implementation for User Story 1

- [x] T012 [US1] Update
      `/apps/api/src/services/co-authoring/ai-proposal.service.ts` to enforce
      single active streams, replace pending sessions, buffer and reorder
      out-of-sequence events, and implement cancel/retry handlers that propagate
      statuses and concurrency metrics.
- [x] T013 [US1] Enhance `/apps/api/src/routes/co-authoring.ts` to expose
      cancel/retry endpoints, return updated session metadata (sessionId,
      concurrencySlot, replacement policy), and surface cancel/retry outcomes.
- [x] T014 [P] [US1] Extend `/apps/api/src/middleware/ai-request-audit.ts` to
      log queue disposition (`active`, `replaced`, `canceled`, `fallback`) with
      request IDs, cancel reasons, and out-of-order discrepancy flags.
- [x] T015 [P] [US1] Update
      `/apps/web/src/features/document-editor/stores/co-authoring-store.ts` to
      manage pending replacement state, cancel/retry status, and final
      transcript retention.
- [x] T016 [P] [US1] Refine
      `/apps/web/src/features/document-editor/hooks/useCoAuthorSession.ts` to
      consume new SSE payloads, orchestrate cancel/retry commands, and keep
      editor actions non-blocking.
- [x] T017 [P] [US1] Refresh
      `/apps/web/src/features/document-editor/components/co-authoring/SessionProgress.tsx`
      and
      `/apps/web/src/features/document-editor/components/co-authoring/CoAuthorSidebar.tsx`
      to display stage labels, elapsed timers, replacement notices, cancel/retry
      confirmations, and out-of-order buffering indicators with ARIA live
      regions.
- [x] T018 [P] [US1] Extend `/apps/web/src/lib/streaming/progress-tracker.ts`
      and `/apps/web/src/lib/streaming/progress-tracker.test.ts` to guarantee
      visible indicators within 0.3s while tracking cancel/retry events.
- [x] T019 [US1] Implement document QA streaming service in
      `/apps/api/src/modules/document-qa/services/document-qa-streaming.service.ts`
      (new module) reusing queue utilities, cancel/retry logic, out-of-order
      buffering, and telemetry hooks.
- [x] T020 [US1] Expose document QA SSE routes in
      `/apps/api/src/routes/document-qa.ts` (new file) and register them in
      `/apps/api/src/routes/index.ts`, ensuring consistent response metadata.
- [x] T021 [P] [US1] Create
      `/apps/web/src/features/document-editor/stores/document-qa-store.ts` to
      track document QA session state, queue status, and cancel/retry outcomes.
- [x] T022 [P] [US1] Build
      `/apps/web/src/features/document-editor/hooks/useDocumentQaSession.ts`
      mirroring co-author behaviour for document QA streaming, cancel/retry, and
      history persistence.
- [x] T023 [P] [US1] Implement
      `/apps/web/src/features/document-editor/components/document-qa/DocumentQaPanel.tsx`
      to present streaming updates, replacement notices, out-of-order buffering
      notices, and cancel/retry controls with accessible announcements.
- [x] T024 [P] [US1] Extend telemetry utilities in
      `/apps/web/src/lib/telemetry/client-events.ts` and
      `/apps/web/src/lib/telemetry/client-events.test.ts` to emit document QA
      streaming metrics, out-of-order correction events, cancel reasons, and
      fallback diagnostics.

**Checkpoint**: Co-authoring and document QA streaming deliver responsive
updates with full cancel/retry support, telemetry, and accessible UI—MVP
complete.

---

## Phase 4: User Story 2 - Assumption Flow Progress (Priority: P2)

**Goal**: Stream assumption rationale, risks, and prompts with pause/resume
handling so authors always understand loop progress.

**Independent Test**: Start the assumption loop, observe ordered streaming
bullets with context tags, defer a prompt, and verify streaming pauses and
resumes with guidance intact.

### Tests for User Story 2 (write first, ensure they fail)

- [x] T025 [US2] Add failing service tests in
      `/apps/api/src/modules/section-editor/services/assumption-session.service.test.ts`
      covering ordered streaming events, defer pause/resume, out-of-order
      buffering, and telemetry.
- [x] T026 [P] [US2] Create failing UI test in
      `/apps/web/src/features/document-editor/assumptions-flow/hooks/use-assumptions-flow.test.tsx`
      validating announcements, bullet updates, defer/resume status, cancel
      behavior, and resequencing indicators.

### Implementation for User Story 2

- [x] T027 [US2] Enhance
      `/apps/api/src/modules/section-editor/services/assumption-session.service.ts`
      to emit streaming progress events with context tags, buffer/resequence
      out-of-order payloads, support defer/resume, and integrate cancel
      propagation.
- [x] T028 [P] [US2] Wire `/apps/api/src/routes/sections.ts` SSE handlers to
      expose assumption streaming, replacement notifications, cancel responses,
      and resequencing metadata.
- [x] T029 [P] [US2] Update
      `/apps/web/src/features/document-editor/assumptions-flow/hooks/use-assumptions-flow.ts`
      to process streaming payloads, resequence out-of-order events, manage
      defer/resume transitions, and dispatch ARIA notifications.
- [x] T030 [P] [US2] Refresh
      `/apps/web/src/features/document-editor/assumptions-flow/components/assumptions-checklist.tsx`
      to render progress bullets, highlight open risks, show status chips, and
      surface resequencing notices when applicable.
- [x] T031 [P] [US2] Extend telemetry client events in
      `/apps/web/src/lib/telemetry/client-events.ts` and
      `/apps/web/src/lib/telemetry/client-events.test.ts` to capture assumption
      streaming metrics, defer outcomes, cancel reasons, and out-of-order
      correction signals.

**Checkpoint**: Assumption loop shows continuous progress, handles deferrals and
cancels correctly, and records telemetry.

---

## Phase 5: User Story 3 - Graceful Fallback Delivery (Priority: P3)

**Goal**: Provide parity when streaming is blocked—announce fallback, maintain
elapsed time, and deliver identical content with metadata.

**Independent Test**: Disable streaming, request co-author and document QA
support, confirm fallback announcement, deterministic progress, and parity of
final responses plus transcript metadata.

### Tests for User Story 3 (write first, ensure they fail)

- [x] T032 [US3] Expand
      `/apps/api/src/services/co-authoring/ai-proposal.service.test.ts` with
      fallback scenarios asserting preserved tokens, rationale parity, cancel
      interactions, and telemetry.
- [x] T033 [P] [US3] Add failing UI test in
      `/apps/web/src/lib/streaming/fallback-messages.test.ts` verifying
      deterministic progress copy, elapsed timers, cancel/fallback messaging,
      and accessibility cues.

### Implementation for User Story 3

- [x] T034 [US3] Implement fallback orchestration in
      `/apps/api/src/services/co-authoring/ai-proposal.service.ts`, ensuring
      preserved tokens, retry attempts, and final delivery metadata populate
      telemetry (including cancel interactions leading to fallback).
- [x] T035 [P] [US3] Update `/apps/api/src/routes/co-authoring.ts` and
      `/apps/api/src/routes/document-qa.ts` to expose fallback status over
      REST/SSE with identical rationale, confidence, and citation payloads.
- [x] T036 [P] [US3] Enhance
      `/apps/web/src/features/document-editor/components/co-authoring/SessionProgress.tsx`
      and
      `/apps/web/src/features/document-editor/components/document-qa/DocumentQaPanel.tsx`
      to surface fallback banners, deterministic progress indicators, and
      transcript parity messages.
- [x] T037 [P] [US3] Extend `/apps/web/src/lib/streaming/fallback-messages.ts`
      (and tests) to generate accessible copy mirroring streaming metadata for
      co-authoring, document QA, and assumptions.
- [x] T038 [P] [US3] Ensure fallback handling propagates through assumptions by
      updating
      `/apps/web/src/features/document-editor/assumptions-flow/hooks/use-assumptions-flow.ts`
      and
      `/apps/web/src/features/document-editor/assumptions-flow/components/assumptions-checklist.tsx`.
- [x] T039 [P] [US3] Log fallback telemetry in
      `/apps/web/src/lib/telemetry/client-events.ts` and
      `/apps/api/src/middleware/ai-request-audit.ts`, capturing root causes,
      preserved tokens, cancel reasons, and retry attempts across all
      interaction modes.

**Checkpoint**: Fallback path mirrors streaming experience with complete
telemetry, accessible guidance, and cancel/fallback parity.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Finalize documentation, validation, and cross-story consistency.

- [x] T040 [Polish] Update `/specs/012-epic-2-story-7/quickstart.md` with
      verified local validation steps covering co-authoring, document QA,
      assumptions, and fallback toggles.
- [x] T041 [Polish] Run full quality gates (`pnpm lint`, `pnpm typecheck`,
      `pnpm test`, `pnpm --filter @ctrl-freaq/web test:e2e:quick`) from
      repository root `/` and capture results for the implementation report.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)** → prerequisite for all remaining work.
- **Foundational (Phase 2)** → depends on Setup; blocks every user story until
  shared types and queue utilities (with cancel support) exist.
- **User Stories (Phases 3–5)** → each depends on Foundational completion;
  execute in priority order (P1 → P2 → P3) or in parallel once blockers clear.
- **Polish (Phase 6)** → runs after desired user stories are complete.

### User Story Dependencies

- **US1 (P1)** → first deliverable; no dependency on other stories.
- **US2 (P2)** → depends on queue utilities from Foundational but not on US1
  output; can start once Phase 2 is done.
- **US3 (P3)** → builds on API structures touched in US1; recommended to start
  after US1 to reuse updated co-author and document QA services.

### Within Each User Story

- Tests (T008–T011, T025–T026, T032–T033) must be written and failing before
  implementation tasks.
- API updates precede UI wiring for the same feature to keep contract stability.
- Telemetry updates occur after core functionality adjustments within each
  story.

---

## Parallel Execution Opportunities

- After Phase 2, US1 API work (T012, T019) and front-end work (T015–T023) can
  proceed in parallel once SSE payload formats are finalized.
- In US2, tasks T027 (API) and T029/T030 (web) can run concurrently with T028
  and T031 covering routing and telemetry.
- In US3, UI enhancements T036–T038 can progress independently from API updates
  T034–T035, provided fallback payload shapes are stubs.

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phases 1–2.
2. Deliver US1 (T008–T024), validate co-authoring/document QA streaming latency,
   cancel/retry, and telemetry.
3. Demo MVP to stakeholders before proceeding.

### Incremental Delivery

1. After MVP, implement US2 (T025–T031) to enrich assumption workflows.
2. Finish with US3 (T032–T039) for fallback parity across all modes.
3. Polish tasks (T040–T041) close out the feature.

### Parallel Team Strategy

- Developer A: Focus on API tasks (T012, T019, T027, T034) sequentially.
- Developer B: Handle web stores/hooks (T015, T021, T029, T038).
- Developer C: Own UI components and telemetry (T017, T023, T030, T036, T039).
- All developers share responsibility for test-first tasks and checkpoints.

---

## Assumption Log

- Assumption: Queue manager utilities in
  `/packages/editor-core/src/streaming/section-stream-queue.ts` serve
  co-authoring, document QA, and assumptions to satisfy FR-009 and cancel/retry
  consistency.  
  Rationale: Centralizing concurrency logic avoids divergent implementations and
  ensures telemetry parity.
- Assumption: Document QA streaming shares the co-authoring contract
  shape—service methods (`startReview`, `cancelReview`, `retryReview`) return
  queue metadata, and the UI hook exposes progress stage labels, replacement
  notices, cancel/retry status, and editing-lock flags.  
  Rationale: Tasks T010–T011 call for parity across interaction modes; mirroring
  co-authoring APIs keeps tests and UI expectations aligned while the dedicated
  QA modules are implemented.
- [ASSUMPTION] Document QA reviews can derive a default prompt from the current
  document and section identifiers when the UI does not supply custom copy.  
  Rationale: The specification does not define a reviewer prompt input; using a
  deterministic default keeps the API contract satisfied until a dedicated QA
  prompt surface ships.

---

## Phase 4.R: Review Follow-Up

- [x] F004 Finding F004: Cross-mode streaming queue gap allows overlapping
      sessions per section—share a single `SectionStreamQueue` (or coordinator)
      across co-authoring, document QA, and assumption flows, update assumption
      streaming to participate in the queue, and attach cross-mode serialization
      tests as outlined in `audit.md`.
- [x] F005 Finding F005: TypeScript status narrowing breaks builds and
      tests—`AssumptionStreamController.emitStatus` now defends against unknown
      statuses via `isAssumptionStatus`, keeping `pnpm typecheck`/`pnpm test`
      green (see audit.md, 2025-10-12).
- [x] F006 Finding F006: Document QA streaming omits transcript content—emit
      actual token updates (and fallback parity) from
      `DocumentQaStreamingService` so the QA panel surfaces guidance, verified
      in audit.md (2025-10-13).

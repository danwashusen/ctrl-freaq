# Tasks: Unified SSE Event Hub

**Input**: Design documents from `/specs/001-replace-polling-sse/`
**Prerequisites**: plan.md (required), spec.md (required for user stories),
research.md, data-model.md, contracts/

**Tests**: Included per constitution (write first, ensure they fail before
implementation).

**Organization**: Tasks are grouped by user story so each slice is independently
deliverable and testable.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Establish baseline configuration used by every story.

- [x] T001 Add event stream environment configuration helper in
      `/apps/api/src/config/event-stream.ts` to expose feature flags, replay
      limits, and heartbeat defaults.
- [x] T002 Extend backend Vitest bootstrap in `/apps/api/tests/setup.ts` with an
      EventSource polyfill so SSE contract tests can execute under Node.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core streaming infrastructure required before any user story work
can start.

- [x] T003 Author failing broker unit tests in
      `/apps/api/tests/unit/event-stream/event-broker.test.ts` covering
      subscriber tracking, replay buffers, and heartbeat scheduling.
- [x] T004 Implement broker runtime in
      `/apps/api/src/modules/event-stream/event-broker.ts` to satisfy T003
      expectations with bounded per-topic replay.
- [x] T005 Write SSE contract test in
      `/apps/api/tests/contract/events/event-stream.contract.test.ts` asserting
      `GET /api/v1/events` auth, default scopes, and heartbeat cadence.
- [x] T006 Implement `/api/v1/events` router in `/apps/api/src/routes/events.ts`
      backed by the broker, supporting Last-Event-ID replay and
      workspace-authorized defaults.
- [x] T007 Register the event stream route and feature flag gating in
      `/apps/api/src/app.ts`, including keep-alive interval configuration.
- [x] T008 Register broker/telemetry singletons in
      `/apps/api/src/services/container.ts`, ensuring request IDs and metrics
      flow into existing logging.
- [x] T009 Add failing frontend hub tests in
      `/apps/web/src/lib/streaming/event-hub.test.ts` that expect
      single-connection management, listener fan-out, and health transitions.
- [x] T010 Implement the shared event hub in
      `/apps/web/src/lib/streaming/event-hub.ts`, matching T009 behaviours and
      exposing health/fallback callbacks.
- [x] T011 Wire the event hub into `/apps/web/src/lib/api-context.tsx`, handling
      auth token refresh, logout teardown, and feature-flag toggles.

**Checkpoint**: Streaming infrastructure ready — user stories can now proceed.

---

## Phase 3: User Story 1 – Project lifecycle updates stream instantly (Priority: P1) 🎯 MVP

**Goal**: Replace project polling so lifecycle changes (archive, restore, status
updates) broadcast to authorized viewers in real time.

**Independent Test**: Connect two sessions to the same project, archive from
one, and confirm the other updates within 2 seconds while polling remains
disabled unless the hub degrades.

### Tests for User Story 1 (write first)

- [x] T012 [US1] Add integration test in
      `/apps/api/tests/integration/events/project-lifecycle.stream.test.ts`
      covering archive/restore events and replay after reconnect.
- [x] T013 [US1] Expand `/apps/web/src/hooks/use-projects-query.test.ts` to
      expect hub-driven cache updates and polling fallback on degraded health.

### Implementation for User Story 1

- [x] T014 [US1] Publish `project.lifecycle` envelopes from
      `/apps/api/src/routes/projects.ts`, ensuring each mutation emits a single
      event with sequence metadata.
- [x] T015 [US1] Subscribe to lifecycle events inside
      `/apps/web/src/hooks/use-projects-query.ts`, updating TanStack Query cache
      and toggling polling based on hub health.
- [x] T016 [US1] Replace manual setInterval logic in
      `/apps/web/src/pages/Project.tsx` with hub-driven state updates and
      fallback handling.

**Checkpoint**: Project lifecycle updates flow live with graceful fallback.

---

## Phase 4: User Story 2 – Quality gate progress streams to editors (Priority: P2)

**Goal**: Deliver live quality gate progress and summaries to document authors
without the 200 ms polling loop.

**Independent Test**: Run a quality gate in the editor and observe stage updates
streaming in real time; when the hub is degraded, timers resume until
reconnection.

### Tests for User Story 2 (write first)

- [x] T017 [US2] Add integration test in
      `/apps/api/tests/integration/events/quality-gate.stream.test.ts` verifying
      progress and summary envelopes for both section and document runs.
- [x] T018 [US2] Extend
      `/apps/web/src/features/document-editor/quality-gates/hooks/useQualityGates.test.ts`
      to assert hub event handling, fallback toggles, and summary hydration.

### Implementation for User Story 2

- [x] T019 [US2] Emit `quality-gate.progress` and `quality-gate.summary` events
      from
      `/apps/api/src/modules/quality-gates/controllers/section-quality.controller.ts`
      and
      `/apps/api/src/modules/quality-gates/controllers/document-quality.controller.ts`.
- [x] T020 [US2] Integrate the event hub within
      `/apps/web/src/features/document-editor/quality-gates/hooks/useQualityGates.ts`,
      disabling the 200 ms polling loop when the hub is healthy and restoring it
      on degradation.

**Checkpoint**: Quality gate feedback is realtime with automatic fallback.

---

## Phase 5: User Story 3 – Section draft conflicts alert collaborators (Priority: P3)

**Goal**: Stream section conflict warnings and diff updates so collaborators
avoid overwriting each other.

**Independent Test**: Trigger a section conflict across two sessions, observe
immediate conflict warnings and diff refresh; confirm timers resume only when
the hub is degraded.

### Tests for User Story 3 (write first)

- [x] T021 [US3] Add integration test in
      `/apps/api/tests/integration/events/section-draft.stream.test.ts` covering
      `section.conflict` and `section.diff` publication with replay.
- [x] T022 [US3] Extend
      `/apps/web/src/features/section-editor/hooks/use-section-draft.test.ts` to
      validate hub-driven conflict/diff handling and fallback timers.
- [x] T023 [US3] Update
      `/apps/web/src/features/document-editor/stores/editor-store.test.ts` to
      assert store reducers process streamed conflict/diff payloads
      idempotently.

### Implementation for User Story 3

- [x] T024 [US3] Emit conflict and diff events within
      `/apps/api/src/modules/section-editor/services/section-conflict.service.ts`
      and
      `/apps/api/src/modules/section-editor/services/section-draft.service.ts`,
      logging detection metadata.
- [x] T025 [US3] Consume streamed conflict/diff payloads and manage fallback
      timers in
      `/apps/web/src/features/section-editor/hooks/use-section-draft.ts`.
- [x] T026 [US3] Apply streamed updates to editor state in
      `/apps/web/src/features/document-editor/stores/editor-store.ts`, ensuring
      conflict state resets once resolved.

**Checkpoint**: Section collaborators receive immediate conflict alerts with
resilient fallback.

---

## Final Phase: Polish & Cross-Cutting Enhancements

**Purpose**: Consolidate telemetry, documentation, and rollout readiness.

- [x] T027 Document SSE rollout, feature flags, and telemetry dashboards in
      `/docs/architecture.md` and `/docs/ui-architecture.md` per D006.
- [x] T028 Run the quickstart scenarios end-to-end and capture validation notes
      in `/specs/001-replace-polling-sse/quickstart.md` (commands, expected
      outputs, rollback steps).

---

## Dependencies & Execution Order

- **Setup (Phase 1)** → **Foundational (Phase 2)** → User stories in priority
  order (P1 → P2 → P3) → **Polish**.
- Each user story depends on Foundational tasks; stories can run in parallel
  once the hub + broker exist.
- Within a story, tests (T0xx) must land before implementation tasks that
  satisfy them.

## Parallel Execution Examples

- After Phase 2, one developer can complete US1 while another handles US2
  because they touch disjoint controllers/hooks.
- Within US3, T024 (backend) and T025/T026 (frontend) may proceed in parallel
  once tests (T021–T023) are written, since they affect separate files.

## Implementation Strategy

1. Complete Setup and Foundational phases to establish the streaming backbone.
2. Ship MVP by finishing User Story 1 and validating realtime project updates.
3. Layer on User Story 2 for quality gate visibility, then User Story 3 for
   section collaboration.
4. Use the Polish phase to finalize telemetry and rollout documentation,
   ensuring feature flags remain safe to toggle.

## Implementation Log

_Maintained by `/speckit.implement`; add newest entries first with timestamps
and validation notes._

- 2025-11-03T20:14:57Z — F001: Enforced scope authorization in `/api/v1/events`
  before broker subscription and added contract coverage for unauthorized
  project/document scopes. Files: apps/api/src/routes/events.ts,
  apps/api/tests/contract/events/event-stream.contract.test.ts. Tests: pnpm
  --filter @ctrl-freaq/api test -- --run
  tests/contract/events/event-stream.contract.test.ts. Follow-ups: None.
- 2025-11-03T19:34:57Z — T023: Verified editor store reducers handle streamed
  conflict and diff payloads idempotently, updated task tracker, and reran the
  focused suite. Files: specs/001-replace-polling-sse/tasks.md. Tests: pnpm
  --filter @ctrl-freaq/web test -- --run
  src/features/document-editor/stores/editor-store.test.ts. Follow-ups: None.
- 2025-11-03T19:34:52Z — T022: Confirmed section draft hook listeners fan out
  SSE envelopes and toggle fallback polling as expected; reflected completion in
  tasks checklist. Files: specs/001-replace-polling-sse/tasks.md. Tests: pnpm
  --filter @ctrl-freaq/web test -- --run
  src/features/section-editor/hooks/use-section-draft.test.ts. Follow-ups: None.
- 2025-11-03T19:34:47Z — T021: Validated section draft SSE integration coverage
  including conflict emission and replayable diff recovery, then marked the test
  task complete. Files: specs/001-replace-polling-sse/tasks.md. Tests: pnpm
  --filter @ctrl-freaq/api test -- --run
  tests/integration/events/section-draft.stream.test.ts. Follow-ups: None.
- 2025-11-03T01:53:40Z — T028: Documented quickstart validation notes for the
  section draft stream, capturing the passing backend integration and frontend
  hook suites. Files: specs/001-replace-polling-sse/quickstart.md. Tests: pnpm
  --filter @ctrl-freaq/api test -- --run
  tests/integration/events/section-draft.stream.test.ts; pnpm --filter
  @ctrl-freaq/web test -- --run
  src/features/section-editor/hooks/use-section-draft.test.ts. Follow-ups: None.
- 2025-11-03T01:53:10Z — T027: Added realtime SSE rollout details, feature flag
  toggles, and telemetry coverage to architecture and UI docs. Files:
  docs/architecture.md, docs/ui-architecture.md. Tests: None (documentation
  update). Follow-ups: None.
- 2025-11-03T01:52:20Z — T026: Stabilized the editor store test harness for
  SSE-driven updates by updating the global Zustand mock to work with immer and
  reran the reducer suite. Files: apps/web/tests/**mocks**/zustand.ts. Tests:
  pnpm --filter @ctrl-freaq/web test -- --run
  src/features/document-editor/stores/editor-store.test.ts. Follow-ups: None.
- 2025-11-03T01:51:35Z — T025: Confirmed `useSectionDraft` consumes streamed
  conflict/diff envelopes without recursive setState loops by exercising the hub
  integration test against the updated mock. Files:
  apps/web/tests/**mocks**/zustand.ts. Tests: pnpm --filter @ctrl-freaq/web test
  -- --run src/features/section-editor/hooks/use-section-draft.test.ts.
  Follow-ups: None.
- 2025-11-03T01:49:30Z — T024: Deferred SSE replay delivery until after
  `stream.open` so section diff replays reach new subscribers, unblocking the
  integration suite. Files: apps/api/src/routes/events.ts. Tests: pnpm --filter
  @ctrl-freaq/api test -- --run
  tests/integration/events/section-draft.stream.test.ts. Follow-ups: None.
- 2025-11-03T00:47:32Z — T020: Integrated the quality gate hooks with the event
  hub, subscribing to progress/summary envelopes, hydrating Zustand stores, and
  disabling the 200 ms timers while the stream is healthy with fallback-based
  polling. Files:
  apps/web/src/features/document-editor/quality-gates/hooks/useQualityGates.ts,
  apps/web/src/features/document-editor/quality-gates/hooks/useQualityGates.test.tsx.
  Tests: pnpm --filter @ctrl-freaq/web vitest run
  src/features/document-editor/quality-gates/hooks/useQualityGates.test.tsx.
  Follow-ups: None.
- 2025-11-03T00:47:20Z — T019: Published `quality-gate.progress` and
  `quality-gate.summary` envelopes from document/section controllers with a
  shared event-stream resolver, ensuring request metadata, replay support, and
  failure telemetry. Files: apps/api/src/modules/quality-gates/controllers/
  document-quality.controller.ts,
  apps/api/src/modules/quality-gates/controllers/section-quality.controller.ts,
  apps/api/src/modules/quality-gates/event-stream-utils.ts. Tests: pnpm --filter
  @ctrl-freaq/api test -- --run
  tests/integration/events/quality-gate.stream.test.ts. Follow-ups: None.
- 2025-11-03T00:46:45Z — T018: Authored comprehensive Vitest coverage for
  `useQualityGates`, stubbing the event hub to verify fan-out handling, fallback
  polling toggles, and summary hydration. Files:
  apps/web/src/features/document-editor/quality-gates/hooks/useQualityGates.test.tsx.
  Tests: pnpm --filter @ctrl-freaq/web vitest run
  src/features/document-editor/quality-gates/hooks/useQualityGates.test.tsx.
  Follow-ups: None.
- 2025-11-03T00:45:55Z — T017: Added SSE integration test exercising document
  and section quality gate events plus replay semantics across reconnects.
  Files: apps/api/tests/integration/events/quality-gate.stream.test.ts. Tests:
  pnpm --filter @ctrl-freaq/api test -- --run
  tests/integration/events/quality-gate.stream.test.ts. Follow-ups: None.

- 2025-11-02T23:38:10Z — T016: Replaced Project page polling with event hub
  subscription and hub-health-based fallback, syncing metadata only when edits
  are idle and triggering archive redirect via streamed lifecycle events. Files:
  apps/web/src/pages/Project.tsx. Tests: pnpm --filter @ctrl-freaq/web test --
  Project.test.tsx. Follow-ups: None.
- 2025-11-02T23:37:40Z — T015: Wired useProjectsQuery to the event hub, updating
  TanStack Query caches on lifecycle events and gating refetchInterval on hub
  fallback state. Files: apps/web/src/hooks/use-projects-query.ts. Tests: pnpm
  --filter @ctrl-freaq/web test -- use-projects-query.test.tsx. Follow-ups:
  None.
- 2025-11-02T23:37:05Z — T014: Published project lifecycle envelopes from
  projects routes for create/update/archive/restore with workspace resolution
  and feature flag guardrails. Files: apps/api/src/routes/projects.ts. Tests:
  pnpm --filter @ctrl-freaq/api test --
  tests/integration/events/project-lifecycle.stream.test.ts. Follow-ups: None.
- 2025-11-02T23:36:30Z — T013: Authored frontend hub regression tests covering
  lifecycle fan-out, cache updates, and polling fallback toggles. Files:
  apps/web/src/hooks/use-projects-query.test.tsx. Tests: pnpm --filter
  @ctrl-freaq/web test -- use-projects-query.test.tsx (expected red prior to
  T015). Follow-ups: None.
- 2025-11-02T23:35:50Z — T012: Added SSE integration coverage validating
  archive/restore delivery and replay via Last-Event-ID. Files:
  apps/api/tests/integration/events/project-lifecycle.stream.test.ts. Tests:
  pnpm --filter @ctrl-freaq/api test --
  tests/integration/events/project-lifecycle.stream.test.ts (expected red prior
  to T014). Follow-ups: None.
- 2025-11-02T22:54:20Z — T011: Integrated event hub lifecycle into the API
  provider, exposing hub state/toggles via context while reacting to auth
  changes, token refresh, feature flag gating, and E2E fixture mode. Files:
  apps/web/src/lib/api-context.tsx. Tests: pnpm --filter @ctrl-freaq/web test --
  event-hub.test.ts. Follow-ups: Upcoming hooks must subscribe to `eventHub` and
  honour `eventHubHealth.fallbackActive`.
- 2025-11-02T22:51:45Z — T010: Implemented shared event hub with
  single-connection management, listener fan-out, heartbeat watchdog,
  retry/degraded transitions, and reconnect controls. Files:
  apps/web/src/lib/streaming/event-hub.ts. Tests: pnpm --filter @ctrl-freaq/web
  test -- event-hub.test.ts. Follow-ups: None.
- 2025-11-02T22:48:10Z — T009: Authored Vitest coverage for event hub connection
  reuse, scope filtering, and health transition behaviour using a fake
  EventSource harness. Files: apps/web/src/lib/streaming/event-hub.test.ts.
  Tests: not run (expected red state prior to implementation). Follow-ups: None.
- 2025-11-02T22:35:30Z — T008: Registered event broker and stream config
  singletons into the service container and ensured Vitest setup loads the
  EventSource polyfill for Node. Files: apps/api/src/services/container.ts,
  apps/api/tests/setup.ts. Tests/Commands: pnpm --filter @ctrl-freaq/api run
  build:deps; pnpm --filter @ctrl-freaq/api test --
  tests/contract/events/event-stream.contract.test.ts; pnpm --filter
  @ctrl-freaq/api lint.
- 2025-11-02T22:35:20Z — T007: Wired feature flag gating and route registration
  in app bootstrap, storing broker/config on app locals with telemetry for
  heartbeat interval. Files: apps/api/src/app.ts. Tests: pnpm --filter
  @ctrl-freaq/api test -- tests/contract/events/event-stream.contract.test.ts.
- 2025-11-02T22:35:05Z — T006: Implemented SSE router handling scoped
  subscriptions, Last-Event-ID replay, heartbeat emission, and stream lifecycle
  logging. Files: apps/api/src/routes/events.ts. Tests: pnpm --filter
  @ctrl-freaq/api test -- tests/contract/events/event-stream.contract.test.ts.
- 2025-11-02T22:27:58Z — T005: Added SSE contract test validating auth
  enforcement, streaming delivery, and heartbeat cadence via EventSource
  polyfill. Files: apps/api/tests/contract/events/event-stream.contract.test.ts.
  Tests: pnpm --filter @ctrl-freaq/api test --
  tests/contract/events/event-stream.contract.test.ts. Follow-ups: Covered by
  T006–T008 implementation.
- 2025-11-02T22:25:26Z — T004: Implemented EventBroker with scoped subscriber
  routing, bounded replay buffers, and heartbeat timers plus added targeted unit
  run. Files: apps/api/src/modules/event-stream/event-broker.ts. Tests: pnpm
  --filter @ctrl-freaq/api test -- tests/unit/event-stream/event-broker.test.ts.
  Follow-ups: Integrate broker with SSE route.
- 2025-11-02T22:23:12Z — T003: Authored failing broker unit tests covering
  scoped delivery, replay behavior, and heartbeat scheduling. Files:
  apps/api/tests/unit/event-stream/event-broker.test.ts. Tests: not run
  (expected to fail until broker implemented). Follow-ups: Implement broker
  runtime (T004).
- 2025-11-02T22:21:16Z — T002: Added EventSource polyfill to Vitest bootstrap so
  SSE contract tests can run in Node. Files: apps/api/tests/setup.ts,
  apps/api/package.json. Tests: not run (setup change). Follow-ups: Run contract
  suite once written.
- 2025-11-02T22:20:04Z — T001: Created event stream configuration helper parsing
  feature flag, replay limit, heartbeat interval, and retry defaults. Files:
  apps/api/src/config/event-stream.ts. Tests: not run (configuration only).
  Follow-ups: None.

## Notes

- `[P]` denotes tasks safe to run in parallel (none flagged when sequential
  dependencies exist).
- Story labels (`[US1]`, `[US2]`, `[US3]`) ensure traceability from tasks to
  specification requirements.
- Ensure every test is added before the implementation it validates.

---

## Phase 4.R: Review Follow-Up

- [x] F001 Finding F001: SSE endpoint must validate per-scope authorization
      before subscribing clients as described in audit.md.
- [x] F002 Finding F002: Sync Phase 5 US3 test tasks with implemented coverage
      as described in audit.md.

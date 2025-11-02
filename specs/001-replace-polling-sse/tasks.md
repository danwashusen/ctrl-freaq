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

- [ ] T001 Add event stream environment configuration helper in
      `/apps/api/src/config/event-stream.ts` to expose feature flags, replay
      limits, and heartbeat defaults.
- [ ] T002 Extend backend Vitest bootstrap in `/apps/api/tests/setup.ts` with an
      EventSource polyfill so SSE contract tests can execute under Node.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core streaming infrastructure required before any user story work
can start.

- [ ] T003 Author failing broker unit tests in
      `/apps/api/tests/unit/event-stream/event-broker.test.ts` covering
      subscriber tracking, replay buffers, and heartbeat scheduling.
- [ ] T004 Implement broker runtime in
      `/apps/api/src/modules/event-stream/event-broker.ts` to satisfy T003
      expectations with bounded per-topic replay.
- [ ] T005 Write SSE contract test in
      `/apps/api/tests/contract/events/event-stream.contract.test.ts` asserting
      `GET /api/v1/events` auth, default scopes, and heartbeat cadence.
- [ ] T006 Implement `/api/v1/events` router in `/apps/api/src/routes/events.ts`
      backed by the broker, supporting Last-Event-ID replay and
      workspace-authorized defaults.
- [ ] T007 Register the event stream route and feature flag gating in
      `/apps/api/src/app.ts`, including keep-alive interval configuration.
- [ ] T008 Register broker/telemetry singletons in
      `/apps/api/src/services/container.ts`, ensuring request IDs and metrics
      flow into existing logging.
- [ ] T009 Add failing frontend hub tests in
      `/apps/web/src/lib/streaming/event-hub.test.ts` that expect
      single-connection management, listener fan-out, and health transitions.
- [ ] T010 Implement the shared event hub in
      `/apps/web/src/lib/streaming/event-hub.ts`, matching T009 behaviours and
      exposing health/fallback callbacks.
- [ ] T011 Wire the event hub into `/apps/web/src/lib/api-context.tsx`, handling
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

- [ ] T012 [US1] Add integration test in
      `/apps/api/tests/integration/events/project-lifecycle.stream.test.ts`
      covering archive/restore events and replay after reconnect.
- [ ] T013 [US1] Expand `/apps/web/src/hooks/use-projects-query.test.ts` to
      expect hub-driven cache updates and polling fallback on degraded health.

### Implementation for User Story 1

- [ ] T014 [US1] Publish `project.lifecycle` envelopes from
      `/apps/api/src/routes/projects.ts`, ensuring each mutation emits a single
      event with sequence metadata.
- [ ] T015 [US1] Subscribe to lifecycle events inside
      `/apps/web/src/hooks/use-projects-query.ts`, updating TanStack Query cache
      and toggling polling based on hub health.
- [ ] T016 [US1] Replace manual setInterval logic in
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

- [ ] T017 [US2] Add integration test in
      `/apps/api/tests/integration/events/quality-gate.stream.test.ts` verifying
      progress and summary envelopes for both section and document runs.
- [ ] T018 [US2] Extend
      `/apps/web/src/features/document-editor/quality-gates/hooks/useQualityGates.test.ts`
      to assert hub event handling, fallback toggles, and summary hydration.

### Implementation for User Story 2

- [ ] T019 [US2] Emit `quality-gate.progress` and `quality-gate.summary` events
      from
      `/apps/api/src/modules/quality-gates/controllers/section-quality.controller.ts`
      and
      `/apps/api/src/modules/quality-gates/controllers/document-quality.controller.ts`.
- [ ] T020 [US2] Integrate the event hub within
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

- [ ] T021 [US3] Add integration test in
      `/apps/api/tests/integration/events/section-draft.stream.test.ts` covering
      `section.conflict` and `section.diff` publication with replay.
- [ ] T022 [US3] Extend
      `/apps/web/src/features/section-editor/hooks/use-section-draft.test.ts` to
      validate hub-driven conflict/diff handling and fallback timers.
- [ ] T023 [US3] Update
      `/apps/web/src/features/document-editor/stores/editor-store.test.ts` to
      assert store reducers process streamed conflict/diff payloads
      idempotently.

### Implementation for User Story 3

- [ ] T024 [US3] Emit conflict and diff events within
      `/apps/api/src/modules/section-editor/services/section-conflict.service.ts`
      and
      `/apps/api/src/modules/section-editor/services/section-draft.service.ts`,
      logging detection metadata.
- [ ] T025 [US3] Consume streamed conflict/diff payloads and manage fallback
      timers in
      `/apps/web/src/features/section-editor/hooks/use-section-draft.ts`.
- [ ] T026 [US3] Apply streamed updates to editor state in
      `/apps/web/src/features/document-editor/stores/editor-store.ts`, ensuring
      conflict state resets once resolved.

**Checkpoint**: Section collaborators receive immediate conflict alerts with
resilient fallback.

---

## Final Phase: Polish & Cross-Cutting Enhancements

**Purpose**: Consolidate telemetry, documentation, and rollout readiness.

- [ ] T027 Document SSE rollout, feature flags, and telemetry dashboards in
      `/docs/architecture.md` and `/docs/ui-architecture.md` per D006.
- [ ] T028 Run the quickstart scenarios end-to-end and capture validation notes
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

## Notes

- `[P]` denotes tasks safe to run in parallel (none flagged when sequential
  dependencies exist).
- Story labels (`[US1]`, `[US2]`, `[US3]`) ensure traceability from tasks to
  specification requirements.
- Ensure every test is added before the implementation it validates.

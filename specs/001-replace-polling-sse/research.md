# Research: Unified SSE Event Hub

**Date**: 2025-11-03  
**Spec**: [spec.md](/specs/001-replace-polling-sse/spec.md)  
**Branch**: `001-replace-polling-sse`

## Decisions

### D001 – Single authenticated `/api/v1/events` SSE endpoint

- **Decision**: Expose one long-lived `GET /api/v1/events` stream guarded by
  existing Clerk/simple auth middleware so every user maintains a single
  connection per tab.
- **Rationale**: Matches spec goal of a unified channel, simplifies client
  fan-out, reuses current auth stack, and avoids managing multiple EventSource
  lifecycles.
- **Alternatives considered**: Dedicated endpoints per topic (rejected:
  multiplies connections, wastes resources); upgrade to WebSockets (rejected:
  explicit non-goal, adds infra overhead).

### D002 – Workspace-authorized default scopes with optional filters

- **Decision**: When clients omit query scopes, subscribe them to every
  topic/resource they are authorized to access within the active workspace;
  optional `projectId`, `documentId`, and `sectionId` parameters further narrow
  deliveries.
- **Rationale**: Ensures immediate coverage for dashboard/editor surfaces
  without additional requests while letting callers trim noise; aligns with
  clarification recorded in spec.
- **Alternatives considered**: Require explicit scopes (rejected: forces extra
  calls, breaks out-of-the-box updates); stream only active view (rejected:
  brittle tab-level state, complicates background updates).

### D003 – In-memory broker with per-topic replay buffers

- **Decision**: Implement an in-memory event broker that tracks subscribers by
  `topic` and `resourceId`, assigns monotonically increasing `sequence` numbers,
  and holds a bounded per-topic replay window for `Last-Event-ID` recovery.
- **Rationale**: Keeps latency low, avoids premature persistent queue
  investment, and supports fast reconnect semantics mandated by spec.
- **Alternatives considered**: Use Redis/pub-sub immediately (deferred: added
  ops burden); broadcast directly from services without broker (rejected: no
  replay or fan-out coordination).

### D004 – Standardized event envelope schema

- **Decision**: Emit envelopes containing `topic`, `resourceId`, `payload`,
  `sequence`, `emittedAt`, plus optional metadata for snapshots/heartbeat
  markers so frontend hub can demultiplex generically.
- **Rationale**: Provides a predictable contract for every producer, aligns with
  spec FR-004, and simplifies client routing regardless of event origin.
- **Alternatives considered**: Topic-specific payload formats (rejected: forces
  per-topic parsing logic); embed JSON string in SSE `data` blindly (rejected:
  no schema guarantees or metadata).

### D005 – Shared frontend event hub with health-aware fallbacks

- **Decision**: Create a single event hub module in
  `apps/web/src/lib/streaming/event-hub.ts` that opens one EventSource,
  registers topic/resource listeners, exposes hub health (`healthy`,
  `recovering`, `degraded`), and toggles polling fallbacks for dependent hooks.
- **Rationale**: Centralizes reconnection logic, ensures quality gate and
  section flows reuse a consistent source of truth, and hits spec Requirement
  FR-007/FR-008.
- **Alternatives considered**: Multiple EventSource instances per hook
  (rejected: redundant connections, harder auth refresh); leave polling as
  primary (rejected: conflicts with goals).

### D006 – Telemetry and fallback instrumentation

- **Decision**: Produce structured logs/metrics for connection lifecycle,
  authorization rejects, replay usage, and fallback activations while keeping
  feature flags (`ENABLE_EVENT_STREAM`, `VITE_ENABLE_SSE_HUB`) off by default
  for staged rollout.
- **Rationale**: Supports Success Criteria SC-004, gives operations clear
  insight into stream health, and enables safe rollout sequencing.
- **Alternatives considered**: Rely solely on existing request logs (rejected:
  lacks streaming visibility); immediate flag removal (rejected: rollout risk).

## Codebase Reconnaissance

### US1 – Project lifecycle updates stream instantly

| Story/Decision    | File/Directory                                                                        | Role Today                                                                              | Helpers/Configs                                                                        | Risks & Follow-up                                                                                                         | Verification Hooks                                                                        |
| ----------------- | ------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| US1 / D001 / D004 | `/apps/api/src/routes/projects.ts`                                                    | Handles project CRUD, archives, restores with activity logging but no realtime emission | Depends on `ProjectRepositoryImpl`, `ActivityLogUtils`, and service locator middleware | Need to publish lifecycle events without breaking existing responses; ensure archives trigger events once even on retries | `apps/api/tests/contract/projects-api.test.ts`, new SSE contract tests simulating archive |
| US1 / D002 / D005 | `/apps/web/src/pages/Project.tsx`                                                     | Polls project status every 1.5s to detect archive/restore                               | Utilizes `projects.getById`, React Query invalidations, local archive handler          | Polling removal must not break archive redirect logic; hub must re-enable polling on degraded health                      | `apps/web/tests/e2e/dashboard/project-archive.e2e.ts`, new hub unit tests                 |
| US1 / D005 / D006 | `/apps/web/src/hooks/use-projects-query.ts` & `/apps/web/src/stores/project-store.ts` | Provides cached project list and active project state                                   | TanStack Query keys (`PROJECTS_QUERY_KEY`), Zustand store                              | Need listener that updates cache/store on `project.lifecycle` without causing duplicate fetches                           | `apps/web/src/hooks/use-projects-query.test.ts`, add hub-driven invalidation test         |
| US1 / D006        | `/apps/api/src/app.ts` & `/apps/api/src/middleware/authentication.ts`                 | Mounts API router and auth checks                                                       | Feature flags via env, Clerk/simple auth                                               | SSE route must reuse auth middleware and respect feature flag gating                                                      | New supertest SSE auth tests                                                              |

### US2 – Quality gate progress streams to editors

| Story/Decision    | File/Directory                                                                   | Role Today                                                  | Helpers/Configs                                          | Risks & Follow-up                                                                                  | Verification Hooks                                                                                                |
| ----------------- | -------------------------------------------------------------------------------- | ----------------------------------------------------------- | -------------------------------------------------------- | -------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| US2 / D003 / D004 | `/apps/api/src/modules/quality-gates/controllers/section-quality.controller.ts`  | Exposes run/result endpoints with JSON responses only       | Uses `SectionQualityService`, telemetry logger           | Must publish progress + summary events during runs without blocking response threads               | `apps/api/tests/contract/quality-gates/sections.contract.test.ts`, new streaming test harness                     |
| US2 / D003 / D004 | `/apps/api/src/modules/quality-gates/controllers/document-quality.controller.ts` | Returns document-level run status and summary via polling   | Relies on `DocumentQualityService` and traceability sync | Need to emit `quality-gate.summary` when runs finish so editor updates stop polling                | `apps/api/tests/contract/quality-gates/document.contract.test.ts` (add cases)                                     |
| US2 / D005        | `/apps/web/src/features/document-editor/quality-gates/hooks/useQualityGates.ts`  | Polls every 200ms for run progress/results                  | TanStack Query, Zustand stores, telemetry emitters       | Removing tight polling must not regress manual fallback; integrate hub subscription + health guard | `apps/web/src/features/document-editor/quality-gates/hooks/useQualityGates.test.ts`, add mocked EventSource tests |
| US2 / D006        | `/apps/api/src/services/container.ts` (quality gate registrations)               | Configures runners, telemetry hooks, and traceability queue | Logger, traceability sync service, random UUIDs          | Introduce broker publishing with minimal coupling; ensure telemetry still logs incidents           | `apps/api/tests/unit/quality-gates/*.test.ts`, new broker unit tests                                              |

### US3 – Section draft conflicts alert collaborators

| Story/Decision    | File/Directory                                                              | Role Today                                                                   | Helpers/Configs                                       | Risks & Follow-up                                                                                 | Verification Hooks                                                                                   |
| ----------------- | --------------------------------------------------------------------------- | ---------------------------------------------------------------------------- | ----------------------------------------------------- | ------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| US3 / D003 / D004 | `/apps/api/src/modules/section-editor/services/section-conflict.service.ts` | Detects conflicts, logs events, updates drafts but no realtime notifications | Uses repositories, Zod schemas, logger                | Need to publish `section.conflict` event alongside conflict logging without duplicating DB writes | `apps/api/tests/unit/section-editor/section-conflict.service.test.ts`, new SSE unit test             |
| US3 / D003        | `/apps/api/src/modules/section-editor/services/section-draft.service.ts`    | Generates diffs, saves drafts, schedules conflict checks                     | Depends on `DraftPersistenceClient`, conflict service | Provide `section.diff` events after server-side diff generation to keep clients in sync           | `apps/api/tests/contract/section-editor/section-editor.contract.test.ts`, add streaming verification |
| US3 / D005        | `/apps/web/src/features/section-editor/hooks/use-section-draft.ts`          | Maintains draft state, polls diffs on timer                                  | Manual timers, draft store, logger                    | Replace or gate diff polling via hub health; ensure manual save still triggers conflict handling  | `apps/web/src/features/section-editor/hooks/use-section-draft.test.ts`, add hub integration test     |
| US3 / D005 / D006 | `/apps/web/src/features/document-editor/stores/editor-store.ts`             | Updates conflict state + diff data in Zustand                                | Receives actions from hooks, emits analytics          | Must process hub events idempotently and surface fallback when hub degraded                       | `apps/web/src/features/document-editor/stores/editor-store.test.ts`, new event hub reducer test      |

### Shared Infrastructure

| Story/Decision | File/Directory                                                          | Role Today                                                 | Helpers/Configs                          | Risks & Follow-up                                                                            | Verification Hooks                                                     |
| -------------- | ----------------------------------------------------------------------- | ---------------------------------------------------------- | ---------------------------------------- | -------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| D001–D006      | `/apps/api/src/server.ts` & `/apps/api/src/routes/index.ts`             | Registers routes and middlewares                           | Feature flag config, logger, auth        | SSE route integration must not block shutdown; ensure keep-alive intervals configurable      | New supertest SSE smoke test                                           |
| D003 / D004    | `/packages/shared-data` (events not yet present)                        | Provides shared models, currently lacks event abstractions | CLI + persistence utilities              | Need to decide if event broker lives in API app or shared package; ensure no circular deps   | Consider new package or API-local module tests                         |
| D005           | `/apps/web/src/lib/api-context.tsx` & `/apps/web/src/lib/auth-provider` | Supplies API clients and auth tokens                       | Clerk/simple toggle, token refresh logic | Event hub must hook into auth refresh to restart stream; avoid leaking EventSource on logout | `apps/web/src/lib/auth-provider/index.test.tsx`, new hub teardown test |

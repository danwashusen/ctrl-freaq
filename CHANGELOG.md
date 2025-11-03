# Change Log

## 001-replace-polling-sse

> Feature scope: Unified SSE Event Hub

### Overview
Replaced short-interval polling with an authenticated Server-Sent Events hub that multiplexes project lifecycle, quality gate, and section draft topics. Delivered backend authorization, replay, and telemetry support alongside a shared frontend event hub that manages health-aware fallbacks for downstream consumers.

### Highlights
- Added `/api/v1/events` SSE endpoint backed by the new in-memory broker with scoped authorization, heartbeats, and Last-Event-ID replay (`apps/api/src/routes/events.ts`, `apps/api/src/modules/event-stream/event-broker.ts`).
- Published lifecycle, quality gate, and section draft envelopes plus telemetry wiring across controllers/services and feature flag gating (`apps/api/src/routes/projects.ts`, `apps/api/src/modules/quality-gates/event-stream-utils.ts`, `apps/api/src/app.ts`).
- Introduced shared frontend event hub with retry/fallback orchestration and integrated it into consuming hooks, stores, and pages (`apps/web/src/lib/streaming/event-hub.ts`, `apps/web/src/hooks/use-projects-query.ts`, `apps/web/src/features/document-editor/quality-gates/hooks/useQualityGates.ts`).
- Expanded contract, integration, unit, and React tests to cover authorization failures, replay recovery, and hub consumers (`apps/api/tests/contract/events/event-stream.contract.test.ts`, `apps/api/tests/integration/events/*.test.ts`, `apps/web/src/lib/streaming/event-hub.test.ts`).
- Authored full SSE dossier—spec, plan, data model, quickstart, audit, and architecture updates—plus added a worktree helper script (`specs/001-replace-polling-sse/*`, `docs/architecture.md`, `scripts/feature-branch-worktree.sh`).

### Requirement Coverage
| Requirement | Status | Evidence |
|-------------|--------|----------|
| FR-001 | ✅ | `apps/api/src/routes/events.ts`; `apps/api/tests/contract/events/event-stream.contract.test.ts` |
| FR-002 | ✅ | Scoped authorization guards in `apps/api/src/routes/events.ts`; unauthorized scope tests in `apps/api/tests/contract/events/event-stream.contract.test.ts` |
| FR-003 | ✅ | Broker implementation in `apps/api/src/modules/event-stream/event-broker.ts`; unit coverage in `apps/api/tests/unit/event-stream/event-broker.test.ts` |
| FR-004 | ✅ | Event publishers in `apps/api/src/routes/projects.ts`, `apps/api/src/modules/quality-gates/controllers/*.ts`, `apps/api/src/modules/section-editor/services/section-draft.service.ts` |
| FR-005 | ✅ | Heartbeat cadence managed in `apps/api/src/modules/event-stream/event-broker.ts` and `apps/api/src/routes/events.ts` |
| FR-006 | ✅ | Last-Event-ID replay and snapshots in `apps/api/src/modules/event-stream/event-broker.ts`; reconnection tests in `apps/api/tests/integration/events/*.test.ts` |
| FR-007 | ✅ | Shared hub in `apps/web/src/lib/streaming/event-hub.ts`; integration via `apps/web/src/lib/api-context.tsx` |
| FR-008 | ✅ | Hub consumers in `apps/web/src/hooks/use-projects-query.ts`, `apps/web/src/features/document-editor/quality-gates/hooks/useQualityGates.ts`, `apps/web/src/features/section-editor/hooks/use-section-draft.ts` |
| FR-009 | ✅ | Telemetry and fallback logging in `apps/api/src/routes/events.ts`; `apps/api/src/modules/quality-gates/event-stream-utils.ts` |
| FR-010 | ✅ | Rollout feature flags in `apps/api/src/config/event-stream.ts`, `apps/api/src/app.ts`, `apps/web/src/lib/api-context.tsx` |

### Testing
- Ran full gauntlet `pnpm test` and targeted suites (`pnpm --filter @ctrl-freaq/api test -- --run tests/contract/events/event-stream.contract.test.ts`, `pnpm --filter @ctrl-freaq/api test -- --run tests/integration/events/quality-gate.stream.test.ts`, `pnpm --filter @ctrl-freaq/web test -- --run src/features/section-editor/hooks/use-section-draft.test.ts`, `pnpm --filter @ctrl-freaq/web test -- --run src/lib/streaming/event-hub.test.ts`).

### Risks & Mitigations
- In-memory broker remains single-process; monitor new telemetry and plan a backplane before horizontal scaling, and ensure deployment images include the new `eventsource` polyfill dependency.

### Clarifications
- 2025-11-03: When scope parameters are omitted, the server streams all workspace-authorized topics by default.

### Assumption Log
- None recorded.

## 016-a-user-should-be-able

> Feature scope: Full project lifecycle management across shared-data, API, web
> UI, telemetry, and QA automation

### Overview

Implemented lifecycle-aware project CRUD so workspaces can create, inspect,
update, archive, and restore projects with concurrency guards and audit trails.
Shared-data now models lifecycle metadata with forward/backward safe migrations
and CLI parity, while the API and React dashboard coordinate TanStack Query,
state persistence, and telemetry to satisfy FR-001–FR-010. QA tooling and
documentation refreshes capture SC-001–SC-004 monitoring.

### Highlights

- Expanded lifecycle schema, migrations, and CLI helpers in
  `/Users/danwas/Development/Projects/ctrl-freaq/packages/shared-data/src/models/project.ts`,
  `/Users/danwas/Development/Projects/ctrl-freaq/packages/shared-data/src/cli.ts`,
  and
  `/Users/danwas/Development/Projects/ctrl-freaq/packages/shared-data/migrations/20251025_project_lifecycle.sql`
  to persist status, visibility, goal metadata, and archive snapshots.
- Rebuilt project API routes with validation, concurrency enforcement,
  archive/restore handlers, and structured logging in
  `/Users/danwas/Development/Projects/ctrl-freaq/apps/api/src/routes/projects.ts`,
  backed by contract and integration suites under
  `/Users/danwas/Development/Projects/ctrl-freaq/apps/api/tests`.
- Refactored the dashboard and project detail experiences to use TanStack Query,
  persisted view state, archive dialogs, and conflict messaging across
  `/Users/danwas/Development/Projects/ctrl-freaq/apps/web/src/pages/Dashboard.tsx`,
  `/Users/danwas/Development/Projects/ctrl-freaq/apps/web/src/pages/Project.tsx`,
  and
  `/Users/danwas/Development/Projects/ctrl-freaq/apps/web/src/hooks/use-projects-query.ts`.
- Instrumented lifecycle telemetry and QA sampling with
  `/Users/danwas/Development/Projects/ctrl-freaq/apps/web/src/lib/telemetry/client-events.ts`
  and `/Users/danwas/Development/Projects/ctrl-freaq/packages/qa/src/cli.ts`,
  enabling SC-001–SC-004 monitoring.

### Requirement Coverage

| Requirement | Status | Evidence                                                                                                                                                                                                                                                                |
| ----------- | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| FR-001      | ✅     | `/Users/danwas/Development/Projects/ctrl-freaq/apps/api/src/routes/projects.ts`<br>`/Users/danwas/Development/Projects/ctrl-freaq/apps/web/tests/e2e/dashboard/project-create.e2e.ts`                                                                                   |
| FR-002      | ✅     | `/Users/danwas/Development/Projects/ctrl-freaq/apps/api/src/routes/projects.ts`<br>`/Users/danwas/Development/Projects/ctrl-freaq/apps/api/tests/contract/projects-api.test.ts`                                                                                         |
| FR-003      | ✅     | `/Users/danwas/Development/Projects/ctrl-freaq/apps/api/src/routes/projects.ts`<br>`/Users/danwas/Development/Projects/ctrl-freaq/apps/api/tests/integration/projects.logging.test.ts`                                                                                  |
| FR-004      | ✅     | `/Users/danwas/Development/Projects/ctrl-freaq/apps/web/src/pages/Dashboard.tsx`<br>`/Users/danwas/Development/Projects/ctrl-freaq/apps/web/src/pages/Dashboard.test.tsx`                                                                                               |
| FR-005      | ✅     | `/Users/danwas/Development/Projects/ctrl-freaq/apps/web/src/pages/Dashboard.tsx`<br>`/Users/danwas/Development/Projects/ctrl-freaq/apps/web/tests/e2e/dashboard/project-navigation.e2e.ts`                                                                              |
| FR-006      | ✅     | `/Users/danwas/Development/Projects/ctrl-freaq/apps/api/src/routes/projects.ts`<br>`/Users/danwas/Development/Projects/ctrl-freaq/apps/web/src/pages/Project.tsx`<br>`/Users/danwas/Development/Projects/ctrl-freaq/apps/web/tests/e2e/dashboard/project-update.e2e.ts` |
| FR-007      | ✅     | `/Users/danwas/Development/Projects/ctrl-freaq/apps/api/src/routes/projects.ts`<br>`/Users/danwas/Development/Projects/ctrl-freaq/apps/web/src/components/feedback/ProjectMutationAlerts.tsx`                                                                           |
| FR-008      | ✅     | `/Users/danwas/Development/Projects/ctrl-freaq/packages/shared-data/src/models/project.ts`<br>`/Users/danwas/Development/Projects/ctrl-freaq/apps/api/tests/integration/projects.test.ts`                                                                               |
| FR-009      | ✅     | `/Users/danwas/Development/Projects/ctrl-freaq/packages/shared-data/src/models/project.ts`<br>`/Users/danwas/Development/Projects/ctrl-freaq/apps/web/tests/e2e/dashboard/project-archive.e2e.ts`                                                                       |
| FR-010      | ✅     | `/Users/danwas/Development/Projects/ctrl-freaq/apps/api/src/routes/projects.ts`<br>`/Users/danwas/Development/Projects/ctrl-freaq/apps/api/tests/contract/projects.list.contract.test.ts`                                                                               |

### Testing

- Added shared-data lifecycle schema, migration, and CLI suites under
  `/Users/danwas/Development/Projects/ctrl-freaq/packages/shared-data/tests`.
- Expanded API contract/integration coverage for lifecycle flows, including
  logging and rate limiting, in
  `/Users/danwas/Development/Projects/ctrl-freaq/apps/api/tests`.
- Authored component and Playwright dashboards/project scenarios plus QA audit
  sampling tests in
  `/Users/danwas/Development/Projects/ctrl-freaq/apps/web/tests` and
  `/Users/danwas/Development/Projects/ctrl-freaq/packages/qa/src/audit`.

### Risks & Mitigations

- Update `/Users/danwas/Development/Projects/ctrl-freaq/docs/architecture.md` to
  reflect multi-project support and archive workflows so system docs stay
  authoritative.
- Ensure deployment environments set `RATE_LIMIT_ENFORCEMENT_MODE=reject` now
  that
  `/Users/danwas/Development/Projects/ctrl-freaq/apps/api/src/config/rate-limiting.ts`
  supports log-only mode.
- Lifecycle telemetry remains console-based
  (`/Users/danwas/Development/Projects/ctrl-freaq/apps/web/src/lib/telemetry/client-events.ts`);
  coordinate QA capture to retain SC-001/SC-002 evidence.

### Clarifications

- 2025-10-25 — Lifecycle states confirmed as Draft → Active → Paused → Completed
  → Archived.

### Assumption Log

- No additional assumptions were recorded for Story 016.

## 014-simple-auth-provider

> Feature scope: Deliver a YAML-driven simple auth provider for local
> development sign-in

### Overview

Enabled a configuration-driven simple auth provider so developers can run the
stack without Clerk while keeping production defaults untouched. The backend now
validates simple mode inputs, exposes `/auth/simple/*` endpoints, and wires
token enforcement, while the frontend presents a local user selector and warning
controls.

### Highlights

- Introduced auth-provider resolution and `SimpleAuthService` validation to gate
  `AUTH_PROVIDER`/`SIMPLE_AUTH_USER_FILE` combinations
  (`apps/api/src/config/auth-provider.ts:22`,
  `apps/api/src/services/simple-auth.service.ts:22`,
  `apps/api/src/load-env.ts:80`).
- Mounted simple auth routes, middleware, and seeding so `simple:<userId>`
  bearer tokens unlock `/api/v1` while malformed requests fail fast
  (`apps/api/src/routes/auth/simple.ts:17`,
  `apps/api/src/middleware/simple-auth.middleware.ts:147`,
  `apps/api/src/middleware/test-user-seed.ts:13`).
- Swapped the web app to a provider abstraction, accessible login screen, and
  warning banner that persist selections and feed tokens to API calls
  (`apps/web/src/lib/auth-provider/index.tsx:25`,
  `apps/web/src/lib/auth-provider/SimpleAuthProvider.tsx:135`,
  `apps/web/src/components/simple-auth/LoginScreen.tsx:49`,
  `apps/web/src/components/simple-auth/SimpleAuthWarningBanner.tsx:17`).
- Documented simple mode configuration with `.env` defaults, README
  instructions, and a reference YAML sample (`.env.example:1`, `README.md:190`,
  `docs/examples/simple-auth-users.yaml:1`).

### Requirement Coverage

| Requirement | Status | Evidence                                                                                                                                                                                  |
| ----------- | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| FR-001      | ✅     | apps/api/src/config/auth-provider.ts:22<br>apps/api/src/load-env.ts:80<br>apps/web/src/lib/auth-provider/index.tsx:25                                                                     |
| FR-002      | ✅     | apps/api/src/config/auth-provider.ts:44<br>apps/api/src/app.ts:139<br>apps/api/tests/contract/auth/simple-auth-users.contract.test.ts:68                                                  |
| FR-003      | ✅     | apps/api/src/services/simple-auth.service.ts:105<br>apps/api/tests/unit/auth/simple-auth.service.test.ts:114                                                                              |
| FR-004      | ✅     | apps/api/src/routes/auth/simple.ts:17<br>apps/api/tests/contract/auth/simple-auth-users.contract.test.ts:40                                                                               |
| FR-005      | ✅     | apps/api/src/middleware/simple-auth.middleware.ts:179<br>apps/api/tests/unit/auth/simple-auth.middleware.test.ts:95<br>apps/api/tests/integration/auth/simple-auth.integration.test.ts:47 |
| FR-006      | ✅     | apps/api/src/middleware/test-user-seed.ts:13<br>apps/api/tests/integration/auth/simple-auth.integration.test.ts:55                                                                        |
| FR-007      | ✅     | apps/api/src/routes/auth/simple.ts:39<br>apps/web/src/lib/auth-provider/SimpleAuthProvider.tsx:311<br>apps/web/src/lib/auth-provider/SimpleAuthProvider.test.tsx:196                      |
| FR-008      | ✅     | apps/web/src/lib/auth-provider/index.tsx:45<br>apps/web/src/App.tsx:1<br>apps/web/src/main.tsx:11                                                                                         |
| FR-009      | ✅     | apps/web/src/lib/auth-provider/SimpleAuthProvider.tsx:135<br>apps/web/src/components/simple-auth/LoginScreen.tsx:49<br>apps/web/src/components/simple-auth/LoginScreen.test.tsx:24        |
| FR-010      | ✅     | apps/web/src/lib/auth-provider/SimpleAuthProvider.tsx:223<br>apps/web/src/lib/auth-provider/SimpleAuthProvider.tsx:304<br>apps/web/src/lib/auth-provider/SimpleAuthProvider.test.tsx:133  |
| FR-011      | ✅     | apps/api/src/config/auth-provider.ts:22<br>apps/web/src/main.tsx:11<br>README.md:190                                                                                                      |
| FR-012      | ⚠️     | .env.example:1<br>docs/examples/simple-auth-users.yaml:1<br>specs/014-simple-auth-provider/tasks.md:35 (still need `docs/simple-auth.md`)                                                 |
| FR-013      | ✅     | apps/api/src/app.ts:129<br>apps/api/src/load-env.ts:88<br>apps/web/src/components/simple-auth/SimpleAuthWarningBanner.tsx:17                                                              |

### Testing

- Added unit coverage for config resolution, service validation, and service
  locator wiring (`apps/api/tests/unit/config/auth-provider-config.test.ts:1`,
  `apps/api/tests/unit/auth/simple-auth.service.test.ts:60`,
  `apps/api/tests/unit/core/service-locator.test.ts:12`).
- Added contract and integration tests for `/auth/simple/users` and simple token
  flows (`apps/api/tests/contract/auth/simple-auth-users.contract.test.ts:40`,
  `apps/api/tests/integration/auth/simple-auth.integration.test.ts:47`).
- Added frontend unit and Playwright fixtures to exercise the login selector and
  provider swap (`apps/web/src/components/simple-auth/LoginScreen.test.tsx:24`,
  `apps/web/src/lib/auth-provider/SimpleAuthProvider.test.tsx:82`,
  `apps/web/tests/e2e/support/draft-recovery.ts:1`).
- Outstanding: add automated coverage for `POST /auth/simple/logout` to guard
  regressions (`apps/api/src/routes/auth/simple.ts:39`).

### Risks & Mitigations

- `docs/simple-auth.md` was not updated even though the plan calls it out;
  capture the new workflow in that doc or revise references before release
  (`specs/014-simple-auth-provider/tasks.md:35`).
- The reference YAML shipped under `docs/examples/simple-auth-users.yaml`, but
  tooling still points to `templates/simple-auth-user.yaml`; either add the
  template or update docs/CLI guidance to match
  (`specs/014-simple-auth-provider/tasks.md:33`).
- Branch protection status checks remain unconfigured (F006); enable the
  required checks on `main` using the recommendations in
  `scripts/ci/check-protection.sh:138`
  (`specs/014-simple-auth-provider/tasks.md:291`).

### Clarifications

- 2025-10-20 — Simple auth may run in any environment, but deployments must emit
  explicit warnings when the provider is `simple`.
- 2025-10-20 — Use the resolved provider value itself to decide when to log
  “production” warnings; avoid additional environment heuristics.

### Assumption Log

- `js-yaml` is available in the workspace; satisfied by adding it to the API
  package (`specs/014-simple-auth-provider/tasks.md:271`,
  `apps/api/package.json:29`).
- Backend auth routes live under `apps/api/src/routes/auth/`; fulfilled by
  introducing `routes/auth/simple.ts`
  (`specs/014-simple-auth-provider/tasks.md:275`,
  `apps/api/src/routes/auth/simple.ts:17`).

## 013-epic-2-story-8

> Feature scope: Section/document quality gates, telemetry, and traceability
> sync for the document editor

### Overview

Implemented end-to-end quality gate orchestration across shared libraries, the
API, CLI, and React UX so section authors receive immediate remediation guidance
while document owners manage blockers from a unified dashboard. Traceability
links now stay in sync with the latest validated revision, reinforcing
compliance evidence and telemetry coverage.

### Highlights

- Added section and document quality gate controllers, services, and routes with
  audit logging and CLI parity (`apps/api/src/modules/quality-gates/**/*`,
  `packages/qa/src/cli.ts`).
- Introduced shared models, repositories, and migrations for gate results,
  document summaries, and traceability links
  (`packages/shared-data/src/{models,repositories}/quality-gates/**/*`,
  `packages/shared-data/migrations/20251013_quality_gates.sql`).
- Delivered React stores, dashboards, and telemetry hooks that enforce publish
  gating and SLA messaging in the editor
  (`apps/web/src/features/document-editor/quality-gates/**/*`,
  `apps/web/src/lib/telemetry/client-events.ts`).
- Authored contract/unit/e2e suites and fixtures to validate SLA, remediation,
  and traceability flows (`apps/api/tests/contract/quality-gates/*`,
  `apps/web/tests/**/*quality-gates*`).

### Requirement Coverage

| Requirement | Status | Evidence                                                                                                                                                                                                             |
| ----------- | ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| FR-001      | Met    | `apps/api/src/modules/quality-gates/services/section-quality.service.ts`, `packages/qa/src/gates/section/section-quality-runner.ts`, `apps/web/src/features/document-editor/components/document-section-preview.tsx` |
| FR-002      | Met    | `packages/qa/src/gates/section/section-quality-evaluator.ts`, `apps/web/src/features/document-editor/quality-gates/components/SectionRemediationList.tsx`                                                            |
| FR-003      | Met    | `apps/web/src/features/document-editor/quality-gates/stores/section-quality-store.ts`, `apps/web/src/features/document-editor/components/section-card.tsx`                                                           |
| FR-004      | Met    | `packages/qa/src/dashboard/document-quality-summary.ts`, `apps/web/src/features/document-editor/quality-gates/components/DocumentQualityDashboard.tsx`                                                               |
| FR-005      | Met    | `apps/web/src/features/document-editor/quality-gates/stores/document-quality-store.ts`, `apps/web/src/features/document-editor/components/document-editor.tsx`                                                       |
| FR-006      | Met    | `apps/api/src/modules/quality-gates/services/document-quality.service.ts`, `apps/web/src/features/document-editor/quality-gates/hooks/useQualityGates.ts`                                                            |
| FR-007      | Met    | `packages/qa/src/traceability/traceability-sync.ts`, `apps/web/src/features/document-editor/quality-gates/components/TraceabilityMatrix.tsx`                                                                         |
| FR-008      | Met    | `packages/qa/src/dashboard/document-quality-summary.ts`, `apps/web/src/features/document-editor/quality-gates/components/TraceabilityAlerts.tsx`                                                                     |
| FR-009      | Met    | `packages/qa/src/audit/index.ts`, `apps/api/src/modules/quality-gates/services/{section-quality,document-quality}.service.ts`                                                                                        |
| FR-010      | Met    | `apps/web/src/lib/telemetry/client-events.ts`, `apps/web/tests/e2e/document-editor/quality-gates-sla.e2e.ts`                                                                                                         |
| FR-011      | Met    | `apps/api/src/routes/quality-gates.ts`, `apps/api/tests/contract/quality-gates/sections.contract.test.ts`                                                                                                            |

### Testing

- Added Vitest contract/unit suites and Playwright E2E scenarios covering
  section/document runs, remediation, SLA telemetry, and traceability matrices;
  no outstanding test gaps identified.

### Risks & Mitigations

- New SQLite tables for quality gate results and traceability links require
  migrating environments;
  `packages/shared-data/migrations/20251013_quality_gates.sql` and the shared
  migration loader execute automatically during startup.
- SLA adherence depends on telemetry monitoring; dashboard timers and
  `qualityGates.*` console metrics illuminate slow runs for immediate triage.

### Clarifications

- 2025-10-13: Access partitioning confirmed—any authenticated collaborator can
  run quality gates and view remediation/traceability details (spec.md
  “Clarifications”).

### Assumption Log

- SQLite migrations can manage new quality gate tables (validated by
  `packages/shared-data/migrations/20251013_quality_gates.sql`).
- TanStack Query caching suffices for new endpoints; stores leverage existing
  query clients without additional invalidation.
- Remediation state mapping (`pending`/`in-progress`/`resolved`) anchors UI copy
  (`packages/qa/src/gates/section/section-quality-runner.ts`,
  `apps/web/src/features/document-editor/quality-gates/stores/section-quality-store.ts`).
- Prior placeholder rule evaluation replaced with real catalog wiring
  (`packages/qa/src/gates/section/section-quality-evaluator.ts`).
- Section revision identifiers derived from `approvedVersion` and `updatedAt`
  now persist through traceability sync (`apps/api/src/services/container.ts`,
  `packages/qa/src/traceability/traceability-sync.ts`).

## 012-epic-2-story-7

> Feature scope: Streaming parity for co-authoring, document QA, and assumption
> flows

### Overview

Implemented a shared section-stream queue and document QA streaming service so
co-authoring, QA, and assumption loops enforce per-section serialization while
keeping the editor responsive. Updated the document editor frontend, telemetry,
and fallback handling to surface progress cues, cancellation controls, and
parity between streaming and fallback deliveries.

### Highlights

- Added document QA streaming endpoints, service, and telemetry wiring that
  reuse the shared queue (`apps/api/src/routes/document-qa.ts:1`,
  `apps/api/src/modules/document-qa/services/document-qa-streaming.service.ts:1`,
  `apps/api/src/services/container.ts:1`).
- Shared coordinator and editor-core queue utilities replace ad hoc logic across
  co-authoring, QA, and assumption services
  (`apps/api/src/services/streaming/shared-section-stream-queue.ts:1`,
  `packages/editor-core/src/streaming/section-stream-queue.ts:1`,
  `apps/api/src/modules/section-editor/services/assumption-session.service.ts:1`).
- Extended the document editor with a QA panel, Zustand store, and session hooks
  that stream, resequence, and announce progress while honoring cancel/retry and
  fallback toggles
  (`apps/web/src/features/document-editor/components/document-qa/DocumentQaPanel.tsx:1`,
  `apps/web/src/features/document-editor/stores/document-qa-store.ts:1`,
  `apps/web/src/features/document-editor/hooks/useDocumentQaSession.ts:1`).

### Requirement Coverage

| Requirement | Status | Evidence                                                                                                                                                                                                                                                                                                                                                                                                                                |
| ----------- | ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| FR-001      | Met    | Shared queue plus streaming services and hooks deliver incremental updates across co-authoring, QA, and assumption flows (`packages/editor-core/src/streaming/section-stream-queue.ts:1`, `apps/api/src/modules/document-qa/services/document-qa-streaming.service.ts:1`, `apps/api/src/modules/section-editor/services/assumption-session.service.ts:1`, `apps/web/src/features/document-editor/hooks/useDocumentQaSession.ts:1`).     |
| FR-002      | Met    | Progress tracker emits stage labels and first-update latency while UI components surface chips and timers (`apps/web/src/lib/streaming/progress-tracker.ts:1`, `apps/web/src/features/document-editor/components/co-authoring/SessionProgress.tsx:1`, `apps/web/src/features/document-editor/components/document-qa/DocumentQaPanel.tsx:1`).                                                                                            |
| FR-003      | Met    | Editor stores keep sessions editable and persist transcripts/summaries after completion (`apps/web/src/features/document-editor/stores/co-authoring-store.ts:1`, `apps/web/src/features/document-editor/stores/document-qa-store.ts:1`, `apps/api/src/modules/document-qa/services/document-qa-streaming.service.ts:1`).                                                                                                                |
| FR-004      | Met    | Streaming progress tracker, QA hook, and telemetry emit ARIA-friendly announcements and fallback notices (`apps/web/src/lib/streaming/progress-tracker.ts:1`, `apps/web/src/features/document-editor/hooks/useDocumentQaSession.ts:1`, `apps/web/src/lib/telemetry/client-events.ts:1`).                                                                                                                                                |
| FR-005      | Met    | Cancel/retry endpoints and UI handlers normalize queue reasons and confirmations (`apps/api/src/routes/document-qa.ts:1`, `apps/api/src/routes/co-authoring.ts:1`, `apps/web/src/features/document-editor/hooks/useDocumentQaSession.ts:1`, `apps/web/src/features/document-editor/hooks/useCoAuthorSession.ts:1`).                                                                                                                     |
| FR-006      | Met    | Services detect transport flags and emit fallback parity while frontend displays deterministic fallback progress (`apps/api/src/modules/document-qa/services/document-qa-streaming.service.ts:1`, `apps/api/src/services/co-authoring/ai-proposal.service.ts:1`, `apps/web/src/lib/streaming/fallback-messages.ts:1`).                                                                                                                  |
| FR-007      | Met    | Streaming and fallback flows share summary/tokens and are validated by unit tests (`apps/api/src/modules/document-qa/services/document-qa-streaming.service.ts:1`, `apps/api/tests/unit/document-qa/document-qa-streaming.service.test.ts:1`, `apps/web/src/lib/streaming/fallback-messages.test.ts:1`).                                                                                                                                |
| FR-008      | Met    | Audit middleware, QA telemetry, and client events log queue disposition, fallback, and latency metrics (`apps/api/src/middleware/ai-request-audit.ts:84`, `packages/qa/src/audit/co-authoring.ts:14`, `apps/web/src/lib/telemetry/client-events.ts:1`).                                                                                                                                                                                 |
| FR-009      | Met    | Section stream queue enforces per-section serialization with promotions and cancellation propagation, verified through API/service tests (`packages/editor-core/src/streaming/section-stream-queue.ts:1`, `apps/api/src/services/streaming/shared-section-stream-queue.ts:1`, `apps/api/src/services/co-authoring/ai-proposal.service.test.ts:1`, `apps/api/src/modules/section-editor/services/assumption-session.service.test.ts:1`). |

### Testing

- Added or expanded 11 Vitest suites covering queue replacement, Document QA
  streaming, fallback parity, telemetry, and UI session hooks; contract tests
  for the new document QA routes remain TODO before release.

### Risks & Mitigations

- Document QA streaming service currently emits deterministic placeholder
  tokens; integrate the real review pipeline or flag this as a temporary stub
  before production cutover.
- New document QA endpoints lack contract coverage; add `*.contract.test.ts`
  exercising `specs/012-epic-2-story-7/contracts/streaming-openapi.yaml` prior
  to merging to main.

### Clarifications

- 2025-10-09: Multiple requests for the same section keep only the newest
  pending entry; enforced via shared section-stream queue.
- 2025-10-09: Cross-section concurrency is allowed; queue tracks concurrency
  slots per active session.
- 2025-10-09: Target capacity is 40+ concurrent interactions per workspace;
  telemetry captures slots and latency for validation.
- 2025-10-09: Streaming sessions are identified by server-generated UUID
  `sessionId`; all telemetry and stores persist this key.

### Assumption Log

- Queue utilities in
  `packages/editor-core/src/streaming/section-stream-queue.ts:1` serve
  co-authoring, document QA, and assumptions to align with FR-009 and
  cancel/retry parity.
- Document QA streaming shares co-authoring contract shapes so APIs and UI hooks
  can remain symmetrical until dedicated QA modules land.
- Document QA reviews derive deterministic prompts from document and section
  identifiers when UI does not supply explicit copy, preserving contract
  compliance.

## 011-epic-2-story-6

> Feature scope: Section-scoped conversational co-authoring assistant

### Overview

Delivered the conversational co-authoring workflow so authors can analyze
sections, stream AI proposals, and approve hashed diffs without leaving the
document editor. The API assembles whole-document context, enforces diff
integrity, and records changelog metadata while the React sidebar surfaces
accessible progress cues, fallback guidance, and explicit approval controls.

### Highlights

- Provisioned a rate-limited co-authoring service with SSE streams, audit
  telemetry, and diff-hash enforcement
  (`apps/api/src/services/co-authoring/ai-proposal.service.ts:319`,
  `apps/api/src/middleware/ai-request-audit.ts:34`,
  `apps/api/src/routes/co-authoring.ts:86`).
- Added shared co-authoring models and annotated diff utilities that persist
  proposal metadata without transcripts
  (`packages/shared-data/src/co-authoring/ai-proposal-snapshot.ts:1`,
  `packages/editor-core/src/diff/section-proposal.ts:53`,
  `packages/shared-data/src/repositories/changelog/changelog.repository.ts:79`).
- Built the co-authoring sidebar, Zustand store, session hook, and streaming
  utilities with hashed patches, cancel controls, and accessible announcements
  (`apps/web/src/features/document-editor/components/co-authoring/CoAuthorSidebar.tsx:166`,
  `apps/web/src/features/document-editor/hooks/useCoAuthorSession.ts:772`,
  `apps/web/src/lib/streaming/progress-tracker.ts:54`).
- Extended CLI replay tooling, fixtures, and automated tests to exercise the
  workflow across API, UI, and CLI surfaces (`packages/ai/src/cli.ts:63`,
  `packages/ai/src/session/proposal-runner.test.ts:1`,
  `apps/api/tests/contract/co-authoring/proposal.contract.test.ts:1`,
  `apps/web/tests/e2e/document-editor/co-authoring.e2e.ts:4`).

### Requirement Coverage

| Requirement | Status | Evidence                                                                                                                                            |
| ----------- | ------ | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| FR-001      | ✅     | apps/web/src/features/document-editor/components/document-editor.tsx:1564; apps/web/tests/e2e/document-editor/co-authoring.e2e.ts:15                |
| FR-002      | ✅     | apps/web/src/features/document-editor/components/co-authoring/CoAuthorSidebar.tsx:166; apps/web/tests/e2e/document-editor/co-authoring.e2e.ts:23    |
| FR-003      | ✅     | apps/api/src/services/co-authoring/context-builder.ts:61; apps/api/src/services/co-authoring/context-builder.test.ts:22                             |
| FR-004      | ✅     | packages/editor-core/src/diff/section-proposal.ts:53; apps/web/src/features/document-editor/components/co-authoring/ProposalPreview.test.tsx:52     |
| FR-005      | ✅     | apps/web/src/features/document-editor/components/co-authoring/ProposalPreview.tsx:137; apps/web/tests/e2e/document-editor/co-authoring.e2e.ts:60    |
| FR-006      | ✅     | apps/api/src/services/co-authoring/ai-proposal.service.ts:631; apps/api/src/services/co-authoring/ai-proposal.service.test.ts:131                   |
| FR-007      | ✅     | apps/web/src/features/document-editor/stores/co-authoring-store.ts:226; apps/web/src/features/document-editor/stores/co-authoring-store.test.ts:104 |
| FR-008      | ✅     | apps/api/src/services/co-authoring/context-builder.ts:63; apps/api/src/services/co-authoring/context-builder.test.ts:65                             |
| FR-009      | ✅     | apps/web/src/lib/streaming/fallback-messages.ts:1; apps/web/src/lib/streaming/fallback-messages.test.ts:8                                           |
| NFR-001     | ✅     | apps/web/src/features/document-editor/components/co-authoring/SessionProgress.tsx:17; apps/web/src/lib/streaming/progress-tracker.test.ts:6         |

### Testing

- `pnpm lint`, `pnpm typecheck`, `pnpm test` (2025-10-09) plus the new CLI,
  contract, unit, and Playwright suites covering context builders, diff mappers,
  audit middleware, progress tracker, and the document-editor flow
  (`apps/api/src/services/co-authoring/ai-proposal.service.test.ts`,
  `packages/ai/src/session/proposal-runner.test.ts`,
  `apps/web/src/features/document-editor/hooks/useCoAuthorSession.test.tsx`,
  `apps/web/tests/e2e/document-editor/co-authoring.e2e.ts`).

### Risks & Mitigations

- Session eviction relies on follow-up requests to trigger
  `evictExpiredSessions`; prolonged idle SSE connections could linger in memory.
  Monitor session telemetry and add a periodic eviction job if idle queues
  accumulate (`apps/api/src/services/co-authoring/ai-proposal.service.ts:811`).
- Diff hash fallbacks require `crypto.subtle` support; environments lacking Web
  Crypto support will skip client-side hashing and depend on server hashes only.
  Confirm Node runtimes ship Web Crypto or backfill via polyfill before
  deployment
  (`apps/web/src/features/document-editor/hooks/useCoAuthorSession.ts:132`).
- Live proposal streaming depends on `AI_SDK_API_KEY`; missing keys trigger
  fallback errors sent to the UI. Use `COAUTHORING_PROVIDER_MODE=mock` for
  environments without provider credentials and alert ops when the middleware
  logs `MISSING_AI_API_KEY` (`packages/ai/src/session/proposal-runner.ts:247`).

### Clarifications

- 2025-10-06 — Conversation history stays ephemeral; rely on changelog entries
  for auditability.
- 2025-10-06 — Provider prompts must include the entire document of completed
  sections.
- 2025-10-06 — No strict SLA for proposal diffs as long as progress is surfaced
  to the author.

### Assumption Log

- T003 — Diff annotations expose `promptId`, `originTurnId`, `rationale`,
  `confidence`, `citations`, and deterministic `segmentId` values for UI/audit
  correlation.
- T004 — `runProposalSession` accepts
  `{ session, prompt, context, provider, onEvent, replay }` and the CLI surfaces
  `coauthor --payload <file> --json [--replay]` for deterministic inspection.
- T005 — `section_changelog_entries` persists proposal metadata (ID, summary,
  confidence, citations, diff hash) while dropping transcript text.
- T006 — `buildCoAuthorContext` always includes every completed section and
  throws `{ code: 'SCOPE_VIOLATION' }` when the requested section is missing.
- T007 — `createAIRequestAuditMiddleware` handles rate limiting, redacts
  prompts, emits `coauthor.intent`, stores audit details on
  `res.locals.aiAudit`, and returns `{ code: 'RATE_LIMITED' }` with Retry-After
  when throttled.
- T008–T010 — New routes live under `/api/v1/documents/.../co-author/*`, respond
  `202 Accepted`, stream via `HX-Stream-Location`, and echo audit summaries
  without transcripts.
- T011 — The Zustand store exposes session lifecycle actions (`startSession`,
  `appendTranscriptToken`, `approveProposal`, `teardownSession`, `reset`) and
  clears transcripts on section/navigation changes.
- T012 — `ProposalPreview` renders ARIA-labelled segments with
  `data-segment-id`/`data-origin-turn` attributes plus prompt/confidence badges;
  `SessionProgress` announces status with cancel/retry controls.
- T013 — Playwright fixture runs via `?fixture=co-authoring` with test IDs
  (`co-author-sidebar`, `co-author-session-progress`, `proposal-diff-preview`,
  `co-author-fallback`) and labelled buttons.
- T017 — Proposal snapshots expire after 10 minutes
  (`AI_PROPOSAL_DEFAULT_TTL_MS = 600000`) to balance ephemerality with approval
  windows.
- T020 — Provider returns structured JSON (`proposalId`, `updatedDraft`,
  `confidence`, `citations`) while retaining streamed text for diff mapping
  fallback.
- T027 — Draft persistence derives `draftVersion` from the latest section draft
  when present, otherwise uses seeded contract defaults for determinism.
- T030 — Frontend computes `diffHash` and `draftPatch` using normalized segments
  so apply handlers receive consistent hashes before persistence lands.
- T031+ — Default context seeds include `knowledge:wcag` and
  `decision:telemetry` when authors lack selections to satisfy contract
  expectations.
- F002 — Production uses live provider unless `COAUTHORING_PROVIDER_MODE=mock`
  or `NODE_ENV=test` forces deterministic mocks.
- F008 — Draft patches must include Git-style prefixes on every line, including
  blanks, for audit replay fidelity.
- F009 — Session cleanup expires idle co-authoring sessions after five minutes
  while explicit reject/teardown endpoints drop SSE buffers and pending
  proposals immediately to preserve ephemerality.
- F011 — Fallback hashing relies on Web Crypto `crypto.subtle.digest`; extend
  research if an environment lacks support to avoid blocking approvals.
- F012 — Client progress timer advances `elapsedMs` locally so cancel controls
  unlock even when backend events stall.
- F012 (2025-10-09 follow-up) — Server synthesizes progress events every second
  so SSE payloads include increasing `elapsedMs` values.
- F013 — SSE diff payload streams stable `segmentId` values, reusing annotation
  identifiers for added/removed content and generating context IDs per turn.

## 010-epic-2-story-5

> Feature scope: Section draft persistence & compliance telemetry

### Overview

Implemented end-to-end section draft persistence so authors keep unsaved work
across reloads while bundling saves behind the new draft APIs. Hardened
compliance signalling, retention fixtures, and accessible status cues so
client-only drafts never leak content yet stay observable through console
telemetry. Updated CLI tooling, docs, and test suites to exercise the workflow
before merge.

### Highlights

- Added IndexedDB-backed `DraftStore` with quota-aware pruning and CLI
  inspection commands (`packages/editor-persistence/src/draft-store.ts`,
  `packages/editor-persistence/src/cli.ts`).
- Introduced draft bundle/compliance routes plus atomic repository logic with
  contract & unit coverage (`apps/api/src/routes/documents.ts`,
  `apps/api/tests/contract/documents.draft-bundle.contract.test.ts`).
- Wired the document editor to the persistence hook, status badge, logout
  registry, and console-only telemetry
  (`apps/web/src/features/document-editor/hooks/use-draft-persistence.ts`,
  `apps/web/src/lib/draft-logout-registry.ts`).
- Refreshed section editor bundling, retention fixtures, and QA compliance
  helpers (`apps/web/src/features/section-editor/hooks/use-section-draft.ts`,
  `apps/api/src/routes/projects.ts`, `packages/qa/src/compliance/drafts.ts`).
- Expanded Story 5 specs and architecture docs to capture the new persistence
  workflow (`docs/architecture.md`, `docs/ui-architecture.md`,
  `specs/010-epic-2-story-5/*`).

### Requirement Coverage

| Requirement | Status | Evidence                                                                                                                                                                                              |
| ----------- | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| FR-001      | ✅     | packages/editor-persistence/src/draft-store.ts:192<br>packages/editor-persistence/tests/draft-store.test.ts:81                                                                                        |
| FR-002      | ✅     | apps/web/src/features/document-editor/components/section-draft/DraftStatusBadge.tsx:15<br>apps/web/tests/e2e/document-editor/draft-persistence.e2e.ts:22                                              |
| FR-002a     | ✅     | apps/web/src/features/document-editor/components/section-draft/DraftStatusBadge.tsx:53<br>apps/web/src/features/document-editor/components/section-draft/DraftStatusBadge.test.tsx:22                 |
| FR-003      | ✅     | apps/web/src/features/document-editor/hooks/use-draft-persistence.ts:176<br>apps/web/tests/e2e/document-editor/draft-persistence.e2e.ts:26                                                            |
| FR-004      | ✅     | apps/api/src/routes/documents.ts:145<br>apps/api/src/services/drafts/draft-bundle.service.ts:97<br>apps/web/src/features/section-editor/hooks/use-section-draft.ts:671                                |
| FR-005      | ✅     | apps/web/src/features/document-editor/hooks/use-draft-persistence.ts:275<br>apps/web/src/features/document-editor/components/document-editor.tsx:913                                                  |
| FR-006      | ✅     | apps/api/src/services/drafts/draft-bundle.service.ts:199<br>apps/web/src/features/section-editor/hooks/use-section-draft.ts:865<br>apps/api/src/services/container.ts:143                             |
| FR-007      | ✅     | apps/api/src/services/drafts/draft-bundle.repository.ts:124<br>apps/api/tests/unit/drafts/draft-bundle.repository.test.ts:182                                                                         |
| FR-008      | ✅     | packages/editor-persistence/src/draft-store.ts:219<br>apps/web/src/features/section-editor/hooks/use-section-draft.ts:491<br>apps/web/src/features/document-editor/components/document-editor.tsx:967 |
| FR-009      | ✅     | packages/editor-persistence/src/draft-store.ts:192<br>apps/web/src/features/document-editor/hooks/use-draft-persistence.ts:189                                                                        |
| FR-010      | ✅     | apps/api/src/services/drafts/draft-bundle.service.ts:150<br>apps/api/tests/unit/drafts/draft-bundle.service.test.ts:95                                                                                |
| FR-011      | ✅     | apps/web/src/lib/draft-logout-registry.ts:53<br>apps/web/src/lib/clerk-client.tsx:99<br>apps/web/tests/e2e/document-editor/draft-persistence.e2e.ts:86                                                |
| FR-012      | ✅     | apps/web/src/lib/telemetry/client-events.ts:25<br>apps/web/src/lib/telemetry/client-events.test.ts:20                                                                                                 |
| FR-013      | ✅     | packages/editor-persistence/src/draft-store.ts:133<br>packages/editor-persistence/tests/draft-store.test.ts:81                                                                                        |
| FR-014      | ✅     | apps/web/src/features/document-editor/hooks/use-draft-persistence.ts:297<br>apps/api/src/routes/documents.ts:251<br>apps/api/tests/contract/documents.draft-compliance.contract.test.ts:32            |

### Testing

- Unit + integration suites cover the DraftStore, bundled save
  service/repository, telemetry, logout registry, and persistence hook
  (`packages/editor-persistence/tests/draft-store.test.ts`,
  `apps/api/tests/unit/drafts/*`,
  `apps/web/src/features/document-editor/hooks/use-draft-persistence.test.tsx`).
- Contract tests assert PATCH/POST draft endpoints and the new retention policy
  fixture (`apps/api/tests/contract/documents.draft-bundle.contract.test.ts`,
  `apps/api/tests/contract/documents.draft-compliance.contract.test.ts`,
  `apps/api/tests/contract/projects.retention.contract.test.ts`).
- Playwright flow exercises draft recovery, quota messaging, logout purge, and
  bundled save (`apps/web/tests/e2e/document-editor/draft-persistence.e2e.ts`).
- Pending to run before merge: `pnpm lint`, `pnpm typecheck`, `pnpm test`,
  `pnpm --filter @ctrl-freaq/web test:e2e:quick` (per T024).

### Risks & Mitigations

- Logout purge depends on Clerk sign-out interception; verify in an environment
  with real auth to confirm `triggerDraftLogoutHandlers` fires before session
  teardown (`apps/web/src/lib/clerk-client.tsx:99`).
- Retention policy data is currently fixture-backed for `project-test`; ensure
  future projects seed policies or fall back gracefully
  (`apps/api/src/routes/projects.ts:319`).

### Clarifications

- 2025-09-30: When recovered drafts conflict with server updates, keep the local
  draft primary and archive the server version for replay.
- 2025-09-30: If browser storage capacity is hit before save, prune the oldest
  drafts automatically and notify the user.
- 2025-09-30: Unsaved drafts never auto-expire; they persist until explicitly
  saved or discarded.
- 2025-09-30: If bundled save validation fails for any section, abort the entire
  bundle and preserve all drafts.
- 2025-09-30: Drafts must remain client-side only and be cleared immediately on
  logout.
- 2025-09-30: Telemetry for draft events stays in the browser console and never
  transmits identifiers to the server.
- 2025-09-30: Draft rehydration should finish within ~3 seconds; if slower,
  surface guidance explaining the delay.
- 2025-09-30: Maximum draft storage relies on browser limits with no explicit
  cap.
- 2025-09-30: Draft keys combine document slug, section title, and author
  identity to avoid collisions.
- 2025-09-30: Status indicators require visible labels and ARIA live
  announcements for accessibility.
- 2025-09-30: Offline drafts under retention policy log a compliance warning
  enabling manual escalation later.

### Assumption Log

- No new feature-level assumptions were introduced while resolving audit
  findings; existing guidance still applies.
- Displaying draft timestamps with `Intl.DateTimeFormat` in the browser
  locale/time zone meets FR-002 accessibility expectations
  (`apps/web/src/features/document-editor/hooks/use-draft-persistence.ts:60`).
- Any active project retention policy implies every unsynced draft should emit a
  compliance warning until the policy is cleared
  (`apps/web/src/features/section-editor/hooks/use-section-draft.ts:464`).
- Returning `serverVersion: 0` and empty `serverContent` for scope mismatches
  prevents leaking other documents while satisfying the contract
  (`apps/api/src/services/drafts/draft-bundle.repository.ts:300`).
- Console-only telemetry still delivers observability without transporting draft
  identifiers (`apps/web/src/lib/telemetry/client-events.ts:25`).
- Clearing persistence markers when rehydrated drafts postdate the cleanup time
  preserves intentional cleanup while keeping newer drafts intact
  (`apps/web/src/features/section-editor/hooks/use-section-draft.ts:884`).

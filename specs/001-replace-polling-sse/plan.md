# Implementation Plan: Unified SSE Event Hub

**Branch**: `001-replace-polling-sse` | **Date**: 2025-11-03 | **Spec**:
[spec.md](/specs/001-replace-polling-sse/spec.md)  
**Input**: Feature specification from `/specs/001-replace-polling-sse/spec.md`

## Summary

Deliver a single authenticated Server-Sent Events channel that replaces
short-interval polling across the React client. The plan introduces a
`/api/v1/events` endpoint with an in-memory broker that multiplexes project
lifecycle, quality gate, and section draft topics. A shared frontend event hub
will demultiplex messages, update TanStack Query/Zustand stores, and downgrade
to legacy polling whenever the stream reports degraded health. Rollout remains
guarded by backend (`ENABLE_EVENT_STREAM`) and frontend (`VITE_ENABLE_SSE_HUB`)
flags with telemetry to monitor adoption.

## Technical Context

**Language/Version**: TypeScript (Node.js ≥20 for API, React 19 + Vite 5 for
web)  
**Primary Dependencies**: Express.js, Better-SQLite3 (via
`@ctrl-freaq/shared-data`), Zod, Pino, TanStack Query, Zustand, shadcn/ui  
**Storage**: SQLite for persistence; in-memory broker buffer scoped to API
process; browser memory for client stores  
**Testing**: Vitest (unit/contract), Supertest with EventSource polyfill for SSE
routes, Playwright fixture suites for realtime UI flows  
**Target Platform**: Local-first modular monolith (`apps/api` + `apps/web`) with
Clerk or simple-mode auth; pnpm workspace  
**Project Type**: Full-stack pnpm monorepo with shared packages (`packages/*`)  
**Performance Goals**: Deliver lifecycle/conflict updates within 2 seconds for
95% of sessions; sustain ≥500 concurrent SSE connections per node without
timeouts; reconnect within 5 seconds when degraded  
**Constraints**: Library-first boundaries, CLI parity for shared packages, TDD
enforcement (Vitest before implementation), soft-delete & audit trail
preservation, request ID propagation on streamed events  
**Scale/Scope**: Single workspace MVP; anticipate tens of projects/documents per
workspace with low hundreds of active tabs; broker buffer sized for ~100 events
per topic before snapshot fallback

## Constitution Check

- ✅ **Library-First Architecture (Principle I)** — Event broker lives inside
  `apps/api` with clear module boundaries; reusable event envelope types shared
  via internal module without leaking persistence concerns.
- ✅ **CLI Interface Standard (Principle II)** — Existing shared-data CLIs
  remain untouched; any new tooling (e.g., broker diagnostics) must expose CLI
  hooks if promoted to shared package.
- ✅ **Test-First Development (Principle III)** — Plan mandates failing Vitest +
  Supertest SSE suites and frontend hub tests before implementation; Playwright
  fixture scenarios exercise realtime UI.
- ✅ **Request Tracking & Logging (Implementation Checklist 3 & 9)** — Stream
  events include `sequence`, timestamps, and inherit `request_id` where
  applicable; telemetry logged via Pino for auditing.
- ✅ **Soft Deletes & Audit Trails (Rule 15)** — Project lifecycle still relies
  on soft deletes; SSE emission cannot bypass existing archival logging.

## Project Structure

```text
specs/001-replace-polling-sse/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
└── checklists/
```

```text
apps/
├── api/
│   ├── src/app.ts
│   ├── src/routes/index.ts
│   ├── src/routes/projects.ts
│   ├── src/modules/quality-gates/controllers/{document,section}-quality.controller.ts
│   ├── src/modules/section-editor/services/{section-conflict,section-draft}.service.ts
│   ├── src/services/container.ts
│   └── tests/{contract,integration,unit}/...
└── web/
    ├── src/lib/api-context.tsx
    ├── src/lib/auth-provider/
    ├── src/lib/streaming/            # new event hub placement
    ├── src/hooks/use-projects-query.ts
    ├── src/pages/{Dashboard,Project}.tsx
    ├── src/features/document-editor/quality-gates/hooks/useQualityGates.ts
    ├── src/features/section-editor/hooks/use-section-draft.ts
    └── tests/{unit,integration,e2e}/...

packages/
├── shared-data/
│   ├── src/models/
│   ├── src/repositories/
│   └── tests/
└── editor-persistence/
    └── src/
```

**Structure Decision**: Work spans existing API + SPA split; backend changes
concentrate in Express routes/services to publish events, while frontend changes
introduce a streaming library and update existing hooks/pages. Tests remain
colocated with surfaces (Vitest/Supertest under `apps/api/tests`, React/Vitest
under `apps/web/src/**/__tests__`, Playwright in `apps/web/tests/e2e`).

## Codebase Reconnaissance

| Story/Decision    | File/Directory                                                                  | Role Today                                             | Helpers/Configs                                              | Risks & Follow-up                                                                       | Verification Hooks                                                                     |
| ----------------- | ------------------------------------------------------------------------------- | ------------------------------------------------------ | ------------------------------------------------------------ | --------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| US1 / D001 / D004 | `/apps/api/src/routes/projects.ts`                                              | Handles lifecycle mutations with activity logging only | `ProjectRepositoryImpl`, `ActivityLogUtils`, auth middleware | Inject broker publish without duplicating persistence, ensure single event per mutation | `apps/api/tests/contract/projects-api.test.ts`, planned SSE contract suite             |
| US1 / D002 / D005 | `/apps/web/src/pages/Project.tsx`                                               | 1.5s polling loop detects archive                      | `projects.getById`, React Query invalidation                 | Replace polling with hub listener while preserving archive redirect fallback            | `apps/web/tests/e2e/dashboard/project-archive.e2e.ts`, new hub unit tests              |
| US2 / D003 / D004 | `/apps/api/src/modules/quality-gates/controllers/section-quality.controller.ts` | Runs quality gates, returns JSON                       | `SectionQualityService`, telemetry logger                    | Publish progress/summary events without blocking run pipeline                           | `apps/api/tests/contract/quality-gates/sections.contract.test.ts`, new streaming tests |
| US2 / D005        | `/apps/web/src/features/document-editor/quality-gates/hooks/useQualityGates.ts` | Polls every 200ms for progress                         | TanStack Query, Zustand stores                               | Swap to hub subscription and guard fallback reactivation                                | Hook unit tests + mocked EventSource                                                   |
| US3 / D003 / D004 | `/apps/api/src/modules/section-editor/services/section-conflict.service.ts`     | Logs conflicts, updates drafts                         | Repositories, Zod schemas                                    | Emit conflict events alongside logging without double writes                            | Section conflict unit tests + new SSE coverage                                         |
| US3 / D005        | `/apps/web/src/features/section-editor/hooks/use-section-draft.ts`              | Timer-based diff refresh                               | Draft client, logger                                         | Integrate hub-driven diffs and degrade gracefully                                       | Hook tests + diff polling fallback assertions                                          |
| Shared / D006     | `/apps/api/src/app.ts`, `/apps/api/src/middleware/authentication.ts`            | Wires routes and auth                                  | Feature flags, Clerk/simple mode                             | SSE route must honor auth + flags; ensure keep-alive interval configurable              | Supertest SSE auth/fallback tests                                                      |
| Shared / D005     | `/apps/web/src/lib/api-context.tsx`, `/apps/web/src/lib/auth-provider/`         | Supplies API client + tokens                           | Token refresh, logout handling                               | Restart stream on token changes, avoid leakage on logout                                | Auth provider tests with hub restart assertions                                        |

## Complexity Tracking

_No constitutional violations anticipated; table remains empty unless future
changes require justification._

## Phase 0: Outline & Research

- Captured decisions D001–D006 in
  [research.md](/specs/001-replace-polling-sse/research.md) covering SSE
  endpoint scope, broker design, envelope schema, frontend hub strategy, and
  telemetry guardrails.
- Documented codebase reconnaissance per user story, flagging polling hot spots,
  quality gate runners, and conflict services that require event publication and
  fallback handling.
- Verified no additional constitutional exceptions are needed; clarified feature
  flags handle rollout risk.
- Outstanding TODOs: size broker replay buffer (default 100 events) and confirm
  env variable names during implementation.

**Output**: `research.md` with finalized decisions and reconnaissance map.

## Phase 1: Design & Contracts

_Prerequisite: research.md complete_

1. Translate event entities (EventEnvelope, StreamSubscription, HubHealthState)
   plus broker state into `data-model.md`, including replay constraints and
   health transitions.
2. Produce `contracts/events.openapi.yaml` defining `GET /api/v1/events`, SSE
   response format, heartbeat semantics, and error responses; add topic-specific
   payload schemas referencing existing DTOs.
3. Update agent context notes (manual entry if no automation script) to
   highlight new streaming infrastructure and fallback patterns for future
   agents.
4. Author `quickstart.md` with workspace bootstrap steps, feature-flag toggles,
   mock event publisher usage, and validation walkthroughs for US1–US3
   referencing reconnaissance IDs.

_Constitution Re-check_: Planned artifacts maintain library-first boundaries,
reinforce test-first requirements (SSE unit + contract tests), and preserve
governance (soft deletes, audit logs, request IDs). No new violations
introduced.

**Output**: `data-model.md`, `contracts/events.openapi.yaml` (plus supporting
schemas), updated agent context notes, and `quickstart.md` tied to decision IDs.

## Phase 2: Task Planning Approach

_This section describes what `/speckit.tasks` will do; do not execute during
`/speckit.plan`_

- Feed Phase 1 artifacts into `.specify/templates/tasks-template.md` to derive
  implementation tasks.
- Organize tasks by user story priority (P1 lifecycle, P2 quality gates, P3
  conflict alerts) with setup/foundational work first.
- Mark parallel-safe work (e.g., frontend hub vs backend broker) using `[P]`.
- Ensure every task bundle includes tests (Vitest, Supertest, Playwright) and
  telemetry verification aligning with Success Criteria.

**Outputs for `/speckit.tasks`**: `tasks.md` detailing setup, foundational
tasks, per-story workstreams, polish, and MVP readiness checkpoints with
dependency graph recommendations.

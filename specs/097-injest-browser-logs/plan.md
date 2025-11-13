# Implementation Plan: Browser Log Ingestion Endpoint

**Branch**: `097-injest-browser-logs` | **Date**: 2025-11-14 | **Spec**:
[spec.md](/specs/097-injest-browser-logs/spec.md)  
**Input**: Feature specification from `/specs/097-injest-browser-logs/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See
`.specify/templates/commands/plan.md` for the execution workflow.

## Summary

Deliver a `POST /api/v1/logs` ingestion route inside `apps/api` that
authenticates browser sessions, validates 1–100 log entries (≤1 MB) with Zod,
and responds with HTTP 202 plus a correlation `requestId`. Invalid payloads
trigger atomic 400/413/429 responses that cite the failing entry index while
skipping all processing. Accepted batches enrich each entry with server context
(API requestId, authenticated userId, IP, UA, ingestion timestamp) and emit a
structured `browser.log` event through the existing Pino logger so ops can
correlate incidents without adding persistence or queues. Documentation updates
ensure frontend teams understand payload contracts, flush triggers, and error
codes before wiring their instrumentation.

## Technical Context

<!--
  ACTION REQUIRED: Replace the content in this section with the technical details
  for the project. The structure here is presented in advisory capacity to guide
  the iteration process.
-->

**Language/Version**: TypeScript 5.9 targeting Node.js 22 (Express API)  
**Primary Dependencies**: Express 5, Zod 4 for schema validation, Pino 10 +
pino-http for structured logging, rate-limit middleware + shared `@ctrl-freaq/*`
service locator wiring  
**Storage**: No new persistence; ingestion stays in-memory and emits to
structured logs only  
**Testing**: Vitest + Supertest for API/contract suites, Playwright fixture
flows indirectly via existing dashboard if needed  
**Target Platform**: Local-first modular monolith (`apps/api` + `apps/web`)
served via pnpm; deploys as Express server behind Clerk/simple auth  
**Project Type**: pnpm monorepo housing backend (`apps/api`), frontend
(`apps/web`), and shared packages  
**Performance Goals**: Respond to valid flushes with HTTP 202 within 1 s for
batches ≤10 entries; reject oversized payloads before body buffering; keep
request logging overhead <5 ms per batch  
**Constraints**: Reuse existing auth/rate limiting, body limit ≤1 MB, logs array
1–100 entries, `source` must equal `browser`, no partial batch acceptance, no
new queues/DBs  
**Scale/Scope**: Expect tens of concurrent browsers per workspace with flush
cadence every ≤5 s (≤10 entries each); ops review relies on enriched server logs
instead of dashboards initially

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

- ✅ **Principle I – Library-First Architecture**: Browser log ingestion lives
  in the existing `apps/api` library with service-locator managed dependencies
  and no ad-hoc singletons or shared mutable state.
- ✅ **Principle II – CLI Interface Standard**: No new shared libraries or CLIs
  introduced; existing packages with CLIs (templates, shared-data) remain
  untouched.
- ✅ **Principle III – Test-First Development**: Plan mandates failing Vitest +
  Supertest suites (success, validation, limit enforcement) before production
  code plus regression coverage for rejection paths.
- ✅ **Principle IV – Observability & Logging**: Route will emit structured Pino
  events with requestId/user/session context and reuse request-id middleware
  ensuring traceability; no raw console logging allowed.
- ✅ **SOC 2 Logging Rules**: Enriched entries include auth/user metadata,
  ip/user-agent, and log rejection events without storing secrets, aligning with
  auditability requirements.
- ✅ **Contract Suites Under `tests/contracts/`**: Contract specs for the new
  route will be created under `apps/api/tests/contracts/` so every OpenAPI file
  has a constitutionally compliant sibling test.

## Project Structure

### Documentation (this feature)

```text
specs/097-injest-browser-logs/
├── plan.md
├── spec.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── browser-logs.openapi.yaml
└── checklists/
```

### Source Code (repository root)

```text
apps/
├── api/
│   ├── src/
│   │   ├── app.ts
│   │   ├── core/{logging.ts,service-locator.ts}
│   │   ├── middleware/{request-id.ts,auth.ts,user-rate-limit.ts}
│   │   ├── routes/
│   │   │   ├── documents.ts
│   │   │   ├── events.ts
│   │   │   ├── quality-gates.ts
│   │   │   └── logs/              # new ingestion module
│   │   │       ├── index.ts       # router + handler orchestration
│   │   │       ├── body-parser.ts # 1 MB parser w/ sendBeacon support
│   │   │       ├── logs.schema.ts # Zod schemas + DTOs
│   │   │       └── helpers/*      # enrichment + emitters
│   │   ├── services/{request-body-limit.ts,audit-log.service.ts}
│   │   └── testing/fixtures/
│   └── tests/
│       ├── contracts/
│       ├── integration/
│       └── unit/
└── web/
    ├── docs/front-end-spec.md      # updated per FR-009
    └── tests/e2e/                  # reuse fixture flows if needed
```

**Structure Decision**: Work stays within the modular monolith: backend changes
live under `apps/api` (modular `routes/logs/` folder for router, parser, schema,
helpers, and tests) while documentation updates touch `docs/front-end-spec.md`
and new spec artifacts inside `specs/097-injest-browser-logs`. No additional
packages or services are added.

## Codebase Reconnaissance

<!--
  ACTION REQUIRED: Summarize exhaustive findings from Phase 0 reconnaissance.
  Use Story IDs from spec.md (US1, US2, ...) and Decision IDs (D001, D002, ...)
  to keep entries aligned with research.md. Add subsections per story when
  helpful (e.g., ### US1 – Story name).
-->

| Story/Decision | File/Directory                                                 | Role Today                                                                                     | Helpers/Configs                                                                                 | Risks & Follow-up                                                                                                                              | Verification Hooks                                                                               |
| -------------- | -------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| US1 / D001     | `apps/api/src/app.ts`                                          | Bootstraps Express app, registers request ID/auth middleware, and mounts every `/api/v1` route | `createFullCorrelationMiddleware`, `requireAuth`, `userRateLimiter`, `serviceLocatorMiddleware` | New logs router must mount after auth/rate limiters but before catch-all 404 to inherit guards                                                 | `pnpm --filter @ctrl-freaq/api test -- --run tests/contracts/*`                                  |
| US1 / D002     | `apps/api/src/middleware/auth.ts`                              | Enforces Clerk/simple auth, emits structured auth logs, populates `req.user`                   | `clerkAuthMiddleware`, `logAuthEvent`, rate-limit config in `config/rate-limiting.ts`           | Need to respect existing 401/429 responses and avoid duplicating auth logic inside the route handler                                           | `pnpm --filter @ctrl-freaq/api test -- --run tests/contracts/auth/*.test.ts`                     |
| US2 / D003     | `apps/api/src/core/logging.ts` + `src/core/service-locator.ts` | Provides Pino logger + per-request child loggers for structured logging                        | `createLogger`, `createHttpLogger`, service locator `logger` registration                       | Browser log enrichment must use `req.services.get('logger')` to include `requestId` and redact secrets                                         | `pnpm --filter @ctrl-freaq/api test -- --run tests/unit/core/logging.test.ts`                    |
| US3 / D004     | `apps/api/tests/{contracts,integration}/`                      | Existing Vitest + Supertest suites assert JSON errors, rate limits, SSE flows                  | `tests/setup.ts`, `tests/shared/simple-auth` fixtures, `.env.fixture` in apps/api               | Need new `tests/contracts/logs/browser-logs.contract.test.ts` to cover success + validation + limit cases plus sendBeacon payload content-type | `pnpm --filter @ctrl-freaq/api test -- --run tests/contracts/logs/browser-logs.contract.test.ts` |

## Complexity Tracking

No additional complexity or constitutional exceptions required for this feature.

## Phase 0: Outline & Research

- Produced `research.md` capturing Decisions D001–D005:
  - D001 codifies Zod schemas + atomic rejection and references existing error
    helpers.
  - D002 pins a route-scoped 1 MB parser that supports `sendBeacon`
    (`text/plain`).
  - D003 outlines the enriched `browser.log` Pino event with request-scoped
    loggers.
  - D004 locks in reuse of shared auth/rate limiting + audit logs.
  - D005 documents why contracts/quickstarts must precede implementation.
- Completed reconnaissance tables per user story, mapping Express bootstrap,
  middleware, logging, and test surfaces to Story IDs so `/speckit.implement`
  can jump directly to affected files.
- Confirmed the existing `SecurityLogger` already emits `security.event`
  metadata, so the `browser.log` helper can safely log an `event` field without
  additional infrastructure.

**Output**: `research.md` detailing decisions plus codebase reconnaissance.

## Phase 1: Design & Contracts

- Authored `data-model.md` describing BrowserLogBatch, BrowserLogEntry, and the
  derived EnrichedLogEvent plus their field constraints and lifecycle.
- Created `contracts/browser-logs.openapi.yaml` for `POST /api/v1/logs`,
  covering JSON + `text/plain` payloads, success (202) and failure (400/413/429)
  schemas, and the requirement to echo `X-Request-ID`.
- Compiled `quickstart.md` walkthroughs tied to US1–US3 that exercise success,
  validation errors, size limits, and rate limiting via curl against fixture
  auth tokens. Each step references the relevant decision IDs for traceability.

**Output**: `data-model.md`, `contracts/browser-logs.openapi.yaml`, and
`quickstart.md` ready for `/speckit.tasks`.

## Phase 2: Task Planning Approach

_This section describes what the `/speckit.tasks` command will do - DO NOT
execute during `/speckit.plan`_

**Task Generation Strategy**:

- Load `.specify/templates/tasks-template.md` as base
- Generate tasks from Phase 1 design docs (contracts, data model, quickstart)
- Organize tasks by user story priority (P1, P2, P3...)
- Each user story → complete set of tests (if requested), models, services,
  endpoints, and integration work
- Shared setup and foundational tasks appear before user stories; polish tasks
  appear last
- Use `[P]` markers for parallel-safe tasks (different files)

**Outputs expected from `/speckit.tasks`**:

- `tasks.md` with phases for setup, foundational work, each user story, and
  polish
- MVP recommendation and dependency graph between user stories
- Parallel execution guidance and implementation strategy summary

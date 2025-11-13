# Research – Browser Log Ingestion Endpoint

## Decisions

### D001 – Strict batch schema & atomic rejection

- **Decision**: Validate `POST /api/v1/logs` payloads with Zod schemas covering
  `source=browser`, `sessionId`, optional `userId`, and `logs[1..100]` entries;
  reject the entire batch with HTTP 400 + pointer to the first invalid entry and
  skip emitting enriched events.
- **Rationale**: Aligns with clarified requirement that partial acceptance is
  forbidden and keeps server/client telemetry consistent for retries. Zod is
  already the repo-standard validator so we inherit error formatting helpers and
  test ergonomics.
- **Alternatives considered**: (a) Accept valid entries and return 207/202 with
  warnings—rejected because ops would see phantom gaps and retry logic becomes
  undefined. (b) Hand-written validation—slower to maintain and duplicates
  global schema rules.

### D002 – Route-scoped 1 MB parser supporting `sendBeacon`

- **Decision**: Override the global 10 MB JSON parser by attaching an
  `express.json({ limit: '1mb', type: ['application/json','text/plain'] })`
  middleware to the logs router so `navigator.sendBeacon` payloads (often
  `text/plain`) are parsed while oversized bodies short-circuit before reading
  the full stream.
- **Rationale**: Allows browsers to flush from `sendBeacon` without duplicate
  instrumentation while guaranteeing spec-mandated 1 MB cap and providing early
  413 responses.
- **Alternatives considered**: (a) Keep default 10 MB parser and manually
  inspect `req.get('content-length')`—insufficient because chunked uploads could
  still exceed 1 MB before detection. (b) Use `express.raw` and custom JSON
  parsing—more code and loses automatic charset handling.

### D003 – Enriched log emission via Pino child logger

- **Decision**: Map every accepted entry to a server-side `browser.log`
  structured event by grabbing the request-scoped logger
  (`req.services.get('logger')`), attaching `apiRequestId`, `sessionId`,
  `userId`, `ip`, `userAgent`, and entry index, and log at `info` or `warn`
  depending on entry `level`.
- **Rationale**: Reuses Constitution-compliant structured logging, keeps
  telemetry searchable without introducing persistence, and gives ops a single
  enriched log line per entry per spec.
- **Alternatives considered**: (a) Write to SQLite/persistence—explicitly
  forbidden by FR-007. (b) Stream logs to event broker—overkill for MVP and
  would couple ingestion with SSE consumers.

### D004 – Rate limiting + audit trail reuse

- **Decision**: Rely on existing `requireAuth` + `createUserRateLimit`
  middleware stack for throttling and add rejection logging to the audit logger
  so ops can trace abusive clients; route handler only needs to emit 429
  metadata when upstream middleware flags enforcement.
- **Rationale**: Keeps enforcement consistent with other `/api/v1` routes and
  satisfies audit logging (FR-008) without duplicating logic.
- **Alternatives considered**: (a) Adding bespoke limiter inside the
  handler—risks divergence from platform policy. (b) Offloading entirely to
  frontend—would violate SOC 2 requirement that server enforces auth/limits.

### D005 – Contract-first documentation updates

- **Decision**: Author `contracts/browser-logs.openapi.yaml`, `data-model.md`,
  and `quickstart.md` now so downstream `/speckit.tasks` and implementation
  agents have unambiguous payload/response definitions tied to user stories.
- **Rationale**: Maintains spec-driven workflow; quickstart doubles as
  regression checklist for manual verification across the three user stories.
- **Alternatives considered**: Defer documentation until after
  implementation—rejected because Constitution mandates upfront planning and the
  frontend team needs contracts before coding.

## Codebase Reconnaissance

### US1 – Browser flush receives acknowledgement

| Decision ID | Path                                                          | Responsibility Today                                                                   | Dependencies                                                                                          | Notes / Risks                                                                                                                                                         | Verification                                                                           |
| ----------- | ------------------------------------------------------------- | -------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| D001        | `apps/api/src/app.ts`                                         | Bootstraps Express, wires request-id/auth/rate-limiter, mounts routers under `/api/v1` | `createFullCorrelationMiddleware`, `requireAuth`, `createUserRateLimit`, service locator registration | Logs router must mount after auth/rate limiters to inherit guards and before `createNotFoundHandler`; also ensure `express.json` override applies only to this router | `pnpm --filter @ctrl-freaq/api test -- --run tests/contract/*.test.ts`                 |
| D002        | `apps/api/src/middleware/request-id.ts`                       | Generates correlation IDs and exposes `req.requestId`                                  | `createFullCorrelationMiddleware`, `createHttpLogger`                                                 | Responses must echo the same requestId so frontend flushes can correlate; ensure new handler never overwrites provided IDs                                            | `pnpm --filter @ctrl-freaq/api test -- --run tests/unit/middleware/request-id.test.ts` |
| D002        | `apps/api/src/middleware/auth.ts` & `config/rate-limiting.ts` | Clerk/simple auth enforcement plus per-user throttling                                 | Environment vars (`AUTH_PROVIDER`, `RATE_LIMIT_MAX`, `RATE_LIMIT_ENFORCEMENT_MODE`)                   | Handler should trust middleware for 401/429 and skip custom auth logic; logging rejected flushes must not leak token contents                                         | `pnpm --filter @ctrl-freaq/api test -- --run tests/contract/auth/*.test.ts`            |

### US2 – Ops teams correlate browser issues

| Decision ID | Path                                                           | Responsibility Today                                                | Dependencies                                                      | Notes / Risks                                                                                                                                                          | Verification                                                                  |
| ----------- | -------------------------------------------------------------- | ------------------------------------------------------------------- | ----------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| D003        | `apps/api/src/core/logging.ts` & `src/core/service-locator.ts` | Creates request-scoped Pino loggers with redactors                  | `createLogger`, `createServiceLocatorMiddleware`, env `LOG_LEVEL` | Use `req.services.get('logger')` to get child logger carrying `requestId`/`userId`; include `sessionId`, `userAgent`, `ip` fields while redacting sensitive attributes | `pnpm --filter @ctrl-freaq/api test -- --run tests/unit/core/logging.test.ts` |
| D003        | `apps/api/src/middleware/request-id.ts`                        | Propagates `x-request-id` header                                    | same as above                                                     | Enriched log entries must echo this s.t. ops can correlate backend traces; ensure log event uses consistent event name `browser.log`                                   | Observing Pino output locally via `pnpm --filter @ctrl-freaq/api dev`         |
| D005        | `docs/front-end-spec.md`, `docs/prd.md`                        | Authoritative docs for payload contracts + instrumentation guidance | Markdown style guide, Story 2.2 docs                              | FR-009 requires updating docs with request/response contract and sample errors; ensure 80-char wrapping                                                                | Manual review + `pnpm format:check`                                           |

### US3 – Clients receive actionable rejections

| Decision ID | Path                                                            | Responsibility Today                                      | Dependencies                                                             | Notes / Risks                                                                                                                                                   | Verification                                                                                      |
| ----------- | --------------------------------------------------------------- | --------------------------------------------------------- | ------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| D001/D004   | `apps/api/tests/contract` & `tests/integration`                 | Supertest/Vitest suites covering API routes, auth, limits | `tests/setup.ts`, simple-auth fixtures, `pnpm test` harness              | Need new `tests/contract/logs/browser-logs.contract.test.ts` verifying 202 success, 400 validation pointer, 413 body limit, and 429 forwarded from rate limiter | `pnpm --filter @ctrl-freaq/api test -- --run tests/contract/logs/browser-logs.contract.test.ts`   |
| D002        | `apps/api/src/routes/co-authoring-rate-limiter.ts` (reference)  | Shows pattern for building user-level rate limiters       | `express-rate-limit`, env overrides                                      | Use as blueprint if we need route-specific limiter but prefer to rely on global `userRateLimiter`                                                               | `pnpm --filter @ctrl-freaq/api test -- --run tests/unit/routes/co-authoring-rate-limiter.test.ts` |
| D003/D005   | `apps/api/src/routes/helpers/project-access.ts` & error helpers | Provide canonical `sendErrorResponse` pattern             | Documented JSON shape `{ code, message, requestId, timestamp, details }` | Logs endpoint should reuse helper to keep machine-readable error format required by spec                                                                        | Contract tests + `pnpm lint`                                                                      |

TODO: Confirm whether any shared `logger` child already implements `event`
fields for log classification; if absent, add `event: 'browser.log'` during
implementation.

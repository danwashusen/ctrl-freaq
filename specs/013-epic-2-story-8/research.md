# Research Notes — Quality Gates Integration

- Decision: Run section/document quality gates on the API server using the
  existing `packages/qa` engine and expose orchestration via REST + CLI.
  Rationale: Centralizing execution keeps rules authoritative, reuses shared
  telemetry/audit hooks, and works for every collaborator regardless of device.
  Alternatives considered: Client-side evaluation (rejected due to stale rule
  distribution and security), background worker queue (deferred until scale
  requires async offload).

- Decision: Trigger validations through the existing section debounce plus
  explicit “Re-run validation” actions, using TanStack Query mutations with
  optimistic loading indicators. Rationale: Reusing the editor’s debounce avoids
  duplicate timers, satisfies the <2 s SLA, and keeps manual retries symmetrical
  with auto runs. Alternatives considered: Websocket push (added complexity
  without incremental benefit), cron-style polling (too slow, wastes resources).

- Decision: Persist the latest `SectionQualityGateResult` +
  `DocumentQualityGateSummary` in `packages/shared-data` repositories and
  recompute summaries on each successful gate run. Rationale: Persisting results
  enables dashboard loads without rerunning gates, supports publish gating, and
  aligns with existing repository patterns. Alternatives considered: Pure
  in-memory cache (lost across server restarts), computing on demand per request
  (inefficient for publish attempts under load).

- Decision: Update traceability links through an event emitted after validation
  completion that maps requirements to section revisions and statuses.
  Rationale: Ensures the matrix reflects the exact revision that passed/failed,
  gives a single point to orphan/reassign requirements, and integrates with
  compliance logging. Alternatives considered: Client-driven updates (risk of
  race conditions), nightly batch sync (too slow for compliance workflows).

- Decision: Instrument telemetry and audit logs by extending QA audit utilities
  to record `requestId`, `triggeredBy`, duration, rule failures, and requirement
  blockers. Rationale: Meets Constitution SOC2 logging mandates, fuels the
  dashboard footer fields, and lets QA monitor frequency/failure rates.
  Alternatives considered: Lightweight console logging (fails compliance),
  bespoke logging per surface (duplication).

## System Context

- Frontend: React 19 app under `/apps/web` using TanStack Query, Zustand, and
  Playwright fixtures for document editor experiences.
- Backend: Express API under `/apps/api` with shared middleware
  (`ai-request-audit.ts`) and service container wiring quality-gate modules to
  SQLite repositories.
- Shared Libraries: Quality gate rules live in `/packages/qa`, shared models in
  `/packages/editor-core`, persistence in `/packages/shared-data`.
- Tooling: pnpm + Turborepo orchestrate builds, Vitest handles unit/contract
  suites, Playwright executes document-editor E2E coverage.
- Compliance: Audit and telemetry pipelines must emit structured events
  satisfying SOC2 logging directives from `CONSTITUTION.md`.

## Codebase Summary

- API modules reside in `/apps/api/src/modules/*` with routes registered via
  `/apps/api/src/routes`. Services obtain repositories through
  `services/container.ts`.
- Frontend document editor concentrates under
  `/apps/web/src/features/document-editor`, with stores in `stores/`, hooks in
  `hooks/`, and components in `components/`.
- Shared data repositories expose factories through `@ctrl-freaq/shared-data`;
  migrations run from `/packages/shared-data/src/migrations`.
- QA package CLI entry point is `/packages/qa/src/cli.ts`; extend it for new
  commands to keep parity with spec-driven workflows.
- Testing layout: API contract tests in `/apps/api/tests/contract`, web
  integration/unit tests under `/apps/web/tests`, with e2e fixtures ready for
  new flows.

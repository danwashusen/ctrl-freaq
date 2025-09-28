# Phase 0 Research — Document Editor Deep Links And Deterministic Fixtures

## Decision: Toggle deterministic fixtures with `VITE_E2E=true`

- **Rationale**: Matches the clarification outcome, integrates with Vite mode
  switching, and keeps production builds free of mock wiring. Enables CI/CD to
  flip the flag via `pnpm --filter @ctrl-freaq/web dev:e2e` or Playwright launch
  settings.
- **Alternatives Considered**:
  - `VITE_USE_MOCK_CLERK` only — already scoped to auth flows and would conflate
    concerns (rejected).
  - Playwright request interception — increases maintenance burden and hides
    drift between app and tests.

## Decision: Store fixtures as typed modules under `apps/web/src/lib/fixtures/e2e`

- **Rationale**: TypeScript modules provide compile-time checks against entity
  definitions, allow tree-shaking in production when flag disabled, and keep
  fixtures colocated with frontend consumers.
- **Alternatives Considered**:
  - JSON files served via static import — loses typing and requires manual
    schema validation.
  - Backend `/api` responder stubs — reintroduces server dependency and
    complicates library-first boundaries.

## Decision: Provide DocumentEditor data via an `E2EFixtureProvider`

- **Rationale**: Centralizes fixture access, mirrors the existing `ApiProvider`
  contract, and allows runtime swapping based on environment flag without
  scattering conditional logic across components.
- **Alternatives Considered**:
  - Pass fixtures directly into components — leaks test concerns and risks
    divergence.
  - Modify `ApiProvider` in place — would couple production networking logic
    with mocks.

## Decision: Render static AI transcripts during E2E flows

- **Rationale**: Ensures deterministic assertions for chat/assumption panels,
  satisfies spec success criteria, and avoids simulating LLM behavior while
  still demonstrating UI states.
- **Alternatives Considered**:
  - Generate pseudo-random transcripts — undermines deterministic screenshots
    and test baselines.
  - Disable AI panels — contradicts `/docs/front-end-spec.md` expectations and
    loses coverage.

## Decision: Preserve authentication prompt messaging in fixture mode

- **Rationale**: Constitution SOC2 rules require auth enforcement; fixture mode
  must still prompt sign-in to mirror production. Tests will use existing mock
  Clerk session helpers.
- **Alternatives Considered**:
  - Auto-bypass auth when `VITE_E2E` — would mask regressions and conflict with
    security principles.

## Latest Analysis Snapshot — 2025-09-28

- Document fixture pipeline is in place: typed schemas, demo architecture
  dataset, `/__fixtures` middleware, and an `E2EFixtureProvider` that the
  `ApiProvider` now mounts when `VITE_E2E === 'true'`.
- Routing gaps closed via `documentRoutes` loader; direct visits to
  `/documents/:documentId/sections/:sectionId` hydrate stores using fixture
  transformers and surface `DocumentMissing` for absent IDs.
- Assumption UI now renders deterministic transcripts/unresolved counts in both
  the preview card and modal; document store tracks `assumptionSessions` for
  active sections.
- Playwright + Vitest coverage added (deep-link, missing-fixture, assumption
  modal, contract test). Suites remain blocked because the web server command in
  `apps/web/playwright.config.ts` (`pnpm --filter @ctrl-freaq/web dev:e2e`)
  never exits; swap to a non-blocking launcher such as
  `pnpm --filter @ctrl-freaq/web dev:e2e`.
- Docs updated (README quickstart, spec quickstart), but instructions still cite
  the blocking command pending the fix above.
- Outstanding tasks: run lint/unit/E2E once the server command is corrected,
  capture fresh Playwright artifacts, and decide whether to keep or delete the
  generated `apps/web/test-results.json` placeholder from the failed attempt.

## System Context

- CTRL FreaQ runs as a pnpm-managed monorepo with React 18 frontend (`apps/web`)
  and Express API backend (`apps/api`), adhering to the library-first
  architecture and TDD rules defined in `CONSTITUTION.md`.
- Frontend routing currently covers `/dashboard`, `/project/:id`, and
  `/settings` only (`apps/web/src/App.tsx`); document routes must be added while
  preserving Clerk-based auth guards and structured logging (see
  `/docs/front-end-spec.md` and `/docs/ui-architecture.md`).
- Document and section editors rely on fixtures that mirror schemas in
  `/packages/templates/` and expectations documented in `/docs/architecture.md`;
  deterministic data must match Table of Contents, lifecycle states, and
  assumption flows described there.
- Playwright E2E suites live under `apps/web/tests/e2e/` and target selectors
  such as `toc-panel`, `section-preview`, and assumption conflict dialog
  controls; fixture mode must satisfy these selectors without live API traffic.
- `VITE_E2E=true` toggles fixture-backed providers during dev/test runs while
  production retains real API usage; Quickstart outlines the launch, testing,
  and reset commands required for QA completeness.

## Codebase Summary

- `apps/web/src/App.tsx` defines the React Router configuration and wraps routes
  with Clerk auth (`SignedIn`/`SignedOut`) plus `ApiProvider`; new document
  routes should integrate here or via a nested router module.
- `apps/web/src/lib/api-context.tsx` exposes `ApiProvider` and `useApi` helpers
  backed by `lib/api`; fixture mode must provide an alternative provider without
  mutating production client behavior.
- Document editor implementation lives in
  `apps/web/src/features/document-editor/` (components, hooks, services, stores)
  and `section-editor/`; these consume API data and render assumption workflows
  per UI spec.
- Shared utilities and logging live under `apps/web/src/lib/` (e.g., `logger`,
  `api`, `fixtures` placeholder directory) while global state sits in
  `apps/web/src/stores/`.
- UI primitives and layout are in `apps/web/src/components/` (shadcn-based UI,
  toasts), and page-level shells in `apps/web/src/pages/`.
- Playwright configs, spec files, and test artifacts reside in
  `apps/web/tests/e2e/`; failing suites reference
  `/documents/demo-architecture/sections/sec-api`.
- Backend services (not in scope) live under `apps/api`, but fixture
  implementations must avoid new backend dependencies; any schema alignment
  should reference `packages/templates/` and documentation in
  `/docs/architecture.md` and `/docs/front-end-spec.md`.

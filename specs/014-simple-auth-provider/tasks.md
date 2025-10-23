---
description: 'Tasks for Simple Auth Provider Mode implementation'
---

# Tasks: Simple Auth Provider Mode

**Input**: Design documents from `/specs/014-simple-auth-provider/`
**Prerequisites**: plan.md (required), spec.md (required), research.md,
data-model.md, contracts/ `simple-auth.openapi.yaml`, quickstart.md

**Tests**: Constitution mandates test-first development. Each story lists
failing tests that must be authored before implementation.

**Organization**: Tasks are grouped by user story so each slice can ship
independently.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no shared dependencies)
- **[Story]**: Story label — `Setup`, `Foundation`, `US1`, `US2`, `US3`,
  `Polish`
- Paths are repository-root anchored (e.g., `apps/api/src/...`).

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Introduce configuration scaffolding and reference assets required
by every story.

- [x] T001 [Setup] Document `AUTH_PROVIDER` and `SIMPLE_AUTH_USER_FILE` defaults
      in `.env.example` and describe usage comments.
- [x] T002 [P] [Setup] Add reference YAML at `templates/simple-auth-user.yaml`
      mirroring the schema in the spec.
- [x] T003 [Setup] Update `docs/simple-auth.md` and the authentication section
      of `README.md` with configuration steps and local-mode warning guidance.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core backend capabilities all stories depend on (Fail-fast YAML
loading, service registration, logging).

**⚠️ CRITICAL**: Complete before starting any user story.

- [x] T004 [Foundation] Author Vitest specs for YAML validation and duplicate-ID
      rejection in `apps/api/tests/unit/auth/simple-auth.service.test.ts`.
- [x] T005 [Foundation] Implement `SimpleAuthService` with Zod validation and
      caching in `apps/api/src/services/simple-auth.service.ts`.
- [x] T006 [Foundation] Extend configuration loaders (`apps/api/src/app.ts`,
      `apps/api/src/load-env.ts`) to resolve `AUTH_PROVIDER`, require
      `SIMPLE_AUTH_USER_FILE` in simple mode, and emit structured warnings when
      simple mode is active.
- [x] T007 [Foundation] Register `SimpleAuthService` in the service locator
      (`apps/api/src/core/service-locator.ts` and middleware wiring) so
      downstream middleware/routes can resolve it.

**Checkpoint**: Service boots in simple mode, YAML loads successfully, warning
appears once per startup.

---

## Phase 3: User Story 1 — Select a Local Test User (Priority: P1) 🎯 MVP

**Goal**: Developers can choose a predefined user from the simple auth list and
unlock protected web routes.

**Independent Test**: Start stack with `AUTH_PROVIDER=simple`, visit the web
app, select a user, and confirm dashboard renders with that identity. Repeat
after clearing local storage to ensure selector reappears.

### Tests (write before implementation)

- [x] T008 [US1] Add contract test for `GET /auth/simple/users` in
      `apps/api/tests/contract/auth/simple-auth-users.contract.test.ts`
      validating success and invalid YAML responses.
- [x] T009 [US1] Create frontend component test for the login selector in
      `apps/web/src/components/simple-auth/LoginScreen.test.tsx` covering user
      list rendering and reselection after stale ID.

### Implementation

- [x] T010 [US1] Implement `GET /auth/simple/users` route using the service in
      `apps/api/src/routes/auth/simple.ts` and export router.
- [x] T011 [US1] Register `/auth/simple/users` router ahead of `/api/v1` in
      `apps/api/src/app.ts`.
- [x] T012 [P] [US1] Build `SimpleAuthProvider` context in
      `apps/web/src/lib/auth-provider/SimpleAuthProvider.tsx` (fetch list,
      localStorage persistence, expose `useAuth`/`useUser`).
- [x] T013 [P] [US1] Implement `LoginScreen` UI with user cards and warning copy
      in `apps/web/src/components/simple-auth/LoginScreen.tsx`.
- [x] T014 [US1] Replace direct Clerk imports with provider selector exports in
      `apps/web/src/lib/auth-provider/index.ts`, `apps/web/src/main.tsx`, and
      other auth entry points.
- [x] T015 [US1] Ensure selected user state gates protected app shells (e.g.,
      update `apps/web/src/App.tsx` or relevant layout) so content renders only
      when signed in.

**Checkpoint**: Web app lists YAML users, selection unlocks the UI, and API
delivers metadata without auth.

---

## Phase 4: User Story 2 — Exchange Simple Tokens for API Access (Priority: P2)

**Goal**: API trusts `simple:<userId>` bearer tokens, rejects invalid tokens,
and seeds users into SQLite for downstream features.

**Independent Test**: With simple mode active, call a protected `/api/v1`
endpoint using `Authorization: Bearer simple:<id>` to receive 200; repeat with
malformed/unknown IDs and observe 401 responses.

### Tests (write before implementation)

- [x] T016 [US2] Author middleware unit tests for token parsing and rejection
      paths in `apps/api/tests/unit/auth/simple-auth.middleware.test.ts`.
- [x] T017 [US2] Add integration test hitting a protected route via supertest in
      `apps/api/tests/integration/auth/simple-auth.integration.test.ts` ensuring
      seeded users succeed.

### Implementation

- [x] T018 [US2] Implement `simpleAuthMiddleware` in
      `apps/api/src/middleware/simple-auth.middleware.ts` to validate
      `simple:<userId>` bearer tokens via `SimpleAuthService`.
- [x] T019 [US2] Update `apps/api/src/app.ts` to route `/api/v1` requests
      through Clerk middleware when configured, otherwise apply simple
      middleware plus `ensureTestUserMiddleware`.
- [x] T020 [US2] Enhance `apps/api/src/middleware/test-user-seed.ts` to upsert
      all YAML users before protected routes execute.
- [x] T021 [US2] Implement `POST /auth/simple/logout` stub (204) in
      `apps/api/src/routes/auth/simple.ts`.
- [x] T022 [US2] Update frontend API helpers (`apps/web/src/api/api-context.tsx`
      or fetch wrappers) to call `getToken()` from the provider so requests send
      `simple:<userId>`.
- [x] T023 [US2] Surface simple-mode warning banner in the web shell (e.g.,
      `apps/web/src/components/layout/AppHeader.tsx`) when provider is simple.

**Checkpoint**: Protected APIs accept valid simple tokens, reject invalid ones,
and user records exist in SQLite.

---

## Phase 5: User Story 3 — Switch Between Auth Providers (Priority: P3)

**Goal**: Teams can toggle between simple auth and Clerk using configuration
only, with clear warnings and documentation.

**Independent Test**: Flip `AUTH_PROVIDER` between `simple` and `clerk`, restart
services, and confirm appropriate auth flow appears without code changes or
stale UI.

### Tests (write before implementation)

- [x] T024 [US3] Add unit tests for provider resolution logic in
      `apps/api/tests/unit/config/auth-provider-config.test.ts` covering
      defaulting and required file checks.

### Implementation

- [x] T025 [US3] Centralize provider selection helpers in
      `apps/api/src/config/auth-provider.ts` (or equivalent) and reuse in
      `app.ts` and logging.
- [x] T026 [US3] Ensure Clerk-specific code paths short-circuit simple endpoints
      (`apps/api/src/app.ts`) so `/auth/simple/*` mounts only in simple mode.
- [x] T027 [US3] Update frontend bootstrapping (`apps/web/src/main.tsx`,
      `apps/web/src/lib/api-context.tsx`) to demand Clerk keys only when
      provider is `clerk`.
- [x] T028 [US3] Expand documentation (`docs/simple-auth.md`, `/README.md`) with
      explicit provider switching steps and troubleshooting.

**Checkpoint**: Switching env vars changes provider without lingering state;
docs reflect the process.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Cleanup, documentation, and validation spanning multiple stories.

- [x] T029 [Polish] Update quickstart instructions in
      `specs/014-simple-auth-provider/quickstart.md` based on implementation
      details and verification commands.
- [x] T030 [Polish] Refresh developer docs (`docs/architecture.md`,
      `docs/ui-architecture.md`) with brief notes about simple mode impact, if
      necessary.
- [x] T031 [Polish] Run recommended verification commands (`pnpm lint`,
      `pnpm typecheck`, `pnpm test`,
      `pnpm --filter @ctrl-freaq/web test:e2e:quick`) and capture results for
      the PR.
- [x] T032 [Polish] Conduct final accessibility pass on the login screen
      (keyboard navigation, aria attributes) in
      `apps/web/src/components/simple-auth/LoginScreen.tsx`.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 → Phase 2**: Setup must complete before foundational work.
- **Phase 2 → Phases 3-5**: Foundational service and config must exist before
  any user story begins.
- **Phase 6** depends on completion of all targeted user stories.

### User Story Dependencies

- **US1** (P1) depends on Phase 2 completion only.
- **US2** (P2) depends on US1’s service wiring (specifically routes and provider
  exports) and Phase 2.
- **US3** (P3) depends on US1+US2 to ensure switching covers both flows.

### Within Each Story

- Tests (T008/T009, T016/T017, T024) precede implementation tasks.
- Backend middleware updates precede frontend token usage.
- Docs and warnings finalize after functional work.

---

## Parallel Execution Examples

- During **US1**, T012 (provider context) and T013 (login screen) can progress
  in parallel once API contract test T008 is written.
- In **US2**, T018 (middleware) and T020 (user seeding) touch different files
  and can run concurrently after tests (T016/T017).
- In **Polish**, T031 (verification commands) and T032 (accessibility review)
  may run in parallel once docs are updated.

---

## Implementation Strategy

### MVP First (Deliver US1)

1. Complete Phases 1 and 2.
2. Implement US1 tasks (Tests → API route → UI provider) to unlock local login.
3. Validate using quickstart independent test before adding more stories.

### Incremental Delivery

- After MVP, add US2 to enable protected API access, then US3 for configuration
  parity.
- Each completed story should be demo-ready and independently testable.

### Parallel Team Strategy

- One developer can focus on backend tasks (T004–T021), another on frontend
  tasks (T012–T015, T022–T027), while a third handles documentation/polish
  (T023, T028–T032).

---

## Notes

- [P] tasks touch distinct files; avoid parallelizing tasks without the marker.
- Maintain TDD discipline: commit failing tests before implementing logic.
- Keep simple auth clearly labeled as local-only in logs and UI copy.

## Validation Checklist

- [x] All user stories include required tests and implementation tasks.
- [x] Every task references exact file paths.
- [x] Dependencies respect constitutional test-first requirements.
- [x] Foundational tasks precede user story work.
- [x] Parallel markers `[P]` applied only when paths do not conflict.

## Assumption Log

- Assumption: `js-yaml` is available in the workspace. Rationale: package
  already listed in monorepo dependencies per research; verify during
  implementation and add if missing. Status: Not present initially; added to
  `apps/api/package.json` during T005.
- Assumption: Backend auth routes will live under a new
  `apps/api/src/routes/auth/` folder. Rationale: Keeps simple auth endpoints
  isolated from `/api/v1` routes while preserving router ordering.

## Phase 4.R: Review Follow-Up

- [x] F001 Finding F001: Simple auth login overlay blocks Playwright gauntlet as
      described in audit.md
- [x] F002 Finding F002: Simple auth YAML not validated at bootstrap as
      described in audit.md
- [x] F003 Finding F003: Simple sign-out omits `/auth/simple/logout` handshake
      as described in audit.md
- [x] F004 Finding F004: Simple auth accepts duplicate user emails as described
      in audit.md
- [x] F005 Finding F005: Reference simple-auth user template missing from repo
      as described in audit.md
- [ ] F006 Finding F006: Branch protection missing required status checks as
      described in audit.md

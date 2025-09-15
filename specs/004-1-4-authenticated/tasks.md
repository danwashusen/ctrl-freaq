# Tasks: Authenticated App Layout + Dashboard

**Input**: Design documents from `/specs/004-1-4-authenticated/`
**Prerequisites**: plan.md (required), research.md, data-model.md, contracts/

## Execution Flow (main)

```
1. Load plan.md and design docs (done)
2. Generate tasks grouped by Setup → Tests → Core → Integration → Polish
3. Ensure tests precede implementation (TDD) and mark [P] where parallelizable
4. Number tasks sequentially and include file paths + dependencies
```

## Format: `[ID] [P?] Description`

- [P] = parallel-safe (different files, no deps)
- All paths are absolute from repo root

## Phase 3.1: Setup

- [x] T001 Ensure API test dirs exist and test runner config
  - /apps/api/tests/contract/, /apps/api/tests/integration/
  - Acceptance: `pnpm --filter @ctrl-freaq/api test` discovers tests
- [x] T002 Ensure Web test dirs exist and setup is configured
  - /apps/web/tests/integration/, /apps/web/tests/setup.ts
  - Acceptance: `pnpm --filter @ctrl-freaq/web test` runs with RTL setup
- [x] T003 Configure request ID propagation and response header in API
  - /apps/api/src/middleware/request-id.ts, applied first in app
  - Acceptance: all 2xx responses include `x-request-id` header (Vitest check)
- [x] T004 Configure Pino logger and child logger per request
  - /apps/api/src/middleware/logger.ts
  - Acceptance: logs include `{ requestId, userId }`, no console usage

## Phase 3.2: Tests First (TDD) — MUST FAIL INITIALLY

- [x] T005 [P] Contract test: GET /api/v1/projects
  - File: /apps/api/tests/contract/projects.list.contract.test.ts
  - Acceptance: Asserts 401 w/o JWT; 200 shape with JWT; pagination; alpha sort;
    lastModified='N/A'
- [x] T006 [P] Contract test: GET /api/v1/dashboard
  - File: /apps/api/tests/contract/dashboard.contract.test.ts
  - Acceptance: Asserts 401 w/o JWT; 200 shape; projects alpha sorted;
    activities=[]; stats
- [x] T007 [P] Contract test: GET /api/v1/activities
  - File: /apps/api/tests/contract/activities.contract.test.ts
  - Acceptance: Asserts 401 w/o JWT; 200 shape with [] and total=0; limit param
    bounds
- [x] T008 [P] Contract test: POST /api/v1/projects/:projectId/select
  - File: /apps/api/tests/contract/project.select.contract.test.ts
  - Acceptance: 401 w/o JWT; 204 on valid; 404 invalid id; 403 unauthorized; 400
    invalid UUID
- [x] T009 [P] Web integration test: Protected routing and default redirect
  - File: /apps/web/tests/integration/routing.dashboard.test.tsx
  - Acceptance: unauthenticated → /auth/sign-in; authenticated “/” →
    “/dashboard”
- [x] T010 [P] Web integration test: Sidebar projects alphabetical + selection
  - File: /apps/web/tests/integration/sidebar.projects.test.tsx
  - Acceptance: renders Projects group; alpha order; click sets active project
    in state and highlights active
- [x] T011 [P] Web integration test: Dashboard layout and empty activity
  - File: /apps/web/tests/integration/dashboard.layout.test.tsx
  - Acceptance: h1 "Dashboard"; two columns; Recent Activity shows "No recent
    activity yet"
- [x] T012 [P] Web integration test: Avatar rendering with fallback initials
  - File: /apps/web/tests/integration/avatar.fallback.test.tsx
  - Acceptance: uses Clerk image when present; otherwise initials shown

## Remediation Tasks (Pre‑implementation)

- [x] TR01 [P] Unit tests for ProjectRepository dashboard methods
  - File: /packages/shared-data/src/repositories/project.repository.test.ts
  - Acceptance: In‑memory SQLite; tests for findByUserId,
    findByUserIdWithMembers, countByUserId; edge cases (no projects, single
    project, multiple projects unsorted → alpha sorted in route)
- [x] TR02 [P] Frontend unit tests for dashboard Zustand store
  - File: /apps/web/src/stores/project-store.test.ts
  - Acceptance: setActiveProject, toggleSidebar, setViewMode; immutability;
    selector memoization
- [x] TR03 [P] Frontend unit tests for API services
  - Files:
    - /apps/web/src/lib/api/services/project-service.test.ts
    - /apps/web/src/lib/api/services/dashboard-service.test.ts
    - /apps/web/src/lib/api/services/activities-service.test.ts
  - Acceptance: Uses shared apiClient; injects Clerk token; handles ApiError; no
    secrets in logs; retries/headers as configured

## Phase 3.3: Core Implementation (ONLY after tests are failing)

- [x] T013 [P] Backend: Extend ProjectRepository with dashboard methods
      <!-- completed: 2025-09-15 17:20 -->
  - Files: /packages/shared-data/src/models/project.ts
  - Methods: findByUserId, findByUserIdWithMembers, countByUserId
  - Acceptance: unit tests for methods (in-memory SQLite) and type safety
- [x] T014 Backend: GET /api/v1/projects route
  - Files: /apps/api/src/routes/projects.ts, /apps/api/src/app.ts wiring
  - Behavior: Zod-validate query (limit 1–100, offset ≥0); Clerk user;
    repository fetch; alpha sort; lastModified='N/A'; include memberAvatars; set
    x-request-id
  - Acceptance: All T005 assertions pass; Service Locator used; Pino logs
    include requestId,userId
- [x] T015 Backend: GET /api/v1/dashboard route
  - Files: /apps/api/src/routes/dashboard.ts
  - Behavior: Aggregates projects + empty activities; stats.totalProjects; set
    x-request-id
  - Acceptance: All T006 assertions pass; Zod output shape validated in handler
- [x] T016 Backend: GET /api/v1/activities route (MVP empty)
  - Files: /apps/api/src/routes/activities.ts
  - Behavior: Zod-validate limit (1–50); return { activities: [], total: 0 }
  - Acceptance: All T007 assertions pass
- [x] T017 Backend: POST /api/v1/projects/:projectId/select route
  - Files: /apps/api/src/routes/projects.select.ts
  - Behavior: Zod-validate UUID path; verify ownership (repo lookup); set active
    project (MVP: no-op + 204 if owned); 403/404 accordingly; set x-request-id
  - Acceptance: All T008 assertions pass
- [x] T018 [P] Frontend: ProtectedRoute + route config default
  - Files: /apps/web/src/App.tsx
  - Behavior: Gate authenticated areas; default “/” → “/dashboard”
  - Acceptance: T009 passes; hooks rules honored
- [x] T019 Frontend: Sidebar “Projects” group and API integration
  - Files: /apps/web/src/components/sidebar/ProjectsNav.tsx,
    /apps/web/src/lib/api/services/project-service.ts
  - Behavior: Fetch /api/v1/projects via apiClient; alpha sort; render list; set
    active project in Zustand store; aria-label="Projects"
  - Acceptance: T010 passes; no direct state mutation; lazy imports as needed
- [x] T020 [P] Frontend: Dashboard page and layout
  - Files: /apps/web/src/pages/Dashboard.tsx
  - Behavior: h1 "Dashboard"; two-column grid; ProjectList renders name,
    summary, member avatars, lastModified='N/A'; RecentActivity shows empty
    state
  - Acceptance: T011 passes; role/name-based selectors; performance budget
    respected
- [x] T021 [P] Frontend: Avatar rendering with Clerk and fallback initials
  - Files: /apps/web/src/components/common/Avatar.tsx
  - Behavior: Use Clerk user image when provided; fallback to initials; no
    dangerouslySetInnerHTML
  - Acceptance: T012 passes; a11y labels applied

## Phase 3.4: Integration

- [x] T022 Backend: Apply request-id and logger middleware globally
      <!-- completed: 2025-09-15 17:34 -->
  - Files: /apps/api/src/app.ts
  - Acceptance: All 2xx include x-request-id; logs have requestId,userId
- [x] T023 Backend: Zod error translator and standardized error payloads
      <!-- completed: 2025-09-15 17:34 -->
  - Files: /apps/api/src/middleware/error-handler.ts
  - Acceptance: 400 VALIDATION_ERROR with details; 401 UNAUTHORIZED for auth
    failures; no thrown strings
- [x] T024 Backend: Service Locator registrations for repositories
      <!-- completed: 2025-09-15 17:20 -->
  - Files: /apps/api/src/services/container.ts
  - Acceptance: All routes resolve repos via req.services
- [x] T025 [P] Frontend: Zustand store for dashboard state
  - Files: /apps/web/src/stores/project-store.ts
  - Acceptance: API-independent (client state only); immutable updates;
    selectors memoized
- [x] T026 [P] Frontend: API client services
  - Files: /apps/web/src/lib/api/services/dashboard-service.ts,
    /apps/web/src/lib/api/services/project-service.ts,
    /apps/web/src/lib/api/services/activities-service.ts
  - Acceptance: Use shared apiClient; inject Clerk token; handle ApiError; no
    secrets in logs

## Phase 3.5: Polish

- [x] T027 [P] Unit tests for repositories (in-memory SQLite)
      <!-- completed: 2025-09-15 17:36 -->
  - Files: /packages/shared-data/src/repositories/\*.test.ts
  - Acceptance: 100% coverage for new public methods
- [x] T028 [P] Unit tests for frontend components/stores
      <!-- completed: 2025-09-15 17:36 -->
  - Files: /apps/web/src/components/\*_/**tests**/_.test.tsx,
    /apps/web/src/stores/\*.test.ts
  - Acceptance: RTL queries by role/name; avoid implementation-detail queries
- [x] T029 Performance checks and bundle analysis for dashboard route
      <!-- completed: 2025-09-15 17:36 -->
  - Files: /apps/web (build analysis)
  - Acceptance: meets documented perf budgets; lazy routes verified
- [x] T030 [P] Update quickstart with new endpoints and flows
      <!-- completed: 2025-09-15 17:36 -->
  - File: /specs/004-1-4-authenticated/quickstart.md
  - Acceptance: Steps reproducible locally; includes test commands
- [x] T031 [P] Update CLAUDE.md agent context with feature pointers
      <!-- completed: 2025-09-15 17:36 -->
  - File: /CLAUDE.md
  - Acceptance: Keep under token budget; add latest changes

## Dependencies

- T005–T012 before T013–T021 (tests before implementation)
- T013 blocks T014, T015, T017
- T014–T017 block corresponding web tests from passing
- T022–T024 after core routes wired
- Polish (T027–T031) after core + integration

## Parallel Execution Examples

```
# Contract tests in parallel
Task: /apps/api/tests/contract/projects.list.contract.test.ts
Task: /apps/api/tests/contract/dashboard.contract.test.ts
Task: /apps/api/tests/contract/activities.contract.test.ts
Task: /apps/api/tests/contract/project.select.contract.test.ts

# Web integration tests in parallel
Task: /apps/web/tests/integration/routing.dashboard.test.tsx
Task: /apps/web/tests/integration/sidebar.projects.test.tsx
Task: /apps/web/tests/integration/dashboard.layout.test.tsx
Task: /apps/web/tests/integration/avatar.fallback.test.tsx
```

## Validation Checklist

- All contract files mapped to contract tests
- All entities mapped to repository/model tasks
- Tests precede implementation
- [P] tasks are independent by file
- Each task specifies file paths
- No [P] tasks touch the same file

## Phase 3.6: Code Review Feedback from 2025-09-15 16:46

- [x] T032 [P] [Critical] Remove global test alias for zustand (prod config
      safety) <!-- completed: 2025-09-15 17:20 -->
  - Files: /apps/web/vite.config.ts, /apps/web/tests/setup.ts
  - Why: Prevents production build from loading test mocks; ensures real Zustand
    in runtime
  - Fix: Remove `resolve.alias` for `zustand` from Vite config; keep mocking via
    `vi.mock('zustand', …)` in tests or test-only config; install real
    dependency if missing
  - Acceptance: No alias for `zustand` in production config;
    `pnpm --filter @ctrl-freaq/web test` passes; app runtime uses real Zustand
- [x] T033 [P] [Major] Expose public ApiClient methods and update services
      (remove private access casts) <!-- completed: 2025-09-15 17:20 -->
  - Files: /apps/web/src/lib/api.ts,
    /apps/web/src/lib/api/services/project-service.ts,
    /apps/web/src/lib/api/services/dashboard-service.ts,
    /apps/web/src/lib/api/services/activities-service.ts
  - Why: Eliminate unsafe `any` casts to private `makeRequest`; stabilize API
    surface and typing
  - Fix: Add public `listProjects({ limit, offset })`, `getDashboard()`,
    `listActivities({ limit })` to ApiClient; update services to call these
    methods; remove `anyClient` cast branches
  - Acceptance: Typecheck passes; service tests updated and green; no usage of
    private/internal methods in services
- [x] T034 [P] [Minor] Use supertest(app) without app.listen in API tests
      <!-- completed: 2025-09-15 17:20 -->
  - Files: /apps/api/tests/contract/_.test.ts,
    /apps/api/tests/integration/_.test.ts
  - Why: Avoid EPERM in restricted environments; speed up tests; improve
    portability
  - Fix: Create app via `createApp()` and pass to `request(app)` directly;
    remove explicit `server = app.listen(...)`
  - Acceptance: API tests run without binding a port; CI-friendly; contract
    tests pass locally
- [x] T035 [P] [Minor] Tighten dashboard response typing per contract
      <!-- completed: 2025-09-15 17:20 -->
  - Files: /apps/api/src/routes/dashboard.ts
  - Why: Align handler output with OpenAPI; reduce drift from spec
  - Fix: Replace `z.any` arrays with typed Zod schemas for minimal `Project` and
    `Activity` fields referenced by UI; validate payload before respond
  - Acceptance: Typecheck passes; contract tests still green; handler returns
    shape consistent with OpenAPI example
- [x] T036 [Critical] Restore SOC 2 audit fields in database schema and seed
      helpers <!-- completed: 2025-09-15 19:55 -->
  - Files: /apps/api/migrations/001_initial_schema.sql,
    /apps/api/src/middleware/test-user-seed.ts, /apps/api/src/testing/reset.ts
  - Why: Removing `created_by`/`updated_by` columns erodes auditability required
    by architecture docs and SOC 2 controls; login and activity provenance
    becomes unverifiable
  - Fix: Reintroduce audit columns across affected tables; ensure test
    seed/update paths populate them; update tests to expect audit metadata
  - Acceptance: Migration reinstates audit columns; tests confirm inserts set
    audit fields; architecture compliance checklist passes
- [x] T037 [Major] Reinstate configuration key/value validation pipeline
      <!-- completed: 2025-09-15 19:55 -->
  - Files: /packages/shared-data/src/models/configuration.ts,
    /apps/api/src/routes/projects.ts, /apps/api/tests/\*\*
  - Why: Current route allows arbitrary keys/values, violating shared-data
    contracts and risking invalid config state
  - Fix: Restore repository-level key validation and PATCH handler checks using
    `ConfigurationUtils`; add tests covering rejection of unknown keys and
    non-conforming values
  - Acceptance: Contract/integration tests cover invalid config scenarios; only
    whitelisted keys persist; repository enforces constraints

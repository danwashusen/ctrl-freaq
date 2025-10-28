# Research: Project Lifecycle Management

**Date**: 2025-10-25  
**Spec**: [spec.md](/specs/016-a-user-should-be-able/spec.md)  
**Branch**: `016-a-user-should-be-able`

## Decisions

### D001 – Project status lifecycle

- **Decision**: Persist and expose `status` enumerations `draft`, `active`,
  `paused`, `completed`, `archived` for all project flows.
- **Rationale**: Aligns with clarified lifecycle, supports dashboard filtering,
  and gives archive/restore semantics without ad-hoc strings.
- **Alternatives considered**: Keep implicit boolean flags (rejected: hard to
  reason about lifecycle); use fewer statuses (rejected: lacks paused/completed
  nuance).

### D002 – Support multiple projects per user

- **Decision**: Remove the repository guard that limits users to a single
  project and update API/UX to page through project collections.
- **Rationale**: Spec expects dashboard listings and ongoing updates across
  projects; multi-project unlocks collaboration use cases.
- **Alternatives considered**: Retain single-project guard (rejected: conflicts
  with requirement to list projects on dashboard).

### D003 – Project visibility field

- **Decision**: Introduce `visibility` enum with values `private` (owner only)
  and `workspace` (all authenticated workspace members); default `workspace`.
- **Rationale**: Matches current single-tenant workspace context while allowing
  future extension; easy for validation.
- **Alternatives considered**: Free-form string (rejected: ambiguous); add
  `public` now (rejected: compliance review pending).

### D004 – Goal timeline capture

- **Decision**: Store `goal_target_date` as optional ISO date for the next major
  milestone, plus optional `goal_summary` short text to explain context.
- **Rationale**: Date supports timeline metrics; summary keeps UI helpful
  without forcing multi-field scheduler.
- **Alternatives considered**: Single text blob (rejected: harder to run
  date-driven reminders); start/end range (rejected: spec only needs high-level
  timeline).

### D005 – Concurrency guard

- **Decision**: Require clients to send `If-Unmodified-Since` header derived
  from project `updatedAt`; API rejects stale PATCH with 409 `VERSION_CONFLICT`.
- **Rationale**: Minimal change riding existing timestamps; no need for new
  version column; works with REST semantics.
- **Alternatives considered**: Introduce numeric version field (deferred: more
  invasive); optimistic patch without guard (rejected: violates FR-007).

### D006 – Archive & restore interface

- **Decision**: Add `DELETE /api/v1/projects/:id` to soft-delete (sets
  `deleted_at`, `deleted_by`, records the pre-archive status, sets
  `status=archived`) and `POST /api/v1/projects/:id/restore` to resurrect using
  the previously recorded status and metadata.
- **Rationale**: Mirrors RESTful patterns, leverages existing soft-delete
  fields, keeps audit logs consistent, and honours FR-009’s requirement to
  reinstate prior context.
- **Alternatives considered**: `PATCH status` only (rejected: ambiguous for
  undo); hard delete (rejected: breaks governance).

### D007 – Dashboard refresh strategy

- **Decision**: Use TanStack Query to centralize project list fetching with
  background refetch on create/update/archive events and websocket-less polling
  fallback.
- **Rationale**: Reuses query infrastructure, avoids manual state duplication,
  meets SC-002 responsiveness.
- **Alternatives considered**: Manual `useEffect` state (current) (rejected:
  duplicates logic, harder to invalidate); SSE stream (future work).

## Codebase Reconnaissance

### US1 – Create a new project from the dashboard

| Story/Decision                  | File/Directory                                | Role Today                                                            | Helpers/Configs                                                                                            | Risks & Follow-up                                                                                                      | Verification Hooks                                                                                                                |
| ------------------------------- | --------------------------------------------- | --------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| US1 / D001 / D002 / D003 / D004 | `/apps/api/src/routes/projects.ts`            | Handles POST `/projects` with single-project guard and limited fields | Service locator (`req.services`), `ProjectRepositoryImpl`, `ActivityLogUtils`, `ProjectUtils.generateSlug` | Must remove single-project constraint, validate new fields, return lifecycle info, ensure audit log keeps new metadata | `apps/api/tests/integration/projects.test.ts`, `apps/api/tests/contract/projects-api.test.ts`                                     |
| US1 / D001 / D003               | `/packages/shared-data/src/models/project.ts` | Defines schema without status/visibility/goal fields                  | Zod schemas, Better-SQLite base repo                                                                       | Requires schema + map updates, new enums, migration to add columns                                                     | `packages/shared-data/tests/project.model.test.ts` (add), CLI smoke via `pnpm --filter @ctrl-freaq/shared-data cli list-projects` |
| US1                             | `/packages/shared-data/src/migrations`        | Houses SQL migrations (no project lifecycle migration yet)            | `run-migrations.ts`, `20251013_quality_gates.ts` pattern                                                   | Need forward/backward-safe migration, default values for existing rows                                                 | `pnpm --filter @ctrl-freaq/shared-data cli migrate --dry-run`, integration tests boot DB                                          |
| US1 / D007                      | `/apps/web/src/pages/Dashboard.tsx`           | Imperatively fetches projects via `useEffect` and local state         | `useApi().projects.getAll`, `useNavigate`                                                                  | Refactor to TanStack Query, insert creation modal/form with validation                                                 | `apps/web/tests/e2e/dashboard/*.ts`, add Vitest component tests                                                                   |
| US1                             | `/apps/web/src/lib/api.ts`                    | Implements `createProject` request (no visibility/goal fields)        | Fetch wrapper with request ID, logger                                                                      | Extend payload typing, propagate concurrency metadata                                                                  | `apps/web/src/lib/api.test.ts` (add), integration via Playwright create flow                                                      |

### US2 – Review project summaries on the dashboard

| Story/Decision    | File/Directory                                      | Role Today                                                                   | Helpers/Configs                                 | Risks & Follow-up                                                                 | Verification Hooks                                                        |
| ----------------- | --------------------------------------------------- | ---------------------------------------------------------------------------- | ----------------------------------------------- | --------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| US2 / D001 / D002 | `/apps/api/src/routes/projects.ts`                  | GET `/projects` returns single project array with placeholder `lastModified` | `ListQuerySchema`, activity logging             | Must paginate true collection, include status, goal, visibility, archived filters | Contract test `projects.list.contract.test.ts`; update dashboard contract |
| US2 / D007        | `/apps/web/src/components/sidebar/ProjectsNav.tsx`  | Lists projects via Zustand store                                             | `useProjectStore`, `ProjectsNav` fetch pipeline | Ensure nav stays in sync with TanStack Query source, handles archived removal     | Component tests & Playwright navigation                                   |
| US2               | `/apps/web/src/lib/api/services/project-service.ts` | Thin wrapper returning DTO list                                              | `apiClient.listProjects`                        | Update DTO typings to include new fields & pagination metadata                    | Unit tests for service, query hook tests                                  |
| US2               | `/apps/web/tests/e2e`                               | Contains editor-focused flows, limited dashboard coverage                    | Playwright fixtures                             | Need new spec to assert dashboard cards show status/timestamps                    | Add `dashboard.project-list.e2e.ts`                                       |

### US3 – Update an existing project

| Story/Decision | File/Directory                                          | Role Today                                              | Helpers/Configs                                 | Risks & Follow-up                                                                          | Verification Hooks                                                           |
| -------------- | ------------------------------------------------------- | ------------------------------------------------------- | ----------------------------------------------- | ------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------- |
| US3 / D005     | `/apps/api/src/routes/projects.ts`                      | PATCH `/projects/:id` allows name/description updates   | `UpdateProjectRequestSchema`, slug regeneration | Must enforce `If-Unmodified-Since`, validate visibility/status changes, update goal fields | Integration test `projects.test.ts`, new contract tests for version conflict |
| US3 / D005     | `/apps/api/src/middleware/request-context.ts` (locator) | Injects `requestId`, logger                             | Request metadata                                | Confirm we propagate `updatedAt` to responses for clients to store                         | Supertest assertions                                                         |
| US3            | `/apps/web/src/pages/Project.tsx`                       | Handles editing template content; limited metadata form | Zustand template store, API client              | Introduce project metadata form with concurrency guard and success toasts                  | React Testing Library coverage, Playwright update flow                       |
| US3            | `/apps/web/src/lib/api-context.tsx`                     | Exposes project API methods to hooks                    | `apiClient.updateProject`                       | Need to add restore/archive/expose `If-Unmodified-Since` header mgmt                       | API context tests                                                            |

### US4 – Archive a project no longer in active use

| Story/Decision | File/Directory                                 | Role Today                                      | Helpers/Configs              | Risks & Follow-up                                                                | Verification Hooks                                                                 |
| -------------- | ---------------------------------------------- | ----------------------------------------------- | ---------------------------- | -------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| US4 / D006     | `/apps/api/src/routes/projects.ts`             | No DELETE/restore routes currently              | Activity logging, repository | Add DELETE + POST restore, ensure soft delete + status update, keep audit events | New contract tests (`projects.archive.contract.test.ts`), update integration suite |
| US4 / D006     | `/packages/shared-data/src/models/project.ts`  | Soft delete columns exist but helpers absent    | BaseRepository overrides     | Implement repository helpers (`archive`, `restore`, filters exclude archived)    | Unit tests for repository behaviour                                                |
| US4 / D007     | `/apps/web/src/pages/Dashboard.tsx`            | No archive controls                             | UI components, Buttons       | Add row actions (menu) respecting permissions, refresh query, show banner        | Playwright scenario for archive/restore                                            |
| US4            | `/apps/web/src/lib/api.ts`                     | `deleteProject` exists but unused; no `restore` | Request helper               | Wire to new endpoints, handle 204 responses                                      | API client unit tests                                                              |
| US4            | `/apps/api/tests/integration/projects.test.ts` | Already seeds project create/update             | Supertest + SQLite test DB   | Extend to cover delete/restore, ensure list excludes archived by default         | Vitest integration updates                                                         |

### TODO

| Story/Decision | File/Directory                     | Role Today                           | Helpers/Configs | Risks & Follow-up                                                                               | Verification Hooks                   |
| -------------- | ---------------------------------- | ------------------------------------ | --------------- | ----------------------------------------------------------------------------------------------- | ------------------------------------ |
| D002           | `/packages/shared-data/src/cli.ts` | CLI exposes limited project commands | Yargs-based CLI | Need to confirm whether new lifecycle ops require CLI exposure; follow-up during implementation | TODO – identify CLI acceptance tests |

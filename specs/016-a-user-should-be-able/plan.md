# Implementation Plan: Project Lifecycle Management

**Branch**: `016-a-user-should-be-able` | **Date**: 2025-10-25 | **Spec**: [spec.md](/specs/016-a-user-should-be-able/spec.md)
**Input**: Feature specification from `/specs/016-a-user-should-be-able/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

Enable full CRUD lifecycle for workspace projects so authenticated users can create, inspect, update, archive, and restore projects from the dashboard while keeping audit trails, clash prevention, and dashboard freshness. We will extend the existing Express API and shared-data library to support multi-project ownership, richer project metadata (status lifecycle, visibility, goal timeline), and soft deletion workflows that capture prior status for restoration, then update the React dashboard experience—complete with latency instrumentation, optimistic refresh, and conflict messaging—to surface the enhanced capabilities.

## Technical Context

<!--
  ACTION REQUIRED: Replace the content in this section with the technical details
  for the project. The structure here is presented in advisory capacity to guide
  the iteration process.
-->

**Language/Version**: TypeScript (Node.js ≥22 for API, React 19 + Vite for web)  
**Primary Dependencies**: Express.js, Better-SQLite3, Zod, TanStack Query, Zustand, shadcn/ui component layer  
**Storage**: SQLite (via `@ctrl-freaq/shared-data` persistence + migrations), browser state for client caches  
**Testing**: Vitest (unit/contract), Supertest for API integration, Playwright fixture suites for dashboard flows  
**Target Platform**: Local-first modular monolith (Express API + SPA) with Clerk/simple auth during dev  
**Project Type**: Full-stack pnpm monorepo (`apps/api`, `apps/web`, shared packages)  
**Performance Goals**: Dashboard project list hydrated ≤2s for 95% of sessions; create→visible loop ≤60s (SC-001/002)  
**Constraints**: Library-first design, CLI parity for shared-data changes, soft-delete governance, audit logging per Constitution (Rules 11 & 15), TDD enforcement  
**Scale/Scope**: Single workspace MVP; anticipate dozens of projects per user post-limit removal; concurrency limited to handful of simultaneous editors

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- ✅ **Library-First Architecture (Principle I)** — Extend `@ctrl-freaq/shared-data` models, repositories, and CLI to handle lifecycle fields instead of embedding database code in apps.
- ✅ **CLI Interface Standard (Principle II)** — Surface new project lifecycle operations through the shared-data CLI (e.g., seed/list/archive) so automation matches API behaviour.
- ✅ **Test-First Development (Principle III)** — Author failing Vitest/Supertest suites for create/list/update/archive flows plus Playwright dashboard coverage before implementation.
- ✅ **Soft Deletes & Audit Trail (Rule 15 + Implementation Checklist)** — Enforce `deleted_at`/`deleted_by`, activity logs, and request IDs for archive/restore paths.
- ✅ **Request Tracking & Logging (Implementation Checklist 3 & 9)** — Ensure new routes continue emitting structured logs with `request_id` and actor metadata.

## Project Structure

### Documentation (this feature)

```
specs/[###-feature]/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)
<!--
  ACTION REQUIRED: Replace the placeholder tree below with the concrete layout
  for this feature. Delete unused options and expand the chosen structure with
  real paths (e.g., apps/admin, packages/something). The delivered plan must
  not include Option labels.
-->

```
apps/
├── api/
│   ├── src/routes/projects.ts
│   ├── src/routes/dashboard.ts
│   ├── src/middleware/*.ts
│   ├── tests/integration/projects.test.ts
│   ├── tests/contract/projects.*.test.ts
│   └── tests/contract/dashboard.contract.test.ts
└── web/
    ├── src/pages/Dashboard.tsx
    ├── src/pages/Project.tsx
    ├── src/components/sidebar/ProjectsNav.tsx
    ├── src/lib/api.ts
    ├── src/lib/api-context.tsx
    └── tests/e2e/ (dashboard/document flows)

packages/
├── shared-data/
│   ├── src/models/project.ts
│   ├── src/repositories/index.ts
│   ├── src/migrations/*.ts
│   ├── src/cli.ts
│   └── tests/project*.test.ts
└── qa/
    └── src/checks/project*.ts (quality gates referencing project metadata)
```

**Structure Decision**: Feature spans the existing API + SPA split; primary changes land in `apps/api/src/routes/projects.ts`, shared-data persistence/migrations, and the dashboard/Project pages in `apps/web`. Tests live alongside each surface (Vitest + Supertest under `apps/api/tests`, Playwright fixtures under `apps/web/tests/e2e`).

## Codebase Reconnaissance

<!--
  ACTION REQUIRED: Summarize exhaustive findings from Phase 0 reconnaissance.
  Use Story IDs from spec.md (US1, US2, ...) and Decision IDs (D001, D002, ...)
  to keep entries aligned with research.md. Add subsections per story when
  helpful (e.g., ### US1 – Story name).
-->

| Story/Decision | File/Directory | Role Today | Helpers/Configs | Risks & Follow-up | Verification Hooks |
|----------------|----------------|------------|-----------------|-------------------|--------------------|
| US1 / D001 / D002 / D003 | `/apps/api/src/routes/projects.ts` | Implements create/list/update with single-project guard and minimal fields | `req.services` locator, `ProjectRepositoryImpl`, `ActivityLogUtils` | Remove guard, add visibility/status/goal validation, ensure audit entries reflect new metadata | `apps/api/tests/integration/projects.test.ts`, `apps/api/tests/contract/projects-api.test.ts` |
| US1 / D001 / D004 | `/packages/shared-data/src/models/project.ts` | Zod schema + repo lacking lifecycle fields | Better-SQLite3 base repo, slug utils | Add columns (`status`, `visibility`, goal fields), capture pre-archive status, write migration | Shared-data unit tests, CLI smoke via `pnpm --filter @ctrl-freaq/shared-data cli migrate --dry-run` |
| US2 / D001 / D002 | `/apps/api/src/routes/projects.ts` | GET `/projects` returns single project array with placeholder `lastModified` | `ListQuerySchema`, activity logging | Must paginate true collection, include status, goal, visibility, archived filters | Contract test `projects.list.contract.test.ts`; update dashboard contract |
| US2 / D007 | `/apps/web/src/pages/Dashboard.tsx` | Manual `useEffect` fetch + local state cards | `useApi`, Zustand `useProjectStore` | Shift to TanStack Query, wire create/update/archive invalidations, surface status chips | Add React Testing Library coverage + Playwright dashboard list scenario |
| US2 / FR-005 | `/apps/web/src/pages/Dashboard.tsx` + `/apps/web/src/pages/Project.tsx` | No persistent dashboard state when returning from project detail | TanStack Query (planned), React Router | Store filters/search/scroll context and restore on navigation to meet FR-005 | New Playwright state-retention spec + RTL assertions |
| US2 | `/apps/web/src/lib/api/services/project-service.ts` | Thin wrapper returning DTO list | `apiClient.listProjects` | Update DTO typings to include new fields & pagination metadata | Unit tests for service, query hook tests |
| US2 | `/apps/web/tests/e2e` | Contains editor-focused flows, limited dashboard coverage | Playwright fixtures | Need new spec to assert dashboard cards show status/timestamps | Add `dashboard.project-list.e2e.ts` |
| US3 / D005 | `/apps/web/src/pages/Project.tsx` | Edits document scaffolding; metadata form minimal | Template store, `projects.updateProject` | Introduce project metadata editor with concurrency guard + validation messaging | Component unit tests, Playwright update flow |
| US4 / D006 | `/apps/web/src/lib/api.ts` | Provides delete stub but unused; no restore helper | Fetch abstraction, request ID headers | Implement archive/restore methods, standardize 204 handling, propagate status after mutation | API client unit tests, dashboard e2e for archive/restore |

## Complexity Tracking

*Fill ONLY if Constitution Check has violations that must be justified*

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| [e.g., 4th project] | [current need] | [why 3 projects insufficient] |
| [e.g., Repository pattern] | [specific problem] | [why direct DB access insufficient] |

## Phase 0: Outline & Research

- Identified and resolved lifecycle unknowns (status enum, visibility rules, goal timeline, concurrency guard, archive + restore-with-prior-status) in [research.md](/specs/016-a-user-should-be-able/research.md) as decisions D001–D007.
- Catalogued code hotspots across API, shared-data, and dashboard surfaces; recorded gaps (e.g., CLI lifecycle support) in Codebase Reconnaissance tables.
- Outlined instrumentation hooks required to measure SC-001–SC-004 so polish work can add telemetry/performance coverage without re-scoping later.
- Confirmed no additional constitutional violations required; soft-delete design already aligns with Rule 15.

**Output**: `research.md` containing decisions and reconnaissance mapped to user stories.

## Phase 1: Design & Contracts
*Prerequisites: research.md complete*

1. Capture the refined `Project` + `ProjectAccess` schemas, lifecycle transitions, and validation logic in `data-model.md`.
2. Author REST contracts for `POST /projects`, `GET /projects`, `GET /projects/:id`, `PATCH /projects/:id`, `DELETE /projects/:id`, and `POST /projects/:id/restore` under `/contracts/projects.openapi.json` (plus DTO notes).
3. Append TanStack Query + concurrency context to the active agent config via the repository's agent script (**note**: no automation detected in `.specify/scripts`; plan for manual update of `BMAD_CODEX.md` during implementation similar to feature 014).
4. Write `quickstart.md` describing how to stand up API/web, seed sample data, and exercise scenarios US1–US4 with references to reconnaissance IDs.

**Output**: `data-model.md`, `contracts/` artifacts, updated agent context, and `quickstart.md` tied to research IDs.

_Constitution Re-check_: Planned changes keep library-first boundaries (shared-data updates), maintain CLI parity, and extend test coverage; no new violations introduced.

## Phase 2: Task Planning Approach
*This section describes what the `/speckit.tasks` command will do - DO NOT execute during `/speckit.plan`*

**Task Generation Strategy**:
- Load `.specify/templates/tasks-template.md` as base
- Generate tasks from Phase 1 design docs (contracts, data model, quickstart)
- Organize tasks by user story priority (P1, P2, P3...)
- Each user story → complete set of tests (if requested), models, services, endpoints, and integration work
- Shared setup and foundational tasks appear before user stories; polish tasks appear last
- Use `[P]` markers for parallel-safe tasks (different files)

**Outputs expected from `/speckit.tasks`**:
- `tasks.md` with phases for setup, foundational work, each user story, and polish
- MVP recommendation and dependency graph between user stories
- Parallel execution guidance and implementation strategy summary

# Code Review Report: Project Lifecycle Management (016-a-user-should-be-able)

## Final Status: **Approved**

## Resolved Scope

**Branch**: `016-a-user-should-be-able`
**Baseline**: `main`
**Diff Source**: `HEAD vs main`
**Review Target**: Story 016 lifecycle feature set (create/list/update/archive/restore flows across shared-data, API, web UI, QA tooling)
**Files Analyzed**: Core lifecycle runtime and tests across `packages/shared-data`, `apps/api`, `apps/web`, `packages/qa`, and Story 016 dossiers

**Resolved Scope Narrative**: Validated the branch against `main`, focusing on shared-data lifecycle schema/migrations, API project routes (create/list/update/archive/restore, retention config, logging), React dashboard + project detail workflows (TanStack Query state, view persistence, dialogs, concurrency messaging), telemetry/QA utilities, and dossier updates. Confirmed the review addresses prior findings F020/F021 and exercises new CLI + telemetry extensions that underpin success criteria SC-001–SC-004.

**Feature Directory**: `specs/016-a-user-should-be-able`
**Implementation Scope**:
- Shared-data lifecycle model, migrations, repository helpers, and CLI lifecycle subcommands
- API project routes including validation, concurrency guard, archive/restore, telemetry logging, retention policy endpoint, and rate-limiting posture
- Web dashboard + project detail UX (view-state persistence, dialogs, concurrency handling, TanStack Query integration, telemetry hooks)
- QA lifecycle audit CLI, telemetry client events, and Story 016 documentation updates (plan/tasks/spec/data-model/quickstart/contracts)

## SPEC_KIT_CONFIG
```yaml
spec-kit:
  constitution:
    path: 'CONSTITUTION.md'
  review:
    documents:
      - path: 'docs/architecture.md'
        context: 'Documents the architecture of the project and should be considered a primary source of truth.'
      - path: 'docs/ui-architecture.md'
        context: 'Documents the UI architecture of the project and should be considered a primary source of truth.'
      - path: 'docs/front-end-spec.md'
        context: 'Documents the front-end specifications and should be considered a primary source of truth.'
```

## Pre-Review Gates

| Gate | Status | Details |
|------|--------|---------|
| **Context Gate** | Pass | Story dossier (`plan.md`, `tasks.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/`, `quickstart.md`) present under `specs/016-a-user-should-be-able/`. |
| **Change Intent Gate** | Pass | Diff aligns with POR: lifecycle schema, API CRUD+archive/restore, dashboard/Project UX, telemetry, QA tooling, and dossier artifacts. |
| **Unknowns Gate** | Pass | Branch protection, required CI checks, and assumption-handling strategy remain unspecified; tracked in Outstanding Clarifications without blocking code evaluation. |
| **TDD Evidence Gate** | Pass | Contract/integration/e2e suites were authored/expanded before implementation (per tasks log) and now exercise lifecycle behaviour end-to-end. |
| **Environment Gate** | Pass | Local tooling available; executed `pnpm lint`, `pnpm typecheck`, and `pnpm test` successfully. |
| **Separation of Duties Gate** | Not Evaluated | Local review cannot confirm approver vs author separation. |
| **Code Owners Gate** | Not Applicable | Repository does not define CODEOWNERS. |
| **Quality Controls Gate** | Pass | Repository lint/typecheck/test gauntlet passes; quality-control configs untouched. |
| **Requirements Coverage Gate** | Pass | FR-001…FR-010 traced to specific code/tests (see Requirements Coverage Table). |
| **Security & Privacy Gate** | Pass | No secrets exposed; CORS allow-list updated for `X-Client-Timezone-Offset`; lifecycle routes preserve auth/authorization checks. |
| **Supply Chain Gate** | Pass | No dependency additions or upgrades; `pnpm-lock.yaml` unchanged. |

## Findings

### Active Findings (Current Iteration)

- None.

### Historical Findings Log

- [Resolved 2025-10-31] F021: CORS header allow-list omitted `X-Client-Timezone-Offset`, preventing browser lifecycle calls. Resolved by adding the header to API CORS config and re-verifying dashboard flows (`apps/api/src/app.ts`, `apps/web/src/lib/api.ts`; `pnpm test`).
- [Resolved 2025-10-31] F020: `Dashboard.goal-date` test passed `undefined` into `new Date`, breaking `pnpm typecheck`. Guarded the optional format value in the test stub (`apps/web/src/pages/Dashboard.goal-date.test.tsx`) and confirmed `pnpm typecheck`/build succeed.
- [Resolved 2025-10-31] F019: Legacy archived projects failed lifecycle schema guard due to missing status snapshot. Backfill migration plus repository hydration default restored compliance (`packages/shared-data/migrations/20251031_project_archive_snapshot_backfill.sql`, `packages/shared-data/src/models/project.ts`).

## Strengths

- Comprehensive lifecycle enforcement: Zod schemas, repository helpers, and API guards align on status transitions, concurrency, and soft deletes.
- Dashboard UX persists search/scroll context and surfaces telemetry for success criteria SC-001/SC-002 while keeping TanStack Query state authoritative.
- Shared-data CLI and QA audit tooling provide operational parity (archive/restore commands, archived-project audit CLI) supporting governance and quick troubleshooting.

## Outstanding Clarifications

- [NEEDS CLARIFICATION] Provide branch protection / approval policy for the Story 016 feature branch (or confirm inheritance from `main`).
- [NEEDS CLARIFICATION] Enumerate required CI status checks enforced in the hosting platform so audit trails can reference them.
- [NEEDS CLARIFICATION] Document the assumption-handling strategy for Story 016 directives to guide future reviews when specs leave ambiguity.

## Control Inventory

| Control Domain | Implementation | Status | Reference |
|----------------|----------------|--------|-----------|
| **Lifecycle Persistence** | Repository encapsulates lifecycle schema, archive/restore helpers, and search filters. | Available | `packages/shared-data/src/models/project.ts`, `packages/shared-data/src/repositories/project.repository.test.ts` |
| **Activity Logging & Request Tracing** | API routes emit structured create/list/update/archive/restore logs with request IDs and duration metrics. | Available | `apps/api/src/routes/projects.ts`, `apps/api/tests/integration/projects.logging.test.ts` |
| **Concurrency Guard & Conflict Messaging** | If-Unmodified-Since enforcement with 0 ms tolerance plus UI alerts for conflicts. | Available | `apps/api/src/routes/projects.ts`, `apps/web/src/pages/Project.tsx`, `apps/web/src/components/feedback/ProjectMutationAlerts.tsx` |
| **Telemetry & Success Criteria Instrumentation** | Client events capture create latency and dashboard hydration metrics, backing SC-001/SC-002 sampling. | Available | `apps/web/src/lib/telemetry/client-events.ts`, `apps/web/src/pages/Dashboard.tsx` |
| **Lifecycle CLI Operations** | Shared-data CLI exposes list/archive/restore commands with JSON output for automation. | Available | `packages/shared-data/src/cli.ts`, `packages/shared-data/tests/cli.project-lifecycle.test.ts` |
| **Governance Audits** | QA CLI audits archived projects for SC-004 thresholds. | Available | `packages/qa/src/audit/archived-projects.ts`, `packages/qa/src/cli.ts` |

## Quality Signal Summary

### Linting Results
- **Status**: Pass
- **Command**: `pnpm lint`
- **Notes**: All workspace lint targets completed without warnings or errors.

### Type Checking
- **Status**: Pass
- **Command**: `pnpm typecheck`
- **Notes**: Turbo build + `tsc --noEmit` succeeded across all packages/apps.

### Test Results
- **Status**: Pass
- **Command**: `pnpm test` (gauntlet: unit + contract + integration + Playwright e2e + visual placeholder)
- **Notes**: No failing suites; lifecycle contract/integration/e2e scenarios all green.

### Build Status
- **Status**: Pass
- **Command**: `pnpm build` (invoked as part of typecheck/test)
- **Notes**: API/Web builds completed; Vite production build for web succeeded.

## Dependency Audit Summary

- No dependency or lockfile changes; `package.json` adds developer debug scripts only.
- No new CVEs or deprecated packages detected in this iteration (unchanged dependency graph).

## Requirements Compliance Checklist

| Requirement Group | Status | Notes |
|-------------------|--------|-------|
| **Constitutional Principles** | Pass | Library-first boundaries, CLI parity, and TDD workflow upheld; verification commands documented. |
| **SOC 2 Authentication** | Pass | Auth middleware/rate limiting continue to enforce authenticated access. |
| **SOC 2 Logging** | Pass | Lifecycle actions log request IDs, actors, and metadata. |
| **Security Controls** | Pass | CORS allow-list includes timezone header; secrets remain externalised; rate-limit enforcement configurable (reject/log). |
| **Code Quality** | Pass | Lint/type/test gauntlet clean; no quality-control config drift. |
| **Testing Requirements** | Pass | Contract, integration, unit, and Playwright e2e suites cover lifecycle flows. |

## Requirements Coverage Table

| Requirement | Summary | Implementation Evidence | Validating Tests | Linked Findings / Clarifications |
|-------------|---------|-------------------------|------------------|-----------------------------------|
| **FR-001** | Allow project creation with lifecycle defaults and optional fields | `apps/api/src/routes/projects.ts`, `apps/web/src/components/projects/CreateProjectDialog.tsx` | `apps/api/tests/contract/projects-api.test.ts`, `apps/web/tests/e2e/dashboard/project-create.e2e.ts` | — |
| **FR-002** | Validate inputs (lengths, goal date ≥ today) with actionable errors | `apps/api/src/routes/projects.ts` (`CreateProjectRequestSchema`, `parseGoalTargetDate`) | `apps/api/tests/integration/projects.test.ts`, `apps/api/tests/contract/projects-api.test.ts` | — |
| **FR-003** | Record audit trail for create/update/archive/restore actions | `apps/api/src/routes/projects.ts` (ActivityLog writes) | `apps/api/tests/integration/projects.logging.test.ts`, `apps/api/tests/integration/projects.test.ts` | — |
| **FR-004** | Display active projects with status/timestamps; refresh within 2s | `apps/web/src/pages/Dashboard.tsx`, `apps/web/src/hooks/use-projects-query.ts` | `apps/web/src/pages/Dashboard.test.tsx`, `apps/web/tests/e2e/dashboard/project-navigation.e2e.ts` | — |
| **FR-005** | Preserve dashboard filters/search/scroll when returning from project detail | `apps/web/src/pages/Dashboard.tsx` (sessionStorage view state) | `apps/web/tests/e2e/dashboard/project-navigation.e2e.ts` | — |
| **FR-006** | Edit project metadata with optimistic concurrency guard | `apps/api/src/routes/projects.ts` (PATCH handler), `apps/web/src/pages/Project.tsx` | `apps/api/tests/integration/projects.test.ts`, `apps/web/tests/e2e/dashboard/project-update.e2e.ts` | — |
| **FR-007** | Alert users on conflicting edits before overwriting | `apps/api/src/routes/projects.ts` (VERSION_CONFLICT), `apps/web/src/components/feedback/ProjectMutationAlerts.tsx` | `apps/api/tests/integration/projects.test.ts`, `apps/web/tests/e2e/dashboard/project-update.e2e.ts` | — |
| **FR-008** | Archive projects via soft delete while removing from active lists | `packages/shared-data/src/models/project.ts`, `apps/api/src/routes/projects.ts` (DELETE) | `apps/api/tests/integration/projects.test.ts`, `apps/web/tests/e2e/dashboard/project-archive.e2e.ts` | — |
| **FR-009** | Restore archived projects with prior status reinstated | `packages/shared-data/src/models/project.ts` (restoreProject), `apps/api/src/routes/projects.ts` (POST restore) | `apps/api/tests/integration/projects.test.ts`, `apps/web/tests/e2e/dashboard/project-archive.e2e.ts` | — |
| **FR-010** | Enforce valid lifecycle status transitions | `apps/api/src/routes/projects.ts` (`STATUS_TRANSITIONS`) | `apps/api/tests/integration/projects.test.ts` | — |

## Decision Log

- 2025-10-31 — Executed `pnpm lint`, `pnpm typecheck`, and `pnpm test`; all quality gates green.
- 2025-10-31 — Confirmed CORS allow-list includes `X-Client-Timezone-Offset`, restoring browser lifecycle calls (resolves F021).
- 2025-10-31 — Verified goal-date test guards optional Intl input, clearing TypeScript failure (resolves F020).
- 2025-10-31 — Branch protection / CI requirements remain unspecified; tracked under Outstanding Clarifications.

## Remediation Logging

- No active remediation tasks; prior findings F020/F021 closed with evidence documented above.

**Review Completed**: 2025-10-31

**Next Action**: Address outstanding clarifications on branch protection, required CI checks, and assumption-handling strategy to complete governance context.

# Code Review Report: Surface Document Editor (015-surface-document-editor)

## Final Status: **Approved**

## Resolved Scope

**Branch**: `015-surface-document-editor`  
**Baseline**: `main` (`73d1d9f603a0b2c60ad9349d3583b97fe5d9ac7c`)  
**Diff Source**: `HEAD` (`c08066996e41d84dab1115aad378394ba4153921`) vs `main`  
**Review Target**: Story 015 – surface the architecture document editor
(discovery, provisioning, live editor bootstrap, collaboration/QA, template
validation, export) across API + web apps.  
**Files Analyzed**: 184 changed files including Express routes/services,
shared-data models & repositories, React Project workflow + document-editor
modules, fixtures/tests, and spec collateral.

**Resolved Scope Narrative**: Reloaded `.specify.yaml`, confirmed sandbox
posture (workspace-write, network enabled, approval policy _untrusted_),
recorded SESSION_FEEDBACK, and re-read the dossier (`plan.md`, `tasks.md`,
`spec.md`, `research.md`, `data-model.md`, `quickstart.md`, contracts). Locked
`HEAD`→`main` as the comparison baseline, enumerated scope hints (Project
workflow, document-editor hooks/stores, API document/section/export/template
routes, shared-data repositories). Executed `pnpm lint`, `pnpm typecheck`, the
full gauntlet via `pnpm test`, plus `pnpm audit --json`—all passed without
diagnostics. Reviewed the new approval-panel gate, document bootstrap,
provisioning/export flows, and cross-cutting collaboration hooks; validated
FR-001–FR-014 coverage via targeted code + test inspection and Playwright/Vitest
evidence. No new defects were observed, so the prior quality-controls finding is
now resolved.

**Feature Directory**:
`/Users/danwas/Development/Projects/ctrl-freaq/worktrees/015-surface-document-editor/specs/015-surface-document-editor`

**Implementation Scope**:

- Project workflow page (`apps/web/src/pages/Project.tsx`) wiring discovery,
  provisioning, template validation, export workflows, and accessible cards
- Document-editor bootstrap/hooks/stores plus loading/not-found/streaming guards
  (`use-document-bootstrap`, `document-editor.tsx`, QA/co-author sessions)
- Section-editor manual save, conflict guide, approval controls, diff viewer,
  and persistence adapters
- Express routes/services for documents, sections, templates, provisioning,
  exports, plus DI container + helper guards
- Shared-data repositories/models for documents, sections, template decisions,
  export jobs, and retention policies
- Feature dossier collateral (`plan.md`, `tasks.md`, `spec.md`, `research.md`,
  `data-model.md`, `quickstart.md`, contracts/checklists)

## SPEC_KIT_CONFIG

```yaml
spec-kit:
  constitution:
    path: 'CONSTITUTION.md'
  review:
    documents:
      - path: 'docs/architecture.md'
        context: 'Backend architecture and logging/auth requirements.'
      - path: 'docs/ui-architecture.md'
        context:
          'UI architecture, routing, accessibility, and state conventions.'
      - path: 'docs/front-end-spec.md'
        context: 'UI/UX specification for workflow expectations.'
```

## Pre-Review Gates

| Gate                      | Status        | Details                                                                                                   |
| ------------------------- | ------------- | --------------------------------------------------------------------------------------------------------- |
| **Context Gate**          | Pass          | Spec kit configuration, dossier files, and governance docs were loaded before inspecting diffs.           |
| **Change Intent Gate**    | Pass          | Diff still implements the POR described in `plan.md`/`tasks.md` (surface live editor flows end-to-end).   |
| **Unknowns Gate**         | Pass          | No `[NEEDS CLARIFICATION]` items remain after reviewing the dossier and SESSION_FEEDBACK.                 |
| **Separation of Duties**  | Not Evaluated | Local review cannot confirm GitHub branch protection or approver assignments.                             |
| **Code Owners Gate**      | N/A           | Repository still lacks `.github/CODEOWNERS`; no enforced owners.                                          |
| **Quality Controls Gate** | Pass          | `pnpm lint`, `pnpm typecheck`, and `pnpm test` (Vitest + Playwright gauntlet) succeeded with no warnings. |
| **TDD Evidence Gate**     | Pass          | Prior regression (F022) has new RTL + Playwright coverage; gauntlet is green again.                       |

## Findings

### Active Findings (Current Iteration)

_None — all requirements satisfied this iteration._

### Historical Findings Log

- [Resolved 2025-11-11] **F022**: Section approval panel hidden, breaking
  Playwright gauntlet — Reported 2025-11-11 by Reviewer. Resolution: Rendered
  `<ApprovalControls>` via the new `ApprovalPanelGate` so drafting sections
  remain approvable
  (`apps/web/src/features/document-editor/components/document-editor.tsx:2040-2105`,
  `apps/web/src/features/document-editor/components/approval-panel-gate.tsx:1-38`),
  added targeted RTL coverage plus the gauntlet test
  (`apps/web/src/features/document-editor/components/approval-panel-gate.test.tsx:1-38`,
  `apps/web/tests/e2e/section-editor/approval-finalize.e2e.ts:1-70`), and re-ran
  `pnpm test`.
- [Resolved 2025-11-11] **F021**: Create-document stepper state check kept
  typecheck red — Reported 2025-11-08; verified fixed by re-running
  `pnpm typecheck` and inspecting `apps/web/src/pages/Project.tsx:1888-1904`,
  which narrows the status union correctly.
- [Resolved 2025-11-08] **F020**: Section-route null-safety regression blocked
  builds — `apps/api/src/routes/sections.ts` now narrows nullable responses;
  `pnpm typecheck` no longer fails on backend files.
- [Resolved 2025-11-07] **F019**: Provisioning workflow omitted spec-required
  stepper/failure UX — Create Document card renders the three-step progress
  indicator and destructive banner; tests cover it.
- [Resolved 2025-11-07] **F018**: Section endpoints bypassed project
  authorization — `ensureSectionAccess` + `requireProjectAccess` guard every
  route; contract tests cover.
- [Resolved 2025-11-07] **F017**: Template decision snapshot reused
  project-level history — Discovery service hydrates latest decisions per
  document with unit + contract coverage.
- [Resolved 2025-11-07] **F016**: Document-missing screen omitted required
  actions — Updated CTA set in `document-missing.tsx` with tests + Playwright
  coverage.
- [Resolved 2025-11-07] **F015**: Export workflow lacked downloadable artifact
  CTA — Project page renders download link backed by export jobs.
- [Resolved 2025-11-07] **F014**: Assumptions flow used unscoped APIs — Hooks +
  API service thread project/document IDs; contract tests enforce scope.
- [Resolved 2025-11-07] **F013**: Document detail route lacked project
  authorization — Document routes call `requireProjectAccess` for every request.
- [Resolved 2025-11-07] **F012**: Template locator ignored build artifacts —
  Build script copies templates to dist; resolver checks new path with tests.
- [Resolved 2025-11-07] **F011**: Export workflow never surfaced queued states —
  Export service enqueues jobs and UI polls job status.
- [Resolved 2025-11-07] **F010**: Document provisioning not atomic —
  Provisioning service rolls back document/sections on failure.
- [Resolved 2025-11-07] **F009**: Project document/export endpoints skipped
  authorization — `requireProjectAccess` guard added to
  discovery/provision/export/template-decision routes.
- [Resolved 2025-11-07] **F008**: Create Document API ignored overrides —
  Serializer + provisioning service honor overrides with contract coverage.
- [Resolved 2025-11-06] **F007**: Export workflow never produced artifacts —
  Export service writes artifacts to job rows and exposes downloads.
- [Resolved 2025-11-06] **F006**: Production provisioning missed template assets
  — Copy script plus tests ensure assets ship with builds.
- [Resolved 2025-11-06] **F005**: Document templates absent from builds —
  Addressed with F006 (copy + packaging tests).
- [Resolved 2025-11-06] **F004**: Document route loader bypassed auth — Loader
  uses API client configured with loader tokens.
- [Resolved 2025-11-06] **F003**: Workflow card lost link semantics — Project
  workflow card wraps CTA in `<Link>` again.
- [Resolved 2025-11-06] **F002**: Document bootstrap failed missing-section
  fallbacks — `useDocumentBootstrap` validates sections and falls back to the
  first section.
- [Resolved 2025-11-06] **F001**: API missed `@ctrl-freaq/exporter` dependency —
  Dependency added and DI container registers `DocumentExportService`.

## Strengths

- Playwright + RTL coverage now spans open/provision/export/approval/conflict
  flows, providing high-confidence regression protection for FR-001–FR-013
  (`apps/web/tests/e2e/project-open-document.e2e.ts`,
  `document-conflict.e2e.ts`, `section-editor/approval-finalize.e2e.ts`).
- Live bootstrap + loader work keeps fixture compatibility while ensuring
  production data funnels through shared stores
  (`apps/web/src/app/router/document-routes.tsx`,
  `apps/web/src/features/document-editor/hooks/use-document-bootstrap.ts`).
- Backend discovery/provision/export routes consistently enforce
  `requireProjectAccess` and structured error responses, aligning with the
  architecture doc and SOC-2 logging expectations
  (`apps/api/src/routes/documents.ts`, `apps/api/src/routes/projects.ts`).

## Feedback Traceability

| Feedback Item                                                  | Source                       | Status | Evidence / Linked Findings                                                                             |
| -------------------------------------------------------------- | ---------------------------- | ------ | ------------------------------------------------------------------------------------------------------ |
| Follow the Code Review Playbook end-to-end (no skipped steps). | Operator — 2025-11-11T20:31Z | Closed | Steps 1–14 executed; see Resolved Scope narrative, Pre-Review Gates table, and Quality Signal Summary. |

## Outstanding Clarifications

- None.

## Control Inventory

| Control Domain         | Implementation                                                                   | Status | Reference                                                                                                                                               |
| ---------------------- | -------------------------------------------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Authentication**     | Loader-based token resolution shared by router + editor clients.                 | Reused | `apps/web/src/lib/auth-provider/loader-auth.ts:1-118`                                                                                                   |
| **Document Bootstrap** | Live bootstrap hook hydrates document/table of contents + stores before editing. | Reused | `apps/web/src/features/document-editor/hooks/use-document-bootstrap.ts:59-205`                                                                          |
| **Provisioning**       | DocumentProvisioningService seeds documents atomically with template defaults.   | Reused | `apps/api/src/services/document-provisioning.service.ts:1-360`                                                                                          |
| **Export**             | DocumentExportService orchestrates async export jobs and artifact delivery.      | Reused | `apps/api/src/services/export/document-export.service.ts:1-240`                                                                                         |
| **Template Decisions** | Template decision repository + Project page validation gate persist decisions.   | Reused | `packages/shared-data/src/repositories/template-decision.repository.ts:1-150`, `apps/web/src/pages/Project.tsx:1638-1823`                               |
| **Collaboration & QA** | Co-author and QA hooks manage streaming sessions, fallbacks, and cancellations.  | Reused | `apps/web/src/features/document-editor/hooks/useCoAuthorSession.ts:1-220`, `apps/web/src/features/document-editor/hooks/useDocumentQaSession.ts:59-220` |

## Quality Signal Summary

### Linting Results

- **Status**: Pass (`pnpm lint` — 2025-11-11 20:35Z)
- **Warnings**: 0 warnings, 0 errors
- **Key Issues**:
  - None; Turbo lint across 10 workspaces completed without diagnostics.

### Type Checking

- **Status**: Pass (`pnpm typecheck` — compiles via `turbo build` then
  `pnpm typecheck:noemit`)
- **Results**: Repository TypeScript build succeeded with no errors or skips.

### Test Results

- **Status**: Pass (`pnpm test` — Vitest + Playwright gauntlet)
- **Results**: All suites (unit, contract, fixture e2e, visual) completed
  successfully; prior approval-panel failure is no longer reproducible.

### Build Status

- **Status**: Pass (`pnpm typecheck` invokes `turbo build` for all packages)
- **Details**: `apps/web` Vite bundle and `apps/api` build artifacts produced
  without warnings.

## Dependency Audit Summary

- **Baseline Severity Counts**: info 0 / low 0 / moderate 0 / high 0 / critical
  0 (from prior audit)
- **Current Severity Counts**: info 0 / low 0 / moderate 0 / high 0 / critical 0
  (`pnpm audit --json` saved at `/tmp/pnpm-audit.json`)
- **New CVEs Identified**: None
- **Deprecated Packages**: None flagged by `pnpm audit`
- **Justifications / Version Currency**: No dependency deltas introduced in this
  iteration.

## Requirements Coverage Table

| Requirement | Summary                                                                                 | Implementation Evidence                                                                                                                                                          | Validating Tests                                                                                                                                                               | Linked Findings / Clarifications |
| ----------- | --------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------- |
| **FR-001**  | Accessible workflow card launches editor via existing clickable card semantics.         | `apps/web/src/pages/Project.tsx:1830-1858`                                                                                                                                       | `apps/web/tests/e2e/project-open-document.e2e.ts:299-330`                                                                                                                      | —                                |
| **FR-002**  | Project page surfaces document status (loading/ready/missing/archived).                 | `apps/web/src/pages/Project.tsx:259-318`                                                                                                                                         | `apps/web/tests/e2e/project-open-document.e2e.ts:299-330`                                                                                                                      | —                                |
| **FR-003**  | “Create Document” CTA with link-wrapped card + CTA copy.                                | `apps/web/src/pages/Project.tsx:1865-1932`                                                                                                                                       | `apps/web/src/pages/__tests__/Project.create-document.test.tsx:232-246`                                                                                                        | —                                |
| **FR-004**  | Provisioning flow shows stepper, failure banner, prevents duplicate submissions.        | `apps/web/src/pages/Project.tsx:448-523`, `apps/web/src/pages/Project.tsx:1896-1974`                                                                                             | `apps/web/tests/e2e/project-open-document.e2e.ts:330-360`, `apps/web/src/pages/__tests__/Project.create-document.test.tsx:264-269`                                             | —                                |
| **FR-005**  | Route user to first section after selection/provision.                                  | `apps/web/src/pages/Project.tsx:213-239`, `apps/web/src/app/router/document-routes.tsx:35-148`                                                                                   | `apps/web/src/pages/__tests__/Project.create-document.test.tsx:232-242`, `apps/web/tests/e2e/project-open-document.e2e.ts:299-330`                                             | —                                |
| **FR-006**  | Editor blocks interaction until live content loads; loader supports fixtures/not-found. | `apps/web/src/app/router/document-routes.tsx:35-194`, `apps/web/src/features/document-editor/components/document-editor.tsx:1650-1680`                                           | `apps/web/src/app/router/document-routes.test.ts:31-118`, `apps/web/src/features/document-editor/hooks/use-document-bootstrap.test.tsx:1-150`                                  | —                                |
| **FR-007**  | Manual save/diff/review confirmation pipeline.                                          | `apps/web/src/features/document-editor/components/document-editor.tsx:2040-2105`                                                                                                 | `apps/web/tests/e2e/section-editor/approval-finalize.e2e.ts:1-70`, `apps/web/src/features/document-editor/hooks/use-draft-persistence.test.tsx:1-140`                          | —                                |
| **FR-008**  | Conflict detection preserves drafts and guides through refresh/diff/reapply.            | `apps/web/src/features/document-editor/components/document-editor.tsx:2169-2234`                                                                                                 | `apps/web/tests/e2e/document-conflict.e2e.ts:1-150`                                                                                                                            | —                                |
| **FR-009**  | Assumptions flow scoped to active project/document with streaming UX.                   | `apps/web/src/features/document-editor/components/document-editor.tsx:1976-1999`, `apps/web/src/features/document-editor/assumptions-flow/hooks/use-assumptions-flow.ts:100-190` | `apps/web/src/features/document-editor/assumptions-flow/hooks/use-assumptions-flow.test.tsx:1-80`, `apps/api/tests/contract/documents/assumptions-flow.contract.test.ts:1-120` | —                                |
| **FR-010**  | Co-author sidebar streams sessions, supports cancel/retry.                              | `apps/web/src/features/document-editor/components/document-editor.tsx:1885-1960`, `apps/web/src/features/document-editor/hooks/useCoAuthorSession.ts:1-160`                      | `apps/web/src/features/document-editor/hooks/useCoAuthorSession.test.tsx:1-140`                                                                                                | —                                |
| **FR-011**  | Document QA panel triggers reviews, shows progress, handles fallback/cancel.            | `apps/web/src/features/document-editor/components/document-editor.tsx:2150-2162`, `apps/web/src/features/document-editor/hooks/useDocumentQaSession.ts:60-160`                   | `apps/web/src/features/document-editor/hooks/useDocumentQaSession.test.tsx:190-256`                                                                                            | —                                |
| **FR-012**  | Template validation decisions persisted with success/error feedback.                    | `apps/web/src/pages/Project.tsx:1638-1823`, `packages/shared-data/src/repositories/template-decision.repository.ts:1-146`                                                        | `apps/web/src/pages/__tests__/Project.template-validation.test.tsx:1-150`, `apps/api/tests/contract/templates/template-validation-decision.contract.test.ts:1-160`             | —                                |
| **FR-013**  | Export workflow card queues job and surfaces artifact download.                         | `apps/web/src/pages/Project.tsx:1995-2040`, `apps/api/src/services/export/document-export.service.ts:1-220`                                                                      | `apps/web/src/pages/Project.test.tsx:395-438`, `apps/api/tests/contract/projects/export-project.contract.test.ts:1-200`                                                        | —                                |
| **FR-014**  | Breadcrumb + document-missing surfaces return-to-project/provision CTAs.                | `apps/web/src/features/document-editor/components/document-editor.tsx:1650-1674`, `apps/web/src/components/document-missing.tsx:21-80`                                           | `apps/web/src/components/document-missing.test.tsx:10-40`                                                                                                                      | —                                |

## Requirements Compliance Checklist

| Requirement Group             | Status | Notes                                                                                                   |
| ----------------------------- | ------ | ------------------------------------------------------------------------------------------------------- |
| **Constitutional Principles** | Pass   | Library-first + CLI rules unchanged; new work extends existing packages/services per `CONSTITUTION.md`. |
| **SOC 2 Authentication**      | Pass   | All document/section routes call `requireProjectAccess`; loader/auth provider enforces tokens.          |
| **SOC 2 Logging**             | Pass   | API routes log `requestId` and structured errors via `sendErrorResponse`.                               |
| **Security Controls**         | Pass   | No secrets added; dependency scan clean; authorization enforced on new endpoints.                       |
| **Code Quality**              | Pass   | Lint/typecheck/test/build commands all green with no warnings.                                          |
| **Testing Requirements**      | Pass   | Repository gauntlet (Vitest + Playwright) executed via `pnpm test`; contract suites exercised.          |

## Decision Log

1. **2025-11-11** — Verified the approval-panel gating fix (F022) via new
   component/tests and gauntlet success; moved finding to the historical log.
2. **2025-11-11** — Captured a fresh `pnpm audit --json` snapshot (0
   vulnerabilities) to document supply-chain compliance for this iteration.

## Remediation Logging

No remediation tasks required; final status is Approved with zero active
findings.

---

**Review Completed**: 2025-11-11T20:55:00Z  
**Next Action**: Continue feature work or prepare PR knowing governance gates
are satisfied.

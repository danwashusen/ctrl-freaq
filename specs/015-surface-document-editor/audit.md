# Code Review Report: Surface Document Editor (015-surface-document-editor)

## Final Status: **Quality Controls Violation**

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
routes, shared-data repositories). Executed `pnpm lint` (pass), `pnpm typecheck`
(now passes after the prior create-document fix), then `pnpm test`, which fails
in the Playwright gauntlet because the approval panel never renders under common
section statuses. Quality Controls and TDD gates remain blocked until that
regression is resolved.

**Feature Directory**:
`/Users/danwas/Development/Projects/ctrl-freaq/worktrees/015-surface-document-editor/specs/015-surface-document-editor`

**Implementation Scope**:

- Project workflow page (`apps/web/src/pages/Project.tsx`) wiring discovery,
  provisioning, template validation, and export workflows
- Document-editor bootstrap/hooks/stores plus loading/not-found/streaming guards
  (`use-document-bootstrap`, `document-editor.tsx`, QA/co-author sessions)
- Section-editor manual save, conflict guide, approval controls, diff viewer,
  and persistence adapters
- Express routes/services for documents, sections, templates, provisioning,
  exports, plus DI container + helper guards
- Shared-data repositories/models for documents, sections, template decisions,
  export jobs, and retention policies
- Feature dossier collateral
  (plan/tasks/spec/data-model/quickstart/contracts/checklists)

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
      - path: 'docs/prd.md'
        context: 'Product requirements and success metrics.'
```

## Pre-Review Gates

| Gate                      | Status        | Details                                                                                                                                                                                |
| ------------------------- | ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Context Gate**          | Pass          | Spec kit configuration, dossier files, and governance docs were loaded before inspecting diffs.                                                                                        |
| **Change Intent Gate**    | Pass          | Diff still implements the POR described in `plan.md`/`tasks.md` (surface live editor flows end-to-end).                                                                                |
| **Unknowns Gate**         | Pass          | No `[NEEDS CLARIFICATION]` items remain after reviewing the dossier and SESSION_FEEDBACK.                                                                                              |
| **Separation of Duties**  | Not Evaluated | Local review cannot confirm GitHub branch protection or approver assignments.                                                                                                          |
| **Code Owners Gate**      | N/A           | Repository still lacks `.github/CODEOWNERS`; no enforced owners.                                                                                                                       |
| **Quality Controls Gate** | **Fail**      | `pnpm test` fails in `@ctrl-freaq/web test:e2e:ci` because the approval panel never renders for sections that are still `drafting`, so Playwright cannot finish the approval workflow. |
| **TDD Evidence Gate**     | **Fail**      | Failing Playwright gauntlet leaves FR-007 behavior unverified; evidence must be repaired before deeper review proceeds.                                                                |

## Findings

### Active Findings (Current Iteration)

#### Finding F022: Section approval panel hidden, breaking Playwright gauntlet

- **Category**: Quality Controls / Functional Correctness
- **Severity**: Critical
- **Confidence**: High
- **Impact**: `pnpm test` aborts because
  `apps/web/tests/e2e/section-editor/approval-finalize.e2e.ts` cannot find
  `data-testid="approval-panel"`. `document-editor.tsx` now only renders
  `<ApprovalControls>` when `activeSection.status` is `'review'` or `'ready'`
  (`apps/web/src/features/document-editor/components/document-editor.tsx:2068-2096`).
  Fixture sections load as `drafting`, so reviewers have no approval UI,
  preventing manual saves from being committed or verified, regressing
  FR-007/FR-008 and blocking the gauntlet.
- **Evidence**: `pnpm test` (2025-11-11) output shows Playwright failure
  `expect(received).toBeVisible()` at
  `apps/web/tests/e2e/section-editor/approval-finalize.e2e.ts:22`. Corresponding
  code gates the approval panel behind
  `activeSection.status === 'review' || activeSection.status === 'ready'`, so
  the selector never exists for `drafting` sections.
- **Remediation**: Render `ApprovalControls` whenever the user has review
  permission (e.g., while in edit mode or when section status ∈
  {'drafting','review','ready'}) and gate behavior via capability checks instead
  of status equality. Update Playwright + RTL tests to cover the regression,
  rerun `pnpm test`, and confirm the approval workflow passes with `drafting`
  fixtures.
- **Source Requirement**: `FR-007` (manual save + approval UX), `FR-008`
  (conflict/approval guidance), `QUAL-01 Correctness & Tests`,
  `TEST-01 Required Checks`.
- **Files**:
  `apps/web/src/features/document-editor/components/document-editor.tsx:2058-2096`,
  `apps/web/tests/e2e/section-editor/approval-finalize.e2e.ts`.

### Historical Findings Log

- [Resolved 2025-11-11] **F021**: Create-document stepper state check kept
  typecheck red — Reported 2025-11-08; verified fixed by re-running
  `pnpm typecheck` (2025-11-11) and inspecting
  `apps/web/src/pages/Project.tsx:1888-1904`, which no longer compares `'idle'`
  after `showCreateDocumentStepper` narrows the union.
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
  project-level history — Discovery service now hydrates latest decisions per
  document with unit + contract coverage.
- [Resolved 2025-11-07] **F016**: Document-missing screen omitted required
  actions — Updated CTA set in `document-missing.tsx` with tests + Playwright
  coverage.
- [Resolved 2025-11-07] **F015**: Export workflow lacked downloadable artifact
  CTA — Project page now renders download link backed by export jobs.
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

- Repository-wide lint/typecheck/build gates are green again, demonstrating the
  earlier stepper regression was resolved quickly and without suppressions.
- Dossier collateral (`plan.md`, `data-model.md`, `quickstart.md`, contracts)
  remains comprehensive, preserving POR traceability for downstream audit loops.

## Feedback Traceability

| Feedback Item                                                  | Source                       | Status                           | Evidence / Linked Findings                                                                |
| -------------------------------------------------------------- | ---------------------------- | -------------------------------- | ----------------------------------------------------------------------------------------- |
| Follow the Code Review Playbook end-to-end (no skipped steps). | Operator — 2025-11-11T19:44Z | Blocked at Quality Controls gate | Steps 1–7 completed; Step 9 `pnpm test` fails due to F022, halting the loop per playbook. |
| Comparison baseline defaults to HEAD vs `main` (option 1).     | Operator — 2025-11-11T19:45Z | Completed                        | Resolved scope documents `HEAD` (`c0806699…`) vs `main` (`73d1d9f…`).                     |

## Outstanding Clarifications

- None.

## Control Inventory

| Control Domain         | Implementation                                                                                                                                                   | Status          | Reference                                                                                                          |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------- | ------------------------------------------------------------------------------------------------------------------ |
| **Authentication**     | `ensureSectionAccess` + `requireProjectAccess` guard section/document routes; loader auth client reuses the same tokens for frontend data fetching.              | Healthy         | `apps/api/src/routes/sections.ts:230-340`, `apps/web/src/lib/auth-provider/loader-auth.ts`                         |
| **Logging**            | Routes/services emit structured Pino logs with `requestId`, project/document ids, and timing metadata via DI loggers.                                            | Healthy         | `apps/api/src/routes/projects.ts:70-160`, `apps/api/src/services/export/document-export.service.ts:70-150`         |
| **Error Handling**     | Shared helpers (`sendErrorResponse`, Zod schemas) normalize JSON errors and validation failures.                                                                 | Healthy         | `apps/api/src/routes/documents.ts:40-160`, `apps/api/src/routes/templates.ts:30-140`                               |
| **Repository Pattern** | Shared-data repositories back document snapshots, template decisions, export jobs, and section drafts.                                                           | Healthy         | `packages/shared-data/src/repositories/*.ts`, `packages/shared-data/src/models/*.ts`                               |
| **Input Validation**   | API routes validate payloads with Zod while frontend bootstrap/hooks guard required identifiers before mutating stores.                                          | Healthy         | `apps/api/src/routes/documents.ts:60-118`, `apps/web/src/features/document-editor/hooks/use-document-bootstrap.ts` |
| **State Management**   | Document + section stores coordinate Project/editor state, but approval controls now gate on status in `document-editor.tsx`, hiding reviewer UI (Finding F022). | Needs Attention | `apps/web/src/features/document-editor/components/document-editor.tsx:2058-2096`                                   |

## Quality Signal Summary

### Linting Results

- **Status**: Pass (`pnpm lint`)
- **Warnings**: 0 warnings, 0 errors
- **Key Notes**:
  - Turbo lint fan-out across 10 workspaces completed without rule violations.
  - Repo-level `eslint . --cache --ext .ts,.tsx,.js,.jsx` finished cleanly; no
    ignore anomalies reported.

### Type Checking

- **Status**: Pass (`pnpm typecheck`)
- **Results**: Turbo build + `tsc --noEmit` succeeded across all packages; prior
  F021 regression is resolved.

### Test Results

- **Status**: **Fail (`pnpm test`)**
- **Results**: `@ctrl-freaq/web test:e2e:ci` (Playwright fixture config) fails
  `section-editor/approval-finalize.e2e.ts` because
  `[data-testid="approval-panel"]` is never visible once a section enters edit
  mode.
- **Root Cause**: Approval panel rendering is restricted to `review`/`ready`
  statuses in `document-editor.tsx`, so reviewers cannot approve `drafting`
  fixtures, breaking FR-007 workflow coverage (Finding F022).

### Build Status

- **Status**: Pass (`pnpm typecheck` ➜ `pnpm run build`)
- **Details**: Turbo build succeeded for all workspaces while running
  `pnpm typecheck`.

## Dependency Audit Summary

- Not run this iteration; rerun `pnpm audit --prod` or equivalent once the
  Playwright gauntlet is green so dependency deltas can be triaged alongside a
  passing build.

## Requirements Coverage Table

| Requirement | Summary                                                            | Implementation Evidence                                                                                                                   | Validating Tests                                     | Linked Findings / Clarifications |
| ----------- | ------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- | -------------------------------- |
| **FR-001**  | Accessible workflow card launches the primary document.            | Logic unchanged in `apps/web/src/pages/Project.tsx:1700-1820`; not revalidated because gauntlet blocked at document editor stage.         | Deferred (`pnpm test` blocked).                      | Review pending once tests rerun. |
| **FR-002**  | Project page shows Loading/Ready/Missing/Archived badges.          | Status pill rendering remains in `Project.tsx:223-289`; screenshot/tests not rerun this loop.                                             | Deferred.                                            | Review pending.                  |
| **FR-003**  | Create Document CTA blocks duplicates until provisioning succeeds. | Guarding + disabled states still implemented in `Project.tsx:1805-1860`.                                                                  | Deferred.                                            | Review pending.                  |
| **FR-004**  | Provisioning flow shows progress + actionable failure UX.          | Stepper + banner remain at `Project.tsx:1860-1998`.                                                                                       | Deferred.                                            | Review pending.                  |
| **FR-005**  | Route user to editor landing on first section.                     | Loader + router continue to compute first section in `document-routes.tsx`.                                                               | Deferred.                                            | Review pending.                  |
| **FR-006**  | Load live document content with loading/not-found guards.          | `use-document-bootstrap.ts` + `document-editor.tsx` still orchestrate gating and fallbacks.                                               | Deferred.                                            | Review pending.                  |
| **FR-007**  | Manual save diff + approval UX.                                    | `ManualSavePanel` + `ApprovalControls` still exist, but approval UI is hidden for `drafting` sections in `document-editor.tsx:2068-2096`. | `section-editor/approval-finalize.e2e.ts` fails.     | Finding F022.                    |
| **FR-008**  | Conflict handling preserves drafts & guides resolution.            | `ConflictDialog` + conflict guide logic remain in `document-editor.tsx`.                                                                  | Deferred (gauntlet stopped before these assertions). | Review pending.                  |
| **FR-009**  | Assumptions flow scoped to active project/document ids.            | Hooks + API service still thread identifiers.                                                                                             | Deferred.                                            | Review pending.                  |
| **FR-010**  | Co-author sidebar streams sessions with cancel/retry.              | `useCoAuthorSession.ts` unchanged.                                                                                                        | Deferred.                                            | Review pending.                  |
| **FR-011**  | QA checks show latest gate results.                                | QA panel + dashboard wiring intact.                                                                                                       | Deferred.                                            | Review pending.                  |
| **FR-012**  | Template decisions persist with feedback.                          | Template store + API client unchanged.                                                                                                    | Deferred.                                            | Review pending.                  |
| **FR-013**  | Export workflow triggers jobs and returns artifact/status.         | Export API/service logic still present.                                                                                                   | Deferred.                                            | Review pending.                  |
| **FR-014**  | Breadcrumb/back navigation returns to originating project.         | Breadcrumb/back CTA still rendered in `document-editor.tsx:240-320`.                                                                      | Deferred.                                            | Review pending.                  |

## Requirements Compliance Checklist

| Requirement Group             | Status | Notes                                                                                                 |
| ----------------------------- | ------ | ----------------------------------------------------------------------------------------------------- |
| **Constitutional Principles** | Fail   | Playwright gauntlet failure (F022) violates Test-First + Quality Controls Protection.                 |
| **SOC 2 Authentication**      | Pass   | Backend routes continue to enforce `requireProjectAccess`; no new auth regressions observed pre-gate. |
| **SOC 2 Logging**             | Pass   | Structured logging with `requestId` persists in touched routes/services.                              |
| **Security Controls**         | Pass   | Prior authorization findings remain resolved; no new security deltas spotted before gate failure.     |
| **Code Quality**              | Fail   | Tests are red (F022), so code quality gates are not satisfied.                                        |
| **Testing Requirements**      | Fail   | Gauntlet execution fails during Playwright suite; evidence must be green before approval.             |

## Decision Log

1. **2025-11-11** — Reloaded spec kit config, recorded sandbox/network posture,
   SESSION_FEEDBACK, and baseline selection (HEAD vs `main`).
2. **2025-11-11** — Ran `pnpm lint` and `pnpm typecheck`; both succeeded,
   confirming F021 was resolved.
3. **2025-11-11** — Ran `pnpm test`; Playwright approval workflow failed,
   triggering Finding F022 and halting the review per the playbook.

## Remediation Logging

### Remediation R024

- **Context**: Finding F022 — Approval controls only render for sections already
  in `review`/`ready`, preventing reviewers from approving drafts and leaving
  `pnpm test` red.
- **Control Reference**: Constitutional Quality Controls gate; `FR-007`/`FR-008`
  workflow requirements.
- **Actions**: Allow `<ApprovalControls>` to render as soon as the reviewer
  opens the section (e.g., while entering edit mode or when permissions grant
  review access), guard the buttons by capability instead of status equality,
  and update Playwright/RTL coverage so drafting fixtures assert the approval
  panel is visible. Re-run `pnpm lint`, `pnpm typecheck`, `pnpm test`, and
  attach evidence to the follow-up audit.
- **Verification**: Playwright `section-editor/approval-finalize.e2e.ts` passes
  locally (no retries), and `pnpm test` exits 0.

---

**Review Completed**: 2025-11-11T19:52:59Z  
**Next Action**: Address Finding F022, rerun
`pnpm lint && pnpm typecheck && pnpm test`, then request the next audit loop.

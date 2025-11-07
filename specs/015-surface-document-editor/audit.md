# Code Review Report: Surface Document Editor (015-surface-document-editor)

## Final Status: **Changes Requested**

## Resolved Scope

**Branch**: `015-surface-document-editor` **Baseline**: `main` **Diff Source**:
`HEAD vs main` **Review Target**: Story 2.2 dossier – document discovery,
provisioning, export, and Project→editor UX integration **Files Analyzed**: 123
changed files spanning Express routes/services, shared-data repositories, React
pages/hooks, and contract/E2E tests

**Resolved Scope Narrative**: Re-read the feature dossier under
`specs/015-surface-document-editor/` and compared the full branch diff against
`main`, focusing on the API routes/services that discover and provision project
documents, the export workflow, and the React Project/document-editor flows
(cards, loaders, bootstrap hooks, stores, and tests). Quality commands
(`pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm audit --audit-level high`)
were executed from the repo root to substantiate the review.

**Feature Directory**: `specs/015-surface-document-editor` **Implementation
Scope**:

- `apps/api/src/routes/documents.ts`
- `apps/api/src/services/document-provisioning.service.ts`
- `apps/api/src/routes/projects.ts` (export route)
- `apps/api/src/services/export/document-export.service.ts`
- `apps/web/src/pages/Project.tsx`
- `apps/web/src/features/document-editor/hooks/use-document-bootstrap.ts`

## SPEC_KIT_CONFIG

```yaml
spec-kit:
  constitution:
    path: 'CONSTITUTION.md'
  review:
    documents:
      - path: 'docs/architecture.md'
        context: 'Backend architecture – authoritative runtime guidance.'
      - path: 'docs/ui-architecture.md'
        context: 'Frontend architecture – authoritative UI/state guidance.'
      - path: 'docs/front-end-spec.md'
        context:
          'UI/UX specification for workflow cards, bootstrap states, and
          accessibility.'
```

## Pre-Review Gates

| Gate                      | Status                 | Details                                                                                                                                                                        |
| ------------------------- | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Context Gate**          | ✅ Pass                | `plan.md`, `spec.md`, `tasks.md`, `research.md`, `data-model.md`, `quickstart.md`, and contracts under `specs/015-surface-document-editor/` were present and readable.         |
| **Change Intent Gate**    | ✅ Pass                | Changes still align with Story 2.2 POR (discover/provision primary documents, wire Project→editor flows, integrate export + template decisions).                               |
| **Unknowns Gate**         | ⚠️ Needs Clarification | GitHub branch protection, required checks, and CODEOWNERS data are not accessible locally; recorded under Outstanding Clarifications.                                          |
| **Separation of Duties**  | ⚪ Not Evaluated       | Local workspace audit; GitHub reviewer/approver assignments unavailable offline.                                                                                               |
| **Code Owners Gate**      | ⚪ Not Evaluated       | No `CODEOWNERS` file exists in the repo; ownership must be confirmed in GitHub UI.                                                                                             |
| **Quality Controls Gate** | ✅ Pass                | `pnpm lint`, `pnpm typecheck` (build + `tsc --noEmit`), `pnpm test` (gauntlet rerun with a 10‑minute timeout), and `pnpm audit --audit-level high` all completed successfully. |
| **TDD Evidence Gate**     | ✅ Pass                | Existing Vitest contract/unit suites and Playwright E2E flows exercised by the gauntlet cover the touched routes/hooks.                                                        |

## Findings

### Active Findings (Current Iteration)

#### Finding F009: Project-scoped document/export endpoints skip authorization

- **Category**: Security
- **Severity**: Critical
- **Confidence**: High
- **Impact**: `GET /projects/:projectId/documents/primary`,
  `POST /projects/:projectId/documents`, `POST /projects/:projectId/export`, and
  `POST /projects/:projectId/templates/:templateId/decisions` only check that
  _someone_ is authenticated. They never verify that `req.user` owns or belongs
  to the referenced project. Any authenticated user can enumerate document
  metadata, provision documents, enqueue exports, or submit template decisions
  for another team’s project simply by guessing UUIDs, violating SEC-01 and
  FR‑001/FR‑003/FR‑012.
- **Evidence**: `apps/api/src/routes/documents.ts:127-220` and `:224-320` only
  call `projectRepository.findById` to ensure existence, not ownership; no
  `ownerUserId`/membership comparison occurs.
  `apps/api/src/routes/projects.ts:1336-1476` (export) and
  `apps/api/src/routes/templates.ts:353-514` exhibit the same pattern. Other
  project routes (e.g., `projectsRouter.patch` at
  `apps/api/src/routes/projects.ts:957-1014`) do enforce
  `project.ownerUserId === userId`, demonstrating the missing guard.
- **Remediation**: Introduce a shared “require project access” helper that
  validates ownership/membership (and redacts on failure) before touching any
  project-scoped workflow, then apply it to the new document
  discovery/provision/export/template decision routes. Add negative contract
  tests proving unauthorized users receive 403.
- **Source Requirement**: FR‑001, FR‑003, FR‑012; SEC‑01 Secure Coding Baseline.
- **Files**: apps/api/src/routes/documents.ts, apps/api/src/routes/projects.ts,
  apps/api/src/routes/templates.ts

#### Finding F010: Document provisioning is not atomic and bricks projects on failure

- **Category**: Reliability / Functional
- **Severity**: Major
- **Confidence**: High
- **Impact**: `DocumentProvisioningService.provisionPrimaryDocument` inserts the
  document row
  (`apps/api/src/services/document-provisioning.service.ts:114-174`) before
  seeding sections. If `createSectionsFromTemplate` throws (invalid template,
  SQLite write failure, etc.), the method throws `DocumentProvisioningError`
  without rolling back the newly created document. Subsequent POSTs see the
  half-created document and immediately call `buildExistingDocumentResponse`,
  which in turn throws because the snapshot lacks a first section
  (`buildExistingDocumentResponse` at lines 220-249). The project is permanently
  stuck: provisioning always returns 500, but no sections exist to recover.
  FR‑004/FR‑005 guarantee that creation either succeeds or remains retriable;
  this violates both requirements and REL‑01.
- **Evidence**: No transaction encloses the `documents.create` +
  `createSectionsFromTemplate` sequence, and there is no cleanup in the catch
  block. Tests never simulate seeding failures, so the issue is untested.
- **Remediation**: Wrap the document + section creation in a SQLite transaction;
  on any failure, roll back both the document row and inserted sections.
  Alternatively, delete the orphaned document when seeding fails so retrying can
  succeed. Add contract/unit tests that force a failure mid-seed and verify the
  retry path still works.
- **Source Requirement**: FR‑004 (provision document), FR‑005 (route user to
  first section); REL‑01 Production Readiness.
- **Files**: apps/api/src/services/document-provisioning.service.ts

#### Finding F011: Export jobs run synchronously, so the UI never exercises queued/running states

- **Category**: Functional
- **Severity**: Major
- **Confidence**: High
- **Impact**: `DocumentExportService.enqueue` immediately updates the job to
  `running`, generates the artifact, and marks it `completed` before returning
  (`apps/api/src/services/export/document-export.service.ts:52-105`). The HTTP
  handler only responds after that work finishes
  (`apps/api/src/routes/projects.ts:1336-1476`). The Project workflow card
  (`apps/web/src/pages/Project.tsx:301-437`) expects
  `queued`/`running`/`completed` states to drive progress copy, but it always
  receives `completed`. Long-running exports will tie up the request thread and
  still provide no progress feedback, failing FR‑013’s requirement to “show
  progress/error messaging” and allow follow-up polling.
- **Evidence**: Service code proves the synchronous behaviour; UI logic around
  `exportState` (lines 401-437) assumes asynchronous transitions, yet the state
  is never anything but `completed`.
- **Remediation**: Keep `enqueue` asynchronous—record the queued job, return
  immediately (202) with its metadata, and push the heavy work to a worker/task
  runner. Expose a status endpoint or SSE updates so the Project card can poll
  and show queued/running/completed states. Update contract tests to expect
  `status: 'queued'` on creation instead of `completed`.
- **Source Requirement**: FR‑013 (Project export workflow).
- **Files**: apps/api/src/services/export/document-export.service.ts,
  apps/api/src/routes/projects.ts, apps/web/src/pages/Project.tsx

#### Finding F012: Template locator never looks in `dist/templates`, so production builds still cannot provision

- **Category**: Functional
- **Severity**: Major
- **Confidence**: High
- **Impact**: The new copy script ships templates to `apps/api/dist/templates`,
  but `createTemplateLocator` only searches `../.. /templates` and the repo root
  (`apps/api/src/services/templates/template-path-resolver.ts:38-47`). When the
  API runs from the compiled bundle (which typically contains only `dist/**`),
  there is no `apps/api/templates` or repo-level `templates`, so provisioning
  still throws `TemplateProvisioningError`. FR‑004 remains unmet outside dev
  mode despite the added copy step.
- **Evidence**: `copy-template-assets.mjs` writes to `apps/api/dist/templates`
  (lines 11-26), yet `buildSearchRoots` never inspects that directory. The only
  way provisioning works is by manually setting `CTRL_FREAQ_TEMPLATE_ROOT`,
  which is undocumented for deployments.
- **Remediation**: Include `resolve(currentDir, '..', 'templates')` (i.e.,
  `dist/templates`) in the search roots or automatically set
  `CTRL_FREAQ_TEMPLATE_ROOT` when the server starts in production. Add an
  integration test that runs the API from `dist` without repo templates to
  confirm provisioning still succeeds.
- **Source Requirement**: FR‑004 (Create Document flow), QUAL‑01 (correctness
  under build artifacts).
- **Files**: apps/api/src/services/templates/template-path-resolver.ts,
  apps/api/scripts/copy-template-assets.mjs,
  apps/api/src/services/document-provisioning.service.ts

### Historical Findings Log

- [Resolved 2025-11-07] F006: Production builds could not find provisioning
  templates — Reported 2025-11-06. Resolution: template copy script added during
  this iteration; new template-path routing (F012) still pending, but the
  original missing-assets issue tracked by F006 is closed per Phase 4.R tasks.
- [Resolved 2025-11-07] F007: Export workflow never progressed beyond “Queued” —
  Reported 2025-11-06. Resolution: export service now writes `running/completed`
  states and produces `artifactUrl`; new synchronous behaviour is tracked as
  F011.
- [Resolved 2025-11-07] F008: Create Document API ignored override contract —
  Reported 2025-11-06. Resolution: `CreateDocumentRequestSchema` and
  `DocumentProvisioningService` now accept `title`, `templateId`,
  `templateVersion`, and `seedStrategy` overrides.
- [Resolved 2025-11-06] F005: Document provisioning template asset missing from
  builds — Reported 2025-11-06. Resolution:
  `apps/api/scripts/copy-template-assets.mjs` ships templates into
  `dist/templates` during `pnpm --filter @ctrl-freaq/api build`.
- [Resolved 2025-11-06] F004: Document route loader bypassed API client auth —
  Reported 2025-11-06. Resolution: `apps/web/src/app/router/document-routes.tsx`
  now instantiates the shared API client with loader auth tokens.
- [Resolved 2025-11-06] F003: Workflow card lost link semantics — Reported
  2025-11-06. Resolution: `apps/web/src/pages/Project.tsx` restored the
  link-wrapped accessible card pattern and associated RTL tests.
- [Resolved 2025-11-06] F002: Document bootstrap failed to fall back when
  section missing — Reported 2025-11-06. Resolution: `use-document-bootstrap.ts`
  validates section IDs and applies safe fallbacks with tests.
- [Resolved 2025-11-06] F001: API lacked dependency on `@ctrl-freaq/exporter` —
  Reported 2025-11-06. Resolution: `apps/api/package.json` now depends on the
  exporter package and contract tests cover exports.

## Strengths

- Document bootstrap now merges loader data with live fetches, normalizes tables
  of contents, and cancels work on unmount, keeping the editor locked until
  authoritative data arrives (aligns with FR‑006).
- Template store provisioning state cleanly mediates between create-document
  actions and the workflow cards, so UI copy stays in sync with API responses
  and fixtures across Ready/Missing/Archived states.

## Feedback Traceability

| Feedback Item                               | Source                          | Status    | Evidence / Linked Findings                                                                                                                     |
| ------------------------------------------- | ------------------------------- | --------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Execute the Code Review Playbook end-to-end | Operator (2025-11-07T01:06:36Z) | Addressed | All playbook steps executed: spec kit config, prerequisites, dossier ingestion, gates, findings, audit write-back, and Phase 4.R task updates. |

## Outstanding Clarifications

- [NEEDS CLARIFICATION: GitHub branch protection / required reviewers for
  `015-surface-document-editor` (not queryable locally).]
- [NEEDS CLARIFICATION: Required status checks beyond lint/type/test/audit for
  this repo (GitHub UI only).]

## Control Inventory

| Control Domain                    | Implementation                                                                                                        | Status      | Reference                                                                                                                                      |
| --------------------------------- | --------------------------------------------------------------------------------------------------------------------- | ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| **Authentication**                | Global middleware + loader token helper enforce bearer/Clerk auth before hitting `/api/v1` routes and loader fetches. | Established | apps/api/src/app.ts, apps/web/src/lib/auth-provider/loader-auth.ts                                                                             |
| **Project Document Discovery**    | Service + serializer build normalized primary-document snapshots for Project workflow cards.                          | Established | apps/api/src/services/document-workflows/project-document-discovery.service.ts, apps/api/src/routes/serializers/project-document.serializer.ts |
| **Document Provisioning**         | Service seeds documents/sections from templates but lacks transaction/rollback.                                       | Gap (F010)  | apps/api/src/services/document-provisioning.service.ts                                                                                         |
| **Editor Bootstrap**              | `useDocumentBootstrap` + stores gate editing, normalize TOC, and load project metadata.                               | Established | apps/web/src/features/document-editor/hooks/use-document-bootstrap.ts                                                                          |
| **Template Decision Persistence** | API route + repository store template validation decisions; surfaced via discovery snapshot.                          | Established | apps/api/src/routes/templates.ts, packages/shared-data/src/repositories/template-decision.repository.ts                                        |
| **Export Orchestration**          | Export service writes job rows and generates artifacts inline; no async worker/progress.                              | Gap (F011)  | apps/api/src/services/export/document-export.service.ts                                                                                        |

## Quality Signal Summary

### Linting Results

- **Status**: Pass
- **Warnings/Errors**: 0 warnings, 0 errors (`pnpm lint`)
- **Notes**: Turbo lint executed across all workspaces; no regressions recorded.

### Type Checking

- **Status**: Pass
- **Results**: `pnpm typecheck` (build + `tsc --noEmit`) succeeded for every
  workspace.

### Test Results

- **Status**: Pass
- **Results**: `pnpm test` (gauntlet) completed after rerunning with a longer
  timeout; unit, contract, fixture E2E, and visual suites reported zero
  failures.

### Build Status

- **Status**: Pass
- **Details**: `pnpm typecheck`’s preliminary Turbo build produced API/web
  artifacts; no build errors surfaced (although provisioning still fails in
  production due to F012).

## Dependency Audit Summary

- **Baseline Severity Counts**: Not recorded previously.
- **Current Severity Counts**: `pnpm audit --audit-level high` → 0 known
  high/critical vulnerabilities.
- **New CVEs Identified**: None.
- **Deprecated Packages**: None flagged in this run.
- **Notes**: Re-run audit after remediating the blocking findings.

## Requirements Coverage Table

| Requirement | Summary                                                        | Implementation Evidence                                                                                                                    | Validating Tests                                                                                                                                       | Linked Findings / Clarifications |
| ----------- | -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------- |
| **FR-001**  | Accessible workflow action opens the document editor           | `apps/web/src/pages/Project.tsx` workflow card wiring; `apps/web/src/app/router/document-routes.tsx` loader ensuring auth tokens.          | `apps/web/src/app/router/document-routes.test.ts`; `apps/web/tests/e2e/project-open-document.e2e.ts`                                                   | F009 (authorization gap)         |
| **FR-002**  | Project page shows document status before action               | Status badges + copy in `apps/web/src/pages/Project.tsx`; snapshot handling in `apps/web/src/stores/template-store.ts`.                    | `apps/web/src/pages/Project.test.tsx`; `apps/web/src/stores/template-store.test.ts`                                                                    | –                                |
| **FR-003**  | Provide “Create Document” CTA and block navigation until ready | Create card + provisioning state in `Project.tsx`; `useCreateDocument` hook.                                                               | `apps/web/src/pages/__tests__/Project.create-document.test.tsx`                                                                                        | F009 (unauthorized provisioning) |
| **FR-004**  | Provision new document with progress/error handling            | `apps/api/src/routes/documents.ts`; `apps/api/src/services/document-provisioning.service.ts`; `use-create-document.ts`.                    | `apps/api/tests/contract/documents/project-create-document.contract.test.ts`                                                                           | F010, F012                       |
| **FR-005**  | Route to editor’s first section after creation/selection       | `Project.tsx` success handler; `useDocumentBootstrap` resolves section focus.                                                              | `apps/web/tests/e2e/project-open-document.e2e.ts`                                                                                                      | F010                             |
| **FR-006**  | Load live sections/metadata before enabling editing            | `useDocumentBootstrap` + document store gating; loader data shape in router.                                                               | `apps/web/src/features/document-editor/hooks/use-document-bootstrap.test.tsx`                                                                          | –                                |
| **FR-007**  | Manual save diffing + success/failure messaging                | `ManualSavePanel` and section editor client wiring in `document-editor.tsx`.                                                               | `apps/web/src/features/section-editor/components/manual-save-panel.tsx` tests; Playwright conflict suite                                               | –                                |
| **FR-008**  | Conflict detection preserves drafts with guided steps          | Conflict dialog + store state in `document-editor.tsx`; `useCoAuthorSession` conflict handling.                                            | `apps/web/tests/e2e/document-conflict.e2e.ts`; `useCoAuthorSession.test.tsx`                                                                           | –                                |
| **FR-009**  | Assumptions flow scoped to project/document IDs                | `apps/web/src/features/document-editor/assumptions-flow/hooks/use-assumptions-flow.ts`; API handlers in `apps/api/src/routes/sections.ts`. | `apps/api/tests/contract/documents/assumptions-flow.contract.test.ts`                                                                                  | –                                |
| **FR-010**  | Co-author sidebar connects to live sessions w/ retry           | `useCoAuthorSession.ts` + store; SSE integrations.                                                                                         | `apps/web/src/features/document-editor/hooks/useCoAuthorSession.test.tsx`                                                                              | –                                |
| **FR-011**  | QA panel triggers checks and shows gate results                | `apps/web/src/features/document-editor/hooks/useDocumentQaSession.ts`; quality dashboard component.                                        | `apps/web/tests/e2e/document-qa-sidebar.e2e.ts`                                                                                                        | –                                |
| **FR-012**  | Template validation decisions persist with feedback            | `apps/api/src/routes/templates.ts` decision endpoint; `Project.tsx` template gate UI.                                                      | `apps/api/tests/contract/templates/template-validation-decision.contract.test.ts`; `apps/web/src/pages/__tests__/Project.template-validation.test.tsx` | F009                             |
| **FR-013**  | Export project and deliver artifact/status from workflow card  | `apps/api/src/routes/projects.ts` export handler; `document-export.service.ts`; `Project.tsx` export card.                                 | `apps/api/tests/contract/projects/export-project.contract.test.ts`                                                                                     | F011                             |
| **FR-014**  | Provide breadcrumb/back navigation from editor to project      | Breadcrumb logic + router integration inside `document-editor.tsx`.                                                                        | `apps/web/tests/e2e/project-open-document.e2e.ts`                                                                                                      | –                                |

## Requirements Compliance Checklist

| Requirement Group             | Status             | Notes                                                                                                                             |
| ----------------------------- | ------------------ | --------------------------------------------------------------------------------------------------------------------------------- |
| **Constitutional Principles** | ⚠️ Needs Attention | Authorization bypass (F009) and provisioning/export gaps (F010–F012) violate secure coding and production readiness expectations. |
| **SOC 2 Authentication**      | ⚠️ Needs Attention | Route-level authorization missing for project-scoped endpoints (F009).                                                            |
| **SOC 2 Logging**             | ✅ Satisfied       | Logger + requestId plumbing remain intact for the touched routes.                                                                 |
| **Security Controls**         | ⚠️ Needs Attention | Missing access checks for document/export/template decision routes.                                                               |
| **Code Quality**              | ⚠️ Needs Attention | Provisioning/export logic lacks transactional safety and async orchestration (F010–F011).                                         |
| **Testing Requirements**      | ✅ Satisfied       | Contract/unit/E2E suites exist and were executed, though new negative cases are needed after fixes.                               |

## Decision Log

1. 2025-11-07: Confirmed review baseline `HEAD` vs `main` per operator’s
   default; no alternate diff scopes requested.
2. 2025-11-07: Executed `pnpm lint`, `pnpm typecheck`, `pnpm test`, and
   `pnpm audit --audit-level high`; recorded outputs under Quality Signal
   Summary.
3. 2025-11-07: Logged unknown GitHub enforcement (branch protection, required
   checks) as outstanding clarifications since the CLI cannot query private repo
   settings.

## Remediation Logging

### Remediation R009 (F009)

- **Context**: Project-scoped document discovery/provision/export/template
  decision routes allow any authenticated user to act on any project.
- **Control Reference**: Authentication/authorization controls in
  `apps/api/src/app.ts` and prior guarded project routes.
- **Actions**: Introduce a shared “require project access” helper that checks
  ownership/membership before executing project workflows; wire it into
  `documents.ts`, `projects.ts` (export), and `templates.ts`. Add contract tests
  proving unauthorized users receive 403.
- **Verification**: Rerun `pnpm test` (contract suites) plus targeted negative
  tests to ensure unauthorized requests fail.

### Remediation R010 (F010)

- **Context**: Document provisioning leaves orphaned documents if section
  seeding fails.
- **Control Reference**: Document provisioning service within
  `apps/api/src/services/document-provisioning.service.ts`.
- **Actions**: Wrap document + section creation in a transaction (or implement
  compensating deletes) so failures roll back cleanly; add instrumentation for
  partial failures.
- **Verification**: Unit test provisioning with forced section write failures;
  rerun
  `pnpm --filter @ctrl-freaq/api test -- document-provisioning.service.test.ts`.

### Remediation R011 (F011)

- **Context**: Export jobs execute synchronously, preventing queued/running
  states and blocking the request thread.
- **Control Reference**: Export orchestration in
  `apps/api/src/services/export/document-export.service.ts`.
- **Actions**: Move artifact generation to an async worker (queue or background
  job), keep HTTP responses at `queued`, expose a status/polling endpoint, and
  update UI polling logic accordingly.
- **Verification**: Contract tests expecting `status: queued` plus an
  integration/E2E flow showing Project card transitions through
  queued→running→completed.

### Remediation R012 (F012)

- **Context**: Template locator never inspects `dist/templates`, so production
  builds still cannot provision documents without manual env overrides.
- **Control Reference**: Template locator in
  `apps/api/src/services/templates/template-path-resolver.ts`.
- **Actions**: Add `dist/templates` to the search roots or automatically set
  `CTRL_FREAQ_TEMPLATE_ROOT` during build/startup; document the deployment
  expectation.
- **Verification**: Build the API (`pnpm --filter @ctrl-freaq/api build`), run
  from `dist`, and exercise `POST /projects/:projectId/documents` to confirm it
  succeeds without repo-level templates present.

---

**Review Completed**: 2025-11-07T01:45:00Z

**Next Action**: Address Findings F009–F012, rerun lint/type/test/audit, and
resubmit the feature for audit.

# Code Review Report: Surface Document Editor (015-surface-document-editor)

## Final Status: **Changes Requested**

## Resolved Scope

**Branch**: `015-surface-document-editor` **Baseline**: `main` **Diff Source**:
`HEAD vs main` **Review Target**: Story 2.2 dossier – surface the live document
editor from the Project view (discovery, provisioning, export, template
decisions, collaboration flows) **Files Analyzed**: 95 changed files covering
Express routes/services, shared-data repositories, React workflow cards/hooks,
fixtures, and contract/E2E suites

**Resolved Scope Narrative**: Loaded the entire dossier under
`specs/015-surface-document-editor/`, then reviewed the HEAD→main diff for
backend discovery/provisioning/export routes, shared-data repositories, the
Project workflow surface, document bootstrap hooks, co-authoring/QA/assumption
integrations, and companion test assets. Verified constitutional gates by
re-running `pnpm lint`, `pnpm typecheck` (build + `tsc --noEmit`), `pnpm test`
(gauntlet), and `pnpm audit --audit-level high`.

**Feature Directory**: `specs/015-surface-document-editor` **Implementation
Scope**:

- `apps/api/src/routes/documents.ts` (primary snapshot + provisioning API)
- `apps/api/src/routes/projects.ts` (export queue endpoints)
- `apps/api/src/services/document-provisioning.service.ts` and helper registries
- `apps/web/src/pages/Project.tsx` (workflow cards, provisioning/export CTA,
  template gating)
- `apps/web/src/features/document-editor/hooks/use-document-bootstrap.ts`
- `apps/web/src/features/document-editor/services/assumptions-api.ts`

## SPEC_KIT_CONFIG

```yaml
spec-kit:
  constitution:
    path: 'CONSTITUTION.md'
  audit:
    documents:
      - path: 'docs/prd.md'
        context: 'Product requirements (FR-001…FR-014, success metrics).'
      - path: 'docs/architecture.md'
        context:
          'Backend architecture, service boundaries, security expectations.'
      - path: 'docs/ui-architecture.md'
        context: 'Frontend architecture, routing/state conventions.'
      - path: 'docs/front-end-spec.md'
        context: 'UX specification for workflow cards, loaders, accessibility.'
```

## Pre-Review Gates

| Gate                      | Status                 | Details                                                                                                                                              |
| ------------------------- | ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Context Gate**          | ✅ Pass                | `plan.md`, `spec.md`, `tasks.md`, `research.md`, `data-model.md`, `quickstart.md`, and contracts present under `specs/015-surface-document-editor/`. |
| **Change Intent Gate**    | ✅ Pass                | Code still implements Story 2.2 (live discovery/provisioning/export plus editor bootstrap + workflow cards).                                         |
| **Unknowns Gate**         | ⚠️ Needs Clarification | Branch protection / required reviewers / extra required checks remain unknown offline; tracked under Outstanding Clarifications.                     |
| **Separation of Duties**  | ⚪ Not Evaluated       | Local audit cannot inspect GitHub reviewer assignments.                                                                                              |
| **Code Owners Gate**      | ⚪ Not Evaluated       | No `.github/CODEOWNERS` file in repo; ownership must be confirmed in PR UI.                                                                          |
| **Quality Controls Gate** | ✅ Pass                | `pnpm lint`, `pnpm typecheck` (which runs full build), `pnpm test` (gauntlet), and `pnpm audit --audit-level high` all completed successfully.       |
| **TDD Evidence Gate**     | ✅ Pass                | Contract/unit/Playwright suites exist for new APIs & flows; gauntlet run provided passing evidence.                                                  |

## Findings

### Active Findings (Current Iteration)

#### Finding F013: Document detail route exposes content without project authorization

- **Category**: Security
- **Severity**: Critical
- **Confidence**: High
- **Impact**: `GET /documents/:documentId` returns the full document payload to
  any authenticated caller who can guess an ID. Unlike the new project-scoped
  routes, this handler never calls `requireProjectAccess`, and the
  `templateValidation` middleware only checks template bindings—it does not
  ensure the requester belongs to the owning project. This violates FR‑001 (only
  collaborators may open the document) and SEC‑01 by leaking architecture
  content across projects.
- **Evidence**: `apps/api/src/routes/documents.ts:347-392` shows the handler
  returning serialized data with no ownership check.
  `apps/api/src/middleware/template-validation.ts:69-153` and
  `apps/api/src/services/template-upgrade.service.ts:65-142` demonstrate that
  the middleware simply loads the document/template without consulting
  project/user data.
- **Remediation**: Resolve the document’s project (e.g., via
  `documentRepository.fetchProjectDocumentSnapshot`) and run the shared
  `requireProjectAccess` helper before responding; deny access when the
  authenticated user is not the project owner/maintainer. Add contract tests
  proving unauthorized users receive 403.
- **Source Requirement**: FR‑001, SEC‑01
- **Files**: apps/api/src/routes/documents.ts,
  apps/api/src/middleware/template-validation.ts,
  apps/api/src/services/template-upgrade.service.ts

#### Finding F014: Assumptions flow ignores document-scoped APIs, leaving section endpoints unprotected

- **Category**: Security
- **Severity**: Major
- **Confidence**: High
- **Impact**: Backend contracts added doc-scoped endpoints
  (`/documents/:docId/sections/:sectionId/...`) to ensure assumption sessions
  cannot mutate sections outside the active document. The frontend still calls
  the legacy `/sections/:sectionId/...` routes (see `AssumptionsApiService`), so
  the new guard never runs and section IDs remain globally writable. Attackers
  only need a section UUID to answer/escalate prompts on another team’s project,
  violating FR‑009 and SEC‑01.
- **Evidence**:
  `apps/web/src/features/document-editor/services/assumptions-api.ts:50-143`
  hardcodes `/sections/...` URLs with no document identifier. Contracts
  (`apps/api/tests/contract/documents/assumptions-flow.contract.test.ts:1-70`)
  and router updates (`apps/api/src/routes/sections.ts:1533-1686`) expect the UI
  to pass both document and section IDs, but that path is never exercised today.
- **Remediation**: Thread the current `documentId` through
  `createAssumptionsFlowBootstrap` / `useAssumptionsFlow` and update
  `AssumptionsApiService` to call the doc-scoped endpoints for session
  start/respond/stream/proposals. Remove or lock down the legacy section-only
  routes once the UI migrates, and extend tests to cover the document/section
  mismatch case.
- **Source Requirement**: FR‑009, SEC‑01
- **Files**: apps/web/src/features/document-editor/services/assumptions-api.ts,
  apps/web/src/features/document-editor/assumptions-flow/index.ts,
  apps/api/src/routes/sections.ts,
  apps/api/tests/contract/documents/assumptions-flow.contract.test.ts

### Historical Findings Log

- [Resolved 2025-11-07] **F012**: Template locator ignored build artifacts —
  Reported 2025-11-07. Resolution: `template-path-resolver` now checks
  `apps/api/dist/templates` and the build copies catalog assets there, so
  provisioning works from compiled bundles.
- [Resolved 2025-11-07] **F011**: Export workflow never surfaced queued states —
  Reported 2025-11-06. Resolution: `DocumentExportService` now creates queued
  jobs, spawns async processors, and the Project card polls
  `GET /export/jobs/:jobId`, restoring queued→running→completed transitions.
- [Resolved 2025-11-07] **F010**: Document provisioning not atomic — Reported
  2025-11-06. Resolution: Section creation uses explicit rollback
  (`deleteByDocumentId`) when seeding fails, preventing orphaned documents.
- [Resolved 2025-11-07] **F009**: Project document/export endpoints skipped
  authorization — Reported 2025-11-06. Resolution: `requireProjectAccess` helper
  enforces owner checks across discovery, provisioning, export, and template
  decision routes.
- [Resolved 2025-11-07] **F008**: Create Document API ignored overrides —
  Reported 2025-11-06. Resolution: Serializer + provisioning service honor
  `title/templateId/templateVersion/seedStrategy` inputs with contract coverage.
- [Resolved 2025-11-07] **F007**: Export workflow never produced artifacts —
  Reported 2025-11-06. Resolution: Export service writes base64 artifacts to job
  rows and surfaces them on completion.
- [Resolved 2025-11-06] **F006**: Production provisioning missed template assets
  — Resolved via build copy script
  (`apps/api/scripts/copy-template-assets.mjs`).
- [Resolved 2025-11-06] **F005**: Document templates absent from builds —
  Resolved alongside F006 (copy step + tests).
- [Resolved 2025-11-06] **F004**: Document route loader bypassed auth — Loader
  now instantiates the shared API client with loader tokens before hitting the
  API.
- [Resolved 2025-11-06] **F003**: Workflow card lost link semantics — Project
  workflow cards wrap their content in focusable `<Link>` components again.
- [Resolved 2025-11-06] **F002**: Document bootstrap failed missing-section
  fallbacks — `useDocumentBootstrap` validates section IDs and falls back to the
  first section with unit tests.
- [Resolved 2025-11-06] **F001**: API missed `@ctrl-freaq/exporter` dependency —
  `apps/api/package.json` now depends on the exporter package and the container
  registers `DocumentExportService`.

## Strengths

- Project workflow cards preserve the accessible link-wrapped pattern and keep
  status/description copy aligned with the spec vocabulary across
  Ready/Missing/Provisioning states.
- `useDocumentBootstrap` hydrates the editor from loader-prefetched data,
  normalizes TOC/section stores, and prevents editing until live data arrives,
  significantly reducing flicker and fixture drift.

## Feedback Traceability

| Feedback Item                                                          | Source                       | Status    | Evidence / Linked Findings                                                                                                                                                    |
| ---------------------------------------------------------------------- | ---------------------------- | --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Apply AGENTS.md monorepo guidelines (pnpm flows, constitutional gates) | Operator (2025-11-07T07:25Z) | Addressed | Followed pnpm-based lint/type/test/build commands and honored constitutional constraints (see Quality Signal Summary).                                                        |
| Execute the Code Review Playbook end-to-end                            | Operator (2025-11-07T07:25Z) | Addressed | All numbered steps completed: spec-kit load, prerequisites, dossier ingestion, scope/baseline resolution, gate evaluation, findings, quality evidence, audit/task write-back. |

## Outstanding Clarifications

- [NEEDS CLARIFICATION: What branch-protection / approval rules apply to
  `015-surface-document-editor` in GitHub?]
- [NEEDS CLARIFICATION: Which required status checks (beyond
  lint/type/test/build) gate merges for this repo?]

## Control Inventory

| Control Domain                    | Implementation                                                                                                                    | Status      | Reference                                                                                          |
| --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | ----------- | -------------------------------------------------------------------------------------------------- |
| **Authentication**                | Clerk/simple auth middleware plus loader token helper ensure every `/api/v1` call carries a bearer token.                         | Established | apps/api/src/middleware/auth.ts, apps/web/src/lib/auth-provider/loader-auth.ts                     |
| **Project Access Enforcement**    | `requireProjectAccess` validates owner IDs before project-scoped workflows (discovery, provisioning, export, template decisions). | Established | apps/api/src/routes/helpers/project-access.ts                                                      |
| **Document Detail Authorization** | Document detail route still lacks project-level checks.                                                                           | Gap (F013)  | apps/api/src/routes/documents.ts                                                                   |
| **Assumptions Flow Scoping**      | Backend accepts document-scoped endpoints, but UI keeps using section-only routes so cross-project writes remain possible.        | Gap (F014)  | apps/web/src/features/document-editor/services/assumptions-api.ts; apps/api/src/routes/sections.ts |
| **Template Provisioning**         | `DocumentProvisioningService` seeds templates/sections from shipped catalogs with rollback on failure.                            | Established | apps/api/src/services/document-provisioning.service.ts                                             |
| **Export Orchestration**          | `DocumentExportService` queues jobs, generates artifacts asynchronously, and exposes polling endpoints for the Project card.      | Established | apps/api/src/services/export/document-export.service.ts                                            |
| **Document Bootstrap & Stores**   | `useDocumentBootstrap` + document stores gate editing until live sections/metadata load, syncing project info.                    | Established | apps/web/src/features/document-editor/hooks/use-document-bootstrap.ts                              |

## Quality Signal Summary

### Linting Results

- **Status**: Pass (`pnpm lint`)
- **Warnings/Errors**: 0 warnings / 0 errors after turbo reran eslint across all
  workspaces.

### Type Checking

- **Status**: Pass (`pnpm typecheck`)
- **Results**: Runs `pnpm build` (turbo build of 10 packages) followed by
  `pnpm typecheck:noemit`; all TypeScript projects compiled without error.

### Test Results

- **Status**: Pass (`pnpm test`)
- **Results**: Gauntlet (`test:unit:ci`, `test:e2e:ci`, `test:visual:ci`)
  completed successfully after rerun with extended timeout; no Vitest or
  Playwright failures reported.

### Build Status

- **Status**: Pass (`pnpm build` as part of typecheck)
- **Details**: Turbo built API/web/packages (tsc + Vite) with caching; no build
  regressions surfaced.

### Dependency Audit Summary

- **Command**: `pnpm audit --audit-level high`
- **Result**: No known vulnerabilities found; no deprecated packages flagged
  within the audited scope.

## Requirements Coverage Table

| Requirement | Summary                                                                                        | Implementation Evidence                                                                                                                                                                                                        | Validating Tests                                                                                                                                | Linked Findings / Clarifications                                       |
| ----------- | ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| **FR-001**  | Collaborators must launch the document editor from the Project card with live data.            | `apps/web/src/pages/Project.tsx:1709-1825`, `apps/api/src/routes/documents.ts:217-344`.                                                                                                                                        | `apps/web/tests/e2e/project-open-document.e2e.ts`.                                                                                              | Linked to F013 (document detail route still leaks data cross-project). |
| **FR-009**  | Assumption flows must run against the active project/document IDs and log state in the editor. | Backend routes/contracts: `apps/api/src/routes/sections.ts:1533-1686`, `apps/api/tests/contract/documents/assumptions-flow.contract.test.ts`. UI bootstrap: `apps/web/src/features/document-editor/assumptions-flow/index.ts`. | Contract suite above plus `apps/web/tests/integration/document-editor/assumptions-resume.test.ts`.                                              | Linked to F014 (UI still calls section-only endpoints).                |
| **FR-013**  | Project export card queues exports and surfaces progress/results inline.                       | `apps/api/src/routes/projects.ts:1336-1508`, `apps/api/src/services/export/document-export.service.ts:45-220`, `apps/web/src/pages/Project.tsx:301-437`.                                                                       | `apps/api/tests/contract/projects/export-project.contract.test.ts`, `apps/web/tests/e2e/project-open-document.e2e.ts` (export card assertions). | —                                                                      |

## Requirements Compliance Checklist

| Requirement Group             | Status               | Notes                                                                                    |
| ----------------------------- | -------------------- | ---------------------------------------------------------------------------------------- |
| **Constitutional Principles** | ⚠️ Changes Requested | Document detail route still skips ownership checks (F013).                               |
| **SOC 2 Authentication**      | ⚠️ Changes Requested | Same as above—unauthorized document reads break access control.                          |
| **SOC 2 Logging**             | ✅ Pass              | Structured logging present across new services (provisioning/export/template decisions). |
| **Security Controls**         | ⚠️ Changes Requested | Assumption flow scoping incomplete on the client (F014).                                 |
| **Code Quality**              | ✅ Pass              | Lint/type/test/build suites clean; stores/hooks instrumented with tests.                 |
| **Testing Requirements**      | ✅ Pass              | Contract/unit/Playwright suites updated; gauntlet run provides passing evidence.         |

## Decision Log

1. **2025-11-07** — Document detail handler still bypasses project access
   control; recorded as F013 for remediation.
2. **2025-11-07** — Assumption flow still targets legacy section endpoints
   despite new document-scoped APIs; recorded as F014 and requires coordinated
   UI/API updates.

## Remediation Logging

### Remediation R013 (F013)

- **Context**: Document detail endpoint leaks architecture content across
  projects because it lacks project-level authorization.
- **Control Reference**: `requireProjectAccess` helper
  (`apps/api/src/routes/helpers/project-access.ts`).
- **Actions**: Resolve each document’s project before responding; invoke
  `requireProjectAccess` (or equivalent membership-based check) using the
  authenticated user; add contract tests covering unauthorized access attempts;
  ensure template validation middleware short-circuits when authorization fails.
- **Verification**: Re-run
  `pnpm --filter @ctrl-freaq/api test -- documents.ts project-primary-document.contract.test.ts`
  (or equivalent suite) plus a new negative test showing 403 for mismatched
  users.

### Remediation R014 (F014)

- **Context**: Frontend still calls `/sections/:sectionId/...` assumption
  endpoints, so document-level guards never execute.
- **Control Reference**: Assumptions API client + router
  (`apps/web/src/features/document-editor/services/assumptions-api.ts`,
  `apps/api/src/routes/sections.ts`).
- **Actions**: Thread `documentId` through assumption flows, switch all client
  calls to `/documents/:docId/sections/:sectionId/...`, and remove/lock legacy
  section-only routes once clients deploy. Expand contract + integration tests
  to assert 404 on document/section mismatches.
- **Verification**:
  `pnpm --filter @ctrl-freaq/api test -- documents/assumptions-flow.contract.test.ts`
  plus the relevant web integration/e2e suites should pass with doc-scoped URLs.

---

**Review Completed**: 2025-11-07T07:47:52Z

**Next Action**: Implement remediations for F013 and F014, rerun
lint/type/test/audit, and resubmit the feature for audit.

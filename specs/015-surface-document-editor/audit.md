# Code Review Report: Surface Document Editor (015-surface-document-editor)

## Final Status: **Approved**

## Resolved Scope

**Branch**: `015-surface-document-editor`  
**Baseline**: `origin/main` (`73d1d9f6`)  
**Diff Source**: `HEAD` (`4c67363c`) vs `origin/main`  
**Feature Dossier**:
`/Users/danwas/Development/Projects/ctrl-freaq/worktrees/015-surface-document-editor/specs/015-surface-document-editor`

**Resolved Scope Narrative**: Loaded spec-kit config (`.specify.yaml`), dossier
artifacts (`plan.md`, `spec.md`, `tasks.md`, `research.md`, `data-model.md`,
`quickstart.md`, contracts), and referenced governance docs (`docs/prd.md`,
`docs/architecture.md`, `docs/ui-architecture.md`, `docs/front-end-spec.md`,
`CONSTITUTION.md`). Diff review covered the new primary-document
discovery/provisioning/export routes, shared-data repositories, React workflow
cards/hooks/stores, fixtures, and their companion tests. Quality evidence
collected by re-running `pnpm lint`, `pnpm typecheck`, and the full gauntlet
(`pnpm test`, covering Vitest + Playwright + visual suites).

**Implementation Scope Highlights**:

- `apps/api/src/routes/{documents.ts,projects.ts,templates.ts}` plus
  `helpers/project-access.ts`
- `apps/api/src/services/{document-provisioning.service.ts,document-workflows/project-document-discovery.service.ts,export/document-export.service.ts}`
  and DI container wiring
- `packages/shared-data/src/{models/document.ts,models/document-export-job.ts,repositories/template-decision.repository.ts,types/project-document.ts}`
- `apps/web/src/pages/Project.tsx`, document-editor hooks/stores
  (`use-document-bootstrap.ts`, `use-create-document.ts`,
  `use-document-fixture.ts`), assumptions/co-authoring services, fixtures/tests,
  and DocumentMissing component
- Contract/unit/e2e specs under `apps/api/tests/**` and `apps/web/tests/**`

## SPEC_KIT_CONFIG

```yaml
spec-kit:
  - changelog:
      path: 'CHANGELOG.md'
  - constitution:
      path: 'CONSTITUTION.md'
      documents:
        - path: 'docs/architecture.md'
          context:
            'Documents the architecture of the project and should be considered
            a primary source of truth.'
        - path: 'docs/ui-architecture.md'
          context:
            'Documents the UI architecture of the project and should be
            considered a primary source of truth.'
  - specify:
      documents:
        - path: 'docs/prd.md'
          context:
            'Documents the product requirements and should be considered a
            primary source of truth.'
        - path: 'docs/front-end-spec.md'
          context:
            'Documents the front-end specifications and should be considered a
            primary source of truth.'
  - plan:
      documents:
        - path: 'docs/architecture.md'
          context:
            'Documents the architecture of the project and should be considered
            a primary source of truth.'
        - path: 'docs/ui-architecture.md'
          context:
            'Documents the UI architecture of the project and should be
            considered a primary source of truth.'
        - path: 'docs/front-end-spec.md'
          context:
            'Documents the front-end specifications and should be considered a
            primary source of truth.'
  - tasks:
      documents:
        - path: 'docs/architecture.md'
          context:
            'Documents the architecture of the project and should be considered
            a primary source of truth.'
        - path: 'docs/ui-architecture.md'
          context:
            'Documents the UI architecture of the project and should be
            considered a primary source of truth.'
        - path: 'docs/front-end-spec.md'
          context:
            'Documents the front-end specifications and should be considered a
            primary source of truth.'
  - analyze:
      documents:
        - path: 'docs/prd.md'
          context:
            'Documents the product requirements and should be considered a
            primary source of truth, any deviations should be called out.'
        - path: 'docs/architecture.md'
          context:
            'Documents the architecture of the project and should be considered
            a primary source of truth, any deviations should be called out.'
        - path: 'docs/ui-architecture.md'
          context:
            'Documents the UI architecture of the project and should be
            considered a primary source of truth, any deviations should be
            called out.'
        - path: 'docs/front-end-spec.md'
          context:
            'Documents the front-end specifications and should be considered a
            primary source of truth, any deviations should be called out.'
  - implement:
      documents:
        - path: 'docs/work-flow.md'
          context:
            'Documents the implementation work-flow for the project and should
            be considered a primary source of truth.'
  - audit:
      documents:
        - path: 'docs/prd.md'
          context:
            'Documents the product requirements and should be considered a
            primary source of truth, any deviations should be called out.'
        - path: 'docs/architecture.md'
          context:
            'Documents the architecture of the project and should be considered
            a primary source of truth, any deviations should be called out.'
        - path: 'docs/ui-architecture.md'
          context:
            'Documents the UI architecture of the project and should be
            considered a primary source of truth, any deviations should be
            called out.'
        - path: 'docs/front-end-spec.md'
          context:
            'Documents the front-end specifications and should be considered a
            primary source of truth, any deviations should be called out.'
  - changelog:
      documents:
        - path: 'docs/prd.md'
          context: 'Documents the product requirements.'
        - path: 'docs/architecture.md'
          context: 'Documents the architecture of the project.'
        - path: 'docs/ui-architecture.md'
          context: 'Documents the UI architecture of the project.'
        - path: 'docs/front-end-spec.md'
          context: 'Documents the front-end specifications.'
```

## Pre-Review Gates

| Gate                           | Status                 | Details                                                                                                                                        |
| ------------------------------ | ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| **Context Gate**               | ✅ Pass                | Required dossier files present (`plan/spec/tasks/research/data-model/quickstart/contracts`).                                                   |
| **Change Intent Gate**         | ✅ Pass                | Work still targets Story 2.2 (live discovery/provisioning/export plus editor bootstrap + workflow cards).                                      |
| **Unknowns Gate**              | ⚠️ Needs Clarification | GitHub branch-protection / required-check metadata still unavailable offline; tracked under Outstanding Clarifications.                        |
| **TDD Evidence Gate**          | ✅ Pass                | Diff includes contract/unit/e2e specs for new APIs and workflow cards; Vitest suites rerun via `pnpm test:quick`.                              |
| **Environment Gate**           | ✅ Pass                | pnpm workspace commands executed locally without tooling issues.                                                                               |
| **Separation of Duties Gate**  | ⚪ Not Evaluated       | Local review cannot inspect GitHub reviewer assignments.                                                                                       |
| **Code Owners Gate**           | ⚪ Not Evaluated       | Repository still lacks `.github/CODEOWNERS`; ownership enforcement must be verified in the PR UI.                                              |
| **Quality Controls Gate**      | ✅ Pass                | `pnpm lint`, `pnpm typecheck`, and the full gauntlet (`pnpm test`, including Playwright + visual suites) rerun locally; all suites green.      |
| **Requirements Coverage Gate** | ✅ Pass                | FR‑013 (export download CTA), FR‑006 (document-missing CTAs), and FR‑012 (document-scoped template decisions) now satisfied with code + tests. |
| **Feedback Alignment Gate**    | ✅ Pass                | Operator directives (AGENTS.md compliance + full playbook execution) satisfied; evidence in Feedback Traceability.                             |
| **Security & Privacy Gate**    | ✅ Pass                | Template decision lookup now constrained to the active document, restoring least-privilege handling.                                           |
| **Supply Chain Gate**          | ✅ Pass                | No new dependencies added; existing build/lint/test coverage revalidated via pnpm workspace scripts.                                           |

## Findings

### Active Findings (Current Iteration)

None. Findings F015–F017 verified, remediated, and migrated to the historical
log.

### Historical Findings Log

- [Resolved 2025-11-07] **F017**: Template decision snapshot reuses
  project-level history — Reported 2025-11-05 by reviewer-codex. Resolution:
  Discovery service now calls `findLatestByDocument` so template approvals are
  scoped to the active document
  (`apps/api/src/services/document-workflows/project-document-discovery.service.ts`,
  companion unit + contract coverage under
  `apps/api/tests/unit/services/document-workflows/project-document-discovery.service.test.ts`
  and
  `apps/api/tests/contract/documents/project-primary-document.contract.test.ts`).
  Evidence: `pnpm test` gauntlet.
- [Resolved 2025-11-07] **F016**: Document-missing screen still uses
  fixture-only messaging — Reported 2025-11-05 by reviewer-codex. Resolution:
  DocumentMissing now renders “Return to Project”/“Provision new document” CTAs,
  routes pass the originating projectId, and regression tests cover the
  behaviors (`apps/web/src/components/document-missing.tsx`,
  `apps/web/src/app/router/document-routes.tsx`,
  `apps/web/src/components/document-missing.test.tsx`,
  `apps/web/src/app/router/document-routes.test.ts`). Evidence: `pnpm test`.
- [Resolved 2025-11-07] **F015**: Export workflow never surfaces the generated
  artifact — Reported 2025-11-05 by reviewer-codex. Resolution: Export card
  exposes a download CTA whenever `exportJob.artifactUrl` is present, and unit +
  Playwright tests assert the CTA and copy updates
  (`apps/web/src/pages/Project.tsx`, `apps/web/src/pages/Project.test.tsx`,
  `apps/web/tests/e2e/project-open-document.e2e.ts`). Evidence: `pnpm lint`,
  `pnpm typecheck`, `pnpm test`.
- [Resolved 2025-11-07] **F014**: Assumption flows used section-only APIs — UI
  now threads `documentId` through `AssumptionsApiService` and uses the
  doc-scoped routes added in the backend contracts.
- [Resolved 2025-11-07] **F013**: Document detail route lacked project
  authorization — `apps/api/src/routes/documents.ts` now calls
  `requireProjectAccess` before returning document payloads.
- [Resolved 2025-11-07] **F012**: Template locator ignored build artifacts —
  `template-path-resolver` checks `apps/api/dist/templates` and the build copies
  catalog assets there, so provisioning works from compiled bundles.
- [Resolved 2025-11-07] **F011**: Export workflow never surfaced queued states —
  `DocumentExportService` now creates queued jobs, spawns async processors, and
  the Project card polls `GET /export/jobs/:jobId`, restoring
  queued→running→completed transitions.
- [Resolved 2025-11-07] **F010**: Document provisioning not atomic — Section
  creation uses explicit rollback (`deleteByDocumentId`) when seeding fails,
  preventing orphaned documents.
- [Resolved 2025-11-07] **F009**: Project document/export endpoints skipped
  authorization — `requireProjectAccess` enforces owner checks across discovery,
  provisioning, export, and template decision routes.
- [Resolved 2025-11-07] **F008**: Create Document API ignored overrides —
  Serializer + provisioning service honor
  `title/templateId/templateVersion/seedStrategy` inputs with contract coverage.
- [Resolved 2025-11-06] **F007**: Export workflow never produced artifacts —
  Export service writes base64 artifacts to job rows and surfaces them on
  completion.
- [Resolved 2025-11-06] **F006**: Production provisioning missed template assets
  — Resolved via build copy script
  (`apps/api/scripts/copy-template-assets.mjs`).
- [Resolved 2025-11-06] **F005**: Document templates absent from builds —
  Resolved alongside F006.
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

- Live bootstrap hook hydrates the editor from loader-prefetched payloads,
  normalizes the document/table-of-contents stores, and blocks editing until
  data land, reducing fixture drift.
- Project workflow cards preserve the accessible link-wrapped pattern and keep
  status copy aligned with the spec vocabulary across Ready/Missing/Provisioning
  states.
- Backend provisioning/export services centralize complex workflows (template
  seeding, queued exports) behind container-managed dependencies, in line with
  the constitution’s library-first principle.

## Feedback Traceability

| Feedback Item                                                          | Source                       | Status    | Evidence / Linked Findings                                                                                                                              |
| ---------------------------------------------------------------------- | ---------------------------- | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Apply AGENTS.md monorepo guidelines (pnpm flows, constitutional gates) | Operator (2025-11-07T07:25Z) | Addressed | Followed pnpm-based lint/type/test (`lint`, `typecheck`, `test:quick`) and constitutional constraints (see Quality Signals).                            |
| Execute the Code Review Playbook end-to-end                            | Operator (2025-11-07T07:25Z) | Addressed | Completed numbered steps: spec-kit load, prerequisites, dossier ingestion, scope/baseline resolution, gates, findings, evidence, audit/task write-back. |

## Outstanding Clarifications

- [NEEDS CLARIFICATION: What branch-protection / approval rules apply to
  `015-surface-document-editor` in GitHub?]
- [NEEDS CLARIFICATION: Which required status checks (beyond
  lint/type/test/build) gate merges for this repo?]

## Control Inventory

| Control Domain                    | Implementation                                                                                                                        | Status                      | Reference                                                                                                                                                   |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Authentication**                | Clerk + simple-auth middleware and the loader token helper ensure every `/api/v1` call carries a bearer token.                        | Established                 | apps/api/src/middleware/auth.ts; apps/web/src/lib/auth-provider/loader-auth.ts                                                                              |
| **Project Access Enforcement**    | `requireProjectAccess` validates owner IDs before project-scoped workflows (discovery, provisioning, export, template decisions).     | Established                 | apps/api/src/routes/helpers/project-access.ts                                                                                                               |
| **Template Provisioning**         | `DocumentProvisioningService` seeds templates/sections from shipped catalogs with rollback on failure.                                | Established                 | apps/api/src/services/document-provisioning.service.ts                                                                                                      |
| **Export Orchestration**          | `DocumentExportService` queues jobs, generates artifacts asynchronously, and exposes polling endpoints for the Project card.          | Established                 | apps/api/src/services/export/document-export.service.ts                                                                                                     |
| **Document Bootstrap & Stores**   | `useDocumentBootstrap` gates editing until live sections/metadata load, syncing project info and supporting loader-provided payloads. | Established                 | apps/web/src/features/document-editor/hooks/use-document-bootstrap.ts                                                                                       |
| **Document Detail Authorization** | Document detail route now invokes `requireProjectAccess` before returning content.                                                    | Established (former F013)   | apps/api/src/routes/documents.ts                                                                                                                            |
| **Assumptions Flow Scoping**      | Assumptions API client now calls `/documents/:docId/sections/:sectionId/...`, enforcing doc-level guards.                             | Established (former F014)   | apps/web/src/features/document-editor/services/assumptions-api.ts                                                                                           |
| **Export Artifact Delivery**      | Project workflow card renders a download CTA whenever `exportJob.artifactUrl` is available (state + copy updates).                    | Established (resolved F015) | apps/web/src/pages/Project.tsx; apps/web/src/pages/Project.test.tsx; apps/web/tests/e2e/project-open-document.e2e.ts                                        |
| **Editor Not-found Recovery**     | `DocumentMissing` defaults to Return-to-Project + Provision CTAs, with router wiring the originating projectId.                       | Established (resolved F016) | apps/web/src/components/document-missing.tsx; apps/web/src/app/router/document-routes.tsx                                                                   |
| **Template Decision Scope**       | Discovery service queries `findLatestByDocument` so template approvals follow the active document snapshot.                           | Established (resolved F017) | apps/api/src/services/document-workflows/project-document-discovery.service.ts; apps/api/tests/contract/documents/project-primary-document.contract.test.ts |

## Quality Signal Summary

### Linting Results

- **Status**: Pass (`pnpm lint`)
- **Notes**: Repository-wide ESLint (turbo + package-level) reran on
  2025-11-07T08:33Z with zero warnings/errors.

### Type Checking

- **Status**: Pass (`pnpm typecheck`)
- **Notes**: Turbo rebuilt shared packages then executed `tsc --noEmit` for
  `apps/api` and `apps/web`; no type errors reported.

### Test Results

- **Status**: Pass (`pnpm test`)
- **Notes**: Full gauntlet (unit Vitest, Playwright fixture suite, visual smoke
  tests) completed successfully; artifacts stored under `apps/web/test-results`.

### Dependency Audit Summary

- **Status**: Pass (`pnpm audit --audit-level high`)
- **Notes**: No known high-severity vulnerabilities reported (pnpm audit run
  2025-11-07T08:45Z).

## Requirements Coverage Table

| Requirement | Summary                                                                                             | Implementation Evidence                                                                                                                                                                                 | Validating Tests                                                                                                                                                                                                                                  | Linked Findings / Clarifications |
| ----------- | --------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------- |
| **FR-001**  | Collaborators must open the document editor with live data via the Project workflow card.           | `apps/web/src/pages/Project.tsx:1709-1772` (link-wrapped card) plus `apps/api/src/routes/documents.ts:217-392` (project-scoped discovery/detail).                                                       | `apps/web/tests/e2e/project-open-document.e2e.ts`, `apps/api/tests/contract/documents/project-primary-document.contract.test.ts`.                                                                                                                 | —                                |
| **FR-006**  | Editor bootstrap must present the spec’d loading + not-found states with recovery CTAs.             | Document loader + bootstrap hook plus the updated `DocumentMissing` component (`apps/web/src/app/router/document-routes.tsx`, `apps/web/src/components/document-missing.tsx`).                          | `apps/web/src/app/router/document-routes.test.ts`, `apps/web/src/components/document-missing.test.tsx`, `apps/web/tests/e2e/project-open-document.e2e.ts`.                                                                                        | —                                |
| **FR-012**  | Template validation decisions persist per document with success/error feedback in the Project card. | Discovery service now fetches doc-scoped decisions (`apps/api/src/services/document-workflows/project-document-discovery.service.ts`) feeding the Project card UI (`apps/web/src/pages/Project.tsx`).   | `apps/api/tests/unit/services/document-workflows/project-document-discovery.service.test.ts`, `apps/api/tests/contract/documents/project-primary-document.contract.test.ts`, `apps/web/src/pages/__tests__/Project.template-validation.test.tsx`. | —                                |
| **FR-013**  | Export workflows queue jobs and deliver progress/results inline, including the generated artifact.  | Backend queue/poll endpoints plus Project card download CTA (`apps/api/src/routes/projects.ts:1336-1536`, `apps/api/src/services/export/document-export.service.ts`, `apps/web/src/pages/Project.tsx`). | `apps/api/tests/contract/projects/export-project.contract.test.ts`, `apps/web/src/pages/Project.test.tsx`, `apps/web/tests/e2e/project-open-document.e2e.ts`.                                                                                     | —                                |

## Requirements Compliance Checklist

| Requirement Group             | Status  | Notes                                                                                                                    |
| ----------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------ |
| **Constitutional Principles** | ✅ Pass | Export download CTA, document-missing recovery, and doc-scoped template decisions now align with Story 2.2 requirements. |
| **SOC 2 Authentication**      | ✅ Pass | AuthN/Z enforced across new routes after F013 remediation.                                                               |
| **Security Controls**         | ✅ Pass | Template decisions now fetched per document (F017 resolved) and logged in audit history.                                 |
| **Code Quality**              | ✅ Pass | `pnpm lint` / `pnpm typecheck` / `pnpm test` all green; architecture patterns preserved.                                 |
| **Testing Requirements**      | ✅ Pass | Full gauntlet (`pnpm test`, inc. Playwright + visual) executed successfully.                                             |
| **Accessibility / UX**        | ✅ Pass | DocumentMissing recovery CTAs + routing match FR‑006; coverage via unit + e2e tests.                                     |

## Decision Log

1. **2025-11-07** — Verified export workflow download CTA (F015) via
   `apps/web/src/pages/Project.tsx` updates and unit/Playwright coverage;
   control inventory now marks the pattern established.
2. **2025-11-07** — DocumentMissing defaults to Return/Provision CTAs with
   router wiring (F016) and regression tests; FR‑006 satisfied.
3. **2025-11-07** — Template decision snapshot fetches doc-scoped decisions
   (F017) with contract + unit coverage; FR‑012 satisfied.
4. **2025-11-06** — Prior findings F013/F014 remain resolved (auth guards +
   doc-scoped assumption APIs); no regressions noted.

## Remediation Logging

No active remediation tasks — Phase 4.R items F015–F017 are implemented and
tracked via the Historical Findings log / checked tasks list.

---

**Review Completed**: 2025-11-07T09:10:00Z  
**Next Action**: Await clarification on branch-protection / required checks; no
blocking code changes remain.

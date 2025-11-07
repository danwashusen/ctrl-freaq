# Code Review Report: Surface Document Editor (015-surface-document-editor)

## Final Status: **Changes Requested**

## Resolved Scope

**Branch**: `015-surface-document-editor` **Baseline**: `main` **Diff Source**:
`HEAD vs main` **Review Target**: Story 2.2 Surface Document Editor dossier and
supporting API/web workflows **Files Analyzed**: 10 dossier files plus the
runtime API/web modules that power document discovery, provisioning, export, and
editor bootstrap

**Resolved Scope Narrative**: Reviewed the spec/plan/tasks/contracts in
`specs/015-surface-document-editor/` and re-ran the existing implementation
across the API (`documents.ts`, provisioning/export services) and web client
(`Project.tsx`, document route loader, bootstrap hooks) to verify FR‑001–FR‑014
compliance. Special focus was placed on production build behaviour and the
export workflow since the prior audit flagged regressions there.

**Feature Directory**: `specs/015-surface-document-editor` **Implementation
Scope**:

- specs/015-surface-document-editor/spec.md
- specs/015-surface-document-editor/contracts/project-document-workflows.openapi.yaml
- apps/api/src/routes/documents.ts
- apps/api/src/services/document-provisioning.service.ts
- apps/api/src/services/export/document-export.service.ts
- apps/web/src/pages/Project.tsx

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
          'UI/UX specification – defines accessible workflow expectations.'
```

## Pre-Review Gates

| Gate                      | Status           | Details                                                                                                                                                         |
| ------------------------- | ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Context Gate**          | ✅ Pass          | `plan.md`, `spec.md`, `tasks.md`, `research.md`, `data-model.md`, `quickstart.md`, and contracts were present and readable.                                     |
| **Change Intent Gate**    | ✅ Pass          | Dossier and inspected modules align with Story 2.2 POR (document discovery/provisioning/export plus Project ↔ editor wiring).                                  |
| **Unknowns Gate**         | ✅ Pass          | No `[NEEDS CLARIFICATION]` markers or unresolved conversation items remained.                                                                                   |
| **Separation of Duties**  | ⚪ Not Evaluated | Local workspace review; branch protection/approver assignments unavailable offline.                                                                             |
| **Code Owners Gate**      | ⚪ Not Evaluated | Repository lacks a CODEOWNERS file; owner enforcement status unknown.                                                                                           |
| **Quality Controls Gate** | ✅ Pass          | `pnpm lint`, `pnpm typecheck` (build + `tsc --noEmit`), and `pnpm test` (full gauntlet) all completed successfully after rerunning tests with a longer timeout. |
| **TDD Evidence Gate**     | ✅ Pass          | Contract/unit/E2E suites exist for the new workflows and were exercised by the gauntlet.                                                                        |

## Findings

### Active Findings (Current Iteration)

#### Finding F006: Production builds still cannot provision documents because the template path points outside `dist`

- **Category**: Functional
- **Severity**: Critical
- **Confidence**: High
- **Impact**: When the API runs from `dist`, `DocumentProvisioningService`
  resolves the template path to `/apps/templates/architecture-reference.yaml`,
  but only `/templates/architecture-reference.yaml` (repo root) and
  `dist/templates/…` exist. The provisioning service therefore throws
  `TemplateProvisioningError`, so `POST /projects/:projectId/documents` fails in
  production builds, violating FR‑004 and blocking the Create Document workflow
  outside dev mode.
- **Evidence**: `apps/api/src/services/document-provisioning.service.ts:52-86`
  hard-codes `join(currentDir, '..', '..', '..', '..', 'templates', ...)`. A
  quick path evaluation shows the discrepancy: running `node -e` from repo root
  prints `src path: …/templates/architecture-reference.yaml` and
  `dist path: …/apps/templates/architecture-reference.yaml`, and
  `apps/templates` does not exist. Meanwhile
  `apps/api/scripts/copy-template-assets.mjs` ships assets to
  `apps/api/dist/templates`, so the service never reads the copied files when
  compiled.
- **Remediation**: Detect the runtime root (e.g., probe `dist/templates` first,
  fall back to repo root) or embed the template by importing it before build.
  Add an integration test that runs against `node dist/apps/api/src/index.js`
  and provisions a document to catch path regressions.
- **Source Requirement**: FR-004 (provision document with progress/duplicate
  guards)
- **Files**: apps/api/src/services/document-provisioning.service.ts,
  apps/api/scripts/copy-template-assets.mjs, apps/api/package.json

#### Finding F007: Export workflow never progresses beyond “Queued,” so users never receive artifacts

- **Category**: Functional
- **Severity**: Major
- **Confidence**: High
- **Impact**: `DocumentExportService.enqueue` only inserts a queued job and
  immediately returns without invoking `DocumentExporter` or updating the job
  status. The Project page (`apps/web/src/pages/Project.tsx:296-439`) merely
  reflects that initial status and offers no polling. As a result, the “Export
  Project” card stays in the `Queued` state forever and no `artifactUrl` is
  produced, so FR‑013 (“deliver the resulting artifact or job status”) is unmet.
- **Evidence**: `apps/api/src/services/export/document-export.service.ts:1-67`
  queues the job and logs but never calls `this.deps.exporter.run` or
  transitions jobs to `running/completed`. There is no worker or background
  queue in this branch, and the web client never polls
  `GET /projects/:projectId/export/:jobId` to detect completion.
- **Remediation**: Wire `DocumentExporter` (or a worker) so enqueueing triggers
  actual export work, update the job row to `running/completed` with
  `artifactUrl`, and expose status polling to the UI. Add contract/RTL/E2E
  coverage to ensure the Project export card flips to `Ready` with a
  downloadable link.
- **Source Requirement**: FR-013 (export artifact delivery)
- **Files**: apps/api/src/services/export/document-export.service.ts,
  apps/api/src/routes/projects.ts, apps/web/src/pages/Project.tsx

#### Finding F008: The Create Document API ignores the OpenAPI request contract

- **Category**: Requirements / Contract
- **Severity**: Major
- **Confidence**: Medium-High
- **Impact**: The published OpenAPI spec allows clients to override `title`,
  `templateId`, `templateVersion`, and `seedStrategy`, but
  `CreateDocumentRequestSchema` only accepts an optional `templateId` and
  `DocumentProvisioningService` always uses the hard-coded
  `DEFAULT_TEMPLATE_ID`/version. Clients sending supported overrides either get
  stripped payloads or 400 responses, so downstream tooling cannot seed
  alternative templates despite FR‑004 requiring that flexibility.
- **Evidence**:
  `specs/015-surface-document-editor/contracts/project-document-workflows.openapi.yaml:199-216`
  documents the richer request. `apps/api/src/routes/documents.ts:48-92` defines
  `CreateDocumentRequestSchema` with only `templateId`, and
  `apps/api/src/services/document-provisioning.service.ts:28-118` ignores even
  that optional parameter, always loading `architecture-reference`. No tests
  cover override scenarios.
- **Remediation**: Expand the request schema to accept the documented fields,
  plumb them through the provisioning service (validating allowed
  templates/versions and seed strategies), and add contract/integration tests
  that prove overrides change the created document’s metadata.
- **Source Requirement**: FR-004 (provision document with progress / prevent
  duplicates)
- **Files**:
  specs/015-surface-document-editor/contracts/project-document-workflows.openapi.yaml,
  apps/api/src/routes/documents.ts,
  apps/api/src/services/document-provisioning.service.ts

### Historical Findings Log

- [Resolved 2025-11-06] F005: Document provisioning template asset missing from
  builds — Reported 2025-11-06 by reviewer. Resolution: Added
  `apps/api/scripts/copy-template-assets.mjs` to ship the template into
  `dist/templates` during `pnpm --filter @ctrl-freaq/api build`; see F006 for
  the remaining runtime path mismatch that still blocks provisioning from
  compiled output.
- [Resolved 2025-11-06] F004: Document route loader bypasses API client auth —
  Reported 2025-11-06 by reviewer. Resolution:
  `apps/web/src/app/router/document-routes.tsx` now instantiates the shared
  `ApiClient` with `getLoaderAuthToken`, and loader tests cover authenticated
  flows.
- [Resolved 2025-11-06] F003: Project workflow card must restore link-wrapped
  accessibility semantics — Reported 2025-11-06 by reviewer. Resolution:
  `apps/web/src/pages/Project.tsx` reinstated link semantics and RTL tests cover
  keyboard activation.
- [Resolved 2025-11-06] F002: Document bootstrap fails to fall back when the
  requested section is missing — Reported 2025-11-06 by reviewer. Resolution:
  `use-document-bootstrap.ts` validates section IDs and tests assert the
  fallback behaviour.
- [Resolved 2025-11-06] F001: API lacks dependency on `@ctrl-freaq/exporter` —
  Reported 2025-11-06 by reviewer. Resolution: `apps/api/package.json` declares
  the exporter dependency and contract tests execute successfully.

## Strengths

- The document route loader now reuses the shared API client plus
  loader-specific token resolution, so FR‑001/FR‑005 can operate in both Clerk
  and simple-auth modes without bespoke fetch plumbing.
- Project workflow cards expose accessible, stateful copy (“Ready / Missing /
  Provisioning”) with consistent focus states, aligning with the UX checklist
  and keeping Live/Fixture modes in sync.

## Feedback Traceability

| Feedback Item                               | Source                          | Status    | Evidence / Linked Findings                                                                                                         |
| ------------------------------------------- | ------------------------------- | --------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Adhere to AGENTS repo guidelines            | Operator (2025-11-06T23:10:10Z) | Addressed | Review cites constitution/spec docs, records control inventory, and respects pnpm/monorepo conventions.                            |
| Execute the Code Review Playbook end-to-end | Operator (2025-11-06T23:10:10Z) | Addressed | All playbook steps (spec kit config, gates, SESSION_FEEDBACK mapping, audit write-back, Phase 4.R tasks) completed in this report. |

## Outstanding Clarifications

- _(None)_

## Control Inventory

| Control Domain               | Implementation                                                                             | Status      | Reference                                                                                                 |
| ---------------------------- | ------------------------------------------------------------------------------------------ | ----------- | --------------------------------------------------------------------------------------------------------- |
| **Authentication**           | Bearer/clerk tokens enforced via middleware and loader token helpers                       | Established | `apps/api/src/middleware/auth.ts`, `apps/web/src/lib/auth-provider/loader-auth.ts`                        |
| **Logging**                  | Pino logger with requestId/user context injected via DI                                    | Established | `apps/api/src/core/logging.ts`, `apps/api/src/core/service-locator.ts`                                    |
| **Error Handling**           | `sendErrorResponse` utility normalises codes/messages across routes                        | Established | `apps/api/src/routes/documents.ts`                                                                        |
| **Repository Pattern**       | Shared-data repositories isolate SQLite access and DI wiring                               | Established | `packages/shared-data/src/repositories/index.ts`                                                          |
| **Input Validation**         | `zod` schemas guard params/payloads before hitting services                                | Established | `apps/api/src/routes/projects.ts`                                                                         |
| **State Management**         | Project/document workflow state managed via Template/Document stores                       | Established | `apps/web/src/stores/template-store.ts`, `apps/web/src/features/document-editor/stores/document-store.ts` |
| **Template Asset Packaging** | Copy script ships templates into `dist/templates`, but runtime path still incorrect (F006) | Gap         | `apps/api/scripts/copy-template-assets.mjs`, `apps/api/src/services/document-provisioning.service.ts`     |
| **Export Orchestration**     | Export service enqueues jobs but lacks execution/telemetry (F007)                          | Gap         | `apps/api/src/services/export/document-export.service.ts`                                                 |

## Quality Signal Summary

### Linting Results

- **Status**: Pass
- **Warnings**: 0 warnings, 0 errors surfaced by `pnpm lint` (turbo lint + repo
  ESLint cache pass)
- **Key Issues**: None

### Type Checking

- **Status**: Pass
- **Results**: `pnpm typecheck` invoked `turbo build` + `tsc --noEmit`; all
  packages compiled without errors.

### Test Results

- **Status**: Pass
- **Results**: `pnpm test` (gauntlet) initially exceeded the default CLI timeout
  (~160 s); rerunning with a 10‑minute timeout completed unit, contract, fixture
  E2E, and visual suites with zero failures.

### Build Status

- **Status**: Pass
- **Details**: `pnpm typecheck`’s preliminary `turbo build` succeeded, producing
  `apps/api/dist/**` and `apps/web/dist/**` artifacts (though Finding F006 shows
  the provisioning template is still unreadable at runtime).

## Dependency Audit Summary

- **Baseline Severity Counts**: Not recorded in the dossier.
- **Current Severity Counts**: `pnpm audit --audit-level high` reported 0 known
  high/critical vulnerabilities.
- **New CVEs Identified**: None in this run.
- **Deprecated Packages**: None flagged.
- **Justifications / Version Currency**: No action required; re-run audit after
  remediations.

## Requirements Coverage Table

| Requirement | Summary                                                       | Implementation Evidence                                                                                                                                            | Validating Tests                                                                                                                                       | Linked Findings / Clarifications |
| ----------- | ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------- |
| **FR-001**  | Accessible workflow action opens the document editor          | `apps/web/src/pages/Project.tsx` Open Document card; `apps/web/src/app/router/document-routes.tsx` loader                                                          | `apps/web/tests/e2e/project-open-document.e2e.ts`; `apps/web/src/app/router/document-routes.test.ts`                                                   | –                                |
| **FR-002**  | Project page shows document status states                     | `apps/web/src/pages/Project.tsx` status logic; `apps/web/src/stores/template-store.ts` snapshot wiring                                                             | `apps/web/src/pages/Project.test.tsx`; `apps/web/src/stores/template-store.test.ts`                                                                    | –                                |
| **FR-003**  | “Create Document” CTA blocks navigation until ready           | `apps/web/src/pages/Project.tsx` create card; `apps/web/src/features/document-editor/hooks/use-create-document.ts`                                                 | `apps/web/src/pages/__tests__/Project.create-document.test.tsx`                                                                                        | –                                |
| **FR-004**  | Provision new document with progress/error handling           | `apps/api/src/routes/documents.ts`; `apps/api/src/services/document-provisioning.service.ts`; `apps/web/src/features/document-editor/hooks/use-create-document.ts` | `apps/api/tests/contract/documents/project-create-document.contract.test.ts`                                                                           | F006, F008                       |
| **FR-005**  | Route into editor landing on first section                    | `apps/web/src/app/router/document-routes.tsx`; `apps/web/src/features/document-editor/hooks/use-document-bootstrap.ts`                                             | `apps/web/src/features/document-editor/hooks/use-document-bootstrap.test.tsx`; `apps/web/tests/e2e/project-open-document.e2e.ts`                       | –                                |
| **FR-006**  | Load live document content with loading/not-found states      | `use-document-bootstrap.ts`; `document-editor.tsx`; `document-store.ts`                                                                                            | `apps/web/src/features/document-editor/hooks/use-document-bootstrap.test.tsx`; `apps/web/tests/e2e/document-conflict.e2e.ts`                           | –                                |
| **FR-007**  | Manual save/diff workflow with error recovery                 | `apps/web/src/features/section-editor/components/manual-save-panel.tsx`; `apps/web/src/features/section-editor/api/section-editor.client.ts`                       | `apps/web/tests/e2e/section-editor/edit-mode-conflict.e2e.ts`; `apps/api/tests/contract/documents.draft-bundle.contract.test.ts`                       | –                                |
| **FR-008**  | Conflict detection and guided resolution                      | `apps/web/src/features/section-editor/components/conflict-dialog.tsx`; manual-save panel                                                                           | `apps/web/tests/e2e/document-conflict.e2e.ts`                                                                                                          | –                                |
| **FR-009**  | Assumptions flow tied to active project/doc                   | `apps/web/src/features/document-editor/assumptions-flow/hooks/use-assumptions-flow.ts`; shared-data repositories                                                   | `apps/api/tests/contract/documents/assumptions-flow.contract.test.ts`; fixture E2E assumptions flow                                                    | –                                |
| **FR-010**  | Co-author sidebar streams responses with cancel/retry         | `apps/web/src/features/document-editor/hooks/useCoAuthorSession.ts`; `co-authoring.client.ts`; `co-authoring-store.ts`                                             | `apps/web/src/features/document-editor/hooks/useCoAuthorSession.test.tsx`; `apps/web/tests/e2e/document-qa-sidebar.e2e.ts`                             | –                                |
| **FR-011**  | Run QA checks from editor with latest gate results            | `apps/web/src/features/document-editor/quality-gates/components/DocumentQualityDashboard.tsx`; `useDocumentQaSession.ts`                                           | `apps/web/tests/e2e/document-qa-sidebar.e2e.ts`                                                                                                        | –                                |
| **FR-012**  | Persist template validation decisions from Project page       | `apps/web/src/pages/Project.tsx` template banner; `apps/web/src/stores/template-store.ts`; `apps/api/src/routes/templates.ts`                                      | `apps/web/src/pages/__tests__/Project.template-validation.test.tsx`; `apps/api/tests/contract/templates/template-validation-decision.contract.test.ts` | –                                |
| **FR-013**  | Export project from workflow card and deliver artifact/status | `apps/api/src/routes/projects.ts` export route; `apps/api/src/services/export/document-export.service.ts`; `apps/web/src/pages/Project.tsx` export card            | `apps/api/tests/contract/projects/export-project.contract.test.ts`                                                                                     | F007                             |
| **FR-014**  | Provide breadcrumbs/back navigation from editor to Project    | `apps/web/src/features/document-editor/components/document-editor.tsx`; `apps/web/src/pages/Project.tsx` link semantics                                            | `apps/web/tests/e2e/project-open-document.e2e.ts`                                                                                                      | –                                |

## Requirements Compliance Checklist

| Requirement Group             | Status             | Notes                                                                                                                           |
| ----------------------------- | ------------------ | ------------------------------------------------------------------------------------------------------------------------------- |
| **Constitutional Principles** | ⚠️ Needs Attention | Production provisioning still fails after build (F006), so library-first/CLI compliance is undermined until packaging is fixed. |
| **SOC 2 Authentication**      | ✅ Satisfied       | Auth middleware + loader token helper keep routes protected; F007/F008 do not weaken auth.                                      |
| **SOC 2 Logging**             | ✅ Satisfied       | Routes log requestId/project context before returning errors.                                                                   |
| **Security Controls**         | ✅ Satisfied       | Input validation and auth checks remain in place.                                                                               |
| **Code Quality**              | ❌ Failing         | Critical/Major findings block merge readiness.                                                                                  |
| **Testing Requirements**      | ⚠️ Needs Attention | Tests passed but do not cover dist provisioning or export completion; add regression coverage with remediations.                |

## Decision Log

- 2025-11-06 — Confirmed document loader now uses `createApiClient` + loader
  token helper, resolving prior auth regression (former Finding F004).
- 2025-11-06 — Identified that the provisioning template path still breaks under
  `dist`, so “Copy template assets” fix must be complemented with runtime path
  detection (Finding F006).
- 2025-11-06 — Determined export jobs never execute and Create Document contract
  overrides are ignored, leading to new Findings F007 and F008.

## Remediation Logging

### Remediation F006

- **Context**: Compiled API cannot locate `architecture-reference.yaml`, so
  provisioning fails in production builds.
- **Control Reference**: Template Asset Packaging
- **Actions**: Update `DocumentProvisioningService` to resolve the template from
  `dist/templates` (or embed it), fall back to repo root for dev, and add a
  build-time integration test that provisions a document via
  `node dist/apps/api/src/index.js`.
- **Verification**:
  `pnpm --filter @ctrl-freaq/api build && node dist/apps/api/src/index.js`
  followed by `POST /projects/:id/documents` succeeds;
  `pnpm --filter @ctrl-freaq/api test -- project-create-document.contract.test.ts`
  stays green.

### Remediation F007

- **Context**: Document export workflow only queues jobs; no exporter runs, so
  users never receive artifacts.
- **Control Reference**: Export Orchestration
- **Actions**: Invoke `DocumentExporter` (or a worker) from
  `DocumentExportService.enqueue`, update the job to `running/completed` with
  `artifactUrl`, and expose polling/telemetry to the Project card. Add
  contract/RTL tests that assert job status transitions and artifact delivery.
- **Verification**: `POST /projects/:id/export` returns `queued`, then polling
  or SSE shows `completed` with a valid `artifactUrl`; UI tests confirm the
  export card flips to `Ready`.

### Remediation F008

- **Context**: OpenAPI contract advertises Create Document overrides
  (title/template/seed strategy) that the API ignores.
- **Control Reference**: Input Validation & Contract Governance
- **Actions**: Expand `CreateDocumentRequestSchema` to accept the documented
  fields, plumb them through `DocumentProvisioningService`, and validate
  supported templates/versions/seed modes. Extend contract tests to cover
  override scenarios.
- **Verification**:
  `apps/api/tests/contract/documents/project-create-document.contract.test.ts`
  gains cases for overridden title/template/seed strategy and passes; UI wiring
  can request alternative templates without 400s.

---

**Review Completed**: 2025-11-06T23:26:56Z **Next Action**: Address Findings
F006–F008, rerun lint/type/test/build, and resubmit the feature for review.
